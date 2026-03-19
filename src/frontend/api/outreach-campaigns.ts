/**
 * Outreach Campaigns API (client). Routes: /api/outreach-campaigns/*
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { apiClient } from './client';
import type {
  OutreachCampaign,
  OutreachCampaignStats,
  OutreachCampaignProgress,
  OutreachCampaignStatus,
  OutreachPreset,
  CreateOutreachCampaignInput,
  AddOutreachLeadInput,
  OutreachLeadStatus,
} from '@/lib/types/outreach-campaigns';

// Re-export for consumers that import from this module
export type { CreateOutreachCampaignInput, AddOutreachLeadInput } from '@/lib/types/outreach-campaigns';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OutreachCampaignSummary {
  id: string;
  name: string;
  preset: OutreachPreset;
  status: OutreachCampaignStatus;
  unipile_account_id: string;
  created_at: string;
  updated_at: string;
}

export interface OutreachCampaignDetail extends OutreachCampaign {
  stats: OutreachCampaignStats;
  progress: OutreachCampaignProgress;
}

export interface OutreachLeadSummary {
  id: string;
  linkedin_url: string;
  linkedin_username: string | null;
  name: string | null;
  company: string | null;
  status: OutreachLeadStatus;
  current_step_order: number;
  viewed_at: string | null;
  connect_sent_at: string | null;
  connected_at: string | null;
  messaged_at: string | null;
  follow_up_sent_at: string | null;
  withdrawn_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listCampaigns(
  status?: string
): Promise<{ campaigns: OutreachCampaignSummary[]; total: number }> {
  const qs = status ? `?status=${status}` : '';
  const res = await apiClient.get<{ campaigns: OutreachCampaignSummary[]; total?: number }>(
    `/outreach-campaigns${qs}`
  );
  return { campaigns: res.campaigns, total: res.total ?? res.campaigns.length };
}

export async function getCampaign(
  id: string
): Promise<{ campaign: OutreachCampaignDetail }> {
  return apiClient.get(`/outreach-campaigns/${id}`);
}

export async function getCampaignLeads(
  id: string,
  status?: string
): Promise<{ leads: OutreachLeadSummary[] }> {
  const qs = status ? `?status=${status}` : '';
  return apiClient.get<{ leads: OutreachLeadSummary[] }>(`/outreach-campaigns/${id}/leads${qs}`);
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function createCampaign(
  input: CreateOutreachCampaignInput
): Promise<{ campaign: OutreachCampaign }> {
  return apiClient.post<{ campaign: OutreachCampaign }>('/outreach-campaigns', input);
}

export async function activateCampaign(id: string): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(`/outreach-campaigns/${id}/activate`);
}

export async function pauseCampaign(id: string): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(`/outreach-campaigns/${id}/pause`);
}

export async function deleteCampaign(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/outreach-campaigns/${id}`);
}

export async function addLeads(
  id: string,
  leads: AddOutreachLeadInput[]
): Promise<{ added: number; skipped: number }> {
  return apiClient.post<{ added: number; skipped: number }>(
    `/outreach-campaigns/${id}/leads`,
    { leads }
  );
}

export async function skipLead(
  campaignId: string,
  leadId: string
): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(
    `/outreach-campaigns/${campaignId}/leads/${leadId}/skip`
  );
}
