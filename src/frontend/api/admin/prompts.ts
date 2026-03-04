/**
 * Admin prompts API (client). Routes: /api/admin/prompts/[slug], test, restore.
 */

import { apiClient } from '../client';

export async function getPrompt(slug: string): Promise<unknown> {
  return apiClient.get(`/admin/prompts/${slug}`);
}

export async function updatePrompt(
  slug: string,
  body: { updates: Record<string, unknown>; change_note?: string }
): Promise<{ version: unknown }> {
  return apiClient.patch<{ version: unknown }>(`/admin/prompts/${slug}`, body);
}

export async function testPrompt(
  slug: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return apiClient.post<Record<string, unknown>>(`/admin/prompts/${slug}/test`, body);
}

export async function restorePrompt(
  slug: string,
  versionId: string
): Promise<unknown> {
  return apiClient.post(`/admin/prompts/${slug}/restore`, { version_id: versionId });
}
