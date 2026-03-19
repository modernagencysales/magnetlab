/**
 * Check Outreach Replies Task
 * Scheduled every 30 minutes. For each account with messaged leads:
 *   1. Batch-fetch recent chats from Unipile (one API call per account)
 *   2. Check each messaged lead for replies
 *   3. If replied → mark lead 'replied'
 *   4. If no reply + follow_up_delay elapsed → enqueue follow-up (if template set)
 * Never processes more than needed — only checks leads that are active + messaged + not yet followed up.
 */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { logError } from '@/lib/utils/logger';
import {
  listActiveCampaigns,
  getMessagedLeadsPendingFollowUp,
  updateLead,
} from '@/server/repositories/outreach-campaigns.repo';
import { enqueueAction, hasPendingAction } from '@/server/repositories/linkedin-action-queue.repo';
import { renderTemplate } from '@/server/services/outreach-campaigns.service';
import { shouldSkipRun } from '@/server/services/account-safety.service';
import { QUEUE_PRIORITY } from '@/lib/types/linkedin-action-queue';
import type { OutreachCampaign, OutreachCampaignLead } from '@/lib/types/outreach-campaigns';

// ─── Scheduled Task ──────────────────────────────────────────────────────────

export const checkOutreachReplies = schedules.task({
  id: 'check-outreach-replies',
  cron: '*/30 * * * *',
  maxDuration: 120,
  queue: { concurrencyLimit: 1 },

  run: async () => {
    // 10% chance to skip run for natural unpredictability
    if (shouldSkipRun()) {
      logger.info('check-outreach-replies: skipping run (jitter)');
      return { skipped: true };
    }

    // Load all active campaigns
    const { data: campaigns, error: campaignError } = await listActiveCampaigns();

    if (campaignError) {
      logError(
        'check-outreach-replies/listCampaigns',
        campaignError instanceof Error ? campaignError : new Error(String(campaignError)),
        {}
      );
      return { error: 'Failed to load active campaigns' };
    }

    if (!campaigns || campaigns.length === 0) {
      logger.info('check-outreach-replies: no active campaigns');
      return { campaignsChecked: 0, repliesDetected: 0, followUpsEnqueued: 0, completions: 0 };
    }

    // Group campaigns by unipile_account_id for batch chat fetching
    const campaignsByAccount = new Map<string, OutreachCampaign[]>();
    for (const campaign of campaigns) {
      const accountId = campaign.unipile_account_id;
      const existing = campaignsByAccount.get(accountId) ?? [];
      existing.push(campaign);
      campaignsByAccount.set(accountId, existing);
    }

    const client = getUnipileClient();
    const now = Date.now();
    let repliesDetected = 0;
    let followUpsEnqueued = 0;
    let completions = 0;

    for (const [accountId, accountCampaigns] of campaignsByAccount) {
      // Batch: one Unipile chat list call per account
      const chatsResult = await client.listChats(accountId);

      if (chatsResult.error || !chatsResult.data) {
        logger.warn('check-outreach-replies: failed to fetch chats for account', {
          accountId,
          error: chatsResult.error ?? 'No data returned',
        });
        // Continue to next account — don't let one failure block others
        continue;
      }

      const chats = chatsResult.data;

      for (const campaign of accountCampaigns) {
        // Get leads that need reply checking
        const { data: leads, error: leadsError } = await getMessagedLeadsPendingFollowUp(
          campaign.id
        );

        if (leadsError) {
          logger.warn('check-outreach-replies: failed to fetch leads for campaign', {
            campaignId: campaign.id,
            error: leadsError.message,
          });
          continue;
        }

        if (!leads || leads.length === 0) continue;

        for (const lead of leads) {
          try {
            await processLead(client, lead, campaign, chats, accountId, now, {
              onReply: () => repliesDetected++,
              onFollowUp: () => followUpsEnqueued++,
              onComplete: () => completions++,
            });
          } catch (leadErr) {
            logError(
              'check-outreach-replies/lead',
              leadErr instanceof Error ? leadErr : new Error(String(leadErr)),
              { leadId: lead.id, campaignId: campaign.id }
            );
          }
        }
      }
    }

    const totalCampaigns = campaigns.length;
    logger.info('check-outreach-replies: run complete', {
      campaignsChecked: totalCampaigns,
      repliesDetected,
      followUpsEnqueued,
      completions,
    });

    return {
      campaignsChecked: totalCampaigns,
      repliesDetected,
      followUpsEnqueued,
      completions,
    };
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ProcessLeadCounters {
  onReply: () => void;
  onFollowUp: () => void;
  onComplete: () => void;
}

async function processLead(
  client: ReturnType<typeof getUnipileClient>,
  lead: OutreachCampaignLead,
  campaign: OutreachCampaign,
  chats: Awaited<ReturnType<typeof client.listChats>>['data'],
  accountId: string,
  now: number,
  counters: ProcessLeadCounters
): Promise<void> {
  // Skip if there's already a pending action for this lead
  const pending = await hasPendingAction(lead.id);
  if (pending) return;

  // Find the chat with this lead (match by attendee provider_id)
  const leadProviderId = lead.unipile_provider_id;
  const chat = chats?.find(
    (c) => leadProviderId && c.attendees?.some((a) => a.provider_id === leadProviderId)
  );

  if (chat && lead.messaged_at) {
    // Fetch messages for this chat to detect replies
    const messagesResult = await client.getChatMessages(chat.id);

    if (messagesResult.error || !messagesResult.data) {
      // Log but don't throw — skip this lead for this run
      logger.warn('check-outreach-replies: failed to fetch messages', {
        leadId: lead.id,
        chatId: chat.id,
        error: messagesResult.error ?? 'No data',
      });
      return;
    }

    const messages = messagesResult.data;
    const messagedAt = new Date(lead.messaged_at).getTime();

    // Check if the target replied after our message was sent
    // sender_id !== accountId means the OTHER party sent it
    const hasReply = messages.some((m) => {
      if (!m.sender_id || m.sender_id === accountId) return false;
      const msgTime = m.timestamp
        ? new Date(m.timestamp).getTime()
        : m.created_at
          ? new Date(m.created_at).getTime()
          : 0;
      return msgTime > messagedAt;
    });

    if (hasReply) {
      await updateLead(lead.id, { status: 'replied', updated_at: new Date().toISOString() });
      counters.onReply();
      logger.info('check-outreach-replies: reply detected', {
        leadId: lead.id,
        campaignId: campaign.id,
      });
      return;
    }
  }

  // No reply found — check if follow-up delay has elapsed
  if (!lead.messaged_at) return;

  const followUpDelayMs = campaign.follow_up_delay_days * 86_400_000;
  const messagedAt = new Date(lead.messaged_at).getTime();
  const delayElapsed = now - messagedAt >= followUpDelayMs;

  if (!delayElapsed) return;

  if (campaign.follow_up_template) {
    // Enqueue a follow-up message
    const text = renderTemplate(campaign.follow_up_template, {
      name: lead.name ?? '',
      company: lead.company ?? '',
    });

    const { error: enqueueError } = await enqueueAction({
      user_id: lead.user_id,
      unipile_account_id: accountId,
      action_type: 'follow_up_message',
      target_provider_id: lead.unipile_provider_id ?? undefined,
      target_linkedin_url: lead.linkedin_url,
      payload: { text },
      priority: QUEUE_PRIORITY.OUTREACH,
      source_type: 'outreach_campaign',
      source_campaign_id: campaign.id,
      source_lead_id: lead.id,
    });

    if (enqueueError) {
      logger.warn('check-outreach-replies: failed to enqueue follow-up', {
        leadId: lead.id,
        campaignId: campaign.id,
        error: enqueueError.message,
      });
      return;
    }

    counters.onFollowUp();
    logger.info('check-outreach-replies: follow-up enqueued', {
      leadId: lead.id,
      campaignId: campaign.id,
    });
  } else {
    // No follow-up template — mark the lead as completed
    await updateLead(lead.id, { status: 'completed', updated_at: new Date().toISOString() });
    counters.onComplete();
    logger.info('check-outreach-replies: no follow-up template — marking completed', {
      leadId: lead.id,
      campaignId: campaign.id,
    });
  }
}
