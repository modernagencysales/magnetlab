/**
 * Generate API (client).
 * Post generation from composable primitives.
 * Never imports from Next.js HTTP layer.
 */

import { apiClient } from '../client';
import type { GeneratePostInput } from '@/lib/types/exploits';
import type { PipelinePost } from '@/lib/types/content-pipeline';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedPostResponse {
  post: PipelinePost;
  hook_score?: number;
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function generatePost(input: GeneratePostInput): Promise<GeneratedPostResponse> {
  return apiClient.post<GeneratedPostResponse>('/content-pipeline/posts/generate', input);
}
