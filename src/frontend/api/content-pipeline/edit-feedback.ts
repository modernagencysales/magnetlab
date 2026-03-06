/**
 * Content pipeline edit feedback API (client).
 */

import { apiClient } from '../client';

export interface SubmitEditFeedbackBody {
  editId: string;
  tags?: string[];
  note?: string;
}

export async function submitEditFeedback(body: SubmitEditFeedbackBody): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>('/content-pipeline/edit-feedback', body);
}
