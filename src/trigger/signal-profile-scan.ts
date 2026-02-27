import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getProfilePosts, getPostComments, getPostReactions } from '@/lib/integrations/harvest-api';
import { processEngagers } from '@/lib/services/signal-engine';
import type { HarvestPostComment, HarvestPostReaction } from '@/lib/types/signals';

// ============================================
// HELPER: should we scrape this profile now?
// ============================================

function shouldScrapeProfile(lastScrapedAt: string | null): boolean {
  if (!lastScrapedAt) return true;
  return Date.now() - new Date(lastScrapedAt).getTime() > 60 * 60 * 1000; // 60 min interval
}

// ============================================
// CRON TASK: every 10 minutes
// Replaces Phase 2 (competitor scraping) from scrape-engagement.ts
// Uses Harvest API instead of Apify
// ============================================

export const signalProfileScan = schedules.task({
  id: 'signal-profile-scan',
  cron: '*/10 * * * *',
  maxDuration: 300,
  run: async () => {
    const supabase = createSupabaseAdminClient();
    logger.info('Starting signal profile scan (Harvest API)');

    let totalLeads = 0;

    // Step 1: Fetch active profile monitors
    const { data: monitors, error: fetchError } = await supabase
      .from('signal_profile_monitors')
      .select('*')
      .eq('is_active', true)
      .limit(20);

    if (fetchError) {
      logger.error('Failed to fetch profile monitors', { error: fetchError.message });
      return { leads: 0 };
    }

    if (!monitors || monitors.length === 0) {
      logger.info('No active profile monitors found');
      return { leads: 0 };
    }

    // Step 2: Filter to profiles due for scraping (60 min interval)
    const dueMonitors = monitors.filter(m => shouldScrapeProfile(m.last_scraped_at));

    logger.info(`Profile monitors: ${dueMonitors.length} due of ${monitors.length} active`);

    if (dueMonitors.length === 0) {
      return { leads: 0 };
    }

    // Step 3: Process each due profile (max 5 per cycle)
    const batch = dueMonitors.slice(0, 5);

    for (const monitor of batch) {
      try {
        // Step 3a: Get recent posts from this profile via Harvest API
        const postsResult = await getProfilePosts({
          profile: monitor.linkedin_profile_url,
          scrapePostedLimit: 'week',
        });

        if (postsResult.error) {
          logger.warn(`Failed to get posts for profile ${monitor.id}`, {
            error: postsResult.error,
            profileUrl: monitor.linkedin_profile_url,
          });

          // Still update last_scraped_at to avoid hammering a broken profile
          await supabase
            .from('signal_profile_monitors')
            .update({
              last_scraped_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', monitor.id);

          continue;
        }

        // If no posts, update timestamp and move on
        if (!postsResult.data || postsResult.data.length === 0) {
          logger.info(`No posts found for profile ${monitor.id}`);

          await supabase
            .from('signal_profile_monitors')
            .update({
              last_scraped_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', monitor.id);

          continue;
        }

        // Step 3b: Update name/headline from posts if not set
        if (postsResult.data.length > 0) {
          const firstPost = postsResult.data[0];
          const updateFields: Record<string, string> = {};

          if (!monitor.name && firstPost.name) {
            updateFields.name = firstPost.name;
          }
          if (!monitor.headline && firstPost.publicIdentifier) {
            // publicIdentifier is not headline; use name as fallback
            // Harvest profile-posts don't carry headline — we use what's available
          }

          if (Object.keys(updateFields).length > 0) {
            await supabase
              .from('signal_profile_monitors')
              .update(updateFields)
              .eq('id', monitor.id);
          }
        }

        // Step 3c: Process each post (max 10)
        const posts = postsResult.data.slice(0, 10);

        logger.info(`Profile ${monitor.id}: processing ${posts.length} posts`);

        for (const post of posts) {
          const postUrl = post.linkedinUrl;
          if (!postUrl) continue;

          try {
            // Get comments for this post
            const commentsResult = await getPostComments(postUrl);
            const comments: HarvestPostComment[] = commentsResult.error ? [] : commentsResult.data;

            // Get reactions for this post
            const reactionsResult = await getPostReactions(postUrl);
            const reactions: HarvestPostReaction[] = reactionsResult.error ? [] : reactionsResult.data;

            // Map comments to engager format
            const commentEngagers = comments
              .filter(c => c.actor?.linkedinUrl)
              .map(c => ({
                linkedinUrl: c.actor.linkedinUrl,
                name: c.actor.name,
                headline: c.actor.position,
                commentText: c.commentary,
                engagementType: 'comment' as const,
              }));

            // Map reactions to engager format
            const reactionEngagers = reactions
              .filter(r => r.actor?.linkedinUrl)
              .map(r => ({
                linkedinUrl: r.actor.linkedinUrl,
                name: r.actor.name,
                headline: r.actor.position,
                engagementType: 'reaction' as const,
              }));

            const engagers = [...commentEngagers, ...reactionEngagers];

            if (engagers.length === 0) {
              continue;
            }

            // Process engagers through the signal engine
            const result = await processEngagers({
              userId: monitor.user_id,
              signalType: 'profile_engagement',
              sourceUrl: postUrl,
              sourceMonitorId: monitor.id,
              engagers,
            });

            totalLeads += result.processed;

            if (result.errors.length > 0) {
              logger.warn(`Engager processing errors for profile post`, {
                postUrl: postUrl.substring(0, 80),
                monitorId: monitor.id,
                errors: result.errors.slice(0, 5),
              });
            }

            logger.info(`Processed profile post`, {
              monitorId: monitor.id,
              postUrl: postUrl.substring(0, 80),
              commentEngagers: commentEngagers.length,
              reactionEngagers: reactionEngagers.length,
              leadsProcessed: result.processed,
            });
          } catch (postErr) {
            const msg = postErr instanceof Error ? postErr.message : 'Unknown error';
            logger.error(`Failed to process post for profile ${monitor.id}`, {
              postUrl: postUrl.substring(0, 80),
              error: msg,
            });
          }
        }

        // Step 3d: Update last_scraped_at and updated_at
        await supabase
          .from('signal_profile_monitors')
          .update({
            last_scraped_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', monitor.id);

        logger.info(`Profile monitor ${monitor.id} complete`, {
          postsProcessed: posts.length,
          leadsTotal: totalLeads,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Failed to scan profile ${monitor.id}`, { error: msg });
      }
    }

    logger.info('Signal profile scan complete', { leads: totalLeads });
    return { leads: totalLeads };
  },
});
