/** Post Campaign Automation types. Matches DB schema from migration 20260316200000. */

// ─── Status Types ────────────────────────────────────────────────────────

export type PostCampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export type PostCampaignLeadStatus =
  | 'detected'
  | 'connection_pending'
  | 'connection_accepted'
  | 'dm_queued'
  | 'dm_sent'
  | 'dm_failed'
  | 'skipped';

// ─── Database Row Types ──────────────────────────────────────────────────

export interface PostCampaign {
  id: string;
  user_id: string;
  team_id: string | null;
  name: string;
  post_url: string;
  keywords: string[];
  unipile_account_id: string;
  sender_name: string | null;
  dm_template: string;
  connect_message_template: string | null;
  funnel_page_id: string | null;
  auto_accept_connections: boolean;
  auto_like_comments: boolean;
  auto_connect_non_requesters: boolean;
  status: PostCampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface PostCampaignLead {
  id: string;
  user_id: string;
  campaign_id: string;
  signal_lead_id: string | null;
  linkedin_url: string;
  linkedin_username: string | null;
  unipile_provider_id: string | null;
  name: string | null;
  comment_text: string | null;
  status: PostCampaignLeadStatus;
  detected_at: string;
  connection_accepted_at: string | null;
  dm_sent_at: string | null;
  error: string | null;
}

export interface LinkedInDailyLimit {
  id: string;
  user_id: string;
  unipile_account_id: string;
  date: string;
  dms_sent: number;
  connections_accepted: number;
  connection_requests_sent: number;
  comments_sent: number;
  likes_sent: number;
}

// ─── Input Types ─────────────────────────────────────────────────────────

export interface CreatePostCampaignInput {
  name: string;
  post_url: string;
  keywords: string[];
  unipile_account_id: string;
  sender_name?: string;
  dm_template: string;
  connect_message_template?: string;
  funnel_page_id?: string;
  auto_accept_connections?: boolean;
  auto_like_comments?: boolean;
  auto_connect_non_requesters?: boolean;
}

export interface UpdatePostCampaignInput {
  name?: string;
  keywords?: string[];
  dm_template?: string;
  connect_message_template?: string;
  funnel_page_id?: string | null;
  auto_accept_connections?: boolean;
  auto_like_comments?: boolean;
  auto_connect_non_requesters?: boolean;
}

// ─── DM Template Rendering ───────────────────────────────────────────────

export interface DmTemplateVars {
  name: string;
  funnel_url: string;
}

// ─── Column Constants ────────────────────────────────────────────────────

export const POST_CAMPAIGN_COLUMNS =
  'id, user_id, team_id, name, post_url, keywords, unipile_account_id, sender_name, dm_template, connect_message_template, funnel_page_id, auto_accept_connections, auto_like_comments, auto_connect_non_requesters, status, created_at, updated_at' as const;

export const POST_CAMPAIGN_LEAD_COLUMNS =
  'id, user_id, campaign_id, signal_lead_id, linkedin_url, linkedin_username, unipile_provider_id, name, comment_text, status, detected_at, connection_accepted_at, dm_sent_at, error' as const;

// ─── Safety Constants ────────────────────────────────────────────────────

/** @deprecated Use SAFETY_DEFAULTS + getEffectiveLimits() from account-safety.service instead */
export const LINKEDIN_SAFETY = {
  MAX_DMS_PER_DAY: 80,
  MAX_ACCEPTS_PER_DAY: 100,
  MAX_CONNECT_REQUESTS_PER_DAY: 20,
  MIN_DELAY_BETWEEN_DMS_MS: 60_000,
  MAX_DELAY_BETWEEN_DMS_MS: 180_000,
  MIN_DELAY_BETWEEN_ACCEPTS_MS: 45_000,
  MAX_DELAY_BETWEEN_ACCEPTS_MS: 120_000,
  MAX_ACTIONS_PER_RUN: 3,
  POLL_JITTER_MINUTES: 5,
} as const;

// ─── Account Safety ──────────────────────────────────────────────────────────

export interface AccountSafetySettings {
  id: string;
  userId: string;
  unipileAccountId: string;
  operatingHoursStart: string; // HH:MM
  operatingHoursEnd: string;
  timezone: string;
  maxDmsPerDay: number;
  maxConnectionRequestsPerDay: number;
  maxConnectionAcceptsPerDay: number;
  maxCommentsPerDay: number;
  maxLikesPerDay: number;
  minActionDelayMs: number;
  maxActionDelayMs: number;
  accountConnectedAt: string | null;
  circuitBreakerUntil: string | null;
}

export interface SafetyLimitsInput {
  maxDmsPerDay?: number;
  maxConnectionRequestsPerDay?: number;
  maxConnectionAcceptsPerDay?: number;
  maxCommentsPerDay?: number;
  maxLikesPerDay?: number;
  minActionDelayMs?: number;
  maxActionDelayMs?: number;
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  timezone?: string;
}

/** Default limits — replaces old LINKEDIN_SAFETY constants with more conservative values */
export const SAFETY_DEFAULTS = {
  maxDmsPerDay: 50,
  maxConnectionRequestsPerDay: 10,
  maxConnectionAcceptsPerDay: 80,
  maxCommentsPerDay: 30,
  maxLikesPerDay: 60,
  minActionDelayMs: 45_000,
  maxActionDelayMs: 210_000,
  operatingHoursStart: '08:00',
  operatingHoursEnd: '19:00',
  timezone: 'America/New_York',
} as const;

export type ActionType = 'dm' | 'connection_request' | 'connection_accept' | 'comment' | 'like';

/** High-risk actions get warm-up ramp applied */
export const HIGH_RISK_ACTIONS: ActionType[] = ['dm', 'connection_request'];
