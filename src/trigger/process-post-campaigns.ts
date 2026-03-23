/**
 * Process Post Campaigns Task
 * Scheduled every 5 minutes. Four phases:
 *   Phase 0 — Process Results: consume completed/failed queue actions, update campaign leads.
 *   Phase 1 — Detection: poll Unipile API for comments (primary), signal_events fallback.
 *   Phase 2 — Enqueue React + Reply + Connect: enqueue actions instead of calling Unipile directly.
 *   Phase 3 — Enqueue DMs: enqueue DM actions for leads with status='connection_accepted'.
 * Detection runs regardless of operating hours. Action phases enqueue to the shared queue;
 * the executor task handles safety checks, operating hours, delays, and rate limits.
 */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { extractLinkedInUsername, normalizePostUrl } from '@/lib/utils/linkedin-url';
import { logError } from '@/lib/utils/logger';
import {
  listActiveCampaigns,
  findCampaignLeadByUrl,
  insertCampaignLead,
  findLeadsByStatus,
  updateCampaignLead,
} from '@/server/repositories/post-campaigns.repo';
import { renderDmTemplate } from '@/server/services/post-campaigns.service';
import {
  enqueueAction,
  getUnprocessedResultsByCampaign,
  markProcessed,
  hasPendingAction,
} from '@/server/repositories/linkedin-action-queue.repo';
import { QUEUE_PRIORITY } from '@/lib/types/linkedin-action-queue';
import type { QueuedAction } from '@/lib/types/linkedin-action-queue';
import { classifyCommentIntent } from '@/lib/ai/post-campaign/intent-classifier';
import type { PostCampaign } from '@/lib/types/post-campaigns';

// ─── Phase 0: Process Completed Queue Actions ────────────────────────────────
// Consumes completed/failed actions from the queue and updates campaign lead records.

async function processCompletedActions(): Promise<number> {
  const { data: campaigns, error: campaignError } = await listActiveCampaigns();
  if (campaignError || !campaigns || campaigns.length === 0) {
    return 0;
  }

  let totalProcessed = 0;

  for (const campaign of campaigns) {
    try {
      const { data: results, error: resultsError } = await getUnprocessedResultsByCampaign(
        'post_campaign',
        campaign.id
      );

      if (resultsError) {
        logger.error('process-post-campaigns/phase0: failed to fetch unprocessed results', {
          campaignId: campaign.id,
          error: resultsError.message,
        });
        continue;
      }

      if (!results || results.length === 0) continue;

      for (const action of results as QueuedAction[]) {
        try {
          if (action.status === 'completed') {
            await processCompletedAction(action);
          } else if (action.status === 'failed') {
            await processFailedAction(action);
          }

          await markProcessed(action.id);
          totalProcessed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          logger.warn('process-post-campaigns/phase0: failed to process action result', {
            actionId: action.id,
            actionType: action.action_type,
            error: msg,
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logError('process-post-campaigns/phase0', err instanceof Error ? err : new Error(msg), {
        campaignId: campaign.id,
      });
    }
  }

  return totalProcessed;
}

/** Update campaign lead based on a successfully completed queue action. */
async function processCompletedAction(action: QueuedAction): Promise<void> {
  switch (action.action_type) {
    case 'react':
      await updateCampaignLead(action.source_lead_id, {
        liked_at: new Date().toISOString(),
      });
      logger.info('process-post-campaigns/phase0: react completed', {
        leadId: action.source_lead_id,
        campaignId: action.source_campaign_id,
      });
      break;

    case 'comment':
      await updateCampaignLead(action.source_lead_id, {
        replied_at: new Date().toISOString(),
      });
      logger.info('process-post-campaigns/phase0: comment completed', {
        leadId: action.source_lead_id,
        campaignId: action.source_campaign_id,
      });
      break;

    case 'connect':
      await updateCampaignLead(action.source_lead_id, {
        status: 'connection_pending',
        connection_requested_at: new Date().toISOString(),
      });
      logger.info('process-post-campaigns/phase0: connect completed', {
        leadId: action.source_lead_id,
        campaignId: action.source_campaign_id,
      });
      break;

    case 'message':
      await updateCampaignLead(action.source_lead_id, {
        status: 'dm_sent',
        dm_sent_at: new Date().toISOString(),
        error: null,
      });
      logger.info('process-post-campaigns/phase0: DM completed', {
        leadId: action.source_lead_id,
        campaignId: action.source_campaign_id,
      });
      break;

    case 'accept_invitation':
      await updateCampaignLead(action.source_lead_id, {
        status: 'connection_accepted',
        connection_accepted_at: new Date().toISOString(),
      });
      logger.info('process-post-campaigns/phase0: accept_invitation completed', {
        leadId: action.source_lead_id,
        campaignId: action.source_campaign_id,
      });
      break;

    default:
      logger.warn('process-post-campaigns/phase0: unhandled action type', {
        actionType: action.action_type,
        actionId: action.id,
      });
  }
}

/** Update campaign lead based on a failed queue action. */
async function processFailedAction(action: QueuedAction): Promise<void> {
  if (action.action_type === 'message') {
    await updateCampaignLead(action.source_lead_id, {
      status: 'dm_failed',
      error: action.error ?? 'Queue action failed',
    });
    logger.warn('process-post-campaigns/phase0: DM action failed', {
      leadId: action.source_lead_id,
      campaignId: action.source_campaign_id,
      error: action.error,
    });
  } else {
    // Log other failures but don't change lead status — the action can be retried
    logger.warn('process-post-campaigns/phase0: action failed', {
      actionType: action.action_type,
      leadId: action.source_lead_id,
      campaignId: action.source_campaign_id,
      error: action.error,
    });
  }
}

// ─── Phase 1: Detect New Commenters ─────────────────────────────────────────
// Runs regardless of operating hours. Polls Unipile API directly for comments;
// falls back to signal_events if the API call fails.

async function detectCommenters(): Promise<number> {
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
      const inserted = await detectCommentersForCampaign(campaign);
      totalInserted += inserted;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logError('process-post-campaigns/detect', err instanceof Error ? err : new Error(msg), {
        campaignId: campaign.id,
      });
    }
  }

  return totalInserted;
}

/**
 * Detect commenters for a single campaign.
 * Primary: poll Unipile API for comments directly.
 * Fallback: query signal_events if Unipile call fails.
 */
async function detectCommentersForCampaign(campaign: PostCampaign): Promise<number> {
  // Try Unipile API first (self-contained — no dependency on Signal Engine)
  const unipileResult = await detectFromUnipile(campaign);
  if (unipileResult !== null) return unipileResult;

  // Fallback: query signal_events (original behavior)
  logger.warn('process-post-campaigns/detect: Unipile failed, falling back to signal_events', {
    campaignId: campaign.id,
  });
  return detectFromSignalEvents(campaign);
}

/**
 * Primary detection: poll Unipile API for post comments.
 * Returns number of inserted leads, or null if the API call failed.
 */
async function detectFromUnipile(campaign: PostCampaign): Promise<number | null> {
  // Extract post URN from the campaign's post_url
  const postUrn = normalizePostUrl(campaign.post_url);
  if (!postUrn) {
    logger.warn('process-post-campaigns/detect: cannot extract post URN from URL', {
      campaignId: campaign.id,
      postUrl: campaign.post_url,
    });
    return null;
  }

  // Use poster's account to read comments (poster has visibility into their own post)
  const accountId = campaign.poster_account_id ?? campaign.unipile_account_id;

  const client = getUnipileClient();
  const { data: commentsResponse, error: apiError } = await client.getPostComments(
    postUrn,
    accountId
  );

  if (apiError || !commentsResponse) {
    logger.warn('process-post-campaigns/detect: Unipile comments API failed', {
      campaignId: campaign.id,
      postUrn,
      error: apiError,
    });
    return null;
  }

  const comments = commentsResponse.items ?? [];
  if (comments.length === 0) {
    return 0;
  }

  logger.info('process-post-campaigns/detect: fetched comments from Unipile', {
    campaignId: campaign.id,
    commentCount: comments.length,
  });

  const ctaText = (campaign.keywords as string[]).join(', ');
  let inserted = 0;

  for (const comment of comments) {
    const profileUrl = comment.author_details?.profile_url;
    if (!profileUrl) continue;

    // Skip if already in this campaign
    const { data: existing } = await findCampaignLeadByUrl(campaign.id, profileUrl);
    if (existing) continue;

    // Tier 1: keyword substring match
    const commentLower = (comment.text ?? '').toLowerCase();
    const keywordMatch = (campaign.keywords as string[]).some((kw: string) =>
      commentLower.includes(kw.toLowerCase())
    );

    let matchType: 'keyword' | 'intent' | null = null;

    if (keywordMatch) {
      matchType = 'keyword';
    } else if (comment.text) {
      // Tier 2: AI intent classification (only when keyword match fails)
      try {
        const intentResult = await classifyCommentIntent(ctaText, comment.text);
        if (intentResult.isInterested) {
          matchType = 'intent';
          logger.info('process-post-campaigns/detect: intent match found', {
            campaignId: campaign.id,
            commentText: comment.text.slice(0, 100),
          });
        }
      } catch (intentErr) {
        const msg = intentErr instanceof Error ? intentErr.message : 'Unknown error';
        logger.warn('process-post-campaigns/detect: intent classification failed', {
          campaignId: campaign.id,
          error: msg,
        });
      }
    }

    // No match at either tier — skip
    if (!matchType) continue;

    const username = extractLinkedInUsername(profileUrl);

    const { error: insertError } = await insertCampaignLead({
      user_id: campaign.user_id,
      campaign_id: campaign.id,
      signal_lead_id: null,
      linkedin_url: profileUrl,
      linkedin_username: username,
      unipile_provider_id: comment.author_details?.id ?? null,
      name: comment.author || null,
      comment_text: comment.text ?? null,
      comment_social_id: comment.id ?? null,
      match_type: matchType,
      status: 'detected',
    });

    if (insertError) {
      logger.warn('process-post-campaigns/detect: failed to insert campaign lead', {
        campaignId: campaign.id,
        linkedinUrl: profileUrl,
        error: insertError.message,
      });
    } else {
      inserted++;
      logger.info('process-post-campaigns/detect: new lead inserted (Unipile)', {
        campaignId: campaign.id,
        linkedinUrl: profileUrl,
        matchType,
      });
    }
  }

  return inserted;
}

/**
 * Fallback detection: query signal_events for comments matching the post URL.
 * This is the original behavior — requires Signal Engine to have populated the table.
 */
async function detectFromSignalEvents(campaign: PostCampaign): Promise<number> {
  const supabase = createSupabaseAdminClient();

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
    return 0;
  }

  if (!events || events.length === 0) {
    return 0;
  }

  // Fetch the signal_leads for these events to get linkedin_url, name, and provider_id
  const leadIds = [...new Set(events.map((e) => e.lead_id).filter(Boolean))];
  if (leadIds.length === 0) return 0;

  const { data: signalLeads, error: leadsError } = await supabase
    .from('signal_leads')
    .select('id, linkedin_url, first_name, last_name, provider_id')
    .in('id', leadIds);

  if (leadsError) {
    logger.error('process-post-campaigns/detect: failed to fetch signal_leads', {
      campaignId: campaign.id,
      error: leadsError.message,
    });
    return 0;
  }

  const leadMap = new Map((signalLeads ?? []).map((l) => [l.id, l]));
  const ctaText = (campaign.keywords as string[]).join(', ');
  let inserted = 0;

  for (const event of events) {
    const signalLead = event.lead_id ? leadMap.get(event.lead_id) : null;
    if (!signalLead?.linkedin_url) continue;

    // Skip if already in this campaign
    const { data: existing } = await findCampaignLeadByUrl(campaign.id, signalLead.linkedin_url);
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
    const name = [signalLead.first_name, signalLead.last_name].filter(Boolean).join(' ') || null;

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
      inserted++;
      logger.info('process-post-campaigns/detect: new lead inserted (signal_events)', {
        campaignId: campaign.id,
        linkedinUrl: signalLead.linkedin_url,
        matchType,
      });
    }
  }

  return inserted;
}

// ─── Phase 2: Enqueue React + Reply + Connect ───────────────────────────────
// Enqueues actions to the shared queue. The executor handles safety, delays, and limits.

async function reactReplyConnect(): Promise<{
  enqueued: number;
}> {
  const { data: campaigns, error: campaignError } = await listActiveCampaigns();
  if (campaignError || !campaigns || campaigns.length === 0) {
    return { enqueued: 0 };
  }

  const client = getUnipileClient();
  let totalEnqueued = 0;

  for (const campaign of campaigns) {
    try {
      // Determine poster and delivery account IDs
      const posterAccountId = campaign.poster_account_id ?? campaign.unipile_account_id;
      const deliveryAccountId = campaign.unipile_account_id;

      // ── Step 2a: One-time post reaction (LIKE) from poster's account ──
      if (campaign.auto_like_comments) {
        const { data: anyLikedLead } = await findLeadsByStatus(campaign.id, 'detected', 1);
        const hasAnyLikedLeads = await hasPostBeenLiked(campaign.id);

        if (anyLikedLead && anyLikedLead.length > 0 && !hasAnyLikedLeads) {
          const leadForLike = anyLikedLead[0];
          if (leadForLike) {
            // Check if there's already a pending react action for this lead
            const pending = await hasPendingAction(leadForLike.id);
            if (!pending) {
              const { error: enqueueErr } = await enqueueAction({
                user_id: campaign.user_id,
                unipile_account_id: posterAccountId,
                action_type: 'react',
                payload: { post_id: campaign.post_url },
                priority: QUEUE_PRIORITY.POST_CAMPAIGN,
                source_type: 'post_campaign',
                source_campaign_id: campaign.id,
                source_lead_id: leadForLike.id,
              });

              if (enqueueErr) {
                logger.warn('process-post-campaigns/react: failed to enqueue like', {
                  campaignId: campaign.id,
                  error: enqueueErr.message,
                });
              } else {
                totalEnqueued++;
                logger.info('process-post-campaigns/react: enqueued post like', {
                  campaignId: campaign.id,
                });
              }
            }
          }
        }
      }

      // ── Step 2b: Reply to comments from delivery account ──
      if (campaign.reply_template) {
        const { data: unrepliedLeads } = await findLeadsByStatus(campaign.id, 'detected', 20);

        if (unrepliedLeads && unrepliedLeads.length > 0) {
          // Filter to leads that haven't been replied to yet
          const needsReply = unrepliedLeads.filter((l) => !l.replied_at);

          for (const lead of needsReply) {
            // Skip if this lead already has a pending action
            const pending = await hasPendingAction(lead.id);
            if (pending) continue;

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
              commentOptions.mentions = [{ name: lead.name, profile_id: lead.unipile_provider_id }];
            }

            // Prepend mention marker if we have mention data
            const textWithMention =
              commentOptions.mentions && commentOptions.mentions.length > 0
                ? `{{0}} ${replyText}`
                : replyText;

            const { error: enqueueErr } = await enqueueAction({
              user_id: campaign.user_id,
              unipile_account_id: deliveryAccountId,
              action_type: 'comment',
              payload: {
                post_id: campaign.post_url,
                text: textWithMention,
                options: Object.keys(commentOptions).length > 0 ? commentOptions : undefined,
              },
              priority: QUEUE_PRIORITY.POST_CAMPAIGN,
              source_type: 'post_campaign',
              source_campaign_id: campaign.id,
              source_lead_id: lead.id,
            });

            if (enqueueErr) {
              logger.warn('process-post-campaigns/reply: failed to enqueue comment', {
                campaignId: campaign.id,
                leadId: lead.id,
                error: enqueueErr.message,
              });
            } else {
              totalEnqueued++;
              logger.info('process-post-campaigns/reply: enqueued comment reply', {
                campaignId: campaign.id,
                leadId: lead.id,
              });
            }

            // ── Step 2c: Enqueue connection request (location-gated) ──
            if (campaign.auto_connect_non_requesters) {
              const shouldConnect = matchesTargetLocations(
                lead.location,
                campaign.target_locations ?? []
              );

              if (shouldConnect) {
                try {
                  // Resolve provider_id if not cached (direct Unipile lookup, not an "action")
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
                    const { error: connectErr } = await enqueueAction({
                      user_id: campaign.user_id,
                      unipile_account_id: deliveryAccountId,
                      action_type: 'connect',
                      target_provider_id: providerId,
                      target_linkedin_url: lead.linkedin_url,
                      payload: {
                        message: campaign.connect_message_template ?? undefined,
                      },
                      priority: QUEUE_PRIORITY.POST_CAMPAIGN,
                      source_type: 'post_campaign',
                      source_campaign_id: campaign.id,
                      source_lead_id: lead.id,
                    });

                    if (connectErr) {
                      logger.warn('process-post-campaigns/connect: failed to enqueue connect', {
                        campaignId: campaign.id,
                        leadId: lead.id,
                        error: connectErr.message,
                      });
                    } else {
                      totalEnqueued++;
                      logger.info('process-post-campaigns/connect: enqueued connection request', {
                        campaignId: campaign.id,
                        leadId: lead.id,
                      });
                    }
                  }
                } catch (connectErr) {
                  const msg = connectErr instanceof Error ? connectErr.message : 'Unknown error';
                  logger.warn('process-post-campaigns/connect: provider resolution failed', {
                    campaignId: campaign.id,
                    leadId: lead.id,
                    error: msg,
                  });
                }
              }
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

  return { enqueued: totalEnqueued };
}

// ─── Phase 3: Enqueue DMs for Accepted Connections ──────────────────────────
// Enqueues DM actions. The executor handles safety, delays, and limits.

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

  let totalEnqueued = 0;

  const client = getUnipileClient();

  for (const campaign of campaigns) {
    try {
      const deliveryAccountId = campaign.unipile_account_id;

      // Fetch leads ready for DM (connection_accepted)
      const { data: leads, error: leadsError } = await findLeadsByStatus(
        campaign.id,
        'connection_accepted',
        20
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
        // Skip if this lead already has a pending action
        const pending = await hasPendingAction(lead.id);
        if (pending) continue;

        try {
          // Step 1: Resolve provider_id if not cached (direct Unipile lookup, not an "action")
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

          // Step 3: Enqueue DM action
          const { error: enqueueErr } = await enqueueAction({
            user_id: campaign.user_id,
            unipile_account_id: deliveryAccountId,
            action_type: 'message',
            target_provider_id: providerId,
            target_linkedin_url: lead.linkedin_url,
            payload: { text: dmText },
            priority: QUEUE_PRIORITY.POST_CAMPAIGN,
            source_type: 'post_campaign',
            source_campaign_id: campaign.id,
            source_lead_id: lead.id,
          });

          if (enqueueErr) {
            logger.warn('process-post-campaigns/send-dms: failed to enqueue DM', {
              leadId: lead.id,
              campaignId: campaign.id,
              error: enqueueErr.message,
            });
          } else {
            totalEnqueued++;
            logger.info('process-post-campaigns/send-dms: DM enqueued', {
              campaignId: campaign.id,
              leadId: lead.id,
            });
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

  return totalEnqueued;
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

    // Phase 0: Process completed/failed queue actions → update campaign leads
    const actionsProcessed = await processCompletedActions();
    logger.info('process-post-campaigns: phase 0 complete', { actionsProcessed });

    // Phase 1: Detect new commenters — Unipile API primary, signal_events fallback
    const detected = await detectCommenters();
    logger.info('process-post-campaigns: detection phase complete', { detected });

    // Phase 2: Enqueue React + Reply + Connect actions
    const { enqueued: phase2Enqueued } = await reactReplyConnect();
    logger.info('process-post-campaigns: react/reply/connect enqueue phase complete', {
      enqueued: phase2Enqueued,
    });

    // Phase 3: Enqueue DMs for accepted connections
    const dmsEnqueued = await sendDms();
    logger.info('process-post-campaigns: DM enqueue phase complete', { dmsEnqueued });

    return { actionsProcessed, detected, phase2Enqueued, dmsEnqueued };
  },
});

// ─── Exported for testing ───────────────────────────────────────────────────

export const _testExports = {
  processCompletedActions,
  processCompletedAction,
  processFailedAction,
  detectCommenters,
  detectCommentersForCampaign,
  detectFromUnipile,
  detectFromSignalEvents,
  reactReplyConnect,
  sendDms,
  hasPostBeenLiked,
  matchesTargetLocations,
};
