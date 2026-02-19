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

// ============================================
// INTERACTIVE LEAD MAGNET CONFIGS
// ============================================

export interface CalculatorInput {
  id: string;
  label: string;
  type: 'number' | 'select' | 'slider';
  placeholder?: string;
  options?: Array<{ label: string; value: number }>;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
}

export interface ResultInterpretation {
  range: [number, number];
  label: string;
  description: string;
  color: 'green' | 'yellow' | 'red';
}

export interface CalculatorConfig {
  type: 'calculator';
  headline: string;
  description: string;
  inputs: CalculatorInput[];
  formula: string;
  resultLabel: string;
  resultFormat: 'number' | 'currency' | 'percentage';
  resultInterpretation: ResultInterpretation[];
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  type: 'single_choice' | 'multiple_choice' | 'scale';
  options?: Array<{ label: string; value: number }>;
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
}

export interface ScoreRange {
  min: number;
  max: number;
  label: string;
  description: string;
  recommendations: string[];
}

export interface AssessmentConfig {
  type: 'assessment';
  headline: string;
  description: string;
  questions: AssessmentQuestion[];
  scoring: {
    method: 'sum' | 'average';
    ranges: ScoreRange[];
  };
}

export interface GPTConfig {
  type: 'gpt';
  name: string;
  description: string;
  systemPrompt: string;
  welcomeMessage: string;
  suggestedPrompts: string[];
  maxTokens?: number;
}

export type InteractiveConfig = CalculatorConfig | AssessmentConfig | GPTConfig;

export const INTERACTIVE_ARCHETYPES: LeadMagnetArchetype[] = [
  'single-calculator',
  'assessment',
  'prompt',
];

export function isInteractiveArchetype(archetype: LeadMagnetArchetype): boolean {
  return INTERACTIVE_ARCHETYPES.includes(archetype);
}

export function getInteractiveType(archetype: LeadMagnetArchetype): InteractiveConfig['type'] | null {
  switch (archetype) {
    case 'single-calculator': return 'calculator';
    case 'assessment': return 'assessment';
    case 'prompt': return 'gpt';
    default: return null;
  }
}

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

export type PolishedBlockType =
  | 'paragraph'
  | 'callout'
  | 'list'
  | 'quote'
  | 'divider'
  | 'image'
  | 'embed'
  | 'code'
  | 'table'
  | 'accordion'
  | 'numbered-item'
  | 'stat-card';

export type CalloutStyle = 'info' | 'warning' | 'success';

export interface PolishedBlock {
  type: PolishedBlockType;
  content: string;
  style?: CalloutStyle;
  // Image block fields
  src?: string;
  alt?: string;
  caption?: string;
  // Embed block fields
  url?: string;
  provider?: string;
  // Code block fields
  language?: string;
  // Table block fields
  headers?: string[];
  rows?: string[][];
  // Accordion block fields
  title?: string;
  // Numbered-item block fields
  number?: number;
  detail?: string;
  category?: string;
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
  title?: string;
  sections: PolishedSection[];
  heroSummary: string;
  metadata: {
    readingTimeMinutes: number;
    wordCount: number;
  };
}

// ============================================
// SCREENSHOT URLS (for LinkedIn post images)
// ============================================

export interface ScreenshotUrl {
  type: 'hero' | 'section';
  sectionIndex?: number;
  sectionName?: string;
  url1200x627: string;
  url1080x1080: string;
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
  scheduledTime: string | null;
  polishedContent: PolishedContent | null;
  polishedAt: string | null;
  screenshotUrls?: ScreenshotUrl[];
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
  interactiveConfig: InteractiveConfig | null;
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
