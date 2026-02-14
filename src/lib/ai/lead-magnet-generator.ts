import Anthropic from '@anthropic-ai/sdk';
import type {
  BusinessContext,
  LeadMagnetArchetype,
  LeadMagnetConcept,
  IdeationResult,
  ContentExtractionQuestion,
  ExtractedContent,
  PostWriterInput,
  PostWriterResult,
  ChatMessage,
  CallTranscriptInsights,
  CompetitorAnalysis,
} from '@/lib/types/lead-magnet';
import { getRelevantContext } from '@/lib/services/knowledge-brain';
import { buildContentBrief } from '@/lib/ai/content-pipeline/briefing-agent';
import { logError, logWarn } from '@/lib/utils/logger';

// Lazy initialization to ensure env vars are loaded
function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
  }
  // Increased timeout for background jobs (4 minutes for complex AI generation like ideation)
  return new Anthropic({ apiKey, timeout: 240_000 });
}

/**
 * Build knowledge context from the AI Brain for lead magnet generation.
 * Returns a formatted string of relevant insights, or empty string if none found.
 * Non-breaking: if knowledge base is empty or search fails, returns empty string.
 */
async function getKnowledgeContext(userId: string, searchQuery: string): Promise<string> {
  try {
    const result = await getRelevantContext(userId, searchQuery, 10);
    if (result.error) {
      logWarn('ai/lead-magnet', 'Knowledge context search error', { error: result.error });
    }
    const entries = result.entries;
    if (!entries.length) return '';

    const insights = entries.filter(e => e.category === 'insight');
    const questions = entries.filter(e => e.category === 'question');
    const productIntel = entries.filter(e => e.category === 'product_intel');

    const parts: string[] = [];

    if (insights.length > 0) {
      parts.push(`VALIDATED INSIGHTS FROM YOUR COACHING CALLS:\n${insights.map(e => `- ${e.content}`).join('\n')}`);
    }
    if (questions.length > 0) {
      parts.push(`QUESTIONS YOUR AUDIENCE ACTUALLY ASKS:\n${questions.map(e => `- ${e.content}`).join('\n')}`);
    }
    if (productIntel.length > 0) {
      parts.push(`REAL OUTCOMES & CASE STUDIES:\n${productIntel.map(e => `- ${e.content}`).join('\n')}`);
    }

    if (parts.length === 0) return '';

    return `\n\nKNOWLEDGE BASE CONTEXT (from your actual calls):\nUse these real insights, questions, and outcomes to make concepts more authentic and grounded.\n\n${parts.join('\n\n')}`;
  } catch {
    // Non-critical — proceed without knowledge context
    return '';
  }
}

// =============================================================================
// IDEATION SOURCES: TRANSCRIPT & COMPETITOR ANALYSIS
// =============================================================================

/**
 * Analyze a sales/coaching call transcript to extract actionable insights
 */
export async function analyzeCallTranscript(
  transcript: string
): Promise<CallTranscriptInsights> {
  const prompt = `You analyze sales/coaching call transcripts to extract actionable insights for lead magnet creation.

Extract the following from this transcript:
1. Pain Points - Direct quotes with frequency classification:
   - "mentioned-once": appears once
   - "recurring": mentioned 2-3 times or in different ways
   - "dominant": major theme throughout the conversation
2. Frequent Questions - What do prospects ask? Include context about when/why
3. Transformation Outcomes - Map current state to desired state
4. Objections - What holds them back? What's the underlying concern?
5. Language Patterns - Extract exact phrases and terminology they use (for authentic copy)

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY valid JSON matching this exact structure:
{
  "painPoints": [
    { "quote": "exact quote from transcript", "theme": "category/theme", "frequency": "mentioned-once|recurring|dominant" }
  ],
  "frequentQuestions": [
    { "question": "the question asked", "context": "when/why they asked it" }
  ],
  "transformationOutcomes": [
    { "currentState": "where they are now", "desiredState": "where they want to be" }
  ],
  "objections": [
    { "objection": "what they said", "underlyingConcern": "the real fear/concern behind it" }
  ],
  "languagePatterns": ["exact phrase 1", "exact phrase 2"]
}`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as CallTranscriptInsights;
    }
    return JSON.parse(textContent.text) as CallTranscriptInsights;
  } catch {
    throw new Error('Failed to parse transcript analysis response');
  }
}

/**
 * Analyze competitor/inspiration content to identify what makes it effective
 */
export async function analyzeCompetitorContent(
  content: string,
  userContext?: BusinessContext
): Promise<CompetitorAnalysis> {
  const archetypes = [
    'single-breakdown', 'single-system', 'focused-toolkit', 'single-calculator',
    'focused-directory', 'mini-training', 'one-story', 'prompt', 'assessment', 'workflow'
  ];

  const contextInfo = userContext
    ? `\n\nUser's business context for adaptation suggestions:
- Business: ${userContext.businessDescription}
- Type: ${userContext.businessType}
- Pain Points: ${userContext.urgentPains?.join(', ') || 'Not specified'}
- Results: ${userContext.results?.join(', ') || 'Not specified'}`
    : '';

  const prompt = `You analyze lead magnets and promotional content to identify what makes them effective and how to adapt them.

Available lead magnet archetypes: ${archetypes.join(', ')}

Analyze this content:
"""
${content}
"""
${contextInfo}

Provide:
1. Archetype Detection - Which of the archetypes above does this match? (null if unclear)
2. Format - Describe the format/structure (e.g., "5-page PDF checklist", "7-email sequence")
3. Pain Point Addressed - What urgent problem does it solve?
4. Effectiveness Factors - Why does/would this work? (List 3-5 specific factors)
5. Adaptation Suggestions - How to create a version for the user's business (List 2-4 specific ideas)
6. Original Title - Extract or infer the title of the lead magnet

Return ONLY valid JSON:
{
  "detectedArchetype": "archetype-name" or null,
  "format": "description of format",
  "painPointAddressed": "the main pain point",
  "effectivenessFactors": ["factor 1", "factor 2", "factor 3"],
  "adaptationSuggestions": ["suggestion 1", "suggestion 2"],
  "originalTitle": "title of the lead magnet"
}`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as CompetitorAnalysis;
    }
    return JSON.parse(textContent.text) as CompetitorAnalysis;
  } catch {
    throw new Error('Failed to parse competitor analysis response');
  }
}

// =============================================================================
// PHASE 1: IDEATION
// =============================================================================

const IDEATION_SYSTEM_PROMPT = `You are helping someone create high-converting LinkedIn lead magnets. A lead magnet is a free resource offered in exchange for engagement that demonstrates expertise and builds an email list.

THE VIRAL LEAD MAGNET FRAMEWORK - Every lead magnet must pass these 5 criteria:
1. High Value ($50+) - Would someone pay $50+ for this?
2. Urgent Pain Solved - Is this a RIGHT NOW problem?
3. Actionable in <1h - Can they USE this and get a result within 60 minutes?
4. Simple - Can they understand the core idea in under 2 minutes?
5. Authority-Boosting - Does giving this away make YOU look like the expert?

THE 10 ARCHETYPES:
1. single-breakdown: Reverse-engineer ONE successful example in detail
2. single-system: ONE proven process for ONE specific outcome
3. focused-toolkit: Curated collection for ONE use case (10-20 items)
4. single-calculator: ONE working tool that answers ONE question
5. focused-directory: Curated list for ONE need (5-15 items with context)
6. mini-training: Focused tutorial on ONE specific skill
7. one-story: Your journey or ONE client transformation
8. prompt: ONE AI prompt that accomplishes ONE valuable task
9. assessment: Diagnostic tool that evaluates ONE specific area
10. workflow: ONE working automation they can import and use

TITLE FORMULAS:
- The [Specific Thing] That [Specific Result]
- The [Number]-[Component] [Format] for [Outcome]
- How I [Achieved Result]—[The Deliverable]
- The [Audience] [Format]: [Specific Outcome]
- [Number] [Things] That [Outcome] (+ [Bonus Element])`;

// Ordered list of all archetypes for batch processing
const ALL_ARCHETYPES: LeadMagnetArchetype[] = [
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
];

// Archetype descriptions for batch prompts
const ARCHETYPE_DESCRIPTIONS: Record<LeadMagnetArchetype, string> = {
  'single-breakdown': 'Reverse-engineer ONE successful example in detail',
  'single-system': 'ONE proven process for ONE specific outcome',
  'focused-toolkit': 'Curated collection for ONE use case (10-20 items)',
  'single-calculator': 'ONE working tool that answers ONE question',
  'focused-directory': 'Curated list for ONE need (5-15 items with context)',
  'mini-training': 'Focused tutorial on ONE specific skill',
  'one-story': 'Your journey or ONE client transformation',
  'prompt': 'ONE AI prompt that accomplishes ONE valuable task',
  'assessment': 'Diagnostic tool that evaluates ONE specific area',
  'workflow': 'ONE working automation they can import and use',
};

/**
 * Build the additional context string from transcript insights and competitor analysis
 */
function buildAdditionalContext(sources?: {
  callTranscriptInsights?: CallTranscriptInsights;
  competitorAnalysis?: CompetitorAnalysis;
}): string {
  let additionalContext = '';

  if (sources?.callTranscriptInsights) {
    const insights = sources.callTranscriptInsights;
    additionalContext += `

REAL CUSTOMER INSIGHTS FROM SALES CALLS:
Pain points mentioned:
${insights.painPoints.map((p) => `- "${p.quote}" (${p.frequency}, theme: ${p.theme})`).join('\n')}

Questions asked:
${insights.frequentQuestions.map((q) => `- "${q.question}" - ${q.context}`).join('\n')}

Desired transformations:
${insights.transformationOutcomes.map((t) => `- From: "${t.currentState}" To: "${t.desiredState}"`).join('\n')}

Objections:
${insights.objections.map((o) => `- "${o.objection}" (underlying concern: ${o.underlyingConcern})`).join('\n')}

Their exact language (use in copy):
${insights.languagePatterns.map((p) => `- "${p}"`).join('\n')}

IMPORTANT: Prioritize concepts that directly address these real pain points using their actual language.`;
  }

  if (sources?.competitorAnalysis) {
    const analysis = sources.competitorAnalysis;
    additionalContext += `

INSPIRATION FROM SUCCESSFUL LEAD MAGNET:
- Original Title: "${analysis.originalTitle}"
- Format: ${analysis.format}
- Archetype: ${analysis.detectedArchetype || 'Unknown'}
- Pain Addressed: ${analysis.painPointAddressed}
- Why it works: ${analysis.effectivenessFactors.join(', ')}
- Adaptation ideas: ${analysis.adaptationSuggestions.join(', ')}

IMPORTANT: Include an adapted version of this format as one of your concepts, customized for this business.`;
  }

  return additionalContext;
}

/**
 * Generate a batch of lead magnet concepts for specific archetypes (for parallel processing)
 * This is used by the parallel ideation system to split the work across multiple API calls.
 */
export async function generateConceptBatch(
  archetypes: LeadMagnetArchetype[],
  context: BusinessContext,
  sources?: {
    callTranscriptInsights?: CallTranscriptInsights;
    competitorAnalysis?: CompetitorAnalysis;
  },
  knowledgeBrainContext?: string,
): Promise<LeadMagnetConcept[]> {
  const additionalContext = buildAdditionalContext(sources);

  // Build archetype-specific instructions
  const archetypeInstructions = archetypes
    .map((arch, idx) => `${idx + 1}. ${arch}: ${ARCHETYPE_DESCRIPTIONS[arch]}`)
    .join('\n');

  const prompt = `You are helping someone create high-converting LinkedIn lead magnets.

THE VIRAL LEAD MAGNET FRAMEWORK - Every lead magnet must pass these 5 criteria:
1. High Value ($50+) - Would someone pay $50+ for this?
2. Urgent Pain Solved - Is this a RIGHT NOW problem?
3. Actionable in <1h - Can they USE this and get a result within 60 minutes?
4. Simple - Can they understand the core idea in under 2 minutes?
5. Authority-Boosting - Does giving this away make YOU look like the expert?

ARCHETYPES TO GENERATE (generate exactly ${archetypes.length} concepts):
${archetypeInstructions}

TITLE FORMULAS:
- The [Specific Thing] That [Specific Result]
- The [Number]-[Component] [Format] for [Outcome]
- How I [Achieved Result]—[The Deliverable]
- The [Audience] [Format]: [Specific Outcome]
- [Number] [Things] That [Outcome] (+ [Bonus Element])

BUSINESS CONTEXT:
- Business: ${context.businessDescription}
- Credibility markers: ${context.credibilityMarkers.join(', ')}
- Urgent pains audience faces: ${context.urgentPains.join('; ')}
- Templates you use: ${context.templates.join(', ') || 'None specified'}
- Processes you've refined: ${context.processes.join(', ') || 'None specified'}
- Tools/prompts you rely on: ${context.tools.join(', ') || 'None specified'}
- Questions you answer repeatedly: ${context.frequentQuestions.join('; ') || 'None specified'}
- Results you've achieved: ${context.results.join('; ')}
- Success example to break down: ${context.successExample || 'None specified'}
- Business type: ${context.businessType}
${knowledgeBrainContext ? `
${knowledgeBrainContext}

CRITICAL: The knowledge base above contains REAL insights from this person's actual coaching calls and sales conversations. Every concept you generate MUST be grounded in these real insights. Reference specific pain points, questions, and outcomes from the knowledge base. Do NOT generate generic concepts that ignore this context.` : ''}
${additionalContext}

Generate ${archetypes.length} lead magnet concepts (one for each archetype listed above). Each concept MUST reference at least one specific credibility marker, urgent pain, or result from the business context above. Do NOT generate generic templates — every concept should feel like it could only come from THIS specific person's expertise.

For each, provide:
1. archetype: The archetype key (e.g., "single-breakdown")
2. archetypeName: Human-readable name (e.g., "The Single Breakdown")
3. title: Using a title formula - specific and outcome-focused
4. painSolved: The ONE urgent pain it solves (must reference a specific pain from their business context)
5. whyNowHook: Which urgency technique to use
6. contents: Detailed description of what they'll receive
7. deliveryFormat: Google Doc, Sheet, Loom, etc.
8. viralCheck: Object with boolean for each of the 5 criteria
9. creationTimeEstimate: Based on assets they already have
10. bundlePotential: What other lead magnets could combine with this
11. groundedIn: Brief explanation of which specific credibility marker, result, process, or pain from their business context this concept draws from. This proves the concept is personalized, not generic.

Return ONLY valid JSON with this structure:
{
  "concepts": [...${archetypes.length} concepts in order matching the archetypes above...]
}`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500, // 2 concepts per batch, no linkedinPost = fewer tokens needed
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : JSON.parse(textContent.text);
    return parsed.concepts as LeadMagnetConcept[];
  } catch {
    throw new Error('Failed to parse concept batch response');
  }
}

/**
 * Generate recommendations and bundle based on completed concepts
 */
export async function generateRecommendationsAndBundle(
  concepts: LeadMagnetConcept[],
  context: BusinessContext
): Promise<{
  recommendations: IdeationResult['recommendations'];
  suggestedBundle: IdeationResult['suggestedBundle'];
}> {
  const conceptSummaries = concepts
    .map((c, i) => `${i}. ${c.archetypeName}: "${c.title}" - ${c.painSolved}`)
    .join('\n');

  const prompt = `You're analyzing 10 lead magnet concepts to provide recommendations.

BUSINESS CONTEXT:
- Business: ${context.businessDescription}
- Business type: ${context.businessType}
- Main pains: ${context.urgentPains.join('; ')}

THE 10 CONCEPTS (index 0-9):
${conceptSummaries}

Analyze these concepts and provide:
1. recommendations - Pick the best concepts for each category:
   - shipThisWeek: Which concept (0-9) is fastest to create with what they already have? Why?
   - highestEngagement: Which concept (0-9) will get the most LinkedIn engagement? Why?
   - bestAuthorityBuilder: Which concept (0-9) best positions them as an expert? Why?

2. suggestedBundle - A bundle of 2-3 concepts that work well together:
   - name: A compelling bundle name
   - components: Array of concept indices that combine well
   - combinedValue: What extra value does the bundle provide?
   - releaseStrategy: How should they roll out the bundle?

Return ONLY valid JSON:
{
  "recommendations": {
    "shipThisWeek": { "conceptIndex": 0, "reason": "..." },
    "highestEngagement": { "conceptIndex": 0, "reason": "..." },
    "bestAuthorityBuilder": { "conceptIndex": 0, "reason": "..." }
  },
  "suggestedBundle": {
    "name": "...",
    "components": ["0", "1", "2"],
    "combinedValue": "...",
    "releaseStrategy": "..."
  }
}`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    return jsonMatch
      ? JSON.parse(jsonMatch[0])
      : JSON.parse(textContent.text);
  } catch {
    throw new Error('Failed to parse recommendations response');
  }
}

/**
 * Generate lead magnet ideas using parallel batch processing
 * Splits 10 archetypes into 3 parallel batches for ~3x faster generation
 */
export async function generateLeadMagnetIdeasParallel(
  context: BusinessContext,
  sources?: {
    callTranscriptInsights?: CallTranscriptInsights;
    competitorAnalysis?: CompetitorAnalysis;
  },
  userId?: string
): Promise<IdeationResult> {
  // Inject AI Brain knowledge if userId provided
  let knowledgeBrainContext = '';
  if (userId) {
    const searchQuery = `${context.businessDescription} ${context.urgentPains.join(' ')}`;
    knowledgeBrainContext = await getKnowledgeContext(userId, searchQuery);
  }

  // Split archetypes into 5 batches of 2 for maximum parallelism
  const batches = [
    ALL_ARCHETYPES.slice(0, 2),   // single-breakdown, single-system
    ALL_ARCHETYPES.slice(2, 4),   // focused-toolkit, single-calculator
    ALL_ARCHETYPES.slice(4, 6),   // focused-directory, mini-training
    ALL_ARCHETYPES.slice(6, 8),   // one-story, prompt
    ALL_ARCHETYPES.slice(8, 10),  // assessment, workflow
  ];

  // Generate all concept batches in parallel (5x2 instead of 3x3/4/3)
  const batchResults = await Promise.all(
    batches.map((archetypes) => generateConceptBatch(archetypes, context, sources, knowledgeBrainContext))
  );

  // Merge all concepts in order
  const allConcepts = batchResults.flat();

  // Generate recommendations based on all concepts
  const { recommendations, suggestedBundle } = await generateRecommendationsAndBundle(
    allConcepts,
    context
  );

  return {
    concepts: allConcepts,
    recommendations,
    suggestedBundle,
  };
}

export async function generateLeadMagnetIdeas(
  context: BusinessContext,
  sources?: {
    callTranscriptInsights?: CallTranscriptInsights;
    competitorAnalysis?: CompetitorAnalysis;
  },
  userId?: string
): Promise<IdeationResult> {
  // Build additional context from sources
  let additionalContext = '';

  // Inject AI Brain knowledge if userId provided
  if (userId) {
    const searchQuery = `${context.businessDescription} ${context.urgentPains.join(' ')}`;
    const knowledgeContext = await getKnowledgeContext(userId, searchQuery);
    additionalContext += knowledgeContext;
  }

  if (sources?.callTranscriptInsights) {
    const insights = sources.callTranscriptInsights;
    additionalContext += `

REAL CUSTOMER INSIGHTS FROM SALES CALLS:
Pain points mentioned:
${insights.painPoints.map((p) => `- "${p.quote}" (${p.frequency}, theme: ${p.theme})`).join('\n')}

Questions asked:
${insights.frequentQuestions.map((q) => `- "${q.question}" - ${q.context}`).join('\n')}

Desired transformations:
${insights.transformationOutcomes.map((t) => `- From: "${t.currentState}" To: "${t.desiredState}"`).join('\n')}

Objections:
${insights.objections.map((o) => `- "${o.objection}" (underlying concern: ${o.underlyingConcern})`).join('\n')}

Their exact language (use in copy):
${insights.languagePatterns.map((p) => `- "${p}"`).join('\n')}

IMPORTANT: Prioritize concepts that directly address these real pain points using their actual language.`;
  }

  if (sources?.competitorAnalysis) {
    const analysis = sources.competitorAnalysis;
    additionalContext += `

INSPIRATION FROM SUCCESSFUL LEAD MAGNET:
- Original Title: "${analysis.originalTitle}"
- Format: ${analysis.format}
- Archetype: ${analysis.detectedArchetype || 'Unknown'}
- Pain Addressed: ${analysis.painPointAddressed}
- Why it works: ${analysis.effectivenessFactors.join(', ')}
- Adaptation ideas: ${analysis.adaptationSuggestions.join(', ')}

IMPORTANT: Include an adapted version of this format as one of your concepts, customized for this business.`;
  }

  const prompt = `${IDEATION_SYSTEM_PROMPT}

BUSINESS CONTEXT:
- Business: ${context.businessDescription}
- Credibility markers: ${context.credibilityMarkers.join(', ')}
- Urgent pains audience faces: ${context.urgentPains.join('; ')}
- Templates you use: ${context.templates.join(', ') || 'None specified'}
- Processes you've refined: ${context.processes.join(', ') || 'None specified'}
- Tools/prompts you rely on: ${context.tools.join(', ') || 'None specified'}
- Questions you answer repeatedly: ${context.frequentQuestions.join('; ') || 'None specified'}
- Results you've achieved: ${context.results.join('; ')}
- Success example to break down: ${context.successExample || 'None specified'}
- Business type: ${context.businessType}
${additionalContext}

Generate 10 lead magnet concepts (one for each archetype). For each, provide:
1. archetype: The archetype key (e.g., "single-breakdown")
2. archetypeName: Human-readable name (e.g., "The Single Breakdown")
3. title: Using a title formula - specific and outcome-focused
4. painSolved: The ONE urgent pain it solves
5. whyNowHook: Which urgency technique to use
6. linkedinPost: Complete post using hook through CTA, ready to copy-paste
7. contents: Detailed description of what they'll receive
8. deliveryFormat: Google Doc, Sheet, Loom, etc.
9. viralCheck: Object with boolean for each of the 5 criteria
10. creationTimeEstimate: Based on assets they already have
11. bundlePotential: What other lead magnets could combine with this

After all 10 concepts, provide:
- recommendations with shipThisWeek, highestEngagement, bestAuthorityBuilder (each with conceptIndex 0-9 and reason)
- suggestedBundle with name, components array, combinedValue, releaseStrategy

Return ONLY valid JSON with this structure:
{
  "concepts": [...10 concepts...],
  "recommendations": {...},
  "suggestedBundle": {...}
}`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as IdeationResult;
    }
    return JSON.parse(textContent.text) as IdeationResult;
  } catch {
    throw new Error('Failed to parse ideation response');
  }
}

// =============================================================================
// PHASE 2: CONTENT EXTRACTION - Get questions by archetype
// =============================================================================

const ARCHETYPE_QUESTIONS: Record<LeadMagnetArchetype, ContentExtractionQuestion[]> = {
  'single-breakdown': [
    { id: 'example', question: "What's the ONE example you're breaking down? Describe it—is it your own work or someone else's? What made it successful? What are the specific results it achieved?", required: true },
    { id: 'walkthrough', question: "Walk me through the example piece by piece. If it's an email, read me each line. If it's a landing page, describe each section. I need the raw material.", required: true },
    { id: 'psychology', question: "Now tell me WHY each element works. What's the psychology? What's the strategy? What would most people miss if they just looked at this surface-level?", required: true },
    { id: 'insight', question: "What's the non-obvious insight here? The thing that makes this work that isn't immediately apparent?", required: true },
    { id: 'adaptation', question: "How can someone adapt this to their situation? What are the principles to extract vs. details to change? Common mistakes when copying?", required: true },
  ],
  'single-system': [
    { id: 'outcome', question: "What's the specific outcome this system produces? Not vague—what measurable result does someone get?", required: true },
    { id: 'steps', question: "Walk me through the system step by step. What's step 1? What do they actually DO? Then step 2? Keep going until complete.", required: true },
    { id: 'pitfalls', question: "For each step, what are the key decision points or things that can go wrong? Where do people usually mess up?", required: true },
    { id: 'templates', question: "What templates, scripts, or tools are part of this system? Describe each one—what does it look like, what sections does it have?", required: true },
    { id: 'results', question: "What results have you or your clients gotten from this system? Give me specific numbers, timeframes, before/after comparisons.", required: true },
    { id: 'differentiation', question: "What makes YOUR system different from generic advice on this topic? What's distinctly yours?", required: true },
  ],
  'focused-toolkit': [
    { id: 'useCase', question: "What's the specific use case this toolkit serves? When would someone reach for this? What problem are they facing?", required: true },
    { id: 'items', question: "List out every item that should be in this toolkit. Don't filter yet—give me everything useful for this use case.", required: true },
    { id: 'content', question: "For each item, give me the actual content. If it's a template, what does it say? If it's a script, what are the words?", required: true },
    { id: 'context', question: "For each item, when should someone use it? What situation calls for this specific one vs. the others?", required: true },
    { id: 'testing', question: "Which items have you actually tested? What results did they get? Add any data or proof you have.", required: true },
    { id: 'exclusions', question: "Are there items that seem like they should be included but don't work? What should people AVOID?", required: false },
  ],
  'single-calculator': [
    { id: 'question', question: "What question does this calculator answer? What decision will someone be able to make after using it?", required: true },
    { id: 'inputs', question: "What inputs does the user need to provide? List every number, data point, or selection they'll enter.", required: true },
    { id: 'logic', question: "What's the calculation or logic? Walk me through how the inputs become the output.", required: true },
    { id: 'output', question: "What does the output look like? Is it a single number, a score, a recommendation?", required: true },
    { id: 'interpretation', question: "How should they interpret the output? What's good vs. bad? What are the benchmarks?", required: true },
    { id: 'limitations', question: "What are the limitations or caveats? When does this calculator NOT apply?", required: false },
  ],
  'focused-directory': [
    { id: 'need', question: "What specific need does this directory serve? What problem does having this list solve?", required: true },
    { id: 'items', question: "List every item that should be in this directory. Give me names, links, or identifiers for each.", required: true },
    { id: 'dataPoints', question: "For each item, what information should be included? Pricing, features, pros/cons, use cases?", required: true },
    { id: 'experience', question: "Now fill in that information for each item. Give me YOUR take—not generic descriptions.", required: true },
    { id: 'choosing', question: "How should someone choose between these options? What are the decision criteria?", required: true },
    { id: 'excluded', question: "Are there popular options you intentionally EXCLUDED? Why?", required: false },
  ],
  'mini-training': [
    { id: 'skill', question: "What specific skill will someone learn? What will they be able to do after completing this?", required: true },
    { id: 'chunks', question: "Break this skill into teachable chunks. What are the 3-5 components someone needs to learn?", required: true },
    { id: 'teaching', question: "For each component, walk me through how you'd teach it. What's the explanation? What examples?", required: true },
    { id: 'practice', question: "What's the hands-on element? What will they practice or create during the training?", required: true },
    { id: 'mistakes', question: "What are the common mistakes or misconceptions? What do beginners get wrong?", required: true },
    { id: 'beforeAfter', question: "Do you have a before/after example? Someone who learned this skill and what changed?", required: false },
  ],
  'one-story': [
    { id: 'summary', question: "What's the story you're telling? Is it your own journey, a client transformation, or a specific project? One-sentence summary.", required: true },
    { id: 'before', question: "Set the scene: What was the BEFORE state? The problem, struggle, or situation? Give specific details—numbers, emotions, context.", required: true },
    { id: 'journey', question: "What happened? Walk me through the key moments, decisions, and actions. What did you/they actually DO?", required: true },
    { id: 'turningPoint', question: "What was the turning point? The key insight, change, or decision that made the difference?", required: true },
    { id: 'after', question: "What was the AFTER state? What results were achieved? Give specific numbers, outcomes, and changes.", required: true },
    { id: 'lessons', question: "What are the transferable lessons? What principles can someone extract and apply to their own situation?", required: true },
  ],
  'prompt': [
    { id: 'task', question: "What does this prompt accomplish? What task does it perform? What output does it produce?", required: true },
    { id: 'prompt', question: "Give me the exact prompt, word for word. The actual text someone would copy and paste.", required: true },
    { id: 'inputs', question: "What inputs does the user need to provide? What information do they paste in or customize?", required: true },
    { id: 'examples', question: "Show me 2-3 examples of this prompt in action. Give me sample inputs and the outputs they produced.", required: true },
    { id: 'technique', question: "What makes this prompt work? What's the technique or structure that makes it effective?", required: true },
    { id: 'tips', question: "What are the tips for getting better results? Which AI model works best? Any settings to adjust?", required: false },
  ],
  'assessment': [
    { id: 'evaluates', question: "What does this assessment evaluate? What area or capability is being scored?", required: true },
    { id: 'questions', question: "List out every question or criterion that should be included. What are you measuring? Give me 10-20 items.", required: true },
    { id: 'scoring', question: "For each item, what's the scoring scale? How does someone rate themselves?", required: true },
    { id: 'ranges', question: "What do the total scores mean? Define the ranges—what's a good score, what's concerning?", required: true },
    { id: 'actions', question: "For each score range, what should someone do next? What's the recommended action?", required: true },
    { id: 'benchmarks', question: "What benchmarks or context can you provide? How do most people score?", required: false },
  ],
  'workflow': [
    { id: 'purpose', question: "What does this automation do? Describe the trigger and the outcome.", required: true },
    { id: 'steps', question: "Walk me through each step of the automation. What's the sequence? What tools are connected?", required: true },
    { id: 'setup', question: "What does the setup process look like? What accounts or tools does someone need?", required: true },
    { id: 'customization', question: "What customization options exist? What should someone change to fit their situation?", required: true },
    { id: 'timeSaved', question: "How much time does this save? What's the manual alternative? Quantify the value.", required: true },
    { id: 'troubleshooting', question: "What can go wrong? What are the common setup mistakes or failure points?", required: false },
  ],
};

export function getExtractionQuestions(archetype: LeadMagnetArchetype): ContentExtractionQuestion[] {
  return ARCHETYPE_QUESTIONS[archetype] || [];
}

/**
 * Generate context-aware extraction questions that reference the user's
 * actual business, the selected concept, and their credibility markers.
 * Falls back to static questions on error.
 */
export async function getContextAwareExtractionQuestions(
  archetype: LeadMagnetArchetype,
  concept: LeadMagnetConcept,
  context: BusinessContext,
): Promise<ContentExtractionQuestion[]> {
  const staticQuestions = ARCHETYPE_QUESTIONS[archetype] || [];
  if (!staticQuestions.length) return [];

  try {
    // Detect gaps in business context from Step 1
    const gaps: string[] = [];
    if (!context.results?.length) gaps.push('- Missing: specific results/outcomes they deliver');
    if (!context.credibilityMarkers?.length) gaps.push('- Missing: credibility markers (numbers, years, client count)');
    if (!context.successExample) gaps.push('- Missing: success story or case study');
    if (!context.templates?.length && !context.processes?.length) gaps.push('- Missing: frameworks, templates, or processes they use');
    if (!context.urgentPains?.length) gaps.push('- Missing: specific pain points their audience faces');

    const gapSection = gaps.length > 0 ? `

GAPS IN THEIR CONTEXT (weave these naturally into the questions above — don't add extra questions):
${gaps.join('\n')}

When rewriting questions, if a gap is relevant to a question's topic, subtly ask for that information too. For example:
- If "results" is missing and a question asks about outcomes, add "Include any specific numbers or client results you can share."
- If "successExample" is missing and a question asks about experience, add "If you have a specific client story, walk me through it."
- If "credibilityMarkers" is missing and a question asks about proof, add "Any specific numbers — revenue, clients served, years — that back this up?"
` : '';

    const prompt = `You customize content extraction questions to be specific to someone's actual business and the lead magnet they chose.

THE SELECTED LEAD MAGNET:
- Title: "${concept.title}"
- Archetype: ${concept.archetypeName}
- Pain Solved: ${concept.painSolved}

THEIR BUSINESS:
- Business: ${context.businessDescription}
- Credibility: ${context.credibilityMarkers?.join(', ') || 'Not specified'}
- Results they achieve: ${context.results?.join('; ') || 'Not specified'}
- Processes they use: ${context.processes?.join(', ') || 'Not specified'}
- Tools: ${context.tools?.join(', ') || 'Not specified'}
- Success example: ${context.successExample || 'Not specified'}

ORIGINAL GENERIC QUESTIONS:
${staticQuestions.map((q, i) => `${i + 1}. [id: ${q.id}] ${q.question}`).join('\n')}
${gapSection}
Rewrite each question to reference THEIR specific business, results, and the concept they chose. Keep the same question IDs and required status. Make questions feel like they're asking about what the user already knows from their own experience — not asking them to invent something new.

For example, instead of "What results have you gotten?" write "You mentioned achieving [their specific result]. Walk me through exactly how that happened step by step."

Instead of "Walk me through the system step by step" write "Your concept '${concept.title}' tackles [pain]. Based on your experience with [their process/tool], walk me through how you actually solve this for clients."

Return ONLY valid JSON:
{
  "questions": [
    { "id": "original_id", "question": "customized question text", "required": true }
  ]
}`;

    const response = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return staticQuestions;
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const customized = parsed.questions as ContentExtractionQuestion[];
      // Validate that all IDs match and we got the right count
      if (customized.length === staticQuestions.length) {
        return customized;
      }
    }
    return staticQuestions;
  } catch {
    // Fall back to static questions on any error
    return staticQuestions;
  }
}

// =============================================================================
// PHASE 2: CONTENT CREATION - Process answers and generate structure
// =============================================================================

export async function processContentExtraction(
  archetype: LeadMagnetArchetype,
  concept: LeadMagnetConcept,
  answers: Record<string, string>,
  transcriptInsights?: CallTranscriptInsights,
  userId?: string
): Promise<ExtractedContent> {
  if (!archetype || !concept || !answers) {
    throw new Error(`Missing required parameters: archetype=${!!archetype}, concept=${!!concept}, answers=${!!answers}`);
  }

  const questions = ARCHETYPE_QUESTIONS[archetype];
  if (!questions || questions.length === 0) {
    throw new Error(`No questions found for archetype: ${archetype}`);
  }

  const qaPairs = questions
    .map((q) => `Q: ${q.question}\nA: ${answers[q.id] || 'Not provided'}`)
    .join('\n\n');

  // Build transcript context if available
  let transcriptContext = '';
  if (transcriptInsights) {
    const parts: string[] = [];

    if (transcriptInsights.painPoints?.length) {
      parts.push(`PAIN POINTS (from real coaching calls):
${transcriptInsights.painPoints.map((p) => `- "${p.quote}" (${p.frequency}, theme: ${p.theme})`).join('\n')}`);
    }

    if (transcriptInsights.frequentQuestions?.length) {
      parts.push(`QUESTIONS PROSPECTS ASK:
${transcriptInsights.frequentQuestions.map((q) => `- "${q.question}" — ${q.context}`).join('\n')}`);
    }

    if (transcriptInsights.transformationOutcomes?.length) {
      parts.push(`DESIRED TRANSFORMATIONS:
${transcriptInsights.transformationOutcomes.map((t) => `- From: "${t.currentState}" → To: "${t.desiredState}"`).join('\n')}`);
    }

    if (transcriptInsights.objections?.length) {
      parts.push(`OBJECTIONS & CONCERNS:
${transcriptInsights.objections.map((o) => `- "${o.objection}" (underlying concern: ${o.underlyingConcern})`).join('\n')}`);
    }

    if (transcriptInsights.languagePatterns?.length) {
      parts.push(`LANGUAGE PATTERNS (use these exact phrases):
${transcriptInsights.languagePatterns.map((p) => `- "${p}"`).join('\n')}`);
    }

    if (parts.length > 0) {
      transcriptContext = `

REAL CUSTOMER INSIGHTS FROM COACHING CALLS:
Use these insights to make the content resonate with real pain points and use authentic customer language.

${parts.join('\n\n')}

IMPORTANT: Incorporate these real insights throughout the content. Use the exact language patterns where appropriate. Address the specific pain points and objections. Show transformations that match what prospects actually want.`;
    }
  }

  // Inject AI Brain knowledge if userId provided
  let knowledgeBrainContext = '';
  if (userId) {
    const searchQuery = `${concept.title} ${concept.painSolved}`;
    knowledgeBrainContext = await getKnowledgeContext(userId, searchQuery);
  }

  const prompt = `You are a lead magnet strategist. Based on the following Q&A extraction, structure the content for this lead magnet.

LEAD MAGNET CONCEPT:
Title: ${concept.title}
Archetype: ${concept.archetypeName}
Pain Solved: ${concept.painSolved}
Format: ${concept.deliveryFormat}

EXTRACTED CONTENT:
${qaPairs}${transcriptContext}${knowledgeBrainContext}

Now structure this into a deliverable. Provide:
1. title: Final polished title
2. format: Delivery format (Google Doc, Sheet, etc.)
3. structure: Array of sections, each with:
   - sectionName: Clear section heading
   - introduction: 2-3 sentences explaining what this section covers and why it matters
   - contents: Array of content items, where EACH item is a fully-fledged explanation (3-5 sentences minimum), NOT a one-line checklist item. Include:
     * The what: What is this concept/step/element?
     * The why: Why does this matter? What's the reasoning?
     * The how: How do you actually implement or apply this?
     * An example or context where relevant
   - keyTakeaway: The main insight from this section in 1-2 sentences
4. nonObviousInsight: The "aha" moment that makes this valuable
5. personalExperience: Where the creator's unique experience shows
6. proof: Specific numbers, results, or evidence included
7. commonMistakes: Array of mistakes this helps avoid (with explanation of WHY each is a mistake)
8. differentiation: What makes this different from generic advice

IMPORTANT: This is NOT a checklist. Each piece of content should teach, explain, and provide context. Write as if you're explaining to someone who needs to understand the reasoning, not just see a list of items. Substance over brevity.

Also evaluate against the 5 viral criteria and note any weaknesses.

Return ONLY valid JSON.`;

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Detect truncated response (hit max_tokens)
    if (response.stop_reason === 'max_tokens') {
      logError('ai/lead-magnet', new Error('Extraction response truncated'), { archetype, stopReason: 'max_tokens' });
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ExtractedContent;
    }
    return JSON.parse(textContent.text) as ExtractedContent;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Content extraction failed: ${error.message}`);
    }
    throw new Error('Content extraction failed with unknown error');
  }
}

// =============================================================================
// PHASE 3: POST WRITING
// =============================================================================

const POST_WRITER_SYSTEM = `You are a LinkedIn post writer specializing in lead magnet promotion. Write scroll-stopping posts that drive comments.

CRITICAL - AVOID AI CLICHÉS:
BANNED: "Here's the thing...", "Let me be honest...", "In today's fast-paced world...", "What if I told you...?", "The truth is...", "Stop scrolling...", "Game-changer", "Deep dive", "Leverage", "Actionable insights", "Take it to the next level"

BANNED PATTERNS:
- "My clients don't X. They Y"
- "Most people think X. But the reality is Y"
- "Does this sound familiar?"
- Excessive exclamation points
- Emoji overload

POST STRUCTURE:
1. Hook (1-2 lines) - Pattern interrupt, specific result, or contrarian statement
2. Credibility anchor (1-3 lines) - Why you specifically
3. Problem agitation (2-4 lines) - The painful status quo
4. Solution introduction (1-2 lines) - What you built
5. Contents list (5-8 bullets) - Specific, tangible components with quantities
6. Transformation promise (1-2 lines) - The outcome
7. CTA (2-3 lines) - Comment word + connection reminder

HOOK TYPES:
- Specific Result: "This cold email got a 42% reply rate."
- Price Anchoring: "I charge $5,000 to implement this. Today it's free."
- Contrarian: "Your agency doesn't need more clients."
- Time Saved: "I haven't written a proposal from scratch in 8 months."
- Confession: "I spent 18 months doing this wrong."`;

export async function generatePostVariations(
  input: PostWriterInput,
  userId?: string
): Promise<PostWriterResult> {
  // Inject AI Brain context if userId provided
  let knowledgeSection = '';
  if (userId) {
    try {
      const brief = await buildContentBrief(userId, `${input.leadMagnetTitle} ${input.problemSolved}`);
      if (brief.compiledContext) {
        knowledgeSection = `\n\nKNOWLEDGE BASE CONTEXT (from your actual calls):\nUse real outcomes, quotes, and examples to make the post more authentic.\n${brief.compiledContext}\n`;
      }
    } catch {
      // Non-critical — proceed without knowledge context
    }
  }

  const prompt = `${POST_WRITER_SYSTEM}${knowledgeSection}

LEAD MAGNET DETAILS:
- Title: ${input.leadMagnetTitle}
- Format: ${input.format}
- Contents: ${input.contents}
- Problem Solved: ${input.problemSolved}
- Credibility: ${input.credibility}
- Audience: ${input.audience}
- Audience Style: ${input.audienceStyle}
- Proof: ${input.proof}
- CTA Word: ${input.ctaWord}
- Urgency Angle: ${input.urgencyAngle || 'Not specified'}

Generate 3 distinct post variations using different hooks/angles.

For each variation provide:
1. hookType: The type of hook used (e.g., "Specific Result", "Price Anchoring")
2. post: The complete LinkedIn post ready to copy-paste
3. whyThisAngle: 1-2 sentences on why this hook could work
4. evaluation: Object with hookStrength, credibilityClear, problemResonance, contentsSpecific, toneMatch, aiClicheFree

After all 3, provide:
- recommendation: Which to use and why, or how to combine elements
- dmTemplate: Short personalized DM (use {first_name} and [LINK])
- ctaWord: The comment trigger word

Return ONLY valid JSON:
{
  "variations": [...3 variations...],
  "recommendation": "...",
  "dmTemplate": "...",
  "ctaWord": "${input.ctaWord}"
}`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as PostWriterResult;
    }
    return JSON.parse(textContent.text) as PostWriterResult;
  } catch {
    throw new Error('Failed to parse post writer response');
  }
}

// =============================================================================
// CONVERSATIONAL CHAT FOR CONTENT EXTRACTION
// =============================================================================

export async function continueContentChat(
  archetype: LeadMagnetArchetype,
  concept: LeadMagnetConcept,
  messages: ChatMessage[]
): Promise<string> {
  const systemPrompt = `You are a lead magnet strategist helping extract content for: "${concept.title}"
Archetype: ${concept.archetypeName}

Your job is to:
1. Ask follow-up questions to extract specific, valuable content
2. Push for specifics - never accept vague answers
3. Look for the "gold" - unique insights, real examples, actual numbers
4. Challenge generic content - "This feels generic. What's the thing only YOU know?"
5. Demand real examples - templates should have actual words, not descriptions

Be conversational but structured. When you have enough content for a section, acknowledge it and move to the next area.

Current extraction questions for this archetype are about:
${ARCHETYPE_QUESTIONS[archetype].map((q) => `- ${q.question.substring(0, 100)}...`).join('\n')}

Keep responses concise but thorough. Ask one focused question at a time.`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return textContent.text;
}

// =============================================================================
// SMART CONTEXT IMPORT - Extract BusinessContext from unstructured content
// =============================================================================

import type {
  ExtractionResult,
  ContentType,
  PolishedContent,
} from '@/lib/types/lead-magnet';

const CONTEXT_EXTRACTION_PROMPT = `You are an expert at extracting business context from unstructured content.
Your job is to identify key information that would help generate lead magnet ideas.

CONTENT TO ANALYZE:
"""
{content}
"""

Extract the following fields. For each field:
- Extract only what is explicitly stated or strongly implied
- Do NOT make up information that isn't there
- Provide a confidence level: "high" (explicitly stated), "medium" (strongly implied), "low" (inferred)

FIELDS TO EXTRACT:

1. businessDescription: A 1-2 sentence summary of what they do and who they serve
2. businessType: One of: coach-consultant, agency-owner, course-creator, freelancer, saas-tech, b2b-service
3. credibilityMarkers: Array of specific results with numbers (e.g., "$2.3M revenue", "500+ clients")
4. urgentPains: Array of problems/pain points their audience faces
5. results: Array of outcomes/transformations they deliver
6. templates: Array of any templates, frameworks, or systems mentioned
7. processes: Array of any processes or methodologies mentioned
8. tools: Array of tools, software, or resources mentioned
9. frequentQuestions: Array of questions their audience commonly asks
10. successExample: Any case study, example, or success story mentioned

Respond in this exact JSON format:
{
  "extracted": {
    "businessDescription": "...",
    "businessType": "...",
    "credibilityMarkers": [...],
    "urgentPains": [...],
    "results": [...],
    "templates": [...],
    "processes": [...],
    "tools": [...],
    "frequentQuestions": [...],
    "successExample": "..."
  },
  "confidence": {
    "businessDescription": "high|medium|low",
    "businessType": "high|medium|low",
    "credibilityMarkers": "high|medium|low",
    "urgentPains": "high|medium|low",
    "results": "high|medium|low",
    "templates": "high|medium|low",
    "processes": "high|medium|low",
    "tools": "high|medium|low",
    "frequentQuestions": "high|medium|low",
    "successExample": "high|medium|low"
  },
  "suggestions": [
    { "field": "credibilityMarkers", "suggestion": "Add specific revenue or client numbers to boost authority", "value": "$X revenue generated for clients" },
    { "field": "urgentPains", "suggestion": "Make the pain points more specific and urgent", "value": "Struggling to convert leads into paying clients" }
  ]
}

SUGGESTIONS RULES:
- Each suggestion MUST map to a specific field from the FIELDS TO EXTRACT list above
- "field" must be one of: businessDescription, businessType, credibilityMarkers, urgentPains, results, templates, processes, tools, frequentQuestions, successExample
- "suggestion" is a short explanation of what's missing or could be improved
- "value" is your best guess at what the value should be based on the content — the user can edit it
- Only suggest for fields that are empty, low confidence, or clearly incomplete
- Maximum 4 suggestions — focus on the most impactful gaps`;

export async function extractBusinessContext(
  content: string,
  contentType?: ContentType
): Promise<ExtractionResult> {
  if (!content || content.trim().length < 50) {
    throw new Error('Content is too short for meaningful extraction. Please provide more text.');
  }

  const contextHint = contentType
    ? `\n\nThis content appears to be from a ${contentType.replace('-', ' ')}.`
    : '';

  const prompt = CONTEXT_EXTRACTION_PROMPT.replace('{content}', content) + contextHint;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ExtractionResult;
    }
    return JSON.parse(textContent.text) as ExtractionResult;
  } catch {
    throw new Error('Failed to parse context extraction response');
  }
}

// =============================================================================
// CONTENT POLISHING - Transform extracted content into polished blocks
// =============================================================================

export async function polishLeadMagnetContent(
  extractedContent: ExtractedContent,
  concept: LeadMagnetConcept
): Promise<PolishedContent> {
  const prompt = `You are a content designer who transforms raw lead magnet content into beautifully structured, polished content blocks for a clean reading experience.

LEAD MAGNET:
Title: ${concept.title}
Archetype: ${concept.archetypeName}
Pain Solved: ${concept.painSolved}

EXTRACTED CONTENT:
${JSON.stringify(extractedContent, null, 2)}

Transform this into polished content blocks. For each section in the extracted content:

1. Write a concise introduction (1-2 sentences that set up the section)
2. Transform the section contents into a mix of block types:
   - "paragraph": Clear, direct text with **bold** for emphasis. Each paragraph should be 1-3 sentences. Say it once, say it well — no filler or restating.
   - "callout": Key insights, warnings, or tips. Must include "style": "info" | "warning" | "success"
   - "list": Bullet-pointed lists for steps, items, or enumerations. Use "- " prefix for each item, separated by newlines.
   - "quote": Powerful statements, memorable takeaways, or impactful phrases
   - "divider": Visual separator between major ideas (content should be empty string)
   - "code": Code examples, terminal commands, or technical snippets. Include "language" field (e.g., "javascript", "typescript", "bash", "python", "json"). Only use for developer/technical content with actual code.
   - "table": Comparison tables, feature matrices, or structured data. Include "headers" (string array) and "rows" (array of string arrays). Great for before/after comparisons, pricing tiers, feature lists, or step breakdowns.
   - "accordion": Expandable Q&A or supplementary details. Include "title" (the toggle label). Use for FAQ sections, common objections, or nice-to-know details that don't need to be visible by default.
3. End each section with a keyTakeaway (1 sentence, the single most actionable insight)

Also provide:
- heroSummary: A compelling 1-2 sentence hook that makes someone want to read the entire piece
- metadata.wordCount: Estimate total word count
- metadata.readingTimeMinutes: Based on 200 words per minute

CONTENT GUIDELINES:
- Be concise and actionable — every sentence should teach, reveal, or direct. Cut filler, throat-clearing, and redundant transitions.
- Prefer specific, concrete language over vague or generic phrasing
- Break long paragraphs into multiple paragraph blocks
- Use callouts for "Pro tip", "Common mistake", "Key insight" moments
- Use quotes for memorable, shareable statements
- Use lists when there are 3+ items that work as bullets
- Use dividers sparingly between major topic shifts within a section
- Parse **bold** in paragraph content for emphasis on key phrases
- Keep the voice professional but direct — respect the reader's time
- Every section should have at least 3-5 blocks for visual variety
- Use "code" blocks only when showing actual code, terminal commands, API examples, or technical configurations — not for regular text
- Use "table" blocks for structured comparisons with 2+ columns (before/after, feature matrices, pros/cons, tool comparisons)
- Use "accordion" blocks for FAQ sections, common objections, or supplementary details the reader may want to skip
- Do NOT use "image" or "embed" blocks — those are added manually by the user

Return ONLY valid JSON:
{
  "version": 1,
  "polishedAt": "${new Date().toISOString()}",
  "sections": [
    {
      "id": "section-slug",
      "sectionName": "Section Title",
      "introduction": "2-3 sentence intro...",
      "blocks": [
        { "type": "paragraph", "content": "Text with **bold**..." },
        { "type": "callout", "content": "Key insight here", "style": "info" },
        { "type": "list", "content": "- Item one\\n- Item two\\n- Item three" },
        { "type": "quote", "content": "Memorable statement" },
        { "type": "divider", "content": "" },
        { "type": "code", "content": "npm install example-package", "language": "bash" },
        { "type": "table", "content": "", "headers": ["Before", "After"], "rows": [["Manual process", "Automated"]] },
        { "type": "accordion", "content": "Detailed explanation here...", "title": "Why does this matter?" }
      ],
      "keyTakeaway": "Main insight from this section"
    }
  ],
  "heroSummary": "Compelling 1-2 sentence hook...",
  "metadata": {
    "readingTimeMinutes": 5,
    "wordCount": 1000
  }
}`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as PolishedContent;
    }
    return JSON.parse(textContent.text) as PolishedContent;
  } catch {
    throw new Error('Failed to parse polished content response');
  }
}
