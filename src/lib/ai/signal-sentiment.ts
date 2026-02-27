import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import type { SentimentScore } from '@/lib/types/signals';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 150;

const SYSTEM_PROMPT = `You classify LinkedIn comments into exactly one buying-intent category.

Categories:
- high_intent: Actively evaluating, asking about features/pricing/integration ("How does this work?", "We're looking for this", "Does this integrate with X?")
- question: Genuine question showing interest but not active evaluation ("What do you mean by X?", "Can you elaborate?")
- medium_intent: Genuine interest beyond politeness ("Interesting approach", "We've been thinking about this")
- low_intent: Polite/generic engagement ("Great post!", "Congrats!", emoji reactions)

Respond with ONLY valid JSON in this exact format:
{"sentiment": "<category>", "reasoning": "<one sentence>"}`;

export interface SentimentResult {
  sentiment: SentimentScore;
  reasoning: string;
}

/**
 * Classify a single LinkedIn comment's buying intent using Claude Haiku.
 *
 * Returns low_intent for empty/trivial comments and on any error.
 */
export async function classifyCommentSentiment(
  commentText: string
): Promise<SentimentResult> {
  // Guard: empty, null, or trivially short comments
  if (!commentText || commentText.trim().length < 3) {
    return { sentiment: 'low_intent', reasoning: 'Empty or trivial comment' };
  }

  try {
    const client = createAnthropicClient('signal-sentiment');

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Classify this LinkedIn comment:\n\n"${commentText}"`,
        },
      ],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { sentiment: 'low_intent', reasoning: 'Classification failed' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      sentiment?: string;
      reasoning?: string;
    };

    const validSentiments: SentimentScore[] = [
      'high_intent',
      'medium_intent',
      'low_intent',
      'question',
    ];

    if (
      !parsed.sentiment ||
      !validSentiments.includes(parsed.sentiment as SentimentScore)
    ) {
      return { sentiment: 'low_intent', reasoning: 'Classification failed' };
    }

    return {
      sentiment: parsed.sentiment as SentimentScore,
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  } catch {
    return { sentiment: 'low_intent', reasoning: 'Classification failed' };
  }
}

/**
 * Classify multiple comments in parallel batches of 10.
 *
 * Each comment is independently classified via classifyCommentSentiment.
 * Results are returned in the same order with id mapping.
 */
export async function batchClassifySentiment(
  comments: Array<{ id: string; text: string }>
): Promise<Array<{ id: string; sentiment: SentimentScore; reasoning: string }>> {
  const BATCH_SIZE = 10;
  const results: Array<{
    id: string;
    sentiment: SentimentScore;
    reasoning: string;
  }> = [];

  for (let i = 0; i < comments.length; i += BATCH_SIZE) {
    const batch = comments.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (comment) => {
        const { sentiment, reasoning } = await classifyCommentSentiment(
          comment.text
        );
        return { id: comment.id, sentiment, reasoning };
      })
    );
    results.push(...batchResults);
  }

  return results;
}
