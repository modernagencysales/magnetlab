/**
 * Background jobs API (client). GET /api/jobs/[id]
 */

import { apiClient } from './client';

export interface JobStatusResponse<T = unknown> {
  status: 'pending' | 'completed' | 'failed';
  result?: T;
  error?: string;
  [key: string]: unknown;
}

export async function getJobStatus<T = unknown>(id: string): Promise<JobStatusResponse<T>> {
  return apiClient.get<JobStatusResponse<T>>(`/jobs/${id}`);
}
