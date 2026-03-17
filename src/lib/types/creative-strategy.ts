/**
 * Creative Strategy Types
 * Type definitions for the creative strategy system (cs_* tables).
 * Literal union types only — never TypeScript enums.
 */

// ─── Signal types ────────────────────────────────────────────────────────────

export type SignalSource = 'own_account' | 'scraped' | 'manual';

export type SignalMediaType = 'none' | 'image' | 'carousel' | 'video' | 'document' | 'poll';

export type SignalStatus = 'pending' | 'reviewed' | 'used' | 'dismissed';

export interface CsSignal {
  id: string;
  source: SignalSource;
  source_account_id: string | null;
  linkedin_url: string | null;
  author_name: string;
  author_headline: string | null;
  author_follower_count: number | null;
  content: string;
  media_type: SignalMediaType;
  media_description: string | null;
  media_urls: string[];
  impressions: number | null;
  likes: number;
  comments: number;
  shares: number | null;
  engagement_multiplier: number | null;
  niche: string | null;
  status: SignalStatus;
  ai_analysis: SignalAiAnalysis | null;
  submitted_by: string | null;
  created_at: string;
}

export interface SignalAiAnalysis {
  media_classification: string | null;
  hook_pattern: string | null;
  format_fingerprint: {
    length: 'short' | 'medium' | 'long';
    line_break_style: string;
    emoji_usage: 'none' | 'light' | 'heavy';
    cta_type: string | null;
  } | null;
  trending_topic: string | null;
  exploit_hypothesis: string | null;
  similar_play_ids: string[];
}

// ─── Play types ──────────────────────────────────────────────────────────────

export type ExploitType =
  | 'media_format'
  | 'hook_pattern'
  | 'topic_trend'
  | 'engagement_hack'
  | 'cta_pattern'
  | 'composite';

export const EXPLOIT_TYPES: ExploitType[] = [
  'media_format',
  'hook_pattern',
  'topic_trend',
  'engagement_hack',
  'cta_pattern',
  'composite',
];

export const EXPLOIT_TYPE_LABELS: Record<ExploitType, string> = {
  media_format: 'Media Format',
  hook_pattern: 'Hook Pattern',
  topic_trend: 'Topic Trend',
  engagement_hack: 'Engagement Hack',
  cta_pattern: 'CTA Pattern',
  composite: 'Composite',
};

export type PlayStatus = 'draft' | 'testing' | 'proven' | 'declining' | 'archived';

export type PlayVisibility = 'internal' | 'public';

export interface CsPlay {
  id: string;
  title: string;
  thesis: string;
  exploit_type: ExploitType;
  format_instructions: string;
  status: PlayStatus;
  visibility: PlayVisibility;
  niches: string[] | null;
  last_used_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PlayWithStats extends CsPlay {
  signal_count: number;
  test_count: number;
  avg_multiplier: number | null;
  usage_count: number;
  feedback_up: number;
  feedback_down: number;
  promotion_suggestion: 'promote' | 'decline' | null;
}

// ─── Play results ────────────────────────────────────────────────────────────

export interface CsPlayResult {
  id: string;
  play_id: string;
  post_id: string;
  account_id: string | null;
  is_anonymous: boolean;
  baseline_impressions: number | null;
  actual_impressions: number | null;
  multiplier: number | null;
  likes: number;
  comments: number;
  niche: string | null;
  tested_at: string;
}

// ─── Play templates ──────────────────────────────────────────────────────────

export interface CsPlayTemplate {
  id: string;
  play_id: string;
  name: string;
  structure: PlayTemplateStructure;
  media_instructions: string;
  example_output: string;
  created_at: string;
}

export interface PlayTemplateStructure {
  hook_pattern: string;
  body_format: string;
  cta_style: string;
  line_count_range: [number, number];
}

// ─── Play feedback ───────────────────────────────────────────────────────────

export type FeedbackRating = 'up' | 'down';

export interface CsPlayFeedback {
  id: string;
  play_id: string;
  user_id: string;
  rating: FeedbackRating;
  note: string | null;
  created_at: string;
}

// ─── Play assignments ────────────────────────────────────────────────────────

export type AssignmentStatus = 'active' | 'completed';

export interface CsPlayAssignment {
  id: string;
  play_id: string;
  user_id: string;
  assigned_by: string;
  status: AssignmentStatus;
  assigned_at: string;
  updated_at: string;
}

// ─── Scrape config ───────────────────────────────────────────────────────────

export type ScrapeConfigType = 'own_account' | 'watchlist' | 'niche_discovery';

export interface CsScrapeConfig {
  id: string;
  config_type: ScrapeConfigType;
  outlier_threshold_multiplier: number;
  min_reactions: number;
  min_comments: number;
  target_niches: string[];
  search_keywords: string[];
  active: boolean;
}

// ─── Play promotion thresholds (shared between service + cron evaluation) ───

export const PLAY_PROMOTION_THRESHOLDS = {
  /** Average multiplier must exceed this to suggest promotion to 'proven'. */
  promoteMinMultiplier: 3,
  /** Coefficient of variation must be below this for promotion (low variance). */
  promoteMaxVariation: 0.5,
  /** Average multiplier below this suggests decline. */
  declineMaxMultiplier: 1.0,
  /** Minimum play results required before any promotion/decline suggestion. */
  minResultsForPromotion: 5,
} as const;

// ─── Filter interfaces ──────────────────────────────────────────────────────

export interface SignalFilters {
  status?: SignalStatus;
  source?: SignalSource;
  niche?: string;
  min_multiplier?: number;
  limit?: number;
  offset?: number;
}

export interface PlayFilters {
  status?: PlayStatus;
  visibility?: PlayVisibility;
  exploit_type?: ExploitType;
  niche?: string;
  limit?: number;
  offset?: number;
}
