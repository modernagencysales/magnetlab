import Anthropic from '@anthropic-ai/sdk';
import type {
  LeadMagnetConcept,
  CallTranscriptInsights,
  CalculatorConfig,
  AssessmentConfig,
  GPTConfig,
} from '@/lib/types/lead-magnet';

// Lazy initialization to ensure env vars are loaded
function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
  }
  return new Anthropic({ apiKey, timeout: 240_000 });
}

/**
 * Format transcript insights into a context string for AI prompts.
 * Includes pain points, frequent questions, and transformation outcomes.
 */
function buildTranscriptContext(insights?: CallTranscriptInsights): string {
  if (!insights) return '';

  const parts: string[] = [];

  if (insights.painPoints?.length) {
    parts.push(
      `PAIN POINTS (from real coaching calls):\n${insights.painPoints.map((p) => `- "${p.quote}" (${p.frequency}, theme: ${p.theme})`).join('\n')}`
    );
  }

  if (insights.frequentQuestions?.length) {
    parts.push(
      `QUESTIONS PROSPECTS ASK:\n${insights.frequentQuestions.map((q) => `- "${q.question}" — ${q.context}`).join('\n')}`
    );
  }

  if (insights.transformationOutcomes?.length) {
    parts.push(
      `DESIRED TRANSFORMATIONS:\n${insights.transformationOutcomes.map((t) => `- From: "${t.currentState}" -> To: "${t.desiredState}"`).join('\n')}`
    );
  }

  if (parts.length === 0) return '';

  return `\n\nREAL CUSTOMER INSIGHTS FROM COACHING CALLS:\nUse these insights to make the interactive tool resonate with real pain points.\n\n${parts.join('\n\n')}`;
}

/**
 * Generate a CalculatorConfig from a lead magnet concept and extraction answers.
 * Creates 3-6 inputs, a formula, and interpretation ranges.
 */
export async function generateCalculatorConfig(
  concept: LeadMagnetConcept,
  answers: Record<string, string>,
  transcriptInsights?: CallTranscriptInsights
): Promise<CalculatorConfig> {
  const qaPairs = Object.entries(answers)
    .map(([id, answer]) => `Q [${id}]: ${answer}`)
    .join('\n\n');

  const transcriptContext = buildTranscriptContext(transcriptInsights);

  const prompt = `You are an expert at designing interactive calculators for lead magnets. Based on the concept and extraction answers below, generate a calculator configuration.

LEAD MAGNET CONCEPT:
Title: ${concept.title}
Archetype: ${concept.archetypeName}
Pain Solved: ${concept.painSolved}
Contents: ${concept.contents}

EXTRACTION ANSWERS:
${qaPairs}${transcriptContext}

Generate a calculator config with:
1. A clear headline and description for the calculator
2. 3-6 inputs, each with a unique camelCase ID (e.g., "monthlyRevenue", "teamSize")
   - Types can be "number", "select", or "slider"
   - Number inputs need min, max, step, defaultValue, and optional unit
   - Select inputs need an options array with label and numeric value
   - Slider inputs need min, max, step, and defaultValue
3. A formula string using ONLY input IDs as variables with standard math operators (+, -, *, /, parentheses). Keep the formula evaluable as a JavaScript expression when variable names are replaced with numbers.
4. A resultLabel describing what the output represents
5. A resultFormat: "number", "currency", or "percentage"
6. 3-4 resultInterpretation ranges that cover all possible output values:
   - Each range has [min, max], label, description, and color ("green", "yellow", or "red")
   - Ranges should not overlap and should cover the full spectrum of possible results

Return ONLY valid JSON, no markdown fences:
{
  "type": "calculator",
  "headline": "...",
  "description": "...",
  "inputs": [
    {
      "id": "camelCaseId",
      "label": "Human Label",
      "type": "number",
      "placeholder": "e.g. 5000",
      "min": 0,
      "max": 100000,
      "step": 100,
      "defaultValue": 5000,
      "unit": "$"
    }
  ],
  "formula": "monthlyRevenue * conversionRate / 100",
  "resultLabel": "Estimated Monthly ROI",
  "resultFormat": "currency",
  "resultInterpretation": [
    { "range": [0, 1000], "label": "Low", "description": "...", "color": "red" },
    { "range": [1001, 5000], "label": "Moderate", "description": "...", "color": "yellow" },
    { "range": [5001, 100000], "label": "Strong", "description": "...", "color": "green" }
  ]
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

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as CalculatorConfig;
  }
  return JSON.parse(textContent.text) as CalculatorConfig;
}

/**
 * Generate an AssessmentConfig from a lead magnet concept and extraction answers.
 * Creates 8-12 diagnostic questions with scoring ranges.
 */
export async function generateAssessmentConfig(
  concept: LeadMagnetConcept,
  answers: Record<string, string>,
  transcriptInsights?: CallTranscriptInsights
): Promise<AssessmentConfig> {
  const qaPairs = Object.entries(answers)
    .map(([id, answer]) => `Q [${id}]: ${answer}`)
    .join('\n\n');

  const transcriptContext = buildTranscriptContext(transcriptInsights);

  const prompt = `You are an expert at designing diagnostic assessments for lead magnets. Based on the concept and extraction answers below, generate an assessment configuration.

LEAD MAGNET CONCEPT:
Title: ${concept.title}
Archetype: ${concept.archetypeName}
Pain Solved: ${concept.painSolved}
Contents: ${concept.contents}

EXTRACTION ANSWERS:
${qaPairs}${transcriptContext}

Generate an assessment config with:
1. A clear headline and description for the assessment
2. 8-12 diagnostic questions with sequential IDs (q1, q2, q3, ...)
   - Mix "single_choice" and "scale" types for variety
   - single_choice questions need an options array where each option has a label and a numeric value (score)
   - scale questions need scaleMin (typically 1), scaleMax (typically 5 or 10), and scaleLabels with min/max descriptions
   - Score values should meaningfully differentiate between responses (not all 1-5 in order; some questions might have higher-scoring options that indicate strength, lower ones indicating weakness)
3. A scoring section with:
   - method: "sum" (add all scores together)
   - 3-4 ranges that cover the full possible score spectrum
   - Each range has min, max, label, description, and an array of 2-3 actionable recommendations

Return ONLY valid JSON, no markdown fences:
{
  "type": "assessment",
  "headline": "...",
  "description": "...",
  "questions": [
    {
      "id": "q1",
      "text": "How often do you...?",
      "type": "single_choice",
      "options": [
        { "label": "Never", "value": 1 },
        { "label": "Sometimes", "value": 3 },
        { "label": "Always", "value": 5 }
      ]
    },
    {
      "id": "q2",
      "text": "Rate your confidence in...",
      "type": "scale",
      "scaleMin": 1,
      "scaleMax": 10,
      "scaleLabels": { "min": "Not confident", "max": "Very confident" }
    }
  ],
  "scoring": {
    "method": "sum",
    "ranges": [
      {
        "min": 8,
        "max": 20,
        "label": "Beginner",
        "description": "...",
        "recommendations": ["Recommendation 1", "Recommendation 2"]
      }
    ]
  }
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

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as AssessmentConfig;
  }
  return JSON.parse(textContent.text) as AssessmentConfig;
}

/**
 * Generate a GPTConfig from a lead magnet concept and extraction answers.
 * Creates a system prompt, welcome message, and suggested prompts.
 */
export async function generateGPTConfig(
  concept: LeadMagnetConcept,
  answers: Record<string, string>,
  businessContext?: Record<string, unknown>,
  transcriptInsights?: CallTranscriptInsights
): Promise<GPTConfig> {
  const qaPairs = Object.entries(answers)
    .map(([id, answer]) => `Q [${id}]: ${answer}`)
    .join('\n\n');

  const transcriptContext = buildTranscriptContext(transcriptInsights);

  const businessSection = businessContext
    ? `\n\nBUSINESS CONTEXT:\n${Object.entries(businessContext)
        .map(([key, val]) => `- ${key}: ${typeof val === 'string' ? val : JSON.stringify(val)}`)
        .join('\n')}`
    : '';

  const prompt = `You are an expert at designing AI chat assistants for lead magnets. Based on the concept and extraction answers below, generate a GPT chat configuration.

LEAD MAGNET CONCEPT:
Title: ${concept.title}
Archetype: ${concept.archetypeName}
Pain Solved: ${concept.painSolved}
Contents: ${concept.contents}

EXTRACTION ANSWERS:
${qaPairs}${businessSection}${transcriptContext}

Generate a GPT config with:
1. A name for the assistant (short, descriptive, e.g. "Revenue Growth Advisor")
2. A description explaining what the assistant does and who it helps
3. A detailed systemPrompt that:
   - Grounds the assistant in the creator's specific expertise and methodology
   - Defines the assistant's personality and communication style
   - Sets boundaries on what the assistant should and should not discuss
   - Incorporates key frameworks, processes, or insights from the extraction answers
   - Instructs the assistant to give specific, actionable advice (not generic platitudes)
4. A welcomeMessage that greets the user, briefly explains what the assistant can help with, and invites them to ask their first question
5. 3-4 suggestedPrompts that represent the most valuable questions a user might ask (specific and outcome-oriented, not generic)
6. maxTokens set to 2048

Return ONLY valid JSON, no markdown fences:
{
  "type": "gpt",
  "name": "...",
  "description": "...",
  "systemPrompt": "You are...",
  "welcomeMessage": "...",
  "suggestedPrompts": [
    "How do I...",
    "What's the best way to...",
    "Can you help me..."
  ],
  "maxTokens": 2048
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

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as GPTConfig;
  }
  return JSON.parse(textContent.text) as GPTConfig;
}
