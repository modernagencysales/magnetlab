/**
 * Lead Magnets Repository
 * ALL Supabase queries for lead_magnets, brand_kits, background_jobs, and
 * funnel_pages/storage helpers used exclusively by the lead-magnet domain.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { applyScope } from '@/lib/utils/team-context';
import type { DataScope } from '@/lib/utils/team-context';

// ─── Column sets ────────────────────────────────────────────────────────────

const LM_DETAIL_COLUMNS =
  'id, user_id, title, archetype, concept, extracted_content, generated_content, linkedin_post, post_variations, dm_template, cta_word, thumbnail_url, scheduled_time, polished_content, polished_at, status, published_at, created_at, updated_at';

const BRAND_KIT_COLUMNS =
  'id, user_id, business_description, business_type, credibility_markers, sender_name, saved_ideation_result, ideation_generated_at, urgent_pains, templates, processes, tools, frequent_questions, results, success_example, audience_tools, preferred_tone, style_profile, best_video_url, best_video_title, content_links, community_url, created_at, updated_at';

// ─── Lead magnet queries ─────────────────────────────────────────────────────

export async function findLeadMagnets(
  scope: DataScope,
  opts: { status?: string | null; limit?: number; offset?: number },
) {
  const supabase = createSupabaseAdminClient();
  let query = applyScope(supabase.from('lead_magnets').select('*', { count: 'exact' }), scope)
    .order('created_at', { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);
  if (opts.status) query = query.eq('status', opts.status);
  const { data, error, count } = await query;
  if (error) throw new Error(`lead-magnets.findLeadMagnets: ${error.message}`);
  return { data: data ?? [], count: count ?? 0 };
}

export async function findLeadMagnetById(scope: DataScope, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await applyScope(
    supabase.from('lead_magnets').select(LM_DETAIL_COLUMNS).eq('id', id),
    scope,
  ).single();
  return data ?? null;
}

/** Fetch specific columns — used by AI/action routes that only need a subset of fields. */
export async function findLeadMagnetScoped(scope: DataScope, id: string, columns: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await applyScope(
    supabase.from('lead_magnets').select(columns).eq('id', id),
    scope,
  ).single();
  return data ?? null;
}

/** Ownership-only check (used by catalog route which bypasses team scope). */
export async function findLeadMagnetByOwner(userId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('lead_magnets')
    .select('id, user_id')
    .eq('id', id)
    .single();
  return data ?? null;
}

/** List lead magnets by user_id (for external API). */
export async function findLeadMagnetsByUserId(
  userId: string,
  opts: { status?: string | null; limit?: number; offset?: number }
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('lead_magnets')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);
  if (opts.status) query = query.eq('status', opts.status);
  const { data, error, count } = await query;
  if (error) throw new Error(`lead-magnets.findLeadMagnetsByUserId: ${error.message}`);
  return { data: data ?? [], count: count ?? 0 };
}

/** Get full lead magnet by id and user_id (for external API). */
export async function findLeadMagnetByIdAndUser(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('lead_magnets')
    .select(LM_DETAIL_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data;
}

/** RPC: check usage limit (for external API). */
export async function checkUsageLimitRpc(userId: string, limitType: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('check_usage_limit', {
    p_user_id: userId,
    p_limit_type: limitType,
  });
  return { data, error };
}

/** RPC: increment usage (for external API). */
export async function incrementUsageRpc(userId: string, limitType: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc('increment_usage', {
    p_user_id: userId,
    p_limit_type: limitType,
  });
  return { error };
}

export async function createLeadMagnet(
  userId: string,
  teamId: string | null,
  fields: Record<string, unknown>,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('lead_magnets')
    .insert({ user_id: userId, team_id: teamId, ...fields })
    .select()
    .single();
  if (error) throw new Error(`lead-magnets.createLeadMagnet: ${error.message}`);
  return data;
}

export async function createLeadMagnetSelect(
  userId: string,
  teamId: string | null,
  fields: Record<string, unknown>,
  selectCols: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('lead_magnets')
    .insert({ user_id: userId, team_id: teamId, ...fields })
    .select(selectCols)
    .single();
  if (error) throw new Error(`lead-magnets.createLeadMagnetSelect: ${error.message}`);
  return data as unknown as { id: string; title: string };
}

/** Full update returning all columns (used by PUT [id] route). */
export async function updateLeadMagnet(
  scope: DataScope,
  id: string,
  updates: Record<string, unknown>,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await applyScope(
    supabase.from('lead_magnets').update(updates).eq('id', id),
    scope,
  )
    .select()
    .single();
  if (error) throw new Error(`lead-magnets.updateLeadMagnet: ${error.message}`);
  return data;
}

/** Scoped update returning specific columns. */
export async function updateLeadMagnetWithSelect(
  scope: DataScope,
  id: string,
  updates: Record<string, unknown>,
  selectCols: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await applyScope(
    supabase.from('lead_magnets').update(updates).eq('id', id),
    scope,
  )
    .select(selectCols)
    .single();
  if (error) throw new Error(`lead-magnets.updateLeadMagnetWithSelect: ${error.message}`);
  return data;
}

/** Scoped update, no return value (fire-and-update pattern). */
export async function updateLeadMagnetNoReturn(
  scope: DataScope,
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await applyScope(
    supabase.from('lead_magnets').update(updates).eq('id', id),
    scope,
  );
  if (error) throw new Error(`lead-magnets.updateLeadMagnetNoReturn: ${error.message}`);
}

/** Direct ownership update (bypasses team scope — for catalog route and generate route). */
export async function updateLeadMagnetByOwner(
  userId: string,
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('lead_magnets')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(`lead-magnets.updateLeadMagnetByOwner: ${error.message}`);
}

/** Update lead magnet by id only (for verified webhooks e.g. gtm-callback). */
export async function updateLeadMagnetByIdUnscoped(
  id: string,
  updates: Record<string, unknown>,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('lead_magnets').update(updates).eq('id', id);
  return { error };
}

export async function deleteLeadMagnetWithCascade(scope: DataScope, id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data: funnels } = await supabase
    .from('funnel_pages')
    .select('id')
    .eq('lead_magnet_id', id);

  if (funnels && funnels.length > 0) {
    const funnelIds = funnels.map((f: { id: string }) => f.id);
    await Promise.all([
      supabase.from('qualification_questions').delete().in('funnel_page_id', funnelIds),
      supabase.from('funnel_leads').delete().in('funnel_page_id', funnelIds),
      supabase.from('page_views').delete().in('funnel_page_id', funnelIds),
    ]);
    await supabase.from('funnel_pages').delete().eq('lead_magnet_id', id);
  }

  const { error } = await applyScope(
    supabase.from('lead_magnets').delete().eq('id', id),
    scope,
  );
  if (error) throw new Error(`lead-magnets.deleteLeadMagnetWithCascade: ${error.message}`);
}

/** Used by import rollback cleanup. */
export async function deleteLeadMagnetById(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from('lead_magnets').delete().eq('id', id);
}

// ─── Brand kit ───────────────────────────────────────────────────────────────

export async function getBrandKitByUserId(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('brand_kits')
    .select(BRAND_KIT_COLUMNS)
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function upsertBrandKit(userId: string, context: Record<string, unknown>): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from('brand_kits').upsert({ user_id: userId, ...context }, { onConflict: 'user_id' });
}

// ─── Background jobs ─────────────────────────────────────────────────────────

export async function createBackgroundJob(
  userId: string,
  jobType: string,
  input: unknown,
): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('background_jobs')
    .insert({ user_id: userId, job_type: jobType, status: 'pending', input })
    .select('id')
    .single();
  if (error || !data) throw new Error(`lead-magnets.createBackgroundJob: ${error?.message ?? 'no data'}`);
  return data;
}

export async function updateJobTriggerId(jobId: string, triggerTaskId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('background_jobs')
    .update({ trigger_task_id: triggerTaskId })
    .eq('id', jobId);
}

// ─── Funnel page helpers (screenshots + import) ──────────────────────────────

export async function findPublishedFunnelPage(leadMagnetId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('funnel_pages')
    .select('id, slug, user_id')
    .eq('lead_magnet_id', leadMagnetId)
    .eq('is_published', true)
    .limit(1)
    .single();
  return data ?? null;
}

export async function getUsernameByUserId(userId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('users').select('username').eq('id', userId).single();
  return data?.username ?? null;
}

export async function checkSlugExists(scope: DataScope, slug: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data } = await applyScope(
    supabase.from('funnel_pages').select('id').eq('slug', slug),
    scope,
  ).single();
  return !!data;
}

export async function createFunnelPageWithRetry(fields: Record<string, unknown>): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  let { data, error } = await supabase
    .from('funnel_pages')
    .insert(fields)
    .select('id')
    .single();
  if (error?.code === '23505') {
    const slug = `${String(fields.slug)}-${Date.now().toString(36).slice(-4)}`;
    ({ data, error } = await supabase
      .from('funnel_pages')
      .insert({ ...fields, slug })
      .select('id')
      .single());
  }
  if (error || !data) throw new Error(`lead-magnets.createFunnelPageWithRetry: ${error?.message ?? 'no data'}`);
  return data;
}

// ─── Screenshot storage ──────────────────────────────────────────────────────

export async function uploadScreenshotToStorage(
  userId: string,
  leadMagnetId: string,
  prefix: string,
  size: string,
  buffer: Buffer,
): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const path = `screenshots/${userId}/${leadMagnetId}/${prefix}-${size}.png`;
  const { error } = await supabase.storage
    .from('magnetlab')
    .upload(path, buffer, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`lead-magnets.uploadScreenshot (${size}): ${error.message}`);
  const { data: urlData } = supabase.storage.from('magnetlab').getPublicUrl(path);
  return urlData.publicUrl;
}
