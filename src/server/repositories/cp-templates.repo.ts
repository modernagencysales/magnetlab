/**
 * Content Pipeline Templates Repository.
 * All Supabase access for cp_post_templates and cp_match_templates RPC.
 * Team-scoped via DataScope or explicit team_id params.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { DataScope } from '@/lib/utils/team-context';
import { applyScope } from '@/lib/utils/team-context';

const TEMPLATE_SELECT =
  'id, user_id, team_id, name, category, description, structure, example_posts, use_cases, tags, usage_count, avg_engagement_score, is_active, is_global, source, created_at, updated_at';

export type TemplateScope = 'global' | 'mine' | null;

const ALLOWED_TEMPLATE_UPDATE_FIELDS = [
  'name',
  'category',
  'description',
  'structure',
  'example_posts',
  'use_cases',
  'tags',
  'embedding',
  'is_active',
  'team_id',
] as const;

// ─── List / Read ────────────────────────────────────────────────────────────

export async function listTemplates(scope: DataScope, filter: TemplateScope) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('cp_post_templates')
    .select(TEMPLATE_SELECT)
    .eq('is_active', true);

  if (filter === 'global') {
    query = query.eq('is_global', true);
  } else if (filter === 'mine') {
    query = applyScope(query, scope).eq('is_global', false);
  } else {
    // Show both team-owned + global
    if (scope.type === 'team' && scope.teamId) {
      query = query.or(`team_id.eq.${scope.teamId},is_global.eq.true`);
    } else {
      query = query.or(`user_id.eq.${scope.userId},is_global.eq.true`);
    }
  }

  const { data, error } = await query.order('usage_count', { ascending: false });
  return { data: data ?? [], error };
}

export async function getTemplateById(id: string, scope: DataScope) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('cp_post_templates')
    .select(TEMPLATE_SELECT)
    .eq('id', id);
  query = applyScope(query, scope);
  const { data, error } = await query.single();
  return { data, error };
}

// ─── Create / Update / Delete ───────────────────────────────────────────────

export async function createTemplate(
  scope: DataScope,
  row: {
    name: string;
    category?: string | null;
    description?: string | null;
    structure: string;
    example_posts?: unknown;
    use_cases?: unknown;
    tags?: unknown;
    embedding?: string;
  }
) {
  const supabase = createSupabaseAdminClient();
  const insertData: Record<string, unknown> = {
    user_id: scope.userId,
    name: row.name,
    category: row.category ?? null,
    description: row.description ?? null,
    structure: row.structure,
    example_posts: row.example_posts ?? null,
    use_cases: row.use_cases ?? null,
    tags: row.tags ?? null,
  };
  if (scope.type === 'team' && scope.teamId) {
    insertData.team_id = scope.teamId;
  }
  if (row.embedding) insertData.embedding = row.embedding;

  const { data, error } = await supabase
    .from('cp_post_templates')
    .insert(insertData)
    .select(TEMPLATE_SELECT)
    .single();
  return { data, error };
}

export async function updateTemplate(
  id: string,
  scope: DataScope,
  updates: Record<string, unknown>
) {
  const filtered: Record<string, unknown> = {};
  for (const key of ALLOWED_TEMPLATE_UPDATE_FIELDS) {
    if (key in updates) filtered[key] = updates[key];
  }
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('cp_post_templates')
    .update(filtered)
    .eq('id', id);
  query = applyScope(query, scope);
  const { data, error } = await query.select(TEMPLATE_SELECT).single();
  return { data, error };
}

export async function deleteTemplate(id: string, scope: DataScope) {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from('cp_post_templates').delete().eq('id', id);
  query = applyScope(query, scope);
  const { error } = await query;
  return { error };
}

export async function countTemplatesByScope(scope: DataScope): Promise<number> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('cp_post_templates')
    .select('id', { count: 'exact', head: true });
  query = applyScope(query, scope);
  const { count } = await query;
  return count ?? 0;
}

export async function insertTemplates(
  scope: DataScope,
  rows: Array<Record<string, unknown>>
) {
  const supabase = createSupabaseAdminClient();
  // Ensure each row has the correct scope ownership
  const scopedRows = rows.map((row) => {
    const r: Record<string, unknown> = { ...row, user_id: scope.userId };
    if (scope.type === 'team' && scope.teamId) {
      r.team_id = scope.teamId;
    }
    return r;
  });
  const { data, error } = await supabase
    .from('cp_post_templates')
    .insert(scopedRows)
    .select('id, name');
  return { data: data ?? [], error };
}

// ─── Matching (pgvector RPC) ────────────────────────────────────────────────

export async function matchTemplatesRpc(
  teamId: string,
  queryEmbedding: string,
  matchCount: number,
  minSimilarity: number
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('cp_match_templates', {
    query_embedding: queryEmbedding,
    match_team_id: teamId,
    match_count: matchCount,
    min_similarity: minSimilarity,
  });
  return { data: data ?? [], error };
}

// ─── Freshness & Performance queries ────────────────────────────────────────

/**
 * Returns a map of template_id → last_used_at for the given profile.
 * Used to compute the freshness bonus during reranking.
 */
export async function getTemplateUsageByProfile(
  templateIds: string[],
  profileId: string
): Promise<Map<string, Date>> {
  if (templateIds.length === 0) return new Map();

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select('template_id, created_at')
    .in('template_id', templateIds)
    .eq('team_profile_id', profileId)
    .not('template_id', 'is', null);

  if (error || !data) return new Map();

  // Group by template_id and find MAX(created_at) per template
  const usageMap = new Map<string, Date>();
  for (const row of data) {
    if (!row.template_id) continue;
    const rowDate = new Date(row.created_at);
    const existing = usageMap.get(row.template_id);
    if (!existing || rowDate > existing) {
      usageMap.set(row.template_id, rowDate);
    }
  }

  return usageMap;
}

/**
 * Returns all avg_engagement_score values for active templates in a team
 * (including globals). Used for percentile rank computation during reranking.
 */
export async function getAllEngagementScores(teamId: string): Promise<(number | null)[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_post_templates')
    .select('avg_engagement_score')
    .eq('is_active', true)
    .or(`team_id.eq.${teamId},is_global.eq.true`);

  if (error || !data) return [];

  return data.map((row) => row.avg_engagement_score as number | null);
}
