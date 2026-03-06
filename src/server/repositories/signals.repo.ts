/**
 * Signals Repository
 * signal_keyword_monitors, signal_company_monitors, signal_leads, signal_events, signal_configs.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Keywords ─────────────────────────────────────────────────────────────

export async function listKeywordMonitors(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('signal_keyword_monitors')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function countKeywordMonitors(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('signal_keyword_monitors')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return { count: count ?? 0, error };
}

export async function createKeywordMonitor(userId: string, keyword: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('signal_keyword_monitors')
    .insert({ user_id: userId, keyword })
    .select()
    .single();
  return { data, error };
}

export async function updateKeywordMonitor(
  id: string,
  userId: string,
  updates: { is_active?: boolean }
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('signal_keyword_monitors')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
}

export async function deleteKeywordMonitor(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('signal_keyword_monitors')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  return { error };
}

// ─── Companies ─────────────────────────────────────────────────────────────

export async function listCompanyMonitors(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('signal_company_monitors')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function countCompanyMonitors(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('signal_company_monitors')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return { count: count ?? 0, error };
}

export async function createCompanyMonitor(
  userId: string,
  payload: { linkedin_company_url: string; heyreach_campaign_id?: string | null }
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('signal_company_monitors')
    .insert({
      user_id: userId,
      linkedin_company_url: payload.linkedin_company_url,
      heyreach_campaign_id: payload.heyreach_campaign_id ?? null,
    })
    .select()
    .single();
  return { data, error };
}

export async function updateCompanyMonitor(
  id: string,
  userId: string,
  updates: { is_active?: boolean; heyreach_campaign_id?: string | null }
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('signal_company_monitors')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
}

export async function deleteCompanyMonitor(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('signal_company_monitors')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  return { error };
}

// ─── Leads ─────────────────────────────────────────────────────────────────

export async function listSignalLeads(
  userId: string,
  filters: {
    status?: string;
    icpMatch?: string;
    minScore?: number;
    signalType?: string | null;
  },
  range: { offset: number; limit: number }
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('signal_leads')
    .select(
      '*, signal_events(id, signal_type, comment_text, sentiment, keyword_matched, detected_at)',
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .order('compound_score', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.icpMatch === 'true') query = query.eq('icp_match', true);
  if (filters.icpMatch === 'false') query = query.eq('icp_match', false);
  if (filters.minScore != null) query = query.gte('compound_score', filters.minScore);

  const { data, error, count } = await query.range(range.offset, range.offset + range.limit - 1);
  return { data, error, count: count ?? 0 };
}

export async function updateLeadsStatus(leadIds: string[], userId: string, status: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('signal_leads')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', leadIds)
    .eq('user_id', userId);
  return { error };
}

export async function getLeadsByIds(leadIds: string[], userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('signal_leads')
    .select('id, linkedin_url, first_name, last_name, headline, compound_score, signal_count')
    .in('id', leadIds)
    .eq('user_id', userId);
  return { data, error };
}

export async function updateLeadsPushed(leadIds: string[], userId: string, campaignId: string) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('signal_leads')
    .update({
      status: 'pushed',
      heyreach_campaign_id: campaignId,
      heyreach_pushed_at: now,
      heyreach_error: null,
      updated_at: now,
    })
    .in('id', leadIds)
    .eq('user_id', userId);
  return { error };
}

export async function updateLeadsPushError(
  leadIds: string[],
  userId: string,
  errorMessage: string
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('signal_leads')
    .update({
      heyreach_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .in('id', leadIds)
    .eq('user_id', userId);
  return { error };
}

// ─── Config ────────────────────────────────────────────────────────────────

export async function getSignalConfig(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('signal_configs')
    .select('*')
    .eq('user_id', userId)
    .single();
  return { data, error };
}

// ─── Lead + Event upserts (used by signal-engine service) ──────────────────

export async function upsertSignalLeadRecord(lead: {
  user_id: string;
  linkedin_url: string;
  first_name?: string | null;
  last_name?: string | null;
  headline?: string | null;
  job_title?: string | null;
  company?: string | null;
  country?: string | null;
}): Promise<{ id: string | null; error: string | null }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('signal_leads')
    .upsert(
      {
        user_id: lead.user_id,
        linkedin_url: lead.linkedin_url,
        first_name: lead.first_name ?? null,
        last_name: lead.last_name ?? null,
        headline: lead.headline ?? null,
        job_title: lead.job_title ?? null,
        company: lead.company ?? null,
        country: lead.country ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,linkedin_url' }
    )
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null, error: null };
}

export async function upsertSignalEventRecord(event: {
  user_id: string;
  lead_id: string;
  signal_type: string;
  source_url?: string | null;
  source_monitor_id?: string | null;
  comment_text?: string | null;
  sentiment?: string | null;
  keyword_matched?: string | null;
  engagement_type?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ error: string | null }> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('signal_events').upsert(
    {
      user_id: event.user_id,
      lead_id: event.lead_id,
      signal_type: event.signal_type,
      source_url: event.source_url ?? null,
      source_monitor_id: event.source_monitor_id ?? null,
      comment_text: event.comment_text ?? null,
      sentiment: event.sentiment ?? null,
      keyword_matched: event.keyword_matched ?? null,
      engagement_type: event.engagement_type ?? null,
      metadata: event.metadata ?? {},
      detected_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lead_id,signal_type,source_url', ignoreDuplicates: true }
  );
  if (error) return { error: error.message };
  return { error: null };
}

export async function findSignalEventsByLead(
  userId: string,
  leadId: string
): Promise<{
  data: Array<{ signal_type: string; sentiment: string | null }> | null;
  error: string | null;
}> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('signal_events')
    .select('signal_type, sentiment')
    .eq('user_id', userId)
    .eq('lead_id', leadId);
  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

export async function updateSignalLeadScores(
  userId: string,
  leadId: string,
  scores: { signal_count: number; compound_score: number; sentiment_score: string | null }
): Promise<{ error: string | null }> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('signal_leads')
    .update({
      signal_count: scores.signal_count,
      compound_score: scores.compound_score,
      sentiment_score: scores.sentiment_score,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('user_id', userId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function upsertSignalConfig(
  userId: string,
  payload: {
    target_countries?: string[];
    target_job_titles?: string[];
    exclude_job_titles?: string[];
    min_company_size?: number | null;
    max_company_size?: number | null;
    target_industries?: string[];
    default_heyreach_campaign_id?: string | null;
    enrichment_enabled?: boolean;
    sentiment_scoring_enabled?: boolean;
    auto_push_enabled?: boolean;
  }
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('signal_configs')
    .upsert(
      {
        user_id: userId,
        target_countries: payload.target_countries ?? [],
        target_job_titles: payload.target_job_titles ?? [],
        exclude_job_titles: payload.exclude_job_titles ?? [],
        min_company_size: payload.min_company_size ?? null,
        max_company_size: payload.max_company_size ?? null,
        target_industries: payload.target_industries ?? [],
        default_heyreach_campaign_id: payload.default_heyreach_campaign_id ?? null,
        enrichment_enabled: payload.enrichment_enabled ?? true,
        sentiment_scoring_enabled: payload.sentiment_scoring_enabled ?? true,
        auto_push_enabled: payload.auto_push_enabled ?? false,
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  return { data, error };
}
