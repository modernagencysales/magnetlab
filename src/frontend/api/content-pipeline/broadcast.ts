/**
 * Content pipeline broadcast API (client).
 */

import { apiClient } from '../client';

export interface BroadcastBody {
  source_post_id: string;
  target_profile_ids: string[];
  stagger_days?: number;
}

export async function triggerBroadcast(body: BroadcastBody): Promise<{ success: boolean; run_id: string; message: string }> {
  return apiClient.post<{ success: boolean; run_id: string; message: string }>('/content-pipeline/broadcast', body);
}
