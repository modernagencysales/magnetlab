/**
 * Content pipeline posts API (client).
 */

import { apiClient } from '../client';
import type { PipelinePost } from '@/lib/types/content-pipeline';

export interface GetPostsParams {
  status?: string;
  isBuffer?: boolean;
  teamProfileId?: string | null;
  teamId?: string;
  limit?: number;
}

export interface GetPostsResponse {
  posts: PipelinePost[];
}

export async function getPosts(params: GetPostsParams = {}): Promise<PipelinePost[]> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.isBuffer !== undefined) searchParams.set('is_buffer', String(params.isBuffer));
  if (params.teamProfileId) searchParams.set('team_profile_id', params.teamProfileId);
  if (params.teamId) searchParams.set('team_id', params.teamId);
  if (params.limit != null) searchParams.set('limit', String(params.limit));
  const query = searchParams.toString();
  const path = `/content-pipeline/posts${query ? `?${query}` : ''}`;
  const data = await apiClient.get<GetPostsResponse>(path);
  return data.posts ?? [];
}

export interface GetPostByIdResponse {
  post: PipelinePost;
}

export async function getPostById(postId: string): Promise<PipelinePost> {
  const data = await apiClient.get<GetPostByIdResponse>(`/content-pipeline/posts/${postId}`);
  return data.post;
}

export interface UpdatePostBody {
  draft_content?: string | null;
  final_content?: string | null;
  status?: string;
  scheduled_time?: string | null;
  [key: string]: unknown;
}

export interface UpdatePostResponse {
  post: PipelinePost;
  editId?: string;
}

export async function updatePost(
  postId: string,
  body: UpdatePostBody
): Promise<UpdatePostResponse> {
  return apiClient.patch<UpdatePostResponse>(`/content-pipeline/posts/${postId}`, body);
}

export async function deletePost(postId: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/content-pipeline/posts/${postId}`);
}

export interface PolishPostResponse {
  success: boolean;
  polishResult?: unknown;
}

export async function polishPost(postId: string): Promise<PolishPostResponse> {
  return apiClient.post<PolishPostResponse>(`/content-pipeline/posts/${postId}/polish`);
}

export async function getPostsByDateRange(start: string, end: string): Promise<PipelinePost[]> {
  const data = await apiClient.get<GetPostsResponse>(
    `/content-pipeline/posts/by-date-range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  );
  return data.posts ?? [];
}

export interface SchedulePostBody {
  post_id: string;
  scheduled_time?: string;
}

export interface SchedulePostResponse {
  success: boolean;
  scheduled_via?: string;
}

export async function schedulePost(
  postId: string,
  scheduledTime?: string
): Promise<SchedulePostResponse> {
  const body: SchedulePostBody = { post_id: postId };
  if (scheduledTime) body.scheduled_time = scheduledTime;
  return apiClient.post<SchedulePostResponse>('/content-pipeline/posts/schedule', body);
}

export interface PublishPostResponse {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export async function publishPost(postId: string): Promise<PublishPostResponse> {
  return apiClient.post<PublishPostResponse>(`/content-pipeline/posts/${postId}/publish`);
}

// ── Engagement ──
export interface PostEngagementResponse {
  stats?: unknown;
  config?: { scrape_engagement?: boolean; heyreach_campaign_id?: string };
  [key: string]: unknown;
}

export async function getPostEngagement(postId: string): Promise<PostEngagementResponse> {
  return apiClient.get<PostEngagementResponse>(`/content-pipeline/posts/${postId}/engagement`);
}

export async function updatePostEngagement(
  postId: string,
  body: { scrape_engagement?: boolean; heyreach_campaign_id?: string }
): Promise<{ post: unknown }> {
  return apiClient.patch<{ post: unknown }>(`/content-pipeline/posts/${postId}/engagement`, body);
}
