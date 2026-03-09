/** Nightly Position Synthesis. Re-synthesizes stale positions for all users. */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { synthesizeAndCachePosition } from '@/lib/services/knowledge-brain';

/** Max topics to synthesize per user per run (cost guard). */
const MAX_TOPICS_PER_USER = 10;

/** Max users to process per run (time guard). */
const MAX_USERS_PER_RUN = 50;

export const nightlyPositionSynthesis = schedules.task({
  id: 'nightly-position-synthesis',
  cron: '30 2 * * *', // 2:30 AM UTC daily (after autopilot batch at 2:00)
  maxDuration: 600, // 10 min
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Find all stale positions grouped by user
    const { data: staleRows } = await supabase
      .from('cp_positions')
      .select('user_id, topic_slug')
      .eq('is_stale', true)
      .limit(MAX_USERS_PER_RUN * MAX_TOPICS_PER_USER);

    if (!staleRows || staleRows.length === 0) {
      logger.info('No stale positions to synthesize');
      return { synthesized: 0, errors: 0 };
    }

    // Group by user
    const byUser = new Map<string, string[]>();
    for (const row of staleRows) {
      const topics = byUser.get(row.user_id) || [];
      topics.push(row.topic_slug);
      byUser.set(row.user_id, topics);
    }

    logger.info('Synthesizing positions', {
      users: byUser.size,
      totalTopics: staleRows.length,
    });

    let synthesized = 0;
    let errors = 0;

    for (const [userId, topicSlugs] of byUser) {
      const batch = topicSlugs.slice(0, MAX_TOPICS_PER_USER);

      for (const slug of batch) {
        try {
          const position = await synthesizeAndCachePosition(userId, slug);
          if (position) {
            synthesized++;
          }
        } catch (err) {
          errors++;
          logger.error('Position synthesis failed', {
            userId,
            topicSlug: slug,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    logger.info('Position synthesis complete', { synthesized, errors });
    return { synthesized, errors };
  },
});
