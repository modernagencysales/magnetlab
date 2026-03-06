/**
 * API keys (developer) API (client). Route: /api/keys
 */

import { apiClient } from './client';

export async function listKeys(): Promise<{ keys: unknown[] }> {
  return apiClient.get<{ keys: unknown[] }>('/keys');
}

export async function createKey(name: string): Promise<{ key: unknown; secret?: string }> {
  return apiClient.post<{ key: unknown; secret?: string }>('/keys', { name });
}

export async function deleteKey(keyId: string): Promise<void> {
  await apiClient.delete(`/keys/${keyId}`);
}
