/**
 * White-label settings API (client). Route: /api/settings/whitelabel
 */

import { apiClient } from '../client';

export async function getWhitelabel(): Promise<{ whitelabel: unknown }> {
  return apiClient.get<{ whitelabel: unknown }>('/settings/whitelabel');
}

export async function updateWhitelabel(body: {
  hideBranding?: boolean;
  customFaviconUrl?: string | null;
  customSiteName?: string | null;
  customEmailSenderName?: string | null;
}): Promise<{ success: boolean }> {
  return apiClient.patch<{ success: boolean }>('/settings/whitelabel', body);
}
