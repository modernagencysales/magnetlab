/** MCP tool argument validation. Named Zod schema for every tool — no passthrough. */

import { z } from 'zod';
import {
  ARCHETYPES,
  BACKGROUND_STYLES,
  CONTENT_PILLARS,
  CONTENT_TYPES,
  EMAIL_SEQUENCE_STATUS,
  FUNNEL_TARGET_TYPES,
  FUNNEL_THEMES,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_TYPES,
  LEAD_MAGNET_STATUS_V2,
  PIPELINE_POST_STATUS,
} from './constants.js';

// ─── Enum Helpers ─────────────────────────────────────────────────────────────

const archetypeValues = [...ARCHETYPES] as [string, ...string[]];
const leadMagnetStatusValues = [...LEAD_MAGNET_STATUS_V2] as [string, ...string[]];
const funnelThemeValues = [...FUNNEL_THEMES] as [string, ...string[]];
const backgroundStyleValues = [...BACKGROUND_STYLES] as [string, ...string[]];
const targetTypeValues = [...FUNNEL_TARGET_TYPES] as [string, ...string[]];
const emailSequenceStatusValues = [...EMAIL_SEQUENCE_STATUS] as [string, ...string[]];
const postStatusValues = [...PIPELINE_POST_STATUS] as [string, ...string[]];
const knowledgeCategoryValues = [...KNOWLEDGE_CATEGORIES] as [string, ...string[]];
const knowledgeTypeValues = [...KNOWLEDGE_TYPES] as [string, ...string[]];
const contentPillarValues = [...CONTENT_PILLARS] as [string, ...string[]];
const contentTypeValues = [...CONTENT_TYPES] as [string, ...string[]];

// ─── Shared Field Schemas ─────────────────────────────────────────────────────

const teamIdField = z.string().optional();
const uuidField = z.string().min(1);
const paginationLimit = z.number().min(1).max(100).default(50).optional();
const paginationOffset = z.number().min(0).default(0).optional();

// ─── Tool Schemas (37 tools) ─────────────────────────────────────────────────

export const toolSchemas: Record<string, z.ZodType> = {
  // ── Lead Magnets (5) ──────────────────────────────────────────────────────

  magnetlab_list_lead_magnets: z.object({
    status: z.enum(leadMagnetStatusValues).optional(),
    limit: paginationLimit,
    offset: paginationOffset,
    team_id: teamIdField,
  }),

  magnetlab_get_lead_magnet: z.object({
    id: uuidField,
    team_id: teamIdField,
  }),

  magnetlab_create_lead_magnet: z.object({
    title: z.string().min(1, 'title is required'),
    archetype: z.enum(archetypeValues, {
      message: `archetype must be one of: ${ARCHETYPES.join(', ')}`,
    }),
    concept: z.record(z.unknown()).optional(),
    team_id: teamIdField,
  }),

  magnetlab_update_lead_magnet: z.object({
    id: uuidField,
    content: z.record(z.unknown()),
    expected_version: z.number().int().optional(),
    team_id: teamIdField,
  }),

  magnetlab_delete_lead_magnet: z.object({
    id: uuidField,
    team_id: teamIdField,
  }),

  // ── Funnels (7) ───────────────────────────────────────────────────────────

  magnetlab_list_funnels: z.object({
    team_id: teamIdField,
  }),

  magnetlab_get_funnel: z.object({
    id: uuidField,
    team_id: teamIdField,
  }),

  magnetlab_create_funnel: z.object({
    lead_magnet_id: z.string().optional(),
    library_id: z.string().optional(),
    external_resource_id: z.string().optional(),
    target_type: z.enum(targetTypeValues).optional(),
    slug: z.string().min(1, 'slug is required'),
    optin_headline: z.string().optional(),
    optin_subline: z.string().optional(),
    optin_button_text: z.string().optional(),
    optin_social_proof: z.string().optional(),
    thankyou_headline: z.string().optional(),
    thankyou_subline: z.string().optional(),
    vsl_url: z.string().optional(),
    calendly_url: z.string().optional(),
    theme: z.enum(funnelThemeValues).optional(),
    primary_color: z.string().optional(),
    background_style: z.enum(backgroundStyleValues).optional(),
    logo_url: z.string().optional(),
    qualification_form_id: z.string().optional(),
    team_id: teamIdField,
  }),

  magnetlab_update_funnel: z.object({
    id: uuidField,
    slug: z.string().optional(),
    optin_headline: z.string().optional(),
    optin_subline: z.string().optional(),
    optin_button_text: z.string().optional(),
    optin_social_proof: z.string().optional(),
    thankyou_headline: z.string().optional(),
    thankyou_subline: z.string().optional(),
    vsl_url: z.string().optional(),
    calendly_url: z.string().optional(),
    theme: z.enum(funnelThemeValues).optional(),
    primary_color: z.string().optional(),
    background_style: z.enum(backgroundStyleValues).optional(),
    logo_url: z.string().optional(),
    qualification_form_id: z.string().nullable().optional(),
    qualification_pass_message: z.string().nullable().optional(),
    qualification_fail_message: z.string().nullable().optional(),
    redirect_trigger: z
      .enum(['none', 'immediate', 'after_qualification'] as [string, ...string[]])
      .optional(),
    redirect_url: z.string().nullable().optional(),
    redirect_fail_url: z.string().nullable().optional(),
    homepage_url: z.string().nullable().optional(),
    homepage_label: z.string().nullable().optional(),
    send_resource_email: z.boolean().optional(),
    team_id: teamIdField,
  }),

  magnetlab_delete_funnel: z.object({
    id: uuidField,
    team_id: teamIdField,
  }),

  magnetlab_publish_funnel: z.object({
    id: uuidField,
    team_id: teamIdField,
  }),

  magnetlab_unpublish_funnel: z.object({
    id: uuidField,
    team_id: teamIdField,
  }),

  // ── Knowledge (5) ─────────────────────────────────────────────────────────

  magnetlab_search_knowledge: z.object({
    query: z.string().min(1).optional(),
    category: z.enum(knowledgeCategoryValues).optional(),
    type: z.enum(knowledgeTypeValues).optional(),
    topic: z.string().optional(),
    min_quality: z.number().int().min(1).max(5).optional(),
    since: z.string().optional(),
    team_id: teamIdField,
  }),

  magnetlab_browse_knowledge: z.object({
    category: z.enum(knowledgeCategoryValues).optional(),
    tag: z.string().optional(),
    limit: z.number().min(1).max(100).default(20).optional(),
    team_id: teamIdField,
  }),

  magnetlab_get_knowledge_clusters: z.object({
    team_id: teamIdField,
  }),

  magnetlab_ask_knowledge: z.object({
    question: z.string().min(3, 'question must be at least 3 characters'),
    team_id: teamIdField,
  }),

  magnetlab_submit_transcript: z.object({
    transcript: z.string().min(100, 'transcript must be at least 100 characters'),
    title: z.string().optional(),
    team_id: teamIdField,
  }),

  // ── Posts (6) ─────────────────────────────────────────────────────────────

  magnetlab_list_posts: z.object({
    status: z.enum(postStatusValues).optional(),
    is_buffer: z.boolean().optional(),
    limit: paginationLimit,
    team_id: teamIdField,
  }),

  magnetlab_get_post: z.object({
    id: uuidField,
    team_id: teamIdField,
  }),

  magnetlab_create_post: z.object({
    body: z.string().min(1, 'body is required'),
    title: z.string().optional(),
    pillar: z.enum(contentPillarValues).optional(),
    content_type: z.enum(contentTypeValues).optional(),
    team_id: teamIdField,
  }),

  magnetlab_update_post: z.object({
    id: uuidField,
    draft_content: z.string().optional(),
    final_content: z.string().optional(),
    status: z.enum(postStatusValues).optional(),
    team_id: teamIdField,
  }),

  magnetlab_delete_post: z.object({
    id: uuidField,
    team_id: teamIdField,
  }),

  magnetlab_publish_post: z.object({
    id: uuidField,
    team_id: teamIdField,
  }),

  // ── Email Sequences (3) ───────────────────────────────────────────────────

  magnetlab_get_email_sequence: z.object({
    lead_magnet_id: uuidField,
    team_id: teamIdField,
  }),

  magnetlab_save_email_sequence: z.object({
    lead_magnet_id: uuidField,
    emails: z
      .array(
        z.object({
          day: z.number().int().min(0),
          subject: z.string().min(1, 'subject is required'),
          body: z.string().min(1, 'body is required'),
          replyTrigger: z.string().optional(),
        })
      )
      .optional(),
    status: z.enum(emailSequenceStatusValues).optional(),
    team_id: teamIdField,
  }),

  magnetlab_activate_email_sequence: z.object({
    lead_magnet_id: uuidField,
    team_id: teamIdField,
  }),

  // ── Leads (3) ─────────────────────────────────────────────────────────────

  magnetlab_list_leads: z.object({
    funnel_id: z.string().optional(),
    lead_magnet_id: z.string().optional(),
    qualified: z.boolean().optional(),
    search: z.string().optional(),
    limit: paginationLimit,
    offset: paginationOffset,
    team_id: teamIdField,
  }),

  magnetlab_get_lead: z.object({
    id: uuidField,
    team_id: teamIdField,
  }),

  magnetlab_export_leads: z.object({
    funnel_id: z.string().optional(),
    lead_magnet_id: z.string().optional(),
    qualified: z.boolean().optional(),
    team_id: teamIdField,
  }),

  // ── Schema / Introspection (3) ────────────────────────────────────────────

  magnetlab_list_archetypes: z.object({
    team_id: teamIdField,
  }),

  magnetlab_get_archetype_schema: z.object({
    archetype: z.enum(archetypeValues, {
      message: `archetype must be one of: ${ARCHETYPES.join(', ')}`,
    }),
    team_id: teamIdField,
  }),

  magnetlab_get_business_context: z.object({
    team_id: teamIdField,
  }),

  // ── Compound Actions (2) ──────────────────────────────────────────────────

  magnetlab_launch_lead_magnet: z.object({
    title: z.string().min(1, 'title is required'),
    archetype: z.enum(archetypeValues, {
      message: `archetype must be one of: ${ARCHETYPES.join(', ')}`,
    }),
    content: z.record(z.unknown()),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9-]*$/, {
        message: 'slug must be lowercase alphanumeric with hyphens',
      }),
    funnel_theme: z.enum(['dark', 'light', 'modern'] as [string, ...string[]]).optional(),
    email_sequence: z
      .object({
        emails: z.array(
          z.object({
            subject: z.string().min(1),
            body: z.string().min(1),
            delay_days: z.number().int().min(0),
          })
        ),
      })
      .optional(),
    team_id: teamIdField,
  }),

  magnetlab_schedule_content_week: z.object({
    posts: z
      .array(
        z.object({
          body: z.string().min(1, 'body is required'),
          title: z.string().optional(),
          pillar: z.enum(contentPillarValues).optional(),
          content_type: z.enum(contentTypeValues).optional(),
        })
      )
      .min(1, 'at least one post is required')
      .max(7, 'maximum 7 posts per week'),
    week_start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'week_start must be YYYY-MM-DD')
      .optional(),
    team_id: teamIdField,
  }),

  // ── Feedback / Analytics (2) ──────────────────────────────────────────────

  magnetlab_get_performance_insights: z.object({
    period: z.enum(['7d', '30d', '90d'] as [string, ...string[]]).optional(),
    team_id: teamIdField,
  }),

  magnetlab_get_recommendations: z.object({
    team_id: teamIdField,
  }),

  // ── Account (1) ───────────────────────────────────────────────────────────

  magnetlab_list_teams: z.object({}),
};

// ─── Validation Function ──────────────────────────────────────────────────────

export type ToolName = keyof typeof toolSchemas;

/**
 * Validate tool arguments against the matching Zod schema.
 * Throws if the tool name is unknown or args fail validation.
 */
export function validateToolArgs(
  toolName: string,
  args: Record<string, unknown>
): Record<string, unknown> {
  const schema = toolSchemas[toolName];
  if (!schema) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return schema.parse(args) as Record<string, unknown>;
}
