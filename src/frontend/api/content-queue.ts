/**
 * Content Queue API client (frontend).
 * Wraps /api/content-queue routes.
 * Never imports from src/server/ — response types are defined locally.
 */

import { apiClient } from './client';

// ─── Response Types ────────────────────────────────────────────────────────

export interface QueueFunnel {
  id: string;
  slug: string;
  is_published: boolean;
  reviewed_at: string | null;
}

export interface QueueLeadMagnet {
  id: string;
  title: string;
  archetype: string;
  status: string;
  reviewed_at: string | null;
  created_at: string;
  funnels: QueueFunnel[];
}

export interface QueueTeamWritingStyle {
  name: string;
  description: string | null;
  tone_keywords: string[] | null;
  writing_rules: string[] | null;
}

export interface QueuePostReviewData {
  score: number;
  category: 'excellent' | 'good_with_edits' | 'needs_rewrite' | 'delete';
  notes: string[];
  flags: string[];
  reviewed_at: string;
}

export interface QueuePost {
  id: string;
  draft_content: string | null;
  idea_id: string | null;
  idea_title: string | null;
  idea_content_type: string | null;
  edited_at: string | null;
  created_at: string;
  review_data: QueuePostReviewData | null;
  image_storage_path: string | null;
}

export interface QueueTeam {
  team_id: string;
  team_name: string;
  profile_name: string;
  profile_company: string;
  owner_id: string;
  writing_style: QueueTeamWritingStyle | null;
  posts: QueuePost[];
  edited_count: number;
  total_count: number;
  lead_magnets: QueueLeadMagnet[];
  lm_reviewed_count: number;
  lm_total_count: number;
  funnel_reviewed_count: number;
  funnel_total_count: number;
}

export interface QueueListResult {
  teams: QueueTeam[];
  summary: {
    total_teams: number;
    total_posts: number;
    remaining: number;
    total_lead_magnets: number;
    total_funnels: number;
  };
}

export interface SubmitResult {
  success: boolean;
  dfy_callback_sent: boolean;
  error?: string;
}

// ─── Request Types ─────────────────────────────────────────────────────────

export interface UpdateQueuePostBody {
  draft_content?: string;
  mark_edited?: boolean;
  /** AI-generated original text — sent with mark_edited for style learning diff */
  original_content?: string;
}

// ─── API Functions ─────────────────────────────────────────────────────────

export async function getQueue(): Promise<QueueListResult> {
  return apiClient.get<QueueListResult>('/content-queue');
}

export async function updateQueuePost(postId: string, body: UpdateQueuePostBody): Promise<void> {
  return apiClient.patch<void>(`/content-queue/posts/${postId}`, body);
}

export async function deleteQueuePost(postId: string): Promise<void> {
  return apiClient.delete<void>(`/content-queue/posts/${postId}`);
}

export async function submitBatch(
  teamId: string,
  submitType: 'posts' | 'assets' = 'posts'
): Promise<SubmitResult> {
  return apiClient.post<SubmitResult>('/content-queue/submit', {
    team_id: teamId,
    submit_type: submitType,
  });
}

// ─── Image API Functions ──────────────────────────────────────────────────

export async function uploadQueuePostImage(
  postId: string,
  file: File
): Promise<{ imageUrl: string; storagePath: string }> {
  const formData = new FormData();
  formData.append('image', file);
  return apiClient.post<{ imageUrl: string; storagePath: string }>(
    `/content-queue/posts/${postId}/upload-image`,
    formData
  );
}

export async function removeQueuePostImage(postId: string): Promise<void> {
  return apiClient.patch<void>(`/content-queue/posts/${postId}`, {
    image_storage_path: null,
  });
}

// ─── Review API Functions ──────────────────────────────────────────────────

export async function reviewLeadMagnet(lmId: string, reviewed: boolean): Promise<void> {
  return apiClient.patch<void>(`/content-queue/lead-magnets/${lmId}/review`, { reviewed });
}

export async function reviewFunnel(funnelId: string, reviewed: boolean): Promise<void> {
  return apiClient.patch<void>(`/content-queue/funnels/${funnelId}/review`, { reviewed });
}
