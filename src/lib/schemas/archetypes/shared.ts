/** Shared Zod primitives for archetype publish schemas. Never import archetype-specific logic here. */

import { z } from 'zod';

// ─── Section Primitives ──────────────────────────────────────────

export const sectionSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(50),
  key_insight: z.string().optional(),
});

// ─── Base Content Schema ─────────────────────────────────────────

/**
 * Every archetype extends this. It captures the universal fields that
 * every lead magnet needs regardless of format.
 */
export const baseContentSchema = z.object({
  headline: z.string().min(10).max(200),
  subheadline: z.string().optional(),
  problem_statement: z.string().min(20),
  proof_points: z.array(z.string()).optional(),
  call_to_action: z.string().min(5),
});
