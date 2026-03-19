/** Handler dispatcher. Routes all 68 tool calls to domain handlers via flat lookup map. Never contains business logic. */

import type { MagnetLabClient } from '../client.js';
import { validateToolArgs } from '../validation.js';
import { handleLeadMagnetTools } from './lead-magnets.js';
import { handleFunnelTools } from './funnels.js';
import { handleKnowledgeTools } from './knowledge.js';
import { handlePostTools } from './posts.js';
import { handleEmailTools } from './email.js';
import { handleLeadTools } from './leads.js';
import { handleSchemaTools } from './schema.js';
import { handleCompoundTools } from './compound.js';
import { handleFeedbackTools } from './feedback.js';
import { handleAccountTools } from './account.js';
import { handleContentQueueTools } from './content-queue.js';
import { handleExploitTools } from './exploits.js';
import { handleCreativeTools } from './creatives.js';
import { handleOutreachCampaignTools } from './outreach-campaigns.js';
import { handleLinkedInActivityTools } from './linkedin-activity.js';
import { handleMixerTools } from './mixer.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
};

type Handler = (
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
) => Promise<unknown>;

// ─── Handler Map ────────────────────────────────────────────────────────────

const handlerMap: Record<string, Handler> = {
  // Lead magnets (5)
  magnetlab_list_lead_magnets: handleLeadMagnetTools,
  magnetlab_get_lead_magnet: handleLeadMagnetTools,
  magnetlab_create_lead_magnet: handleLeadMagnetTools,
  magnetlab_update_lead_magnet: handleLeadMagnetTools,
  magnetlab_delete_lead_magnet: handleLeadMagnetTools,

  // Funnels (7)
  magnetlab_list_funnels: handleFunnelTools,
  magnetlab_get_funnel: handleFunnelTools,
  magnetlab_create_funnel: handleFunnelTools,
  magnetlab_update_funnel: handleFunnelTools,
  magnetlab_delete_funnel: handleFunnelTools,
  magnetlab_publish_funnel: handleFunnelTools,
  magnetlab_unpublish_funnel: handleFunnelTools,

  // Knowledge (5)
  magnetlab_search_knowledge: handleKnowledgeTools,
  magnetlab_browse_knowledge: handleKnowledgeTools,
  magnetlab_get_knowledge_clusters: handleKnowledgeTools,
  magnetlab_ask_knowledge: handleKnowledgeTools,
  magnetlab_submit_transcript: handleKnowledgeTools,

  // Posts (6)
  magnetlab_list_posts: handlePostTools,
  magnetlab_get_post: handlePostTools,
  magnetlab_create_post: handlePostTools,
  magnetlab_update_post: handlePostTools,
  magnetlab_delete_post: handlePostTools,
  magnetlab_publish_post: handlePostTools,

  // Email sequences (3)
  magnetlab_get_email_sequence: handleEmailTools,
  magnetlab_save_email_sequence: handleEmailTools,
  magnetlab_activate_email_sequence: handleEmailTools,

  // Leads (3)
  magnetlab_list_leads: handleLeadTools,
  magnetlab_get_lead: handleLeadTools,
  magnetlab_export_leads: handleLeadTools,

  // Schema / introspection (3)
  magnetlab_list_archetypes: handleSchemaTools,
  magnetlab_get_archetype_schema: handleSchemaTools,
  magnetlab_get_business_context: handleSchemaTools,

  // Compound actions (2)
  magnetlab_launch_lead_magnet: handleCompoundTools,
  magnetlab_schedule_content_week: handleCompoundTools,

  // Feedback / analytics (2)
  magnetlab_get_performance_insights: handleFeedbackTools,
  magnetlab_get_recommendations: handleFeedbackTools,

  // Account (1)
  magnetlab_list_teams: handleAccountTools,

  // Content Queue (6)
  magnetlab_list_content_queue: handleContentQueueTools,
  magnetlab_update_queue_post: handleContentQueueTools,
  magnetlab_submit_queue_batch: handleContentQueueTools,
  magnetlab_review_lead_magnet: handleContentQueueTools,
  magnetlab_review_funnel: handleContentQueueTools,
  magnetlab_submit_asset_review: handleContentQueueTools,

  // Exploits (3)
  magnetlab_list_exploits: handleExploitTools,
  magnetlab_generate_post: handleExploitTools,
  magnetlab_get_trends: handleExploitTools,

  // Creatives (6)
  magnetlab_create_creative: handleCreativeTools,
  magnetlab_list_creatives: handleCreativeTools,
  magnetlab_run_scanner: handleCreativeTools,
  magnetlab_configure_scanner: handleCreativeTools,
  magnetlab_list_recyclable_posts: handleCreativeTools,
  magnetlab_recycle_post: handleCreativeTools,

  // Outreach campaigns (11)
  magnetlab_create_outreach_campaign: handleOutreachCampaignTools,
  magnetlab_list_outreach_campaigns: handleOutreachCampaignTools,
  magnetlab_get_outreach_campaign: handleOutreachCampaignTools,
  magnetlab_update_outreach_campaign: handleOutreachCampaignTools,
  magnetlab_activate_outreach_campaign: handleOutreachCampaignTools,
  magnetlab_pause_outreach_campaign: handleOutreachCampaignTools,
  magnetlab_delete_outreach_campaign: handleOutreachCampaignTools,
  magnetlab_add_outreach_leads: handleOutreachCampaignTools,
  magnetlab_list_outreach_leads: handleOutreachCampaignTools,
  magnetlab_get_outreach_lead: handleOutreachCampaignTools,
  magnetlab_skip_outreach_lead: handleOutreachCampaignTools,

  // LinkedIn activity (1)
  magnetlab_get_linkedin_activity: handleLinkedInActivityTools,

  // Ingredients mixer (4)
  magnetlab_get_ingredient_inventory: handleMixerTools,
  magnetlab_get_suggested_recipes: handleMixerTools,
  magnetlab_mix: handleMixerTools,
  magnetlab_get_combo_performance: handleMixerTools,
};

// ─── Dispatcher ─────────────────────────────────────────────────────────────

/**
 * Main dispatcher for MCP tool calls.
 * Validates args via Zod, routes to the matching domain handler, and wraps results.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<ToolResult> {
  try {
    const validated = validateToolArgs(name, args);
    const handler = handlerMap[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    const result = await handler(name, validated, client);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }] };
  }
}

// ─── Re-exports ─────────────────────────────────────────────────────────────

export { handleLeadMagnetTools } from './lead-magnets.js';
export { handleFunnelTools } from './funnels.js';
export { handleKnowledgeTools } from './knowledge.js';
export { handlePostTools } from './posts.js';
export { handleEmailTools } from './email.js';
export { handleLeadTools } from './leads.js';
export { handleSchemaTools } from './schema.js';
export { handleCompoundTools } from './compound.js';
export { handleFeedbackTools } from './feedback.js';
export { handleAccountTools } from './account.js';
export { handleContentQueueTools } from './content-queue.js';
export { handleExploitTools } from './exploits.js';
export { handleCreativeTools } from './creatives.js';
export { handleOutreachCampaignTools } from './outreach-campaigns.js';
export { handleLinkedInActivityTools } from './linkedin-activity.js';
export { handleMixerTools } from './mixer.js';
