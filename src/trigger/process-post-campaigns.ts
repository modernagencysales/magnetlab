/**
 * Process Post Campaigns Task
 * Scheduled every 5 minutes. Four phases:
 *   Phase 1 — Detection: query signal_events for commenters, keyword match + AI intent fallback.
 *   Phase 2 — React + Reply + Connect: like post, reply to comments, send connection requests.
 *   Phase 3 — DM Sending: for leads with status='connection_accepted', send DMs.
 * Detection runs regardless of operating hours. Action phases are gated by safety checks.
 * Never runs parallel LinkedIn actions. Obeys per-account safety limits at all times.
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
import { renderDmTemplate } from '@/server/services/post-campaigns.service';
import {
  getAccountSettings,
  isWithinOperatingHours,
  isCircuitBreakerActive,
  checkDailyLimit,
  randomDelay,
  sleep,
} from '@/server/services/account-safety.service';
import { classifyCommentIntent } from '@/lib/ai/post-campaign/intent-classifier';
import { LINKEDIN_SAFETY } from '@/lib/types/post-campaigns';

// ─── Phase 1: Detect New Commenters ─────────────────────────────────────────
// Runs regardless of operating hours — DB-only work (+ AI intent call for Tier 2).

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
        .select(
          'id, lead_id, source_url, engagement_type, comment_text, keyword_matched, comment_social_id'
        )
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

      // Fetch the signal_leads for these events to get linkedin_url, name, and provider_id
      const leadIds = [...new Set(events.map((e) => e.lead_id).filter(Boolean))];
      if (leadIds.length === 0) continue;

      const { data: signalLeads, error: leadsError } = await supabase
        .from('signal_leads')
        .select('id, linkedin_url, first_name, last_name, provider_id')
        .in('id', leadIds);

      if (leadsError) {
        logger.error('process-post-campaigns/detect: failed to fetch signal_leads', {
          campaignId: campaign.id,
          error: leadsError.message,
        });
        continue;
      }

      const leadMap = new Map((signalLeads ?? []).map((l) => [l.id, l]));

      // Build CTA text for intent classification (extract last ~200 chars of post text as CTA context)
      const ctaText = (campaign.keywords as string[]).join(', ');

      for (const event of events) {
        const signalLead = event.lead_id ? leadMap.get(event.lead_id) : null;
        if (!signalLead?.linkedin_url) continue;

        // Skip if already in this campaign
        const { data: existing } = await findCampaignLeadByUrl(
          campaign.id,
          signalLead.linkedin_url
        );
        if (existing) continue;

        // Tier 1: keyword substring match
        const commentLower = (event.comment_text ?? '').toLowerCase();
        const keywordMatch = (campaign.keywords as string[]).some((kw: string) =>
          commentLower.includes(kw.toLowerCase())
        );

        let matchType: 'keyword' | 'intent' | null = null;

        if (keywordMatch) {
          matchType = 'keyword';
        } else if (event.comment_text) {
          // Tier 2: AI intent classification (only when keyword match fails)
          try {
            const intentResult = await classifyCommentIntent(ctaText, event.comment_text);
            if (intentResult.isInterested) {
              matchType = 'intent';
              logger.info('process-post-campaigns/detect: intent match found', {
                campaignId: campaign.id,
                commentText: event.comment_text.slice(0, 100),
              });
            }
          } catch (intentErr) {
            // Intent classification failure is non-blocking — skip this comment
            const msg = intentErr instanceof Error ? intentErr.message : 'Unknown error';
            logger.warn('process-post-campaigns/detect: intent classification failed', {
              campaignId: campaign.id,
              error: msg,
            });
          }
        }

        // No match at either tier — skip
        if (!matchType) continue;

        const username = extractLinkedInUsername(signalLead.linkedin_url);
        const name =
          [signalLead.first_name, signalLead.last_name].filter(Boolean).join(' ') || null;

        const { error: insertError } = await insertCampaignLead({
          user_id: campaign.user_id,
          campaign_id: campaign.id,
          signal_lead_id: signalLead.id,
          linkedin_url: signalLead.linkedin_url,
          linkedin_username: username,
          unipile_provider_id: signalLead.provider_id ?? null,
          name,
          comment_text: event.comment_text ?? null,
          comment_social_id: event.comment_social_id ?? null,
          match_type: matchType,
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
            matchType,
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

// ─── Phase 2: React + Reply + Connect ───────────────────────────────────────
// Gated by operating hours and circuit breaker. Uses safety service for all limit checks.

async function reactReplyConnect(): Promise<{
  replied: number;
  connectsSent: number;
  liked: boolean;
}> {
  const { data: campaigns, error: campaignError } = await listActiveCampaigns();
  if (campaignError || !campaigns || campaigns.length === 0) {
    return { replied: 0, connectsSent: 0, liked: false };
  }

  const client = getUnipileClient();
  let totalReplied = 0;
  let totalConnects = 0;
  let anyLiked = false;
  let actionsThisRun = 0;

  for (const campaign of campaigns) {
    if (actionsThisRun >= LINKEDIN_SAFETY.MAX_ACTIONS_PER_RUN) break;

    try {
      // Determine poster and delivery account IDs
      const posterAccountId = campaign.poster_account_id ?? campaign.unipile_account_id;
      const deliveryAccountId = campaign.unipile_account_id;

      // Get safety settings for both accounts
      const posterSettings = await getAccountSettings(campaign.user_id, posterAccountId);
      const deliverySettings = await getAccountSettings(campaign.user_id, deliveryAccountId);

      // Operating hours gate — skip action phases if outside hours
      if (!isWithinOperatingHours(posterSettings) || !isWithinOperatingHours(deliverySettings)) {
        logger.info('process-post-campaigns/react-reply: outside operating hours', {
          campaignId: campaign.id,
        });
        continue;
      }

      // Circuit breaker gate
      if (isCircuitBreakerActive(posterSettings) || isCircuitBreakerActive(deliverySettings)) {
        logger.info('process-post-campaigns/react-reply: circuit breaker active', {
          campaignId: campaign.id,
        });
        continue;
      }

      // ── Step 2a: One-time post reaction (LIKE) from poster's account ──
      if (campaign.auto_like_comments) {
        const { data: anyLikedLead } = await findLeadsByStatus(campaign.id, 'detected', 1);
        const hasAnyLikedLeads = await hasPostBeenLiked(campaign.id);

        if (anyLikedLead && anyLikedLead.length > 0 && !hasAnyLikedLeads) {
          const { allowed: canLike } = await checkDailyLimit(
            posterAccountId,
            'like',
            posterSettings
          );
          if (canLike) {
            try {
              await client.addReaction(campaign.post_url, posterAccountId, 'LIKE');
              await incrementDailyLimit(posterAccountId, 'likes_sent');
              anyLiked = true;
              actionsThisRun++;
              logger.info('process-post-campaigns/react: liked post', {
                campaignId: campaign.id,
              });

              // Mark first lead as liked to track that we've reacted to this post
              if (anyLikedLead[0]) {
                await updateCampaignLead(anyLikedLead[0].id, {
                  liked_at: new Date().toISOString(),
                });
              }

              await sleep(randomDelay(deliverySettings));
            } catch (likeErr) {
              const msg = likeErr instanceof Error ? likeErr.message : 'Unknown error';
              logger.warn('process-post-campaigns/react: like failed', {
                campaignId: campaign.id,
                error: msg,
              });
            }
          }
        }
      }

      // ── Step 2b: Reply to comments from delivery account ──
      if (campaign.reply_template) {
        const remaining = LINKEDIN_SAFETY.MAX_ACTIONS_PER_RUN - actionsThisRun;
        if (remaining <= 0) break;

        const { data: unrepliedLeads } = await findLeadsByStatus(
          campaign.id,
          'detected',
          remaining
        );

        if (unrepliedLeads && unrepliedLeads.length > 0) {
          // Filter to leads that haven't been replied to yet
          const needsReply = unrepliedLeads.filter((l) => !l.replied_at);

          for (const lead of needsReply) {
            if (actionsThisRun >= LINKEDIN_SAFETY.MAX_ACTIONS_PER_RUN) break;

            const { allowed: canComment } = await checkDailyLimit(
              deliveryAccountId,
              'comment',
              deliverySettings
            );
            if (!canComment) {
              logger.info('process-post-campaigns/reply: daily comment limit reached', {
                campaignId: campaign.id,
              });
              break;
            }

            try {
              // Render reply template with {{name}}
              const firstName = lead.name?.split(' ')[0] ?? '';
              const replyText = campaign.reply_template
                .replace(/\{\{name\}\}/g, firstName)
                .replace(/\{\{full_name\}\}/g, lead.name ?? '');

              // Build comment options for threading and mentions
              const commentOptions: {
                commentId?: string;
                mentions?: Array<{ name: string; profile_id: string }>;
              } = {};

              if (lead.comment_social_id) {
                commentOptions.commentId = lead.comment_social_id;
              }
              if (lead.name && lead.unipile_provider_id) {
                commentOptions.mentions = [
                  { name: lead.name, profile_id: lead.unipile_provider_id },
                ];
              }

              // Prepend mention marker if we have mention data
              const textWithMention =
                commentOptions.mentions && commentOptions.mentions.length > 0
                  ? `{{0}} ${replyText}`
                  : replyText;

              await client.addComment(
                campaign.post_url,
                deliveryAccountId,
                textWithMention,
                Object.keys(commentOptions).length > 0 ? commentOptions : undefined
              );

              await updateCampaignLead(lead.id, {
                replied_at: new Date().toISOString(),
              });
              await incrementDailyLimit(deliveryAccountId, 'comments_sent');
              totalReplied++;
              actionsThisRun++;

              logger.info('process-post-campaigns/reply: replied to comment', {
                campaignId: campaign.id,
                leadId: lead.id,
              });

              // ── Step 2c: Send connection request (location-gated) ──
              if (
                campaign.auto_connect_non_requesters &&
                actionsThisRun < LINKEDIN_SAFETY.MAX_ACTIONS_PER_RUN
              ) {
                const shouldConnect = matchesTargetLocations(
                  lead.location,
                  campaign.target_locations ?? []
                );

                if (shouldConnect) {
                  const { allowed: canConnect } = await checkDailyLimit(
                    deliveryAccountId,
                    'connection_request',
                    deliverySettings
                  );

                  if (canConnect) {
                    try {
                      // Resolve provider_id if not cached
                      let providerId = lead.unipile_provider_id;
                      if (!providerId) {
                        const username =
                          lead.linkedin_username ?? extractLinkedInUsername(lead.linkedin_url);
                        if (username) {
                          const profileResult = await client.resolveLinkedInProfile(
                            deliveryAccountId,
                            username
                          );
                          if (profileResult.data) {
                            providerId = profileResult.data.provider_id;
                            await updateCampaignLead(lead.id, {
                              unipile_provider_id: providerId,
                            });
                          }
                        }
                      }

                      if (providerId) {
                        await client.sendConnectionRequest(
                          deliveryAccountId,
                          providerId,
                          campaign.connect_message_template ?? undefined
                        );

                        await updateCampaignLead(lead.id, {
                          status: 'connection_pending',
                          connection_requested_at: new Date().toISOString(),
                        });
                        await incrementDailyLimit(deliveryAccountId, 'connection_requests_sent');
                        totalConnects++;
                        actionsThisRun++;

                        logger.info('process-post-campaigns/connect: connection request sent', {
                          campaignId: campaign.id,
                          leadId: lead.id,
                        });
                      }
                    } catch (connectErr) {
                      const msg =
                        connectErr instanceof Error ? connectErr.message : 'Unknown error';
                      logger.warn('process-post-campaigns/connect: connection request failed', {
                        campaignId: campaign.id,
                        leadId: lead.id,
                        error: msg,
                      });
                    }

                    await sleep(randomDelay(deliverySettings));
                  }
                }
              }

              // Delay between replies
              if (actionsThisRun < LINKEDIN_SAFETY.MAX_ACTIONS_PER_RUN) {
                await sleep(randomDelay(deliverySettings));
              }
            } catch (replyErr) {
              const msg = replyErr instanceof Error ? replyErr.message : 'Unknown error';
              logger.warn('process-post-campaigns/reply: reply failed', {
                campaignId: campaign.id,
                leadId: lead.id,
                error: msg,
              });
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logError('process-post-campaigns/react-reply', err instanceof Error ? err : new Error(msg), {
        campaignId: campaign.id,
      });
    }
  }

  return { replied: totalReplied, connectsSent: totalConnects, liked: anyLiked };
}

// ─── Phase 3: Send DMs to Accepted Connections ──────────────────────────────
// Uses safety service for all limit checks and delays.

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
      const deliveryAccountId = campaign.unipile_account_id;
      const deliverySettings = await getAccountSettings(campaign.user_id, deliveryAccountId);

      // Operating hours + circuit breaker gate
      if (!isWithinOperatingHours(deliverySettings)) {
        continue;
      }
      if (isCircuitBreakerActive(deliverySettings)) {
        continue;
      }

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

        // Check daily DM limit using safety service
        const { allowed: canSend } = await checkDailyLimit(
          deliveryAccountId,
          'dm',
          deliverySettings
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

            const profileResult = await client.resolveLinkedInProfile(deliveryAccountId, username);

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
          const dmResult = await client.sendDirectMessage(deliveryAccountId, providerId, dmText);

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
            await incrementDailyLimit(deliveryAccountId, 'dms_sent');
            totalSent++;
            actionsThisRun++;

            logger.info('process-post-campaigns/send-dms: DM sent', {
              campaignId: campaign.id,
              leadId: lead.id,
            });
          }

          // Step 4: Randomized delay between DMs using safety service settings
          if (actionsThisRun < LINKEDIN_SAFETY.MAX_ACTIONS_PER_RUN) {
            await sleep(randomDelay(deliverySettings));
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

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check if we've already liked the post for this campaign.
 * Uses liked_at on any lead as a campaign-level flag.
 */
async function hasPostBeenLiked(campaignId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from('post_campaign_leads')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .not('liked_at', 'is', null);
  return (count ?? 0) > 0;
}

/**
 * Check if a lead's location matches any of the campaign's target locations.
 * Case-insensitive substring match. Empty target_locations means accept all.
 */
function matchesTargetLocations(leadLocation: string | null, targetLocations: string[]): boolean {
  // No target locations configured = accept all
  if (!targetLocations || targetLocations.length === 0) return true;
  // Lead has no location data = skip connection
  if (!leadLocation) return false;

  const locationLower = leadLocation.toLowerCase();
  return targetLocations.some((target) => locationLower.includes(target.toLowerCase()));
}

// ─── Scheduled Task ──────────────────────────────────────────────────────────

export const processPostCampaigns = schedules.task({
  id: 'process-post-campaigns',
  cron: '*/5 * * * *',
  maxDuration: 300,
  queue: { concurrencyLimit: 1 },
  run: async () => {
    logger.info('process-post-campaigns: starting run');

    // Phase 1: Detect new commenters from signal_events (DB-only, no operating hours gate)
    const detected = await detectCommenters();
    logger.info('process-post-campaigns: detection phase complete', { detected });

    // Phase 2: React + Reply + Connect (operating hours + circuit breaker gated)
    const { replied, connectsSent, liked } = await reactReplyConnect();
    logger.info('process-post-campaigns: react/reply/connect phase complete', {
      replied,
      connectsSent,
      liked,
    });

    // Phase 3: Send DMs to accepted connections (operating hours + circuit breaker gated)
    const dmsSent = await sendDms();
    logger.info('process-post-campaigns: DM phase complete', { dmsSent });

    return { detected, replied, connectsSent, liked, dmsSent };
  },
});

// ─── Exported for testing ───────────────────────────────────────────────────

export const _testExports = {
  detectCommenters,
  reactReplyConnect,
  sendDms,
  hasPostBeenLiked,
  matchesTargetLocations,
};
