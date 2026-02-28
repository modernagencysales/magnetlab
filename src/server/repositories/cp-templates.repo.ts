/**
 * Content Pipeline Templates Repository
 * All Supabase access for cp_post_templates and cp_match_templates RPC.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const TEMPLATE_SELECT =
  'id, user_id, name, category, description, structure, example_posts, use_cases, tags, usage_count, avg_engagement_score, is_active, is_global, source, created_at, updated_at';

export type TemplateScope = 'global' | 'mine' | null;

export async function listTemplates(userId: string, scope: TemplateScope) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('cp_post_templates')
    .select(TEMPLATE_SELECT)
    .eq('is_active', true);

  if (scope === 'global') {
    query = query.eq('is_global', true);
  } else if (scope === 'mine') {
    query = query.eq('user_id', userId).eq('is_global', false);
  } else {
    query = query.or(`user_id.eq.${userId},is_global.eq.true`);
  }

  const { data, error } = await query.order('usage_count', { ascending: false });
  return { data: data ?? [], error };
}

export async function createTemplate(
  userId: string,
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
    user_id: userId,
    name: row.name,
    category: row.category ?? null,
    description: row.description ?? null,
    structure: row.structure,
    example_posts: row.example_posts ?? null,
    use_cases: row.use_cases ?? null,
    tags: row.tags ?? null,
  };
  if (row.embedding) insertData.embedding = row.embedding;

  const { data, error } = await supabase
    .from('cp_post_templates')
    .insert(insertData)
    .select(TEMPLATE_SELECT)
    .single();
  return { data, error };
}

export async function getTemplateById(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_post_templates')
    .select(TEMPLATE_SELECT)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function updateTemplate(
  id: string,
  userId: string,
  updates: Record<string, unknown>
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_post_templates')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select(TEMPLATE_SELECT)
    .single();
  return { data, error };
}

export async function deleteTemplate(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cp_post_templates').delete().eq('id', id).eq('user_id', userId);
  return { error };
}

export async function countTemplatesByUser(userId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from('cp_post_templates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

export async function insertTemplates(
  userId: string,
  rows: Array<Record<string, unknown>>
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_post_templates')
    .insert(rows)
    .select('id, name');
  return { data: data ?? [], error };
}

export async function matchTemplatesRpc(
  userId: string,
  queryEmbedding: string,
  matchCount: number,
  minSimilarity: number
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('cp_match_templates', {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: matchCount,
    min_similarity: minSimilarity,
  });
  return { data: data ?? [], error };
}
