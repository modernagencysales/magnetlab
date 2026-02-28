/**
 * API Input Validation Schemas
 *
 * Zod schemas for validating API request bodies.
 * Using Zod provides runtime type safety and better error messages.
 */

import { z } from 'zod';
import { LEAD_MAGNET_ARCHETYPES } from '@/lib/types/lead-magnet';

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
  linkedinUrl: z.string().url().max(500).optional(),
  fbc: z.string().max(500).optional(),  // Meta _fbc click cookie
  fbp: z.string().max(500).optional(),  // Meta _fbp browser cookie
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

export const leadMagnetArchetypes = LEAD_MAGNET_ARCHETYPES;

const conceptSchema = z.object({
  archetype: z.string().optional(),
  archetypeName: z.string().optional(),
  title: z.string().default(''),
  painSolved: z.string().default(''),
  whyNowHook: z.string().optional(),
  linkedinPost: z.string().optional(),
  contents: z.string().optional(),
  deliveryFormat: z.string().default(''),
  viralCheck: z.object({
    highValue: z.boolean().default(false),
    urgentPain: z.boolean().default(false),
    actionableUnder1h: z.boolean().default(false),
    simple: z.boolean().default(false),
    authorityBoosting: z.boolean().default(false),
  }).nullable().optional(),
  creationTimeEstimate: z.string().optional(),
  bundlePotential: z.union([
    z.array(z.string()),
    z.string().transform((s) => s ? [s] : []),
    z.null(),
  ]).optional().transform((v) => v ?? []),
  isImported: z.boolean().optional(),
  isQuickCreate: z.boolean().optional(),
}).passthrough();

// AI may return contents as strings OR objects with headline/summary/detail.
// Accept both and normalize objects to strings at validation time.
const contentItemSchema = z.union([
  z.string(),
  z.record(z.unknown()).transform((obj) => {
    const values = Object.values(obj).filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (values.length >= 2) return `${values[0]}: ${values[1]}`;
    if (values.length === 1) return values[0];
    return JSON.stringify(obj);
  }),
]);

const extractedContentSchema = z.object({
  title: z.string().default(''),
  format: z.string().default(''),
  structure: z.array(z.object({
    sectionName: z.string(),
    contents: z.array(contentItemSchema),
  }).passthrough()).optional(),
  nonObviousInsight: z.string().default(''),
  personalExperience: z.string().optional(),
  proof: z.string().optional(),
  commonMistakes: z.array(contentItemSchema).optional(),
  differentiation: z.string().default(''),
}).passthrough();

// ============================================
// INTERACTIVE CONFIG SCHEMAS
// ============================================

const calculatorInputSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['number', 'select', 'slider']),
  placeholder: z.string().optional(),
  options: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  defaultValue: z.number().optional(),
  unit: z.string().optional(),
});

const resultInterpretationSchema = z.object({
  range: z.tuple([z.number(), z.number()]),
  label: z.string(),
  description: z.string(),
  color: z.enum(['green', 'yellow', 'red']),
});

const calculatorConfigSchema = z.object({
  type: z.literal('calculator'),
  headline: z.string(),
  description: z.string(),
  inputs: z.array(calculatorInputSchema).min(1),
  formula: z.string().min(1),
  resultLabel: z.string(),
  resultFormat: z.enum(['number', 'currency', 'percentage']),
  resultInterpretation: z.array(resultInterpretationSchema).min(1),
});

const assessmentQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(['single_choice', 'multiple_choice', 'scale']),
  options: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
  scaleMin: z.number().optional(),
  scaleMax: z.number().optional(),
  scaleLabels: z.object({ min: z.string(), max: z.string() }).optional(),
});

const scoreRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  label: z.string(),
  description: z.string(),
  recommendations: z.array(z.string()),
});

const assessmentConfigSchema = z.object({
  type: z.literal('assessment'),
  headline: z.string(),
  description: z.string(),
  questions: z.array(assessmentQuestionSchema).min(1),
  scoring: z.object({
    method: z.enum(['sum', 'average']),
    ranges: z.array(scoreRangeSchema).min(1),
  }),
});

const gptConfigSchema = z.object({
  type: z.literal('gpt'),
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string().min(1),
  welcomeMessage: z.string(),
  suggestedPrompts: z.array(z.string()),
  maxTokens: z.number().optional(),
});

export const interactiveConfigSchema = z.discriminatedUnion('type', [
  calculatorConfigSchema,
  assessmentConfigSchema,
  gptConfigSchema,
]);

export const createLeadMagnetSchema = z.object({
  title: z.string().min(1).max(200),
  archetype: z.enum(leadMagnetArchetypes),
  concept: conceptSchema.nullable().optional(),
  extractedContent: extractedContentSchema.nullable().optional(),
  interactiveConfig: interactiveConfigSchema.nullable().optional(),
  linkedinPost: z.string().nullable().optional(),
  postVariations: z.array(z.object({
    hookType: z.string().default(''),
    post: z.string().default(''),
    whyThisAngle: z.string().default(''),
    evaluation: z.record(z.unknown()).nullable().optional(),
  })).optional(),
  dmTemplate: z.string().optional(),
  ctaWord: z.string().optional(),
});

export type CreateLeadMagnetInput = z.infer<typeof createLeadMagnetSchema>;

// ============================================
// SPREADSHEET IMPORT SCHEMAS
// ============================================

export const spreadsheetImportSchema = z.object({
  spreadsheetData: z.string()
    .min(10, 'Spreadsheet data is too short')
    .max(100_000, 'Spreadsheet data is too large (max 100KB)'),
  importType: z.literal('spreadsheet'),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
});

export type SpreadsheetImportInput = z.infer<typeof spreadsheetImportSchema>;

// ============================================
// FUNNEL SCHEMAS
// ============================================


export const updateFunnelSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').max(100).optional(),
  optinHeadline: z.string().max(500).nullable().optional(),
  optinSubline: z.string().max(1000).nullable().optional(),
  optinButtonText: z.string().max(100).nullable().optional(),
  optinSocialProof: z.string().max(500).nullable().optional(),
  thankyouHeadline: z.string().max(500).nullable().optional(),
  thankyouSubline: z.string().max(1000).nullable().optional(),
  vslUrl: z.string().url().max(2000).nullable().optional(),
  calendlyUrl: z.string().url().max(2000).nullable().optional(),
  qualificationPassMessage: z.string().max(1000).nullable().optional(),
  qualificationFailMessage: z.string().max(1000).nullable().optional(),
  theme: z.enum(['dark', 'light', 'custom']).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
  backgroundStyle: z.enum(['solid', 'gradient', 'pattern']).optional(),
  logoUrl: z.string().url().max(2000).nullable().optional(),
  qualificationFormId: z.string().uuid().nullable().optional(),
  redirectTrigger: z.enum(['none', 'immediate', 'after_qualification']).optional(),
  redirectUrl: z.string().url().max(2000).nullable().optional(),
  redirectFailUrl: z.string().url().max(2000).nullable().optional(),
  homepageUrl: z.string().url().max(2000).nullable().optional(),
  homepageLabel: z.string().max(200).nullable().optional(),
  sendResourceEmail: z.boolean().optional(),
  thankyouLayout: z.enum(['survey_first', 'video_first', 'side_by_side']).optional(),
});

export type UpdateFunnelInput = z.infer<typeof updateFunnelSchema>;

export const qualificationQuestionSchema = z.object({
  question: z.string().min(1).max(500),
  qualifyingAnswer: z.enum(['yes', 'no']),
});

export type QualificationQuestionInput = z.infer<typeof qualificationQuestionSchema>;

// ============================================
// POLISHED CONTENT SCHEMAS
// ============================================

const polishedBlockSchema = z.object({
  type: z.string(),
  content: z.string().optional(),
  items: z.array(z.union([z.string(), z.record(z.unknown())])).optional(),
}).passthrough();

const polishedSectionSchema = z.object({
  sectionName: z.string(),
  introduction: z.string().optional().default(''),
  keyTakeaway: z.string().optional().default(''),
  blocks: z.array(polishedBlockSchema),
}).passthrough();

export const polishedContentSchema = z.object({
  version: z.number().optional(),
  polishedAt: z.string().optional(),
  title: z.string().optional().default(''),
  heroSummary: z.string().optional().default(''),
  sections: z.array(polishedSectionSchema).min(1),
  metadata: z.object({
    wordCount: z.number().optional(),
    readingTimeMinutes: z.number().optional(),
  }).optional(),
}).passthrough();

export const updateContentBodySchema = z.object({
  polishedContent: polishedContentSchema,
});

export type UpdateContentBodyInput = z.infer<typeof updateContentBodySchema>;

// ============================================
// WEBHOOK SCHEMAS
// ============================================

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url('Invalid webhook URL'),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

// ============================================
// FUNNEL PAGE SECTION SCHEMAS
// ============================================

export const sectionTypes = ['logo_bar', 'steps', 'testimonial', 'marketing_block', 'section_bridge'] as const;
export const pageLocations = ['optin', 'thankyou', 'content'] as const;

const logoBarConfigSchema = z.object({
  logos: z.array(z.object({
    name: z.string().min(1).max(100),
    imageUrl: z.string().url(),
  })).max(20),
});

const stepsConfigSchema = z.object({
  heading: z.string().max(200).optional(),
  subheading: z.string().max(500).optional(),
  steps: z.array(z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(500),
    icon: z.string().max(50).optional(),
  })).min(1).max(6),
});

const testimonialConfigSchema = z.object({
  quote: z.string().min(1).max(2000),
  author: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  result: z.string().max(200).optional(),
});

const marketingBlockTypes = ['testimonial', 'case_study', 'feature', 'benefit', 'faq', 'pricing', 'cta'] as const;

const marketingBlockConfigSchema = z.object({
  blockType: z.enum(marketingBlockTypes),
  title: z.string().max(200).optional(),
  content: z.string().max(5000).optional(),
  imageUrl: z.string().url().optional(),
  ctaText: z.string().max(100).optional(),
  ctaUrl: z.string().url().optional(),
});

const sectionBridgeConfigSchema = z.object({
  text: z.string().min(1).max(500),
  variant: z.enum(['default', 'accent', 'gradient']).optional(),
  stepNumber: z.number().int().min(0).max(99).optional(),
  stepLabel: z.string().max(100).optional(),
});

export const sectionConfigSchemas = {
  logo_bar: logoBarConfigSchema,
  steps: stepsConfigSchema,
  testimonial: testimonialConfigSchema,
  marketing_block: marketingBlockConfigSchema,
  section_bridge: sectionBridgeConfigSchema,
} as const;

const sectionConfigSchema = z.union([
  logoBarConfigSchema,
  stepsConfigSchema,
  testimonialConfigSchema,
  marketingBlockConfigSchema,
  sectionBridgeConfigSchema,
]);

export const createSectionSchema = z.object({
  sectionType: z.enum(sectionTypes),
  pageLocation: z.enum(pageLocations),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isVisible: z.boolean().optional(),
  config: sectionConfigSchema,
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;

export const updateSectionSchema = z.object({
  sortOrder: z.number().int().min(0).max(999).optional(),
  isVisible: z.boolean().optional(),
  pageLocation: z.enum(pageLocations).optional(),
  config: sectionConfigSchema.optional(),
});

export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

// ============================================
// BULK IMPORT SCHEMAS
// ============================================

export const bulkPageItemSchema = z.object({
  title: z.string().min(1, 'title is required').max(200),
  slug: z.string().max(50).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens').optional(),
  optinHeadline: z.string().min(1, 'optinHeadline is required').max(500),
  optinSubline: z.string().max(1000).optional(),
  optinButtonText: z.string().max(100).optional(),
  leadMagnetUrl: z.string().url('leadMagnetUrl must be a valid URL'),
  thankyouHeadline: z.string().max(500).optional(),
  thankyouSubline: z.string().max(1000).optional(),
  autoPublish: z.boolean().optional(),
});

export type BulkPageItemInput = z.infer<typeof bulkPageItemSchema>;

export const bulkCreatePagesSchema = z.object({
  pages: z.array(bulkPageItemSchema).min(1, 'At least one page is required').max(100, 'Maximum 100 pages per request'),
});

export type BulkCreatePagesInput = z.infer<typeof bulkCreatePagesSchema>;

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
