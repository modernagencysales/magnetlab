/**
 * Poll Connection Requests Task
 * Scheduled every 20 minutes with random jitter. Polls Unipile for pending connection
 * requests and accepts those from detected or connection_pending campaign leads.
 * Never runs parallel LinkedIn actions. Uses account-safety service for operating hours,
 * circuit breaker, daily limits, and randomized delays.
 */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { logError } from '@/lib/utils/logger';
import {
  listActiveCampaigns,
  findLeadsByStatuses,
  updateCampaignLead,
} from '@/server/repositories/post-campaigns.repo';
import {
  getAccountSettings,
  isWithinOperatingHours,
  isCircuitBreakerActive,
  shouldSkipRun,
  randomDelay,
  checkDailyLimit,
} from '@/server/services/account-safety.service';
import { setCircuitBreaker, incrementDailyLimit } from '@/server/repositories/account-safety.repo';
import { sleep } from '@/server/services/post-campaigns.service';
import { LINKEDIN_SAFETY } from '@/lib/types/post-campaigns';
import type { PostCampaign, PostCampaignLead, AccountSafetySettings } from '@/lib/types/post-campaigns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CampaignGroup {
  accountId: string;
  userId: string;
  campaigns: PostCampaign[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Group active campaigns by unipile_account_id, collecting all campaigns per account. */
function groupByAccount(campaigns: PostCampaign[]): CampaignGroup[] {
  const map = new Map<string, CampaignGroup>();
  for (const campaign of campaigns) {
    const key = campaign.unipile_account_id;
    if (!map.has(key)) {
      map.set(key, {
        accountId: key,
        userId: campaign.user_id,
        campaigns: [],
      });
    }
    map.get(key)!.campaigns.push(campaign);
  }
  return [...map.values()];
}

/**
 * Check if an invitation sender matches a campaign lead (detected or connection_pending).
 * Tries matching on provider_id (cached) or public_identifier against linkedin_username.
 */
function matchInvitationToLead(
  senderProviderId: string | null | undefined,
  senderPublicIdentifier: string | null | undefined,
  leads: PostCampaignLead[]
): PostCampaignLead | null {
  for (const lead of leads) {
    // Match by cached unipile_provider_id
    if (senderProviderId && lead.unipile_provider_id) {
      if (senderProviderId === lead.unipile_provider_id) return lead;
    }

    // Match by public_identifier (LinkedIn username) against linkedin_username
    if (senderPublicIdentifier && lead.linkedin_username) {
      if (senderPublicIdentifier.toLowerCase() === lead.linkedin_username.toLowerCase()) {
        return lead;
      }
    }

    // Fallback: match sender provider_id against stored linkedin_username (Unipile uses
    // numeric provider IDs so this only fires when lead has a provider_id stored as username)
    if (senderProviderId && lead.linkedin_username) {
      if (senderProviderId === lead.linkedin_username) return lead;
    }
  }
  return null;
}

/** Get today's date string in the account's timezone (YYYY-MM-DD). */
function getLocalDate(settings: AccountSafetySettings): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: settings.timezone });
}

/** Check if an error message indicates a rate limit or account restriction. */
function isRateLimitOrRestriction(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('restricted') ||
    lower.includes('temporarily') ||
    lower.includes('challenge')
  );
}

// ─── Core Accept Logic (per account) ─────────────────────────────────────────

async function processAccountInvitations(
  group: CampaignGroup,
  actionsRemaining: { count: number },
  settings: AccountSafetySettings
): Promise<number> {
  const client = getUnipileClient();
  let accepted = 0;

  // Check daily accept limit for this account before fetching invitations
  const { allowed: canAccept } = await checkDailyLimit(
    group.accountId,
    'connection_accept',
    settings
  );
  if (!canAccept) {
    logger.info('poll-connection-requests: daily accept limit reached for account', {
      accountId: group.accountId,
      userId: group.userId,
    });
    return 0;
  }

  // Fetch pending invitations for this account
  const invitationsResult = await client.listReceivedInvitations(group.accountId);
  if (invitationsResult.error || !invitationsResult.data) {
    const errorMsg = String(invitationsResult.error ?? '');
    // Check if this is a rate limit / restriction that should trigger circuit breaker
    if (isRateLimitOrRestriction(errorMsg)) {
      const breakerUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await setCircuitBreaker(group.userId, group.accountId, breakerUntil);
      logger.error('poll-connection-requests: circuit breaker activated on list invitations', {
        accountId: group.accountId,
        error: errorMsg,
        breakerUntil: breakerUntil.toISOString(),
      });
    } else {
      logger.error('poll-connection-requests: failed to list invitations', {
        accountId: group.accountId,
        error: invitationsResult.error,
      });
    }
    return 0;
  }

  const invitations = invitationsResult.data;
  if (invitations.length === 0) {
    logger.info('poll-connection-requests: no pending invitations', {
      accountId: group.accountId,
    });
    return 0;
  }

  logger.info('poll-connection-requests: invitations found', {
    accountId: group.accountId,
    count: invitations.length,
  });

  // Gather all detected + connection_pending leads across all campaigns for this account
  const allMatchableLeads: Array<{ lead: PostCampaignLead; campaign: PostCampaign }> = [];

  for (const campaign of group.campaigns) {
    if (!campaign.auto_accept_connections) continue;

    const { data: leads, error: leadsError } = await findLeadsByStatuses(campaign.id, [
      'detected',
      'connection_pending',
    ]);

    if (leadsError) {
      logger.error('poll-connection-requests: failed to fetch matchable leads', {
        campaignId: campaign.id,
        error: leadsError.message,
      });
      continue;
    }

    for (const lead of leads ?? []) {
      allMatchableLeads.push({ lead, campaign });
    }
  }

  if (allMatchableLeads.length === 0) {
    logger.info('poll-connection-requests: no leads waiting for acceptance', {
      accountId: group.accountId,
    });
    return 0;
  }

  // Process each invitation — one at a time, never in parallel
  for (const invitation of invitations) {
    if (actionsRemaining.count <= 0) break;

    const senderProviderId = invitation.sender?.provider_id ?? invitation.provider_id ?? null;
    const senderPublicIdentifier =
      ((invitation.sender as Record<string, unknown> | undefined)?.public_identifier as
        | string
        | undefined) ?? null;

    // Try to match this invitation sender to a detected/connection_pending campaign lead
    const match = matchInvitationToLead(
      senderProviderId,
      senderPublicIdentifier,
      allMatchableLeads.map((e) => e.lead)
    );

    if (!match) continue;

    const matchEntry = allMatchableLeads.find((e) => e.lead.id === match.id);
    if (!matchEntry) continue;

    const { lead, campaign } = matchEntry;

    // Re-check daily limit before each accept
    const { allowed: stillCanAccept } = await checkDailyLimit(
      group.accountId,
      'connection_accept',
      settings
    );
    if (!stillCanAccept) {
      logger.info('poll-connection-requests: daily accept limit reached mid-run', {
        accountId: group.accountId,
      });
      break;
    }

    try {
      const acceptResult = await client.handleInvitation(invitation.id, 'accept');

      if (acceptResult.error) {
        const errorMsg = String(acceptResult.error);
        // Check for rate limit / restriction errors
        if (isRateLimitOrRestriction(errorMsg)) {
          const breakerUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await setCircuitBreaker(group.userId, group.accountId, breakerUntil);
          logger.error('poll-connection-requests: circuit breaker activated for 24h', {
            accountId: group.accountId,
            error: errorMsg,
            breakerUntil: breakerUntil.toISOString(),
          });
          break; // Stop all actions for this account
        }

        logger.warn('poll-connection-requests: failed to accept invitation', {
          invitationId: invitation.id,
          leadId: lead.id,
          error: acceptResult.error,
        });
        // Don't update lead status — leave for retry
      } else {
        await updateCampaignLead(lead.id, {
          status: 'connection_accepted',
          connection_accepted_at: new Date().toISOString(),
          // Cache the provider_id if we resolved it from the invitation sender
          unipile_provider_id: lead.unipile_provider_id ?? senderProviderId ?? null,
          error: null,
        });
        const localDate = getLocalDate(settings);
        await incrementDailyLimit(group.accountId, localDate, 'connection_accept');
        accepted++;
        actionsRemaining.count--;

        logger.info('poll-connection-requests: connection accepted', {
          campaignId: campaign.id,
          leadId: lead.id,
          invitationId: invitation.id,
        });

        // Randomized delay between accepts — uses per-account safety settings
        if (actionsRemaining.count > 0) {
          await randomDelay(settings);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Check for rate limit / restriction errors from thrown exceptions
      if (isRateLimitOrRestriction(errorMsg)) {
        const breakerUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await setCircuitBreaker(group.userId, group.accountId, breakerUntil);
        logger.error('poll-connection-requests: circuit breaker activated for 24h', {
          accountId: group.accountId,
          error: errorMsg,
          breakerUntil: breakerUntil.toISOString(),
        });
        break; // Stop all actions for this account
      }

      logError('poll-connection-requests/accept', err instanceof Error ? err : new Error(errorMsg), {
        invitationId: invitation.id,
        leadId: lead.id,
      });
    }
  }

  return accepted;
}

// ─── Scheduled Task ──────────────────────────────────────────────────────────

export const pollConnectionRequests = schedules.task({
  id: 'poll-connection-requests',
  cron: '*/20 * * * *',
  maxDuration: 180,
  queue: { concurrencyLimit: 1 },
  run: async () => {
    // Step 0: Random skip — 10% chance to add natural unpredictability
    if (shouldSkipRun()) {
      logger.info('poll-connection-requests: randomly skipping this run (10% jitter)');
      return { skipped: true, accepted: 0 };
    }

    // Step 1: Apply random jitter before starting (0 to POLL_JITTER_MINUTES * 60s)
    const jitterMs = Math.floor(
      Math.random() * LINKEDIN_SAFETY.POLL_JITTER_MINUTES * 60_000
    );
    logger.info('poll-connection-requests: applying jitter', { jitterMs });
    await sleep(jitterMs);

    logger.info('poll-connection-requests: starting run');

    // Step 2: Fetch all active campaigns
    const { data: campaigns, error: campaignError } = await listActiveCampaigns();
    if (campaignError) {
      logger.error('poll-connection-requests: failed to fetch active campaigns', {
        error: campaignError.message,
      });
      return { accepted: 0 };
    }

    if (!campaigns || campaigns.length === 0) {
      logger.info('poll-connection-requests: no active campaigns');
      return { accepted: 0 };
    }

    // Step 3: Group campaigns by Unipile account (one API call per account)
    const accountGroups = groupByAccount(campaigns);
    logger.info('poll-connection-requests: processing accounts', {
      accountCount: accountGroups.length,
    });

    // Shared counter — capped across all accounts
    const actionsRemaining = { count: LINKEDIN_SAFETY.MAX_ACTIONS_PER_RUN };
    let totalAccepted = 0;

    // Step 4: Process each account sequentially — never in parallel
    for (const group of accountGroups) {
      if (actionsRemaining.count <= 0) break;

      // Load per-account safety settings (returns defaults if none configured)
      const settings = await getAccountSettings(group.userId, group.accountId);

      // Skip accounts outside operating hours
      if (!isWithinOperatingHours(settings)) {
        logger.info('poll-connection-requests: outside operating hours, skipping', {
          accountId: group.accountId,
          hours: `${settings.operatingHoursStart}-${settings.operatingHoursEnd}`,
          timezone: settings.timezone,
        });
        continue;
      }

      // Skip accounts with active circuit breaker
      if (isCircuitBreakerActive(settings)) {
        logger.info('poll-connection-requests: circuit breaker active, skipping', {
          accountId: group.accountId,
          breakerUntil: settings.circuitBreakerUntil,
        });
        continue;
      }

      try {
        const accepted = await processAccountInvitations(group, actionsRemaining, settings);
        totalAccepted += accepted;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logError('poll-connection-requests/account', err instanceof Error ? err : new Error(msg), {
          accountId: group.accountId,
        });
      }
    }

    logger.info('poll-connection-requests: run complete', { totalAccepted });
    return { accepted: totalAccepted };
  },
});
