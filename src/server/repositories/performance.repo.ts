/**
 * Performance Repository (cp_post_performance, cp_performance_patterns)
 * ALL Supabase queries for performance data live here.
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";

const PERF_COLUMNS =
  "id, user_id, post_id, platform, views, likes, comments, shares, saves, clicks, impressions, engagement_rate, captured_at, created_at";

const PATTERN_COLUMNS =
  "id, user_id, pattern_type, pattern_value, avg_engagement_rate, avg_views, avg_likes, avg_comments, sample_count, confidence, last_updated_at";

export interface PerformanceRow {
  id: string;
  user_id: string;
  post_id: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  impressions: number;
  engagement_rate: number;
  captured_at: string;
  created_at: string;
}

export interface PerformancePatternRow {
  id: string;
  user_id: string;
  pattern_type: string;
  pattern_value: string;
  avg_engagement_rate: number;
  avg_views: number;
  avg_likes: number;
  avg_comments: number;
  sample_count: number;
  confidence: number;
  last_updated_at: string | null;
}

export interface InsertPerformanceInput {
  user_id: string;
  post_id: string;
  platform: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  impressions?: number;
  engagement_rate?: number;
  captured_at?: string;
}

/** Verify post belongs to user (for IDOR). */
export async function findPostOwnership(
  userId: string,
  postId: string,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("cp_pipeline_posts")
    .select("id")
    .eq("id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function insertPerformance(
  input: InsertPerformanceInput,
): Promise<PerformanceRow> {
  const supabase = createSupabaseAdminClient();
  const row = {
    user_id: input.user_id,
    post_id: input.post_id,
    platform: input.platform,
    views: input.views ?? 0,
    likes: input.likes ?? 0,
    comments: input.comments ?? 0,
    shares: input.shares ?? 0,
    saves: input.saves ?? 0,
    clicks: input.clicks ?? 0,
    impressions: input.impressions ?? 0,
    engagement_rate: input.engagement_rate ?? 0,
    captured_at: input.captured_at ?? new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("cp_post_performance")
    .insert(row)
    .select(PERF_COLUMNS)
    .single();
  if (error) throw new Error(`performance.insert: ${error.message}`);
  return data as PerformanceRow;
}

export interface PerformanceFilters {
  post_id?: string;
  platform?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function findPerformance(
  userId: string,
  filters: PerformanceFilters,
): Promise<PerformanceRow[]> {
  const supabase = createSupabaseAdminClient();
  const limit = Math.min(filters.limit ?? 100, 500);
  let query = supabase
    .from("cp_post_performance")
    .select(PERF_COLUMNS)
    .eq("user_id", userId)
    .order("captured_at", { ascending: false })
    .limit(limit);

  if (filters.post_id) query = query.eq("post_id", filters.post_id);
  if (filters.platform) query = query.eq("platform", filters.platform);
  if (filters.from) query = query.gte("captured_at", filters.from);
  if (filters.to) query = query.lte("captured_at", filters.to);

  const { data, error } = await query;
  if (error) throw new Error(`performance.find: ${error.message}`);
  return (data ?? []) as PerformanceRow[];
}

export async function findPatterns(
  userId: string,
  patternType?: string,
): Promise<PerformancePatternRow[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("cp_performance_patterns")
    .select(PATTERN_COLUMNS)
    .eq("user_id", userId)
    .order("avg_engagement_rate", { ascending: false });

  if (patternType) query = query.eq("pattern_type", patternType);

  const { data, error } = await query;
  if (error) throw new Error(`performance.findPatterns: ${error.message}`);
  return (data ?? []) as PerformancePatternRow[];
}
