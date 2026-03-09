import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { splitHookAndBody } from './hook-utils';

// ============================================
// TYPES
// ============================================

export interface HookVariant {
  hook_type: string; // 'question' | 'story' | 'statistic'
  content: string;   // Full post with new hook + original body
}

// Re-export for backward compatibility
export { splitHookAndBody } from './hook-utils';

// ============================================
// AI HOOK VARIANT GENERATION
// ============================================

const HOOK_GENERATOR_PROMPT = `You are a LinkedIn content expert. Given a LinkedIn post hook, generate 3 alternative hooks that could replace it. The post body (everything after the hook) will remain unchanged.

Generate exactly 3 hooks in these styles:
1. **question** — A provocative, scroll-stopping question that creates a curiosity gap. Make the reader NEED to know the answer.
2. **story** — A vivid personal moment or scene-setting opener. Drop the reader into a specific moment in time (e.g., "I was sitting in the parking lot when my phone buzzed...").
3. **statistic** — A surprising number, data point, or fact that challenges assumptions. Use specificity (exact numbers, timeframes, percentages).

Each hook should be 1-5 lines, matching the tone and style of the original. The hook must flow naturally into the existing post body.

Respond with ONLY this exact JSON array format, no other text:
[{"hook_type":"question","content":"FULL POST TEXT WITH NEW HOOK + ORIGINAL BODY"},{"hook_type":"story","content":"FULL POST TEXT WITH NEW HOOK + ORIGINAL BODY"},{"hook_type":"statistic","content":"FULL POST TEXT WITH NEW HOOK + ORIGINAL BODY"}]

Here is the current hook:
---
{HOOK}
---

Here is the post body (keep this EXACTLY as-is, appended after each new hook):
---
{BODY}
---`;

/**
 * Generate 3 alternative hook variants for a LinkedIn post.
 * Each variant includes the full post text (new hook + original body).
 * Returns empty array on parse error or API failure.
 */
export async function generateHookVariants(content: string): Promise<HookVariant[]> {
  const { hook, body } = splitHookAndBody(content);

  if (!hook.trim()) {
    return [];
  }

  try {
    const client = getAnthropicClient('hook-generator');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: HOOK_GENERATOR_PROMPT
            .replace('{HOOK}', hook)
            .replace('{BODY}', body),
        },
      ],
    });

    const text = response.content?.[0]?.type === 'text' ? response.content[0].text : '';
    const variants = parseJsonResponse<HookVariant[]>(text);

    if (!Array.isArray(variants)) {
      return [];
    }

    // Validate each variant has required fields
    return variants
      .filter(v => v && typeof v.hook_type === 'string' && typeof v.content === 'string')
      .slice(0, 3);
  } catch {
    // Return empty array on any error (parse failure, API error, etc.)
    return [];
  }
}
