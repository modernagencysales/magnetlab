/** MCP tool argument validation. Named Zod schema for every tool — no passthrough. Each group count noted inline. */

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
  POST_CAMPAIGN_STATUS,
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
const postCampaignStatusValues = [...POST_CAMPAIGN_STATUS] as [string, ...string[]];

// ─── Shared Field Schemas ─────────────────────────────────────────────────────

const teamIdField = z.string().optional();
const uuidField = z.string().min(1);
const paginationLimit = z.number().min(1).max(100).default(50).optional();
const paginationOffset = z.number().min(0).default(0).optional();

// ─── Tool Schemas (44 tools) ─────────────────────────────────────────────────

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
    vsl_headline: z.string().nullable().optional(),
    vsl_subline: z.string().nullable().optional(),
    cta_headline: z.string().nullable().optional(),
    cta_button_text: z.string().nullable().optional(),
    thankyou_layout: z
      .enum(['survey_first', 'video_first', 'side_by_side'] as [string, ...string[]])
      .optional(),
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
    image_url: z.string().url().optional(),
    is_lead_magnet_post: z.boolean().optional(),
    auto_activate: z.boolean().optional(),
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

  magnetlab_upload_post_image: z.object({
    post_id: uuidField,
    image_url: z.string().url(),
    team_id: teamIdField,
  }),

  magnetlab_list_linkedin_accounts: z.object({
    team_id: teamIdField,
    refresh: z.boolean().optional(),
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

  // ── Content Queue (6) ─────────────────────────────────────────────────────

  magnetlab_list_content_queue: z.object({}),

  magnetlab_update_queue_post: z.object({
    post_id: uuidField,
    draft_content: z.string().optional(),
    mark_edited: z.boolean().optional(),
  }),

  magnetlab_submit_queue_batch: z.object({
    team_id: z.string().min(1, 'team_id is required'),
  }),

  // ── Post Campaigns (8) ─────────────────────────────────────────────────

  magnetlab_list_post_campaigns: z.object({
    status: z.enum(postCampaignStatusValues).optional(),
  }),

  magnetlab_create_post_campaign: z.object({
    name: z.string().min(1, 'name is required'),
    post_url: z.string().url('post_url must be a valid URL'),
    keywords: z.array(z.string().min(1)).min(1, 'at least one keyword is required'),
    unipile_account_id: z.string().min(1, 'unipile_account_id is required'),
    dm_template: z.string().min(1, 'dm_template is required'),
    funnel_page_id: z.string().optional(),
    reply_template: z.string().optional(),
    poster_account_id: z.string().optional(),
    target_locations: z.array(z.string()).optional(),
    auto_accept_connections: z.boolean().optional(),
    auto_like_comments: z.boolean().optional(),
    auto_connect_non_requesters: z.boolean().optional(),
  }),

  magnetlab_auto_setup_post_campaign: z.object({
    post_id: uuidField,
  }),

  magnetlab_get_post_campaign: z.object({
    campaign_id: uuidField,
  }),

  magnetlab_update_post_campaign: z.object({
    campaign_id: uuidField,
    name: z.string().min(1).optional(),
    post_url: z.string().url().optional(),
    keywords: z.array(z.string().min(1)).optional(),
    dm_template: z.string().min(1).optional(),
    funnel_page_id: z.string().nullable().optional(),
    reply_template: z.string().optional(),
    target_locations: z.array(z.string()).optional(),
    auto_accept_connections: z.boolean().optional(),
    auto_like_comments: z.boolean().optional(),
    auto_connect_non_requesters: z.boolean().optional(),
  }),

  magnetlab_activate_post_campaign: z.object({
    campaign_id: uuidField,
  }),

  magnetlab_pause_post_campaign: z.object({
    campaign_id: uuidField,
  }),

  magnetlab_delete_post_campaign: z.object({
    campaign_id: uuidField,
  }),

  // ── Account Safety (2) ─────────────────────────────────────────────────

  magnetlab_get_account_safety_settings: z.object({
    unipile_account_id: z.string().min(1, 'unipile_account_id is required'),
  }),

  magnetlab_update_account_safety_settings: z.object({
    unipile_account_id: z.string().min(1, 'unipile_account_id is required'),
    max_dms_per_day: z.number().int().min(0).optional(),
    max_connection_requests_per_day: z.number().int().min(0).optional(),
    max_connection_accepts_per_day: z.number().int().min(0).optional(),
    max_comments_per_day: z.number().int().min(0).optional(),
    max_likes_per_day: z.number().int().min(0).optional(),
    min_action_delay_ms: z.number().int().min(0).optional(),
    max_action_delay_ms: z.number().int().min(0).optional(),
    operating_hours_start: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be in HH:MM format')
      .optional(),
    operating_hours_end: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be in HH:MM format')
      .optional(),
    timezone: z.string().optional(),
  }),

  // ── Asset Review (3) ────────────────────────────────────────────────────

  magnetlab_review_lead_magnet: z.object({
    lead_magnet_id: uuidField,
    reviewed: z.boolean(),
  }),

  magnetlab_review_funnel: z.object({
    funnel_id: uuidField,
    reviewed: z.boolean(),
  }),

  magnetlab_submit_asset_review: z.object({
    team_id: z.string().min(1, 'team_id is required'),
  }),

  // ── Exploits (3) ─────────────────────────────────────────────────────────

  magnetlab_list_exploits: z.object({
    category: z.enum(['regular_post', 'lead_magnet'] as [string, ...string[]]).optional(),
    creative_type: z.string().optional(),
    with_stats: z.boolean().optional(),
  }),

  magnetlab_generate_post: z.object({
    creative_id: z.string().optional(),
    exploit_id: z.string().optional(),
    knowledge_ids: z.array(z.string()).optional(),
    template_id: z.string().optional(),
    idea_id: z.string().optional(),
    style_id: z.string().optional(),
    hook: z.string().optional(),
    instructions: z.string().optional(),
  }),

  magnetlab_get_trends: z.object({
    limit: z.number().min(1).max(100).default(10).optional(),
  }),

  // ── Creatives (6) ────────────────────────────────────────────────────────

  magnetlab_create_creative: z.object({
    content_text: z.string().min(1, 'content_text is required'),
    source_platform: z.string().optional(),
    source_url: z.string().url().optional(),
    source_author: z.string().optional(),
    image_url: z.string().url().optional(),
    team_id: teamIdField,
  }),

  magnetlab_list_creatives: z.object({
    status: z.enum(['new', 'approved', 'used', 'dismissed'] as [string, ...string[]]).optional(),
    source_platform: z.string().optional(),
    min_score: z.number().min(0).max(10).optional(),
    limit: paginationLimit,
  }),

  magnetlab_run_scanner: z.object({}),

  magnetlab_configure_scanner: z.object({
    action: z.enum(['add', 'remove'] as [string, ...string[]]),
    source_type: z
      .enum(['search_term', 'hashtag', 'creator', 'competitor'] as [string, ...string[]])
      .optional(),
    source_value: z.string().min(1).optional(),
    source_id: z.string().uuid().optional(),
    priority: z.number().optional(),
  }),

  magnetlab_list_recyclable_posts: z.object({
    limit: z.number().min(1).max(100).default(20).optional(),
  }),

  magnetlab_recycle_post: z.object({
    post_id: uuidField,
    type: z.enum(['repost', 'cousin'] as [string, ...string[]]),
  }),
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
