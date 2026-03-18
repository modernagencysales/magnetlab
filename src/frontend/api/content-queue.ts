/**
 * Content Queue API client (frontend).
 * Wraps /api/content-queue routes.
 * Never imports from src/server/ — response types are defined locally.
 */

import { apiClient } from './client';

// ─── Response Types ────────────────────────────────────────────────────────

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
  image_urls: string[] | null;
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
}

export interface QueueListResult {
  teams: QueueTeam[];
  summary: {
    total_teams: number;
    total_posts: number;
    remaining: number;
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

export async function submitBatch(teamId: string): Promise<SubmitResult> {
  return apiClient.post<SubmitResult>('/content-queue/submit', { team_id: teamId });
}
