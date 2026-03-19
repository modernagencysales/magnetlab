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

// ─── Connection Management Types ─────────────────────────────────────────

interface UnipileInvitation {
  id: string;
  provider_id?: string;
  sender?: {
    id?: string;
    provider_id?: string;
    name?: string;
    headline?: string;
  };
  message?: string;
  created_at?: string;
}

interface UnipileInvitationListResponse {
  items: UnipileInvitation[];
  cursor?: string;
}

interface UnipileUserProfile {
  id: string;
  provider_id: string;
  public_identifier?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
}

interface UnipileChatResponse {
  chat_id: string;
  account_id: string;
}

// ─── Chat Listing Types ───────────────────────────────────────────────────

export interface UnipileChatAttendee {
  id?: string;
  provider_id?: string;
  name?: string;
}

export interface UnipileChat {
  id: string;
  account_id?: string;
  attendees?: UnipileChatAttendee[];
  last_message_at?: string;
  unread_count?: number;
}

interface UnipileChatListResponse {
  items: UnipileChat[];
  cursor?: string;
}

export interface UnipileChatMessage {
  id: string;
  sender_id?: string;
  text?: string;
  timestamp?: string;
  created_at?: string;
}

interface UnipileMessageListResponse {
  items: UnipileChatMessage[];
  cursor?: string;
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

  async addComment(
    postSocialId: string,
    accountId: string,
    text: string,
    options?: {
      commentId?: string;
      mentions?: Array<{ name: string; profile_id: string }>;
    }
  ): Promise<
    ApiResponse<{
      id: string;
    }>
  > {
    const body: Record<string, unknown> = {
      account_id: accountId,
      text,
    };
    if (options?.commentId) body.comment_id = options.commentId;
    if (options?.mentions && options.mentions.length > 0) body.mentions = options.mentions;
    return this.post(`/posts/${postSocialId}/comments`, body);
  }

  async addReaction(
    postSocialId: string,
    accountId: string,
    type: string = 'LIKE'
  ): Promise<ApiResponse<void>> {
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

  // ─── Connection Management ───────────────────────────────────────────

  async listReceivedInvitations(accountId: string): Promise<ApiResponse<UnipileInvitation[]>> {
    const result = await this.get<UnipileInvitationListResponse>(
      `/users/invite/received?account_id=${encodeURIComponent(accountId)}`
    );
    if (result.error || !result.data) {
      return { data: null, error: result.error, status: result.status };
    }
    return { data: result.data.items ?? [], error: null, status: result.status };
  }

  async handleInvitation(
    invitationId: string,
    action: 'accept' | 'decline'
  ): Promise<ApiResponse<void>> {
    return this.post<void>(`/users/invite/received/${encodeURIComponent(invitationId)}`, {
      action,
    });
  }

  // ─── Profile Resolution ──────────────────────────────────────────────

  async resolveLinkedInProfile(
    accountId: string,
    linkedinUsername: string
  ): Promise<ApiResponse<UnipileUserProfile>> {
    return this.get<UnipileUserProfile>(
      `/users/${encodeURIComponent(linkedinUsername)}?account_id=${encodeURIComponent(accountId)}`
    );
  }

  // ─── Messaging ───────────────────────────────────────────────────────

  async sendDirectMessage(
    accountId: string,
    recipientProviderId: string,
    text: string
  ): Promise<ApiResponse<UnipileChatResponse>> {
    return this.post<UnipileChatResponse>('/chats', {
      account_id: accountId,
      attendees_ids: [recipientProviderId],
      text,
    });
  }

  async sendConnectionRequest(
    accountId: string,
    recipientProviderId: string,
    message?: string
  ): Promise<ApiResponse<void>> {
    const body: Record<string, unknown> = {
      account_id: accountId,
      provider_id: recipientProviderId,
    };
    if (message) body.message = message;
    return this.post<void>('/users/invite', body);
  }

  // ─── Chat Read Operations (reply detection) ──────────────────────────

  /**
   * List recent chats for an account. Used for reply detection.
   * Returns an array of chats with attendees for matching against known leads.
   */
  async listChats(accountId: string, limit = 100): Promise<ApiResponse<UnipileChat[]>> {
    const result = await this.get<UnipileChatListResponse>(
      `/chats?account_id=${encodeURIComponent(accountId)}&limit=${limit}`
    );
    if (result.error || !result.data) {
      return { data: null, error: result.error, status: result.status };
    }
    return { data: result.data.items ?? [], error: null, status: result.status };
  }

  /**
   * Get messages for a specific chat. Used to detect replies after a sent DM.
   */
  async getChatMessages(chatId: string, limit = 50): Promise<ApiResponse<UnipileChatMessage[]>> {
    const result = await this.get<UnipileMessageListResponse>(
      `/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}`
    );
    if (result.error || !result.data) {
      return { data: null, error: result.error, status: result.status };
    }
    return { data: result.data.items ?? [], error: null, status: result.status };
  }
  // ─── Invitation Management ──────────────────────────────────────────

  async listSentInvitations(accountId: string): Promise<ApiResponse<UnipileInvitation[]>> {
    const result = await this.get<UnipileInvitationListResponse>(
      `/users/invite/sent?account_id=${encodeURIComponent(accountId)}`
    );
    if (result.error || !result.data) {
      return { data: null, error: result.error, status: result.status };
    }
    return { data: result.data.items ?? [], error: null, status: result.status };
  }

  async cancelInvitation(invitationId: string): Promise<ApiResponse<void>> {
    return this.delete(`/users/invite/${encodeURIComponent(invitationId)}`);
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
