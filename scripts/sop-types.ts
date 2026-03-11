/** Types for SOP extraction output. Mirrors ProgramSop fields from accelerator types. */

export interface ExtractedQualityBar {
  check: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface ExtractedDeliverable {
  type: string; // Must map to DeliverableType
  description: string;
}

export interface ExtractedSop {
  module_id: string; // e.g. 'm0', 'm1', ..., 'm7'
  sop_number: string; // e.g. '0-1', '3-106'
  title: string;
  content: string; // Full markdown content (cleaned)
  quality_bars: ExtractedQualityBar[];
  deliverables: ExtractedDeliverable[];
  tools_used: string[];
  dependencies: string[];
}

/** Valid DeliverableType values from src/lib/types/accelerator.ts */
export const VALID_DELIVERABLE_TYPES = [
  'icp_definition',
  'lead_magnet',
  'funnel',
  'email_sequence',
  'tam_list',
  'outreach_campaign',
  'tam_segment',
  'dm_campaign',
  'email_campaign',
  'email_infrastructure',
  'content_plan',
  'post_drafts',
  'metrics_digest',
  'diagnostic_report',
  'ad_campaign',
  'ad_targeting',
  'weekly_ritual',
  'operating_playbook',
] as const;

/** Valid tool names (consistent vocabulary for tools_used field) */
export const VALID_TOOLS = [
  'magnetlab_ideator',
  'magnetlab_creator',
  'magnetlab_funnel_builder',
  'magnetlab_post_writer',
  'magnetlab_content_pipeline',
  'magnetlab_brain',
  'clay',
  'heyreach',
  'plusvibe',
  'zapmail',
  'sales_navigator',
  'linkedin_ads_manager',
  'linkedin',
  'resend',
  'stripe',
  'grain',
  'fireflies',
  'fathom',
  'leadshark',
  'unipile',
] as const;

/** Module ID mapping from directory names to module IDs */
export const DIR_TO_MODULE: Record<string, string> = {
  'module-0-positioning': 'm0',
  'module-1-lead-magnets': 'm1',
  'module-2-tam-building': 'm2',
  'module-3-linkedin-outreach': 'm3',
  'module-4-cold-email': 'm4',
  'module-5-linkedin-ads': 'm5',
  'module-6-operating-system': 'm6',
  'module-7-daily-content': 'm7',
};
