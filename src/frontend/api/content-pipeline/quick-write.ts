/**
 * Content pipeline quick-write API (client).
 */

import { apiClient } from '../client';

export interface QuickWriteBody {
  raw_thought: string;
  template_structure?: string | null;
  style_instructions?: string | null;
  target_audience?: string | null;
  profileId?: string | null;
}

export async function quickWrite(body: QuickWriteBody): Promise<{ post: unknown; synthetic_idea?: unknown }> {
  return apiClient.post<{ post: unknown; synthetic_idea?: unknown }>('/content-pipeline/quick-write', body);
}
