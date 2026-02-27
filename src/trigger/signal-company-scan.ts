import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getCompanyPosts, getPostComments, getPostReactions } from '@/lib/integrations/harvest-api';
import { processEngagers } from '@/lib/services/signal-engine';
import type { HarvestPostComment, HarvestPostReaction } from '@/lib/types/signals';

// ============================================
// CRON TASK: every 12 hours (offset 30 min from keyword scan)
// ============================================

export const signalCompanyScan = schedules.task({
  id: 'signal-company-scan',
  cron: '30 */12 * * *',
  maxDuration: 600,
  run: async () => {
    const supabase = createSupabaseAdminClient();
    logger.info('Starting signal company page scan');

    let totalLeads = 0;

    // Step 1: Fetch all active company monitors
    const { data: monitors, error: fetchError } = await supabase
      .from('signal_company_monitors')
      .select('*')
      .eq('is_active', true);

    if (fetchError) {
      logger.error('Failed to fetch company monitors', { error: fetchError.message });
      return { leads: 0 };
    }

    if (!monitors || monitors.length === 0) {
      logger.info('No active company monitors found');
      return { leads: 0 };
    }

    logger.info(`Found ${monitors.length} active company monitors`);

    // Step 2: Process each company monitor
    for (const monitor of monitors) {
      logger.info(`Scanning company: ${monitor.company_name || monitor.linkedin_company_url}`);

      let monitorLeads = 0;

      try {
        // Step 3a: Fetch recent posts from the company page
        const { data: posts, error: postsError } = await getCompanyPosts({
          company: monitor.linkedin_company_url,
          postedLimit: '24h',
        });

        if (postsError || !posts || posts.length === 0) {
          if (postsError) {
            logger.warn(`Failed to fetch posts for company`, {
              url: monitor.linkedin_company_url,
              error: postsError,
            });
          } else {
            logger.info(`No recent posts for company ${monitor.linkedin_company_url}`);
          }

          // Update last_scanned_at even if no results
          await supabase
            .from('signal_company_monitors')
            .update({ last_scanned_at: new Date().toISOString() })
            .eq('id', monitor.id);

          continue;
        }

        // Step 3c: Update company_name from first post if not set
        if (!monitor.company_name && posts[0]?.name) {
          await supabase
            .from('signal_company_monitors')
            .update({ company_name: posts[0].name })
            .eq('id', monitor.id);
        }

        // Step 3d: Process each post (max 5 per company)
        const postsToProcess = posts.slice(0, 5);
        logger.info(`Found ${posts.length} posts for company, processing ${postsToProcess.length}`, {
          company: monitor.company_name || monitor.linkedin_company_url,
        });

        for (const post of postsToProcess) {
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

            if (engagers.length === 0) continue;

            // Process engagers through the signal engine
            const result = await processEngagers({
              userId: monitor.user_id,
              signalType: 'company_engagement',
              sourceUrl: postUrl,
              sourceMonitorId: monitor.id,
              engagers,
            });

            monitorLeads += result.processed;

            if (result.errors.length > 0) {
              logger.warn(`Engager processing errors for company post`, {
                postUrl: postUrl.substring(0, 80),
                company: monitor.company_name || monitor.linkedin_company_url,
                errors: result.errors.slice(0, 5),
              });
            }

            logger.info(`Processed company post`, {
              postUrl: postUrl.substring(0, 80),
              company: monitor.company_name || monitor.linkedin_company_url,
              commentEngagers: commentEngagers.length,
              reactionEngagers: reactionEngagers.length,
              leadsProcessed: result.processed,
            });
          } catch (postErr) {
            const msg = postErr instanceof Error ? postErr.message : 'Unknown error';
            logger.error(`Failed to process company post`, {
              postUrl: postUrl.substring(0, 80),
              company: monitor.company_name || monitor.linkedin_company_url,
              error: msg,
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Failed to process company monitor`, {
          monitorId: monitor.id,
          company: monitor.company_name || monitor.linkedin_company_url,
          error: msg,
        });
      }

      // Step 3e: Update monitor timestamps
      totalLeads += monitorLeads;

      await supabase
        .from('signal_company_monitors')
        .update({
          last_scanned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', monitor.id);

      logger.info(`Company ${monitor.company_name || monitor.linkedin_company_url}: ${monitorLeads} leads`);
    }

    logger.info('Signal company scan complete', { leads: totalLeads });
    return { leads: totalLeads };
  },
});
