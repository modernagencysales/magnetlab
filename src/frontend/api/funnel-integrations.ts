/**
 * Funnel integrations API (client). Route: /api/funnels/[id]/integrations
 */

import { apiClient } from './client';

export async function getFunnelIntegrations(funnelPageId: string): Promise<{ integrations: unknown[] }> {
  return apiClient.get<{ integrations: unknown[] }>(`/funnels/${funnelPageId}/integrations`);
}

export async function upsertFunnelIntegration(
  funnelPageId: string,
  body: Record<string, unknown>
): Promise<{ integration: unknown }> {
  return apiClient.post<{ integration: unknown }>(`/funnels/${funnelPageId}/integrations`, body);
}

export async function deleteFunnelIntegration(funnelPageId: string, provider: string): Promise<void> {
  await apiClient.delete(`/funnels/${funnelPageId}/integrations/${provider}`);
}
