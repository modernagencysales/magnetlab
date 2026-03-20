/** Outreach campaign validation schemas. Matches types in lib/types/outreach-campaigns.ts. */

import { z } from 'zod';

// ─── Constants ──────────────────────────────────────────────────────────

const PRESETS = ['warm_connect', 'direct_connect', 'nurture'] as const;

// ─── Campaign Schemas ───────────────────────────────────────────────────

export const CreateOutreachCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  preset: z.enum(PRESETS),
  unipile_account_id: z.string().min(1, 'LinkedIn account is required'),
  first_message_template: z.string().min(1, 'First message template is required'),
  connect_message: z.string().max(300).optional(),
  follow_up_template: z.string().optional(),
  follow_up_delay_days: z.number().int().min(1).max(30).optional(),
  withdraw_delay_days: z.number().int().min(1).max(90).optional(),
});

export const UpdateOutreachCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  connect_message: z.string().max(300).nullable().optional(),
  first_message_template: z.string().min(1).optional(),
  follow_up_template: z.string().nullable().optional(),
  follow_up_delay_days: z.number().int().min(1).max(30).optional(),
  withdraw_delay_days: z.number().int().min(1).max(90).optional(),
});

// ─── Lead Schemas ───────────────────────────────────────────────────────

export const AddOutreachLeadSchema = z.object({
  linkedin_url: z
    .string()
    .url('Must be a valid URL')
    .refine((url) => url.includes('linkedin.com/in/'), 'Must be a LinkedIn profile URL'),
  name: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
});

export const AddOutreachLeadsBatchSchema = z.object({
  leads: z.array(AddOutreachLeadSchema).min(1, 'At least one lead required').max(1000),
});
