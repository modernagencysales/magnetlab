import { z } from 'zod'
import {
  ARCHETYPES,
  IDEA_STATUS,
  PIPELINE_POST_STATUS,
  KNOWLEDGE_CATEGORIES,
  CONTENT_PILLARS,
  CONTENT_TYPES,
  EXTRACT_CONTENT_TYPES,
} from './constants.js'

// Convert readonly tuples to mutable arrays for z.enum compatibility
const archetypeValues = [...ARCHETYPES] as [string, ...string[]]
const ideaStatusValues = [...IDEA_STATUS] as [string, ...string[]]
const postStatusValues = [...PIPELINE_POST_STATUS] as [string, ...string[]]
const knowledgeCategoryValues = [...KNOWLEDGE_CATEGORIES] as [string, ...string[]]
const pillarValues = [...CONTENT_PILLARS] as [string, ...string[]]
const contentTypeValues = [...CONTENT_TYPES] as [string, ...string[]]
const extractContentTypeValues = [...EXTRACT_CONTENT_TYPES] as [string, ...string[]]

// Schemas for tools that require strict argument validation
export const toolSchemas = {
  // Lead Magnet tools
  magnetlab_get_lead_magnet: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_create_lead_magnet: z.object({
    title: z.string().min(1, 'title is required'),
    archetype: z.enum(archetypeValues, {
      message: `archetype must be one of: ${ARCHETYPES.join(', ')}`,
    }),
  }),
  magnetlab_delete_lead_magnet: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_get_lead_magnet_stats: z.object({
    lead_magnet_id: z.string().min(1, 'lead_magnet_id is required'),
  }),
  magnetlab_analyze_competitor: z.object({
    url: z.string().url('url must be a valid URL'),
  }),
  magnetlab_analyze_transcript: z.object({
    transcript: z.string().min(50, 'transcript must be at least 50 characters'),
  }),

  // Ideation tools
  magnetlab_ideate_lead_magnets: z.object({
    business_description: z.string().min(1, 'business_description is required'),
    business_type: z.string().min(1, 'business_type is required'),
  }),
  magnetlab_extract_content: z.object({
    lead_magnet_id: z.string().min(1, 'lead_magnet_id is required'),
    archetype: z.enum(archetypeValues),
    concept: z.record(z.unknown()),
    answers: z.record(z.string()),
  }),
  magnetlab_generate_content: z.object({
    lead_magnet_id: z.string().min(1, 'lead_magnet_id is required'),
    archetype: z.enum(archetypeValues),
    concept: z.record(z.unknown()),
    answers: z.record(z.string()),
  }),
  magnetlab_write_linkedin_posts: z.object({
    lead_magnet_id: z.string().min(1, 'lead_magnet_id is required'),
    lead_magnet_title: z.string().min(1, 'lead_magnet_title is required'),
    contents: z.string().min(1, 'contents is required'),
    problem_solved: z.string().min(1, 'problem_solved is required'),
  }),
  magnetlab_polish_lead_magnet: z.object({
    lead_magnet_id: z.string().min(1, 'lead_magnet_id is required'),
  }),
  magnetlab_get_job_status: z.object({
    job_id: z.string().min(1, 'job_id is required'),
  }),

  // Funnel tools
  magnetlab_get_funnel: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_create_funnel: z.object({
    slug: z.string().min(1, 'slug is required'),
  }),
  magnetlab_update_funnel: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_delete_funnel: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_publish_funnel: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_unpublish_funnel: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_generate_funnel_content: z.object({
    lead_magnet_id: z.string().min(1, 'lead_magnet_id is required'),
  }),

  // Email sequence tools
  magnetlab_get_email_sequence: z.object({
    lead_magnet_id: z.string().min(1, 'lead_magnet_id is required'),
  }),
  magnetlab_generate_email_sequence: z.object({
    lead_magnet_id: z.string().min(1, 'lead_magnet_id is required'),
  }),
  magnetlab_update_email_sequence: z.object({
    lead_magnet_id: z.string().min(1, 'lead_magnet_id is required'),
  }),
  magnetlab_activate_email_sequence: z.object({
    lead_magnet_id: z.string().min(1, 'lead_magnet_id is required'),
  }),

  // Content pipeline tools
  magnetlab_submit_transcript: z.object({
    transcript: z.string().min(100, 'transcript must be at least 100 characters'),
  }),
  magnetlab_delete_transcript: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_search_knowledge: z.object({
    query: z.string().min(1, 'query is required'),
  }),
  magnetlab_get_idea: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_update_idea_status: z.object({
    idea_id: z.string().min(1, 'idea_id is required'),
    status: z.enum(ideaStatusValues, {
      message: `status must be one of: ${IDEA_STATUS.join(', ')}`,
    }),
  }),
  magnetlab_delete_idea: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_write_post_from_idea: z.object({
    idea_id: z.string().min(1, 'idea_id is required'),
  }),
  magnetlab_get_post: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_update_post: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_delete_post: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_polish_post: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_publish_post: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_schedule_post: z.object({
    post_id: z.string().min(1, 'post_id is required'),
    scheduled_time: z.string().min(1, 'scheduled_time is required'),
  }),
  magnetlab_get_posts_by_date_range: z.object({
    start_date: z.string().min(1, 'start_date is required'),
    end_date: z.string().min(1, 'end_date is required'),
  }),
  magnetlab_quick_write: z.object({
    topic: z.string().min(1, 'topic is required'),
  }),
  magnetlab_create_posting_slot: z.object({
    day_of_week: z.number().min(0).max(6),
    time: z.string().min(1, 'time is required'),
  }),
  magnetlab_delete_posting_slot: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_approve_plan: z.object({
    plan_id: z.string().min(1, 'plan_id is required'),
  }),
  magnetlab_update_business_context: z.object({
    context: z.record(z.unknown()),
  }),
  magnetlab_extract_writing_style: z.object({
    linkedin_url: z.string().url('linkedin_url must be a valid URL'),
  }),
  magnetlab_get_writing_style: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_match_template: z.object({
    idea_id: z.string().min(1, 'idea_id is required'),
  }),

  // Brand kit tools
  magnetlab_extract_business_context: z.object({
    content: z.string().min(50, 'content must be at least 50 characters'),
  }),

  // Swipe file tools
  magnetlab_submit_to_swipe_file: z.object({
    content: z.string().min(1, 'content is required'),
    type: z.string().min(1, 'type is required'),
    niche: z.string().min(1, 'niche is required'),
  }),

  // Library tools
  magnetlab_get_library: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_create_library: z.object({
    name: z.string().min(1, 'name is required'),
  }),
  magnetlab_update_library: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_delete_library: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_list_library_items: z.object({
    library_id: z.string().min(1, 'library_id is required'),
  }),
  magnetlab_create_library_item: z.object({
    library_id: z.string().min(1, 'library_id is required'),
    title: z.string().min(1, 'title is required'),
  }),

  // Qualification form tools
  magnetlab_get_qualification_form: z.object({
    id: z.string().min(1, 'id is required'),
  }),
  magnetlab_create_qualification_form: z.object({
    name: z.string().min(1, 'name is required'),
  }),
  magnetlab_list_questions: z.object({
    form_id: z.string().min(1, 'form_id is required'),
  }),
  magnetlab_create_question: z.object({
    form_id: z.string().min(1, 'form_id is required'),
    question_text: z.string().min(1, 'question_text is required'),
    question_type: z.enum(['text', 'single_choice', 'multi_choice']),
  }),
} as const

export type ToolName = keyof typeof toolSchemas

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Validate tool arguments against the schema for the given tool.
 * Returns success with parsed data if valid, or failure with error message.
 * Tools without schemas pass through unchanged.
 */
export function validateToolArgs<T>(
  toolName: string,
  args: unknown
): ValidationResult<T> {
  const schema = toolSchemas[toolName as ToolName]

  // Tools without explicit schemas pass through
  if (!schema) {
    return { success: true, data: args as T }
  }

  const result = schema.safeParse(args)
  if (!result.success) {
    const issues = result.error.issues || []
    const errors = issues.map((e: { message: string }) => e.message).join(', ')
    return { success: false, error: errors || 'Validation failed' }
  }

  return { success: true, data: result.data as T }
}
