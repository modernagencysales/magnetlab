import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { formatPostText } from '@/lib/utils/format-post-text';

/**
 * One-time backfill: reformat existing viral post content with line breaks.
 *
 * Bright Data strips newlines from post_text. This task applies formatPostText()
 * to all posts that don't already have newlines.
 *
 * Trigger manually from the Trigger.dev dashboard. Safe to re-run (idempotent).
 */
export const backfillPostFormatting = task({
  id: 'backfill-post-formatting',
  maxDuration: 300,
  retry: { maxAttempts: 1 },
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Fetch posts that have no newlines in content (i.e. need formatting)
    const { data: posts, error } = await supabase
      .from('cp_viral_posts')
      .select('id, content')
      .not('content', 'like', '%\n%')
      .not('content', 'is', null)
      .limit(5000);

    if (error) {
      logger.error('Failed to fetch posts', { error: error.message });
      throw new Error(`Fetch failed: ${error.message}`);
    }

    if (!posts || posts.length === 0) {
      logger.info('No posts need formatting');
      return { processed: 0 };
    }

    logger.info('Starting formatting backfill', { totalPosts: posts.length });

    let updated = 0;
    let skipped = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);

      // Build updates
      const updates = batch
        .map((post) => {
          const formatted = formatPostText(post.content);
          if (formatted === post.content) return null; // No change
          return { id: post.id, content: formatted };
        })
        .filter(Boolean) as { id: string; content: string }[];

      skipped += batch.length - updates.length;

      if (updates.length === 0) continue;

      // Update each post (Supabase doesn't support bulk update by different values)
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('cp_viral_posts')
          .update({ content: update.content })
          .eq('id', update.id);

        if (updateError) {
          logger.error('Update failed', { postId: update.id, error: updateError.message });
        } else {
          updated++;
        }
      }

      logger.info('Batch progress', {
        batch: Math.floor(i / BATCH_SIZE) + 1,
        totalBatches: Math.ceil(posts.length / BATCH_SIZE),
        updated,
        skipped,
      });
    }

    const summary = { totalPosts: posts.length, updated, skipped };
    logger.info('Formatting backfill complete', summary);
    return summary;
  },
});
