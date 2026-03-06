/**
 * User API (client). Routes: /api/user/defaults, etc.
 */

import { apiClient } from './client';

export async function getDefaults(): Promise<{
  defaultVslUrl?: string;
  defaultFunnelTemplate?: string;
}> {
  return apiClient.get<{ defaultVslUrl?: string; defaultFunnelTemplate?: string }>(
    '/user/defaults'
  );
}

export async function updateDefaults(body: {
  defaultVslUrl?: string;
  defaultFunnelTemplate?: string;
}): Promise<Record<string, unknown>> {
  return apiClient.put<Record<string, unknown>>('/user/defaults', body);
}

export async function getUsername(): Promise<{ username: string | null }> {
  return apiClient.get<{ username: string | null }>('/user/username');
}

export async function updateUsername(username: string): Promise<{ username: string }> {
  return apiClient.put<{ username: string }>('/user/username', { username });
}
