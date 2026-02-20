import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export const consolidateKnowledge = schedules.task({
  id: 'consolidate-knowledge',
  cron: '0 3 * * 0', // Every Sunday at 3 AM UTC
  maxDuration: 1800, // 30 min
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
    let entriesSuperseded = 0;
    let corroborationsCreated = 0;

    for (const userId of uniqueUsers) {
      // Phase 1: Find and resolve near-duplicates
      // Get entries older than 24h that haven't been superseded
      const cutoff = new Date(Date.now() - 86400000).toISOString();
      const { data: entries } = await supabase
        .from('cp_knowledge_entries')
        .select('id, speaker, content, category, knowledge_type, quality_score, embedding')
        .eq('user_id', userId)
        .is('superseded_by', null)
        .not('embedding', 'is', null)
        .lt('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(200);

      if (entries && entries.length > 1) {
        const processed = new Set<string>();

        for (const entry of entries) {
          if (processed.has(entry.id)) continue;

          // Find similar entries using the existing RPC
          const { data: matches } = await supabase.rpc('cp_match_knowledge_entries', {
            query_embedding: typeof entry.embedding === 'string'
              ? entry.embedding
              : JSON.stringify(entry.embedding),
            p_user_id: userId,
            threshold: 0.92,
            match_count: 5,
          });

          if (!matches || matches.length <= 1) continue;

          // Filter out the entry itself and already-processed entries
          const duplicates = matches.filter(
            (m: { id: string; similarity: number }) =>
              m.id !== entry.id && !processed.has(m.id) && m.similarity >= 0.92
          );

          for (const dup of duplicates) {
            const entryQuality = entry.quality_score || 3;
            const dupQuality = dup.quality_score || 3;

            // Keep the higher-quality entry
            const keepId = entryQuality >= dupQuality ? entry.id : dup.id;
            const removeId = entryQuality >= dupQuality ? dup.id : entry.id;

            if (entry.speaker === dup.speaker) {
              // Same speaker = true duplicate → supersede
              await supabase
                .from('cp_knowledge_entries')
                .update({ superseded_by: keepId })
                .eq('id', removeId)
                .eq('user_id', userId);

              entriesSuperseded++;
              processed.add(removeId);
            } else {
              // Different speaker = corroboration → link
              await supabase
                .from('cp_knowledge_corroborations')
                .upsert(
                  { entry_id: keepId, corroborated_by: removeId },
                  { onConflict: 'entry_id,corroborated_by' }
                );

              corroborationsCreated++;
            }

            processed.add(dup.id);
          }

          processed.add(entry.id);
        }
      }

      // Phase 2: Update topic stats
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

    logger.info('Weekly consolidation complete', {
      usersProcessed: uniqueUsers.length,
      topicsUpdated,
      entriesSuperseded,
      corroborationsCreated,
    });

    return { usersProcessed: uniqueUsers.length, topicsUpdated, entriesSuperseded, corroborationsCreated };
  },
});
