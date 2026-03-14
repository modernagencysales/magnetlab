import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { leadMagnetTools } from './lead-magnets.js'
import { ideationTools } from './ideation.js'
import { funnelTools } from './funnels.js'
import { leadTools } from './leads.js'
import { analyticsTools } from './analytics.js'
import { brandKitTools } from './brand-kit.js'
import { emailSequenceTools } from './email-sequences.js'
import { contentPipelineTools } from './content-pipeline.js'
import { swipeFileTools } from './swipe-file.js'
import { libraryTools } from './libraries.js'
import { qualificationFormTools } from './qualification-forms.js'
import { emailSystemTools } from './email-system.js'

export const tools: Tool[] = [
  ...leadMagnetTools,
  ...ideationTools,
  ...funnelTools,
  ...leadTools,
  ...analyticsTools,
  ...brandKitTools,
  ...emailSequenceTools,
  ...emailSystemTools,
  ...contentPipelineTools,
  ...swipeFileTools,
  ...libraryTools,
  ...qualificationFormTools,
]

// Re-export individual tool arrays for selective imports
export { leadMagnetTools } from './lead-magnets.js'
export { ideationTools } from './ideation.js'
export { funnelTools } from './funnels.js'
export { leadTools } from './leads.js'
export { analyticsTools } from './analytics.js'
export { brandKitTools } from './brand-kit.js'
export { emailSequenceTools } from './email-sequences.js'
export { emailSystemTools } from './email-system.js'
export { contentPipelineTools } from './content-pipeline.js'
export { swipeFileTools } from './swipe-file.js'
export { libraryTools } from './libraries.js'
export { qualificationFormTools } from './qualification-forms.js'

// Tool lookup by name for handler routing
export const toolsByName = new Map<string, Tool>(tools.map((tool) => [tool.name, tool]))

// Content pipeline sub-groups (split the 44 tools into focused categories)
const knowledgeToolNames = [
  'magnetlab_list_transcripts',
  'magnetlab_submit_transcript',
  'magnetlab_delete_transcript',
  'magnetlab_search_knowledge',
  'magnetlab_browse_knowledge',
  'magnetlab_get_knowledge_tags',
  'magnetlab_get_knowledge_clusters',
  'magnetlab_ask_knowledge',
  'magnetlab_knowledge_gaps',
  'magnetlab_knowledge_readiness',
  'magnetlab_recent_knowledge',
  'magnetlab_export_knowledge',
  'magnetlab_list_topics',
  'magnetlab_topic_detail',
]

const contentWritingToolNames = [
  'magnetlab_list_ideas',
  'magnetlab_get_idea',
  'magnetlab_update_idea_status',
  'magnetlab_delete_idea',
  'magnetlab_write_post_from_idea',
  'magnetlab_list_posts',
  'magnetlab_get_post',
  'magnetlab_update_post',
  'magnetlab_delete_post',
  'magnetlab_polish_post',
  'magnetlab_publish_post',
  'magnetlab_quick_write',
  'magnetlab_list_writing_styles',
  'magnetlab_extract_writing_style',
  'magnetlab_get_writing_style',
  'magnetlab_list_templates',
  'magnetlab_match_template',
  'magnetlab_get_business_context',
  'magnetlab_update_business_context',
]

const contentSchedulingToolNames = [
  'magnetlab_schedule_post',
  'magnetlab_get_posts_by_date_range',
  'magnetlab_list_posting_slots',
  'magnetlab_create_posting_slot',
  'magnetlab_delete_posting_slot',
  'magnetlab_get_autopilot_status',
  'magnetlab_trigger_autopilot',
  'magnetlab_get_buffer',
  'magnetlab_get_plan',
  'magnetlab_generate_plan',
  'magnetlab_approve_plan',
]

// Get tool names by category — used by handlers and category-tools
export const toolCategories = {
  // Original categories (unchanged for handler routing)
  leadMagnets: leadMagnetTools.map((t) => t.name),
  ideation: ideationTools.map((t) => t.name),
  funnels: funnelTools.map((t) => t.name),
  leads: leadTools.map((t) => t.name),
  analytics: analyticsTools.map((t) => t.name),
  brandKit: brandKitTools.map((t) => t.name),
  emailSequences: emailSequenceTools.map((t) => t.name),
  contentPipeline: contentPipelineTools.map((t) => t.name),
  swipeFile: swipeFileTools.map((t) => t.name),
  libraries: libraryTools.map((t) => t.name),
  qualificationForms: qualificationFormTools.map((t) => t.name),
  emailSystem: emailSystemTools.map((t) => t.name),
}

// Discovery categories — what the user-facing category tools expose
// These are reorganized for better discoverability and smaller context footprint
export const discoveryCategories = {
  knowledge: knowledgeToolNames,
  contentWriting: contentWritingToolNames,
  contentScheduling: contentSchedulingToolNames,
  leadMagnets: [
    ...leadMagnetTools.map((t) => t.name),
    ...leadTools.map((t) => t.name),
    ...analyticsTools.map((t) => t.name),
  ],
  ideation: ideationTools.map((t) => t.name),
  funnels: funnelTools.map((t) => t.name),
  brandKit: brandKitTools.map((t) => t.name),
  emailSequences: emailSequenceTools.map((t) => t.name),
  emailSystem: emailSystemTools.map((t) => t.name),
  swipeFile: swipeFileTools.map((t) => t.name),
  libraries: libraryTools.map((t) => t.name),
  qualificationForms: qualificationFormTools.map((t) => t.name),
}
