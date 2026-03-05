/**
 * Email broadcasts API (client). Routes: /api/email/broadcasts, /api/email/broadcasts/[id]
 */

import { apiClient } from '../client';

export async function listBroadcasts(): Promise<{ broadcasts: unknown[] }> {
  return apiClient.get<{ broadcasts: unknown[] }>('/email/broadcasts');
}

export async function createBroadcast(
  body: Record<string, unknown>
): Promise<{ broadcast: unknown }> {
  return apiClient.post<{ broadcast: unknown }>('/email/broadcasts', body ?? {});
}

export async function getBroadcast(id: string): Promise<{ broadcast: unknown }> {
  return apiClient.get<{ broadcast: unknown }>(`/email/broadcasts/${id}`);
}

export async function updateBroadcast(
  id: string,
  body: Record<string, unknown>
): Promise<{ broadcast: unknown }> {
  return apiClient.put<{ broadcast: unknown }>(`/email/broadcasts/${id}`, body);
}

export async function deleteBroadcast(id: string): Promise<void> {
  await apiClient.delete(`/email/broadcasts/${id}`);
}

export async function getBroadcastPreviewCount(
  id: string
): Promise<{ count: number; total: number }> {
  return apiClient.get<{ count: number; total: number }>(
    `/email/broadcasts/${id}/preview-count`
  );
}

export async function sendBroadcast(
  id: string
): Promise<{ message: string; recipient_count: number }> {
  return apiClient.post<{ message: string; recipient_count: number }>(
    `/email/broadcasts/${id}/send`,
    {}
  );
}
