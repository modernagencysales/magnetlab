/**
 * Content pipeline tracked creators API (client).
 */

import { apiClient } from '../client';

export async function getCreators(): Promise<{ creators: unknown[] }> {
  return apiClient.get<{ creators: unknown[] }>('/content-pipeline/creators');
}

export interface AddCreatorBody {
  linkedin_url: string;
  name?: string | null;
  headline?: string | null;
}

export async function addCreator(body: AddCreatorBody): Promise<{ creator: unknown; message?: string }> {
  return apiClient.post<{ creator: unknown; message?: string }>('/content-pipeline/creators', body);
}

export async function deleteCreator(id: string): Promise<void> {
  await apiClient.delete(`/content-pipeline/creators/${id}`);
}
