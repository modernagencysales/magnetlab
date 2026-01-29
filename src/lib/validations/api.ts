/**
 * API Input Validation Schemas
 *
 * Zod schemas for validating API request bodies.
 * Using Zod provides runtime type safety and better error messages.
 */

import { z } from 'zod';

// ============================================
// COMMON SCHEMAS
// ============================================

export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .email('Invalid email format')
  .max(255, 'Email too long')
  .transform((email) => email.toLowerCase().trim());

export const uuidSchema = z.string({ required_error: 'ID is required' }).uuid('Invalid ID format');

// ============================================
// LEAD CAPTURE SCHEMAS
// ============================================

export const leadCaptureSchema = z.object({
  funnelPageId: z.string({ required_error: 'funnelPageId is required' }).uuid('Invalid funnelPageId format'),
  email: z.string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .max(255)
    .transform((email) => email.toLowerCase().trim()),
  name: z.string().max(100).transform((n) => n.trim()).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
});

export type LeadCaptureInput = z.infer<typeof leadCaptureSchema>;

export const leadQualificationSchema = z.object({
  leadId: z.string({ required_error: 'leadId is required' }).uuid('Invalid leadId format'),
  answers: z.record(z.string(), { required_error: 'answers is required' }),
});

export type LeadQualificationInput = z.infer<typeof leadQualificationSchema>;

// ============================================
// LEAD MAGNET SCHEMAS
// ============================================

export const leadMagnetArchetypes = [
  'checklist',
  'template',
  'swipe-file',
  'cheat-sheet',
  'assessment',
  'calculator',
  'case-study',
  'quick-start-guide',
  'resource-list',
  'comparison-chart',
] as const;

export const createLeadMagnetSchema = z.object({
  title: z.string().min(1).max(200),
  archetype: z.enum(leadMagnetArchetypes),
  concept: z.any().optional(),
  extractedContent: z.any().optional(),
  linkedinPost: z.string().optional(),
  postVariations: z.array(z.string()).optional(),
  dmTemplate: z.string().optional(),
  ctaWord: z.string().optional(),
});

export type CreateLeadMagnetInput = z.infer<typeof createLeadMagnetSchema>;

// ============================================
// FUNNEL SCHEMAS
// ============================================

export const createFunnelSchema = z.object({
  leadMagnetId: uuidSchema,
  optInHeadline: z.string().max(500).optional(),
  optInSubheadline: z.string().max(1000).optional(),
  thankYouHeadline: z.string().max(500).optional(),
  thankYouMessage: z.string().max(2000).optional(),
});

export type CreateFunnelInput = z.infer<typeof createFunnelSchema>;

export const qualificationQuestionSchema = z.object({
  question: z.string().min(1).max(500),
  qualifyingAnswer: z.enum(['yes', 'no']),
});

export type QualificationQuestionInput = z.infer<typeof qualificationQuestionSchema>;

// ============================================
// WEBHOOK SCHEMAS
// ============================================

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url('Invalid webhook URL'),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

// ============================================
// VALIDATION HELPER
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details: z.ZodIssue[] };

/**
 * Validate request body against a Zod schema
 * Returns discriminated union for type-safe access to data
 */
export function validateBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message || 'Validation failed',
      details: result.error.issues,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
