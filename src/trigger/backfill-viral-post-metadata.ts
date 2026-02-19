import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { extractTemplateFromPost } from '@/lib/ai/content-pipeline/template-extractor';
import { hasLeadMagnetCTA } from '@/lib/utils/lead-magnet-detection';

/**
 * One-time backfill task: classify existing winning viral posts with topics and is_lead_magnet.
 *
 * Trigger manually from the Trigger.dev dashboard.
 * After backfill completes and is verified, this file can be deleted.
 */

const BATCH_SIZE = 5;

export const backfillViralPostMetadata = task({
  id: 'backfill-viral-post-metadata',
  maxDuration: 1800, // 30 minutes
  retry: { maxAttempts: 1 },
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Fetch unclassified winners
    const { data: posts, error } = await supabase
      .from('cp_viral_posts')
      .select('id, content')
      .eq('is_winner', true)
      .or('topics.eq.{},topics.is.null')
      .limit(500);

    if (error) {
      logger.error('Failed to fetch posts for backfill', { error: error.message });
      throw new Error(`Fetch failed: ${error.message}`);
    }

    if (!posts || posts.length === 0) {
      logger.info('No posts to backfill');
      return { processed: 0, skipped: true };
    }

    logger.info('Starting backfill', { totalPosts: posts.length });

    let processed = 0;
    let errors = 0;
    let firstError: string | null = null;

    // Process sequentially in small batches with delays to avoid rate limits
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (post) => {
          try {
            if (!post.content || post.content.trim().length === 0) {
              logger.warn('Skipping post with empty content', { postId: post.id });
              // Still set is_lead_magnet to false for empty posts
              await supabase
                .from('cp_viral_posts')
                .update({ topics: [], is_lead_magnet: false })
                .eq('id', post.id);
              return { id: post.id, topics: [], isLeadMagnet: false };
            }

            // Extract topics via Claude
            logger.info('Calling extractTemplateFromPost', { postId: post.id, contentLen: post.content.length });
            const extracted = await extractTemplateFromPost(post.content);
            const topics = extracted.topics;

            // Detect lead magnet CTA via regex
            const isLeadMagnet = hasLeadMagnetCTA(post.content);

            // Update the post
            const { error: updateError } = await supabase
              .from('cp_viral_posts')
              .update({ topics, is_lead_magnet: isLeadMagnet })
              .eq('id', post.id);

            if (updateError) {
              throw new Error(`Update failed for ${post.id}: ${updateError.message}`);
            }

            return { id: post.id, topics, isLeadMagnet };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error ? err.stack : undefined;
            if (!firstError) firstError = `${msg}\n${stack || ''}`;
            logger.error('Failed to backfill post', { postId: post.id, error: msg, stack });
            throw err;
          }
        })
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      processed += succeeded;
      errors += failed;

      logger.info('Batch progress', {
        batch: Math.floor(i / BATCH_SIZE) + 1,
        totalBatches: Math.ceil(posts.length / BATCH_SIZE),
        succeeded,
        failed,
        totalProcessed: processed,
      });

      // Pause between batches to respect API rate limits
      if (i + BATCH_SIZE < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const summary = { totalPosts: posts.length, processed, errors, firstError };
    logger.info('Backfill complete', summary);
    return summary;
  },
});
