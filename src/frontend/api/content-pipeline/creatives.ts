/**
 * Creatives API (client).
 * CRUD for creative content used in exploit-driven post generation.
 * Never imports from Next.js HTTP layer.
 */

import { apiClient } from '../client';
import type {
  Creative,
  CreativeFilters,
  CreativeCreateInput,
  CreativeUpdateInput,
} from '@/lib/types/exploits';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreativesResponse {
  creatives: Creative[];
}

interface CreativeResponse {
  creative: Creative;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getCreatives(params: CreativeFilters = {}): Promise<Creative[]> {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.source_platform) sp.set('source_platform', params.source_platform);
  if (params.min_score != null) sp.set('min_score', String(params.min_score));
  if (params.limit != null) sp.set('limit', String(params.limit));
  const query = sp.toString();
  const data = await apiClient.get<CreativesResponse>(
    `/content-pipeline/creatives${query ? `?${query}` : ''}`
  );
  return data.creatives ?? [];
}

export async function getCreative(id: string): Promise<Creative> {
  const data = await apiClient.get<CreativeResponse>(`/content-pipeline/creatives/${id}`);
  return data.creative;
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function createCreative(body: CreativeCreateInput): Promise<Creative> {
  const data = await apiClient.post<CreativeResponse>('/content-pipeline/creatives', body);
  return data.creative;
}

export async function updateCreative(id: string, body: CreativeUpdateInput): Promise<Creative> {
  const data = await apiClient.patch<CreativeResponse>(`/content-pipeline/creatives/${id}`, body);
  return data.creative;
}

export async function deleteCreative(id: string): Promise<void> {
  await apiClient.delete(`/content-pipeline/creatives/${id}`);
}
