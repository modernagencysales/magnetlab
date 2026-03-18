/** Tier 2 comment intent classification. Uses Claude Haiku to determine if a comment
 *  expresses interest in a lead magnet when no keyword match is found.
 *  Never imports HTTP or DB directly. */

import { createAnthropicClient } from '@/lib/ai/anthropic-client';

// ─── Constants ──────────────────────────────────────────────────────────

const INTENT_CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 10;

// ─── Types ──────────────────────────────────────────────────────────────

export interface IntentClassificationResult {
  isInterested: boolean;
  confidence: number;
}

// ─── Classification ─────────────────────────────────────────────────────

/**
 * Classify whether a LinkedIn comment expresses interest in a lead magnet resource.
 *
 * Uses the post CTA text as context to understand what "interested" means.
 * Returns { isInterested: false, confidence: 0.2 } on any error — fail-safe.
 */
export async function classifyCommentIntent(
  postCtaText: string,
  commentText: string
): Promise<IntentClassificationResult> {
  if (!commentText || commentText.trim().length === 0) {
    return { isInterested: false, confidence: 0.2 };
  }

  try {
    const client = createAnthropicClient('intent-classifier');

    const response = await client.messages.create({
      model: INTENT_CLASSIFIER_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: `Given this LinkedIn post CTA: "${postCtaText}"\nIs this comment expressing interest in receiving the resource?\nComment: "${commentText}"\nAnswer YES or NO.`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const answer = text.trim().toUpperCase();

    return {
      isInterested: answer.startsWith('YES'),
      confidence: answer.startsWith('YES') ? 0.8 : 0.2,
    };
  } catch {
    return { isInterested: false, confidence: 0.2 };
  }
}
