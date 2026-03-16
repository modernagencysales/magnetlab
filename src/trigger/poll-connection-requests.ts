/**
 * Poll Connection Requests Task
 * Scheduled every 20 minutes with random jitter. Polls Unipile for pending connection
 * requests and accepts those from detected campaign leads.
 * Never runs parallel LinkedIn actions. Obeys LINKEDIN_SAFETY limits at all times.
 */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { logError } from '@/lib/utils/logger';
import {
  listActiveCampaigns,
  findLeadsByStatus,
  updateCampaignLead,
  incrementDailyLimit,
} from '@/server/repositories/post-campaigns.repo';
import { checkDailyLimit, randomDelay, sleep } from '@/server/services/post-campaigns.service';
import { LINKEDIN_SAFETY } from '@/lib/types/post-campaigns';
import type { PostCampaign, PostCampaignLead } from '@/lib/types/post-campaigns';

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
 * Check if an invitation sender matches a detected campaign lead.
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

// ─── Core Accept Logic (per account) ─────────────────────────────────────────

async function processAccountInvitations(
  group: CampaignGroup,
  actionsRemaining: { count: number }
): Promise<number> {
  const client = getUnipileClient();
  let accepted = 0;

  // Check daily accept limit for this account before fetching invitations
  const canAccept = await checkDailyLimit(group.userId, group.accountId, 'connections_accepted');
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
    logger.error('poll-connection-requests: failed to list invitations', {
      accountId: group.accountId,
      error: invitationsResult.error,
    });
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

  // Gather all detected leads across all campaigns for this account
  const allDetectedLeads: Array<{ lead: PostCampaignLead; campaign: PostCampaign }> = [];

  for (const campaign of group.campaigns) {
    if (!campaign.auto_accept_connections) continue;

    const { data: leads, error: leadsError } = await findLeadsByStatus(campaign.id, 'detected');

    if (leadsError) {
      logger.error('poll-connection-requests: failed to fetch detected leads', {
        campaignId: campaign.id,
        error: leadsError.message,
      });
      continue;
    }

    for (const lead of leads ?? []) {
      allDetectedLeads.push({ lead, campaign });
    }
  }

  if (allDetectedLeads.length === 0) {
    logger.info('poll-connection-requests: no detected leads waiting for acceptance', {
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

    // Try to match this invitation sender to a detected campaign lead
    const match = matchInvitationToLead(
      senderProviderId,
      senderPublicIdentifier,
      allDetectedLeads.map((e) => e.lead)
    );

    if (!match) continue;

    const matchEntry = allDetectedLeads.find((e) => e.lead.id === match.id);
    if (!matchEntry) continue;

    const { lead, campaign } = matchEntry;

    // Re-check limit before each accept
    const stillCanAccept = await checkDailyLimit(
      group.userId,
      group.accountId,
      'connections_accepted'
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
        logger.warn('poll-connection-requests: failed to accept invitation', {
          invitationId: invitation.id,
          leadId: lead.id,
          error: acceptResult.error,
        });
        // Don't update lead status — leave as 'detected' for retry
      } else {
        await updateCampaignLead(lead.id, {
          status: 'connection_accepted',
          connection_accepted_at: new Date().toISOString(),
          // Cache the provider_id if we resolved it from the invitation sender
          unipile_provider_id: lead.unipile_provider_id ?? senderProviderId ?? null,
          error: null,
        });
        await incrementDailyLimit(group.accountId, 'connections_accepted');
        accepted++;
        actionsRemaining.count--;

        logger.info('poll-connection-requests: connection accepted', {
          campaignId: campaign.id,
          leadId: lead.id,
          invitationId: invitation.id,
        });

        // Randomized delay between accepts — safety measure, always runs
        if (actionsRemaining.count > 0) {
          const delay = randomDelay(
            LINKEDIN_SAFETY.MIN_DELAY_BETWEEN_ACCEPTS_MS,
            LINKEDIN_SAFETY.MAX_DELAY_BETWEEN_ACCEPTS_MS
          );
          await sleep(delay);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logError('poll-connection-requests/accept', err instanceof Error ? err : new Error(msg), {
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
  run: async () => {
    // Step 1: Apply random jitter before starting (0 to POLL_JITTER_MINUTES * 60s)
    const jitterMs = randomDelay(0, LINKEDIN_SAFETY.POLL_JITTER_MINUTES * 60_000);
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

      try {
        const accepted = await processAccountInvitations(group, actionsRemaining);
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
