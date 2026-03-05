/**
 * LinkedIn integration API (client). Connect is OAuth redirect; disconnect is POST.
 */

import { apiClient } from './client';

/** Disconnect LinkedIn. Connect is done via redirect to /api/linkedin/connect. */
export async function disconnectLinkedIn(): Promise<void> {
  await apiClient.post('/linkedin/disconnect', {});
}
