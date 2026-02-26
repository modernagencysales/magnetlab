import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';

// ============================================
// TYPES
// ============================================

export interface ReviewablePost {
  id: string;
  final_content: string | null;
  draft_content?: string | null;
  hook_score?: number | null;
}

export interface ReviewResult {
  post_id: string;
  review_score: number;
  review_category: 'excellent' | 'good_with_edits' | 'needs_rewrite' | 'delete';
  review_notes: string[];
  consistency_flags: string[];
}

export interface ReviewOptions {
  voiceProfile?: string;
  icpSummary?: string;
}

// ============================================
// VALID CATEGORIES
// ============================================

const VALID_CATEGORIES = new Set<ReviewResult['review_category']>([
  'excellent',
  'good_with_edits',
  'needs_rewrite',
  'delete',
]);

// ============================================
// PURE FUNCTIONS
// ============================================

/**
 * Formats posts into a JSON string for the review prompt.
 * Falls back to draft_content when final_content is null.
 */
export function buildReviewPayload(posts: ReviewablePost[]): string {
  const formatted = posts.map((p) => ({
    id: p.id,
    content: p.final_content ?? p.draft_content ?? '',
    hook_score: p.hook_score ?? null,
  }));
  return JSON.stringify(formatted, null, 2);
}

/**
 * Derive a review category from a numeric score.
 */
function categoryFromScore(score: number): ReviewResult['review_category'] {
  if (score >= 8) return 'excellent';
  if (score >= 5) return 'good_with_edits';
  if (score >= 3) return 'needs_rewrite';
  return 'delete';
}

/**
 * Parses the AI response into ReviewResult[].
 * Handles markdown code blocks, clamps scores to 1-10,
 * and validates categories (falls back to score-based category).
 */
export function parseReviewResults(raw: string): ReviewResult[] {
  let parsed: unknown[];

  try {
    parsed = parseJsonResponse<unknown[]>(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item) => {
      // Clamp score to 1-10
      let score = typeof item.review_score === 'number' ? item.review_score : 5;
      score = Math.max(1, Math.min(10, score));

      // Validate category, fall back to score-based
      const rawCategory = item.review_category as string;
      const category: ReviewResult['review_category'] = VALID_CATEGORIES.has(
        rawCategory as ReviewResult['review_category']
      )
        ? (rawCategory as ReviewResult['review_category'])
        : categoryFromScore(score);

      // Ensure notes and flags are string arrays
      const reviewNotes = Array.isArray(item.review_notes)
        ? item.review_notes.filter((n: unknown) => typeof n === 'string')
        : [];

      const consistencyFlags = Array.isArray(item.consistency_flags)
        ? item.consistency_flags.filter((f: unknown) => typeof f === 'string')
        : [];

      return {
        post_id: typeof item.post_id === 'string' ? item.post_id : '',
        review_score: score,
        review_category: category,
        review_notes: reviewNotes,
        consistency_flags: consistencyFlags,
      };
    });
}

// ============================================
// AI CALL
// ============================================

/**
 * Reviews a batch of posts using the content-review prompt from the registry.
 */
export async function reviewPosts(
  posts: ReviewablePost[],
  options: ReviewOptions = {}
): Promise<ReviewResult[]> {
  const { voiceProfile = '', icpSummary = '' } = options;

  const template = await getPrompt('content-review');
  const postsJson = buildReviewPayload(posts);

  const prompt = interpolatePrompt(template.user_prompt, {
    posts_json: postsJson,
    voice_profile: voiceProfile,
    icp_summary: icpSummary,
  });

  const client = getAnthropicClient('content-reviewer');

  const response = await client.messages.create({
    model: template.model,
    max_tokens: template.max_tokens,
    temperature: template.temperature,
    system: template.system_prompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content?.[0]?.type === 'text' ? response.content[0].text : '';
  return parseReviewResults(text);
}
