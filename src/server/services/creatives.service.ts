/**
 * Creatives Service.
 * CRUD + ingest pipeline for cp_creatives.
 * Never imports from Next.js HTTP layer (no NextRequest, NextResponse, cookies).
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import { analyzeCreative } from '@/lib/ai/content-pipeline/creative-analyzer';
import { getExploitBySlug } from '@/server/services/exploits.service';
import type { Creative, CreativeFilters, CreativeCreateInput } from '@/lib/types/exploits';
import type { UpdateCreativeInput } from '@/lib/validations/exploits';
import type { DataScope } from '@/lib/utils/team-context';

// ─── Column constants ───────────────────────────────────────────────────────

const CREATIVE_COLUMNS =
  'id, user_id, team_id, source_platform, source_url, source_author, content_text, image_url, creative_type, topics, commentary_worthy_score, suggested_hooks, suggested_exploit_id, status, times_used, created_at' as const;

const ALLOWED_UPDATE_FIELDS = ['status', 'image_url'] as const;

// ─── Read operations ────────────────────────────────────────────────────────

/**
 * List creatives for a user, ordered by created_at desc.
 * Optional filters: status, source_platform, creative_type, min_score, limit.
 */
export async function listCreatives(
  scope: DataScope,
  filters: CreativeFilters = {}
): Promise<Creative[]> {
  const supabase = createSupabaseAdminClient();

  const limit = Math.min(filters.limit ?? 50, 200);

  let query = supabase
    .from('cp_creatives')
    .select(CREATIVE_COLUMNS)
    .eq('user_id', scope.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.source_platform) {
    query = query.eq('source_platform', filters.source_platform);
  }
  if (filters.creative_type) {
    query = query.eq('creative_type', filters.creative_type);
  }
  if (filters.min_score !== undefined) {
    query = query.gte('commentary_worthy_score', filters.min_score);
  }

  const { data, error } = await query;

  if (error) {
    logError('creatives-service/list', error, { userId: scope.userId });
    throw Object.assign(new Error('Failed to list creatives'), { statusCode: 500 });
  }

  return (data ?? []) as Creative[];
}

/** Get a single creative by ID. Returns null if not found or not owned by user. */
export async function getCreativeById(userId: string, id: string): Promise<Creative | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('cp_creatives')
    .select(CREATIVE_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logError('creatives-service/get-by-id', error, { userId, id });
    throw Object.assign(new Error('Failed to fetch creative'), { statusCode: 500 });
  }

  return data as Creative | null;
}

// ─── Write operations ───────────────────────────────────────────────────────

/**
 * Create a new creative, running AI analysis to enrich type, topics,
 * score, hooks, and suggested exploit.
 */
export async function createCreative(
  scope: DataScope,
  input: CreativeCreateInput
): Promise<Creative | null> {
  const supabase = createSupabaseAdminClient();

  // ─── 1. AI analysis ──────────────────────────────────────────────────
  const analysis = await analyzeCreative({
    content_text: input.content_text,
    source_platform: input.source_platform ?? 'manual',
    source_url: input.source_url,
  });

  // ─── 2. Resolve suggested exploit ────────────────────────────────────
  let suggested_exploit_id: string | null = null;
  if (analysis?.suggested_exploit_slug) {
    const exploit = await getExploitBySlug(scope.userId, analysis.suggested_exploit_slug);
    suggested_exploit_id = exploit?.id ?? null;
  }

  // ─── 3. Build insert payload ──────────────────────────────────────────
  const insertPayload = {
    user_id: scope.userId,
    team_id: input.team_id ?? scope.teamId ?? null,
    source_platform: input.source_platform ?? 'manual',
    source_url: input.source_url ?? null,
    source_author: input.source_author ?? null,
    content_text: input.content_text,
    image_url: input.image_url ?? null,
    creative_type: analysis?.creative_type ?? input.creative_type ?? 'custom',
    topics: analysis?.topics ?? [],
    commentary_worthy_score: analysis?.commentary_worthy_score ?? 5,
    suggested_hooks: analysis?.suggested_hooks ?? [],
    suggested_exploit_id,
    status: 'new' as const,
    times_used: 0,
  };

  const { data, error } = await supabase
    .from('cp_creatives')
    .insert(insertPayload)
    .select(CREATIVE_COLUMNS)
    .maybeSingle();

  if (error) {
    logError('creatives-service/create', error, { userId: scope.userId, step: 'insert' });
    throw Object.assign(new Error('Failed to create creative'), { statusCode: 500 });
  }

  return data as Creative | null;
}

/**
 * Update a creative. Only fields in ALLOWED_UPDATE_FIELDS are applied.
 * Returns null if not found.
 */
export async function updateCreative(
  userId: string,
  id: string,
  input: UpdateCreativeInput
): Promise<Creative | null> {
  const supabase = createSupabaseAdminClient();

  // Build whitelist-filtered update object
  const updates: Partial<Record<(typeof ALLOWED_UPDATE_FIELDS)[number], unknown>> = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in input) {
      updates[field] = input[field as keyof UpdateCreativeInput];
    }
  }

  if (Object.keys(updates).length === 0) {
    // Nothing to update — return current record
    return getCreativeById(userId, id);
  }

  const { data, error } = await supabase
    .from('cp_creatives')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select(CREATIVE_COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logError('creatives-service/update', error, { userId, id, step: 'update' });
    throw Object.assign(new Error('Failed to update creative'), { statusCode: 500 });
  }

  return data as Creative | null;
}

/**
 * Delete a creative by ID. Returns false if not found.
 */
export async function deleteCreative(userId: string, id: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  const { error, count } = await supabase
    .from('cp_creatives')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logError('creatives-service/delete', error, { userId, id });
    throw Object.assign(new Error('Failed to delete creative'), { statusCode: 500 });
  }

  return (count ?? 0) > 0;
}

// ─── Error helper used by routes ────────────────────────────────────────────

/** Extract HTTP status from a service error (defaults to 500). */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
