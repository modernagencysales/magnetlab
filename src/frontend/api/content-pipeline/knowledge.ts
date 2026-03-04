/**
 * Content pipeline knowledge API (client).
 */

import { apiClient } from '../client';

export interface KnowledgeListParams {
  q?: string;
  category?: string;
  speaker?: string;
  tag?: string;
  view?: string;
  type?: string;
  topic?: string;
  min_quality?: number;
  since?: string;
  sort?: 'newest' | 'oldest' | 'quality';
  limit?: number;
  offset?: number;
  team_id?: string;
}

export async function listKnowledge(params: KnowledgeListParams = {}): Promise<Record<string, unknown>> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') searchParams.set(k, String(v));
  });
  const query = searchParams.toString();
  return apiClient.get<Record<string, unknown>>(`/content-pipeline/knowledge${query ? `?${query}` : ''}`);
}

export async function getTopics(params: { limit?: number; team_id?: string } = {}): Promise<{ topics: unknown[] }> {
  const searchParams = new URLSearchParams();
  if (params.limit != null) searchParams.set('limit', String(params.limit));
  if (params.team_id) searchParams.set('team_id', params.team_id);
  const query = searchParams.toString();
  return apiClient.get<{ topics: unknown[] }>(`/content-pipeline/knowledge/topics${query ? `?${query}` : ''}`);
}

export async function getTopicDetail(slug: string, teamId?: string): Promise<Record<string, unknown>> {
  const query = teamId ? `?team_id=${encodeURIComponent(teamId)}` : '';
  return apiClient.get<Record<string, unknown>>(`/content-pipeline/knowledge/topics/${encodeURIComponent(slug)}${query}`);
}

export async function getTopicSummary(slug: string, options?: { force?: boolean; team_id?: string }): Promise<Record<string, unknown>> {
  const searchParams = new URLSearchParams();
  if (options?.force) searchParams.set('force', 'true');
  if (options?.team_id) searchParams.set('team_id', options.team_id);
  const query = searchParams.toString();
  const path = `/content-pipeline/knowledge/topics/${encodeURIComponent(slug)}/summary${query ? `?${query}` : ''}`;
  return apiClient.post<Record<string, unknown>>(path, {});
}

export async function getRecentKnowledge(params: { days?: number; team_id?: string }): Promise<Record<string, unknown>> {
  const searchParams = new URLSearchParams();
  if (params.days != null) searchParams.set('days', String(params.days));
  if (params.team_id) searchParams.set('team_id', params.team_id);
  const query = searchParams.toString();
  return apiClient.get<Record<string, unknown>>(`/content-pipeline/knowledge/recent${query ? `?${query}` : ''}`);
}

export async function getKnowledgeGaps(params: { limit?: number; team_id?: string } = {}): Promise<Record<string, unknown>> {
  const searchParams = new URLSearchParams();
  if (params.limit != null) searchParams.set('limit', String(params.limit));
  if (params.team_id) searchParams.set('team_id', params.team_id);
  const query = searchParams.toString();
  return apiClient.get<Record<string, unknown>>(`/content-pipeline/knowledge/gaps${query ? `?${query}` : ''}`);
}

export async function getKnowledgeReadiness(params: {
  topic: string;
  goal: string;
  team_id?: string;
}): Promise<Record<string, unknown>> {
  const searchParams = new URLSearchParams({ topic: params.topic, goal: params.goal });
  if (params.team_id) searchParams.set('team_id', params.team_id);
  const query = searchParams.toString();
  return apiClient.get<Record<string, unknown>>(`/content-pipeline/knowledge/readiness?${query}`);
}

export async function getClusters(params?: { team_id?: string }): Promise<Record<string, unknown>> {
  const query = params?.team_id ? `?team_id=${encodeURIComponent(params.team_id)}` : '';
  return apiClient.get<Record<string, unknown>>(`/content-pipeline/knowledge/clusters${query}`);
}

export async function triggerClustering(params?: { team_id?: string }): Promise<Record<string, unknown>> {
  const query = params?.team_id ? `?team_id=${encodeURIComponent(params.team_id)}` : '';
  return apiClient.post<Record<string, unknown>>(`/content-pipeline/knowledge/clusters${query}`);
}

export async function updateKnowledgeEntry(id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const data = await apiClient.patch<{ entry: unknown }>(`/content-pipeline/knowledge/${id}`, body);
  return data as Record<string, unknown>;
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  await apiClient.delete(`/content-pipeline/knowledge/${id}`);
}
