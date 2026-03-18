// packages/mcp/src/constants.ts

// Lead magnet archetypes
export const ARCHETYPES = [
  'single-breakdown',
  'single-system',
  'focused-toolkit',
  'single-calculator',
  'focused-directory',
  'mini-training',
  'one-story',
  'prompt',
  'assessment',
  'workflow',
] as const;

export type Archetype = (typeof ARCHETYPES)[number];

// Lead magnet status (v2 — wizard stages removed)
export const LEAD_MAGNET_STATUS_V2 = ['draft', 'published', 'archived'] as const;
export type LeadMagnetStatusV2 = (typeof LEAD_MAGNET_STATUS_V2)[number];

// Funnel theme
export const FUNNEL_THEMES = ['light', 'dark'] as const;
export type FunnelTheme = (typeof FUNNEL_THEMES)[number];

// Funnel background style
export const BACKGROUND_STYLES = ['solid', 'gradient', 'pattern'] as const;
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number];

// Funnel target type
export const FUNNEL_TARGET_TYPES = ['lead_magnet', 'library', 'external_resource'] as const;
export type FunnelTargetType = (typeof FUNNEL_TARGET_TYPES)[number];

// Email sequence status
export const EMAIL_SEQUENCE_STATUS = ['draft', 'synced', 'active'] as const;
export type EmailSequenceStatus = (typeof EMAIL_SEQUENCE_STATUS)[number];

// Content pipeline post status
export const PIPELINE_POST_STATUS = [
  'draft',
  'review',
  'approved',
  'scheduled',
  'published',
  'archived',
] as const;
export type PipelinePostStatus = (typeof PIPELINE_POST_STATUS)[number];

// Content pipeline idea status
export const IDEA_STATUS = [
  'extracted',
  'selected',
  'writing',
  'written',
  'scheduled',
  'published',
  'archived',
] as const;
export type IdeaStatus = (typeof IDEA_STATUS)[number];

// Content pillars
export const CONTENT_PILLARS = [
  'moments_that_matter',
  'teaching_promotion',
  'human_personal',
  'collaboration_social_proof',
] as const;
export type ContentPillar = (typeof CONTENT_PILLARS)[number];

// Content types for ideas
export const CONTENT_TYPES = [
  'story',
  'insight',
  'tip',
  'framework',
  'case_study',
  'question',
  'listicle',
  'contrarian',
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

// Knowledge entry categories (must match KnowledgeCategory in content-pipeline.ts)
export const KNOWLEDGE_CATEGORIES = ['insight', 'question', 'product_intel'] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

// Knowledge entry types (Data Lake)
export const KNOWLEDGE_TYPES = [
  'how_to',
  'insight',
  'story',
  'question',
  'objection',
  'mistake',
  'decision',
  'market_intel',
] as const;
export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

// Post campaign status
export const POST_CAMPAIGN_STATUS = ['draft', 'active', 'paused', 'completed'] as const;
export type PostCampaignStatus = (typeof POST_CAMPAIGN_STATUS)[number];

// Knowledge readiness goals
export const READINESS_GOALS = [
  'lead_magnet',
  'blog_post',
  'course',
  'sop',
  'content_week',
] as const;
export type ReadinessGoal = (typeof READINESS_GOALS)[number];
