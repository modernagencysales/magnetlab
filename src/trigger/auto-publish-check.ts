import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUserLinkedInPublisher } from '@/lib/integrations/linkedin-publisher';

export const autoPublishCheck = schedules.task({
  id: 'auto-publish-check',
  cron: '*/5 * * * *', // Every 5 minutes
  maxDuration: 300,
  run: async () => {
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();

    logger.info('Starting auto-publish check');

    // ==========================================
    // STEP 1: Auto-approve posts past their deadline
    // ==========================================
    const { data: approvedPosts, error: approveQueryError } = await supabase
      .from('cp_pipeline_posts')
      .select('id, user_id')
      .eq('status', 'approved')
      .not('auto_publish_after', 'is', null)
      .lte('auto_publish_after', now)
      .limit(20);

    if (approveQueryError) {
      logger.error('Failed to query auto-approve posts', { error: approveQueryError.message });
    } else if (approvedPosts && approvedPosts.length > 0) {
      logger.info(`Auto-approving ${approvedPosts.length} posts past deadline`);
      for (const post of approvedPosts) {
        const { error: updateErr } = await supabase
          .from('cp_pipeline_posts')
          .update({
            status: 'scheduled',
            scheduled_time: now,
          })
          .eq('id', post.id)
          .eq('user_id', post.user_id);

        if (updateErr) {
          logger.error(`Failed to auto-approve post ${post.id}`, { error: updateErr.message });
        }
      }
    }

    // ==========================================
    // STEP 2: Publish scheduled posts whose time has arrived
    // ==========================================
    const { data: scheduledPosts, error: scheduleError } = await supabase
      .from('cp_pipeline_posts')
      .select('id, user_id, draft_content, final_content, lead_magnet_id')
      .eq('status', 'scheduled')
      .not('scheduled_time', 'is', null)
      .lte('scheduled_time', now)
      .limit(20);

    if (scheduleError) {
      logger.error('Failed to query scheduled posts', { error: scheduleError.message });
      return { approved: approvedPosts?.length || 0, published: 0, errors: [scheduleError.message] };
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      logger.info('No scheduled posts ready for publishing');
      return { approved: approvedPosts?.length || 0, published: 0, errors: [] };
    }

    logger.info(`Found ${scheduledPosts.length} scheduled posts ready to publish`);

    let published = 0;
    const errors: string[] = [];

    for (const post of scheduledPosts) {
      try {
        // Atomic claim: only proceed if still scheduled (prevents double-publish from overlapping cron runs)
        const { data: claimed, error: claimErr } = await supabase
          .from('cp_pipeline_posts')
          .update({ status: 'approved' }) // temporarily claim via status change
          .eq('id', post.id)
          .eq('status', 'scheduled') // only if still scheduled
          .select('id')
          .single();

        if (claimErr || !claimed) {
          logger.info(`Post ${post.id} already claimed by another run, skipping`);
          continue;
        }

        const content = post.final_content || post.draft_content;
        if (!content) {
          logger.warn(`Post ${post.id} has no content, reverting to scheduled`);
          await supabase
            .from('cp_pipeline_posts')
            .update({ status: 'scheduled' })
            .eq('id', post.id);
          continue;
        }

        const publisher = await getUserLinkedInPublisher(post.user_id);
        const publishedAt = new Date().toISOString();

        if (publisher) {
          const result = await publisher.publishNow(content);

          const { error: updateError } = await supabase
            .from('cp_pipeline_posts')
            .update({
              status: 'published',
              linkedin_post_id: result.postId || null,
              publish_provider: result.provider,
              published_at: publishedAt,
              ...(result.provider === 'leadshark' ? { leadshark_post_id: result.postId || null } : {}),
            })
            .eq('id', post.id);

          if (updateError) {
            logger.error(`DB update failed after publish for post ${post.id}`, { error: updateError.message });
          }

          // Update linked lead_magnet if present
          if (post.lead_magnet_id) {
            await supabase
              .from('lead_magnets')
              .update({
                linkedin_post_id: result.postId || null,
                publish_provider: result.provider,
                status: 'published',
              })
              .eq('id', post.lead_magnet_id);
          }

          logger.info(`Post ${post.id} published via ${result.provider}`, { postId: result.postId });
        } else {
          // No publisher available — mark as published locally (no LinkedIn post created)
          const { error: localError } = await supabase
            .from('cp_pipeline_posts')
            .update({
              status: 'published',
              published_at: publishedAt,
            })
            .eq('id', post.id);

          if (localError) {
            logger.error(`DB update failed for local publish of post ${post.id}`, { error: localError.message });
          }

          logger.info(`Post ${post.id} marked as published (no publisher configured)`);
        }

        published++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Failed to publish post ${post.id}`, { error: message });
        errors.push(`Post ${post.id}: ${message}`);

        // Mark as failed
        await supabase
          .from('cp_pipeline_posts')
          .update({ status: 'failed' })
          .eq('id', post.id);
      }
    }

    logger.info(`Auto-publish complete: ${published} published, ${errors.length} errors`);

    return { approved: approvedPosts?.length || 0, published, errors };
  },
});
