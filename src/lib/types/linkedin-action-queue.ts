/** LinkedIn Action Queue types. Matches DB schema from migration 20260319200000. */

// ─── Action Types ────────────────────────────────────────────────────────

export type QueueActionType =
  | 'view_profile'
  | 'connect'
  | 'message'
  | 'follow_up_message'
  | 'withdraw'
  | 'accept_invitation'
  | 'react'
  | 'comment';

export type QueueActionStatus = 'queued' | 'executing' | 'completed' | 'failed' | 'cancelled';

export type QueueSourceType = 'post_campaign' | 'outreach_campaign';

// ─── Priority Constants ─────────────────────────────────────────────────

export const QUEUE_PRIORITY = {
  POST_CAMPAIGN: 1,
  OUTREACH: 10,
} as const;

export const MAX_ACTIONS_PER_RUN = 3;

// ─── Database Row Types ─────────────────────────────────────────────────

export interface QueuedAction {
  id: string;
  user_id: string;
  unipile_account_id: string;
  action_type: QueueActionType;
  target_provider_id: string | null;
  target_linkedin_url: string | null;
  payload: Record<string, unknown>;
  priority: number;
  source_type: QueueSourceType;
  source_campaign_id: string;
  source_lead_id: string;
  status: QueueActionStatus;
  processed: boolean;
  attempts: number;
  error: string | null;
  result: Record<string, unknown> | null;
  executed_at: string | null;
  created_at: string;
}

// ─── Input Types ────────────────────────────────────────────────────────

export interface EnqueueActionInput {
  user_id: string;
  unipile_account_id: string;
  action_type: QueueActionType;
  target_provider_id?: string;
  target_linkedin_url?: string;
  payload: Record<string, unknown>;
  priority: number;
  source_type: QueueSourceType;
  source_campaign_id: string;
  source_lead_id: string;
}

// ─── Column Constants ───────────────────────────────────────────────────

export const QUEUE_ACTION_COLUMNS =
  'id, user_id, unipile_account_id, action_type, target_provider_id, target_linkedin_url, payload, priority, source_type, source_campaign_id, source_lead_id, status, processed, attempts, error, result, executed_at, created_at' as const;

// ─── Activity Log ───────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string;
  user_id: string;
  unipile_account_id: string;
  action_type: string;
  target_provider_id: string | null;
  target_linkedin_url: string | null;
  source_type: QueueSourceType;
  source_campaign_id: string;
  source_lead_id: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  created_at: string;
}

export const ACTIVITY_LOG_COLUMNS =
  'id, user_id, unipile_account_id, action_type, target_provider_id, target_linkedin_url, source_type, source_campaign_id, source_lead_id, payload, result, created_at' as const;
