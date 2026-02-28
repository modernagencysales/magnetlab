// Unipile API Client
// Docs: https://{DSN}/api/v1/
// Auth: X-API-KEY header
// Used for: LinkedIn post publishing, like/reply on comments (low-risk actions only)
// NOT used for: scraping (Harvest API), DMs/connections (HeyReach)

import { BaseApiClient, ApiResponse } from './base-client';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import type { UnipilePost, UnipilePostStats } from '@/lib/types/integrations';

export interface UnipileConfig {
  dsn: string;
  accessToken: string;
}

export class UnipileClient extends BaseApiClient {
  private dsn: string;

  constructor(config: UnipileConfig) {
    super({
      baseUrl: `https://${config.dsn}/api/v1`,
      headers: {
        'X-API-KEY': config.accessToken,
      },
    });
    this.dsn = config.dsn;
  }

  // ============================================
  // HOSTED AUTH
  // ============================================

  async requestHostedAuthLink(params: {
    userId: string;
    successRedirectUrl: string;
    failureRedirectUrl: string;
    notifyUrl: string;
  }): Promise<ApiResponse<{ url: string }>> {
    return this.post('/hosted/accounts/link', {
      type: 'create',
      providers: ['LINKEDIN'],
      api_url: `https://${this.dsn}`,
      expiresOn: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      notify_url: params.notifyUrl,
      name: params.userId,
      success_redirect_url: params.successRedirectUrl,
      failure_redirect_url: params.failureRedirectUrl,
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

  async getPost(postId: string, accountId: string): Promise<ApiResponse<UnipilePostStats>> {
    return this.get<UnipilePostStats>(`/posts/${postId}?account_id=${accountId}`);
  }

  // ============================================
  // INTERACTIONS (low-risk actions)
  // ============================================

  async addComment(postSocialId: string, accountId: string, text: string): Promise<ApiResponse<{
    id: string;
  }>> {
    return this.post(`/posts/${postSocialId}/comments`, {
      account_id: accountId,
      text,
    });
  }

  async addReaction(postSocialId: string, accountId: string, type: string = 'LIKE'): Promise<ApiResponse<void>> {
    return this.post(`/posts/${postSocialId}/reactions`, {
      account_id: accountId,
      type,
    });
  }

  // ============================================
  // ACCOUNTS
  // ============================================

  async verifyConnection(accountId: string): Promise<{ connected: boolean; error?: string }> {
    const result = await this.get<{ id: string; status: string }>(`/accounts/${accountId}`);
    if (result.error) {
      return { connected: false, error: result.error };
    }
    return { connected: true };
  }

  async deleteAccount(accountId: string): Promise<ApiResponse<void>> {
    return this.delete(`/accounts/${accountId}`);
  }
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
