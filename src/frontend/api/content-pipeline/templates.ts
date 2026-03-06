/**
 * Content pipeline templates API (client).
 * Routes: /api/content-pipeline/templates, seed, bulk-import, match, [id]
 */

import { apiClient } from '../client';

export type TemplateScope = 'global' | 'mine';

export interface ListTemplatesResponse {
  templates: unknown[];
}

export async function listTemplates(scope: TemplateScope): Promise<unknown[]> {
  const data = await apiClient.get<ListTemplatesResponse>(
    `/content-pipeline/templates?scope=${scope}`
  );
  return data.templates ?? [];
}

export async function seedTemplates(): Promise<unknown> {
  return apiClient.post<unknown>('/content-pipeline/templates/seed');
}

export interface CreateTemplateBody {
  name: string;
  category?: string | null;
  description?: string | null;
  structure: string;
  example_posts?: unknown;
  use_cases?: unknown;
  tags?: unknown;
}

export async function createTemplate(body: CreateTemplateBody): Promise<{ template: unknown }> {
  return apiClient.post<{ template: unknown }>('/content-pipeline/templates', body);
}

export async function updateTemplate(
  id: string,
  body: Record<string, unknown>
): Promise<{ template: unknown }> {
  return apiClient.patch<{ template: unknown }>(`/content-pipeline/templates/${id}`, body);
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiClient.delete(`/content-pipeline/templates/${id}`);
}

export interface BulkImportBody {
  templates: Array<{ name: string; structure: string; [key: string]: unknown }>;
}

export async function bulkImportTemplates(
  body: BulkImportBody
): Promise<{ imported: number; templates: unknown[] }> {
  return apiClient.post<{ imported: number; templates: unknown[] }>(
    '/content-pipeline/templates/bulk-import',
    body
  );
}

export interface MatchTemplatesBody {
  topic?: string;
  text?: string;
  count?: number;
  minSimilarity?: number;
}

export async function matchTemplates(body: MatchTemplatesBody): Promise<{ matches: unknown[] }> {
  return apiClient.post<{ matches: unknown[] }>('/content-pipeline/templates/match', body);
}
