/**
 * Inspiration Repository (cp_inspiration_pulls, cp_inspiration_sources, swipe_file_posts)
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";

const PULL_COLUMNS =
  "id, user_id, source_id, content_type, title, content_preview, source_url, platform, author_name, author_url, engagement_metrics, ai_analysis, pulled_at, saved_to_swipe_file, dismissed, created_at";

const SOURCE_COLUMNS =
  "id, user_id, source_type, source_value, is_active, priority, last_pulled_at, created_at";

export interface InspirationPullRow {
  id: string;
  user_id: string;
  source_id: string | null;
  content_type: string | null;
  title: string | null;
  content_preview: string | null;
  source_url: string | null;
  platform: string | null;
  author_name: string | null;
  author_url: string | null;
  engagement_metrics: unknown;
  ai_analysis: unknown;
  pulled_at: string | null;
  saved_to_swipe_file: boolean;
  dismissed: boolean;
  created_at: string;
}

export interface InspirationSourceRow {
  id: string;
  user_id: string;
  source_type: string;
  source_value: string;
  is_active: boolean;
  priority: number;
  last_pulled_at: string | null;
  created_at: string;
}

export interface InspirationFilters {
  source_id?: string;
  content_type?: string;
  from?: string;
  to?: string;
  saved_only?: boolean;
  dismissed?: boolean;
  limit?: number;
  offset?: number;
}

export async function findPulls(
  userId: string,
  filters: InspirationFilters,
): Promise<{ data: InspirationPullRow[]; count: number }> {
  const supabase = createSupabaseAdminClient();
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  let query = supabase
    .from("cp_inspiration_pulls")
    .select(PULL_COLUMNS, { count: "exact" })
    .eq("user_id", userId)
    .order("pulled_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.source_id) query = query.eq("source_id", filters.source_id);
  if (filters.content_type) query = query.eq("content_type", filters.content_type);
  if (filters.from) query = query.gte("pulled_at", filters.from);
  if (filters.to) query = query.lte("pulled_at", filters.to);
  if (filters.saved_only) query = query.eq("saved_to_swipe_file", true);
  if (filters.dismissed === false) query = query.eq("dismissed", false);
  else if (filters.dismissed === true) query = query.eq("dismissed", true);

  const { data, error, count } = await query;
  if (error) throw new Error(`inspiration.findPulls: ${error.message}`);
  return { data: (data ?? []) as InspirationPullRow[], count: count ?? 0 };
}

export async function updatePull(
  userId: string,
  pullId: string,
  updates: Record<string, unknown>,
): Promise<InspirationPullRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_inspiration_pulls")
    .update(updates)
    .eq("id", pullId)
    .eq("user_id", userId)
    .select(PULL_COLUMNS)
    .single();
  if (error || !data) return null;
  return data as InspirationPullRow;
}

export async function insertSwipeFilePost(row: {
  content: string;
  hook: string | null;
  post_type: string | null;
  niche: string | null;
  source_url: string | null;
  author_name: string | null;
  notes: string | null;
  submitted_by: string;
  status: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("swipe_file_posts").insert(row);
  if (error) throw new Error(`inspiration.insertSwipeFilePost: ${error.message}`);
}

export async function findSources(
  userId: string,
  activeOnly = true,
): Promise<InspirationSourceRow[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("cp_inspiration_sources")
    .select(SOURCE_COLUMNS)
    .eq("user_id", userId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(`inspiration.findSources: ${error.message}`);
  return (data ?? []) as InspirationSourceRow[];
}

export async function findSourceByTypeAndValue(
  userId: string,
  sourceType: string,
  sourceValue: string,
): Promise<{ id: string; is_active: boolean } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("cp_inspiration_sources")
    .select("id, is_active")
    .eq("user_id", userId)
    .eq("source_type", sourceType)
    .eq("source_value", sourceValue)
    .maybeSingle();
  return data;
}

export async function updateSource(
  userId: string,
  sourceId: string,
  updates: Record<string, unknown>,
): Promise<InspirationSourceRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_inspiration_sources")
    .update(updates)
    .eq("id", sourceId)
    .eq("user_id", userId)
    .select(SOURCE_COLUMNS)
    .single();
  if (error || !data) return null;
  return data as InspirationSourceRow;
}

export async function createSource(
  userId: string,
  input: { source_type: string; source_value: string; priority: number },
): Promise<InspirationSourceRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_inspiration_sources")
    .insert({
      user_id: userId,
      source_type: input.source_type,
      source_value: input.source_value,
      priority: input.priority,
      is_active: true,
    })
    .select(SOURCE_COLUMNS)
    .single();
  if (error) throw new Error(`inspiration.createSource: ${error.message}`);
  return data as InspirationSourceRow;
}

export async function deleteSource(
  userId: string,
  sourceId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cp_inspiration_sources")
    .delete()
    .eq("id", sourceId)
    .eq("user_id", userId);
  if (error) throw new Error(`inspiration.deleteSource: ${error.message}`);
}
