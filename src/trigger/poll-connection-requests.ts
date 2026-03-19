/**
 * Poll Connection Requests Task
 * Scheduled every 20 minutes with random jitter. Two phases:
 *   Phase 0 — Process Results: consume completed accept_invitation actions from queue,
 *             update post_campaign_leads + outreach_campaign_leads status.
 *   Phase 1 — Discover & Enqueue: poll Unipile for pending invitations, match to campaign
 *             leads, and enqueue accept_invitation actions to the shared queue.
 * The executor task handles safety checks, operating hours, delays, and rate limits.
 */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { logError } from '@/lib/utils/logger';
import {
  listActiveCampaigns,
  findLeadsByStatuses,
  updateCampaignLead,
} from '@/server/repositories/post-campaigns.repo';
import { shouldSkipRun } from '@/server/services/account-safety.service';
import {
  enqueueAction,
  getUnprocessedResultsByCampaign,
  markProcessed,
  hasPendingAction,
} from '@/server/repositories/linkedin-action-queue.repo';
import { QUEUE_PRIORITY } from '@/lib/types/linkedin-action-queue';
import type { QueuedAction } from '@/lib/types/linkedin-action-queue';
import { sleep } from '@/server/services/post-campaigns.service';
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

// ─── Phase 0: Process Completed Accept Actions ──────────────────────────────
// Consumes completed/failed accept_invitation actions from the queue,
// updates post_campaign_leads and checks outreach_campaign_leads.

async function processCompletedAccepts(): Promise<number> {
  const { data: campaigns, error: campaignError } = await listActiveCampaigns();
  if (campaignError || !campaigns || campaigns.length === 0) {
    return 0;
  }

  const supabase = createSupabaseAdminClient();
  let totalProcessed = 0;

  for (const campaign of campaigns) {
    try {
      const { data: results, error: resultsError } = await getUnprocessedResultsByCampaign(
        'post_campaign',
        campaign.id
      );

      if (resultsError) {
        logger.error('poll-connection-requests/phase0: failed to fetch unprocessed results', {
          campaignId: campaign.id,
          error: resultsError.message,
        });
        continue;
      }

      if (!results || results.length === 0) continue;

      // Filter to accept_invitation actions only — other action types are handled by
      // process-post-campaigns Phase 0
      const acceptActions = (results as QueuedAction[]).filter(
        (a) => a.action_type === 'accept_invitation'
      );

      for (const action of acceptActions) {
        try {
          if (action.status === 'completed') {
            // Update post_campaign_lead status
            await updateCampaignLead(action.source_lead_id, {
              status: 'connection_accepted',
              connection_accepted_at: new Date().toISOString(),
            });

            logger.info('poll-connection-requests/phase0: accept completed', {
              leadId: action.source_lead_id,
              campaignId: action.source_campaign_id,
            });

            // Check if this sender also matches an outreach campaign lead
            await matchOutreachLeadOnAccept(supabase, action);
          } else if (action.status === 'failed') {
            // Log failure but don't change lead status — can be retried
            logger.warn('poll-connection-requests/phase0: accept action failed', {
              leadId: action.source_lead_id,
              campaignId: action.source_campaign_id,
              error: action.error,
            });
          }

          await markProcessed(action.id);
          totalProcessed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          logger.warn('poll-connection-requests/phase0: failed to process action result', {
            actionId: action.id,
            error: msg,
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logError('poll-connection-requests/phase0', err instanceof Error ? err : new Error(msg), {
        campaignId: campaign.id,
      });
    }
  }

  return totalProcessed;
}

/**
 * When a connection is accepted, check if the sender matches an outreach campaign lead
 * that sent a connect request but hasn't been marked connected yet.
 * The outreach_campaign_leads table doesn't exist yet (Task 10 migration), so this is
 * wrapped in a try/catch to silently skip until the table is created.
 */
async function matchOutreachLeadOnAccept(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  action: QueuedAction
): Promise<void> {
  try {
    const senderProviderId = (action.result as Record<string, unknown> | null)?.provider_id as
      | string
      | undefined;

    if (!senderProviderId) return;

    const { data: outreachMatch } = await supabase
      .from('outreach_campaign_leads')
      .select('id, campaign_id, user_id')
      .eq('unipile_provider_id', senderProviderId)
      .eq('status', 'active')
      .not('connect_sent_at', 'is', null)
      .is('connected_at', null)
      .limit(1)
      .maybeSingle();

    if (outreachMatch) {
      await supabase
        .from('outreach_campaign_leads')
        .update({
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', outreachMatch.id);

      logger.info('poll-connection-requests: outreach lead connected', {
        leadId: outreachMatch.id,
        campaignId: outreachMatch.campaign_id,
      });
    }
  } catch {
    // Table doesn't exist yet — silently skip until Task 10 migration runs
  }
}

// ─── Phase 1: Discover & Enqueue Accept Actions ─────────────────────────────
// Polls Unipile for pending invitations, matches to campaign leads, and enqueues
// accept_invitation actions. The executor handles all safety checks.

async function discoverAndEnqueueAccepts(): Promise<number> {
  const client = getUnipileClient();
  const supabase = createSupabaseAdminClient();

  const { data: campaigns, error: campaignError } = await listActiveCampaigns();
  if (campaignError || !campaigns || campaigns.length === 0) {
    return 0;
  }

  const accountGroups = groupByAccount(campaigns);
  let totalEnqueued = 0;

  for (const group of accountGroups) {
    try {
      // Fetch pending invitations for this account (READ from Unipile — not an action)
      const invitationsResult = await client.listReceivedInvitations(group.accountId);
      if (invitationsResult.error || !invitationsResult.data) {
        logger.error('poll-connection-requests/discover: failed to list invitations', {
          accountId: group.accountId,
          error: invitationsResult.error,
        });
        continue;
      }

      const invitations = invitationsResult.data;
      if (invitations.length === 0) {
        logger.info('poll-connection-requests/discover: no pending invitations', {
          accountId: group.accountId,
        });
        continue;
      }

      logger.info('poll-connection-requests/discover: invitations found', {
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
          logger.error('poll-connection-requests/discover: failed to fetch matchable leads', {
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
        // No post campaign leads to match — still check outreach leads
        await matchOutreachInvitations(supabase, invitations, group);
        continue;
      }

      // Process each invitation
      for (const invitation of invitations) {
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

        if (!match) {
          // No post campaign match — check outreach leads for this sender
          await matchOutreachInvitationSender(supabase, senderProviderId);
          continue;
        }

        const matchEntry = allMatchableLeads.find((e) => e.lead.id === match.id);
        if (!matchEntry) continue;

        const { lead, campaign } = matchEntry;

        // Skip if this lead already has a pending action
        const pending = await hasPendingAction(lead.id);
        if (pending) continue;

        // Enqueue accept_invitation action — executor handles safety
        const { error: enqueueErr } = await enqueueAction({
          user_id: campaign.user_id,
          unipile_account_id: group.accountId,
          action_type: 'accept_invitation',
          payload: { invitation_id: invitation.id },
          priority: QUEUE_PRIORITY.POST_CAMPAIGN,
          source_type: 'post_campaign',
          source_campaign_id: campaign.id,
          source_lead_id: lead.id,
        });

        if (enqueueErr) {
          logger.warn('poll-connection-requests/discover: failed to enqueue accept', {
            campaignId: campaign.id,
            leadId: lead.id,
            error: enqueueErr.message,
          });
        } else {
          // Cache the provider_id if we resolved it from the invitation sender
          if (!lead.unipile_provider_id && senderProviderId) {
            await updateCampaignLead(lead.id, {
              unipile_provider_id: senderProviderId,
            });
          }

          totalEnqueued++;
          logger.info('poll-connection-requests/discover: accept enqueued', {
            campaignId: campaign.id,
            leadId: lead.id,
            invitationId: invitation.id,
          });
        }

        // Also check outreach leads for this sender (in addition to post campaign match)
        await matchOutreachInvitationSender(supabase, senderProviderId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logError('poll-connection-requests/discover', err instanceof Error ? err : new Error(msg), {
        accountId: group.accountId,
      });
    }
  }

  return totalEnqueued;
}

/**
 * Check all invitations against outreach campaign leads for an account group.
 * Called when there are no post campaign leads to match.
 */
async function matchOutreachInvitations(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  invitations: Array<{ sender?: { provider_id?: string }; provider_id?: string }>,
  _group: CampaignGroup
): Promise<void> {
  for (const invitation of invitations) {
    const senderProviderId = invitation.sender?.provider_id ?? invitation.provider_id ?? null;
    await matchOutreachInvitationSender(supabase, senderProviderId);
  }
}

/**
 * When an invitation is received, check if the sender matches an outreach campaign lead
 * that sent a connect request. If so, mark them as connected.
 * The outreach_campaign_leads table doesn't exist yet (Task 10 migration).
 */
async function matchOutreachInvitationSender(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  senderProviderId: string | null | undefined
): Promise<void> {
  if (!senderProviderId) return;

  try {
    const { data: outreachMatch } = await supabase
      .from('outreach_campaign_leads')
      .select('id, campaign_id, user_id')
      .eq('unipile_provider_id', senderProviderId)
      .eq('status', 'active')
      .not('connect_sent_at', 'is', null)
      .is('connected_at', null)
      .limit(1)
      .maybeSingle();

    if (outreachMatch) {
      await supabase
        .from('outreach_campaign_leads')
        .update({
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', outreachMatch.id);

      logger.info('poll-connection-requests: outreach lead connected via invitation', {
        leadId: outreachMatch.id,
        campaignId: outreachMatch.campaign_id,
      });
    }
  } catch {
    // Table doesn't exist yet — silently skip until Task 10 migration runs
  }
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
      return { skipped: true, phase0Processed: 0, enqueued: 0 };
    }

    // Step 1: Apply random jitter before starting (0 to POLL_JITTER_MINUTES * 60s)
    const jitterMs = Math.floor(Math.random() * LINKEDIN_SAFETY.POLL_JITTER_MINUTES * 60_000);
    logger.info('poll-connection-requests: applying jitter', { jitterMs });
    await sleep(jitterMs);

    logger.info('poll-connection-requests: starting run');

    // Phase 0: Process completed/failed accept_invitation actions from queue
    const phase0Processed = await processCompletedAccepts();
    logger.info('poll-connection-requests: phase 0 complete', { phase0Processed });

    // Phase 1: Discover pending invitations and enqueue accept actions
    const enqueued = await discoverAndEnqueueAccepts();
    logger.info('poll-connection-requests: phase 1 complete', { enqueued });

    logger.info('poll-connection-requests: run complete', { phase0Processed, enqueued });
    return { phase0Processed, enqueued };
  },
});

// ─── Exported for testing ───────────────────────────────────────────────────

export const _testExports = {
  groupByAccount,
  matchInvitationToLead,
  processCompletedAccepts,
  matchOutreachLeadOnAccept,
  discoverAndEnqueueAccepts,
  matchOutreachInvitationSender,
};
