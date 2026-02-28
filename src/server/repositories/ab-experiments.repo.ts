/**
 * A/B Experiments Repository (ab_experiments, funnel_pages variants, page_views, funnel_leads)
 * ALL Supabase queries for A/B experiments live here.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const EXPERIMENT_COLUMNS =
  'id, funnel_page_id, name, status, test_field, winner_id, significance, min_sample_size, started_at, completed_at, created_at';

export const CLONE_FIELDS = [
  'lead_magnet_id',
  'user_id',
  'team_id',
  'optin_headline',
  'optin_subline',
  'optin_button_text',
  'optin_social_proof',
  'thankyou_headline',
  'thankyou_subline',
  'vsl_url',
  'calendly_url',
  'qualification_pass_message',
  'qualification_fail_message',
  'theme',
  'primary_color',
  'background_style',
  'logo_url',
  'qualification_form_id',
  'font_family',
  'font_url',
  'target_type',
  'library_id',
  'external_resource_id',
] as const;

export type CloneField = (typeof CLONE_FIELDS)[number];

export interface ExperimentRow {
  id: string;
  funnel_page_id: string;
  name: string;
  status: string;
  test_field: string;
  winner_id: string | null;
  significance: number | null;
  min_sample_size: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ControlFunnelRow {
  id: string;
  slug: string;
  lead_magnet_id: string | null;
  user_id: string;
  team_id: string | null;
  [key: string]: unknown;
}

export async function listExperiments(userId: string, funnelPageId?: string): Promise<ExperimentRow[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('ab_experiments')
    .select(EXPERIMENT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (funnelPageId) query = query.eq('funnel_page_id', funnelPageId);
  const { data, error } = await query;
  if (error) throw new Error(`ab-experiments.listExperiments: ${error.message}`);
  return (data ?? []) as ExperimentRow[];
}

export async function getControlFunnelPage(funnelPageId: string, userId: string): Promise<ControlFunnelRow | null> {
  const supabase = createSupabaseAdminClient();
  const cols = CLONE_FIELDS.join(', ');
  const { data, error } = await supabase
    .from('funnel_pages')
    .select(`id, slug, ${cols}`)
    .eq('id', funnelPageId)
    .eq('user_id', userId)
    .eq('is_variant', false)
    .single();
  if (error || !data) return null;
  return data as unknown as ControlFunnelRow;
}

export async function hasActiveExperiment(funnelPageId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('ab_experiments')
    .select('id')
    .eq('funnel_page_id', funnelPageId)
    .in('status', ['draft', 'running'])
    .limit(1);
  return !!(data && data.length > 0);
}

export async function createExperiment(
  userId: string,
  payload: { funnelPageId: string; name: string; testField: string }
): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ab_experiments')
    .insert({
      funnel_page_id: payload.funnelPageId,
      user_id: userId,
      name: payload.name,
      test_field: payload.testField,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw new Error(`ab-experiments.createExperiment: ${error.message}`);
  return data as { id: string };
}

export async function createVariantPage(row: Record<string, unknown>): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('funnel_pages').insert(row).select('id').single();
  if (error) throw new Error(`ab-experiments.createVariantPage: ${error.message}`);
  return data as { id: string };
}

export async function linkControlToExperiment(funnelPageId: string, experimentId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('funnel_pages')
    .update({ experiment_id: experimentId })
    .eq('id', funnelPageId);
  if (error) throw new Error(`ab-experiments.linkControlToExperiment: ${error.message}`);
}

export async function deleteExperimentById(experimentId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('ab_experiments').delete().eq('id', experimentId);
  if (error) throw new Error(`ab-experiments.deleteExperimentById: ${error.message}`);
}

// ─── [id] GET / PATCH / DELETE ─────────────────────────────────────────────

export async function getExperimentById(id: string, userId: string): Promise<ExperimentRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ab_experiments')
    .select(EXPERIMENT_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data as ExperimentRow;
}

export interface VariantRow {
  id: string;
  is_variant: boolean;
  variant_label: string | null;
  thankyou_headline: string;
  thankyou_subline: string | null;
  vsl_url: string | null;
  qualification_pass_message: string;
}

export async function getVariantsForExperiment(experimentId: string, controlPageId: string): Promise<VariantRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('id, is_variant, variant_label, thankyou_headline, thankyou_subline, vsl_url, qualification_pass_message')
    .or(`id.eq.${controlPageId},experiment_id.eq.${experimentId}`);
  if (error) throw new Error(`ab-experiments.getVariantsForExperiment: ${error.message}`);
  return (data ?? []) as VariantRow[];
}

export async function getPageViewCountsByFunnelPage(variantIds: string[]): Promise<Record<string, number>> {
  if (variantIds.length === 0) return {};
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('page_views')
    .select('funnel_page_id')
    .in('funnel_page_id', variantIds)
    .eq('page_type', 'thankyou');
  if (error) throw new Error(`ab-experiments.getPageViewCountsByFunnelPage: ${error.message}`);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const fid = (row as { funnel_page_id: string }).funnel_page_id;
    counts[fid] = (counts[fid] ?? 0) + 1;
  }
  return counts;
}

export async function getFunnelLeadCountsByFunnelPage(variantIds: string[]): Promise<Record<string, number>> {
  if (variantIds.length === 0) return {};
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_leads')
    .select('funnel_page_id')
    .in('funnel_page_id', variantIds)
    .not('qualification_answers', 'is', null);
  if (error) throw new Error(`ab-experiments.getFunnelLeadCountsByFunnelPage: ${error.message}`);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const fid = (row as { funnel_page_id: string }).funnel_page_id;
    counts[fid] = (counts[fid] ?? 0) + 1;
  }
  return counts;
}

export async function updateExperimentStatus(
  experimentId: string,
  updates: { status: string; completed_at?: string; winner_id?: string; updated_at?: string }
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('ab_experiments').update(updates).eq('id', experimentId);
  if (error) throw new Error(`ab-experiments.updateExperimentStatus: ${error.message}`);
}

export async function getWinnerPage(
  winnerId: string,
  experimentId: string,
  controlPageId: string
): Promise<{ id: string; is_variant: boolean; [key: string]: unknown } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('id, is_variant, thankyou_headline, thankyou_subline, vsl_url, qualification_pass_message')
    .eq('id', winnerId)
    .or(`id.eq.${controlPageId},experiment_id.eq.${experimentId}`)
    .single();
  if (error || !data) return null;
  return data as { id: string; is_variant: boolean; [key: string]: unknown };
}

export async function updateFunnelPageField(pageId: string, field: string, value: unknown): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('funnel_pages').update({ [field]: value }).eq('id', pageId);
  if (error) throw new Error(`ab-experiments.updateFunnelPageField: ${error.message}`);
}

export async function unpublishVariantsAndClearExperiment(experimentId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('funnel_pages')
    .update({ is_published: false, experiment_id: null })
    .eq('experiment_id', experimentId)
    .eq('is_variant', true);
}

export async function clearControlExperimentId(funnelPageId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('funnel_pages')
    .update({ experiment_id: null })
    .eq('id', funnelPageId);
  if (error) throw new Error(`ab-experiments.clearControlExperimentId: ${error.message}`);
}

export async function deleteVariantPages(experimentId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('funnel_pages')
    .delete()
    .eq('experiment_id', experimentId)
    .eq('is_variant', true);
  if (error) throw new Error(`ab-experiments.deleteVariantPages: ${error.message}`);
}

export async function getExperimentForDelete(experimentId: string, userId: string): Promise<{ id: string; funnel_page_id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('ab_experiments')
    .select('id, funnel_page_id')
    .eq('id', experimentId)
    .eq('user_id', userId)
    .single();
  return data as { id: string; funnel_page_id: string } | null;
}

// ─── suggest: funnel page + lead magnet context ─────────────────────────────

export async function getFunnelPageForSuggest(funnelPageId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('id, lead_magnet_id, thankyou_headline, thankyou_subline, vsl_url, qualification_pass_message')
    .eq('id', funnelPageId)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function getLeadMagnetContext(leadMagnetId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('lead_magnets')
    .select('title, archetype, concept')
    .eq('id', leadMagnetId)
    .single();
  if (!data) return '';
  const lm = data as { title?: string; archetype?: string; concept?: unknown };
  return [
    lm.title ? `Lead Magnet Title: ${lm.title}` : '',
    lm.archetype ? `Archetype: ${lm.archetype}` : '',
    lm.concept ? `Concept: ${JSON.stringify(lm.concept)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
