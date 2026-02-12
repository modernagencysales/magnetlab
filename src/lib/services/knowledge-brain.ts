import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { clusterTags } from '@/lib/ai/content-pipeline/tag-clusterer';
import type {
  KnowledgeEntry,
  KnowledgeEntryWithSimilarity,
  KnowledgeCategory,
} from '@/lib/types/content-pipeline';

export interface SearchKnowledgeResult {
  entries: KnowledgeEntryWithSimilarity[];
  error?: string;
}

export async function searchKnowledge(
  userId: string,
  query: string,
  options: {
    category?: KnowledgeCategory;
    tags?: string[];
    limit?: number;
    threshold?: number;
    teamId?: string;
    profileId?: string;
  } = {}
): Promise<SearchKnowledgeResult> {
  const { category, tags, limit = 10, threshold = 0.7, teamId, profileId } = options;

  const queryEmbedding = await generateEmbedding(query);
  const supabase = createSupabaseAdminClient();

  let data;
  let error;

  if (teamId) {
    // Team-wide search with profile boosting
    ({ data, error } = await supabase.rpc('cp_match_team_knowledge_entries', {
      query_embedding: JSON.stringify(queryEmbedding),
      p_team_id: teamId,
      p_profile_id: profileId || null,
      threshold,
      match_count: limit,
    }));
  } else {
    // Standard user-scoped search
    ({ data, error } = await supabase.rpc('cp_match_knowledge_entries', {
      query_embedding: JSON.stringify(queryEmbedding),
      p_user_id: userId,
      threshold,
      match_count: limit,
    }));
  }

  if (error) {
    console.error('Knowledge search failed:', error.message);
    return { entries: [], error: error.message };
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

  return { entries: results };
}

export async function getRelevantContext(
  userId: string,
  topic: string,
  maxEntries: number = 15
): Promise<SearchKnowledgeResult> {
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

export async function getKnowledgeTags(userId: string): Promise<Array<{ tag_name: string; usage_count: number; cluster_id: string | null }>> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('cp_knowledge_tags')
    .select('tag_name, usage_count, cluster_id')
    .eq('user_id', userId)
    .order('usage_count', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Failed to fetch knowledge tags:', error.message);
    return [];
  }

  return data || [];
}

export interface TagCluster {
  id: string;
  name: string;
  description: string | null;
  tags: Array<{ tag_name: string; usage_count: number }>;
}

export async function getTagClusters(userId: string): Promise<TagCluster[]> {
  const supabase = createSupabaseAdminClient();

  const { data: clusters, error } = await supabase
    .from('cp_tag_clusters')
    .select('id, name, description')
    .eq('user_id', userId)
    .order('name');

  if (error || !clusters?.length) return [];

  const { data: tags } = await supabase
    .from('cp_knowledge_tags')
    .select('tag_name, usage_count, cluster_id')
    .eq('user_id', userId)
    .not('cluster_id', 'is', null)
    .order('usage_count', { ascending: false });

  return clusters.map((cluster) => ({
    ...cluster,
    tags: (tags || []).filter((t) => t.cluster_id === cluster.id),
  }));
}

export async function runTagClustering(userId: string): Promise<{ clustersCreated: number }> {
  const supabase = createSupabaseAdminClient();

  // Get all tags for this user
  const { data: tags } = await supabase
    .from('cp_knowledge_tags')
    .select('id, tag_name, usage_count')
    .eq('user_id', userId)
    .order('usage_count', { ascending: false })
    .limit(200);

  if (!tags?.length) return { clustersCreated: 0 };

  // Run AI clustering
  const result = await clusterTags(tags);

  // Clear existing clusters for this user
  await supabase.from('cp_tag_clusters').delete().eq('user_id', userId);

  // Reset cluster_id on all tags
  await supabase
    .from('cp_knowledge_tags')
    .update({ cluster_id: null })
    .eq('user_id', userId);

  // Create new clusters and assign tags
  for (const cluster of result.clusters) {
    const { data: created } = await supabase
      .from('cp_tag_clusters')
      .insert({
        user_id: userId,
        name: cluster.name,
        description: cluster.description,
      })
      .select('id')
      .single();

    if (created) {
      // Assign tags to this cluster
      for (const tagName of cluster.tags) {
        await supabase
          .from('cp_knowledge_tags')
          .update({ cluster_id: created.id })
          .eq('user_id', userId)
          .eq('tag_name', tagName);
      }
    }
  }

  return { clustersCreated: result.clusters.length };
}
