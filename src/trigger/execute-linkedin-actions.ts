/**
 * Execute LinkedIn Actions Task
 * Drains the linkedin_action_queue per account. Single executor for ALL LinkedIn actions.
 * Enforces safety: operating hours, daily limits, warm-up, circuit breaker, randomized delays.
 * Never knows about campaign types — just executes actions and logs results.
 */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { logError } from '@/lib/utils/logger';
import {
  dequeueNext,
  markExecuting,
  markCompleted,
  markFailed,
  insertActivityLog,
  cleanupOldRows,
  getDistinctQueuedAccounts,
} from '@/server/repositories/linkedin-action-queue.repo';
import {
  getAccountSettings,
  isWithinOperatingHours,
  isCircuitBreakerActive,
  checkDailyLimit,
  mapToLimitAction,
  randomDelay,
  sleep,
  shouldSkipRun,
  activateCircuitBreaker,
} from '@/server/services/account-safety.service';
import { incrementDailyLimit } from '@/server/repositories/account-safety.repo';
import { executeAction, isRateLimitError } from '@/server/services/linkedin-action-executor';
import { MAX_ACTIONS_PER_RUN } from '@/lib/types/linkedin-action-queue';
import type { AccountSafetySettings } from '@/server/services/account-safety.service';
import type { ActionType } from '@/lib/types/post-campaigns';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get today's date string in the account's configured timezone (YYYY-MM-DD). */
function getLocalDate(settings: AccountSafetySettings): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: settings.timezone });
}

// ─── Scheduled Task ──────────────────────────────────────────────────────────

export const executeLinkedInActions = schedules.task({
  id: 'execute-linkedin-actions',
  cron: '*/5 * * * *',
  maxDuration: 300,
  queue: { concurrencyLimit: 1 },

  run: async () => {
    // 10% chance to skip run for natural unpredictability
    if (shouldSkipRun()) {
      logger.info('execute-linkedin-actions: skipping run (jitter)');
      return { skipped: true };
    }

    // Hourly cleanup: runs when minute < 5 (i.e., on the first tick of each hour)
    const currentMinute = new Date().getMinutes();
    if (currentMinute < 5) {
      try {
        const { error: cleanupError } = await cleanupOldRows();
        if (cleanupError) {
          logger.warn('execute-linkedin-actions: cleanup failed', {
            error: cleanupError.message,
          });
        } else {
          logger.info('execute-linkedin-actions: cleanup complete');
        }
      } catch (cleanupErr) {
        logError(
          'execute-linkedin-actions/cleanup',
          cleanupErr instanceof Error ? cleanupErr : new Error(String(cleanupErr)),
          {}
        );
      }
    }

    // Discover accounts with queued actions
    let accounts: Array<{ unipile_account_id: string; user_id: string }>;
    try {
      accounts = await getDistinctQueuedAccounts();
    } catch (err) {
      logError(
        'execute-linkedin-actions/discover',
        err instanceof Error ? err : new Error(String(err)),
        {}
      );
      return { error: 'Failed to discover queued accounts' };
    }

    if (accounts.length === 0) {
      logger.info('execute-linkedin-actions: no accounts with queued actions');
      return { accountsProcessed: 0, totalActionsExecuted: 0 };
    }

    logger.info('execute-linkedin-actions: starting run', { accountCount: accounts.length });

    const client = getUnipileClient();
    let totalActionsExecuted = 0;

    for (const { unipile_account_id: accountId, user_id: userId } of accounts) {
      try {
        // Safety checks
        const settings = await getAccountSettings(userId, accountId);

        if (!isWithinOperatingHours(settings)) {
          logger.info('execute-linkedin-actions: outside operating hours — skipping account', {
            accountId,
          });
          continue;
        }

        if (isCircuitBreakerActive(settings)) {
          logger.info('execute-linkedin-actions: circuit breaker active — skipping account', {
            accountId,
          });
          continue;
        }

        // Drain the queue for this account up to MAX_ACTIONS_PER_RUN
        let actionsThisRun = 0;

        while (actionsThisRun < MAX_ACTIONS_PER_RUN) {
          // Fetch next queued action for this account
          const { data: action, error: dequeueError } = await dequeueNext(accountId);

          if (dequeueError) {
            logger.warn('execute-linkedin-actions: dequeue error', {
              accountId,
              error: dequeueError.message,
            });
            break;
          }

          if (!action) {
            // Queue empty for this account
            break;
          }

          // Determine if this action type has a daily limit
          const limitAction = mapToLimitAction(action.action_type);

          if (limitAction !== null) {
            const { allowed } = await checkDailyLimit(accountId, limitAction, settings);
            if (!allowed) {
              logger.info('execute-linkedin-actions: daily limit reached — stopping account', {
                accountId,
                limitAction,
              });
              break;
            }
          }

          // Mark as executing
          await markExecuting(action.id);

          try {
            // Execute the action via the dispatcher
            const result = await executeAction(client, action);

            const resultPayload =
              result != null && typeof result === 'object'
                ? (result as Record<string, unknown>)
                : { data: result };

            // Mark completed + write activity log
            await markCompleted(action.id, resultPayload);
            await insertActivityLog({
              user_id: action.user_id,
              unipile_account_id: action.unipile_account_id,
              action_type: action.action_type,
              target_provider_id: action.target_provider_id,
              target_linkedin_url: action.target_linkedin_url,
              source_type: action.source_type,
              source_campaign_id: action.source_campaign_id,
              source_lead_id: action.source_lead_id,
              payload: action.payload,
              result: resultPayload,
            });

            // Increment daily limit counter if applicable
            if (limitAction !== null) {
              const localDate = getLocalDate(settings);
              await incrementDailyLimit(accountId, localDate, limitAction as ActionType);
            }

            actionsThisRun++;
            totalActionsExecuted++;

            logger.info('execute-linkedin-actions: action completed', {
              accountId,
              actionId: action.id,
              actionType: action.action_type,
              actionsThisRun,
            });
          } catch (execErr) {
            const errorMessage = execErr instanceof Error ? execErr.message : String(execErr);

            if (isRateLimitError(execErr)) {
              // Rate limit / account restriction — activate circuit breaker and stop this account
              logger.warn(
                'execute-linkedin-actions: rate limit detected — activating circuit breaker',
                {
                  accountId,
                  actionId: action.id,
                  error: errorMessage,
                }
              );

              await activateCircuitBreaker(userId, accountId, errorMessage);
              await markFailed(action.id, errorMessage);
              break;
            }

            // Normal transient error — mark failed and continue draining
            logger.warn('execute-linkedin-actions: action failed', {
              accountId,
              actionId: action.id,
              actionType: action.action_type,
              error: errorMessage,
            });
            await markFailed(action.id, errorMessage);
            actionsThisRun++;
          }

          // Randomized delay between actions to mimic human behaviour
          if (actionsThisRun < MAX_ACTIONS_PER_RUN) {
            await sleep(randomDelay(settings));
          }
        }
      } catch (accountErr) {
        logError(
          'execute-linkedin-actions/account',
          accountErr instanceof Error ? accountErr : new Error(String(accountErr)),
          { accountId, userId }
        );
      }
    }

    logger.info('execute-linkedin-actions: run complete', {
      accountsProcessed: accounts.length,
      totalActionsExecuted,
    });

    return { accountsProcessed: accounts.length, totalActionsExecuted };
  },
});
