/**
 * Leads API (client). Routes: /api/leads, /api/leads/export
 */

import { apiClient } from './client';

export interface ListLeadsParams {
  funnelId?: string;
  leadMagnetId?: string;
  qualified?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listLeads(params: ListLeadsParams = {}): Promise<{
  leads: unknown[];
  total: number;
}> {
  const sp = new URLSearchParams();
  if (params.funnelId) sp.set('funnelId', params.funnelId);
  if (params.leadMagnetId) sp.set('leadMagnetId', params.leadMagnetId);
  if (params.qualified === true) sp.set('qualified', 'true');
  if (params.qualified === false) sp.set('qualified', 'false');
  if (params.search) sp.set('search', params.search);
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  const query = sp.toString();
  return apiClient.get<{ leads: unknown[]; total: number }>(
    `/leads${query ? `?${query}` : ''}`
  );
}

/** Export leads as CSV; returns blob and suggested filename from Content-Disposition. */
export async function exportLeads(params: {
  funnelId?: string;
  leadMagnetId?: string;
  qualified?: boolean;
}): Promise<{ blob: Blob; filename: string }> {
  const sp = new URLSearchParams();
  if (params.funnelId) sp.set('funnelId', params.funnelId);
  if (params.leadMagnetId) sp.set('leadMagnetId', params.leadMagnetId);
  if (params.qualified === true) sp.set('qualified', 'true');
  if (params.qualified === false) sp.set('qualified', 'false');
  const query = sp.toString();
  const url = `/api/leads/export${query ? `?${query}` : ''}`;
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Export failed' }));
    throw new Error(err.error || 'Export failed');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const filename =
    disposition?.match(/filename="([^"]+)"/)?.[1] ||
    `leads-${new Date().toISOString().split('T')[0]}.csv`;
  return { blob, filename };
}
