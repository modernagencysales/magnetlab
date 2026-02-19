// Email System Types & Zod Schemas for MagnetLab
//
// Types for email flows, subscribers, broadcasts, and their Zod validation schemas.

import { z } from 'zod';

// ============================================
// TYPE ALIASES
// ============================================

export type EmailFlowStatus = 'draft' | 'active' | 'paused';
export type EmailFlowTriggerType = 'lead_magnet' | 'manual';
export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced';
export type SubscriberSource = 'lead_magnet' | 'manual' | 'import';
export type FlowContactStatus = 'active' | 'completed' | 'paused' | 'unsubscribed';
export type BroadcastStatus = 'draft' | 'sending' | 'sent' | 'failed';

// ============================================
// INTERFACES
// ============================================

export interface EmailFlow {
  id: string;
  team_id: string;
  user_id: string;
  name: string;
  description: string | null;
  trigger_type: EmailFlowTriggerType;
  trigger_lead_magnet_id: string | null;
  status: EmailFlowStatus;
  created_at: string;
  updated_at: string;
}

export interface EmailFlowStep {
  id: string;
  flow_id: string;
  step_number: number;
  subject: string;
  body: string;
  delay_days: number;
  created_at: string;
  updated_at: string;
}

export interface EmailFlowWithSteps extends EmailFlow {
  steps: EmailFlowStep[];
}

export interface EmailSubscriber {
  id: string;
  team_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: SubscriberStatus;
  source: SubscriberSource;
  source_id: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export interface EmailFlowContact {
  id: string;
  team_id: string;
  flow_id: string;
  subscriber_id: string;
  current_step: number;
  status: FlowContactStatus;
  entered_at: string;
  last_sent_at: string | null;
  trigger_task_id: string | null;
}

export interface AudienceFilter {
  engagement?: 'opened_30d' | 'opened_60d' | 'opened_90d' | 'clicked_30d' | 'clicked_60d' | 'clicked_90d' | 'never_opened';
  source?: string;
  subscribed_after?: string;
  subscribed_before?: string;
}

export interface EmailBroadcast {
  id: string;
  team_id: string;
  user_id: string;
  subject: string;
  body: string;
  status: BroadcastStatus;
  audience_filter: AudienceFilter | null;
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// ZOD SCHEMAS
// ============================================

// --- Email Flows ---

export const createFlowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
  trigger_type: z.enum(['lead_magnet', 'manual']),
  trigger_lead_magnet_id: z.string().uuid('Invalid lead magnet ID format').optional(),
});

export type CreateFlowInput = z.infer<typeof createFlowSchema>;

export const updateFlowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').optional(),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
  status: z.enum(['draft', 'active', 'paused']).optional(),
  trigger_type: z.enum(['lead_magnet', 'manual']).optional(),
  trigger_lead_magnet_id: z.string().uuid('Invalid lead magnet ID format').nullable().optional(),
});

export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;

// --- Email Flow Steps ---

export const createStepSchema = z.object({
  step_number: z.number().int('Step number must be an integer').min(0, 'Step number must be 0 or greater'),
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be 500 characters or less'),
  body: z.string().min(1, 'Body is required'),
  delay_days: z.number().int('Delay days must be an integer').min(0, 'Delay must be 0 or greater').max(365, 'Delay must be 365 days or less'),
});

export type CreateStepInput = z.infer<typeof createStepSchema>;

export const updateStepSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be 500 characters or less').optional(),
  body: z.string().min(1, 'Body is required').optional(),
  delay_days: z.number().int('Delay days must be an integer').min(0, 'Delay must be 0 or greater').max(365, 'Delay must be 365 days or less').optional(),
  step_number: z.number().int('Step number must be an integer').min(0, 'Step number must be 0 or greater').optional(),
});

export type UpdateStepInput = z.infer<typeof updateStepSchema>;

// --- Subscribers ---

export const createSubscriberSchema = z.object({
  email: z.string().email('Invalid email format').transform((email) => email.toLowerCase().trim()),
  first_name: z.string().max(200, 'First name must be 200 characters or less').optional(),
  last_name: z.string().max(200, 'Last name must be 200 characters or less').optional(),
});

export type CreateSubscriberInput = z.infer<typeof createSubscriberSchema>;

// --- Audience Filter ---

export const audienceFilterSchema = z.object({
  engagement: z.enum([
    'opened_30d', 'opened_60d', 'opened_90d',
    'clicked_30d', 'clicked_60d', 'clicked_90d',
    'never_opened',
  ]).optional(),
  source: z.string().optional(),
  subscribed_after: z.string().datetime('Invalid datetime format').optional(),
  subscribed_before: z.string().datetime('Invalid datetime format').optional(),
}).optional();

export type AudienceFilterInput = z.infer<typeof audienceFilterSchema>;

// --- Broadcasts ---

export const createBroadcastSchema = z.object({
  subject: z.string().max(500, 'Subject must be 500 characters or less').optional(),
  body: z.string().optional(),
});

export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;

export const updateBroadcastSchema = z.object({
  subject: z.string().max(500, 'Subject must be 500 characters or less').optional(),
  body: z.string().optional(),
  audience_filter: audienceFilterSchema.nullable().optional(),
});

export type UpdateBroadcastInput = z.infer<typeof updateBroadcastSchema>;
