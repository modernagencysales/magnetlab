/**
 * A/B experiments API (client).
 */

import { apiClient } from './client';

export async function listExperiments(funnelPageId?: string): Promise<{ experiments: unknown[] }> {
  const query = funnelPageId ? `?funnelPageId=${encodeURIComponent(funnelPageId)}` : '';
  return apiClient.get<{ experiments: unknown[] }>(`/ab-experiments${query}`);
}

export async function getExperiment(id: string): Promise<{ experiment: unknown; variants?: unknown[] }> {
  return apiClient.get<{ experiment: unknown; variants?: unknown[] }>(`/ab-experiments/${id}`);
}

export interface SuggestVariantsBody {
  funnelPageId: string;
  testField: string;
}

export async function suggestVariants(body: SuggestVariantsBody): Promise<{ suggestions?: unknown[] }> {
  return apiClient.post<{ suggestions?: unknown[] }>('/ab-experiments/suggest', body);
}

export interface CreateExperimentBody {
  funnelPageId: string;
  name: string;
  testField: string;
  variantValue?: unknown;
  variantLabel?: string;
}

export async function createExperiment(body: CreateExperimentBody): Promise<Record<string, unknown>> {
  return apiClient.post<Record<string, unknown>>('/ab-experiments', body);
}

export async function patchExperiment(
  id: string,
  action: 'pause' | 'resume' | 'declare_winner',
  winnerId?: string
): Promise<Record<string, unknown>> {
  const body = winnerId !== undefined ? { action, winnerId } : { action };
  return apiClient.patch<Record<string, unknown>>(`/ab-experiments/${id}`, body);
}

export async function deleteExperiment(id: string): Promise<void> {
  await apiClient.delete(`/ab-experiments/${id}`);
}
