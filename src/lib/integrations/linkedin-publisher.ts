/**
 * LinkedIn Publisher Abstraction.
 * Unified interface for publishing LinkedIn posts via Unipile.
 * Supports optional image attachments from Supabase Storage.
 */

import { getUnipileClient, getUserPostingAccountId, isUnipileConfigured } from './unipile';
import type { EngagementStats } from '@/lib/types/content-pipeline';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ImageFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface PublishResult {
  postId: string;
  provider: 'unipile';
}

export interface LinkedInPublisher {
  publishNow(content: string, imageFile?: ImageFile): Promise<PublishResult>;
  getPostStats(postId: string): Promise<EngagementStats | null>;
  provider: 'unipile';
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Get a LinkedIn publisher for the given user.
 * Uses Unipile (user has integration + env vars configured).
 * Returns null if not available.
 */
export async function getUserLinkedInPublisher(userId: string): Promise<LinkedInPublisher | null> {
  if (isUnipileConfigured()) {
    const accountId = await getUserPostingAccountId(userId);
    if (accountId) {
      const client = getUnipileClient();
      return {
        provider: 'unipile',

        async publishNow(content: string, imageFile?: ImageFile): Promise<PublishResult> {
          const result = await client.createPost(accountId, content, imageFile);
          if (result.error) {
            throw new Error(`Unipile publish failed: ${result.error}`);
          }
          // Return the social_id (urn:li:activity:XXX) as the canonical post ID
          const postId = result.data?.social_id || result.data?.id || '';
          return { postId, provider: 'unipile' };
        },

        async getPostStats(postId: string): Promise<EngagementStats | null> {
          try {
            const result = await client.getPost(postId, accountId);
            if (result.error || !result.data) return null;
            return {
              views: result.data.views_count || 0,
              likes: result.data.likes_count || 0,
              comments: result.data.comments_count || 0,
              shares: result.data.shares_count || 0,
              captured_at: new Date().toISOString(),
            };
          } catch {
            return null;
          }
        },
      };
    }
  }

  return null;
}

/**
 * Create a LinkedIn publisher bound to a specific Unipile account ID.
 * Use when the caller already knows which account to publish from.
 * Does not look up user_integrations — uses the provided account ID directly.
 */
export function getLinkedInPublisherForAccount(accountId: string) {
  const client = getUnipileClient();
  return {
    async publishNow(content: string, imageFile?: ImageFile) {
      return client.createPost(accountId, content, imageFile);
    },
  };
}
