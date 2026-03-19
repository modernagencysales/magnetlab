/**
 * Trends Service.
 * Tracks topic frequency from creatives to identify trending topics.
 * Never imports from Next.js HTTP layer (no NextRequest, NextResponse, cookies).
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

// ─── Column constants ───────────────────────────────────────────────────────

const CREATIVE_TOPIC_COLUMNS = 'topics, created_at' as const;

const PATTERN_COLUMNS =
  'id, user_id, pattern_type, pattern_value, sample_count, avg_engagement_rate, confidence, created_at, updated_at' as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TrendingTopic {
  topic: string;
  count: number;
  confidence: 'low' | 'medium' | 'high';
  trend: 'rising' | 'stable' | 'declining';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Map a sample count to a confidence level. */
function toConfidence(count: number): 'low' | 'medium' | 'high' {
  if (count > 10) return 'high';
  if (count >= 3) return 'medium';
  return 'low';
}

// ─── Write operations ───────────────────────────────────────────────────────

/**
 * Aggregates topic mentions from the last 7 days of cp_creatives for this user
 * and upserts results into cp_performance_patterns with pattern_type = 'trending_topic'.
 */
export async function updateTopicCounts(userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // ─── 1. Fetch recent creatives with topics ─────────────────────────────
  const { data: creatives, error: fetchError } = await supabase
    .from('cp_creatives')
    .select(CREATIVE_TOPIC_COLUMNS)
    .eq('user_id', userId)
    .gte('created_at', since);

  if (fetchError) {
    logError('trends/update-topic-counts/fetch', fetchError, { userId });
    throw Object.assign(new Error('Failed to fetch creatives for trend analysis'), {
      statusCode: 500,
    });
  }

  if (!creatives || creatives.length === 0) return;

  // ─── 2. Count topic mentions across all creatives ─────────────────────
  const topicCounts = new Map<string, number>();
  for (const creative of creatives) {
    const topics = (creative.topics ?? []) as string[];
    for (const rawTopic of topics) {
      const topic = rawTopic.toLowerCase().trim();
      if (!topic) continue;
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }

  if (topicCounts.size === 0) return;

  // ─── 3. Upsert into cp_performance_patterns ───────────────────────────
  const now = new Date().toISOString();
  const upsertRows = Array.from(topicCounts.entries()).map(([topic, count]) => ({
    user_id: userId,
    pattern_type: 'trending_topic',
    pattern_value: topic,
    sample_count: count,
    avg_engagement_rate: null,
    confidence: toConfidence(count),
    updated_at: now,
  }));

  const { error: upsertError } = await supabase.from('cp_performance_patterns').upsert(upsertRows, {
    onConflict: 'user_id,pattern_type,pattern_value',
  });

  if (upsertError) {
    logError('trends/update-topic-counts/upsert', upsertError, { userId });
    throw Object.assign(new Error('Failed to upsert trending topics'), { statusCode: 500 });
  }
}

// ─── Read operations ────────────────────────────────────────────────────────

/**
 * Returns the top N trending topics for a user, ordered by sample_count DESC.
 * Trend direction is 'stable' by default — directional analysis requires
 * historical snapshots not yet stored.
 */
export async function getTrendingTopics(userId: string, limit = 10): Promise<TrendingTopic[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('cp_performance_patterns')
    .select(PATTERN_COLUMNS)
    .eq('user_id', userId)
    .eq('pattern_type', 'trending_topic')
    .order('sample_count', { ascending: false })
    .limit(limit);

  if (error) {
    logError('trends/get-trending-topics', error, { userId, limit });
    throw Object.assign(new Error('Failed to fetch trending topics'), { statusCode: 500 });
  }

  const rows = (data ?? []) as Array<{
    pattern_value: string;
    sample_count: number;
    confidence: string;
  }>;

  return rows.map((row) => ({
    topic: row.pattern_value,
    count: row.sample_count,
    confidence: (row.confidence ?? 'low') as 'low' | 'medium' | 'high',
    // Trend direction: stable by default until historical comparison is implemented
    trend: 'stable' as const,
  }));
}

/**
 * Returns topic suggestions relevant to the user (and optionally an exploit's category).
 * Cross-referencing by exploit category is a stub — topics are returned by frequency.
 */
export async function getTopicSuggestions(
  userId: string,
  _exploitId?: string
): Promise<TrendingTopic[]> {
  return getTrendingTopics(userId, 5);
}

// ─── Error helper used by routes ────────────────────────────────────────────

/** Extract HTTP status from a service error (defaults to 500). */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
