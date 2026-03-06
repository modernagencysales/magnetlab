/**
 * Feedback API (client). POST /api/feedback
 */

import { apiClient } from './client';

export interface SubmitFeedbackBody {
  type: 'bug' | 'feature' | 'feedback';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metadata: {
    url: string;
    userEmail: string | null;
    userId: string | null;
    browser: string;
    [key: string]: unknown;
  };
}

export async function submitFeedback(body: SubmitFeedbackBody): Promise<unknown> {
  return apiClient.post<unknown>('/feedback', body);
}
