/** DM Coach validation schemas. Matches types in lib/types/dm-coach.ts. */

import { z } from 'zod';

// ─── Constants ──────────────────────────────────────────────────────────

const GOALS = [
  'book_meeting',
  'build_relationship',
  'promote_content',
  'explore_partnership',
  'nurture_lead',
  'close_deal',
] as const;

const STAGES = [
  'unknown',
  'situation',
  'pain',
  'impact',
  'vision',
  'capability',
  'commitment',
] as const;

const STATUSES = ['active', 'paused', 'closed_won', 'closed_lost'] as const;

const ROLES = ['them', 'me'] as const;

// ─── Contact Schemas ────────────────────────────────────────────────────

export const CreateContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  linkedin_url: z.string().url('Must be a valid URL').max(500).optional(),
  headline: z.string().max(500).optional(),
  company: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  conversation_goal: z.enum(GOALS).optional(),
  notes: z.string().max(2000).optional(),
});

export const UpdateContactSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  linkedin_url: z.string().url().max(500).nullable().optional(),
  headline: z.string().max(500).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  conversation_goal: z.enum(GOALS).optional(),
  qualification_stage: z.enum(STAGES).optional(),
  status: z.enum(STATUSES).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// ─── Message Schemas ────────────────────────────────────────────────────

const MessageSchema = z.object({
  role: z.enum(ROLES),
  content: z.string().min(1, 'Message content is required').max(5000),
  timestamp: z.string().datetime().optional(),
});

export const AddMessagesSchema = z.object({
  messages: z.array(MessageSchema).min(1, 'At least one message required').max(50),
});
