/**
 * Recycle API (client).
 * List recyclable posts and trigger repost/cousin recycling.
 * Never imports from Next.js HTTP layer.
 */

import { apiClient } from '../client';
import type { PipelinePost } from '@/lib/types/content-pipeline';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecyclablePost {
  id: string;
  draft_content: string | null;
  final_content: string | null;
  status: string;
  published_at: string | null;
  engagement_stats: Record<string, unknown> | null;
  exploit_id: string | null;
  exploit_name: string | null;
  created_at: string;
}

interface RecyclableResponse {
  posts: RecyclablePost[];
}

interface RecycleResponse {
  post: PipelinePost;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getRecyclablePosts(limit = 50): Promise<RecyclablePost[]> {
  const data = await apiClient.get<RecyclableResponse>(
    `/content-pipeline/posts/recyclable?limit=${limit}`
  );
  return data.posts ?? [];
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function recyclePost(
  postId: string,
  type: 'repost' | 'cousin'
): Promise<PipelinePost> {
  const data = await apiClient.post<RecycleResponse>(`/content-pipeline/posts/${postId}/recycle`, {
    type,
  });
  return data.post;
}
