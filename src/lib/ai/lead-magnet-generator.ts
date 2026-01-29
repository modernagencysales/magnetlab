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

// Lazy initialization to ensure env vars are loaded
function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
  }
  return new Anthropic({ apiKey });
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
    model: 'claude-sonnet-4-5-20241022',
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
    model: 'claude-sonnet-4-5-20241022',
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

export async function generateLeadMagnetIdeas(
  context: BusinessContext,
  sources?: {
    callTranscriptInsights?: CallTranscriptInsights;
    competitorAnalysis?: CompetitorAnalysis;
  }
): Promise<IdeationResult> {
  // Build additional context from sources
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
8. deliveryFormat: Google Doc, Sheet, Notion, Loom, etc.
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
    model: 'claude-sonnet-4-5-20241022',
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

// =============================================================================
// PHASE 2: CONTENT CREATION - Process answers and generate structure
// =============================================================================

export async function processContentExtraction(
  archetype: LeadMagnetArchetype,
  concept: LeadMagnetConcept,
  answers: Record<string, string>
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

  const prompt = `You are a lead magnet strategist. Based on the following Q&A extraction, structure the content for this lead magnet.

LEAD MAGNET CONCEPT:
Title: ${concept.title}
Archetype: ${concept.archetypeName}
Pain Solved: ${concept.painSolved}
Format: ${concept.deliveryFormat}

EXTRACTED CONTENT:
${qaPairs}

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
      model: 'claude-sonnet-4-5-20241022',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
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
  input: PostWriterInput
): Promise<PostWriterResult> {
  const prompt = `${POST_WRITER_SYSTEM}

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
    model: 'claude-sonnet-4-5-20241022',
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
    model: 'claude-sonnet-4-5-20241022',
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
    "Consider adding specific revenue numbers",
    "The pain points could be more specific"
  ]
}`;

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
    model: 'claude-sonnet-4-5-20241022',
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
  const prompt = `You are a content designer who transforms raw lead magnet content into beautifully structured, polished content blocks for a Notion-like reading experience.

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
        { "type": "divider", "content": "" }
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
