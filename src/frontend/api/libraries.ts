/**
 * Libraries API (client). Routes: /api/libraries, /api/libraries/[id], items.
 */

import { apiClient } from './client';

export async function listLibraries(params?: { limit?: number; offset?: number }): Promise<{ libraries: unknown[] }> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const q = sp.toString();
  return apiClient.get<{ libraries: unknown[] }>(`/libraries${q ? `?${q}` : ''}`);
}

export async function createLibrary(body: {
  name: string;
  description?: string | null;
  icon?: string;
  slug?: string;
  autoFeatureDays?: number;
}): Promise<{ library: { id: string; [k: string]: unknown } }> {
  return apiClient.post<{ library: { id: string; [k: string]: unknown } }>('/libraries', body);
}

export async function getLibrary(id: string): Promise<unknown> {
  return apiClient.get(`/libraries/${id}`);
}

export async function updateLibrary(id: string, body: Record<string, unknown>): Promise<unknown> {
  return apiClient.put(`/libraries/${id}`, body);
}

export async function deleteLibrary(id: string): Promise<{ success?: boolean }> {
  return apiClient.delete<{ success?: boolean }>(`/libraries/${id}`);
}

export async function listLibraryItems(libraryId: string): Promise<{ items: unknown[] }> {
  return apiClient.get<{ items: unknown[] }>(`/libraries/${libraryId}/items`);
}

export async function addLibraryItem(libraryId: string, body: Record<string, unknown>): Promise<unknown> {
  return apiClient.post(`/libraries/${libraryId}/items`, body);
}

export async function updateLibraryItem(
  libraryId: string,
  itemId: string,
  body: Record<string, unknown>
): Promise<unknown> {
  return apiClient.put(`/libraries/${libraryId}/items/${itemId}`, body);
}

export async function deleteLibraryItem(libraryId: string, itemId: string): Promise<unknown> {
  return apiClient.delete(`/libraries/${libraryId}/items/${itemId}`);
}
