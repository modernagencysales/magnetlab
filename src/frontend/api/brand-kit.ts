/**
 * Brand kit API (client). Routes: /api/brand-kit, /api/brand-kit/upload
 */

import { apiClient } from './client';

export async function getBrandKit(): Promise<Record<string, unknown>> {
  return apiClient.get<Record<string, unknown>>('/brand-kit');
}

export async function updateBrandKit(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return apiClient.post<Record<string, unknown>>('/brand-kit', body);
}

/** Partial update — only sends the fields you pass. Safe for BrandingSettings. */
export async function patchBrandKit(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return apiClient.patch<Record<string, unknown>>('/brand-kit', body);
}

export async function uploadBrandKitFile(formData: FormData): Promise<{ url: string }> {
  return apiClient.post<{ url: string }>('/brand-kit/upload', formData);
}

export async function extractBusinessContext(payload: {
  content: string;
  contentType?: string;
}): Promise<Record<string, unknown>> {
  return apiClient.post<Record<string, unknown>>('/brand-kit/extract', payload);
}
