// Content Pipeline Types
// Ported from gtm-system with tenant_id → user_id

// ============================================
// ENUMS
// ============================================

export type TranscriptOrigin = 'grain' | 'fireflies' | 'fathom' | 'paste';

export type ContentType =
  | 'story'
  | 'insight'
  | 'tip'
  | 'framework'
  | 'case_study'
  | 'question'
  | 'listicle'
  | 'contrarian';

// Content Pillars - THEMATIC categories (what it's about)
// Complements ContentType which is STRUCTURAL (how it's written)
export type ContentPillar =
  | 'moments_that_matter'
  | 'teaching_promotion'
  | 'human_personal'
  | 'collaboration_social_proof';

export const CONTENT_PILLAR_LABELS: Record<ContentPillar, string> = {
  moments_that_matter: 'Moments That Matter',
  teaching_promotion: 'Teaching & Promotion',
  human_personal: 'Human & Personal',
  collaboration_social_proof: 'Collaboration & Social Proof',
};

export const CONTENT_PILLAR_COLORS: Record<ContentPillar, string> = {
  moments_that_matter: 'purple',
  teaching_promotion: 'blue',
  human_personal: 'pink',
  collaboration_social_proof: 'green',
};

export type IdeaStatus =
  | 'extracted'
  | 'selected'
  | 'writing'
  | 'written'
  | 'scheduled'
  | 'published'
  | 'archived';

export type PostStatus =
  | 'draft'
  | 'reviewing'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'publish_failed';

export type KnowledgeCategory = 'insight' | 'question' | 'product_intel';

export type KnowledgeSpeaker = 'host' | 'participant' | 'unknown';

export type TranscriptType = 'coaching' | 'sales';

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  insight: 'Insight',
  question: 'Question',
  product_intel: 'Product Intel',
};

export type PolishStatus = 'pending' | 'polished' | 'flagged' | 'skipped';

// ============================================
// TEAMS
// ============================================

export interface Team {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  industry: string | null;
  target_audience: string | null;
  shared_goal: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamVoiceProfile {
  first_person_context?: string;
  perspective_notes?: string;
  tone?: string;
  signature_phrases?: string[];
  banned_phrases?: string[];
  industry_jargon?: string[];
  storytelling_style?: string;
  hook_patterns?: string[];
}

export interface TeamProfile {
  id: string;
  team_id: string;
  user_id: string | null;
  email: string | null;
  full_name: string;
  title: string | null;
  linkedin_url: string | null;
  bio: string | null;
  expertise_areas: string[];
  voice_profile: TeamVoiceProfile;
  avatar_url: string | null;
  role: 'owner' | 'member';
  status: 'active' | 'pending' | 'removed';
  is_default: boolean;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// DATABASE ENTITIES
// ============================================

export interface CallTranscript {
  id: string;
  user_id: string;
  source: TranscriptOrigin;
  external_id: string | null;
  title: string | null;
  call_date: string | null;
  duration_minutes: number | null;
  participants: string[] | null;
  raw_transcript: string;
  summary: string | null;
  extracted_topics: string[] | null;
  transcript_type: TranscriptType | null;
  ideas_extracted_at: string | null;
  knowledge_extracted_at: string | null;
  team_id?: string | null;
  speaker_profile_id?: string | null;
  created_at: string;
}

export interface KnowledgeEntry {
  id: string;
  user_id: string;
  transcript_id: string;
  category: KnowledgeCategory;
  speaker: KnowledgeSpeaker;
  content: string;
  context: string | null;
  tags: string[];
  transcript_type: TranscriptType | null;
  team_id?: string | null;
  source_profile_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEntryWithSimilarity extends KnowledgeEntry {
  similarity: number;
}

export interface KnowledgeTag {
  id: string;
  user_id: string;
  tag_name: string;
  usage_count: number;
  created_at: string;
}

export interface ContentIdea {
  id: string;
  user_id: string;
  transcript_id: string | null;
  title: string;
  core_insight: string | null;
  full_context: string | null;
  why_post_worthy: string | null;
  post_ready: boolean;
  hook: string | null;
  key_points: string[] | null;
  target_audience: string | null;
  content_type: ContentType | null;
  content_pillar: ContentPillar | null;
  relevance_score: number | null;
  source_quote: string | null;
  status: IdeaStatus;
  composite_score: number | null;
  last_surfaced_at: string | null;
  similarity_hash: string | null;
  team_profile_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelinePost {
  id: string;
  user_id: string;
  idea_id: string | null;
  draft_content: string | null;
  final_content: string | null;
  dm_template: string | null;
  cta_word: string | null;
  variations: PostVariation[] | null;
  status: PostStatus;
  scheduled_time: string | null;
  linkedin_post_id: string | null;
  publish_provider: string | null;
  lead_magnet_id: string | null;
  hook_score: number | null;
  polish_status: PolishStatus | null;
  polish_notes: string | null;
  is_buffer: boolean;
  buffer_position: number | null;
  auto_publish_after: string | null;
  published_at: string | null;
  template_id: string | null;
  style_id: string | null;
  enable_automation: boolean;
  automation_config: Record<string, unknown> | null;
  engagement_stats: EngagementStats | null;
  scrape_engagement: boolean;
  heyreach_campaign_id: string | null;
  last_engagement_scrape_at: string | null;
  engagement_scrape_count: number;
  team_profile_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostVariation {
  id: string;
  content: string;
  hook_type: string;
  selected: boolean;
}

export interface EngagementStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  captured_at: string;
}

export interface PostEngagement {
  id: string;
  user_id: string;
  post_id: string;
  provider_id: string;
  engagement_type: 'comment' | 'reaction';
  reaction_type: string | null;
  comment_text: string | null;
  first_name: string | null;
  last_name: string | null;
  linkedin_url: string | null;
  heyreach_campaign_id: string | null;
  heyreach_pushed_at: string | null;
  heyreach_error: string | null;
  engaged_at: string | null;
  created_at: string;
}

export interface PostingSlot {
  id: string;
  user_id: string;
  slot_number: number;
  day_of_week: number | null;
  time_of_day: string;
  timezone: string;
  is_active: boolean;
  team_profile_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostTemplate {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  description: string | null;
  structure: string;
  example_posts: string[] | null;
  use_cases: string[] | null;
  tags: string[] | null;
  usage_count: number;
  avg_engagement_score: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WritingStyle {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  source_linkedin_url: string | null;
  source_posts_analyzed: number;
  style_profile: StyleProfile;
  example_posts: string[] | null;
  is_active: boolean;
  last_updated_at: string | null;
  created_at: string;
}

export interface StyleProfile {
  tone: 'conversational' | 'professional' | 'provocative' | 'educational' | 'inspirational';
  sentence_length: 'short' | 'medium' | 'long' | 'varied';
  vocabulary: 'simple' | 'technical' | 'mixed';
  formatting: {
    uses_emojis: boolean;
    uses_line_breaks: boolean;
    uses_lists: boolean;
    uses_bold: boolean;
    avg_paragraphs: number;
  };
  hook_patterns: string[];
  cta_patterns: string[];
  banned_phrases: string[];
  signature_phrases: string[];
}

// ============================================
// AI BRAIN / KNOWLEDGE SEARCH
// ============================================

export interface KnowledgeSearchParams {
  q?: string;
  category?: KnowledgeCategory;
  transcript_type?: TranscriptType;
  speaker?: KnowledgeSpeaker;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface KnowledgeSearchResult {
  entries: KnowledgeEntry[];
  total_count: number;
}

export interface ContentBrief {
  topic: string;
  relevantInsights: KnowledgeEntryWithSimilarity[];
  relevantQuestions: KnowledgeEntryWithSimilarity[];
  relevantProductIntel: KnowledgeEntryWithSimilarity[];
  compiledContext: string;
  suggestedAngles: string[];
}

// ============================================
// WEEK PLANNER
// ============================================

export type WeekPlanStatus = 'draft' | 'approved' | 'in_progress' | 'completed';

export interface WeekPlan {
  id: string;
  user_id: string;
  week_start_date: string;
  posts_per_week: number;
  pillar_moments_pct: number;
  pillar_teaching_pct: number;
  pillar_human_pct: number;
  pillar_collab_pct: number;
  status: WeekPlanStatus;
  approved_at: string | null;
  approved_by: string | null;
  planned_posts: PlannedPost[];
  generation_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlannedPost {
  day: number;
  time: string;
  idea_id: string;
  template_id: string | null;
  pillar: ContentPillar;
  assigned_post_id: string | null;
  idea_title?: string;
  idea_hook?: string;
  template_name?: string;
  match_score?: number;
}

export interface PillarDistribution {
  moments_that_matter: number;
  teaching_promotion: number;
  human_personal: number;
  collaboration_social_proof: number;
}

// ============================================
// BUSINESS CONTEXT
// ============================================

export interface BusinessContext {
  id: string;
  user_id: string;
  company_name: string | null;
  industry: string | null;
  company_description: string | null;
  icp_title: string | null;
  icp_industry: string | null;
  icp_pain_points: string[];
  target_audience: string | null;
  content_preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================
// VIRAL POSTS / SCRAPING
// ============================================

export type ScrapeRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ScrapeRun {
  id: string;
  user_id: string;
  target_url: string | null;
  status: ScrapeRunStatus;
  posts_found: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ViralPost {
  id: string;
  user_id: string;
  scrape_run_id: string | null;
  author_name: string | null;
  author_headline: string | null;
  author_url: string | null;
  content: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  percentile_rank: number | null;
  extracted_template_id: string | null;
  created_at: string;
}

// ============================================
// CONTENT PIPELINE JOBS
// ============================================

export type PipelineJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ContentPipelineJob {
  id: string;
  user_id: string;
  job_type: string;
  status: PipelineJobStatus;
  progress_pct: number;
  items_total: number;
  items_completed: number;
  result: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// AUTOPILOT
// ============================================

export interface AutoPilotConfig {
  userId: string;
  postsPerBatch: number;
  bufferTarget: number;
  autoPublish: boolean;
  autoPublishDelayHours: number;
  teamId?: string;
  profileId?: string;
}

export interface BatchResult {
  postsCreated: number;
  postsScheduled: number;
  ideasProcessed: number;
  errors: string[];
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface WritePostRequest {
  idea_id: string;
  template_id?: string;
  custom_instructions?: string;
}

export interface WritePostResponse {
  post: PipelinePost;
  variations: PostVariation[];
}

export interface BulkWritePostsRequest {
  idea_ids: string[];
  template_id?: string;
}

// ============================================
// ENRICHED TYPES
// ============================================

export interface EnrichedPipelinePost extends PipelinePost {
  idea?: ContentIdea;
}

export interface EnrichedContentIdea extends ContentIdea {
  transcript?: CallTranscript;
}

export interface TranscriptWithIdeas extends CallTranscript {
  ideas: ContentIdea[];
}

// ============================================
// LINKEDIN AUTOMATIONS
// ============================================

export type AutomationStatus = 'draft' | 'running' | 'paused';

export type AutomationEventType =
  | 'comment_detected'
  | 'keyword_matched'
  | 'dm_sent'
  | 'dm_failed'
  | 'connection_sent'
  | 'connection_failed'
  | 'like_sent'
  | 'like_failed'
  | 'reply_sent'
  | 'reply_failed'
  | 'follow_up_scheduled'
  | 'follow_up_sent'
  | 'follow_up_failed';

export interface LinkedInAutomation {
  id: string;
  user_id: string;
  name: string;
  post_id: string | null;
  post_social_id: string | null;
  keywords: string[];
  dm_template: string | null;
  auto_connect: boolean;
  auto_like: boolean;
  comment_reply_template: string | null;
  enable_follow_up: boolean;
  follow_up_template: string | null;
  follow_up_delay_minutes: number;
  status: AutomationStatus;
  unipile_account_id: string | null;
  leads_captured: number;
  created_at: string;
  updated_at: string;
}

export interface LinkedInAutomationEvent {
  id: string;
  automation_id: string;
  event_type: AutomationEventType;
  commenter_name: string | null;
  commenter_provider_id: string | null;
  commenter_linkedin_url: string | null;
  comment_text: string | null;
  action_details: string | null;
  error: string | null;
  created_at: string;
}
