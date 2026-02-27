import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { searchPosts, getPostComments, getPostReactions } from '@/lib/integrations/harvest-api';
import { processEngagers } from '@/lib/services/signal-engine';
import type { HarvestPostComment, HarvestPostReaction } from '@/lib/types/signals';

// ============================================
// CRON TASK: every 12 hours
// ============================================

export const signalKeywordScan = schedules.task({
  id: 'signal-keyword-scan',
  cron: '0 */12 * * *',
  maxDuration: 600,
  run: async () => {
    const supabase = createSupabaseAdminClient();
    logger.info('Starting signal keyword scan');

    let totalPosts = 0;
    let totalLeads = 0;

    // Step 1: Fetch all active keyword monitors
    const { data: monitors, error: fetchError } = await supabase
      .from('signal_keyword_monitors')
      .select('*')
      .eq('is_active', true);

    if (fetchError) {
      logger.error('Failed to fetch keyword monitors', { error: fetchError.message });
      return { posts: 0, leads: 0 };
    }

    if (!monitors || monitors.length === 0) {
      logger.info('No active keyword monitors found');
      return { posts: 0, leads: 0 };
    }

    logger.info(`Found ${monitors.length} active keyword monitors`);

    // Step 2: Group monitors by user_id
    const monitorsByUser = new Map<string, typeof monitors>();
    for (const monitor of monitors) {
      const existing = monitorsByUser.get(monitor.user_id) || [];
      existing.push(monitor);
      monitorsByUser.set(monitor.user_id, existing);
    }

    // Step 3: Process each user's monitors
    for (const [userId, userMonitors] of monitorsByUser) {
      logger.info(`Processing ${userMonitors.length} monitors for user ${userId}`);

      for (const monitor of userMonitors) {
        let monitorPostsFound = 0;
        let monitorLeadsFound = 0;

        try {
          // Step 4a: Search for posts matching the keyword
          const searchResult = await searchPosts({
            search: monitor.keyword,
            postedLimit: '24h',
            sortBy: 'date',
          });

          if (searchResult.error || !searchResult.data || searchResult.data.length === 0) {
            if (searchResult.error) {
              logger.warn(`Search failed for keyword "${monitor.keyword}"`, {
                error: searchResult.error,
              });
            } else {
              logger.info(`No posts found for keyword "${monitor.keyword}"`);
            }

            // Update last_scanned_at even if no results
            await supabase
              .from('signal_keyword_monitors')
              .update({ last_scanned_at: new Date().toISOString() })
              .eq('id', monitor.id);

            continue;
          }

          // Step 4c: Process each post (max 10 per keyword)
          const posts = searchResult.data.slice(0, 10);
          logger.info(`Found ${searchResult.data.length} posts for keyword "${monitor.keyword}", processing ${posts.length}`);

          for (const post of posts) {
            const postUrl = post.linkedinUrl;
            if (!postUrl) continue;

            try {
              // Get commenters
              const commentsResult = await getPostComments(postUrl);
              const comments: HarvestPostComment[] = commentsResult.error ? [] : commentsResult.data;

              // Get reactors
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
                monitorPostsFound++;
                continue;
              }

              // Process engagers through the signal engine
              const result = await processEngagers({
                userId,
                signalType: 'keyword_engagement',
                sourceUrl: postUrl,
                sourceMonitorId: monitor.id,
                keywordMatched: monitor.keyword,
                engagers,
              });

              monitorPostsFound++;
              monitorLeadsFound += result.processed;

              if (result.errors.length > 0) {
                logger.warn(`Engager processing errors for post`, {
                  postUrl: postUrl.substring(0, 80),
                  keyword: monitor.keyword,
                  errors: result.errors.slice(0, 5),
                });
              }

              logger.info(`Processed post for keyword "${monitor.keyword}"`, {
                postUrl: postUrl.substring(0, 80),
                commentEngagers: commentEngagers.length,
                reactionEngagers: reactionEngagers.length,
                leadsProcessed: result.processed,
              });
            } catch (postErr) {
              const msg = postErr instanceof Error ? postErr.message : 'Unknown error';
              logger.error(`Failed to process post for keyword "${monitor.keyword}"`, {
                postUrl: postUrl.substring(0, 80),
                error: msg,
              });
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          logger.error(`Failed to process monitor "${monitor.keyword}"`, { error: msg });
        }

        // Step 4d: Update monitor stats
        totalPosts += monitorPostsFound;
        totalLeads += monitorLeadsFound;

        await supabase
          .from('signal_keyword_monitors')
          .update({
            last_scanned_at: new Date().toISOString(),
            posts_found: (monitor.posts_found || 0) + monitorPostsFound,
            leads_found: (monitor.leads_found || 0) + monitorLeadsFound,
          })
          .eq('id', monitor.id);

        logger.info(`Monitor "${monitor.keyword}" complete`, {
          postsFound: monitorPostsFound,
          leadsFound: monitorLeadsFound,
        });
      }
    }

    logger.info('Signal keyword scan complete', { posts: totalPosts, leads: totalLeads });
    return { posts: totalPosts, leads: totalLeads };
  },
});
