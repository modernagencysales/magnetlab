/**
 * Creative Strategy Signals Repository
 * ALL Supabase queries for cs_signals and cs_scrape_config.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

import type { CsSignal, CsScrapeConfig, SignalFilters } from '@/lib/types/creative-strategy';

// ─── Column sets ────────────────────────────────────────────────────────────

const SIGNAL_COLUMNS =
  'id, source, source_account_id, linkedin_url, author_name, author_headline, author_follower_count, content, media_type, media_description, media_urls, impressions, likes, comments, shares, engagement_multiplier, niche, status, ai_analysis, submitted_by, created_at';

const CONFIG_COLUMNS =
  'id, config_type, outlier_threshold_multiplier, min_reactions, min_comments, target_niches, search_keywords, active';

// ─── Signal reads ───────────────────────────────────────────────────────────

export async function findSignals(
  filters: SignalFilters
): Promise<{ data: CsSignal[]; count: number }> {
  const supabase = createSupabaseAdminClient();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  let query = supabase
    .from('cs_signals')
    .select(SIGNAL_COLUMNS, { count: 'exact' })
    .order('engagement_multiplier', { ascending: false, nullsFirst: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.source) query = query.eq('source', filters.source);
  if (filters.niche) query = query.eq('niche', filters.niche);
  if (filters.min_multiplier) query = query.gte('engagement_multiplier', filters.min_multiplier);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`cs-signals.findSignals: ${error.message}`);
  return { data: (data ?? []) as CsSignal[], count: count ?? 0 };
}

export async function findSignalById(id: string): Promise<CsSignal | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_signals')
    .select(SIGNAL_COLUMNS)
    .eq('id', id)
    .single();
  if (error) return null;
  return data as CsSignal;
}

export async function findSignalByUrl(url: string): Promise<CsSignal | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_signals')
    .select(SIGNAL_COLUMNS)
    .eq('linkedin_url', url)
    .single();
  if (error) return null;
  return data as CsSignal;
}

// ─── Signal writes ──────────────────────────────────────────────────────────

export async function createSignal(
  insert: Omit<CsSignal, 'id' | 'created_at' | 'ai_analysis'>
): Promise<CsSignal> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_signals')
    .insert(insert)
    .select(SIGNAL_COLUMNS)
    .single();
  if (error) throw new Error(`cs-signals.createSignal: ${error.message}`);
  return data as CsSignal;
}

export async function updateSignalStatus(id: string, status: string): Promise<CsSignal> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_signals')
    .update({ status })
    .eq('id', id)
    .select(SIGNAL_COLUMNS)
    .single();
  if (error) throw new Error(`cs-signals.updateSignalStatus: ${error.message}`);
  return data as CsSignal;
}

export async function updateSignalAnalysis(
  id: string,
  ai_analysis: Record<string, unknown>
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cs_signals').update({ ai_analysis }).eq('id', id);
  if (error) throw new Error(`cs-signals.updateSignalAnalysis: ${error.message}`);
}

// ─── Config reads ───────────────────────────────────────────────────────────

export async function findScrapeConfigs(): Promise<CsScrapeConfig[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('cs_scrape_config').select(CONFIG_COLUMNS);
  if (error) throw new Error(`cs-signals.findScrapeConfigs: ${error.message}`);
  return (data ?? []) as CsScrapeConfig[];
}

export async function findScrapeConfigByType(configType: string): Promise<CsScrapeConfig | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_scrape_config')
    .select(CONFIG_COLUMNS)
    .eq('config_type', configType)
    .single();
  if (error) return null;
  return data as CsScrapeConfig;
}

// ─── Config writes ──────────────────────────────────────────────────────────

export async function upsertScrapeConfig(
  config: Omit<CsScrapeConfig, 'id'>
): Promise<CsScrapeConfig> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_scrape_config')
    .upsert(config, { onConflict: 'config_type' })
    .select(CONFIG_COLUMNS)
    .single();
  if (error) throw new Error(`cs-signals.upsertScrapeConfig: ${error.message}`);
  return data as CsScrapeConfig;
}
