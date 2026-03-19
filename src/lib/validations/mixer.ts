/** Mixer validation schemas. Validates API inputs for mixer endpoints. */

import { z } from 'zod';

// ─── Mix schema ────────────────────────────────────────────────────────────────

/** The ingredient fields that count as real ingredients (not direction modifiers). */
const INGREDIENT_FIELDS = [
  'exploit_id',
  'knowledge_topic',
  'knowledge_query',
  'style_id',
  'template_id',
  'creative_id',
  'trend_topic',
  'recycled_post_id',
  'idea_id',
] as const;

export const MixSchema = z
  .object({
    team_profile_id: z.string().uuid(),
    exploit_id: z.string().uuid().optional(),
    knowledge_topic: z.string().min(1).max(200).optional(),
    knowledge_query: z.string().min(1).max(500).optional(),
    style_id: z.string().uuid().optional(),
    template_id: z.string().uuid().optional(),
    creative_id: z.string().uuid().optional(),
    trend_topic: z.string().min(1).max(200).optional(),
    recycled_post_id: z.string().uuid().optional(),
    idea_id: z.string().uuid().optional(),
    hook: z.string().max(500).optional(),
    instructions: z.string().max(2000).optional(),
    count: z.number().int().min(1).max(5).default(3),
    output: z.enum(['drafts', 'ideas']).default('drafts'),
  })
  .refine((data) => INGREDIENT_FIELDS.some((field) => data[field] !== undefined), {
    message:
      'At least one ingredient is required (exploit, knowledge, style, template, creative, trend, recycled post, or idea).',
  });

export type MixInput = z.infer<typeof MixSchema>;

// ─── Inventory query schema ────────────────────────────────────────────────────

export const InventoryQuerySchema = z.object({
  team_profile_id: z.string().uuid(),
});

export type InventoryQueryInput = z.infer<typeof InventoryQuerySchema>;

// ─── Recipe query schema ───────────────────────────────────────────────────────

export const RecipeQuerySchema = z.object({
  team_profile_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type RecipeQueryInput = z.infer<typeof RecipeQuerySchema>;

// ─── Combo performance query schema ───────────────────────────────────────────

export const ComboPerformanceQuerySchema = z.object({
  team_profile_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ComboPerformanceQueryInput = z.infer<typeof ComboPerformanceQuerySchema>;
