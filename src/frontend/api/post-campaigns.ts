/**
 * Post Campaigns API (client). Routes: /api/post-campaigns/*
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { apiClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PostCampaignSummary {
  id: string;
  name: string;
  postUrl: string;
  status: string;
  leadsDetected: number;
  connectionsAccepted: number;
  dmsSent: number;
  createdAt: string;
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

export interface PostCampaignLead {
  id: string;
  name: string | null;
  linkedinUrl: string;
  status: string;
  matchType: string;
  commentText: string | null;
  location: string | null;
  detectedAt: string;
  repliedAt: string | null;
  connectionAcceptedAt: string | null;
  dmSentAt: string | null;
  error: string | null;
}

export interface CreateCampaignInput {
  name: string;
  postUrl: string;
  keywords: string[];
  unipileAccountId: string;
  dmTemplate: string;
  funnelPageId?: string;
  replyTemplate?: string;
  posterAccountId?: string;
  targetLocations?: string[];
  leadExpiryDays?: number;
  autoAcceptConnections?: boolean;
  autoConnectNonRequesters?: boolean;
}

export interface AutoSetupResult {
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
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listCampaigns(
  status?: string
): Promise<{ campaigns: PostCampaignSummary[] }> {
  const params = status ? `?status=${status}` : '';
  return apiClient.get<{ campaigns: PostCampaignSummary[] }>(`/post-campaigns${params}`);
}

export async function getCampaign(id: string): Promise<PostCampaignDetail> {
  return apiClient.get<PostCampaignDetail>(`/post-campaigns/${id}`);
}

export async function getCampaignLeads(
  id: string,
  status?: string
): Promise<{ leads: PostCampaignLead[] }> {
  const params = status ? `?status=${status}` : '';
  return apiClient.get<{ leads: PostCampaignLead[] }>(`/post-campaigns/${id}/leads${params}`);
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function createCampaign(input: CreateCampaignInput): Promise<PostCampaignDetail> {
  return apiClient.post<PostCampaignDetail>('/post-campaigns', input);
}

export async function updateCampaign(
  id: string,
  input: Partial<CreateCampaignInput>
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

export async function autoSetupCampaign(postId: string): Promise<AutoSetupResult> {
  return apiClient.post<AutoSetupResult>('/post-campaigns/auto-setup', { post_id: postId });
}
