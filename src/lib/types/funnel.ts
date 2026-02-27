// Funnel Page Types for MagnetLab

// ============================================
// FUNNEL PAGE
// ============================================

export type FunnelTheme = 'dark' | 'light' | 'custom';
export type BackgroundStyle = 'solid' | 'gradient' | 'pattern';
export type FunnelTargetType = 'lead_magnet' | 'library' | 'external_resource';
export type RedirectTrigger = 'none' | 'immediate' | 'after_qualification';
export type ThankyouLayout = 'survey_first' | 'video_first' | 'side_by_side';

export interface FunnelPage {
  id: string;
  leadMagnetId: string | null; // Now nullable for library/external_resource targets
  userId: string;
  slug: string;

  // Target type (what this funnel delivers)
  targetType: FunnelTargetType;
  libraryId: string | null;
  externalResourceId: string | null;

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

  // Redirect configuration
  redirectTrigger: RedirectTrigger;
  redirectUrl: string | null;
  redirectFailUrl: string | null;

  // Homepage link
  homepageUrl: string | null;
  homepageLabel: string | null;

  // Resource email delivery
  sendResourceEmail: boolean;

  // Thank-you page layout
  thankyouLayout: ThankyouLayout;

  // Theme configuration
  theme: FunnelTheme;
  primaryColor: string;
  backgroundStyle: BackgroundStyle;
  logoUrl: string | null;

  // Shared qualification form
  qualificationFormId: string | null;

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
export type AnswerType = 'yes_no' | 'text' | 'textarea' | 'multiple_choice';

export interface QualificationQuestion {
  id: string;
  funnelPageId: string | null;
  formId: string | null;
  questionText: string;
  questionOrder: number;
  answerType: AnswerType;
  qualifyingAnswer: string | string[] | null; // "yes"/"no" for yes_no, string[] for multiple_choice, null if not qualifying
  options: string[] | null; // For multiple_choice
  placeholder: string | null; // For text/textarea
  isQualifying: boolean;
  isRequired: boolean;
  createdAt: string;
}

// ============================================
// QUALIFICATION FORMS (Reusable question sets)
// ============================================

export interface QualificationForm {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface QualificationFormRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
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
  linkedinUrl: string | null;
  heyreachDeliveryStatus: string | null;
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
// FUNNEL PAGE SECTIONS (Design System)
// ============================================

export type SectionType = 'logo_bar' | 'steps' | 'testimonial' | 'marketing_block' | 'section_bridge';
export type PageLocation = 'optin' | 'thankyou' | 'content';

export interface LogoBarConfig {
  logos: Array<{ name: string; imageUrl: string }>;
}

export interface StepsConfig {
  heading?: string;
  subheading?: string;
  steps: Array<{ title: string; description: string; icon?: string }>;
}

export interface TestimonialConfig {
  quote: string;
  author?: string;
  role?: string;
  result?: string;
}

export interface MarketingBlockConfig {
  blockType: 'testimonial' | 'case_study' | 'feature' | 'benefit' | 'faq' | 'pricing' | 'cta';
  title?: string;
  content?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export interface SectionBridgeConfig {
  text: string;
  variant?: 'default' | 'accent' | 'gradient';
  stepNumber?: number;
  stepLabel?: string;
}

export type SectionConfig = LogoBarConfig | StepsConfig | TestimonialConfig | MarketingBlockConfig | SectionBridgeConfig;

export interface FunnelPageSection {
  id: string;
  funnelPageId: string;
  sectionType: SectionType;
  pageLocation: PageLocation;
  sortOrder: number;
  isVisible: boolean;
  config: SectionConfig;
  createdAt: string;
  updatedAt: string;
}

export interface FunnelPageSectionRow {
  id: string;
  funnel_page_id: string;
  section_type: string;
  page_location: string;
  sort_order: number;
  is_visible: boolean;
  config: SectionConfig;
  created_at: string;
  updated_at: string;
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
  redirectTrigger?: RedirectTrigger;
  redirectUrl?: string | null;
  redirectFailUrl?: string | null;
  theme?: FunnelTheme;
  primaryColor?: string;
  backgroundStyle?: BackgroundStyle;
  logoUrl?: string | null;
  thankyouLayout?: ThankyouLayout;
}

export interface CreateQuestionPayload {
  questionText: string;
  questionOrder?: number;
  answerType?: AnswerType;
  qualifyingAnswer?: string | string[] | null;
  options?: string[] | null;
  placeholder?: string | null;
  isQualifying?: boolean;
  isRequired?: boolean;
}

export interface UpdateQuestionPayload {
  questionText?: string;
  questionOrder?: number;
  answerType?: AnswerType;
  qualifyingAnswer?: string | string[] | null;
  options?: string[] | null;
  placeholder?: string | null;
  isQualifying?: boolean;
  isRequired?: boolean;
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
  answers: Record<string, string>;
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

  // Questions for qualification/survey
  questions: Array<{
    id: string;
    questionText: string;
    questionOrder: number;
    answerType: AnswerType;
    options: string[] | null;
    placeholder: string | null;
    isRequired: boolean;
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
    surveyAnswers: Record<string, string> | null;
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
  lead_magnet_id: string | null; // Now nullable
  user_id: string;
  slug: string;
  // Target type fields
  target_type: string;
  library_id: string | null;
  external_resource_id: string | null;
  // Opt-in fields
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
  redirect_trigger: string;
  redirect_url: string | null;
  redirect_fail_url: string | null;
  homepage_url: string | null;
  homepage_label: string | null;
  send_resource_email: boolean;
  thankyou_layout: string;
  theme: string;
  primary_color: string;
  background_style: string;
  logo_url: string | null;
  qualification_form_id: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualificationQuestionRow {
  id: string;
  funnel_page_id: string | null;
  form_id: string | null;
  question_text: string;
  question_order: number;
  answer_type: string;
  qualifying_answer: unknown; // JSONB: string, string[], or null
  options: string[] | null;
  placeholder: string | null;
  is_qualifying: boolean;
  is_required: boolean;
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
  linkedin_url: string | null;
  heyreach_delivery_status: string | null;
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
    targetType: (row.target_type || 'lead_magnet') as FunnelTargetType,
    libraryId: row.library_id || null,
    externalResourceId: row.external_resource_id || null,
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
    redirectTrigger: (row.redirect_trigger || 'none') as RedirectTrigger,
    redirectUrl: row.redirect_url || null,
    redirectFailUrl: row.redirect_fail_url || null,
    homepageUrl: row.homepage_url || null,
    homepageLabel: row.homepage_label || null,
    sendResourceEmail: row.send_resource_email ?? true,
    thankyouLayout: (row.thankyou_layout || 'survey_first') as ThankyouLayout,
    qualificationFormId: row.qualification_form_id || null,
    theme: (row.theme || 'dark') as FunnelTheme,
    primaryColor: row.primary_color || '#8b5cf6',
    backgroundStyle: (row.background_style || 'solid') as BackgroundStyle,
    logoUrl: row.logo_url,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function qualificationQuestionFromRow(row: QualificationQuestionRow): QualificationQuestion {
  // qualifying_answer is JSONB: could be a string ("yes"), an array (["$10k+"]), or null
  let qualifyingAnswer: string | string[] | null = null;
  if (row.qualifying_answer !== null && row.qualifying_answer !== undefined) {
    if (Array.isArray(row.qualifying_answer)) {
      qualifyingAnswer = row.qualifying_answer as string[];
    } else if (typeof row.qualifying_answer === 'string') {
      qualifyingAnswer = row.qualifying_answer;
    }
  }

  return {
    id: row.id,
    funnelPageId: row.funnel_page_id || null,
    formId: row.form_id || null,
    questionText: row.question_text,
    questionOrder: row.question_order,
    answerType: (row.answer_type || 'yes_no') as AnswerType,
    qualifyingAnswer,
    options: row.options || null,
    placeholder: row.placeholder || null,
    isQualifying: row.is_qualifying ?? true,
    isRequired: row.is_required ?? true,
    createdAt: row.created_at,
  };
}

export function qualificationFormFromRow(row: QualificationFormRow): QualificationForm {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    linkedinUrl: row.linkedin_url,
    heyreachDeliveryStatus: row.heyreach_delivery_status,
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

export function funnelPageSectionFromRow(row: FunnelPageSectionRow): FunnelPageSection {
  return {
    id: row.id,
    funnelPageId: row.funnel_page_id,
    sectionType: row.section_type as SectionType,
    pageLocation: row.page_location as PageLocation,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
    config: row.config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
