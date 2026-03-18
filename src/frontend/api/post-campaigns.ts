/**
 * Post Campaigns API (client). Routes: /api/post-campaigns/*
 * Never imports server-only modules. Used by dashboard components.
 */

import { apiClient } from './client';
import type {
  PostCampaign,
  PostCampaignLead,
  PostCampaignStatus,
  CreatePostCampaignInput,
  UpdatePostCampaignInput,
} from '@/lib/types/post-campaigns';

// ─── Types ──────────────────────────────────────────────

export interface ListCampaignsParams {
  status?: PostCampaignStatus;
  page?: number;
  limit?: number;
}

export interface ListCampaignsResponse {
  campaigns: PostCampaign[];
  total: number;
}

export interface CampaignDetailResponse {
  campaign: PostCampaign;
  leads: PostCampaignLead[];
  stats: {
    detected: number;
    connection_pending: number;
    connection_accepted: number;
    dm_sent: number;
  };
}

export interface AutoSetupResult {
  keywords: string[];
  funnel_page_id: string | null;
  funnel_name: string | null;
  sender_account_id: string | null;
  sender_account_name: string | null;
  dm_template: string;
  connect_message_template: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface SenderAccount {
  id: string;
  name: string;
  provider: string;
}

export interface FunnelOption {
  id: string;
  slug: string;
  name: string;
}

// ─── Campaign CRUD ──────────────────────────────────────

export async function listCampaigns(
  params: ListCampaignsParams = {}
): Promise<ListCampaignsResponse> {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.page != null) sp.set('page', String(params.page));
  if (params.limit != null) sp.set('limit', String(params.limit));
  const query = sp.toString();
  return apiClient.get<ListCampaignsResponse>(
    `/post-campaigns${query ? `?${query}` : ''}`
  );
}

export async function getCampaign(id: string): Promise<CampaignDetailResponse> {
  return apiClient.get<CampaignDetailResponse>(`/post-campaigns/${id}`);
}

export async function createCampaign(
  body: CreatePostCampaignInput
): Promise<{ campaign: PostCampaign }> {
  return apiClient.post<{ campaign: PostCampaign }>('/post-campaigns', body);
}

export async function updateCampaign(
  id: string,
  body: UpdatePostCampaignInput
): Promise<{ campaign: PostCampaign }> {
  return apiClient.patch<{ campaign: PostCampaign }>(
    `/post-campaigns/${id}`,
    body
  );
}

export async function deleteCampaign(id: string): Promise<void> {
  await apiClient.delete(`/post-campaigns/${id}`);
}

// ─── Status actions ─────────────────────────────────────

export async function activateCampaign(
  id: string
): Promise<{ campaign: PostCampaign }> {
  return apiClient.post<{ campaign: PostCampaign }>(
    `/post-campaigns/${id}/activate`
  );
}

export async function pauseCampaign(
  id: string
): Promise<{ campaign: PostCampaign }> {
  return apiClient.post<{ campaign: PostCampaign }>(
    `/post-campaigns/${id}/pause`
  );
}

// ─── Auto-setup ─────────────────────────────────────────

export async function autoSetup(
  postUrl: string
): Promise<{ result: AutoSetupResult }> {
  return apiClient.post<{ result: AutoSetupResult }>(
    '/post-campaigns/auto-setup',
    { post_url: postUrl }
  );
}

// ─── Reference data ─────────────────────────────────────

export async function listSenderAccounts(): Promise<{
  accounts: SenderAccount[];
}> {
  return apiClient.get<{ accounts: SenderAccount[] }>(
    '/post-campaigns/sender-accounts'
  );
}

export async function listFunnelOptions(): Promise<{
  funnels: FunnelOption[];
}> {
  return apiClient.get<{ funnels: FunnelOption[] }>(
    '/post-campaigns/funnel-options'
  );
}
