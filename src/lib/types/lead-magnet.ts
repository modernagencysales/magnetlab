// Lead Magnet Types for MagnetLab

// ============================================
// ARCHETYPES & BUSINESS TYPES
// ============================================

export const LEAD_MAGNET_ARCHETYPES = [
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

export type LeadMagnetArchetype = (typeof LEAD_MAGNET_ARCHETYPES)[number];

export type BusinessType =
  | 'coach-consultant'
  | 'agency-owner'
  | 'course-creator'
  | 'freelancer'
  | 'saas-tech'
  | 'b2b-service';

export const ARCHETYPE_NAMES: Record<LeadMagnetArchetype, string> = {
  'single-breakdown': 'The Single Breakdown',
  'single-system': 'The Single System',
  'focused-toolkit': 'The Focused Toolkit',
  'single-calculator': 'The Single Calculator',
  'focused-directory': 'The Focused Directory',
  'mini-training': 'The Mini Training',
  'one-story': 'The One Story',
  'prompt': 'The Prompt',
  'assessment': 'The Assessment',
  'workflow': 'The Workflow',
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  'coach-consultant': 'Coach / Consultant',
  'agency-owner': 'Agency Owner',
  'course-creator': 'Course Creator',
  'freelancer': 'Freelancer',
  'saas-tech': 'SaaS / Tech',
  'b2b-service': 'B2B Service Provider',
};

// ============================================
// BUSINESS CONTEXT (Brand Kit)
// ============================================

export interface BusinessContext {
  businessDescription: string;
  credibilityMarkers: string[];
  urgentPains: string[];
  templates: string[];
  processes: string[];
  tools: string[];
  frequentQuestions: string[];
  results: string[];
  successExample?: string;
  audienceTools?: string[];
  businessType: BusinessType;
}

// ============================================
// IDEATION PHASE
// ============================================

export interface LeadMagnetConcept {
  archetype: LeadMagnetArchetype;
  archetypeName: string;
  title: string;
  painSolved: string;
  whyNowHook: string;
  linkedinPost?: string;
  contents: string;
  deliveryFormat: string;
  viralCheck: {
    highValue: boolean;
    urgentPain: boolean;
    actionableUnder1h: boolean;
    simple: boolean;
    authorityBoosting: boolean;
  };
  creationTimeEstimate: string;
  bundlePotential: string[];
  groundedIn?: string;
}

export interface IdeationResult {
  concepts: LeadMagnetConcept[];
  recommendations: {
    shipThisWeek: {
      conceptIndex: number;
      reason: string;
    };
    highestEngagement: {
      conceptIndex: number;
      reason: string;
    };
    bestAuthorityBuilder: {
      conceptIndex: number;
      reason: string;
    };
  };
  suggestedBundle: {
    name: string;
    components: string[];
    combinedValue: string;
    releaseStrategy: string;
  };
}

// ============================================
// CONTENT EXTRACTION PHASE
// ============================================

export interface ContentExtractionQuestion {
  id: string;
  question: string;
  context?: string;
  required: boolean;
}

export interface ExtractedContent {
  title: string;
  format: string;
  structure: Array<{
    sectionName: string;
    contents: string[];
  }>;
  nonObviousInsight: string;
  personalExperience: string;
  proof: string;
  commonMistakes: string[];
  differentiation: string;
}

// ============================================
// POST WRITING PHASE
// ============================================

export interface PostVariation {
  hookType: string;
  post: string;
  whyThisAngle: string;
  evaluation: {
    hookStrength: 'strong' | 'medium' | 'weak';
    credibilityClear: boolean;
    problemResonance: 'high' | 'medium' | 'low';
    contentsSpecific: boolean;
    toneMatch: 'aligned' | 'partial' | 'off';
    aiClicheFree: boolean;
  };
}

export interface PostWriterResult {
  variations: PostVariation[];
  recommendation: string;
  dmTemplate: string;
  ctaWord: string;
}

export interface PostWriterInput {
  leadMagnetTitle: string;
  format: string;
  contents: string;
  problemSolved: string;
  credibility: string;
  audience: string;
  audienceStyle: 'casual-direct' | 'professional-polished' | 'technical' | 'warm-relatable';
  proof: string;
  ctaWord: string;
  urgencyAngle?: string;
}

// ============================================
// CHAT / EXTRACTION SESSION
// ============================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================
// SMART CONTEXT IMPORT (AI Extraction)
// ============================================

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ContentType = 'offer-doc' | 'linkedin' | 'sales-page' | 'other';

export interface ExtractionConfidence {
  businessDescription: ConfidenceLevel;
  businessType: ConfidenceLevel;
  credibilityMarkers: ConfidenceLevel;
  urgentPains: ConfidenceLevel;
  results: ConfidenceLevel;
  templates: ConfidenceLevel;
  processes: ConfidenceLevel;
  tools: ConfidenceLevel;
  frequentQuestions: ConfidenceLevel;
  successExample: ConfidenceLevel;
}

export interface ExtractionSuggestion {
  field: keyof BusinessContext;
  suggestion: string;
  value: string;
}

export interface ExtractionResult {
  extracted: Partial<BusinessContext>;
  confidence: Partial<ExtractionConfidence>;
  suggestions: (string | ExtractionSuggestion)[];
}

// ============================================
// POLISHED CONTENT (for public content page)
// ============================================

export type PolishedBlockType = 'paragraph' | 'callout' | 'list' | 'quote' | 'divider';
export type CalloutStyle = 'info' | 'warning' | 'success';

export interface PolishedBlock {
  type: PolishedBlockType;
  content: string;
  style?: CalloutStyle;
}

export interface PolishedSection {
  id: string;
  sectionName: string;
  introduction: string;
  blocks: PolishedBlock[];
  keyTakeaway: string;
}

export interface PolishedContent {
  version: number;
  polishedAt: string;
  sections: PolishedSection[];
  heroSummary: string;
  metadata: {
    readingTimeMinutes: number;
    wordCount: number;
  };
}

// ============================================
// LEAD MAGNET DATABASE ENTITY
// ============================================

export type LeadMagnetStatus = 'draft' | 'published' | 'scheduled' | 'archived';

export interface LeadMagnet {
  id: string;
  userId: string;
  title: string;
  archetype: LeadMagnetArchetype;
  concept: LeadMagnetConcept | null;
  extractedContent: ExtractedContent | null;
  generatedContent: unknown | null;
  linkedinPost: string | null;
  postVariations: PostVariation[] | null;
  dmTemplate: string | null;
  ctaWord: string | null;
  thumbnailUrl: string | null;
  leadsharkPostId: string | null;
  leadsharkAutomationId: string | null;
  scheduledTime: string | null;
  polishedContent: PolishedContent | null;
  polishedAt: string | null;
  status: LeadMagnetStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// ANALYTICS
// ============================================

export interface LeadMagnetAnalytics {
  id: string;
  leadMagnetId: string;
  linkedinViews: number;
  linkedinLikes: number;
  linkedinComments: number;
  linkedinShares: number;
  dmsSent: number;
  dmsReplied: number;
  connectionsMade: number;
  leadsCaptured: number;
  capturedAt: string;
}

// ============================================
// IDEATION SOURCES (Call Transcripts & Competitor Analysis)
// ============================================

export interface CallTranscriptInsights {
  painPoints: Array<{
    quote: string;
    theme: string;
    frequency: 'mentioned-once' | 'recurring' | 'dominant';
  }>;
  frequentQuestions: Array<{
    question: string;
    context: string;
  }>;
  transformationOutcomes: Array<{
    desiredState: string;
    currentState: string;
  }>;
  objections: Array<{
    objection: string;
    underlyingConcern: string;
  }>;
  languagePatterns: string[];
}

export interface CompetitorAnalysis {
  detectedArchetype: LeadMagnetArchetype | null;
  format: string;
  painPointAddressed: string;
  effectivenessFactors: string[];
  adaptationSuggestions: string[];
  originalTitle: string;
}

export interface IdeationSources {
  callTranscript?: {
    raw: string;
    insights: CallTranscriptInsights;
  };
  competitorInspiration?: {
    raw: string;
    analysis: CompetitorAnalysis;
  };
}

// ============================================
// WIZARD STATE
// ============================================

export interface WizardState {
  currentStep: number;
  brandKit: Partial<BusinessContext>;
  ideationSources: IdeationSources;
  ideationResult: IdeationResult | null;
  selectedConceptIndex: number | null;
  extractionAnswers: Record<string, string>;
  chatMessages: ChatMessage[];
  extractedContent: ExtractedContent | null;
  postResult: PostWriterResult | null;
  selectedPostIndex: number | null;
  isCustomIdea: boolean;
  customConcept: LeadMagnetConcept | null;
}

export interface WizardDraft {
  id: string;
  wizard_state: WizardState;
  current_step: number;
  draft_title: string | null;
  updated_at: string;
}

export const WIZARD_STEPS = [
  { id: 1, name: 'Context', description: 'Tell us about your business' },
  { id: 2, name: 'Ideation', description: 'Choose your lead magnet concept' },
  { id: 3, name: 'Extraction', description: 'Share your expertise' },
  { id: 4, name: 'Content', description: 'Review your lead magnet' },
  { id: 5, name: 'Post', description: 'Create your LinkedIn post' },
  { id: 6, name: 'Publish', description: 'Share with the world' },
] as const;
