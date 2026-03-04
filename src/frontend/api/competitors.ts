/**
 * Competitors (profile monitors) API (client). Route: /api/competitors
 */

import { apiClient } from './client';

export async function listCompetitors(): Promise<{ competitors: unknown[] }> {
  return apiClient.get<{ competitors: unknown[] }>('/competitors');
}

export async function createCompetitor(body: {
  linkedinProfileUrl: string;
  heyreachCampaignId?: string;
}): Promise<{ competitor: unknown }> {
  return apiClient.post<{ competitor: unknown }>('/competitors', body);
}

export async function updateCompetitor(
  id: string,
  body: { is_active?: boolean; heyreach_campaign_id?: string | null }
): Promise<{ competitor: unknown }> {
  return apiClient.patch<{ competitor: unknown }>(`/competitors/${id}`, body);
}

export async function deleteCompetitor(id: string): Promise<void> {
  await apiClient.delete(`/competitors/${id}`);
}
