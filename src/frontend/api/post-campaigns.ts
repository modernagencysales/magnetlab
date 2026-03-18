/**
 * Post Campaigns API (client). Routes: /api/post-campaigns/*
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { apiClient } from './client';
import type {
  PostCampaign,
  PostCampaignLead,
  PostCampaignStatus,
  CreatePostCampaignInput,
} from '@/lib/types/post-campaigns';

// Re-export for consumers that import from this module
export type { PostCampaignLead } from '@/lib/types/post-campaigns';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PostCampaignSummary {
  id: string;
  name: string;
  postUrl: string;
  post_url: string;
  status: PostCampaignStatus;
  leadsDetected: number;
  connectionsAccepted: number;
  dmsSent: number;
  createdAt: string;
  /** Inline stats for list view */
  stats?: {
    detected: number;
    connection_accepted: number;
    dm_sent: number;
  };
}

export interface PostCampaignDetail extends PostCampaignSummary {
  keywords: string[];
  unipileAccountId: string;
  senderName: string | null;
  dmTemplate: string;
  replyTemplate: string | null;
  posterAccountId: string | null;
  funnelPageId: string | null;
  targetLocations: string[];
  leadExpiryDays: number;
  autoAcceptConnections: boolean;
  autoLikeComments: boolean;
  autoConnectNonRequesters: boolean;
}

export interface FunnelOption {
  id: string;
  name: string | null;
  slug: string;
}

export interface SenderAccount {
  id: string;
  name: string | null;
  email: string | null;
}

export interface AutoSetupResult {
  // camelCase (original API response)
  keyword: string;
  funnelPageId: string | null;
  funnelName: string | null;
  deliveryAccountId: string;
  deliveryAccountName: string;
  posterAccountId: string;
  replyTemplate: string;
  dmTemplate: string;
  confidence: 'high' | 'medium' | 'low';
  needsUserInput: string[];
  // snake_case aliases (used by UI components)
  keywords: string[];
  sender_account_id: string | null;
  sender_account_name: string | null;
  dm_template: string;
  connect_message_template: string;
  funnel_page_id: string | null;
  funnel_name: string | null;
}

export interface ListCampaignsParams {
  status?: string;
  page?: number;
  limit?: number;
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listCampaigns(
  params?: ListCampaignsParams | string
): Promise<{ campaigns: PostCampaignSummary[]; total: number }> {
  let qs = '';
  if (typeof params === 'string') {
    qs = params ? `?status=${params}` : '';
  } else if (params) {
    const parts: string[] = [];
    if (params.status) parts.push(`status=${params.status}`);
    if (params.page !== undefined) parts.push(`page=${params.page}`);
    if (params.limit !== undefined) parts.push(`limit=${params.limit}`);
    if (parts.length) qs = `?${parts.join('&')}`;
  }
  const res = await apiClient.get<{ campaigns: PostCampaignSummary[]; total?: number }>(
    `/post-campaigns${qs}`
  );
  return { campaigns: res.campaigns, total: res.total ?? res.campaigns.length };
}

export async function getCampaign(
  id: string
): Promise<{ campaign: PostCampaign; leads: PostCampaignLead[]; stats: Record<string, number> }> {
  return apiClient.get(`/post-campaigns/${id}`);
}

export async function getCampaignLeads(
  id: string,
  status?: string
): Promise<{ leads: PostCampaignLead[] }> {
  const params = status ? `?status=${status}` : '';
  return apiClient.get<{ leads: PostCampaignLead[] }>(`/post-campaigns/${id}/leads${params}`);
}

export async function listFunnelOptions(): Promise<{ funnels: FunnelOption[] }> {
  return apiClient.get<{ funnels: FunnelOption[] }>('/post-campaigns/funnel-options');
}

export async function listSenderAccounts(): Promise<{ accounts: SenderAccount[] }> {
  return apiClient.get<{ accounts: SenderAccount[] }>('/post-campaigns/sender-accounts');
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function createCampaign(
  input: CreatePostCampaignInput
): Promise<{ campaign: PostCampaign }> {
  return apiClient.post<{ campaign: PostCampaign }>('/post-campaigns', input);
}

export async function updateCampaign(
  id: string,
  input: Partial<CreatePostCampaignInput>
): Promise<PostCampaignDetail> {
  return apiClient.patch<PostCampaignDetail>(`/post-campaigns/${id}`, input);
}

export async function activateCampaign(id: string): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(`/post-campaigns/${id}/activate`);
}

export async function pauseCampaign(id: string): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(`/post-campaigns/${id}/pause`);
}

export async function deleteCampaign(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/post-campaigns/${id}`);
}

/** Auto-setup from a post URL. Returns a normalized AutoSetupResult with both camelCase and snake_case fields. */
export async function autoSetup(postUrl: string): Promise<{ result: AutoSetupResult }> {
  const raw = await apiClient.post<{
    keyword?: string;
    keywords?: string[];
    funnelPageId?: string | null;
    funnelName?: string | null;
    deliveryAccountId?: string;
    deliveryAccountName?: string;
    posterAccountId?: string;
    replyTemplate?: string;
    dmTemplate?: string;
    dm_template?: string;
    confidence?: 'high' | 'medium' | 'low';
    needsUserInput?: string[];
  }>('/post-campaigns/auto-setup', { post_url: postUrl });

  const result: AutoSetupResult = {
    keyword: raw.keyword ?? raw.keywords?.[0] ?? '',
    funnelPageId: raw.funnelPageId ?? null,
    funnelName: raw.funnelName ?? null,
    deliveryAccountId: raw.deliveryAccountId ?? '',
    deliveryAccountName: raw.deliveryAccountName ?? '',
    posterAccountId: raw.posterAccountId ?? '',
    replyTemplate: raw.replyTemplate ?? '',
    dmTemplate: raw.dmTemplate ?? raw.dm_template ?? '',
    confidence: raw.confidence ?? 'low',
    needsUserInput: raw.needsUserInput ?? [],
    // snake_case
    keywords: raw.keywords ?? (raw.keyword ? [raw.keyword] : []),
    sender_account_id: raw.deliveryAccountId ?? null,
    sender_account_name: raw.deliveryAccountName ?? null,
    dm_template: raw.dmTemplate ?? raw.dm_template ?? '',
    connect_message_template: '',
    funnel_page_id: raw.funnelPageId ?? null,
    funnel_name: raw.funnelName ?? null,
  };
  return { result };
}

/** @deprecated Use autoSetup(postUrl) */
export async function autoSetupCampaign(postId: string): Promise<AutoSetupResult> {
  const { result } = await autoSetup(postId);
  return result;
}
