/**
 * Lead magnet API (client). List, create, ideate, extract, write-post, analyze, import, content, polish, generate.
 */

import { apiClient } from './client';

export async function listLeadMagnets(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ leadMagnets: unknown[]; total?: number }> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const q = sp.toString();
  return apiClient.get<{ leadMagnets: unknown[]; total?: number }>(
    `/lead-magnet${q ? `?${q}` : ''}`
  );
}

export async function createLeadMagnet(
  body: Record<string, unknown>
): Promise<{ id: string; [k: string]: unknown }> {
  return apiClient.post<{ id: string; [k: string]: unknown }>('/lead-magnet', body);
}

export async function ideate(
  body: Record<string, unknown>
): Promise<{ jobId?: string; concepts?: unknown[]; [k: string]: unknown }> {
  return apiClient.post('/lead-magnet/ideate', body);
}

export async function getExtractionQuestions(archetype: string): Promise<unknown> {
  return apiClient.get(`/lead-magnet/extract?archetype=${encodeURIComponent(archetype)}`);
}

export async function extract(
  body: Record<string, unknown>
): Promise<{ jobId?: string; questions?: unknown[]; [k: string]: unknown }> {
  return apiClient.post('/lead-magnet/extract', body);
}

export async function writePost(
  body: Record<string, unknown>
): Promise<{ jobId?: string; [k: string]: unknown }> {
  return apiClient.post('/lead-magnet/write-post', body);
}

export async function analyzeTranscript(transcript: string): Promise<Record<string, unknown>> {
  return apiClient.post('/lead-magnet/analyze-transcript', { transcript });
}

export async function analyzeCompetitor(content: string): Promise<Record<string, unknown>> {
  return apiClient.post('/lead-magnet/analyze-competitor', { content });
}

export async function importLeadMagnet(
  body: Record<string, unknown>
): Promise<{ leadMagnetId: string; [k: string]: unknown }> {
  return apiClient.post<{ leadMagnetId: string; [k: string]: unknown }>(
    '/lead-magnet/import',
    body
  );
}

export async function polishLeadMagnet(leadMagnetId: string): Promise<{ jobId: string }> {
  return apiClient.post<{ jobId: string }>(`/lead-magnet/${leadMagnetId}/polish`, {});
}

export async function generateLeadMagnetContent(leadMagnetId: string): Promise<{ jobId: string }> {
  return apiClient.post<{ jobId: string }>(`/lead-magnet/${leadMagnetId}/generate-content`, {});
}

export async function updateLeadMagnetContent(
  leadMagnetId: string,
  body: { polishedContent: unknown }
): Promise<{ polishedContent: unknown }> {
  return apiClient.put<{ polishedContent: unknown }>(`/lead-magnet/${leadMagnetId}/content`, body);
}

export async function updateLeadMagnetCatalog(
  leadMagnetId: string,
  body: { pain_point?: string; target_audience?: string; short_description?: string }
): Promise<{ success: boolean }> {
  return apiClient.patch<{ success: boolean }>(`/lead-magnet/${leadMagnetId}/catalog`, body);
}

export async function generateScreenshots(leadMagnetId: string): Promise<{
  screenshotUrls?: unknown[];
  [key: string]: unknown;
}> {
  return apiClient.post<{ screenshotUrls?: unknown[]; [key: string]: unknown }>(
    `/lead-magnet/${leadMagnetId}/screenshots`
  );
}
