# Copilot-Driven Lead Magnet Creation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the rigid 6-step wizard with copilot-driven lead magnet creation that auto-searches the AI Brain, generates only gap-filling questions, and surfaces a full-screen content review panel.

**Architecture:** The copilot's action layer (`src/lib/actions/`) gets new lead magnet creation actions that orchestrate the existing `lead-magnet-generator.ts` pipeline. A new full-screen `ContentReviewPanel` component overlays the sidebar when content is ready. Ideation becomes a separate idea bank activity. Distribution (posts, funnels) becomes actions on existing lead magnets.

**Tech Stack:** Next.js 15, React 18, Anthropic SDK (Claude Sonnet 4.6), Supabase, SSE streaming, existing copilot infrastructure

---

## Phase 1: Copilot Lead Magnet Actions (Backend)

### Task 1: Create lead magnet creation orchestrator module

This module contains the core logic for Brain-aware gap analysis and extraction question generation. It sits between the copilot actions and the existing `lead-magnet-generator.ts`.

**Files:**
- Create: `src/lib/ai/copilot/lead-magnet-creation.ts`
- Reference: `src/lib/ai/lead-magnet-generator.ts:764-848` (getContextAwareExtractionQuestions)
- Reference: `src/lib/services/knowledge-brain.ts:44-60` (searchKnowledge)
- Reference: `src/lib/ai/content-pipeline/briefing-agent.ts` (buildContentBrief)

**Step 1: Write failing test**

Create `src/__tests__/lib/ai/copilot/lead-magnet-creation.test.ts`:

```typescript
import { analyzeContextGaps, generateGapFillingQuestions } from '@/lib/ai/copilot/lead-magnet-creation';

// Mock dependencies
jest.mock('@/lib/services/knowledge-brain', () => ({
  searchKnowledge: jest.fn().mockResolvedValue({ entries: [], error: undefined }),
  searchKnowledgeV2: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/lib/ai/content-pipeline/briefing-agent', () => ({
  buildContentBrief: jest.fn().mockResolvedValue({ compiledContext: '', entries: [], readinessScore: 0 }),
}));
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

describe('analyzeContextGaps', () => {
  it('returns full question set when no context is available', async () => {
    const result = await analyzeContextGaps({
      userId: 'user-1',
      archetype: 'single-system',
      concept: {
        archetype: 'single-system',
        title: 'The Cold Email System',
        painSolved: 'Low reply rates',
        whyNowHook: 'urgency',
        contents: 'A step-by-step system',
        deliveryFormat: 'Google Doc',
        viralCheck: { highValue: true, urgentPain: true, actionableUnder1h: true, simple: true, authorityBoosting: true },
        creationTimeEstimate: '2 hours',
        bundlePotential: [],
      },
    });
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.knowledgeContext).toBeDefined();
    expect(result.gapSummary).toBeDefined();
  });

  it('returns fewer questions when Brain has rich context', async () => {
    const { searchKnowledge } = require('@/lib/services/knowledge-brain');
    searchKnowledge.mockResolvedValueOnce({
      entries: [
        { content: 'Cold email reply rates improved 3x with personalization', category: 'insight', quality_score: 4 },
        { content: 'Biggest mistake: sending generic templates', category: 'insight', quality_score: 5 },
        { content: 'Client went from 2% to 12% reply rate in 3 weeks', category: 'product_intel', quality_score: 5 },
        { content: 'How do I write subject lines that get opened?', category: 'question', quality_score: 4 },
        { content: 'We tested 50 subject line variants across 10k sends', category: 'insight', quality_score: 5 },
      ],
      error: undefined,
    });

    const result = await analyzeContextGaps({
      userId: 'user-1',
      archetype: 'single-system',
      concept: {
        archetype: 'single-system',
        title: 'The Cold Email System',
        painSolved: 'Low reply rates',
        whyNowHook: 'urgency',
        contents: 'A step-by-step system',
        deliveryFormat: 'Google Doc',
        viralCheck: { highValue: true, urgentPain: true, actionableUnder1h: true, simple: true, authorityBoosting: true },
        creationTimeEstimate: '2 hours',
        bundlePotential: [],
      },
    });
    // With rich Brain context, some questions should be marked as pre-answered
    expect(result.preAnsweredCount).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- src/__tests__/lib/ai/copilot/lead-magnet-creation.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `src/lib/ai/copilot/lead-magnet-creation.ts`:

```typescript
/**
 * Lead Magnet Creation Orchestrator for Copilot.
 * Bridges copilot actions to the lead-magnet-generator pipeline.
 * Handles Brain context gathering, gap analysis, and adaptive question generation.
 *
 * Constraint: Never imports NextRequest/NextResponse. Pure async functions only.
 */

import { getRelevantContext } from '@/lib/services/knowledge-brain';
import { buildContentBrief } from '@/lib/ai/content-pipeline/briefing-agent';
import {
  getExtractionQuestions,
  getContextAwareExtractionQuestions,
  processContentExtraction,
  generatePostVariations,
} from '@/lib/ai/lead-magnet-generator';
import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError, logWarn } from '@/lib/utils/logger';
import type {
  LeadMagnetArchetype,
  LeadMagnetConcept,
  BusinessContext,
  ContentExtractionQuestion,
  ExtractedContent,
  PostWriterResult,
} from '@/lib/types/lead-magnet';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface GapAnalysisInput {
  userId: string;
  teamId?: string;
  archetype: LeadMagnetArchetype;
  concept: LeadMagnetConcept;
  businessContext?: Partial<BusinessContext>;
  pastedContent?: string;
}

export interface GapAnalysisResult {
  questions: ContentExtractionQuestion[];
  preAnsweredCount: number;
  knowledgeContext: string;
  gapSummary: string;
  brainEntries: Array<{ content: string; category: string }>;
}

export interface CreationContext {
  userId: string;
  teamId?: string;
  archetype: LeadMagnetArchetype;
  concept: LeadMagnetConcept;
  businessContext?: Partial<BusinessContext>;
  knowledgeContext?: string;
  pastedContent?: string;
}

// ─── Brain Context Gathering ───────────────────────────────────────────────

async function gatherBrainContext(
  userId: string,
  searchQuery: string,
  teamId?: string,
): Promise<{ formatted: string; entries: Array<{ content: string; category: string }> }> {
  try {
    const result = await getRelevantContext(userId, searchQuery, 15);
    if (result.error) {
      logWarn('copilot/lm-creation', 'Brain search error', { error: result.error });
    }
    const entries = result.entries;
    if (!entries.length) return { formatted: '', entries: [] };

    const insights = entries.filter(e => e.category === 'insight');
    const questions = entries.filter(e => e.category === 'question');
    const productIntel = entries.filter(e => e.category === 'product_intel');
    const stories = entries.filter(e => e.category === 'story');

    const parts: string[] = [];
    if (insights.length > 0) {
      parts.push(`VALIDATED INSIGHTS FROM YOUR CALLS:\n${insights.map(e => `- ${e.content}`).join('\n')}`);
    }
    if (questions.length > 0) {
      parts.push(`QUESTIONS YOUR AUDIENCE ASKS:\n${questions.map(e => `- ${e.content}`).join('\n')}`);
    }
    if (productIntel.length > 0) {
      parts.push(`REAL OUTCOMES & CASE STUDIES:\n${productIntel.map(e => `- ${e.content}`).join('\n')}`);
    }
    if (stories.length > 0) {
      parts.push(`STORIES & EXPERIENCES:\n${stories.map(e => `- ${e.content}`).join('\n')}`);
    }

    if (parts.length === 0) return { formatted: '', entries: [] };

    return {
      formatted: `\n\nKNOWLEDGE BASE (from your actual calls and transcripts):\n${parts.join('\n\n')}`,
      entries: entries.map(e => ({ content: e.content, category: e.category })),
    };
  } catch {
    return { formatted: '', entries: [] };
  }
}

// ─── Brand Kit Loading ─────────────────────────────────────────────────────

async function loadBrandKit(userId: string): Promise<Partial<BusinessContext>> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from('brand_kits')
      .select('business_description, business_type, credibility_markers, urgent_pains, templates, processes, tools, frequent_questions, results, success_example')
      .eq('user_id', userId)
      .single();

    if (!data) return {};

    return {
      businessDescription: data.business_description || '',
      businessType: data.business_type || '',
      credibilityMarkers: data.credibility_markers || [],
      urgentPains: data.urgent_pains || [],
      templates: data.templates || [],
      processes: data.processes || [],
      tools: data.tools || [],
      frequentQuestions: data.frequent_questions || [],
      results: data.results || [],
      successExample: data.success_example || '',
    };
  } catch {
    return {};
  }
}

// ─── Gap Analysis ──────────────────────────────────────────────────────────

/**
 * Analyze what the Brain already knows about a topic vs. what gaps remain.
 * Returns adaptive extraction questions — fewer when Brain is rich, more when sparse.
 */
export async function analyzeContextGaps(input: GapAnalysisInput): Promise<GapAnalysisResult> {
  const { userId, teamId, archetype, concept, pastedContent } = input;

  // Load brand kit if not provided
  const businessContext = input.businessContext?.businessDescription
    ? input.businessContext as BusinessContext
    : await loadBrandKit(userId) as BusinessContext;

  // Search Brain for relevant knowledge
  const searchQuery = `${concept.title} ${concept.painSolved} ${businessContext?.businessDescription || ''}`;
  const brain = await gatherBrainContext(userId, searchQuery, teamId);

  // Get static questions for this archetype
  const staticQuestions = getExtractionQuestions(archetype);

  // If Brain has rich context, use AI to determine which questions are already answered
  let questions = staticQuestions;
  let preAnsweredCount = 0;
  let gapSummary = 'No prior knowledge found. All questions needed.';

  if (brain.entries.length >= 3) {
    // Use Claude to analyze which questions the Brain already answers
    try {
      const client = createAnthropicClient('copilot-gap-analysis');
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are analyzing which extraction questions are already answered by existing knowledge.

LEAD MAGNET CONCEPT:
- Title: "${concept.title}"
- Archetype: ${archetype}
- Pain Solved: ${concept.painSolved}

EXISTING KNOWLEDGE FROM BRAIN:
${brain.formatted}

${pastedContent ? `PASTED CONTENT:\n${pastedContent.slice(0, 3000)}\n` : ''}

EXTRACTION QUESTIONS:
${staticQuestions.map((q, i) => `${i}. [${q.id}] ${q.question}`).join('\n')}

For each question, determine if the existing knowledge SUBSTANTIALLY answers it (not just touches on it — the knowledge must provide enough detail to skip the question).

Return JSON:
{
  "analysis": [
    { "id": "question_id", "answered": true/false, "confidence": "high"/"medium"/"low", "evidence": "brief note on what knowledge covers this" }
  ],
  "gapSummary": "1-2 sentence summary of what's well-covered vs. what's missing"
}`,
        }],
      });

      const text = response.content.find(b => b.type === 'text');
      if (text && text.type === 'text') {
        const match = text.text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const answeredIds = new Set(
            (parsed.analysis || [])
              .filter((a: { answered: boolean; confidence: string }) => a.answered && a.confidence === 'high')
              .map((a: { id: string }) => a.id)
          );
          preAnsweredCount = answeredIds.size;
          gapSummary = parsed.gapSummary || gapSummary;

          // Filter to only unanswered questions
          questions = staticQuestions.filter(q => !answeredIds.has(q.id));
        }
      }
    } catch (err) {
      logWarn('copilot/lm-creation', 'Gap analysis AI call failed, using all questions', { error: err });
    }
  }

  // Get contextual (personalized) versions of the remaining questions
  if (questions.length > 0 && businessContext?.businessDescription) {
    try {
      const contextual = await getContextAwareExtractionQuestions(archetype, concept, businessContext);
      // Map contextual versions to our filtered question set
      const contextualMap = new Map(contextual.map(q => [q.id, q]));
      questions = questions.map(q => contextualMap.get(q.id) || q);
    } catch {
      // Fall back to static questions
    }
  }

  return {
    questions,
    preAnsweredCount,
    knowledgeContext: brain.formatted,
    gapSummary,
    brainEntries: brain.entries,
  };
}

// ─── Content Generation ────────────────────────────────────────────────────

/**
 * Generate lead magnet content from extraction answers + Brain context.
 * Wraps processContentExtraction with copilot-specific orchestration.
 */
export async function generateContent(
  ctx: CreationContext,
  answers: Record<string, string>,
): Promise<ExtractedContent> {
  return processContentExtraction(
    ctx.archetype,
    ctx.concept,
    answers,
    undefined, // transcript insights (already in Brain context)
    ctx.userId,
  );
}

/**
 * Generate LinkedIn post variations for an existing lead magnet.
 */
export async function generatePosts(
  userId: string,
  leadMagnetId: string,
): Promise<PostWriterResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('lead_magnets')
    .select('title, archetype, content_blocks, extraction_data')
    .eq('id', leadMagnetId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw Object.assign(new Error('Lead magnet not found'), { statusCode: 404 });
  }

  const content = data.content_blocks as ExtractedContent | null;
  if (!content) {
    throw Object.assign(new Error('Lead magnet has no content yet'), { statusCode: 400 });
  }

  // Load brand kit for audience info
  const brandKit = await loadBrandKit(userId);

  return generatePostVariations({
    leadMagnetTitle: data.title || content.title,
    format: content.format,
    contents: content.structure?.map((s: { sectionName: string }) => s.sectionName).join(', ') || '',
    problemSolved: content.differentiation || '',
    credibility: brandKit.credibilityMarkers?.join(', ') || '',
    audience: brandKit.businessDescription || '',
    audienceStyle: brandKit.businessType || '',
    proof: content.proof || '',
    ctaWord: 'SEND',
  }, userId);
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- src/__tests__/lib/ai/copilot/lead-magnet-creation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/ai/copilot/lead-magnet-creation.ts src/__tests__/lib/ai/copilot/lead-magnet-creation.test.ts
git commit -m "feat: add copilot lead magnet creation orchestrator with Brain-aware gap analysis"
```

---

### Task 2: Rewrite copilot lead magnet actions

Replace the stub CRUD actions with full creation pipeline actions that drive the copilot flow.

**Files:**
- Modify: `src/lib/actions/lead-magnets.ts` (rewrite)
- Reference: `src/lib/actions/knowledge.ts` (action pattern)
- Reference: `src/lib/actions/types.ts` (ActionContext, ActionResult)

**Step 1: Write failing test**

Create `src/__tests__/lib/actions/lead-magnets.test.ts`:

```typescript
import { getAction, getAllActions } from '@/lib/actions/registry';

// Import to trigger registration
import '@/lib/actions/lead-magnets';

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'lm-1' }, error: null }),
        }),
      }),
    }),
  }),
}));

jest.mock('@/lib/ai/copilot/lead-magnet-creation', () => ({
  analyzeContextGaps: jest.fn().mockResolvedValue({
    questions: [{ id: 'q1', question: 'Test question?', required: true }],
    preAnsweredCount: 2,
    knowledgeContext: 'Brain context here',
    gapSummary: '3 of 5 questions pre-answered',
    brainEntries: [],
  }),
  generateContent: jest.fn().mockResolvedValue({
    title: 'Test LM',
    format: 'Google Doc',
    structure: [],
    nonObviousInsight: 'insight',
    personalExperience: 'experience',
    proof: 'proof',
    commonMistakes: [],
    differentiation: 'diff',
  }),
  generatePosts: jest.fn().mockResolvedValue({
    variations: [],
    recommendation: 'Use variation 1',
    dmTemplate: 'Hi {first_name}',
    ctaWord: 'SEND',
  }),
}));

describe('lead magnet copilot actions', () => {
  it('registers start_lead_magnet_creation action', () => {
    const action = getAction('start_lead_magnet_creation');
    expect(action).toBeDefined();
    expect(action!.parameters.required).toContain('topic');
  });

  it('registers submit_extraction_answers action', () => {
    const action = getAction('submit_extraction_answers');
    expect(action).toBeDefined();
    expect(action!.parameters.required).toContain('answers');
  });

  it('registers save_lead_magnet action with confirmation', () => {
    const action = getAction('save_lead_magnet');
    expect(action).toBeDefined();
    expect(action!.requiresConfirmation).toBe(true);
  });

  it('registers generate_lead_magnet_posts action', () => {
    const action = getAction('generate_lead_magnet_posts');
    expect(action).toBeDefined();
    expect(action!.parameters.required).toContain('lead_magnet_id');
  });

  it('keeps list_lead_magnets and get_lead_magnet actions', () => {
    expect(getAction('list_lead_magnets')).toBeDefined();
    expect(getAction('get_lead_magnet')).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- src/__tests__/lib/actions/lead-magnets.test.ts`
Expected: FAIL — missing actions

**Step 3: Write implementation**

Rewrite `src/lib/actions/lead-magnets.ts`:

```typescript
/**
 * Lead Magnet Copilot Actions.
 * Drives lead magnet creation through the copilot with Brain-aware gap analysis.
 *
 * Actions: list_lead_magnets, get_lead_magnet, start_lead_magnet_creation,
 *          submit_extraction_answers, save_lead_magnet, generate_lead_magnet_posts
 *
 * Constraint: Never imports NextRequest/NextResponse.
 */

import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  analyzeContextGaps,
  generateContent,
  generatePosts,
} from '@/lib/ai/copilot/lead-magnet-creation';
import type { LeadMagnetArchetype, LeadMagnetConcept } from '@/lib/types/lead-magnet';

// ─── Read Actions (unchanged) ──────────────────────────────────────────────

registerAction({
  name: 'list_lead_magnets',
  description: 'List lead magnets for the current user. Returns title, status, archetype, and timestamps.',
  parameters: {
    properties: {
      status: {
        type: 'string',
        enum: ['draft', 'published', 'scheduled', 'archived'],
        description: 'Filter by status',
      },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
  },
  handler: async (ctx: ActionContext, params: { status?: string; limit?: number }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('lead_magnets')
      .select('id, title, status, archetype, created_at, updated_at')
      .eq('user_id', ctx.userId)
      .order('updated_at', { ascending: false })
      .limit(params.limit || 10);

    if (params.status) query = query.eq('status', params.status);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [], displayHint: 'text' };
  },
});

registerAction({
  name: 'get_lead_magnet',
  description: 'Get full details of a specific lead magnet by ID, including content blocks and extraction data.',
  parameters: {
    properties: {
      id: { type: 'string', description: 'The lead magnet ID' },
    },
    required: ['id'],
  },
  handler: async (ctx: ActionContext, params: { id: string }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('lead_magnets')
      .select('id, title, archetype, status, content_blocks, extraction_data, created_at')
      .eq('id', params.id)
      .eq('user_id', ctx.userId)
      .single();

    if (error || !data) return { success: false, error: 'Lead magnet not found' };
    return { success: true, data, displayHint: 'text' };
  },
});

// ─── Creation Actions (new) ────────────────────────────────────────────────

registerAction({
  name: 'start_lead_magnet_creation',
  description: `Start the lead magnet creation process. Call this when the user wants to create a lead magnet.
Provide their topic/idea and optionally an archetype. This action:
1. Searches the AI Brain for relevant knowledge on the topic
2. Analyzes what's already known vs. what gaps remain
3. Returns ONLY the gap-filling questions (skips questions the Brain already answers)

After receiving the questions, present them to the user conversationally — ask them one at a time or in small groups. Once answered, call submit_extraction_answers.

If the user has pasted content (transcript, blog post, document), include it as pasted_content — this dramatically reduces the number of questions needed.`,
  parameters: {
    properties: {
      topic: { type: 'string', description: 'What the lead magnet is about' },
      archetype: {
        type: 'string',
        enum: ['single-breakdown', 'single-system', 'focused-toolkit', 'single-calculator', 'focused-directory', 'mini-training', 'one-story', 'prompt', 'assessment', 'workflow'],
        description: 'Lead magnet format/type. If not specified, recommend one based on the topic.',
      },
      target_audience: { type: 'string', description: 'Who this is for (if mentioned)' },
      pasted_content: { type: 'string', description: 'Any content the user pasted (transcript, blog post, doc)' },
    },
    required: ['topic'],
  },
  handler: async (ctx: ActionContext, params: {
    topic: string;
    archetype?: string;
    target_audience?: string;
    pasted_content?: string;
  }): Promise<ActionResult> => {
    const archetype = (params.archetype || 'single-system') as LeadMagnetArchetype;

    // Build a concept from the user's input
    const concept: LeadMagnetConcept = {
      archetype,
      title: params.topic,
      painSolved: params.target_audience
        ? `Helping ${params.target_audience} with ${params.topic}`
        : params.topic,
      whyNowHook: 'relevance',
      contents: params.topic,
      deliveryFormat: 'Google Doc',
      viralCheck: {
        highValue: true,
        urgentPain: true,
        actionableUnder1h: true,
        simple: true,
        authorityBoosting: true,
      },
      creationTimeEstimate: 'TBD',
      bundlePotential: [],
    };

    const result = await analyzeContextGaps({
      userId: ctx.userId,
      teamId: ctx.teamId,
      archetype,
      concept,
      pastedContent: params.pasted_content,
    });

    return {
      success: true,
      data: {
        archetype,
        concept,
        questions: result.questions,
        preAnsweredCount: result.preAnsweredCount,
        totalQuestions: result.questions.length + result.preAnsweredCount,
        gapSummary: result.gapSummary,
        knowledgeContext: result.knowledgeContext,
        brainEntriesCount: result.brainEntries.length,
      },
      displayHint: 'text',
    };
  },
});

registerAction({
  name: 'submit_extraction_answers',
  description: `Submit the user's answers to extraction questions and generate lead magnet content.
Call this after you've collected answers to the gap-filling questions from start_lead_magnet_creation.
The answers object should map question IDs to the user's responses.

This triggers content generation and returns structured content for review.
After receiving the content, call open_content_review to show the full-screen review panel.`,
  parameters: {
    properties: {
      archetype: { type: 'string', description: 'The archetype from start_lead_magnet_creation' },
      concept_title: { type: 'string', description: 'The concept title' },
      concept_pain: { type: 'string', description: 'The pain solved' },
      answers: {
        type: 'object',
        description: 'Map of question ID to user answer text',
      },
    },
    required: ['archetype', 'answers'],
  },
  handler: async (ctx: ActionContext, params: {
    archetype: string;
    concept_title?: string;
    concept_pain?: string;
    answers: Record<string, string>;
  }): Promise<ActionResult> => {
    const archetype = params.archetype as LeadMagnetArchetype;
    const concept: LeadMagnetConcept = {
      archetype,
      title: params.concept_title || 'Untitled',
      painSolved: params.concept_pain || '',
      whyNowHook: 'relevance',
      contents: '',
      deliveryFormat: 'Google Doc',
      viralCheck: { highValue: true, urgentPain: true, actionableUnder1h: true, simple: true, authorityBoosting: true },
      creationTimeEstimate: 'TBD',
      bundlePotential: [],
    };

    const content = await generateContent(
      { userId: ctx.userId, teamId: ctx.teamId, archetype, concept },
      params.answers,
    );

    return {
      success: true,
      data: {
        content,
        message: 'Content generated. Call open_content_review to show the review panel.',
      },
      displayHint: 'content_review',
    };
  },
});

registerAction({
  name: 'save_lead_magnet',
  description: 'Save the reviewed content as a lead magnet draft. Call after the user approves content in the review panel.',
  parameters: {
    properties: {
      title: { type: 'string', description: 'Lead magnet title' },
      archetype: { type: 'string', description: 'Archetype' },
      content_blocks: { type: 'object', description: 'The approved ExtractedContent object' },
      extraction_data: { type: 'object', description: 'The extraction answers for reference' },
    },
    required: ['title', 'archetype', 'content_blocks'],
  },
  requiresConfirmation: true,
  handler: async (ctx: ActionContext, params: {
    title: string;
    archetype: string;
    content_blocks: Record<string, unknown>;
    extraction_data?: Record<string, unknown>;
  }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('lead_magnets')
      .insert({
        user_id: ctx.userId,
        title: params.title,
        archetype: params.archetype,
        status: 'draft',
        content_blocks: params.content_blocks,
        extraction_data: params.extraction_data || null,
      })
      .select('id, title, archetype, status')
      .single();

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data,
      displayHint: 'text',
    };
  },
});

registerAction({
  name: 'generate_lead_magnet_posts',
  description: 'Generate LinkedIn post variations for an existing lead magnet. Call when user says "generate posts" or "write posts" for a lead magnet.',
  parameters: {
    properties: {
      lead_magnet_id: { type: 'string', description: 'The lead magnet ID to generate posts for' },
    },
    required: ['lead_magnet_id'],
  },
  handler: async (ctx: ActionContext, params: { lead_magnet_id: string }): Promise<ActionResult> => {
    const result = await generatePosts(ctx.userId, params.lead_magnet_id);
    return {
      success: true,
      data: result,
      displayHint: 'post_preview',
    };
  },
});
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- src/__tests__/lib/actions/lead-magnets.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/actions/lead-magnets.ts src/__tests__/lib/actions/lead-magnets.test.ts
git commit -m "feat: rewrite copilot lead magnet actions with Brain-aware creation pipeline"
```

---

### Task 3: Update copilot system prompt for lead magnet creation

Add lead magnet creation guidance to the system prompt so the copilot knows how to orchestrate the flow.

**Files:**
- Modify: `src/lib/ai/copilot/system-prompt.ts`

**Step 1: Read current file**

Read `src/lib/ai/copilot/system-prompt.ts` for the full structure.

**Step 2: Add lead magnet creation section**

Add a new section to the `buildCopilotSystemPrompt` function, after the page context section. Add these lines after the page context is assembled:

```typescript
// Lead magnet creation guidance
sections.push(`
## Lead Magnet Creation

You can create lead magnets through conversation. When a user wants to create one:

1. Call start_lead_magnet_creation with their topic (and archetype if they specified one)
2. You'll receive gap-filling questions — the Brain has already answered some questions automatically
3. Ask the remaining questions conversationally — one at a time or in natural groups of 2-3
4. After collecting answers, call submit_extraction_answers
5. The content review panel will open automatically for them to review and edit
6. After they approve, call save_lead_magnet to save as a draft
7. Offer next steps: generate posts, set up funnel, or they can find it in their library

KEY BEHAVIORS:
- Always let the user know how many questions the Brain pre-answered ("I found X relevant insights from your calls, so I only need to ask Y questions")
- If they paste content (transcript, blog post), pass it as pasted_content — this reduces questions further
- If they mention a specific archetype/format, use it. If not, recommend one based on their topic.
- Never skip the extraction questions — they're what makes the content high-quality and unique
- After saving, offer to generate LinkedIn posts (separate step, not forced)
`);
```

**Step 3: Clear the system prompt cache after changes**

The prompt builder has a 5-minute TTL cache. Call `clearSystemPromptCache()` in tests.

**Step 4: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/ai/copilot/system-prompt.ts
git commit -m "feat: add lead magnet creation guidance to copilot system prompt"
```

---

## Phase 2: Full-Screen Content Review Panel (Frontend)

### Task 4: Add `content_review` display hint and SSE event support

The copilot provider needs to handle the new `content_review` display hint and open the full-screen panel.

**Files:**
- Modify: `src/lib/actions/types.ts` (add display hint)
- Modify: `src/components/copilot/CopilotProvider.tsx` (add review panel state)

**Step 1: Add display hint to types**

In `src/lib/actions/types.ts`, add `'content_review'` to the displayHint union:

```typescript
displayHint?: 'post_preview' | 'knowledge_list' | 'plan' | 'idea_list' | 'calendar' | 'text' | 'content_review';
```

**Step 2: Add review panel state to CopilotProvider**

In `src/components/copilot/CopilotProvider.tsx`, add state and context for the content review panel:

Add to context interface:
```typescript
contentReviewData: ExtractedContent | null;
isContentReviewOpen: boolean;
openContentReview: (content: ExtractedContent) => void;
closeContentReview: () => void;
approveContent: (content: ExtractedContent) => void;
```

Add state:
```typescript
const [contentReviewData, setContentReviewData] = useState<ExtractedContent | null>(null);
const [isContentReviewOpen, setIsContentReviewOpen] = useState(false);
```

Add handlers:
```typescript
const openContentReview = useCallback((content: ExtractedContent) => {
  setContentReviewData(content);
  setIsContentReviewOpen(true);
}, []);

const closeContentReview = useCallback(() => {
  setIsContentReviewOpen(false);
}, []);

const approveContent = useCallback((content: ExtractedContent) => {
  setIsContentReviewOpen(false);
  setContentReviewData(null);
  // Send approval message to copilot
  sendMessage(`Content approved. Save this lead magnet.`);
}, [sendMessage]);
```

In the `tool_result` SSE event handler, detect `content_review` display hint:
```typescript
if (data.displayHint === 'content_review' && data.result?.content) {
  openContentReview(data.result.content);
}
```

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/actions/types.ts src/components/copilot/CopilotProvider.tsx
git commit -m "feat: add content_review display hint and review panel state to copilot"
```

---

### Task 5: Create ContentReviewPanel component

Full-screen modal for reviewing and editing generated lead magnet content. Based on patterns from `ContentStep.tsx`.

**Files:**
- Create: `src/components/copilot/ContentReviewPanel.tsx`
- Reference: `src/components/wizard/steps/ContentStep.tsx` (editing patterns)

**Step 1: Write the component**

Create `src/components/copilot/ContentReviewPanel.tsx`:

```typescript
'use client';

/**
 * ContentReviewPanel — full-screen overlay for reviewing AI-generated lead magnet content.
 * Launched from copilot when content_review displayHint is received.
 *
 * Constraint: Only receives data via props from CopilotProvider. No direct API calls.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronRight, Plus, Trash2, Check, Pencil } from 'lucide-react';
import type { ExtractedContent } from '@/lib/types/lead-magnet';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ContentReviewPanelProps {
  content: ExtractedContent;
  isOpen: boolean;
  onApprove: (content: ExtractedContent) => void;
  onClose: () => void;
  onRequestChanges: (feedback: string) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalizeItem(item: string | Record<string, unknown>): string {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    const values = Object.values(item).filter((v) => typeof v === 'string').slice(0, 2);
    return values.join(': ');
  }
  return String(item);
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ContentReviewPanel({
  content: initialContent,
  isOpen,
  onApprove,
  onClose,
  onRequestChanges,
}: ContentReviewPanelProps) {
  const [content, setContent] = useState<ExtractedContent>(initialContent);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set(initialContent.structure?.map((_, i) => i) || [])
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const [changesFeedback, setChangesFeedback] = useState('');
  const [showChangesInput, setShowChangesInput] = useState(false);

  // Reset content when new data arrives
  React.useEffect(() => {
    setContent(initialContent);
    setExpandedSections(new Set(initialContent.structure?.map((_, i) => i) || []));
  }, [initialContent]);

  const toggleSection = useCallback((index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const updateSectionName = useCallback((sectionIndex: number, newName: string) => {
    setContent((prev) => ({
      ...prev,
      structure: prev.structure.map((s, i) =>
        i === sectionIndex ? { ...s, sectionName: newName } : s
      ),
    }));
  }, []);

  const updateSectionItem = useCallback((sectionIndex: number, itemIndex: number, newValue: string) => {
    setContent((prev) => ({
      ...prev,
      structure: prev.structure.map((s, i) =>
        i === sectionIndex
          ? { ...s, contents: s.contents.map((item, j) => (j === itemIndex ? newValue : item)) }
          : s
      ),
    }));
  }, []);

  const addSectionItem = useCallback((sectionIndex: number) => {
    setContent((prev) => ({
      ...prev,
      structure: prev.structure.map((s, i) =>
        i === sectionIndex ? { ...s, contents: [...s.contents, ''] } : s
      ),
    }));
  }, []);

  const removeSectionItem = useCallback((sectionIndex: number, itemIndex: number) => {
    setContent((prev) => ({
      ...prev,
      structure: prev.structure.map((s, i) =>
        i === sectionIndex
          ? { ...s, contents: s.contents.filter((_, j) => j !== itemIndex) }
          : s
      ),
    }));
  }, []);

  const addSection = useCallback(() => {
    setContent((prev) => ({
      ...prev,
      structure: [...prev.structure, { sectionName: 'New Section', contents: [''] }],
    }));
  }, []);

  const removeSection = useCallback((index: number) => {
    if (content.structure.length <= 1) return;
    setContent((prev) => ({
      ...prev,
      structure: prev.structure.filter((_, i) => i !== index),
    }));
  }, [content.structure.length]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-background px-6 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Review Your Lead Magnet</h1>
              <p className="text-sm text-muted-foreground">
                Edit any section, then approve or request changes
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!showChangesInput ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowChangesInput(true)}
                    className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Request Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => onApprove(content)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Check className="mr-1.5 inline h-4 w-4" />
                    Approve & Save
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={changesFeedback}
                    onChange={(e) => setChangesFeedback(e.target.value)}
                    placeholder="What would you like changed?"
                    className="w-80 rounded-lg border px-3 py-2 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && changesFeedback.trim()) {
                        onRequestChanges(changesFeedback);
                        setChangesFeedback('');
                        setShowChangesInput(false);
                      }
                      if (e.key === 'Escape') setShowChangesInput(false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (changesFeedback.trim()) {
                        onRequestChanges(changesFeedback);
                        setChangesFeedback('');
                        setShowChangesInput(false);
                      }
                    }}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChangesInput(false)}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-4xl overflow-y-auto px-6 py-8" style={{ maxHeight: 'calc(100vh - 80px)' }}>
          {/* Title */}
          <div className="mb-8">
            <EditableField
              label="Title"
              value={content.title}
              isEditing={editingField === 'title'}
              onStartEdit={() => setEditingField('title')}
              onSave={(v) => { setContent((p) => ({ ...p, title: v })); setEditingField(null); }}
              onCancel={() => setEditingField(null)}
              large
            />
            <p className="mt-1 text-sm text-muted-foreground">Format: {content.format}</p>
          </div>

          {/* Key Insight */}
          <div className="mb-6 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/20">
            <h3 className="mb-1 text-sm font-medium text-amber-800 dark:text-amber-200">Key Insight</h3>
            <EditableField
              value={content.nonObviousInsight}
              isEditing={editingField === 'insight'}
              onStartEdit={() => setEditingField('insight')}
              onSave={(v) => { setContent((p) => ({ ...p, nonObviousInsight: v })); setEditingField(null); }}
              onCancel={() => setEditingField(null)}
            />
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {content.structure?.map((section, sIdx) => (
              <div key={sIdx} className="rounded-lg border bg-card">
                <button
                  type="button"
                  onClick={() => toggleSection(sIdx)}
                  className="flex w-full items-center justify-between p-4"
                >
                  <div className="flex items-center gap-2">
                    {expandedSections.has(sIdx) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <EditableField
                      value={section.sectionName}
                      isEditing={editingField === `section-name-${sIdx}`}
                      onStartEdit={() => { setEditingField(`section-name-${sIdx}`); }}
                      onSave={(v) => { updateSectionName(sIdx, v); setEditingField(null); }}
                      onCancel={() => setEditingField(null)}
                      inline
                    />
                  </div>
                  {content.structure.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeSection(sIdx); }}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </button>

                {expandedSections.has(sIdx) && (
                  <div className="border-t px-4 pb-4 pt-2">
                    <ul className="space-y-2">
                      {section.contents.map((item, iIdx) => (
                        <li key={iIdx} className="group flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                          <EditableField
                            value={normalizeItem(item)}
                            isEditing={editingField === `item-${sIdx}-${iIdx}`}
                            onStartEdit={() => setEditingField(`item-${sIdx}-${iIdx}`)}
                            onSave={(v) => { updateSectionItem(sIdx, iIdx, v); setEditingField(null); }}
                            onCancel={() => setEditingField(null)}
                            multiline
                          />
                          <button
                            type="button"
                            onClick={() => removeSectionItem(sIdx, iIdx)}
                            className="mt-1 shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => addSectionItem(sIdx)}
                      className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" /> Add item
                    </button>
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addSection}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Add section
            </button>
          </div>

          {/* Personal Experience */}
          <div className="mt-6 rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4 dark:bg-blue-950/20">
            <h3 className="mb-1 text-sm font-medium text-blue-800 dark:text-blue-200">Personal Experience</h3>
            <EditableField
              value={content.personalExperience}
              isEditing={editingField === 'experience'}
              onStartEdit={() => setEditingField('experience')}
              onSave={(v) => { setContent((p) => ({ ...p, personalExperience: v })); setEditingField(null); }}
              onCancel={() => setEditingField(null)}
              multiline
            />
          </div>

          {/* Proof */}
          <div className="mt-4 rounded-lg border-l-4 border-green-500 bg-green-50 p-4 dark:bg-green-950/20">
            <h3 className="mb-1 text-sm font-medium text-green-800 dark:text-green-200">Proof & Results</h3>
            <EditableField
              value={content.proof}
              isEditing={editingField === 'proof'}
              onStartEdit={() => setEditingField('proof')}
              onSave={(v) => { setContent((p) => ({ ...p, proof: v })); setEditingField(null); }}
              onCancel={() => setEditingField(null)}
              multiline
            />
          </div>

          {/* Common Mistakes */}
          {content.commonMistakes?.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">Common Mistakes This Addresses</h3>
              <div className="flex flex-wrap gap-2">
                {content.commonMistakes.map((mistake, i) => (
                  <span key={i} className="rounded-full bg-muted px-3 py-1 text-xs">
                    {normalizeItem(mistake)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Differentiation */}
          <div className="mt-4 mb-12">
            <h3 className="mb-1 text-sm font-medium">What Makes This Different</h3>
            <EditableField
              value={content.differentiation}
              isEditing={editingField === 'differentiation'}
              onStartEdit={() => setEditingField('differentiation')}
              onSave={(v) => { setContent((p) => ({ ...p, differentiation: v })); setEditingField(null); }}
              onCancel={() => setEditingField(null)}
              multiline
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Editable Field Sub-Component ──────────────────────────────────────────

function EditableField({
  label,
  value,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  large,
  inline,
  multiline,
}: {
  label?: string;
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  large?: boolean;
  inline?: boolean;
  multiline?: boolean;
}) {
  const [editValue, setEditValue] = React.useState(value);

  React.useEffect(() => {
    setEditValue(value);
  }, [value, isEditing]);

  if (isEditing) {
    if (multiline) {
      return (
        <div className="flex-1">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSave(editValue);
              if (e.key === 'Escape') onCancel();
            }}
            className="w-full rounded border bg-background px-2 py-1 text-sm"
            rows={3}
            autoFocus
          />
          <div className="mt-1 flex gap-1">
            <button type="button" onClick={() => onSave(editValue)} className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">Save</button>
            <button type="button" onClick={onCancel} className="rounded border px-2 py-0.5 text-xs">Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div className={inline ? 'inline-flex items-center gap-1' : ''}>
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave(editValue);
            if (e.key === 'Escape') onCancel();
          }}
          className={`rounded border bg-background px-2 py-1 ${large ? 'text-xl font-semibold' : 'text-sm'} ${inline ? 'w-64' : 'w-full'}`}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div
      className={`group cursor-pointer rounded px-1 py-0.5 hover:bg-muted/50 ${inline ? 'inline-flex items-center gap-1' : ''}`}
      onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
    >
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
      <span className={large ? 'text-xl font-semibold' : 'text-sm'}>
        {value || <span className="italic text-muted-foreground">Click to edit</span>}
      </span>
      <Pencil className="ml-1 inline h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
    </div>
  );
}
```

**Step 2: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/components/copilot/ContentReviewPanel.tsx
git commit -m "feat: add full-screen ContentReviewPanel for copilot lead magnet creation"
```

---

### Task 6: Wire ContentReviewPanel into CopilotShell

Mount the panel in the shell and connect it to the provider's state.

**Files:**
- Modify: `src/components/copilot/CopilotShell.tsx`

**Step 1: Update CopilotShell**

```typescript
'use client';

import React from 'react';
import { CopilotProvider } from './CopilotProvider';
import { CopilotSidebar } from './CopilotSidebar';
import { CopilotToggleButton } from './CopilotToggleButton';
import { ContentReviewPanel } from './ContentReviewPanel';
import { useCopilot } from './CopilotProvider';

function CopilotPanels() {
  const {
    contentReviewData,
    isContentReviewOpen,
    approveContent,
    closeContentReview,
    sendMessage,
  } = useCopilot();

  return (
    <>
      <CopilotSidebar />
      <CopilotToggleButton />
      {contentReviewData && (
        <ContentReviewPanel
          content={contentReviewData}
          isOpen={isContentReviewOpen}
          onApprove={approveContent}
          onClose={closeContentReview}
          onRequestChanges={(feedback) => {
            closeContentReview();
            sendMessage(`Please update the content: ${feedback}`);
          }}
        />
      )}
    </>
  );
}

export function CopilotShell({ children }: { children: React.ReactNode }) {
  return (
    <CopilotProvider>
      {children}
      <CopilotPanels />
    </CopilotProvider>
  );
}
```

**Step 2: Verify the `useCopilot` hook is exported**

Check `CopilotProvider.tsx` exports `useCopilot`. If not, add:
```typescript
export function useCopilot() {
  const context = React.useContext(CopilotContext);
  if (!context) throw new Error('useCopilot must be used within CopilotProvider');
  return context;
}
```

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/components/copilot/CopilotShell.tsx
git commit -m "feat: wire ContentReviewPanel into CopilotShell"
```

---

## Phase 3: Idea Bank Extension

### Task 7: Add lead magnet support to content ideas

The `cp_content_ideas` table already has `content_type` with `lead_magnet` in the check constraint (migration `20260223200000`). The service layer just needs to accept it.

**Files:**
- Modify: `src/server/services/ideas.service.ts` (add `lead_magnet` to VALID_CONTENT_TYPES)
- Reference: `src/server/repositories/ideas.repo.ts` (already handles contentType filter)

**Step 1: Read the service file**

Read `src/server/services/ideas.service.ts` to find the `VALID_CONTENT_TYPES` constant.

**Step 2: Add lead_magnet to valid types**

```typescript
const VALID_CONTENT_TYPES = ['story', 'insight', 'tip', 'framework', 'case_study', 'question', 'listicle', 'contrarian', 'lead_magnet'];
```

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/server/services/ideas.service.ts
git commit -m "feat: add lead_magnet to valid content types in ideas service"
```

---

### Task 8: Add "Create Lead Magnet" action to ideas UI

Add a button/action on ideas with `content_type === 'lead_magnet'` that opens the copilot with context pre-loaded.

**Files:**
- Modify: The ideas list/card component (find the component that renders idea cards in the content pipeline)
- Reference: `src/components/copilot/CopilotProvider.tsx` (sendMessage, open)

**Step 1: Find the ideas UI component**

Search for the component that renders content ideas. Look in:
- `src/components/content-pipeline/` for ideas-related components
- `src/app/(dashboard)/` for the content pipeline page

**Step 2: Add the action button**

On idea cards where `content_type === 'lead_magnet'`, add a button that:
1. Opens the copilot sidebar
2. Sends a message like "Create a lead magnet from this idea: [title]. [core_insight]"

Use the `useCopilot()` hook from the provider:
```typescript
const { sendMessage, open } = useCopilot();

// In the idea card actions
{idea.content_type === 'lead_magnet' && (
  <button
    onClick={() => {
      open();
      sendMessage(`Create a lead magnet from this idea: "${idea.title}". ${idea.core_insight || ''}`);
    }}
    className="text-xs text-primary hover:underline"
  >
    Create Lead Magnet
  </button>
)}
```

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add [modified-files]
git commit -m "feat: add 'Create Lead Magnet' action to idea cards for lead_magnet content type"
```

---

## Phase 4: Entry Points & Polish

### Task 9: Add copilot creation entry point on the create page

Add a prominent "Create with AI Assistant" option on the `/dashboard/create` page that opens the copilot instead of entering the wizard.

**Files:**
- Modify: `src/app/(dashboard)/create/page.tsx`

**Step 1: Read the current create page**

Read `src/app/(dashboard)/create/page.tsx`.

**Step 2: Add entry point**

Add a banner or card above/beside the wizard that says "Create with AI Assistant" and opens the copilot:

```typescript
// In the create page component, add before the WizardContainer
<div className="container mx-auto max-w-4xl px-4 pt-6">
  <div className="mb-6 rounded-xl border bg-gradient-to-r from-violet-50 to-purple-50 p-6 dark:from-violet-950/20 dark:to-purple-950/20">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">Create with AI Assistant</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe what you want and the AI will guide you through creation,
          using your knowledge base to ask only the questions that matter.
        </p>
      </div>
      <CopilotCreateButton />
    </div>
  </div>
</div>
```

Create a small client component `CopilotCreateButton`:
```typescript
'use client';

import { useCopilot } from '@/components/copilot/CopilotProvider';
import { MessageSquare } from 'lucide-react';

export function CopilotCreateButton() {
  const { open, sendMessage } = useCopilot();
  return (
    <button
      onClick={() => {
        open();
        sendMessage('I want to create a new lead magnet.');
      }}
      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      <MessageSquare className="h-4 w-4" />
      Open AI Assistant
    </button>
  );
}
```

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/app/(dashboard)/create/page.tsx
git commit -m "feat: add AI Assistant creation entry point on wizard page"
```

---

### Task 10: Add copilot context registration on create page

Register the copilot page context on the create page so the copilot knows the user is in creation mode.

**Files:**
- Modify: `src/app/(dashboard)/create/page.tsx` or the WizardContainer

**Step 1: Add useCopilotContext**

```typescript
import { useCopilotContext } from '@/components/copilot/useCopilotContext';

// In the component body:
useCopilotContext({
  page: 'lead-magnet-creation',
  description: 'Lead magnet creation wizard — user is creating a new lead magnet',
});
```

**Step 2: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add [modified-files]
git commit -m "feat: register copilot context on create page"
```

---

### Task 11: Add "Generate Posts" and "Set Up Funnel" actions to lead magnet library

Add decoupled distribution actions to the library page so users can generate posts and set up funnels independently.

**Files:**
- Modify: The lead magnet library card/list component
- Reference: Find the library page component

**Step 1: Find the library UI**

Search `src/app/(dashboard)/library/` and `src/components/` for the library list component.

**Step 2: Add action buttons**

For each lead magnet card in the library, add:
- "Generate Posts" button → opens copilot with `generate_lead_magnet_posts` intent
- "Set Up Funnel" link → navigates to `/library/[id]/funnel` (already exists)

```typescript
// Generate Posts action
<button
  onClick={() => {
    open();
    sendMessage(`Generate LinkedIn posts for my lead magnet "${leadMagnet.title}" (ID: ${leadMagnet.id})`);
  }}
  className="text-xs text-primary hover:underline"
>
  Generate Posts
</button>
```

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add [modified-files]
git commit -m "feat: add Generate Posts action to library cards via copilot"
```

---

## Phase 5: Testing & Verification

### Task 12: Integration test for copilot lead magnet creation flow

End-to-end test of the copilot action chain.

**Files:**
- Create: `src/__tests__/api/copilot/lead-magnet-creation.test.ts`

**Step 1: Write integration test**

```typescript
/**
 * Integration test for copilot-driven lead magnet creation flow.
 * Tests the action chain: start → answer questions → generate → save.
 */

import { getAction } from '@/lib/actions/registry';
import '@/lib/actions/lead-magnets';

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { business_description: 'Test agency' }, error: null }),
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'lm-new', title: 'Test LM', archetype: 'single-system', status: 'draft' }, error: null }),
        }),
      }),
    }),
  }),
}));

jest.mock('@/lib/services/knowledge-brain', () => ({
  getRelevantContext: jest.fn().mockResolvedValue({ entries: [], error: undefined }),
  searchKnowledge: jest.fn().mockResolvedValue({ entries: [] }),
  searchKnowledgeV2: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/ai/content-pipeline/briefing-agent', () => ({
  buildContentBrief: jest.fn().mockResolvedValue({ compiledContext: '', entries: [], readinessScore: 0 }),
}));

jest.mock('@/lib/ai/lead-magnet-generator', () => ({
  getExtractionQuestions: jest.fn().mockReturnValue([
    { id: 'q1', question: 'What outcome?', required: true },
    { id: 'q2', question: 'Walk through steps?', required: true },
  ]),
  getContextAwareExtractionQuestions: jest.fn().mockResolvedValue([
    { id: 'q1', question: 'Custom question 1?', required: true },
    { id: 'q2', question: 'Custom question 2?', required: true },
  ]),
  processContentExtraction: jest.fn().mockResolvedValue({
    title: 'The Cold Email System',
    format: 'Google Doc',
    structure: [{ sectionName: 'Step 1', contents: ['Do this'] }],
    nonObviousInsight: 'Personalization > volume',
    personalExperience: 'My experience',
    proof: '3x reply rates',
    commonMistakes: ['Sending too many'],
    differentiation: 'Based on real data',
  }),
  generatePostVariations: jest.fn().mockResolvedValue({
    variations: [{ hookType: 'Specific Result', post: 'Post text', whyThisAngle: 'Good hook' }],
    recommendation: 'Use variation 1',
    dmTemplate: 'Hi {first_name}',
    ctaWord: 'SEND',
  }),
}));

describe('copilot lead magnet creation flow', () => {
  const ctx = { userId: 'user-1' };

  it('start_lead_magnet_creation returns gap-filling questions', async () => {
    const action = getAction('start_lead_magnet_creation')!;
    const result = await action.handler(ctx, { topic: 'cold email system', archetype: 'single-system' });

    expect(result.success).toBe(true);
    expect(result.data.questions).toBeDefined();
    expect(result.data.archetype).toBe('single-system');
  });

  it('submit_extraction_answers generates content', async () => {
    const action = getAction('submit_extraction_answers')!;
    const result = await action.handler(ctx, {
      archetype: 'single-system',
      concept_title: 'The Cold Email System',
      answers: { q1: 'Higher reply rates', q2: 'Step 1: Research, Step 2: Personalize' },
    });

    expect(result.success).toBe(true);
    expect(result.data.content).toBeDefined();
    expect(result.data.content.title).toBe('The Cold Email System');
    expect(result.displayHint).toBe('content_review');
  });

  it('save_lead_magnet requires confirmation and creates draft', async () => {
    const action = getAction('save_lead_magnet')!;
    expect(action.requiresConfirmation).toBe(true);

    const result = await action.handler(ctx, {
      title: 'The Cold Email System',
      archetype: 'single-system',
      content_blocks: { title: 'Test', format: 'Doc', structure: [] },
    });

    expect(result.success).toBe(true);
    expect(result.data.status).toBe('draft');
  });
});
```

**Step 2: Run test**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- src/__tests__/api/copilot/lead-magnet-creation.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/__tests__/api/copilot/lead-magnet-creation.test.ts
git commit -m "test: add integration test for copilot lead magnet creation flow"
```

---

### Task 13: Typecheck and lint

**Step 1: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors

**Step 2: Run lint**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm lint`
Expected: No errors

**Step 3: Fix any issues found**

Address type errors, missing imports, or lint violations.

**Step 4: Commit fixes if any**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add -A
git commit -m "fix: resolve typecheck and lint issues from copilot creation feature"
```

---

### Task 14: Run full test suite

**Step 1: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test`
Expected: All tests pass, no regressions

**Step 2: Fix any failures**

If existing tests break (especially copilot tests that might reference the old `create_lead_magnet` action), update them to match the new action names.

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add -A
git commit -m "fix: update existing tests for new copilot lead magnet actions"
```

---

### Task 15: Update documentation

**Files:**
- Modify: `docs/ai-copilot.md` (add lead magnet creation section)
- Modify: `CLAUDE.md` (add feature to docs table)

**Step 1: Add to ai-copilot.md**

Add a section documenting the new lead magnet creation flow, new actions, and the ContentReviewPanel.

**Step 2: Add to CLAUDE.md feature docs table**

Add entry linking to the design doc.

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add docs/ai-copilot.md CLAUDE.md
git commit -m "docs: document copilot-driven lead magnet creation flow"
```

---

## Summary of Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/ai/copilot/lead-magnet-creation.ts` | Create | Brain-aware gap analysis + orchestration |
| `src/lib/actions/lead-magnets.ts` | Rewrite | New copilot actions for creation pipeline |
| `src/lib/actions/types.ts` | Modify | Add `content_review` display hint |
| `src/lib/ai/copilot/system-prompt.ts` | Modify | Add creation guidance section |
| `src/components/copilot/CopilotProvider.tsx` | Modify | Add review panel state + handlers |
| `src/components/copilot/CopilotShell.tsx` | Modify | Wire up ContentReviewPanel |
| `src/components/copilot/ContentReviewPanel.tsx` | Create | Full-screen content review modal |
| `src/server/services/ideas.service.ts` | Modify | Add `lead_magnet` to valid content types |
| `src/app/(dashboard)/create/page.tsx` | Modify | Add AI Assistant entry point |
| Ideas card component | Modify | Add "Create Lead Magnet" action |
| Library card component | Modify | Add "Generate Posts" action |
| `src/__tests__/lib/ai/copilot/lead-magnet-creation.test.ts` | Create | Unit tests for orchestrator |
| `src/__tests__/lib/actions/lead-magnets.test.ts` | Create | Action registration tests |
| `src/__tests__/api/copilot/lead-magnet-creation.test.ts` | Create | Integration test for flow |
| `docs/ai-copilot.md` | Modify | Document new feature |
