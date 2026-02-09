import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding } from '@/lib/ai/embeddings';
import type {
  KnowledgeEntry,
  KnowledgeEntryWithSimilarity,
  KnowledgeCategory,
} from '@/lib/types/content-pipeline';

export async function searchKnowledge(
  userId: string,
  query: string,
  options: {
    category?: KnowledgeCategory;
    tags?: string[];
    limit?: number;
    threshold?: number;
  } = {}
): Promise<KnowledgeEntryWithSimilarity[]> {
  const { category, tags, limit = 10, threshold = 0.7 } = options;

  const queryEmbedding = await generateEmbedding(query);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc('cp_match_knowledge_entries', {
    query_embedding: JSON.stringify(queryEmbedding),
    p_user_id: userId,
    threshold,
    match_count: limit,
  });

  if (error) {
    console.error('Knowledge search failed:', error.message);
    return [];
  }

  let results = (data || []) as KnowledgeEntryWithSimilarity[];

  // Filter by category if specified
  if (category) {
    results = results.filter((entry) => entry.category === category);
  }

  // Filter by tags if specified
  if (tags && tags.length > 0) {
    results = results.filter((entry) =>
      tags.some((tag) => entry.tags?.includes(tag))
    );
  }

  return results;
}

export async function getRelevantContext(
  userId: string,
  topic: string,
  maxEntries: number = 15
): Promise<KnowledgeEntryWithSimilarity[]> {
  return searchKnowledge(userId, topic, {
    limit: maxEntries,
    threshold: 0.65,
  });
}

export async function getKnowledgeByCategory(
  userId: string,
  category: KnowledgeCategory,
  limit: number = 20
): Promise<KnowledgeEntry[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('cp_knowledge_entries')
    .select('id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, created_at, updated_at')
    .eq('user_id', userId)
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch knowledge by category:', error.message);
    return [];
  }

  return data || [];
}

export async function getKnowledgeTags(userId: string): Promise<Array<{ tag_name: string; usage_count: number }>> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('cp_knowledge_tags')
    .select('tag_name, usage_count')
    .eq('user_id', userId)
    .order('usage_count', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to fetch knowledge tags:', error.message);
    return [];
  }

  return data || [];
}
