/**
 * Creative Strategy Validation Schemas
 * Zod schemas for creative strategy API request bodies.
 * Never imports from Next.js HTTP layer.
 */

import { z } from 'zod';

// ─── Signal schemas ──────────────────────────────────────────────────────────

export const submitSignalSchema = z.object({
  linkedin_url: z.string().url('Invalid URL format'),
  content: z.string({ required_error: 'Content is required' }).min(1, 'Content cannot be empty'),
  author_name: z
    .string({ required_error: 'Author name is required' })
    .min(1, 'Author name cannot be empty'),
  media_urls: z.array(z.string().url()).optional(),
  niche: z.string().optional(),
  notes: z.string().optional(),
});

export type SubmitSignalInput = z.infer<typeof submitSignalSchema>;

export const updateSignalSchema = z.object({
  status: z.enum(['reviewed', 'used', 'dismissed'], {
    errorMap: () => ({ message: 'Status must be reviewed, used, or dismissed' }),
  }),
});

export type UpdateSignalInput = z.infer<typeof updateSignalSchema>;

// ─── Play schemas ────────────────────────────────────────────────────────────

export const createPlaySchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must be under 200 characters'),
  thesis: z.string({ required_error: 'Thesis is required' }).min(1, 'Thesis cannot be empty'),
  exploit_type: z.enum(
    ['media_format', 'hook_pattern', 'topic_trend', 'engagement_hack', 'cta_pattern', 'composite'],
    {
      errorMap: () => ({ message: 'Invalid exploit type' }),
    }
  ),
  format_instructions: z
    .string({ required_error: 'Format instructions required' })
    .min(1, 'Format instructions cannot be empty'),
  signal_ids: z
    .array(z.string().uuid('Invalid signal ID format'))
    .min(1, 'At least one signal is required'),
  niches: z.array(z.string()).optional(),
});

export type CreatePlayInput = z.infer<typeof createPlaySchema>;

export const updatePlaySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  thesis: z.string().min(1).optional(),
  status: z.enum(['draft', 'testing', 'proven', 'declining', 'archived']).optional(),
  visibility: z.enum(['internal', 'public']).optional(),
  format_instructions: z.string().min(1).optional(),
  niches: z.array(z.string()).optional(),
});

export type UpdatePlayInput = z.infer<typeof updatePlaySchema>;

// ─── Feedback schema ─────────────────────────────────────────────────────────

export const playFeedbackSchema = z.object({
  rating: z.enum(['up', 'down'], {
    errorMap: () => ({ message: 'Rating must be up or down' }),
  }),
  note: z.string().max(500, 'Note must be under 500 characters').optional(),
});

export type PlayFeedbackInput = z.infer<typeof playFeedbackSchema>;

// ─── Config schema ───────────────────────────────────────────────────────────

export const scrapeConfigSchema = z.object({
  config_type: z.enum(['own_account', 'watchlist', 'niche_discovery']),
  outlier_threshold_multiplier: z
    .number()
    .min(1, 'Multiplier must be at least 1')
    .max(100, 'Multiplier must be under 100'),
  min_reactions: z.number().int().min(0, 'Min reactions cannot be negative'),
  min_comments: z.number().int().min(0, 'Min comments cannot be negative'),
  target_niches: z.array(z.string()).optional(),
  search_keywords: z.array(z.string()).optional(),
  active: z.boolean(),
});

export type ScrapeConfigInput = z.infer<typeof scrapeConfigSchema>;

// ─── Template schema ─────────────────────────────────────────────────────────

export const createTemplateSchema = z.object({
  play_id: z.string().uuid('Invalid play ID'),
  name: z.string().min(1).max(200),
  structure: z.object({
    hook_pattern: z.string().min(1),
    body_format: z.string().min(1),
    cta_style: z.string().min(1),
    line_count_range: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  }),
  media_instructions: z.string().min(1),
  example_output: z.string().min(1),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
