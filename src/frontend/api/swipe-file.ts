/**
 * Swipe file API (client). Routes: /api/swipe-file/posts, lead-magnets, submit.
 */

import { apiClient } from './client';

export interface ListPostsParams {
  niche?: string;
  type?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListLeadMagnetsParams {
  niche?: string;
  format?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
}

export async function listPosts(params: ListPostsParams = {}): Promise<{ posts: unknown[] }> {
  const sp = new URLSearchParams();
  if (params.niche) sp.set('niche', params.niche);
  if (params.type) sp.set('type', params.type);
  if (params.featured) sp.set('featured', 'true');
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  const q = sp.toString();
  return apiClient.get<{ posts: unknown[] }>(`/swipe-file/posts${q ? `?${q}` : ''}`);
}

export async function listLeadMagnets(params: ListLeadMagnetsParams = {}): Promise<{ leadMagnets: unknown[] }> {
  const sp = new URLSearchParams();
  if (params.niche) sp.set('niche', params.niche);
  if (params.format) sp.set('format', params.format);
  if (params.featured) sp.set('featured', 'true');
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  const q = sp.toString();
  return apiClient.get<{ leadMagnets: unknown[] }>(`/swipe-file/lead-magnets${q ? `?${q}` : ''}`);
}

export async function submit(body: { type: 'post'; content: string } | { type: 'lead_magnet'; title: string; [k: string]: unknown }): Promise<unknown> {
  return apiClient.post('/swipe-file/submit', body);
}
