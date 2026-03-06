/**
 * LinkedIn automations API (client). Routes: /api/linkedin/automations, /api/linkedin/automations/[id], reply.
 */

import { apiClient } from '../client';

export interface Automation {
  id: string;
  user_id: string;
  name: string;
  post_id: string | null;
  post_social_id: string | null;
  keywords: string[];
  dm_template: string | null;
  auto_connect: boolean;
  auto_like: boolean;
  comment_reply_template: string | null;
  enable_follow_up: boolean;
  follow_up_template: string | null;
  follow_up_delay_minutes: number;
  status: 'draft' | 'running' | 'paused';
  unipile_account_id: string | null;
  leads_captured: number;
  plusvibe_campaign_id: string | null;
  opt_in_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAutomationBody {
  name: string;
  postId?: string | null;
  postSocialId?: string | null;
  keywords?: string[];
  dmTemplate?: string | null;
  autoConnect?: boolean;
  autoLike?: boolean;
  commentReplyTemplate?: string | null;
  plusvibeCampaignId?: string | null;
  optInUrl?: string | null;
  enableFollowUp?: boolean;
  followUpTemplate?: string | null;
  followUpDelayMinutes?: number;
}

export async function listAutomations(): Promise<{ automations: Automation[] }> {
  return apiClient.get<{ automations: Automation[] }>('/linkedin/automations');
}

export async function getAutomation(id: string): Promise<{
  automation: Automation;
  events: unknown[];
}> {
  return apiClient.get<{ automation: Automation; events: unknown[] }>(
    `/linkedin/automations/${id}`
  );
}

export async function createAutomation(
  body: CreateAutomationBody
): Promise<{ automation: Automation }> {
  return apiClient.post<{ automation: Automation }>('/linkedin/automations', body);
}

export async function updateAutomation(
  id: string,
  body: Partial<CreateAutomationBody> & { status?: 'draft' | 'running' | 'paused' }
): Promise<{ automation: Automation }> {
  return apiClient.patch<{ automation: Automation }>(`/linkedin/automations/${id}`, body);
}

export async function deleteAutomation(id: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/linkedin/automations/${id}`);
}

export async function sendReply(
  automationId: string,
  payload: { commentSocialId: string; text: string; commenterName?: string }
): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(
    `/linkedin/automations/${automationId}/reply`,
    payload
  );
}
