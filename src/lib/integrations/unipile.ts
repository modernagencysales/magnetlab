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
      api_url: `https://${this.dsn}/api/v1`,
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

  async getPost(postId: string, accountId?: string): Promise<ApiResponse<UnipilePostStats>> {
    const monitorId = accountId || getMonitorAccountId();
    if (!monitorId) {
      return { data: null, error: 'No monitor account configured', status: 0 };
    }
    return this.get<UnipilePostStats>(`/posts/${postId}?account_id=${monitorId}`);
  }

  async getPostComments(postId: string, accountId?: string, cursor?: string): Promise<ApiResponse<{
    items: Array<{
      id: string;
      text: string;
      author: { name: string; provider_id: string };
      created_at: string;
    }>;
    cursor?: string;
  }>> {
    const monitorId = accountId || getMonitorAccountId();
    if (!monitorId) {
      return { data: null, error: 'No monitor account configured', status: 0 };
    }
    const params = new URLSearchParams({ account_id: monitorId });
    if (cursor) params.set('cursor', cursor);
    return this.get(`/posts/${postId}/comments?${params}`);
  }

  async getPostReactions(postId: string, accountId?: string, cursor?: string): Promise<ApiResponse<{
    items: Array<{
      type: string;
      author: { name: string; provider_id: string };
    }>;
    cursor?: string;
  }>> {
    const monitorId = accountId || getMonitorAccountId();
    if (!monitorId) {
      return { data: null, error: 'No monitor account configured', status: 0 };
    }
    const params = new URLSearchParams({ account_id: monitorId });
    if (cursor) params.set('cursor', cursor);
    return this.get(`/posts/${postId}/reactions?${params}`);
  }

  async getUserProfile(providerId: string, accountId?: string): Promise<ApiResponse<{
    id: string;
    provider_id: string;
    name: string;
    first_name?: string;
    last_name?: string;
    public_identifier?: string;
    headline?: string;
  }>> {
    const monitorId = accountId || getMonitorAccountId();
    if (!monitorId) {
      return { data: null, error: 'No monitor account configured', status: 0 };
    }
    return this.get(`/users/${providerId}?account_id=${monitorId}`);
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
