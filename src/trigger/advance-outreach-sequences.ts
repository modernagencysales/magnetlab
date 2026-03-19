/**
 * Advance Outreach Sequences Task
 * Scheduled every 5 minutes. Four phases per active campaign:
 *   1. Process completed queue actions → update lead timestamps/status
 *   2. Check withdrawal timeouts → enqueue withdraw for stale connections
 *   3. Evaluate next steps → enqueue actions based on preset + timestamps
 *   4. Check campaign completion → mark campaign complete when all leads terminal
 * Never calls Unipile directly. Enqueues actions into the shared queue.
 */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { logError } from '@/lib/utils/logger';
import { extractLinkedInUsername } from '@/lib/utils/linkedin-url';
import {
  listActiveCampaigns,
  getSteps,
  getLeadsByStatus,
  getLeadsByStatuses,
  updateLead,
  updateCampaignStatusInternal,
} from '@/server/repositories/outreach-campaigns.repo';
import {
  getUnprocessedResultsByCampaign,
  markProcessed,
  hasPendingAction,
  enqueueAction,
} from '@/server/repositories/linkedin-action-queue.repo';
import { renderTemplate } from '@/server/services/outreach-campaigns.service';
import { QUEUE_PRIORITY } from '@/lib/types/linkedin-action-queue';
import type { QueuedAction } from '@/lib/types/linkedin-action-queue';
import type {
  OutreachCampaign,
  OutreachCampaignLead,
  OutreachCampaignStep,
} from '@/lib/types/outreach-campaigns';

// ─── Constants ───────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

// ─── Phase 1: Process Completed Actions ─────────────────────────────────────

async function processCompletedActions(campaign: OutreachCampaign): Promise<number> {
  const { data: actions, error } = await getUnprocessedResultsByCampaign(
    'outreach_campaign',
    campaign.id
  );

  if (error || !actions || actions.length === 0) return 0;

  let processed = 0;
  const now = new Date().toISOString();

  for (const action of actions as QueuedAction[]) {
    try {
      if (action.status === 'failed') {
        await updateLead(action.source_lead_id, {
          status: 'failed',
          error: action.error,
          updated_at: now,
        });
      } else {
        // Completed — update lead based on action type
        switch (action.action_type) {
          case 'view_profile': {
            const providerId =
              action.result && typeof action.result === 'object'
                ? ((action.result as Record<string, unknown>).provider_id as string | undefined)
                : undefined;
            await updateLead(action.source_lead_id, {
              viewed_at: now,
              current_step_order: 1,
              step_completed_at: now,
              updated_at: now,
              ...(providerId ? { unipile_provider_id: providerId } : {}),
            });
            break;
          }
          case 'connect':
            await updateLead(action.source_lead_id, {
              connect_sent_at: now,
              current_step_order: 2,
              step_completed_at: now,
              updated_at: now,
            });
            break;
          case 'message':
            await updateLead(action.source_lead_id, {
              messaged_at: now,
              current_step_order: 3,
              step_completed_at: now,
              updated_at: now,
            });
            break;
          case 'follow_up_message':
            await updateLead(action.source_lead_id, {
              follow_up_sent_at: now,
              current_step_order: 4,
              status: 'completed',
              step_completed_at: now,
              updated_at: now,
            });
            break;
          case 'withdraw':
            await updateLead(action.source_lead_id, {
              withdrawn_at: now,
              status: 'withdrawn',
              step_completed_at: now,
              updated_at: now,
            });
            break;
          default:
            break;
        }
      }

      await markProcessed(action.id);
      processed++;
    } catch (err) {
      logError(
        'advance-outreach-sequences/processCompletedActions',
        err instanceof Error ? err : new Error(String(err)),
        { campaignId: campaign.id, actionId: action.id }
      );
    }
  }

  return processed;
}

// ─── Phase 2: Withdrawal Timeouts ───────────────────────────────────────────

async function checkWithdrawalTimeouts(campaign: OutreachCampaign): Promise<number> {
  // Get active leads that have sent connect requests but not yet connected
  const { data: leads, error } = await getLeadsByStatus(campaign.id, 'active');

  if (error || !leads || leads.length === 0) return 0;

  const now = Date.now();
  const withdrawDelayMs = campaign.withdraw_delay_days * MS_PER_DAY;
  let enqueued = 0;

  for (const lead of leads as OutreachCampaignLead[]) {
    // Only check leads that have sent connect but not been accepted
    if (!lead.connect_sent_at || lead.connected_at) continue;

    const connectSentTime = new Date(lead.connect_sent_at).getTime();
    if (now - connectSentTime < withdrawDelayMs) continue;

    try {
      const pending = await hasPendingAction(lead.id);
      if (pending) continue;

      const { error: enqueueErr } = await enqueueAction({
        user_id: campaign.user_id,
        unipile_account_id: campaign.unipile_account_id,
        action_type: 'withdraw',
        target_provider_id: lead.unipile_provider_id ?? undefined,
        payload: {},
        priority: QUEUE_PRIORITY.OUTREACH,
        source_type: 'outreach_campaign',
        source_campaign_id: campaign.id,
        source_lead_id: lead.id,
      });

      if (enqueueErr) {
        logger.warn('advance-outreach-sequences/withdraw: enqueue failed', {
          campaignId: campaign.id,
          leadId: lead.id,
          error: enqueueErr.message,
        });
      } else {
        enqueued++;
        logger.info('advance-outreach-sequences/withdraw: enqueued withdraw', {
          campaignId: campaign.id,
          leadId: lead.id,
        });
      }
    } catch (err) {
      logError(
        'advance-outreach-sequences/checkWithdrawalTimeouts',
        err instanceof Error ? err : new Error(String(err)),
        { campaignId: campaign.id, leadId: lead.id }
      );
    }
  }

  return enqueued;
}

// ─── Phase 3: Evaluate Next Steps ──────────────────────────────────────────

async function evaluateNextSteps(
  campaign: OutreachCampaign,
  steps: OutreachCampaignStep[]
): Promise<number> {
  const { data: leads, error } = await getLeadsByStatuses(campaign.id, ['pending', 'active']);

  if (error || !leads || leads.length === 0) return 0;

  const now = Date.now();
  let enqueued = 0;

  for (const lead of leads as OutreachCampaignLead[]) {
    try {
      const pending = await hasPendingAction(lead.id);
      if (pending) continue;

      // Determine next action based on lead state
      if (!lead.viewed_at) {
        // First step: view profile
        const username = extractLinkedInUsername(lead.linkedin_url);
        if (!username) {
          logger.warn('advance-outreach-sequences/evaluate: invalid linkedin url', {
            campaignId: campaign.id,
            leadId: lead.id,
            url: lead.linkedin_url,
          });
          continue;
        }

        const { error: enqueueErr } = await enqueueAction({
          user_id: campaign.user_id,
          unipile_account_id: campaign.unipile_account_id,
          action_type: 'view_profile',
          payload: { username },
          priority: QUEUE_PRIORITY.OUTREACH,
          source_type: 'outreach_campaign',
          source_campaign_id: campaign.id,
          source_lead_id: lead.id,
        });

        if (enqueueErr) {
          logger.warn('advance-outreach-sequences/evaluate: enqueue view_profile failed', {
            campaignId: campaign.id,
            leadId: lead.id,
            error: enqueueErr.message,
          });
        } else {
          enqueued++;
          // Transition pending → active
          if (lead.status === 'pending') {
            await updateLead(lead.id, { status: 'active' });
          }
        }
      } else if (!lead.connect_sent_at) {
        // Check delay from connect step
        const connectStep = steps.find((s) => s.action_type === 'connect');
        if (!connectStep) continue;

        const delayMs = connectStep.delay_days * MS_PER_DAY + connectStep.delay_hours * MS_PER_HOUR;
        if (lead.step_completed_at && now - new Date(lead.step_completed_at).getTime() < delayMs) {
          continue;
        }

        const { error: enqueueErr } = await enqueueAction({
          user_id: campaign.user_id,
          unipile_account_id: campaign.unipile_account_id,
          action_type: 'connect',
          target_provider_id: lead.unipile_provider_id ?? undefined,
          payload: campaign.connect_message ? { message: campaign.connect_message } : {},
          priority: QUEUE_PRIORITY.OUTREACH,
          source_type: 'outreach_campaign',
          source_campaign_id: campaign.id,
          source_lead_id: lead.id,
        });

        if (enqueueErr) {
          logger.warn('advance-outreach-sequences/evaluate: enqueue connect failed', {
            campaignId: campaign.id,
            leadId: lead.id,
            error: enqueueErr.message,
          });
        } else {
          enqueued++;
        }
      } else if (lead.connected_at && !lead.messaged_at) {
        // Connected, send first message
        const text = renderTemplate(campaign.first_message_template, {
          name: lead.name ?? '',
          company: lead.company ?? '',
        });

        const { error: enqueueErr } = await enqueueAction({
          user_id: campaign.user_id,
          unipile_account_id: campaign.unipile_account_id,
          action_type: 'message',
          target_provider_id: lead.unipile_provider_id ?? undefined,
          payload: { text },
          priority: QUEUE_PRIORITY.OUTREACH,
          source_type: 'outreach_campaign',
          source_campaign_id: campaign.id,
          source_lead_id: lead.id,
        });

        if (enqueueErr) {
          logger.warn('advance-outreach-sequences/evaluate: enqueue message failed', {
            campaignId: campaign.id,
            leadId: lead.id,
            error: enqueueErr.message,
          });
        } else {
          enqueued++;
        }
      }
      // follow_up is handled by check-outreach-replies task, NOT here
    } catch (err) {
      logError(
        'advance-outreach-sequences/evaluateNextSteps',
        err instanceof Error ? err : new Error(String(err)),
        { campaignId: campaign.id, leadId: lead.id }
      );
    }
  }

  return enqueued;
}

// ─── Phase 4: Campaign Completion ──────────────────────────────────────────

async function checkCampaignCompletion(campaign: OutreachCampaign): Promise<boolean> {
  const { data: activeLeads, error } = await getLeadsByStatuses(campaign.id, ['pending', 'active']);

  if (error) {
    logError('advance-outreach-sequences/checkCampaignCompletion', error, {
      campaignId: campaign.id,
    });
    return false;
  }

  if (!activeLeads || activeLeads.length === 0) {
    const { error: updateError } = await updateCampaignStatusInternal(campaign.id, 'completed');
    if (updateError) {
      logError('advance-outreach-sequences/checkCampaignCompletion/update', updateError, {
        campaignId: campaign.id,
      });
      return false;
    }
    logger.info('advance-outreach-sequences: campaign completed', {
      campaignId: campaign.id,
    });
    return true;
  }

  return false;
}

// ─── Scheduled Task ─────────────────────────────────────────────────────────

export const advanceOutreachSequences = schedules.task({
  id: 'advance-outreach-sequences',
  cron: '*/5 * * * *',
  maxDuration: 120,
  queue: { concurrencyLimit: 1 },

  run: async () => {
    const { data: campaigns, error: campaignError } = await listActiveCampaigns();

    if (campaignError) {
      logError('advance-outreach-sequences/listCampaigns', campaignError, {});
      return { error: 'Failed to list active campaigns' };
    }

    if (!campaigns || campaigns.length === 0) {
      logger.info('advance-outreach-sequences: no active campaigns');
      return { campaignsProcessed: 0 };
    }

    logger.info('advance-outreach-sequences: starting run', {
      campaignCount: campaigns.length,
    });

    let totalProcessed = 0;
    let totalEnqueued = 0;
    let totalCompleted = 0;

    for (const campaign of campaigns as OutreachCampaign[]) {
      try {
        // Phase 1: Process completed actions
        const processed = await processCompletedActions(campaign);
        totalProcessed += processed;

        // Phase 2: Check withdrawal timeouts
        const withdrawals = await checkWithdrawalTimeouts(campaign);
        totalEnqueued += withdrawals;

        // Phase 3: Evaluate next steps
        const { data: steps, error: stepsError } = await getSteps(campaign.id);
        if (stepsError || !steps) {
          logger.warn('advance-outreach-sequences: failed to get steps', {
            campaignId: campaign.id,
            error: stepsError?.message,
          });
          continue;
        }

        const nextSteps = await evaluateNextSteps(campaign, steps as OutreachCampaignStep[]);
        totalEnqueued += nextSteps;

        // Phase 4: Check campaign completion
        const completed = await checkCampaignCompletion(campaign);
        if (completed) totalCompleted++;
      } catch (err) {
        logError(
          'advance-outreach-sequences/campaign',
          err instanceof Error ? err : new Error(String(err)),
          { campaignId: campaign.id }
        );
      }
    }

    logger.info('advance-outreach-sequences: run complete', {
      campaignsProcessed: campaigns.length,
      totalProcessed,
      totalEnqueued,
      totalCompleted,
    });

    return {
      campaignsProcessed: campaigns.length,
      totalProcessed,
      totalEnqueued,
      totalCompleted,
    };
  },
});
