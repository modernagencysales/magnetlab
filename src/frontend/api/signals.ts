/**
 * Signals API (client). Routes: /api/signals/config, keywords, companies, leads
 */

import { apiClient } from './client';

// ── Config ──
export async function getSignalsConfig(): Promise<{ config: unknown }> {
  return apiClient.get<{ config: unknown }>('/signals/config');
}

export async function updateSignalsConfig(
  body: Record<string, unknown>
): Promise<{ config: unknown }> {
  return apiClient.put<{ config: unknown }>('/signals/config', body);
}

// ── Keywords ──
export async function listSignalKeywords(): Promise<{ keywords: unknown[] }> {
  return apiClient.get<{ keywords: unknown[] }>('/signals/keywords');
}

export async function createSignalKeyword(keyword: string): Promise<{ keyword: unknown }> {
  return apiClient.post<{ keyword: unknown }>('/signals/keywords', { keyword });
}

export async function updateSignalKeyword(
  id: string,
  body: { is_active?: boolean }
): Promise<{ keyword: unknown }> {
  return apiClient.patch<{ keyword: unknown }>(`/signals/keywords/${id}`, body);
}

export async function deleteSignalKeyword(id: string): Promise<void> {
  await apiClient.delete(`/signals/keywords/${id}`);
}

// ── Companies ──
export async function listSignalCompanies(): Promise<{ companies: unknown[] }> {
  return apiClient.get<{ companies: unknown[] }>('/signals/companies');
}

export async function createSignalCompany(body: {
  linkedin_company_url: string;
  heyreach_campaign_id?: string | null;
}): Promise<{ company: unknown }> {
  return apiClient.post<{ company: unknown }>('/signals/companies', body);
}

export async function updateSignalCompany(
  id: string,
  body: { is_active?: boolean; heyreach_campaign_id?: string | null }
): Promise<{ company: unknown }> {
  return apiClient.patch<{ company: unknown }>(`/signals/companies/${id}`, body);
}

export async function deleteSignalCompany(id: string): Promise<void> {
  await apiClient.delete(`/signals/companies/${id}`);
}

// ── Leads ──
export interface ListSignalLeadsParams {
  status?: string;
  icp_match?: string;
  signal_type?: string;
  min_score?: number;
  page?: number;
  limit?: number;
}

export async function listSignalLeads(
  params: ListSignalLeadsParams = {}
): Promise<{ leads: unknown[]; total: number; page: number; limit: number }> {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.icp_match) sp.set('icp_match', params.icp_match);
  if (params.signal_type) sp.set('signal_type', params.signal_type);
  if (params.min_score != null) sp.set('min_score', String(params.min_score));
  if (params.page != null) sp.set('page', String(params.page));
  if (params.limit != null) sp.set('limit', String(params.limit));
  const query = sp.toString();
  return apiClient.get<{
    leads: unknown[];
    total: number;
    page: number;
    limit: number;
  }>(`/signals/leads${query ? `?${query}` : ''}`);
}

export async function bulkSignalLeadsAction(body: {
  action: 'exclude' | 'push';
  lead_ids: string[];
  campaign_id?: string;
}): Promise<{ success: boolean; excluded?: number; added?: number }> {
  return apiClient.post<{ success: boolean; excluded?: number; added?: number }>(
    '/signals/leads',
    body
  );
}
