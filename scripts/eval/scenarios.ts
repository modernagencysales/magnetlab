/** Eval Scenarios. Test cases for AI coaching quality evaluation.
 *  Each scenario defines a user prompt, mock program state, and grading criteria.
 *  Never imports NextRequest, NextResponse, or cookies. */

import type { ModuleId, CoachingMode } from '@/lib/types/accelerator';

// ─── Types ───────────────────────────────────────────────

export interface EvalScenario {
  id: string;
  name: string;
  category: 'onboarding' | 'coaching' | 'deliverable' | 'review' | 'error_handling';
  /** The user message to send */
  userMessage: string;
  /** Mock program state for this scenario */
  programState: MockProgramState;
  /** What the response MUST contain (string match or regex) */
  mustInclude: string[];
  /** What the response must NOT contain */
  mustNotInclude: string[];
  /** LLM judge rubric — specific quality criteria */
  rubric: RubricItem[];
}

export interface RubricItem {
  criterion: string;
  weight: number; // 1-5, how important this criterion is
  description: string;
}

export interface MockProgramState {
  coachingMode: CoachingMode;
  activeModule: ModuleId;
  activeModuleStatus: 'not_started' | 'active';
  currentStep: string | null;
  onboardingCompleted: boolean;
  deliverablesCount: number;
  reviewQueueCount: number;
  intakeData?: Record<string, unknown>;
}

// ─── Scenarios ───────────────────────────────────────────

export const EVAL_SCENARIOS: EvalScenario[] = [
  // ─── Onboarding ──────────────────────────────────────

  {
    id: 'onboard-1',
    name: 'New enrollment — first message',
    category: 'onboarding',
    userMessage: "I just enrolled in the GTM Accelerator. Let's start with my onboarding intake.",
    programState: {
      coachingMode: 'guide_me',
      activeModule: 'm0',
      activeModuleStatus: 'not_started',
      currentStep: null,
      onboardingCompleted: false,
      deliverablesCount: 0,
      reviewQueueCount: 0,
    },
    mustInclude: [],
    mustNotInclude: ['error', 'sorry, I cannot'],
    rubric: [
      {
        criterion: 'welcome',
        weight: 3,
        description: 'Welcomes the user warmly and sets expectations',
      },
      {
        criterion: 'asks_question',
        weight: 5,
        description: 'Asks an intake question (what they sell, to whom, etc.)',
      },
      {
        criterion: 'one_at_a_time',
        weight: 4,
        description: 'Asks ONE question at a time, not a wall of questions',
      },
      {
        criterion: 'coach_tone',
        weight: 3,
        description: 'Sounds like a knowledgeable coach, not a generic chatbot',
      },
      {
        criterion: 'action_oriented',
        weight: 2,
        description: 'Conveys that they will get a win today',
      },
    ],
  },

  {
    id: 'onboard-2',
    name: 'Intake response — business description',
    category: 'onboarding',
    userMessage:
      'I run a boutique video production agency. We do brand videos and social content for B2B SaaS companies, mostly Series A to C. Revenue is about $15K/month.',
    programState: {
      coachingMode: 'guide_me',
      activeModule: 'm0',
      activeModuleStatus: 'not_started',
      currentStep: null,
      onboardingCompleted: false,
      deliverablesCount: 0,
      reviewQueueCount: 0,
    },
    mustInclude: [],
    mustNotInclude: ["I don't understand", 'please clarify'],
    rubric: [
      {
        criterion: 'acknowledges_business',
        weight: 4,
        description: 'Acknowledges the specific business (video production, B2B SaaS)',
      },
      {
        criterion: 'next_question',
        weight: 5,
        description: 'Asks the next intake question (LinkedIn posting, channels, goals)',
      },
      {
        criterion: 'no_premature_advice',
        weight: 3,
        description: 'Does NOT jump into giving advice before completing intake',
      },
      {
        criterion: 'specific_understanding',
        weight: 4,
        description: 'Reflects understanding of their niche (not generic acknowledgment)',
      },
    ],
  },

  // ─── Module Coaching ─────────────────────────────────

  {
    id: 'coach-m0-1',
    name: 'ICP module — getting started',
    category: 'coaching',
    userMessage: "Let's work on Positioning & ICP (m0). What should I focus on next?",
    programState: {
      coachingMode: 'guide_me',
      activeModule: 'm0',
      activeModuleStatus: 'active',
      currentStep: 'define_icp',
      onboardingCompleted: true,
      deliverablesCount: 0,
      reviewQueueCount: 0,
      intakeData: {
        business_description: 'Video production agency for B2B SaaS',
        target_audience: 'Series A-C SaaS companies',
        monthly_revenue: '$15K',
      },
    },
    mustInclude: [],
    mustNotInclude: ['skip to module', 'not available'],
    rubric: [
      {
        criterion: 'references_sop',
        weight: 5,
        description: 'References the ICP/positioning SOP or Caroline Framework approach',
      },
      {
        criterion: 'uses_intake_data',
        weight: 5,
        description: 'Uses the intake data (video production, SaaS) to personalize guidance',
      },
      {
        criterion: 'specific_next_step',
        weight: 4,
        description: 'Gives a clear, specific next step (not vague "work on ICP")',
      },
      {
        criterion: 'offers_to_build',
        weight: 3,
        description: 'Offers to help build/draft the ICP (matches guide_me coaching mode)',
      },
      {
        criterion: 'quality_bar_aware',
        weight: 2,
        description: 'Mentions or implies what "good" looks like (quality bar awareness)',
      },
    ],
  },

  {
    id: 'coach-m1-1',
    name: 'Lead Magnet module — ideation',
    category: 'coaching',
    userMessage:
      'I need help coming up with lead magnet ideas. My ICP is VP of Marketing at Series B SaaS companies.',
    programState: {
      coachingMode: 'guide_me',
      activeModule: 'm1',
      activeModuleStatus: 'active',
      currentStep: 'ideation',
      onboardingCompleted: true,
      deliverablesCount: 2,
      reviewQueueCount: 0,
      intakeData: {
        business_description: 'Video production agency for B2B SaaS',
        target_audience: 'VP Marketing at Series B SaaS',
      },
    },
    mustInclude: [],
    mustNotInclude: [],
    rubric: [
      {
        criterion: 'multiple_ideas',
        weight: 5,
        description: 'Generates or offers to generate multiple lead magnet concepts (not just one)',
      },
      {
        criterion: 'icp_relevant',
        weight: 5,
        description: 'Ideas are specific to VP Marketing at SaaS (not generic lead magnets)',
      },
      {
        criterion: 'format_variety',
        weight: 3,
        description: 'Suggests different formats (guide, checklist, template, case study, etc.)',
      },
      {
        criterion: 'explains_why',
        weight: 3,
        description: 'Explains why each idea would resonate with the ICP',
      },
      {
        criterion: 'actionable',
        weight: 4,
        description: 'Offers to build one immediately or asks which to pursue',
      },
    ],
  },

  {
    id: 'coach-m4-1',
    name: 'Cold Email module — sequence help',
    category: 'coaching',
    userMessage:
      'I need to write cold emails to reach video production prospects. Can you help me draft a 3-email sequence?',
    programState: {
      coachingMode: 'do_it',
      activeModule: 'm4',
      activeModuleStatus: 'active',
      currentStep: 'write_sequence',
      onboardingCompleted: true,
      deliverablesCount: 5,
      reviewQueueCount: 0,
      intakeData: {
        business_description: 'Video production agency for B2B SaaS',
        target_audience: 'VP Marketing at Series B SaaS',
      },
    },
    mustInclude: [],
    mustNotInclude: [],
    rubric: [
      {
        criterion: 'drafts_emails',
        weight: 5,
        description: 'Actually drafts email content (do_it mode = just build it)',
      },
      {
        criterion: 'three_emails',
        weight: 4,
        description: 'Provides all 3 emails as requested (not just one)',
      },
      {
        criterion: 'personalized',
        weight: 5,
        description: 'Emails reference video production / SaaS marketing (not generic)',
      },
      {
        criterion: 'best_practices',
        weight: 3,
        description: 'Follows cold email best practices (short, clear CTA, no attachments)',
      },
      {
        criterion: 'subject_lines',
        weight: 2,
        description: 'Includes subject lines for each email',
      },
      {
        criterion: 'do_it_mode',
        weight: 4,
        description: 'Executes directly without over-explaining (matches do_it coaching mode)',
      },
    ],
  },

  // ─── Teach Me mode ───────────────────────────────────

  {
    id: 'coach-teach-1',
    name: 'Teach Me mode — explain TAM building',
    category: 'coaching',
    userMessage: 'Why is TAM building important and how should I approach it?',
    programState: {
      coachingMode: 'teach_me',
      activeModule: 'm2',
      activeModuleStatus: 'active',
      currentStep: 'build_tam',
      onboardingCompleted: true,
      deliverablesCount: 3,
      reviewQueueCount: 0,
      intakeData: {
        business_description: 'Video production agency for B2B SaaS',
      },
    },
    mustInclude: [],
    mustNotInclude: [],
    rubric: [
      {
        criterion: 'explains_why',
        weight: 5,
        description: 'Explains WHY TAM building matters (not just what to do)',
      },
      {
        criterion: 'teaches_concept',
        weight: 5,
        description: 'Teaches the concept step-by-step (matches teach_me mode)',
      },
      {
        criterion: 'asks_understanding',
        weight: 4,
        description: 'Checks understanding or asks what makes sense for their case',
      },
      {
        criterion: 'specific_to_business',
        weight: 4,
        description: 'Relates TAM to their video production agency',
      },
      {
        criterion: 'no_rushing',
        weight: 3,
        description: 'Does not rush to execution — teaches first',
      },
    ],
  },

  // ─── Deliverable Review ──────────────────────────────

  {
    id: 'review-1',
    name: 'Review queue — presents pending items',
    category: 'review',
    userMessage: 'What do I need to review today?',
    programState: {
      coachingMode: 'guide_me',
      activeModule: 'm1',
      activeModuleStatus: 'active',
      currentStep: 'build_magnet',
      onboardingCompleted: true,
      deliverablesCount: 4,
      reviewQueueCount: 2,
    },
    mustInclude: [],
    mustNotInclude: [],
    rubric: [
      {
        criterion: 'mentions_queue',
        weight: 5,
        description: 'Tells user about the 2 pending review items',
      },
      {
        criterion: 'presents_items',
        weight: 4,
        description: 'Presents the items for review (or offers to fetch them)',
      },
      {
        criterion: 'clear_actions',
        weight: 4,
        description: 'Explains what approve/reject does and guides the decision',
      },
      {
        criterion: 'priority_guidance',
        weight: 2,
        description: 'Suggests which to review first or why',
      },
    ],
  },

  // ─── Error / Edge Cases ──────────────────────────────

  {
    id: 'edge-1',
    name: 'User tries to skip ahead',
    category: 'error_handling',
    userMessage: 'I want to skip ICP and go straight to cold email. I already know my audience.',
    programState: {
      coachingMode: 'guide_me',
      activeModule: 'm0',
      activeModuleStatus: 'active',
      currentStep: 'define_icp',
      onboardingCompleted: true,
      deliverablesCount: 0,
      reviewQueueCount: 0,
    },
    mustInclude: [],
    mustNotInclude: [],
    rubric: [
      {
        criterion: 'respects_order',
        weight: 5,
        description: 'Explains that modules must be completed in order',
      },
      {
        criterion: 'empathetic',
        weight: 4,
        description: 'Acknowledges the user frustration / desire to move fast',
      },
      {
        criterion: 'explains_why',
        weight: 4,
        description: 'Explains WHY the order matters (ICP feeds everything downstream)',
      },
      {
        criterion: 'offers_speed',
        weight: 3,
        description: 'Offers to speed through the current module quickly',
      },
      {
        criterion: 'not_robotic',
        weight: 3,
        description: 'Does not sound like a rules-enforcing robot',
      },
    ],
  },

  {
    id: 'edge-2',
    name: 'Off-topic question',
    category: 'error_handling',
    userMessage: "What's the best CRM for a small agency? Should I use HubSpot or Pipedrive?",
    programState: {
      coachingMode: 'guide_me',
      activeModule: 'm0',
      activeModuleStatus: 'active',
      currentStep: 'define_icp',
      onboardingCompleted: true,
      deliverablesCount: 1,
      reviewQueueCount: 0,
    },
    mustInclude: [],
    mustNotInclude: [],
    rubric: [
      {
        criterion: 'answers_helpfully',
        weight: 4,
        description: 'Gives a helpful answer (does not refuse to engage)',
      },
      {
        criterion: 'relevant_advice',
        weight: 3,
        description: 'Gives relevant CRM advice for a small agency',
      },
      {
        criterion: 'redirects_gracefully',
        weight: 4,
        description: 'Gently steers back to the accelerator module work',
      },
      {
        criterion: 'not_dismissive',
        weight: 3,
        description: 'Does not dismiss the question as off-topic',
      },
    ],
  },

  // ─── Content Quality ─────────────────────────────────

  {
    id: 'quality-1',
    name: 'LinkedIn content coaching',
    category: 'deliverable',
    userMessage:
      'Help me write a LinkedIn post about why B2B SaaS companies underinvest in video content.',
    programState: {
      coachingMode: 'guide_me',
      activeModule: 'm7',
      activeModuleStatus: 'active',
      currentStep: 'write_post',
      onboardingCompleted: true,
      deliverablesCount: 6,
      reviewQueueCount: 0,
      intakeData: {
        business_description: 'Video production agency for B2B SaaS',
        target_audience: 'VP Marketing at Series B SaaS',
        linkedin_frequency: 'Weekly',
      },
    },
    mustInclude: [],
    mustNotInclude: [],
    rubric: [
      {
        criterion: 'drafts_post',
        weight: 5,
        description: 'Produces an actual LinkedIn post draft (not just advice)',
      },
      {
        criterion: 'hook',
        weight: 4,
        description: 'Opens with a strong hook that would stop scrolling',
      },
      {
        criterion: 'expertise_voice',
        weight: 5,
        description: 'Positions user as an expert (not a salesperson)',
      },
      {
        criterion: 'specific_insights',
        weight: 4,
        description: 'Includes specific insights about video in B2B SaaS (not generic)',
      },
      {
        criterion: 'cta',
        weight: 3,
        description: 'Includes a conversational CTA (not "book a call" but engagement-driving)',
      },
      {
        criterion: 'appropriate_length',
        weight: 2,
        description: 'LinkedIn-appropriate length (not a blog post)',
      },
    ],
  },
];
