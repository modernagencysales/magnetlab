import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUserLeadSharkClient } from '@/lib/integrations/leadshark';

export const autoPublishCheck = schedules.task({
  id: 'auto-publish-check',
  cron: '0 * * * *', // Every hour
  maxDuration: 300,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    logger.info('Starting auto-publish check');

    // Find posts that are past their auto-publish deadline
    const { data: posts, error } = await supabase
      .from('cp_pipeline_posts')
      .select('id, user_id, draft_content, final_content, scheduled_time, auto_publish_after')
      .eq('status', 'approved')
      .not('auto_publish_after', 'is', null)
      .lte('auto_publish_after', new Date().toISOString())
      .limit(20);

    if (error) {
      logger.error('Failed to query auto-publish posts', { error: error.message });
      return { processed: 0, errors: [error.message] };
    }

    if (!posts || posts.length === 0) {
      logger.info('No posts ready for auto-publish');
      return { processed: 0, errors: [] };
    }

    logger.info(`Found ${posts.length} posts ready for auto-publish`);

    let published = 0;
    const errors: string[] = [];

    for (const post of posts) {
      try {
        const content = post.final_content || post.draft_content;
        if (!content) {
          logger.warn(`Post ${post.id} has no content, skipping`);
          continue;
        }

        const scheduledTime = post.scheduled_time || new Date().toISOString();

        // Try LeadShark scheduling
        let leadshark = null;
        try {
          leadshark = await getUserLeadSharkClient(post.user_id);
        } catch (lsErr) {
          logger.warn(`Failed to get LeadShark client for user ${post.user_id}`, {
            error: lsErr instanceof Error ? lsErr.message : String(lsErr),
          });
        }

        if (leadshark) {
          const result = await leadshark.createScheduledPost({
            content,
            scheduled_time: scheduledTime,
          });

          if (result.error) {
            throw new Error(`LeadShark error: ${result.error}`);
          }

          await supabase
            .from('cp_pipeline_posts')
            .update({
              status: 'scheduled',
              leadshark_post_id: result.data?.id || null,
            })
            .eq('id', post.id);

          logger.info(`Post ${post.id} scheduled via LeadShark`, { leadsharkId: result.data?.id });
        } else {
          // No LeadShark — mark as scheduled locally
          await supabase
            .from('cp_pipeline_posts')
            .update({ status: 'scheduled' })
            .eq('id', post.id);

          logger.info(`Post ${post.id} marked as scheduled (no LeadShark)`);
        }

        published++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Failed to auto-publish post ${post.id}`, { error: message });
        errors.push(`Post ${post.id}: ${message}`);

        // Mark as failed
        await supabase
          .from('cp_pipeline_posts')
          .update({ status: 'failed' })
          .eq('id', post.id);
      }
    }

    logger.info(`Auto-publish complete: ${published} published, ${errors.length} errors`);

    return { processed: published, errors };
  },
});
