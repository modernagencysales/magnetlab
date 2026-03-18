/**
 * Intent Classifier — Tier 2 Comment Matching
 * Uses Claude Haiku to determine if a comment expresses interest in receiving a resource.
 * Only runs when Tier 1 (keyword substring match) fails.
 * Cost: ~$0.003/call. At 100 non-keyword comments/day = $0.30/day.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logError } from '@/lib/utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IntentClassificationResult {
  isInterested: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
}

// ─── Classifier ─────────────────────────────────────────────────────────────

/**
 * Classify whether a LinkedIn comment expresses interest in receiving the offered resource.
 * Returns isInterested: true for comments like "Interested!", "Yes please!", emojis, etc.
 * Defaults to isInterested: false on any error (fail-safe).
 */
export async function classifyCommentIntent(
  ctaText: string,
  commentText: string
): Promise<IntentClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { isInterested: false, confidence: 'low', reasoning: 'No API key configured' };
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-20250414',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Given this LinkedIn post CTA: "${ctaText}"

Is this comment expressing interest in receiving the resource?
Comment: "${commentText}"

Respond with exactly one word: YES or NO.`,
        },
      ],
    });

    const text =
      response.content[0]?.type === 'text' ? response.content[0].text.trim().toUpperCase() : '';

    if (text.startsWith('YES')) {
      return { isInterested: true, confidence: 'high' };
    }
    return { isInterested: false, confidence: 'high' };
  } catch (err) {
    logError('intent-classifier/classify', err instanceof Error ? err : new Error(String(err)), {
      ctaText: ctaText.slice(0, 100),
      commentText: commentText.slice(0, 100),
    });
    // Fail-safe: default to not interested on error
    return { isInterested: false, confidence: 'low', reasoning: 'Classification error' };
  }
}
