/**
 * Content pipeline ideas API (client).
 * All calls go through apiClient; used by hooks and components.
 */

import { apiClient } from '../client';
import type { ContentIdea, IdeaStatus } from '@/lib/types/content-pipeline';

export interface GetIdeasParams {
  status?: string;
  pillar?: string;
  contentType?: string;
  teamProfileId?: string | null;
  teamId?: string;
  limit?: number;
}

export interface GetIdeasResponse {
  ideas: ContentIdea[];
}

export async function getIdeas(params: GetIdeasParams = {}): Promise<ContentIdea[]> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.pillar) searchParams.set('pillar', params.pillar);
  if (params.contentType) searchParams.set('content_type', params.contentType);
  if (params.teamProfileId) searchParams.set('team_profile_id', params.teamProfileId);
  if (params.teamId) searchParams.set('team_id', params.teamId);
  if (params.limit != null) searchParams.set('limit', String(params.limit));
  const query = searchParams.toString();
  const path = `/content-pipeline/ideas${query ? `?${query}` : ''}`;
  const data = await apiClient.get<GetIdeasResponse>(path);
  return data.ideas ?? [];
}

export async function writeFromIdea(ideaId: string, profileId?: string): Promise<{ success: boolean; status: string }> {
  const body = profileId != null ? { profileId } : undefined;
  return apiClient.post<{ success: boolean; status: string }>(`/content-pipeline/ideas/${ideaId}/write`, body);
}

export interface UpdateIdeaStatusParams {
  ideaId: string;
  status: IdeaStatus;
}

export async function updateIdeaStatus(params: UpdateIdeaStatusParams): Promise<{ idea: ContentIdea }> {
  const data = await apiClient.patch<{ idea: ContentIdea }>('/content-pipeline/ideas', {
    ideaId: params.ideaId,
    status: params.status,
  });
  return data;
}

export async function deleteIdea(ideaId: string): Promise<void> {
  await apiClient.delete(`/content-pipeline/ideas/${ideaId}`);
}
