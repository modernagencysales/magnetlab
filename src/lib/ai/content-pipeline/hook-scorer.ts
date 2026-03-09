import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { extractHook } from './hook-utils';

// ============================================
// TYPES
// ============================================

export interface HookScoreResult {
  score: number; // 1-10
  breakdown: {
    curiosity_gap: number;    // 1-10
    power_words: number;      // 1-10
    pattern_interrupt: number; // 1-10
    specificity: number;      // 1-10
  };
  suggestions: string[];
}

// Re-export for backward compatibility
export { extractHook } from './hook-utils';

// ============================================
// AI HOOK SCORING
// ============================================

const HOOK_SCORE_PROMPT = `You are a LinkedIn content expert. Score this LinkedIn post hook on 4 dimensions, each from 1-10.

Dimensions:
- curiosity_gap: Does the hook create an information gap that makes the reader NEED to keep reading? (1 = no gap, 10 = irresistible)
- power_words: Does the hook use emotionally charged, vivid, or action-oriented language? (1 = bland/generic, 10 = electric)
- pattern_interrupt: Does the hook break the reader's scroll pattern with something unexpected? (1 = predictable, 10 = stops the scroll)
- specificity: Does the hook use concrete numbers, names, timeframes, or outcomes? (1 = vague/abstract, 10 = hyper-specific)

Also provide the overall score (1-10, weighted average favoring curiosity_gap and pattern_interrupt) and 2-4 actionable suggestions to improve the hook.

Respond with ONLY this exact JSON format, no other text:
{"score":N,"breakdown":{"curiosity_gap":N,"power_words":N,"pattern_interrupt":N,"specificity":N},"suggestions":["suggestion 1","suggestion 2"]}

Here is the hook to score:
---
{HOOK}
---`;

/**
 * Score a LinkedIn post hook using Claude AI.
 * Returns a detailed breakdown of the hook's effectiveness.
 */
export async function scoreHook(content: string): Promise<HookScoreResult> {
  const hook = extractHook(content);

  if (!hook.trim()) {
    return {
      score: 1,
      breakdown: {
        curiosity_gap: 1,
        power_words: 1,
        pattern_interrupt: 1,
        specificity: 1,
      },
      suggestions: ['Add content to your post hook.'],
    };
  }

  try {
    const client = getAnthropicClient('hook-scorer');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: HOOK_SCORE_PROMPT.replace('{HOOK}', hook),
        },
      ],
    });

    const text = response.content?.[0]?.type === 'text' ? response.content[0].text : '';
    const result = parseJsonResponse<HookScoreResult>(text);

    // Validate and clamp all scores to 1-10
    return {
      score: clamp(result.score),
      breakdown: {
        curiosity_gap: clamp(result.breakdown?.curiosity_gap),
        power_words: clamp(result.breakdown?.power_words),
        pattern_interrupt: clamp(result.breakdown?.pattern_interrupt),
        specificity: clamp(result.breakdown?.specificity),
      },
      suggestions: Array.isArray(result.suggestions) ? result.suggestions.slice(0, 5) : [],
    };
  } catch {
    // Fallback on any error (parse failure, API error, etc.)
    return {
      score: 5,
      breakdown: {
        curiosity_gap: 5,
        power_words: 5,
        pattern_interrupt: 5,
        specificity: 5,
      },
      suggestions: ['Unable to analyze hook — try again.'],
    };
  }
}

// ============================================
// HELPERS
// ============================================

function clamp(value: unknown): number {
  const num = typeof value === 'number' ? value : 5;
  return Math.max(1, Math.min(10, Math.round(num)));
}
