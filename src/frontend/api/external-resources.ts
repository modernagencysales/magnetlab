/**
 * External resources API (client). Routes: /api/external-resources, /api/external-resources/[id]
 */

import { apiClient } from './client';

export async function listExternalResources(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ resources?: unknown[]; [k: string]: unknown }> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const q = sp.toString();
  return apiClient.get<{ resources?: unknown[]; [k: string]: unknown }>(
    `/external-resources${q ? `?${q}` : ''}`
  );
}

export async function createExternalResource(body: {
  title: string;
  url: string;
  icon?: string;
}): Promise<{ resource: { id: string; [k: string]: unknown } }> {
  return apiClient.post<{ resource: { id: string; [k: string]: unknown } }>('/external-resources', body);
}

export async function getExternalResource(id: string): Promise<unknown> {
  return apiClient.get(`/external-resources/${id}`);
}

export async function updateExternalResource(
  id: string,
  body: { title?: string; url?: string; icon?: string }
): Promise<unknown> {
  return apiClient.put(`/external-resources/${id}`, body);
}

export async function deleteExternalResource(id: string): Promise<unknown> {
  return apiClient.delete(`/external-resources/${id}`);
}
