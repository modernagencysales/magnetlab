/** Outreach Campaign types. Matches DB schema from migration 20260319300000. */

// ─── Status Types ────────────────────────────────────────────────────────

export type OutreachPreset = 'warm_connect' | 'direct_connect' | 'nurture';

export type OutreachCampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export type OutreachLeadStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'replied'
  | 'withdrawn'
  | 'failed'
  | 'skipped';

export type StepActionType =
  | 'view_profile'
  | 'connect'
  | 'message'
  | 'follow_up_message'
  | 'withdraw';

export type StepTrigger = 'previous_completed' | 'connection_accepted' | 'no_reply';

// ─── Database Row Types ──────────────────────────────────────────────────

export interface OutreachCampaign {
  id: string;
  user_id: string;
  team_id: string | null;
  name: string;
  preset: OutreachPreset;
  unipile_account_id: string;
  connect_message: string | null;
  first_message_template: string;
  follow_up_template: string | null;
  follow_up_delay_days: number;
  withdraw_delay_days: number;
  status: OutreachCampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface OutreachCampaignStep {
  id: string;
  campaign_id: string;
  step_order: number;
  action_type: StepActionType;
  delay_days: number;
  delay_hours: number;
  trigger: StepTrigger;
  config: Record<string, unknown>;
}

export interface OutreachCampaignLead {
  id: string;
  user_id: string;
  campaign_id: string;
  linkedin_url: string;
  linkedin_username: string | null;
  unipile_provider_id: string | null;
  name: string | null;
  company: string | null;
  current_step_order: number;
  status: OutreachLeadStatus;
  step_completed_at: string | null;
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

// ─── Input Types ─────────────────────────────────────────────────────────

export interface CreateOutreachCampaignInput {
  name: string;
  preset: OutreachPreset;
  unipile_account_id: string;
  first_message_template: string;
  connect_message?: string;
  follow_up_template?: string;
  follow_up_delay_days?: number;
  withdraw_delay_days?: number;
}

export interface UpdateOutreachCampaignInput {
  name?: string;
  connect_message?: string | null;
  first_message_template?: string;
  follow_up_template?: string | null;
  follow_up_delay_days?: number;
  withdraw_delay_days?: number;
}

export interface AddOutreachLeadInput {
  linkedin_url: string;
  name?: string;
  company?: string;
}

// ─── Column Constants ────────────────────────────────────────────────────

export const OUTREACH_CAMPAIGN_COLUMNS =
  'id, user_id, team_id, name, preset, unipile_account_id, connect_message, first_message_template, follow_up_template, follow_up_delay_days, withdraw_delay_days, status, created_at, updated_at' as const;

export const OUTREACH_STEP_COLUMNS =
  'id, campaign_id, step_order, action_type, delay_days, delay_hours, trigger, config' as const;

export const OUTREACH_LEAD_COLUMNS =
  'id, user_id, campaign_id, linkedin_url, linkedin_username, unipile_provider_id, name, company, current_step_order, status, step_completed_at, viewed_at, connect_sent_at, connected_at, messaged_at, follow_up_sent_at, withdrawn_at, error, created_at, updated_at' as const;

// ─── Update Field Whitelist ──────────────────────────────────────────────

export const ALLOWED_CAMPAIGN_UPDATE_FIELDS = [
  'name',
  'connect_message',
  'first_message_template',
  'follow_up_template',
  'follow_up_delay_days',
  'withdraw_delay_days',
] as const;

// ─── Preset Definitions ─────────────────────────────────────────────────

export interface PresetStep {
  step_order: number;
  action_type: StepActionType;
  delay_days: number;
  delay_hours: number;
  trigger: StepTrigger;
}

export const PRESET_STEPS: Record<OutreachPreset, PresetStep[]> = {
  warm_connect: [
    {
      step_order: 1,
      action_type: 'view_profile',
      delay_days: 0,
      delay_hours: 0,
      trigger: 'previous_completed',
    },
    {
      step_order: 2,
      action_type: 'connect',
      delay_days: 1,
      delay_hours: 0,
      trigger: 'previous_completed',
    },
    {
      step_order: 3,
      action_type: 'message',
      delay_days: 0,
      delay_hours: 0,
      trigger: 'connection_accepted',
    },
    {
      step_order: 4,
      action_type: 'follow_up_message',
      delay_days: 3,
      delay_hours: 0,
      trigger: 'no_reply',
    },
  ],
  direct_connect: [
    {
      step_order: 1,
      action_type: 'view_profile',
      delay_days: 0,
      delay_hours: 0,
      trigger: 'previous_completed',
    },
    {
      step_order: 2,
      action_type: 'connect',
      delay_days: 0,
      delay_hours: 0,
      trigger: 'previous_completed',
    },
    {
      step_order: 3,
      action_type: 'message',
      delay_days: 0,
      delay_hours: 0,
      trigger: 'connection_accepted',
    },
    {
      step_order: 4,
      action_type: 'follow_up_message',
      delay_days: 3,
      delay_hours: 0,
      trigger: 'no_reply',
    },
  ],
  nurture: [
    {
      step_order: 1,
      action_type: 'view_profile',
      delay_days: 0,
      delay_hours: 0,
      trigger: 'previous_completed',
    },
    {
      step_order: 2,
      action_type: 'connect',
      delay_days: 3,
      delay_hours: 0,
      trigger: 'previous_completed',
    },
    {
      step_order: 3,
      action_type: 'message',
      delay_days: 0,
      delay_hours: 0,
      trigger: 'connection_accepted',
    },
    {
      step_order: 4,
      action_type: 'follow_up_message',
      delay_days: 5,
      delay_hours: 0,
      trigger: 'no_reply',
    },
  ],
};

// ─── Template Rendering ──────────────────────────────────────────────────

export interface OutreachTemplateVars {
  name: string;
  company: string;
}

// ─── Stats Types ─────────────────────────────────────────────────────────

export interface OutreachCampaignStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
  replied: number;
  withdrawn: number;
  failed: number;
  skipped: number;
}

export interface OutreachCampaignProgress {
  viewed: number;
  connect_sent: number;
  connected: number;
  messaged: number;
  follow_up_sent: number;
}
