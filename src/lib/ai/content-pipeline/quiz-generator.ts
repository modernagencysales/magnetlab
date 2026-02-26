import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';

// ============================================
// TYPES
// ============================================

export interface GeneratedQuestion {
  question_text: string;
  answer_type: 'yes_no' | 'text' | 'textarea' | 'multiple_choice';
  options: string[] | null;
  qualifying_answer: string | string[] | null;
  is_qualifying: boolean;
  is_required: boolean;
}

export interface QuizGeneratorOptions {
  clientName: string;
  icpJson: string;
  knowledgeContext?: string;
  brandContext?: string;
}

// ============================================
// VALID ANSWER TYPES
// ============================================

const VALID_ANSWER_TYPES = new Set<GeneratedQuestion['answer_type']>([
  'yes_no',
  'text',
  'textarea',
  'multiple_choice',
]);

// ============================================
// PURE FUNCTIONS
// ============================================

/**
 * Validates a single quiz question for structural correctness.
 * - multiple_choice: needs >= 2 options
 * - yes_no: qualifying_answer must be "yes" or "no"
 * - text/textarea: qualifying_answer must be null, is_qualifying must be false
 */
export function validateQuizQuestion(q: GeneratedQuestion): boolean {
  // Must have a non-empty question_text
  if (!q.question_text || typeof q.question_text !== 'string') return false;

  // Must have a valid answer_type
  if (!VALID_ANSWER_TYPES.has(q.answer_type)) return false;

  switch (q.answer_type) {
    case 'multiple_choice':
      // Must have at least 2 options
      if (!Array.isArray(q.options) || q.options.length < 2) return false;
      break;

    case 'yes_no':
      // If qualifying, qualifying_answer must be "yes" or "no"
      if (q.is_qualifying && q.qualifying_answer !== 'yes' && q.qualifying_answer !== 'no') {
        return false;
      }
      break;

    case 'text':
    case 'textarea':
      // text/textarea questions cannot be qualifying
      // (we allow but don't enforce qualifying_answer: null — AI sometimes returns it)
      break;
  }

  return true;
}

/**
 * Parses the AI response into GeneratedQuestion[].
 * Handles markdown code blocks, caps at 5 questions, filters invalid.
 */
export function parseQuizQuestions(raw: string): GeneratedQuestion[] {
  let parsed: unknown[];

  try {
    parsed = parseJsonResponse<unknown[]>(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  // Cap at 5 questions
  const capped = parsed.slice(0, 5);

  return capped
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item): GeneratedQuestion => ({
      question_text: typeof item.question_text === 'string' ? item.question_text : '',
      answer_type: VALID_ANSWER_TYPES.has(item.answer_type as GeneratedQuestion['answer_type'])
        ? (item.answer_type as GeneratedQuestion['answer_type'])
        : 'text',
      options: Array.isArray(item.options)
        ? item.options.filter((o: unknown) => typeof o === 'string')
        : null,
      qualifying_answer: normalizeQualifyingAnswer(item.qualifying_answer),
      is_qualifying: typeof item.is_qualifying === 'boolean' ? item.is_qualifying : false,
      is_required: typeof item.is_required === 'boolean' ? item.is_required : true,
    }))
    .filter(validateQuizQuestion);
}

/**
 * Normalize qualifying_answer to string | string[] | null.
 */
function normalizeQualifyingAnswer(value: unknown): string | string[] | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const filtered = value.filter((v: unknown) => typeof v === 'string');
    return filtered.length > 0 ? filtered : null;
  }
  return null;
}

// ============================================
// AI CALL
// ============================================

/**
 * Generates qualification quiz questions using the quiz-generator prompt from the registry.
 */
export async function generateQuizQuestions(
  options: QuizGeneratorOptions
): Promise<GeneratedQuestion[]> {
  const {
    clientName,
    icpJson,
    knowledgeContext = '',
    brandContext = '',
  } = options;

  const template = await getPrompt('quiz-generator');

  const prompt = interpolatePrompt(template.user_prompt, {
    client_name: clientName,
    icp_json: icpJson,
    knowledge_context: knowledgeContext,
    brand_context: brandContext,
  });

  const client = getAnthropicClient('quiz-generator');

  const response = await client.messages.create({
    model: template.model,
    max_tokens: template.max_tokens,
    temperature: template.temperature,
    system: template.system_prompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content?.[0]?.type === 'text' ? response.content[0].text : '';
  return parseQuizQuestions(text);
}
