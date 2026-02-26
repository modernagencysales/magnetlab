import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { clusterTags } from '@/lib/ai/content-pipeline/tag-clusterer';
import { generateTopicSummary } from '@/lib/ai/content-pipeline/topic-summarizer';
import { logError } from '@/lib/utils/logger';
import type {
  KnowledgeEntry,
  KnowledgeEntryWithSimilarity,
  KnowledgeCategory,
  KnowledgeType,
  KnowledgeTopic,
} from '@/lib/types/content-pipeline';

export async function verifyTeamMembership(userId: string, teamId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  // Check V2 team_profiles first (has team_id + user_id columns)
  const { data: v2 } = await supabase
    .from('team_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .eq('status', 'active')
    .limit(1);
  if (v2 && v2.length > 0) return true;

  // Fallback: check if user owns this team
  const { data: owned } = await supabase
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('owner_id', userId)
    .limit(1);
  return (owned !== null && owned.length > 0);
}

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
    logError('services/knowledge-brain', new Error('Knowledge search failed'), { detail: error.message });
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

export interface EnhancedSearchOptions {
  query?: string;
  knowledgeType?: KnowledgeType;
  topicSlug?: string;
  minQuality?: number;
  since?: string;
  category?: KnowledgeCategory;
  tags?: string[];
  limit?: number;
  threshold?: number;
  teamId?: string;
  profileId?: string;
  sort?: KnowledgeSortOption;
}

export async function searchKnowledgeV2(
  userId: string,
  options: EnhancedSearchOptions = {}
): Promise<SearchKnowledgeResult> {
  const {
    query,
    knowledgeType,
    topicSlug,
    minQuality,
    since,
    category,
    tags,
    limit = 20,
    threshold = 0.6,
    teamId,
    profileId,
    sort = 'newest',
  } = options;

  const supabase = createSupabaseAdminClient();

  // Semantic search path
  if (query) {
    const queryEmbedding = await generateEmbedding(query);
    let data;
    let error;

    if (teamId) {
      // Team-wide semantic search (filters applied client-side)
      ({ data, error } = await supabase.rpc('cp_match_team_knowledge_entries', {
        query_embedding: JSON.stringify(queryEmbedding),
        p_team_id: teamId,
        p_profile_id: profileId || null,
        threshold,
        match_count: limit * 2,
      }));
    } else {
      // Standard user-scoped V2 search
      ({ data, error } = await supabase.rpc('cp_match_knowledge_entries_v2', {
        query_embedding: JSON.stringify(queryEmbedding),
        p_user_id: userId,
        threshold,
        match_count: limit,
        p_knowledge_type: knowledgeType || null,
        p_topic_slug: topicSlug || null,
        p_min_quality: minQuality || null,
        p_since: since || null,
      }));
    }

    if (error) {
      logError('services/knowledge-brain', new Error('Enhanced search failed'), { detail: error.message });
      return { entries: [], error: error.message };
    }

    let results = (data || []) as KnowledgeEntryWithSimilarity[];

    // Client-side filtering for team results (team RPC lacks type/quality/since filters)
    if (teamId) {
      if (knowledgeType) results = results.filter(e => e.knowledge_type === knowledgeType);
      if (topicSlug) results = results.filter(e => (e.topics || []).includes(topicSlug));
      if (minQuality) results = results.filter(e => (e.quality_score || 0) >= minQuality);
      if (since) results = results.filter(e => e.source_date && e.source_date >= since);
      results = results.slice(0, limit);
    }

    if (category) results = results.filter(e => e.category === category);
    if (tags?.length) results = results.filter(e => tags.some(t => e.tags?.includes(t)));

    return { entries: results };
  }

  // Non-search browse path with new filters
  const userFilter = teamId ? 'team_id' : 'user_id';
  const userValue = teamId || userId;
  const orderColumn = sort === 'quality' ? 'quality_score' : 'created_at';
  const ascending = sort === 'oldest';
  let dbQuery = supabase
    .from('cp_knowledge_entries')
    .select('id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, knowledge_type, topics, quality_score, specificity, actionability, source_date, speaker_company, team_id, source_profile_id, superseded_by, created_at, updated_at')
    .eq(userFilter, userValue)
    .is('superseded_by', null)
    .order(orderColumn, { ascending })
    .limit(limit);

  if (knowledgeType) dbQuery = dbQuery.eq('knowledge_type', knowledgeType);
  if (topicSlug) dbQuery = dbQuery.contains('topics', [topicSlug]);
  if (minQuality) dbQuery = dbQuery.gte('quality_score', minQuality);
  if (since) dbQuery = dbQuery.gte('source_date', since);
  if (category) dbQuery = dbQuery.eq('category', category);

  const { data, error } = await dbQuery;

  if (error) {
    logError('services/knowledge-brain', new Error('Browse failed'), { detail: error.message });
    return { entries: [], error: error.message };
  }

  // Browse path has no similarity score — add default 0
  const entries = (data || []).map(e => ({ ...e, similarity: 0 })) as KnowledgeEntryWithSimilarity[];
  return { entries };
}

export async function listKnowledgeTopics(
  userId: string,
  options: { teamId?: string; limit?: number } = {}
): Promise<KnowledgeTopic[]> {
  const { teamId, limit = 50 } = options;
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('cp_knowledge_topics')
    .select('id, user_id, team_id, slug, display_name, description, entry_count, avg_quality, first_seen, last_seen, parent_id, summary, summary_generated_at, created_at')
    .order('entry_count', { ascending: false })
    .limit(limit);

  if (teamId) {
    query = query.eq('team_id', teamId);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    logError('services/knowledge-brain', new Error('Failed to list topics'), { detail: error.message });
    return [];
  }

  return data || [];
}

export async function getTopicDetail(
  userId: string,
  topicSlug: string,
  teamId?: string
): Promise<{
  topic: KnowledgeTopic | null;
  type_breakdown: Record<string, number>;
  top_entries: Record<string, KnowledgeEntry[]>;
  corroboration_count: number;
}> {
  const supabase = createSupabaseAdminClient();

  const scopeFilter = teamId ? 'team_id' : 'user_id';
  const scopeValue = teamId || userId;

  const { data: topic } = await supabase
    .from('cp_knowledge_topics')
    .select('id, user_id, team_id, slug, display_name, description, entry_count, avg_quality, first_seen, last_seen, parent_id, summary, summary_generated_at, created_at')
    .eq(scopeFilter, scopeValue)
    .eq('slug', topicSlug)
    .single();

  if (!topic) return { topic: null, type_breakdown: {}, top_entries: {}, corroboration_count: 0 };

  const { data: entries } = await supabase
    .from('cp_knowledge_entries')
    .select('id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, knowledge_type, topics, quality_score, specificity, actionability, source_date, speaker_company, team_id, source_profile_id, superseded_by, created_at, updated_at')
    .eq(scopeFilter, scopeValue)
    .contains('topics', [topicSlug])
    .is('superseded_by', null)
    .order('quality_score', { ascending: false })
    .limit(100);

  const allEntries = (entries || []) as KnowledgeEntry[];

  const type_breakdown: Record<string, number> = {};
  const top_entries: Record<string, KnowledgeEntry[]> = {};

  for (const entry of allEntries) {
    const kt = entry.knowledge_type || 'unknown';
    type_breakdown[kt] = (type_breakdown[kt] || 0) + 1;
    if (!top_entries[kt]) top_entries[kt] = [];
    if (top_entries[kt].length < 3) top_entries[kt].push(entry);
  }

  const entryIds = allEntries.map(e => e.id);
  let corroboration_count = 0;
  if (entryIds.length > 0) {
    const { count } = await supabase
      .from('cp_knowledge_corroborations')
      .select('*', { count: 'exact', head: true })
      .in('entry_id', entryIds);
    corroboration_count = count || 0;
  }

  return { topic: topic as KnowledgeTopic, type_breakdown, top_entries, corroboration_count };
}

export async function getRecentKnowledgeDigest(
  userId: string,
  days: number = 7,
  teamId?: string
): Promise<{
  entries_added: number;
  new_topics: string[];
  most_active_topics: Array<{ slug: string; display_name: string; count: number }>;
  highlights: KnowledgeEntry[];
}> {
  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const scopeFilter = teamId ? 'team_id' : 'user_id';
  const scopeValue = teamId || userId;

  // Count entries added
  const { count: entriesAdded } = await supabase
    .from('cp_knowledge_entries')
    .select('*', { count: 'exact', head: true })
    .eq(scopeFilter, scopeValue)
    .gte('created_at', since);

  // New topics
  const { data: newTopics } = await supabase
    .from('cp_knowledge_topics')
    .select('slug, display_name')
    .eq(scopeFilter, scopeValue)
    .gte('created_at', since);

  // Quality 4+ highlights
  const { data: highlights } = await supabase
    .from('cp_knowledge_entries')
    .select('id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, knowledge_type, topics, quality_score, specificity, actionability, source_date, speaker_company, team_id, source_profile_id, superseded_by, created_at, updated_at')
    .eq(scopeFilter, scopeValue)
    .gte('created_at', since)
    .gte('quality_score', 4)
    .is('superseded_by', null)
    .order('quality_score', { ascending: false })
    .limit(10);

  // Most active topics — get all recent entries with topics, count per slug
  const { data: recentEntries } = await supabase
    .from('cp_knowledge_entries')
    .select('topics')
    .eq(scopeFilter, scopeValue)
    .gte('created_at', since)
    .not('topics', 'eq', '{}');

  const topicCounts = new Map<string, number>();
  for (const entry of recentEntries || []) {
    for (const slug of (entry.topics as string[]) || []) {
      topicCounts.set(slug, (topicCounts.get(slug) || 0) + 1);
    }
  }

  const topicSlugs = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Resolve display names
  const mostActiveTopics: Array<{ slug: string; display_name: string; count: number }> = [];
  if (topicSlugs.length > 0) {
    const { data: topicNames } = await supabase
      .from('cp_knowledge_topics')
      .select('slug, display_name')
      .eq(scopeFilter, scopeValue)
      .in('slug', topicSlugs.map(t => t[0]));

    const nameMap = new Map((topicNames || []).map(t => [t.slug, t.display_name]));
    for (const [slug, count] of topicSlugs) {
      mostActiveTopics.push({ slug, display_name: nameMap.get(slug) || slug, count });
    }
  }

  return {
    entries_added: entriesAdded || 0,
    new_topics: (newTopics || []).map(t => t.display_name),
    most_active_topics: mostActiveTopics,
    highlights: (highlights || []) as KnowledgeEntry[],
  };
}

export async function exportTopicKnowledge(
  userId: string,
  topicSlug: string,
  teamId?: string
): Promise<{
  topic: KnowledgeTopic | null;
  entries_by_type: Record<string, KnowledgeEntry[]>;
  total_count: number;
}> {
  const supabase = createSupabaseAdminClient();
  const scopeFilter = teamId ? 'team_id' : 'user_id';
  const scopeValue = teamId || userId;

  const { data: topic } = await supabase
    .from('cp_knowledge_topics')
    .select('id, user_id, team_id, slug, display_name, description, entry_count, avg_quality, first_seen, last_seen, parent_id, summary, summary_generated_at, created_at')
    .eq(scopeFilter, scopeValue)
    .eq('slug', topicSlug)
    .single();

  if (!topic) return { topic: null, entries_by_type: {}, total_count: 0 };

  const { data: entries } = await supabase
    .from('cp_knowledge_entries')
    .select('id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, knowledge_type, topics, quality_score, specificity, actionability, source_date, speaker_company, team_id, source_profile_id, superseded_by, created_at, updated_at')
    .eq(scopeFilter, scopeValue)
    .contains('topics', [topicSlug])
    .is('superseded_by', null)
    .order('quality_score', { ascending: false });

  const allEntries = (entries || []) as KnowledgeEntry[];
  const entries_by_type: Record<string, KnowledgeEntry[]> = {};

  for (const entry of allEntries) {
    const kt = entry.knowledge_type || 'unknown';
    if (!entries_by_type[kt]) entries_by_type[kt] = [];
    entries_by_type[kt].push(entry);
  }

  return { topic: topic as KnowledgeTopic, entries_by_type, total_count: allEntries.length };
}

export async function generateAndCacheTopicSummary(
  userId: string,
  topicSlug: string,
  force: boolean = false,
  teamId?: string
): Promise<{ summary: string; cached: boolean }> {
  const supabase = createSupabaseAdminClient();
  const scopeFilter = teamId ? 'team_id' : 'user_id';
  const scopeValue = teamId || userId;

  // Fetch topic with current summary state
  const { data: topic } = await supabase
    .from('cp_knowledge_topics')
    .select('id, slug, display_name, summary, summary_generated_at, last_seen')
    .eq(scopeFilter, scopeValue)
    .eq('slug', topicSlug)
    .single();

  if (!topic) throw new Error(`Topic not found: ${topicSlug}`);

  // Check if cached summary is still fresh
  if (!force && topic.summary && topic.summary_generated_at) {
    const summaryDate = new Date(topic.summary_generated_at);
    const lastSeen = new Date(topic.last_seen);
    if (summaryDate >= lastSeen) {
      return { summary: topic.summary, cached: true };
    }
  }

  // Fetch all entries for this topic, grouped by type
  const { data: entries } = await supabase
    .from('cp_knowledge_entries')
    .select('content, knowledge_type, quality_score')
    .eq(scopeFilter, scopeValue)
    .contains('topics', [topicSlug])
    .is('superseded_by', null)
    .order('quality_score', { ascending: false });

  const entriesByType: Record<string, Array<{ content: string; quality_score?: number | null }>> = {};
  for (const entry of entries || []) {
    const kt = entry.knowledge_type || 'unknown';
    if (!entriesByType[kt]) entriesByType[kt] = [];
    entriesByType[kt].push({ content: entry.content, quality_score: entry.quality_score });
  }

  const summary = await generateTopicSummary(topic.display_name, entriesByType);

  // Cache the summary
  await supabase
    .from('cp_knowledge_topics')
    .update({ summary, summary_generated_at: new Date().toISOString() })
    .eq('id', topic.id);

  return { summary, cached: false };
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

export type KnowledgeSortOption = 'newest' | 'oldest' | 'quality';

export async function getFilteredKnowledge(
  userId: string,
  filters: {
    category?: KnowledgeCategory;
    speaker?: 'host' | 'participant' | 'unknown';
    tag?: string;
    limit?: number;
    offset?: number;
    sort?: KnowledgeSortOption;
  }
): Promise<KnowledgeEntry[]> {
  const { category, speaker, tag, limit = 30, offset = 0, sort = 'newest' } = filters;
  const supabase = createSupabaseAdminClient();

  const orderColumn = sort === 'quality' ? 'quality_score' : 'created_at';
  const ascending = sort === 'oldest';

  let query = supabase
    .from('cp_knowledge_entries')
    .select('id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, knowledge_type, topics, quality_score, specificity, actionability, source_date, speaker_company, team_id, source_profile_id, superseded_by, created_at, updated_at')
    .eq('user_id', userId)
    .is('superseded_by', null)
    .order(orderColumn, { ascending })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq('category', category);
  }
  if (speaker) {
    query = query.eq('speaker', speaker);
  }
  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data, error } = await query;

  if (error) {
    logError('services/knowledge-brain', new Error('Failed to fetch filtered knowledge'), { detail: error.message });
    return [];
  }

  return data || [];
}

export async function getAllRecentKnowledge(
  userId: string,
  limit: number = 30,
  sort: KnowledgeSortOption = 'newest'
): Promise<KnowledgeEntry[]> {
  const supabase = createSupabaseAdminClient();

  const orderColumn = sort === 'quality' ? 'quality_score' : 'created_at';
  const ascending = sort === 'oldest';

  const { data, error } = await supabase
    .from('cp_knowledge_entries')
    .select('id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, knowledge_type, topics, quality_score, specificity, actionability, source_date, speaker_company, team_id, source_profile_id, superseded_by, created_at, updated_at')
    .eq('user_id', userId)
    .is('superseded_by', null)
    .order(orderColumn, { ascending })
    .limit(limit);

  if (error) {
    logError('services/knowledge-brain', new Error('Failed to fetch recent knowledge'), { detail: error.message });
    return [];
  }

  return data || [];
}

export async function getKnowledgeByCategory(
  userId: string,
  category: KnowledgeCategory,
  limit: number = 20
): Promise<KnowledgeEntry[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('cp_knowledge_entries')
    .select('id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, knowledge_type, topics, quality_score, specificity, actionability, source_date, speaker_company, team_id, source_profile_id, superseded_by, created_at, updated_at')
    .eq('user_id', userId)
    .eq('category', category)
    .is('superseded_by', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logError('services/knowledge-brain', new Error('Failed to fetch knowledge by category'), { detail: error.message });
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
    logError('services/knowledge-brain', new Error('Failed to fetch knowledge tags'), { detail: error.message });
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

export async function consolidateOrphanTags(userId: string): Promise<{ merged: number; kept: number }> {
  const supabase = createSupabaseAdminClient();

  // Fetch orphan tags (usage_count <= 2)
  const { data: orphanTags } = await supabase
    .from('cp_knowledge_tags')
    .select('id, tag_name, usage_count')
    .eq('user_id', userId)
    .lte('usage_count', 2)
    .order('usage_count', { ascending: true });

  // Fetch established tags (usage_count >= 3)
  const { data: establishedTags } = await supabase
    .from('cp_knowledge_tags')
    .select('id, tag_name, usage_count')
    .eq('user_id', userId)
    .gte('usage_count', 3)
    .order('usage_count', { ascending: false });

  if (!orphanTags?.length || !establishedTags?.length) {
    return { merged: 0, kept: orphanTags?.length || 0 };
  }

  // Use Claude Haiku to map orphans → established tags
  const { getAnthropicClient, parseJsonResponse } = await import('@/lib/ai/content-pipeline/anthropic-client');
  const { CLAUDE_HAIKU_MODEL } = await import('@/lib/ai/content-pipeline/model-config');
  const client = getAnthropicClient('knowledge-brain');

  const orphanList = orphanTags.map(t => `"${t.tag_name}" (${t.usage_count}x)`).join(', ');
  const establishedList = establishedTags.map(t => `"${t.tag_name}" (${t.usage_count}x)`).join(', ');

  const response = await client.messages.create({
    model: CLAUDE_HAIKU_MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Map each orphan tag to the closest established tag, or "keep" if it's truly unique.

ORPHAN TAGS (low usage): ${orphanList}

ESTABLISHED TAGS (high usage): ${establishedList}

Rules:
- Only merge if the orphan is clearly a variant/synonym of an established tag (e.g. "sales calls" → "sales", "client objection" → "objections")
- If no good match, output "keep"
- Be conservative — only merge obvious matches

Respond with ONLY valid JSON:
{"mappings": {"orphan_tag_name": "established_tag_name_or_keep", ...}}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const result = parseJsonResponse<{ mappings: Record<string, string> }>(text);

  if (!result?.mappings || typeof result.mappings !== 'object') {
    return { merged: 0, kept: orphanTags.length };
  }

  let merged = 0;
  let kept = 0;

  for (const orphan of orphanTags) {
    const target = result.mappings[orphan.tag_name];
    if (!target || target === 'keep') {
      kept++;
      continue;
    }

    // Verify target is an actual established tag
    const targetTag = establishedTags.find(t => t.tag_name === target);
    if (!targetTag) {
      kept++;
      continue;
    }

    // Update knowledge entries: replace orphan tag with target tag in tags array
    const { data: entries } = await supabase
      .from('cp_knowledge_entries')
      .select('id, tags')
      .eq('user_id', userId)
      .contains('tags', [orphan.tag_name]);

    for (const entry of entries || []) {
      const updatedTags = (entry.tags as string[])
        .map(t => t === orphan.tag_name ? target : t)
        .filter((t, i, arr) => arr.indexOf(t) === i); // dedupe

      await supabase
        .from('cp_knowledge_entries')
        .update({ tags: updatedTags })
        .eq('id', entry.id);
    }

    // Update usage counts (mutate in-memory count to handle multiple orphans → same target)
    targetTag.usage_count += orphan.usage_count;
    await supabase
      .from('cp_knowledge_tags')
      .update({ usage_count: targetTag.usage_count })
      .eq('id', targetTag.id);

    // Delete orphan tag row
    await supabase
      .from('cp_knowledge_tags')
      .delete()
      .eq('id', orphan.id);

    merged++;
  }

  return { merged, kept };
}

export async function runTagClustering(userId: string): Promise<{ clustersCreated: number; orphansMerged?: number }> {
  const supabase = createSupabaseAdminClient();

  // Step 1: Consolidate orphan tags before clustering
  let orphansMerged = 0;
  try {
    const consolidation = await consolidateOrphanTags(userId);
    orphansMerged = consolidation.merged;
  } catch (err) {
    logError('services/knowledge-brain', err instanceof Error ? err : new Error('Orphan consolidation failed'), { userId });
  }

  // Step 2: Get all remaining tags for clustering
  const { data: tags } = await supabase
    .from('cp_knowledge_tags')
    .select('id, tag_name, usage_count')
    .eq('user_id', userId)
    .order('usage_count', { ascending: false })
    .limit(200);

  if (!tags?.length) return { clustersCreated: 0, orphansMerged };

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

  return { clustersCreated: result.clusters.length, orphansMerged };
}
