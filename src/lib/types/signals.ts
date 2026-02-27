// Signal Engine Types for MagnetLab
//
// Types for the LinkedIn signal monitoring engine: keyword/company/profile monitors,
// signal leads, events, ICP filtering, and Harvest API responses.

// ============================================
// ENUM-LIKE TYPES
// ============================================

export type SignalLeadStatus = 'new' | 'enriched' | 'qualified' | 'pushed' | 'excluded';

export type SentimentScore = 'high_intent' | 'medium_intent' | 'low_intent' | 'question';

export type SignalType =
  | 'keyword_engagement'
  | 'company_engagement'
  | 'profile_engagement'
  | 'job_change'
  | 'content_velocity'
  | 'job_posting';

// ============================================
// DB ROW TYPES
// ============================================

export interface SignalConfig {
  id: string;
  user_id: string;
  target_countries: string[];
  target_job_titles: string[];
  exclude_job_titles: string[];
  min_company_size: number | null;
  max_company_size: number | null;
  target_industries: string[];
  default_heyreach_campaign_id: string | null;
  enrichment_enabled: boolean;
  sentiment_scoring_enabled: boolean;
  auto_push_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SignalKeywordMonitor {
  id: string;
  user_id: string;
  keyword: string;
  is_active: boolean;
  last_scanned_at: string | null;
  posts_found: number;
  leads_found: number;
  created_at: string;
}

export interface SignalCompanyMonitor {
  id: string;
  user_id: string;
  linkedin_company_url: string;
  company_name: string | null;
  is_active: boolean;
  last_scanned_at: string | null;
  heyreach_campaign_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignalProfileMonitor {
  id: string;
  user_id: string;
  linkedin_profile_url: string;
  name: string | null;
  headline: string | null;
  is_active: boolean;
  last_scraped_at: string | null;
  heyreach_campaign_id: string | null;
  monitor_type: 'competitor' | 'influencer';
  created_at: string;
  updated_at: string;
}

export interface SignalLead {
  id: string;
  user_id: string;
  linkedin_url: string;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  job_title: string | null;
  company: string | null;
  country: string | null;
  profile_data: Record<string, unknown> | null;
  email: string | null;
  icp_match: boolean | null;
  icp_score: number;
  signal_count: number;
  compound_score: number;
  sentiment_score: SentimentScore | null;
  content_velocity_score: number | null;
  status: SignalLeadStatus;
  heyreach_campaign_id: string | null;
  heyreach_pushed_at: string | null;
  heyreach_error: string | null;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignalEvent {
  id: string;
  user_id: string;
  lead_id: string;
  signal_type: SignalType;
  source_url: string | null;
  source_monitor_id: string | null;
  comment_text: string | null;
  sentiment: SentimentScore | null;
  keyword_matched: string | null;
  engagement_type: 'comment' | 'reaction' | 'post_author' | null;
  metadata: Record<string, unknown>;
  detected_at: string;
  created_at: string;
}

// ============================================
// HARVEST API RESPONSE TYPES
// ============================================

export interface HarvestPostShort {
  id: string;
  content: string;
  linkedinUrl: string;
  publicIdentifier?: string;
  universalName?: string;
  name?: string;
  postedAt?: {
    timestamp: number;
    date: string;
    postedAgoShort?: string;
    postedAgoText?: string;
  };
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    reactions?: Array<{ type: string; count: number }>;
  };
  article?: {
    title: string;
    subtitle?: string;
    link?: string;
    description?: string;
  };
}

export interface HarvestPostComment {
  id: string;
  linkedinUrl: string;
  commentary: string;
  createdAt: string;
  createdAtTimestamp: number;
  numComments: number;
  reactionTypeCounts: Array<{ type: string; count: number }>;
  postId: string;
  actor: {
    id: string;
    name: string;
    linkedinUrl: string;
    position: string;
    pictureUrl?: string;
  };
  pinned: boolean;
  edited: boolean;
}

export interface HarvestPostReaction {
  id: string;
  reactionType: string;
  postId: string;
  actor: {
    id: string;
    name: string;
    linkedinUrl: string;
    position: string;
    pictureUrl?: string;
  };
}

export interface HarvestProfile {
  id: string;
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  headline: string;
  about: string;
  linkedinUrl: string;
  photo?: string;
  connectionsCount?: number;
  followerCount?: number;
  openToWork?: boolean;
  hiring?: boolean;
  location?: {
    linkedinText?: string;
    countryCode?: string;
    parsed?: {
      countryCode?: string;
      country?: string;
      countryFull?: string;
      state?: string;
      city?: string;
    };
  };
  currentPosition?: Array<{ companyName: string }>;
  experience?: Array<{
    companyName: string;
    position: string;
    duration?: string;
    location?: string;
    companyLink?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    employmentType?: string;
  }>;
  education?: Array<{
    title: string;
    degree?: string;
    startDate?: string;
    endDate?: string;
  }>;
  skills?: Array<{ name: string }>;
  topSkills?: string[];
}

export interface HarvestJobShort {
  id: string;
  linkedinUrl: string;
  title: string;
  postedDate?: string;
  companyName?: string;
  companyLink?: string;
  easyApply?: boolean;
}

export interface HarvestPagination {
  totalPages: number;
  totalElements: number;
  pageNumber: number;
  previousElements: number;
  pageSize: number;
  paginationToken: string | null;
}

export interface HarvestResponse<T> {
  elements: T[];
  pagination: HarvestPagination;
  status: string;
  error?: string;
}
