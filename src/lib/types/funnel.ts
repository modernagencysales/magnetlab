// Funnel Page Types for MagnetLab

// ============================================
// FUNNEL PAGE
// ============================================

export interface FunnelPage {
  id: string;
  leadMagnetId: string;
  userId: string;
  slug: string;

  // Opt-in page configuration
  optinHeadline: string;
  optinSubline: string | null;
  optinButtonText: string;
  optinSocialProof: string | null;

  // Thank-you page configuration
  thankyouHeadline: string;
  thankyouSubline: string | null;
  vslUrl: string | null;
  calendlyUrl: string | null;
  qualificationPassMessage: string;
  qualificationFailMessage: string;

  // Publishing state
  isPublished: boolean;
  publishedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// QUALIFICATION QUESTIONS
// ============================================

export type QualifyingAnswer = 'yes' | 'no';

export interface QualificationQuestion {
  id: string;
  funnelPageId: string;
  questionText: string;
  questionOrder: number;
  qualifyingAnswer: QualifyingAnswer;
  createdAt: string;
}

// ============================================
// FUNNEL LEADS
// ============================================

export interface FunnelLead {
  id: string;
  funnelPageId: string;
  leadMagnetId: string;
  userId: string;
  email: string;
  name: string | null;
  qualificationAnswers: Record<string, string> | null;
  isQualified: boolean | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  createdAt: string;
}

// ============================================
// WEBHOOK CONFIGS
// ============================================

export interface WebhookConfig {
  id: string;
  userId: string;
  name: string;
  url: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API PAYLOADS
// ============================================

export interface CreateFunnelPagePayload {
  leadMagnetId: string;
  slug: string;
  optinHeadline: string;
  optinSubline?: string;
  optinButtonText?: string;
  optinSocialProof?: string;
  thankyouHeadline?: string;
  thankyouSubline?: string;
  vslUrl?: string;
  calendlyUrl?: string;
  qualificationPassMessage?: string;
  qualificationFailMessage?: string;
}

export interface UpdateFunnelPagePayload {
  slug?: string;
  optinHeadline?: string;
  optinSubline?: string | null;
  optinButtonText?: string;
  optinSocialProof?: string | null;
  thankyouHeadline?: string;
  thankyouSubline?: string | null;
  vslUrl?: string | null;
  calendlyUrl?: string | null;
  qualificationPassMessage?: string;
  qualificationFailMessage?: string;
}

export interface CreateQuestionPayload {
  questionText: string;
  questionOrder?: number;
  qualifyingAnswer: QualifyingAnswer;
}

export interface UpdateQuestionPayload {
  questionText?: string;
  questionOrder?: number;
  qualifyingAnswer?: QualifyingAnswer;
}

export interface CaptureLeadPayload {
  email: string;
  name?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface SubmitQualificationPayload {
  leadId: string;
  answers: Record<string, 'yes' | 'no'>;
}

export interface CreateWebhookPayload {
  name: string;
  url: string;
}

export interface UpdateWebhookPayload {
  name?: string;
  url?: string;
  isActive?: boolean;
}

// ============================================
// GENERATED CONTENT
// ============================================

export interface GeneratedOptinContent {
  headline: string;
  subline: string;
  socialProof: string;
  buttonText: string;
}

// ============================================
// PUBLIC PAGE DATA
// ============================================

export interface PublicFunnelPageData {
  // Funnel page info
  id: string;
  slug: string;
  optinHeadline: string;
  optinSubline: string | null;
  optinButtonText: string;
  optinSocialProof: string | null;
  thankyouHeadline: string;
  thankyouSubline: string | null;
  vslUrl: string | null;
  calendlyUrl: string | null;
  qualificationPassMessage: string;
  qualificationFailMessage: string;

  // Lead magnet info
  leadMagnetTitle: string;

  // User info
  username: string;
  userName: string | null;
  userAvatar: string | null;

  // Questions for qualification
  questions: Array<{
    id: string;
    questionText: string;
    questionOrder: number;
  }>;
}

// ============================================
// WEBHOOK EVENTS
// ============================================

export interface WebhookLeadPayload {
  event: 'lead.created';
  timestamp: string;
  data: {
    leadId: string;
    email: string;
    name: string | null;
    isQualified: boolean | null;
    qualificationAnswers: Record<string, string> | null;
    leadMagnetTitle: string;
    funnelPageSlug: string;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    createdAt: string;
  };
}

// ============================================
// DATABASE ROW TYPES (for Supabase)
// ============================================

export interface FunnelPageRow {
  id: string;
  lead_magnet_id: string;
  user_id: string;
  slug: string;
  optin_headline: string;
  optin_subline: string | null;
  optin_button_text: string;
  optin_social_proof: string | null;
  thankyou_headline: string;
  thankyou_subline: string | null;
  vsl_url: string | null;
  calendly_url: string | null;
  qualification_pass_message: string;
  qualification_fail_message: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualificationQuestionRow {
  id: string;
  funnel_page_id: string;
  question_text: string;
  question_order: number;
  qualifying_answer: string;
  created_at: string;
}

export interface FunnelLeadRow {
  id: string;
  funnel_page_id: string;
  lead_magnet_id: string;
  user_id: string;
  email: string;
  name: string | null;
  qualification_answers: Record<string, string> | null;
  is_qualified: boolean | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
}

export interface WebhookConfigRow {
  id: string;
  user_id: string;
  name: string;
  url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function funnelPageFromRow(row: FunnelPageRow): FunnelPage {
  return {
    id: row.id,
    leadMagnetId: row.lead_magnet_id,
    userId: row.user_id,
    slug: row.slug,
    optinHeadline: row.optin_headline,
    optinSubline: row.optin_subline,
    optinButtonText: row.optin_button_text,
    optinSocialProof: row.optin_social_proof,
    thankyouHeadline: row.thankyou_headline,
    thankyouSubline: row.thankyou_subline,
    vslUrl: row.vsl_url,
    calendlyUrl: row.calendly_url,
    qualificationPassMessage: row.qualification_pass_message,
    qualificationFailMessage: row.qualification_fail_message,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function qualificationQuestionFromRow(row: QualificationQuestionRow): QualificationQuestion {
  return {
    id: row.id,
    funnelPageId: row.funnel_page_id,
    questionText: row.question_text,
    questionOrder: row.question_order,
    qualifyingAnswer: row.qualifying_answer as QualifyingAnswer,
    createdAt: row.created_at,
  };
}

export function funnelLeadFromRow(row: FunnelLeadRow): FunnelLead {
  return {
    id: row.id,
    funnelPageId: row.funnel_page_id,
    leadMagnetId: row.lead_magnet_id,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    qualificationAnswers: row.qualification_answers,
    isQualified: row.is_qualified,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    createdAt: row.created_at,
  };
}

export function webhookConfigFromRow(row: WebhookConfigRow): WebhookConfig {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    url: row.url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
