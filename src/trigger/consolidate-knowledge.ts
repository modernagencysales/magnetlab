import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export const consolidateKnowledge = schedules.task({
  id: 'consolidate-knowledge',
  cron: '0 3 * * 0', // Every Sunday at 3 AM UTC
  run: async () => {
    const supabase = createSupabaseAdminClient();
    logger.info('Starting weekly knowledge consolidation');

    // Get distinct users who have knowledge entries
    const { data: userRows } = await supabase
      .from('cp_knowledge_entries')
      .select('user_id')
      .is('superseded_by', null)
      .limit(1000);

    const uniqueUsers = [...new Set((userRows || []).map(u => u.user_id))];
    logger.info(`Processing ${uniqueUsers.length} users`);

    let topicsUpdated = 0;

    for (const userId of uniqueUsers) {
      const { data: topics } = await supabase
        .from('cp_knowledge_topics')
        .select('slug')
        .eq('user_id', userId);

      for (const topic of topics || []) {
        const { error } = await supabase.rpc('cp_update_topic_stats', {
          p_user_id: userId,
          p_topic_slug: topic.slug,
        });
        if (!error) topicsUpdated++;
      }
    }

    logger.info('Weekly consolidation complete', { usersProcessed: uniqueUsers.length, topicsUpdated });
    return { usersProcessed: uniqueUsers.length, topicsUpdated };
  },
});
