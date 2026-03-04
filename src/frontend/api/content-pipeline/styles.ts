/**
 * Content pipeline writing styles API (client).
 */

import { apiClient } from '../client';

export async function getStyles(): Promise<{ styles: unknown[] }> {
  return apiClient.get<{ styles: unknown[] }>('/content-pipeline/styles');
}

export async function extractStylesFromUrl(linkedinUrl: string, authorName?: string): Promise<Record<string, unknown>> {
  return apiClient.post<Record<string, unknown>>('/content-pipeline/styles/extract-from-url', {
    linkedin_url: linkedinUrl,
    author_name: authorName,
  });
}

export async function deleteStyle(id: string): Promise<void> {
  await apiClient.delete(`/content-pipeline/styles/${id}`);
}
