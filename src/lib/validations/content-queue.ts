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
    /** @deprecated Edit diffs are now captured at batch submit using ai_original_content column */
    original_content: z.string().optional(),
    /** Image storage path — set to null to remove, string to set */
    image_storage_path: z.string().nullable().optional(),
  })
  .refine(
    (data) =>
      data.draft_content !== undefined ||
      data.mark_edited !== undefined ||
      data.image_storage_path !== undefined,
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

// ─── Review Asset Schema ──────────────────────────────────────────────────

export const ReviewAssetSchema = z.object({
  reviewed: z.boolean(),
});

export type ReviewAssetInput = z.infer<typeof ReviewAssetSchema>;

// ─── Extended Submit Schema ───────────────────────────────────────────────

export const ContentQueueSubmitSchemaV2 = z.object({
  team_id: z.string().min(1, 'team_id is required'),
  submit_type: z.enum(['posts', 'assets']).default('posts'),
});

export type ContentQueueSubmitInputV2 = z.infer<typeof ContentQueueSubmitSchemaV2>;
