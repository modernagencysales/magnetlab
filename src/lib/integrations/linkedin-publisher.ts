// LinkedIn Publisher Abstraction
// Unified interface for publishing LinkedIn posts.
// Tries Unipile first, falls back to LeadShark.

import {
  getUnipileClient,
  getUserPostingAccountId,
  isUnipileConfigured,
  getMonitorAccountId,
} from './unipile';
import { getUserLeadSharkClient } from './leadshark';
import type { EngagementStats } from '@/lib/types/content-pipeline';

export interface PublishResult {
  postId: string;
  provider: 'unipile' | 'leadshark';
}

export interface LinkedInPublisher {
  publishNow(content: string): Promise<PublishResult>;
  getPostStats(postId: string): Promise<EngagementStats | null>;
  provider: 'unipile' | 'leadshark';
}

/**
 * Get a LinkedIn publisher for the given user.
 * Tries Unipile first (user has integration + env vars configured),
 * falls back to LeadShark.
 * Returns null if neither is available.
 */
export async function getUserLinkedInPublisher(
  userId: string
): Promise<LinkedInPublisher | null> {
  // Try Unipile first
  if (isUnipileConfigured()) {
    const accountId = await getUserPostingAccountId(userId);
    if (accountId) {
      const client = getUnipileClient();
      return {
        provider: 'unipile',

        async publishNow(content: string): Promise<PublishResult> {
          const result = await client.createPost(accountId, content);
          if (result.error) {
            throw new Error(`Unipile publish failed: ${result.error}`);
          }
          // Return the social_id (urn:li:activity:XXX) as the canonical post ID
          const postId = result.data?.social_id || result.data?.id || '';
          return { postId, provider: 'unipile' };
        },

        async getPostStats(postId: string): Promise<EngagementStats | null> {
          try {
            const monitorId = getMonitorAccountId();
            if (!monitorId) return null;
            const result = await client.getPost(postId, monitorId);
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

  // Fallback to LeadShark
  const leadshark = await getUserLeadSharkClient(userId);
  if (leadshark) {
    return {
      provider: 'leadshark',

      async publishNow(content: string): Promise<PublishResult> {
        // LeadShark requires scheduled_time at least 15 min in future
        const scheduledTime = new Date(Date.now() + 16 * 60 * 1000).toISOString();
        const result = await leadshark.createScheduledPost({
          content,
          scheduled_time: scheduledTime,
        });
        if (result.error) {
          throw new Error(`LeadShark publish failed: ${result.error}`);
        }
        return {
          postId: result.data?.id || '',
          provider: 'leadshark',
        };
      },

      async getPostStats(): Promise<EngagementStats | null> {
        // LeadShark stats require separate API call with cursor pagination
        // Not worth implementing for fallback — return null
        return null;
      },
    };
  }

  return null;
}
