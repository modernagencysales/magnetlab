/**
 * Process Post Campaigns Task
 * Scheduled every 5 minutes. Two phases:
 *   Phase 1 — Detection: query signal_events for commenters matching campaign post_url + keywords, insert new leads.
 *   Phase 2 — DM Sending: for leads with status='connection_accepted', send DMs sequentially with randomized delays.
 * Never runs parallel LinkedIn actions. Obeys LINKEDIN_SAFETY limits at all times.
 */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { extractLinkedInUsername } from '@/lib/utils/linkedin-url';
import { logError } from '@/lib/utils/logger';
import {
  listActiveCampaigns,
  findCampaignLeadByUrl,
  insertCampaignLead,
  findLeadsByStatus,
  updateCampaignLead,
  incrementDailyLimit,
} from '@/server/repositories/post-campaigns.repo';
import {
  renderDmTemplate,
  checkDailyLimit,
  randomDelay,
  sleep,
} from '@/server/services/post-campaigns.service';
import { LINKEDIN_SAFETY } from '@/lib/types/post-campaigns';

// ─── Phase 1: Detect New Commenters ─────────────────────────────────────────

async function detectCommenters(): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const { data: campaigns, error: campaignError } = await listActiveCampaigns();
  if (campaignError) {
    logger.error('process-post-campaigns/detect: failed to fetch active campaigns', {
      error: campaignError.message,
    });
    return 0;
  }

  if (!campaigns || campaigns.length === 0) {
    logger.info('process-post-campaigns/detect: no active campaigns');
    return 0;
  }

  let totalInserted = 0;

  for (const campaign of campaigns) {
    try {
      // Fetch comment events matching this campaign's post_url
      const { data: events, error: eventsError } = await supabase
        .from('signal_events')
        .select('id, lead_id, source_url, engagement_type, comment_text, keyword_matched')
        .eq('source_url', campaign.post_url)
        .eq('engagement_type', 'comment');

      if (eventsError) {
        logger.error('process-post-campaigns/detect: failed to fetch signal_events', {
          campaignId: campaign.id,
          error: eventsError.message,
        });
        continue;
      }

      if (!events || events.length === 0) {
        continue;
      }

      // Fetch the signal_leads for these events to get linkedin_url and name
      const leadIds = [...new Set(events.map((e) => e.lead_id).filter(Boolean))];
      if (leadIds.length === 0) continue;

      const { data: signalLeads, error: leadsError } = await supabase
        .from('signal_leads')
        .select('id, linkedin_url, first_name, last_name')
        .in('id', leadIds);

      if (leadsError) {
        logger.error('process-post-campaigns/detect: failed to fetch signal_leads', {
          campaignId: campaign.id,
          error: leadsError.message,
        });
        continue;
      }

      const leadMap = new Map((signalLeads ?? []).map((l) => [l.id, l]));

      for (const event of events) {
        // Check keyword match against campaign keywords
        const commentLower = (event.comment_text ?? '').toLowerCase();
        const keywordMatch = (campaign.keywords as string[]).some((kw: string) =>
          commentLower.includes(kw.toLowerCase())
        );
        if (!keywordMatch) continue;

        const signalLead = event.lead_id ? leadMap.get(event.lead_id) : null;
        if (!signalLead?.linkedin_url) continue;

        // Skip if already in this campaign
        const { data: existing } = await findCampaignLeadByUrl(
          campaign.id,
          signalLead.linkedin_url
        );
        if (existing) continue;

        const username = extractLinkedInUsername(signalLead.linkedin_url);
        const name =
          [signalLead.first_name, signalLead.last_name].filter(Boolean).join(' ') || null;

        const { error: insertError } = await insertCampaignLead({
          user_id: campaign.user_id,
          campaign_id: campaign.id,
          signal_lead_id: signalLead.id,
          linkedin_url: signalLead.linkedin_url,
          linkedin_username: username,
          name,
          comment_text: event.comment_text ?? null,
          status: 'detected',
        });

        if (insertError) {
          logger.warn('process-post-campaigns/detect: failed to insert campaign lead', {
            campaignId: campaign.id,
            linkedinUrl: signalLead.linkedin_url,
            error: insertError.message,
          });
        } else {
          totalInserted++;
          logger.info('process-post-campaigns/detect: new lead inserted', {
            campaignId: campaign.id,
            linkedinUrl: signalLead.linkedin_url,
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logError('process-post-campaigns/detect', err instanceof Error ? err : new Error(msg), {
        campaignId: campaign.id,
      });
    }
  }

  return totalInserted;
}

// ─── Phase 2: Send DMs to Accepted Connections ───────────────────────────────

async function sendDms(): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const { data: campaigns, error: campaignError } = await listActiveCampaigns();
  if (campaignError) {
    logger.error('process-post-campaigns/send-dms: failed to fetch active campaigns', {
      error: campaignError.message,
    });
    return 0;
  }

  if (!campaigns || campaigns.length === 0) {
    return 0;
  }

  let totalSent = 0;
  let actionsThisRun = 0;

  const client = getUnipileClient();

  for (const campaign of campaigns) {
    if (actionsThisRun >= LINKEDIN_SAFETY.MAX_ACTIONS_PER_RUN) break;

    try {
      // Fetch leads ready for DM (connection_accepted)
      const remaining = LINKEDIN_SAFETY.MAX_ACTIONS_PER_RUN - actionsThisRun;
      const { data: leads, error: leadsError } = await findLeadsByStatus(
        campaign.id,
        'connection_accepted',
        remaining
      );

      if (leadsError) {
        logger.error('process-post-campaigns/send-dms: failed to fetch leads', {
          campaignId: campaign.id,
          error: leadsError.message,
        });
        continue;
      }

      if (!leads || leads.length === 0) continue;

      // Resolve funnel URL once per campaign (if funnel_page_id is set)
      let funnelUrl = '';
      if (campaign.funnel_page_id) {
        try {
          const { data: funnelPage } = await supabase
            .from('funnel_pages')
            .select('slug, users!funnel_pages_user_id_fkey(username)')
            .eq('id', campaign.funnel_page_id)
            .single();

          if (funnelPage) {
            const users = funnelPage.users as { username: string } | null;
            if (users?.username && funnelPage.slug) {
              funnelUrl = `https://magnetlab.app/p/${users.username}/${funnelPage.slug}`;
            }
          }
        } catch (funnelErr) {
          const msg = funnelErr instanceof Error ? funnelErr.message : 'Unknown error';
          logger.warn('process-post-campaigns/send-dms: failed to resolve funnel URL', {
            campaignId: campaign.id,
            funnelPageId: campaign.funnel_page_id,
            error: msg,
          });
        }
      }

      for (const lead of leads) {
        if (actionsThisRun >= LINKEDIN_SAFETY.MAX_ACTIONS_PER_RUN) break;

        // Check daily DM limit
        const canSend = await checkDailyLimit(
          campaign.user_id,
          campaign.unipile_account_id,
          'dms_sent'
        );
        if (!canSend) {
          logger.info('process-post-campaigns/send-dms: daily DM limit reached', {
            campaignId: campaign.id,
            userId: campaign.user_id,
          });
          break;
        }

        try {
          // Step 1: Resolve provider_id if not cached
          let providerId = lead.unipile_provider_id ?? null;

          if (!providerId) {
            const username = lead.linkedin_username ?? extractLinkedInUsername(lead.linkedin_url);

            if (!username) {
              logger.warn('process-post-campaigns/send-dms: cannot resolve username', {
                leadId: lead.id,
                linkedinUrl: lead.linkedin_url,
              });
              await updateCampaignLead(lead.id, {
                status: 'dm_failed',
                error: 'Cannot extract LinkedIn username from URL',
              });
              continue;
            }

            const profileResult = await client.resolveLinkedInProfile(
              campaign.unipile_account_id,
              username
            );

            if (profileResult.error || !profileResult.data) {
              logger.warn('process-post-campaigns/send-dms: profile resolution failed', {
                leadId: lead.id,
                username,
                error: profileResult.error,
              });
              await updateCampaignLead(lead.id, {
                status: 'dm_failed',
                error: `Profile resolution failed: ${profileResult.error ?? 'no data'}`,
              });
              continue;
            }

            providerId = profileResult.data.provider_id;
            // Cache the resolved provider_id
            await updateCampaignLead(lead.id, { unipile_provider_id: providerId });
          }

          // Step 2: Render DM
          const dmText = renderDmTemplate(campaign.dm_template, {
            name: lead.name ?? '',
            funnel_url: funnelUrl,
          });

          // Step 3: Send DM
          const dmResult = await client.sendDirectMessage(
            campaign.unipile_account_id,
            providerId,
            dmText
          );

          if (dmResult.error) {
            logger.warn('process-post-campaigns/send-dms: DM send failed', {
              leadId: lead.id,
              error: dmResult.error,
            });
            await updateCampaignLead(lead.id, {
              status: 'dm_failed',
              error: `DM failed: ${dmResult.error}`,
            });
          } else {
            await updateCampaignLead(lead.id, {
              status: 'dm_sent',
              dm_sent_at: new Date().toISOString(),
              error: null,
            });
            await incrementDailyLimit(campaign.unipile_account_id, 'dms_sent');
            totalSent++;
            actionsThisRun++;

            logger.info('process-post-campaigns/send-dms: DM sent', {
              campaignId: campaign.id,
              leadId: lead.id,
            });
          }

          // Step 4: Randomized delay between DMs — safety measure, always runs
          if (actionsThisRun < LINKEDIN_SAFETY.MAX_ACTIONS_PER_RUN) {
            const delay = randomDelay(
              LINKEDIN_SAFETY.MIN_DELAY_BETWEEN_DMS_MS,
              LINKEDIN_SAFETY.MAX_DELAY_BETWEEN_DMS_MS
            );
            await sleep(delay);
          }
        } catch (leadErr) {
          const msg = leadErr instanceof Error ? leadErr.message : 'Unknown error';
          logError(
            'process-post-campaigns/send-dms/lead',
            leadErr instanceof Error ? leadErr : new Error(msg),
            { leadId: lead.id, campaignId: campaign.id }
          );
          await updateCampaignLead(lead.id, {
            status: 'dm_failed',
            error: msg,
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logError('process-post-campaigns/send-dms', err instanceof Error ? err : new Error(msg), {
        campaignId: campaign.id,
      });
    }
  }

  return totalSent;
}

// ─── Scheduled Task ──────────────────────────────────────────────────────────

export const processPostCampaigns = schedules.task({
  id: 'process-post-campaigns',
  cron: '*/5 * * * *',
  maxDuration: 300,
  run: async () => {
    logger.info('process-post-campaigns: starting run');

    // Phase 1: Detect new commenters from signal_events
    const detected = await detectCommenters();
    logger.info('process-post-campaigns: detection phase complete', { detected });

    // Phase 2: Send DMs to accepted connections
    const dmsSent = await sendDms();
    logger.info('process-post-campaigns: DM phase complete', { dmsSent });

    return { detected, dmsSent };
  },
});
