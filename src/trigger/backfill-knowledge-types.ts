import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';
import { CLAUDE_HAIKU_MODEL } from '@/lib/ai/content-pipeline/model-config';
import { normalizeTopics, upsertTopics } from '@/lib/ai/content-pipeline/topic-normalizer';

export const backfillKnowledgeTypes = task({
  id: 'backfill-knowledge-types',
  maxDuration: 1800, // 30 min
  retry: { maxAttempts: 1 },
  run: async (payload: { userId: string; batchSize?: number }) => {
    const { userId, batchSize = 20 } = payload;
    const supabase = createSupabaseAdminClient();

    // Get entries without knowledge_type
    const { data: entries, error } = await supabase
      .from('cp_knowledge_entries')
      .select('id, category, speaker, content, context, tags')
      .eq('user_id', userId)
      .is('knowledge_type', null)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error || !entries?.length) {
      logger.info('No entries to backfill', { error: error?.message });
      return { processed: 0, remaining: 0 };
    }

    logger.info(`Backfilling ${entries.length} entries for user ${userId}`);

    const BATCH = 10;
    let processed = 0;

    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const client = getAnthropicClient('backfill-knowledge-types');

      const response = await client.messages.create({
        model: CLAUDE_HAIKU_MODEL,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Classify these knowledge entries. For each, return knowledge_type, quality_score, specificity, actionability, and suggested_topics.

${batch.map((e, idx) => `[${idx}] (${e.category}) ${e.content.slice(0, 300)}`).join('\n\n')}

knowledge_type options: how_to, insight, story, question, objection, mistake, decision, market_intel
quality_score: 1-5 (5 = specific+actionable+concrete+novel, 1 = filler/vague)
specificity: true if has numbers/names/timeframes/examples, false otherwise
actionability: immediately_actionable, contextual, or theoretical
suggested_topics: 1-3 broad topic labels

Return JSON array:
[{"index": 0, "knowledge_type": "insight", "quality_score": 4, "specificity": true, "actionability": "contextual", "suggested_topics": ["Cold Email"]}]`,
        }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

      try {
        const classifications = parseJsonResponse<Array<{
          index: number;
          knowledge_type: string;
          quality_score: number;
          specificity: boolean;
          actionability: string;
          suggested_topics: string[];
        }>>(text);

        const VALID_TYPES = ['how_to', 'insight', 'story', 'question', 'objection', 'mistake', 'decision', 'market_intel'];
        const VALID_ACTIONABILITY = ['immediately_actionable', 'contextual', 'theoretical'];

        for (const cls of classifications) {
          const entry = batch[cls.index];
          if (!entry) continue;

          // Validate AI output against DB constraints
          if (!VALID_TYPES.includes(cls.knowledge_type)) {
            logger.warn('Invalid knowledge_type from AI, skipping', { index: cls.index, type: cls.knowledge_type });
            continue;
          }
          const qualityScore = Math.min(5, Math.max(1, Math.round(cls.quality_score || 3)));
          const actionability = VALID_ACTIONABILITY.includes(cls.actionability) ? cls.actionability : 'contextual';

          // Normalize and upsert topics
          const normalized = await normalizeTopics(userId, cls.suggested_topics || [], entry.content);
          const slugs = await upsertTopics(userId, normalized);

          const { error: updateError } = await supabase
            .from('cp_knowledge_entries')
            .update({
              knowledge_type: cls.knowledge_type,
              quality_score: qualityScore,
              specificity: cls.specificity ?? false,
              actionability,
              topics: slugs,
            })
            .eq('id', entry.id);

          if (updateError) {
            logger.warn('Failed to update entry', { entryId: entry.id, error: updateError.message });
          } else {
            processed++;
          }
        }
      } catch {
        logger.error('Failed to parse backfill response', { batchStart: i });
      }

      // Rate limiting between batches
      if (i + BATCH < entries.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Check remaining
    const { count: remaining } = await supabase
      .from('cp_knowledge_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('knowledge_type', null);

    logger.info('Backfill batch complete', { processed, remaining: remaining || 0 });
    return { processed, remaining: remaining || 0 };
  },
});
