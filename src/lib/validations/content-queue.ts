/**
 * Content Queue Validation Schemas.
 * Zod schemas for content queue API request bodies.
 * Never imports from Next.js HTTP layer.
 */

import { z } from 'zod';

// ─── Update Post Schema ───────────────────────────────────────────────────

export const ContentQueueUpdateSchema = z
  .object({
    draft_content: z.string().min(1, 'draft_content cannot be empty').optional(),
    mark_edited: z.boolean().optional(),
    image_urls: z.array(z.string().url('each image_url must be a valid URL')).optional().nullable(),
  })
  .refine(
    (data) =>
      data.draft_content !== undefined ||
      data.mark_edited !== undefined ||
      data.image_urls !== undefined,
    { message: 'At least one field must be provided' }
  );

export type ContentQueueUpdateInput = z.infer<typeof ContentQueueUpdateSchema>;

// ─── Submit Batch Schema ──────────────────────────────────────────────────

export const ContentQueueSubmitSchema = z.object({
  team_id: z.string().min(1, 'team_id is required'),
});

export type ContentQueueSubmitInput = z.infer<typeof ContentQueueSubmitSchema>;

// ─── Reset Edited Posts Schema (external API) ─────────────────────────────

export const ResetEditedPostsSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export type ResetEditedPostsInput = z.infer<typeof ResetEditedPostsSchema>;
