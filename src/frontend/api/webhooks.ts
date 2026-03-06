/**
 * User webhooks API (client).
 */

import { apiClient } from './client';

export async function getWebhooks(): Promise<{ webhooks: unknown[] }> {
  return apiClient.get<{ webhooks: unknown[] }>('/webhooks');
}

export async function createWebhook(body: { name: string; url: string }): Promise<{ webhook: unknown }> {
  return apiClient.post<{ webhook: unknown }>('/webhooks', body);
}

export async function updateWebhook(
  id: string,
  body: { name?: string; url?: string; isActive?: boolean }
): Promise<{ webhook: unknown }> {
  return apiClient.put<{ webhook: unknown }>(`/webhooks/${id}`, body);
}

export async function deleteWebhook(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/webhooks/${id}`);
}

export async function testWebhook(id: string): Promise<{
  success: boolean;
  status?: number;
  message?: string;
}> {
  return apiClient.post<{ success: boolean; status?: number; message?: string }>(
    `/webhooks/${id}`,
    {}
  );
}
