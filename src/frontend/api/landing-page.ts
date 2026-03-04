/**
 * Landing page / quick-create API (client).
 */

import { apiClient } from './client';

export async function quickCreate(payload: {
  title: string;
  description?: string;
}): Promise<{ leadMagnetId: string; funnelPageId: string; [k: string]: unknown }> {
  return apiClient.post<{ leadMagnetId: string; funnelPageId: string; [k: string]: unknown }>(
    '/landing-page/quick-create',
    payload
  );
}
