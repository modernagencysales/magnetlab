/**
 * Signals Service
 * Keyword monitors, company monitors, signal leads, signal config.
 */

import { logError } from '@/lib/utils/logger';
import { pushLeadsToHeyReach } from '@/lib/integrations/heyreach/client';
import type { SignalType } from '@/lib/types/signals';
import * as signalsRepo from '@/server/repositories/signals.repo';

const MAX_KEYWORDS = 20;
const MAX_COMPANIES = 10;
const MAX_LEADS_BULK = 200;

// ─── Keywords ─────────────────────────────────────────────────────────────

export async function listKeywords(userId: string) {
  const { data, error } = await signalsRepo.listKeywordMonitors(userId);
  if (error) {
    logError('api/signals/keywords', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const, keywords: data ?? [] };
}

export async function createKeyword(userId: string, keyword: string) {
  const trimmed = keyword?.trim();
  if (!trimmed || trimmed.length < 2) {
    return { success: false as const, error: 'validation' as const, message: 'Keyword must be at least 2 characters' };
  }
  const { count } = await signalsRepo.countKeywordMonitors(userId);
  if (count >= MAX_KEYWORDS) {
    return { success: false as const, error: 'limit' as const, message: `Maximum ${MAX_KEYWORDS} keyword monitors allowed` };
  }
  const { data, error } = await signalsRepo.createKeywordMonitor(userId, trimmed);
  if (error) {
    if (error.code === '23505') {
      return { success: false as const, error: 'conflict' as const, message: 'Keyword already being monitored' };
    }
    logError('api/signals/keywords', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const, keyword: data };
}

export async function updateKeyword(userId: string, id: string, body: { is_active?: boolean }) {
  const { data, error } = await signalsRepo.updateKeywordMonitor(id, userId, { is_active: body.is_active });
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false as const, error: 'not_found' as const };
    }
    logError('api/signals/keywords/[id]', error);
    return { success: false as const, error: 'database' as const };
  }
  if (!data) return { success: false as const, error: 'not_found' as const };
  return { success: true as const, keyword: data };
}

export async function deleteKeyword(userId: string, id: string) {
  const { error } = await signalsRepo.deleteKeywordMonitor(id, userId);
  if (error) {
    logError('api/signals/keywords/[id]', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const };
}

// ─── Companies ─────────────────────────────────────────────────────────────

export async function listCompanies(userId: string) {
  const { data, error } = await signalsRepo.listCompanyMonitors(userId);
  if (error) {
    logError('api/signals/companies', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const, companies: data ?? [] };
}

export async function createCompany(
  userId: string,
  payload: { linkedin_company_url: string; heyreach_campaign_id?: string | null }
) {
  const url = payload.linkedin_company_url?.trim();
  if (!url || !url.includes('linkedin.com/company/')) {
    return { success: false as const, error: 'validation' as const, message: 'Must be a LinkedIn company URL (must contain linkedin.com/company/)' };
  }
  const { count } = await signalsRepo.countCompanyMonitors(userId);
  if (count >= MAX_COMPANIES) {
    return { success: false as const, error: 'limit' as const, message: `Maximum ${MAX_COMPANIES} company monitors allowed` };
  }
  const { data, error } = await signalsRepo.createCompanyMonitor(userId, { linkedin_company_url: url, heyreach_campaign_id: payload.heyreach_campaign_id ?? null });
  if (error) {
    if (error.code === '23505') {
      return { success: false as const, error: 'conflict' as const, message: 'Company already being monitored' };
    }
    logError('api/signals/companies', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const, company: data };
}

export async function updateCompany(
  userId: string,
  id: string,
  body: { is_active?: boolean; heyreach_campaign_id?: string | null }
) {
  const updates: { is_active?: boolean; heyreach_campaign_id?: string | null } = {};
  if ('is_active' in body) updates.is_active = body.is_active;
  if ('heyreach_campaign_id' in body) updates.heyreach_campaign_id = body.heyreach_campaign_id ?? null;
  if (Object.keys(updates).length === 0) {
    return { success: false as const, error: 'validation' as const, message: 'No valid fields provided' };
  }
  const { data, error } = await signalsRepo.updateCompanyMonitor(id, userId, updates);
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false as const, error: 'not_found' as const };
    }
    logError('api/signals/companies/[id]', error);
    return { success: false as const, error: 'database' as const };
  }
  if (!data) return { success: false as const, error: 'not_found' as const };
  return { success: true as const, company: data };
}

export async function deleteCompany(userId: string, id: string) {
  const { error } = await signalsRepo.deleteCompanyMonitor(id, userId);
  if (error) {
    logError('api/signals/companies/[id]', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const };
}

// ─── Leads ─────────────────────────────────────────────────────────────────

export async function listLeads(
  userId: string,
  filters: {
    status?: string | null;
    icpMatch?: string | null;
    signalType?: SignalType | null;
    minScore?: string | null;
  },
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit;
  const limitClamped = Math.min(100, Math.max(1, limit));
  const minScoreNum = filters.minScore != null ? parseInt(filters.minScore, 10) : undefined;

  const { data: leads, error, count } = await signalsRepo.listSignalLeads(
    userId,
    {
      status: filters.status ?? undefined,
      icpMatch: filters.icpMatch ?? undefined,
      minScore: minScoreNum !== undefined && !isNaN(minScoreNum) ? minScoreNum : undefined,
      signalType: filters.signalType ?? null,
    },
    { offset, limit: limitClamped }
  );

  if (error) {
    logError('api/signals/leads', error, { userId });
    return { success: false as const, error: 'database' as const };
  }

  let filteredLeads = leads ?? [];
  let total = count;

  if (filters.signalType) {
    filteredLeads = filteredLeads.filter((lead) => {
      const events = (lead as Record<string, unknown>).signal_events as Array<{ signal_type: string }> | undefined;
      return events?.some((e) => e.signal_type === filters.signalType) ?? false;
    });
    total = filteredLeads.length;
  }

  return {
    success: true as const,
    leads: filteredLeads,
    total,
    page,
    limit: limitClamped,
  };
}

export async function bulkExcludeLeads(userId: string, leadIds: string[]) {
  const { error } = await signalsRepo.updateLeadsStatus(leadIds, userId, 'excluded');
  if (error) {
    logError('api/signals/leads/exclude', error, { userId });
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const, excluded: leadIds.length };
}

export async function bulkPushLeads(
  userId: string,
  leadIds: string[],
  campaignId: string
) {
  const { data: leads, error: fetchError } = await signalsRepo.getLeadsByIds(leadIds, userId);
  if (fetchError) {
    logError('api/signals/leads/push-fetch', fetchError, { userId });
    return { success: false as const, error: 'database' as const };
  }
  if (!leads || leads.length === 0) {
    return { success: false as const, error: 'not_found' as const, message: 'No matching leads found' };
  }

  const heyreachLeads = leads.map((lead) => ({
    profileUrl: lead.linkedin_url.endsWith('/') ? lead.linkedin_url : `${lead.linkedin_url}/`,
    firstName: lead.first_name || undefined,
    lastName: lead.last_name || undefined,
    customVariables: {
      compound_score: String(lead.compound_score ?? 0),
      signal_count: String(lead.signal_count ?? 0),
      headline: lead.headline || '',
    },
  }));

  const result = await pushLeadsToHeyReach(campaignId, heyreachLeads);

  if (result.success) {
    await signalsRepo.updateLeadsPushed(leads.map((l) => l.id), userId, campaignId);
    return { success: true as const, added: result.added };
  }

  await signalsRepo.updateLeadsPushError(
    leads.map((l) => l.id),
    userId,
    result.error || 'Unknown push error'
  );
  return { success: false as const, added: 0, error: result.error };
}

// ─── Config ────────────────────────────────────────────────────────────────

export async function getConfig(userId: string) {
  const { data, error } = await signalsRepo.getSignalConfig(userId);
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: true as const, config: null };
    }
    logError('api/signals/config', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const, config: data };
}

export async function upsertConfig(
  userId: string,
  body: {
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
  const { data, error } = await signalsRepo.upsertSignalConfig(userId, body);
  if (error) {
    logError('api/signals/config', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const, config: data };
}
