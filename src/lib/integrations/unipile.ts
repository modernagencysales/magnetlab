// Unipile API Client
// Docs: https://{DSN}/api/v1/
// Auth: X-API-KEY header
// Used for LinkedIn post publishing (Phase 1)

import { BaseApiClient, ApiResponse } from './base-client';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import type { UnipilePost, UnipilePostStats } from '@/lib/types/integrations';

export interface UnipileConfig {
  dsn: string;
  accessToken: string;
}

export class UnipileClient extends BaseApiClient {
  constructor(config: UnipileConfig) {
    super({
      baseUrl: `https://${config.dsn}/api/v1`,
      headers: {
        'X-API-KEY': config.accessToken,
      },
    });
  }

  // ============================================
  // POSTS
  // ============================================

  async createPost(accountId: string, text: string): Promise<ApiResponse<UnipilePost>> {
    return this.post<UnipilePost>('/posts', {
      account_id: accountId,
      text,
    });
  }

  async getPost(postId: string, accountId?: string): Promise<ApiResponse<UnipilePostStats>> {
    const monitorId = accountId || getMonitorAccountId();
    if (!monitorId) {
      return { data: null, error: 'No monitor account configured', status: 0 };
    }
    return this.get<UnipilePostStats>(`/posts/${postId}?account_id=${monitorId}`);
  }

  async getPostComments(postId: string, accountId?: string): Promise<ApiResponse<{
    items: Array<{
      id: string;
      text: string;
      author: { name: string; provider_id: string };
      created_at: string;
    }>;
  }>> {
    const monitorId = accountId || getMonitorAccountId();
    if (!monitorId) {
      return { data: null, error: 'No monitor account configured', status: 0 };
    }
    return this.get(`/posts/${postId}/comments?account_id=${monitorId}`);
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async verifyConnection(accountId: string): Promise<{ connected: boolean; error?: string }> {
    const result = await this.get<{ id: string; status: string }>(`/accounts/${accountId}`);
    if (result.error) {
      return { connected: false, error: result.error };
    }
    return { connected: true };
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Pick a random monitor account ID from the comma-separated env var.
 * Monitor accounts are alt LinkedIn accounts used for reading engagement
 * stats, protecting the main posting account from detection.
 */
export function getMonitorAccountId(): string | null {
  const ids = process.env.UNIPILE_MONITOR_ACCOUNT_IDS;
  if (!ids) return null;
  const list = ids.split(',').map(s => s.trim()).filter(Boolean);
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

// ============================================
// FACTORIES
// ============================================

/**
 * Create a shared Unipile client using global env vars.
 * All users share the same Unipile subscription.
 */
export function getUnipileClient(): UnipileClient {
  const dsn = process.env.UNIPILE_DSN;
  const accessToken = process.env.UNIPILE_ACCESS_TOKEN;
  if (!dsn || !accessToken) {
    throw new Error('UNIPILE_DSN and UNIPILE_ACCESS_TOKEN must be set');
  }
  return new UnipileClient({ dsn, accessToken });
}

/**
 * Check if Unipile env vars are configured.
 */
export function isUnipileConfigured(): boolean {
  return !!(process.env.UNIPILE_DSN && process.env.UNIPILE_ACCESS_TOKEN);
}

/**
 * Get a user's posting account ID from user_integrations.
 * Returns null if user hasn't connected their Unipile account.
 */
export async function getUserPostingAccountId(userId: string): Promise<string | null> {
  const integration = await getUserIntegration(userId, 'unipile');
  if (!integration?.is_active) {
    return null;
  }
  const accountId = (integration.metadata as Record<string, unknown>)?.unipile_account_id;
  return typeof accountId === 'string' ? accountId : null;
}
