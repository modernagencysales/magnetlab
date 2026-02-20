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
] as const

export type Archetype = (typeof ARCHETYPES)[number]

// Lead magnet status
export const LEAD_MAGNET_STATUS = [
  'draft',
  'extracting',
  'generating',
  'content_ready',
  'complete',
  'published',
] as const
export type LeadMagnetStatus = (typeof LEAD_MAGNET_STATUS)[number]

// Funnel theme
export const FUNNEL_THEMES = ['light', 'dark'] as const
export type FunnelTheme = (typeof FUNNEL_THEMES)[number]

// Funnel background style
export const BACKGROUND_STYLES = ['solid', 'gradient', 'pattern'] as const
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number]

// Funnel target type
export const FUNNEL_TARGET_TYPES = ['lead_magnet', 'library', 'external_resource'] as const
export type FunnelTargetType = (typeof FUNNEL_TARGET_TYPES)[number]

// Email sequence status
export const EMAIL_SEQUENCE_STATUS = ['draft', 'synced', 'active'] as const
export type EmailSequenceStatus = (typeof EMAIL_SEQUENCE_STATUS)[number]

// Content pipeline post status
export const PIPELINE_POST_STATUS = [
  'draft',
  'review',
  'approved',
  'scheduled',
  'published',
  'archived',
] as const
export type PipelinePostStatus = (typeof PIPELINE_POST_STATUS)[number]

// Content pipeline idea status
export const IDEA_STATUS = [
  'extracted',
  'selected',
  'writing',
  'written',
  'scheduled',
  'published',
  'archived',
] as const
export type IdeaStatus = (typeof IDEA_STATUS)[number]

// Content pillars
export const CONTENT_PILLARS = [
  'moments_that_matter',
  'teaching_promotion',
  'human_personal',
  'collaboration_social_proof',
] as const
export type ContentPillar = (typeof CONTENT_PILLARS)[number]

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
] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

// Knowledge entry categories
export const KNOWLEDGE_CATEGORIES = [
  'insight',
  'question',
  'pain_point',
  'success_story',
  'objection',
  'framework',
  'quote',
  'market_intel',
] as const
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number]

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
] as const
export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number]

// Knowledge actionability levels
export const ACTIONABILITY_LEVELS = ['immediately_actionable', 'contextual', 'theoretical'] as const
export type Actionability = (typeof ACTIONABILITY_LEVELS)[number]

// Knowledge readiness goals
export const READINESS_GOALS = ['lead_magnet', 'blog_post', 'course', 'sop', 'content_week'] as const
export type ReadinessGoal = (typeof READINESS_GOALS)[number]

// Transcript sources
export const TRANSCRIPT_SOURCES = ['paste', 'grain', 'fireflies', 'upload'] as const
export type TranscriptSource = (typeof TRANSCRIPT_SOURCES)[number]

// Analytics periods
export const ANALYTICS_PERIODS = ['7d', '30d', '90d', 'all'] as const
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number]

// Brand kit extract content types
export const EXTRACT_CONTENT_TYPES = ['offer-doc', 'linkedin', 'sales-page', 'other'] as const
export type ExtractContentType = (typeof EXTRACT_CONTENT_TYPES)[number]

// Swipe file niches (common values)
export const SWIPE_FILE_POST_TYPES = ['hook', 'story', 'educational', 'promotional', 'engagement'] as const
export type SwipeFilePostType = (typeof SWIPE_FILE_POST_TYPES)[number]
