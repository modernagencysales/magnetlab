/**
 * Copilot Lead Magnet Creation Orchestrator.
 *
 * Bridges copilot actions to the existing lead-magnet-generator pipeline.
 * Handles Brain context gathering, gap analysis (figuring out which extraction
 * questions the Brain already answers), and content generation.
 *
 * Never imports NextRequest, NextResponse, or cookies. Pure async functions only.
 */

import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import {
  getExtractionQuestions,
  getContextAwareExtractionQuestions,
  processContentExtraction,
  generatePostVariations,
} from '@/lib/ai/lead-magnet-generator';
import { getRelevantContext } from '@/lib/services/knowledge-brain';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError, logWarn } from '@/lib/utils/logger';
import type {
  BusinessContext,
  LeadMagnetArchetype,
  LeadMagnetConcept,
  ContentExtractionQuestion,
  ExtractedContent,
  PostWriterResult,
  PostWriterInput,
} from '@/lib/types/lead-magnet';

// ─── Types ──────────────────────────────────────────────────

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

interface GapAnalysisItem {
  questionId: string;
  answered: boolean;
  confidence: number;
  evidence: string;
}

// ─── Constants ──────────────────────────────────────────────

const BRAND_KIT_COLUMNS =
  'business_description, business_type, credibility_markers, urgent_pains, templates, processes, tools, frequent_questions, results, success_example, audience_tools';

const LEAD_MAGNET_POST_COLUMNS =
  'id, user_id, title, archetype, concept, extracted_content, status';

const BRAIN_THRESHOLD = 3;

const LOG_CTX = 'copilot/lead-magnet-creation';

// ─── Gap Analysis ───────────────────────────────────────────

/**
 * Analyze which extraction questions the AI Brain can already answer.
 * Returns a filtered set of questions the user still needs to provide,
 * along with the knowledge context for content generation.
 */
export async function analyzeContextGaps(input: GapAnalysisInput): Promise<GapAnalysisResult> {
  const { userId, archetype, concept, pastedContent } = input;

  // Load business context from brand kit if not provided
  let businessContext = input.businessContext;
  if (!businessContext) {
    businessContext = await loadBrandKit(userId);
  }

  // Get static extraction questions for the archetype
  const staticQuestions = getExtractionQuestions(archetype);
  if (staticQuestions.length === 0) {
    return {
      questions: [],
      preAnsweredCount: 0,
      knowledgeContext: '',
      gapSummary: 'No extraction questions for this archetype.',
      brainEntries: [],
    };
  }

  // Search AI Brain for relevant context
  const searchQuery = buildSearchQuery(concept, businessContext);
  const brainResult = await searchBrain(userId, searchQuery);
  const brainEntries = brainResult.map((e) => ({
    content: e.content,
    category: e.category,
  }));

  // Format knowledge context string
  const knowledgeContext = formatKnowledgeContext(brainResult);

  // If Brain has enough entries, run gap analysis to filter questions
  let unansweredQuestions = staticQuestions;
  let preAnsweredCount = 0;
  let gapSummary = 'No Brain context available — all questions required.';

  if (brainEntries.length >= BRAIN_THRESHOLD) {
    const analysis = await runGapAnalysis(
      staticQuestions,
      knowledgeContext,
      concept,
      pastedContent
    );

    if (analysis) {
      const answeredIds = new Set(
        analysis.filter((a) => a.answered && a.confidence >= 0.7).map((a) => a.questionId)
      );

      unansweredQuestions = staticQuestions.filter((q) => !answeredIds.has(q.id));
      preAnsweredCount = answeredIds.size;
      gapSummary = buildGapSummary(analysis, staticQuestions.length);
    }
  }

  // Get contextual (personalized) versions of the remaining questions
  if (unansweredQuestions.length > 0 && businessContext) {
    try {
      const contextAware = await getContextAwareExtractionQuestions(
        archetype,
        concept,
        businessContext as BusinessContext
      );
      // Map contextual questions to only the unanswered IDs
      const unansweredIds = new Set(unansweredQuestions.map((q) => q.id));
      const filtered = contextAware.filter((q) => unansweredIds.has(q.id));
      if (filtered.length === unansweredQuestions.length) {
        unansweredQuestions = filtered;
      }
    } catch (err) {
      logWarn(LOG_CTX, 'Failed to get context-aware questions, using static', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    questions: unansweredQuestions,
    preAnsweredCount,
    knowledgeContext,
    gapSummary,
    brainEntries,
  };
}

// ─── Content Generation ─────────────────────────────────────

/**
 * Generate lead magnet content from extraction answers.
 * Wraps processContentExtraction from the lead-magnet-generator pipeline.
 */
export async function generateContent(
  ctx: {
    archetype: LeadMagnetArchetype;
    concept: LeadMagnetConcept;
    userId?: string;
  },
  answers: Record<string, string>
): Promise<ExtractedContent> {
  return processContentExtraction(ctx.archetype, ctx.concept, answers, undefined, ctx.userId);
}

// ─── Post Generation ────────────────────────────────────────

/**
 * Generate LinkedIn post variations for a lead magnet.
 * Loads the lead magnet from DB, builds a PostWriterInput, and calls
 * the lead-magnet-generator post writer with Brain context injection.
 */
export async function generatePosts(
  userId: string,
  leadMagnetId: string
): Promise<PostWriterResult> {
  const supabase = createSupabaseAdminClient();

  // Load lead magnet
  const { data: lm, error: lmError } = await supabase
    .from('lead_magnets')
    .select(LEAD_MAGNET_POST_COLUMNS)
    .eq('id', leadMagnetId)
    .eq('user_id', userId)
    .single();

  if (lmError || !lm) {
    throw Object.assign(new Error(`Lead magnet not found: ${leadMagnetId}`), { statusCode: 404 });
  }

  const concept = lm.concept as LeadMagnetConcept | null;
  const extractedContent = lm.extracted_content as ExtractedContent | null;

  if (!concept || !extractedContent) {
    throw Object.assign(new Error('Lead magnet missing concept or extracted content'), {
      statusCode: 400,
    });
  }

  // Load brand kit for audience/credibility info
  const brandKit = await loadBrandKit(userId);

  // Build PostWriterInput
  const postInput: PostWriterInput = {
    leadMagnetTitle: concept.title,
    format: concept.deliveryFormat,
    contents: concept.contents,
    problemSolved: concept.painSolved,
    credibility: brandKit?.credibilityMarkers?.join(', ') || 'Industry expert',
    audience: brandKit?.businessDescription || 'Business professionals',
    audienceStyle: 'professional-polished',
    proof: extractedContent.proof || '',
    ctaWord: 'SEND',
  };

  return generatePostVariations(postInput, userId);
}

// ─── Internal Helpers ───────────────────────────────────────

/**
 * Load brand kit from DB and map to partial BusinessContext.
 * Returns undefined on failure (non-breaking).
 */
async function loadBrandKit(userId: string): Promise<Partial<BusinessContext> | undefined> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('brand_kits')
      .select(BRAND_KIT_COLUMNS)
      .eq('user_id', userId)
      .single();

    if (error || !data) return undefined;

    const row = data as Record<string, unknown>;
    return {
      businessDescription: (row.business_description as string) || '',
      businessType: (row.business_type as BusinessContext['businessType']) || 'coach-consultant',
      credibilityMarkers: (row.credibility_markers as string[]) || [],
      urgentPains: (row.urgent_pains as string[]) || [],
      templates: (row.templates as string[]) || [],
      processes: (row.processes as string[]) || [],
      tools: (row.tools as string[]) || [],
      frequentQuestions: (row.frequent_questions as string[]) || [],
      results: (row.results as string[]) || [],
      successExample: (row.success_example as string) || undefined,
      audienceTools: (row.audience_tools as string[]) || [],
    };
  } catch (err) {
    logWarn(LOG_CTX, 'Failed to load brand kit', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * Build a search query string from concept and business context.
 */
function buildSearchQuery(
  concept: LeadMagnetConcept,
  businessContext?: Partial<BusinessContext>
): string {
  const parts = [concept.title, concept.painSolved];
  if (businessContext?.businessDescription) {
    parts.push(businessContext.businessDescription);
  }
  return parts.join(' ');
}

/**
 * Search AI Brain for relevant entries. Non-breaking: returns empty on failure.
 */
async function searchBrain(
  userId: string,
  searchQuery: string
): Promise<Array<{ content: string; category: string }>> {
  try {
    const result = await getRelevantContext(userId, searchQuery, 15);
    if (result.error) {
      logWarn(LOG_CTX, 'Brain search returned error', { error: result.error });
    }
    return result.entries.map((e) => ({
      content: e.content,
      category: e.category,
    }));
  } catch (err) {
    logError(LOG_CTX, err instanceof Error ? err : new Error('Brain search failed'), { userId });
    return [];
  }
}

/**
 * Format brain entries into a knowledge context string.
 */
function formatKnowledgeContext(entries: Array<{ content: string; category: string }>): string {
  if (entries.length === 0) return '';

  const insights = entries.filter((e) => e.category === 'insight');
  const questions = entries.filter((e) => e.category === 'question');
  const productIntel = entries.filter((e) => e.category === 'product_intel');
  const other = entries.filter(
    (e) => !['insight', 'question', 'product_intel'].includes(e.category)
  );

  const sections: string[] = [];

  if (insights.length > 0) {
    sections.push(`INSIGHTS:\n${insights.map((e) => `- ${e.content}`).join('\n')}`);
  }
  if (questions.length > 0) {
    sections.push(`QUESTIONS:\n${questions.map((e) => `- ${e.content}`).join('\n')}`);
  }
  if (productIntel.length > 0) {
    sections.push(
      `OUTCOMES & CASE STUDIES:\n${productIntel.map((e) => `- ${e.content}`).join('\n')}`
    );
  }
  if (other.length > 0) {
    sections.push(`OTHER CONTEXT:\n${other.map((e) => `- ${e.content}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Use Claude Haiku to analyze which extraction questions are already answered
 * by the Brain context. Returns null on failure (non-breaking).
 */
async function runGapAnalysis(
  questions: ContentExtractionQuestion[],
  knowledgeContext: string,
  concept: LeadMagnetConcept,
  pastedContent?: string
): Promise<GapAnalysisItem[] | null> {
  try {
    const client = createAnthropicClient('copilot-gap-analysis', {
      timeout: 30_000,
    });

    const pastedSection = pastedContent
      ? `\n\nUSER-PROVIDED CONTENT:\n${pastedContent.slice(0, 3000)}\n`
      : '';

    const prompt = `You analyze whether existing knowledge can answer content extraction questions.

LEAD MAGNET CONCEPT:
- Title: "${concept.title}"
- Pain Solved: ${concept.painSolved}
- Format: ${concept.deliveryFormat}

AVAILABLE KNOWLEDGE:
${knowledgeContext.slice(0, 4000)}
${pastedSection}
EXTRACTION QUESTIONS:
${questions.map((q, i) => `${i + 1}. [id: ${q.id}] ${q.question}`).join('\n')}

For each question, determine if the available knowledge ALREADY provides a substantive answer.
- "answered": true ONLY if the knowledge contains enough detail to generate quality content for that question
- "confidence": 0.0 to 1.0 — how confident you are the question is fully answered
- "evidence": brief quote or reference to the knowledge that answers it

Return ONLY valid JSON:
{
  "analysis": [
    { "questionId": "id", "answered": true, "confidence": 0.9, "evidence": "brief reference" }
  ]
}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return null;

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      analysis: GapAnalysisItem[];
    };
    if (!Array.isArray(parsed.analysis)) return null;

    return parsed.analysis;
  } catch (err) {
    logError(LOG_CTX, err instanceof Error ? err : new Error('Gap analysis AI call failed'), {});
    return null;
  }
}

/**
 * Build a human-readable gap summary from the analysis results.
 */
function buildGapSummary(analysis: GapAnalysisItem[], totalQuestions: number): string {
  const answered = analysis.filter((a) => a.answered && a.confidence >= 0.7);
  const remaining = totalQuestions - answered.length;

  if (answered.length === 0) {
    return `Brain context found but no questions fully answered. All ${totalQuestions} questions still needed.`;
  }

  if (remaining === 0) {
    return `Brain context answers all ${totalQuestions} questions. No additional input needed.`;
  }

  return `Brain context answers ${answered.length} of ${totalQuestions} questions. ${remaining} question${remaining === 1 ? '' : 's'} still need${remaining === 1 ? 's' : ''} your input.`;
}
