/**
 * Funnels Repository
 * ALL Supabase queries for funnel_pages, funnel_page_sections,
 * qualification_questions, funnel_integrations, funnel_leads, page_views.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { applyScope } from '@/lib/utils/team-context';
import type { DataScope } from '@/lib/utils/team-context';
import {
  funnelPageFromRow,
  funnelPageSectionFromRow,
  qualificationQuestionFromRow,
  type FunnelPageRow,
  type FunnelPageSectionRow,
  type QualificationQuestionRow,
  type FunnelPage,
  type FunnelPageSection,
  type QualificationQuestion,
  type PageLocation,
  type AnswerType,
} from '@/lib/types/funnel';
import { resolveQuestionsForFunnel } from '@/lib/services/qualification';
import { normalizeImageUrl, normalizeSectionConfigImageUrls } from '@/lib/utils/normalize-image-url';

// ─── Re-export types ───────────────────────────────────────────────────────
export type { FunnelPage, FunnelPageSection, QualificationQuestion };

// ─── Column sets ───────────────────────────────────────────────────────────

const FUNNEL_COLUMNS =
  'id, lead_magnet_id, user_id, slug, target_type, library_id, external_resource_id, optin_headline, optin_subline, optin_button_text, optin_social_proof, thankyou_headline, thankyou_subline, vsl_url, calendly_url, qualification_pass_message, qualification_fail_message, theme, primary_color, background_style, logo_url, qualification_form_id, is_published, published_at, created_at, updated_at, redirect_trigger, redirect_url, redirect_fail_url, send_resource_email';

const FUNNEL_FULL_COLUMNS = FUNNEL_COLUMNS + ', homepage_url, homepage_label';

const SECTION_COLUMNS =
  'id, funnel_page_id, section_type, page_location, sort_order, is_visible, config, created_at, updated_at';

const INTEGRATION_COLUMNS =
  'id, provider, list_id, list_name, tag_id, tag_name, is_active, settings, created_at, updated_at';

// ─── Internal helpers ──────────────────────────────────────────────────────

/** Verify a funnel exists and the current scope has access. Returns the id or null. */
export async function assertFunnelAccess(scope: DataScope, id: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await applyScope(
    supabase.from('funnel_pages').select('id').eq('id', id),
    scope,
  ).single();
  return data?.id ?? null;
}

// ─── Funnel page queries ───────────────────────────────────────────────────

export async function findFunnelByTarget(
  scope: DataScope,
  filter: { leadMagnetId?: string; libraryId?: string; externalResourceId?: string },
): Promise<FunnelPage | null> {
  const supabase = createSupabaseAdminClient();
  let query = applyScope(supabase.from('funnel_pages').select(FUNNEL_COLUMNS), scope);

  if (filter.leadMagnetId) query = query.eq('lead_magnet_id', filter.leadMagnetId);
  else if (filter.libraryId) query = query.eq('library_id', filter.libraryId);
  else if (filter.externalResourceId) query = query.eq('external_resource_id', filter.externalResourceId);

  const { data, error } = await query.single();
  if (error && error.code !== 'PGRST116') throw new Error(`funnels.findFunnelByTarget: ${error.message}`);
  if (!data) return null;
  return funnelPageFromRow(data as FunnelPageRow);
}

export async function findFunnelById(scope: DataScope, id: string): Promise<FunnelPage | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await applyScope(
    supabase.from('funnel_pages').select(FUNNEL_FULL_COLUMNS).eq('id', id),
    scope,
  ).single();
  if (error || !data) return null;
  return funnelPageFromRow(data as FunnelPageRow);
}

export async function findAllFunnels(scope: DataScope) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await applyScope(
    supabase
      .from('funnel_pages')
      .select(`id, slug, optin_headline, is_published, published_at, created_at, target_type, lead_magnet_id, library_id, external_resource_id, users(username), lead_magnets(title), libraries(name, icon), external_resources(title, icon)`)
      .eq('is_variant', false),
    scope,
  ).order('created_at', { ascending: false });
  if (error) throw new Error(`funnels.findAllFunnels: ${error.message}`);
  return data ?? [];
}

/** Fetch the funnel + lead_magnets join used by publish logic. */
export async function findFunnelForPublish(scope: DataScope, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await applyScope(
    supabase.from('funnel_pages').select('*, lead_magnets(id)').eq('id', id),
    scope,
  ).single();
  if (error || !data) return null;
  return data;
}

export async function findExistingSlug(
  userId: string,
  slug: string,
): Promise<Set<string>> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('funnel_pages')
    .select('slug')
    .eq('user_id', userId)
    .or(`slug.eq.${slug},slug.like.${slug}-%`);
  return new Set((data ?? []).map((r: { slug: string }) => r.slug));
}

export async function checkSlugCollision(
  scope: DataScope,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  let query = applyScope(
    supabase.from('funnel_pages').select('id').eq('slug', slug),
    scope,
  );
  if (excludeId) query = query.neq('id', excludeId);
  const { data } = await query.single();
  return !!data;
}

export async function createFunnel(row: Record<string, unknown>): Promise<FunnelPage> {
  const supabase = createSupabaseAdminClient();
  let { data, error } = await supabase.from('funnel_pages').insert(row).select().single();

  // Retry once with random suffix on unique constraint violation
  if (error?.code === '23505') {
    const slug = `${row.slug}-${Date.now().toString(36).slice(-4)}`;
    ({ data, error } = await supabase
      .from('funnel_pages')
      .insert({ ...row, slug })
      .select()
      .single());
  }

  if (error) throw new Error(`funnels.createFunnel: ${error.message}`);
  return funnelPageFromRow(data as FunnelPageRow);
}

export async function updateFunnel(
  scope: DataScope,
  id: string,
  updates: Record<string, unknown>,
): Promise<FunnelPage> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await applyScope(
    supabase.from('funnel_pages').update(updates).eq('id', id),
    scope,
  )
    .select()
    .single();
  if (error || !data) throw new Error(`funnels.updateFunnel: ${error?.message ?? 'not found'}`);
  return funnelPageFromRow(data as FunnelPageRow);
}

export async function deleteFunnel(scope: DataScope, id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  // Cascade delete related records first
  await Promise.all([
    supabase.from('qualification_questions').delete().eq('funnel_page_id', id),
    supabase.from('funnel_leads').delete().eq('funnel_page_id', id),
    supabase.from('page_views').delete().eq('funnel_page_id', id),
  ]);
  const { error } = await applyScope(
    supabase.from('funnel_pages').delete().eq('id', id),
    scope,
  );
  if (error) throw new Error(`funnels.deleteFunnel: ${error.message}`);
}

// ─── Target ownership verification ────────────────────────────────────────

export async function verifyLeadMagnetOwnership(
  userId: string,
  leadMagnetId: string,
): Promise<{ id: string; title: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('lead_magnets')
    .select('id, title')
    .eq('id', leadMagnetId)
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function verifyLibraryOwnership(
  userId: string,
  libraryId: string,
): Promise<{ id: string; name: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('libraries')
    .select('id, name')
    .eq('id', libraryId)
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function verifyExternalResourceOwnership(
  userId: string,
  externalResourceId: string,
): Promise<{ id: string; title: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('external_resources')
    .select('id, title')
    .eq('id', externalResourceId)
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function checkFunnelExistsForTarget(filter: {
  leadMagnetId?: string;
  libraryId?: string;
  externalResourceId?: string;
}): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from('funnel_pages').select('id');
  if (filter.leadMagnetId) query = query.eq('lead_magnet_id', filter.leadMagnetId);
  else if (filter.libraryId) query = query.eq('library_id', filter.libraryId);
  else if (filter.externalResourceId) query = query.eq('external_resource_id', filter.externalResourceId);
  const { data } = await query.single();
  return !!data;
}

// ─── User profile & brand kit for funnel creation ─────────────────────────

export async function getUserFunnelDefaults(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('users')
    .select('default_theme, default_primary_color, default_background_style, default_logo_url, default_vsl_url, default_funnel_template')
    .eq('id', userId)
    .single();
  return data;
}

export async function getUsernameById(userId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('users').select('username').eq('id', userId).single();
  return data?.username ?? null;
}

export async function getUserProfileForBulk(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('users')
    .select('default_theme, default_primary_color, default_background_style, default_logo_url, default_vsl_url, username')
    .eq('id', userId)
    .single();
  return data;
}

export async function getBrandKit(scope: DataScope) {
  const supabase = createSupabaseAdminClient();
  const { data } = await applyScope(
    supabase
      .from('brand_kits')
      .select('logos, default_testimonial, default_steps, default_theme, default_primary_color, default_background_style, logo_url, font_family, font_url'),
    scope,
  ).single();
  return data;
}

export async function getBrandKitForContentGen(scope: DataScope) {
  const supabase = createSupabaseAdminClient();
  const { data } = await applyScope(
    supabase.from('brand_kits').select('credibility_markers'),
    scope,
  ).single();
  return data;
}

export async function getQualificationForm(scope: DataScope, formId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await applyScope(
    supabase.from('qualification_forms').select('id').eq('id', formId),
    scope,
  ).single();
  return data;
}

// ─── Publish operations ────────────────────────────────────────────────────

export async function getLeadMagnetForPublish(userId: string, leadMagnetId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('lead_magnets')
    .select('id, extracted_content, polished_content, concept')
    .eq('id', leadMagnetId)
    .eq('user_id', userId)
    .single();
  return data;
}

export async function updateLeadMagnetPolished(
  leadMagnetId: string,
  polishedContent: unknown,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('lead_magnets')
    .update({ polished_content: polishedContent, polished_at: new Date().toISOString() })
    .eq('id', leadMagnetId);
}

export async function getLeadMagnetForContentGen(scope: DataScope, leadMagnetId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await applyScope(
    supabase.from('lead_magnets').select('title, concept, extracted_content').eq('id', leadMagnetId),
    scope,
  ).single();
  if (error || !data) return null;
  return data;
}

// ─── Section queries ───────────────────────────────────────────────────────

export async function findSections(funnelId: string): Promise<FunnelPageSection[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_page_sections')
    .select(SECTION_COLUMNS)
    .eq('funnel_page_id', funnelId)
    .order('page_location')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`funnels.findSections: ${error.message}`);
  return (data as FunnelPageSectionRow[]).map(funnelPageSectionFromRow);
}

export async function findSectionsRaw(funnelId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('funnel_page_sections')
    .select('id, section_type, config')
    .eq('funnel_page_id', funnelId);
  return data ?? [];
}

export async function getMaxSortOrder(funnelId: string, pageLocation: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('funnel_page_sections')
    .select('sort_order')
    .eq('funnel_page_id', funnelId)
    .eq('page_location', pageLocation)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();
  return (data?.sort_order ?? -1) + 1;
}

export async function getSectionType(sectionId: string, funnelId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('funnel_page_sections')
    .select('section_type')
    .eq('id', sectionId)
    .eq('funnel_page_id', funnelId)
    .single();
  return data?.section_type ?? null;
}

export async function createSection(row: {
  funnel_page_id: string;
  section_type: string;
  page_location: string;
  sort_order: number;
  is_visible: boolean;
  config: Record<string, unknown>;
}): Promise<FunnelPageSection> {
  const normalizedConfig = normalizeSectionConfigImageUrls(
    row.section_type,
    row.config,
  );
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_page_sections')
    .insert({ ...row, config: normalizedConfig })
    .select()
    .single();
  if (error) throw new Error(`funnels.createSection: ${error.message}`);
  return funnelPageSectionFromRow(data as FunnelPageSectionRow);
}

export async function updateSection(
  sectionId: string,
  funnelId: string,
  updates: Record<string, unknown>,
): Promise<FunnelPageSection> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_page_sections')
    .update(updates)
    .eq('id', sectionId)
    .eq('funnel_page_id', funnelId)
    .select()
    .single();
  if (error) throw new Error(`funnels.updateSection: ${error.message}`);
  return funnelPageSectionFromRow(data as FunnelPageSectionRow);
}

export async function deleteSection(sectionId: string, funnelId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('funnel_page_sections')
    .delete()
    .eq('id', sectionId)
    .eq('funnel_page_id', funnelId);
  if (error) throw new Error(`funnels.deleteSection: ${error.message}`);
}

export async function insertSections(rows: {
  funnel_page_id: string;
  section_type: string;
  page_location: string;
  sort_order: number;
  is_visible: boolean;
  config: Record<string, unknown>;
}[]): Promise<FunnelPageSection[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('funnel_page_sections').insert(rows).select();
  if (error) throw new Error(`funnels.insertSections: ${error.message}`);
  return (data as FunnelPageSectionRow[]).map(funnelPageSectionFromRow);
}

export async function deleteSectionsByLocation(funnelId: string, pageLocation: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('funnel_page_sections')
    .delete()
    .eq('funnel_page_id', funnelId)
    .eq('page_location', pageLocation);
}

export async function updateSectionConfig(sectionId: string, config: Record<string, unknown>): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from('funnel_page_sections').update({ config }).eq('id', sectionId);
}

// ─── Question queries ──────────────────────────────────────────────────────

export async function findQuestionsForFunnel(funnelId: string, formId: string | null) {
  const supabase = createSupabaseAdminClient();
  const { questions, error } = await resolveQuestionsForFunnel(supabase, funnelId, formId);
  return { questions, error };
}

export async function findFunnelFormId(
  scope: DataScope,
  funnelId: string,
): Promise<{ id: string; qualification_form_id: string | null } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await applyScope(
    supabase.from('funnel_pages').select('id, qualification_form_id').eq('id', funnelId),
    scope,
  ).single();
  return data ?? null;
}

export async function getMaxQuestionOrder(funnelId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('qualification_questions')
    .select('question_order')
    .eq('funnel_page_id', funnelId)
    .order('question_order', { ascending: false })
    .limit(1)
    .single();
  return (data?.question_order ?? -1) + 1;
}

export async function createQuestion(row: Record<string, unknown>): Promise<QualificationQuestion> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('qualification_questions')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(`funnels.createQuestion: ${error.message}`);
  return qualificationQuestionFromRow(data as QualificationQuestionRow);
}

export async function updateQuestion(
  questionId: string,
  funnelId: string,
  formId: string | null,
  updates: Record<string, unknown>,
): Promise<QualificationQuestion> {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from('qualification_questions').update(updates).eq('id', questionId);
  if (formId) query = query.eq('form_id', formId);
  else query = query.eq('funnel_page_id', funnelId);
  const { data, error } = await query.select().single();
  if (error) throw new Error(`funnels.updateQuestion: ${error.message}`);
  return qualificationQuestionFromRow(data as QualificationQuestionRow);
}

export async function deleteQuestion(
  questionId: string,
  funnelId: string,
  formId: string | null,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from('qualification_questions').delete().eq('id', questionId);
  if (formId) query = query.eq('form_id', formId);
  else query = query.eq('funnel_page_id', funnelId);
  const { error } = await query;
  if (error) throw new Error(`funnels.deleteQuestion: ${error.message}`);
}

export async function reorderQuestions(
  questionIds: string[],
  funnelId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const updates = questionIds.map((qId, idx) =>
    supabase
      .from('qualification_questions')
      .update({ question_order: idx })
      .eq('id', qId)
      .eq('funnel_page_id', funnelId),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`funnels.reorderQuestions: ${failed.error.message}`);
}

// ─── Stats queries ─────────────────────────────────────────────────────────

export async function getFunnelIds(scope: DataScope): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await applyScope(supabase.from('funnel_pages').select('id'), scope);
  return (data ?? []).map((f: { id: string }) => f.id);
}

export async function getFunnelLeads(userId: string, funnelIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_leads')
    .select('funnel_page_id, is_qualified')
    .eq('user_id', userId)
    .in('funnel_page_id', funnelIds);
  return { data: data ?? [], error };
}

export async function getPageViews(funnelIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('page_views')
    .select('funnel_page_id')
    .in('funnel_page_id', funnelIds);
  return { data: data ?? [], error };
}

// ─── Integration queries ───────────────────────────────────────────────────

export async function findFunnelIntegrations(userId: string, funnelPageId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_integrations')
    .select(INTEGRATION_COLUMNS)
    .eq('funnel_page_id', funnelPageId)
    .eq('user_id', userId);
  if (error) throw new Error(`funnels.findFunnelIntegrations: ${error.message}`);
  return data ?? [];
}

export async function upsertFunnelIntegration(row: {
  funnel_page_id: string;
  user_id: string;
  provider: string;
  list_id: string;
  list_name: string | null;
  tag_id: string | null;
  tag_name: string | null;
  is_active: boolean;
  settings: unknown | null;
  updated_at: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_integrations')
    .upsert(row, { onConflict: 'funnel_page_id,provider' })
    .select(INTEGRATION_COLUMNS)
    .single();
  if (error) throw new Error(`funnels.upsertFunnelIntegration: ${error.message}`);
  return data;
}

export async function deleteFunnelIntegration(
  userId: string,
  funnelPageId: string,
  provider: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('funnel_integrations')
    .delete()
    .eq('funnel_page_id', funnelPageId)
    .eq('user_id', userId)
    .eq('provider', provider);
  if (error) throw new Error(`funnels.deleteFunnelIntegration: ${error.message}`);
}

// ─── Bulk creation helpers ─────────────────────────────────────────────────

export async function createLeadMagnet(row: {
  user_id: string;
  title: string;
  external_url: string;
  archetype: string;
  status: string;
}): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('lead_magnets').insert(row).select('id').single();
  return data;
}

export async function deleteLeadMagnet(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from('lead_magnets').delete().eq('id', id);
}

export { normalizeImageUrl };
