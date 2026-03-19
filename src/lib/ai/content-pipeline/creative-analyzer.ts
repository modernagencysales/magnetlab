/**
 * Creative Analyzer.
 * Analyzes external content for commentary-worthiness.
 * Input: raw text + source platform.
 * Output: creative type, topics, score, suggested hooks, best exploit match.
 * Never imports from Next.js HTTP layer.
 */

import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { logError } from '@/lib/utils/logger';
import type { CreativeAnalysis, CreativeTypeRequired, SourcePlatform } from '@/lib/types/exploits';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_CREATIVE_TYPES: CreativeTypeRequired[] = [
  'tweet_screenshot',
  'meme',
  'reddit_post',
  'linkedin_post',
  'slack_message',
  'cold_email',
  'infographic',
  'gif',
  'custom',
];

const SYSTEM_PROMPT = `You are a LinkedIn content strategist. Analyze the provided content and return a structured JSON assessment of its commentary-worthiness for LinkedIn posts.

Respond with ONLY this JSON structure, no other text:
{
  "creative_type": "tweet_screenshot" | "meme" | "reddit_post" | "linkedin_post" | "slack_message" | "cold_email" | "infographic" | "gif" | "custom",
  "topics": ["topic1", "topic2"],
  "commentary_worthy_score": 7,
  "suggested_hooks": ["Hook idea 1", "Hook idea 2"],
  "suggested_exploit_slug": "commentary-on-tweet" | null
}

Guidelines:
- creative_type: Detect the content format from the source platform and text signals. Default to "custom" if unclear.
- topics: 2-5 relevant niches (e.g., "cold email", "B2B sales", "LinkedIn growth", "agency operations"). Be specific.
- commentary_worthy_score: 0-10. How much commentary potential does this have? 0 = purely informational, no hook. 10 = highly controversial or insight-rich, begs a strong take.
- suggested_hooks: 2-3 LinkedIn hook ideas that use this content as source material. Start with "I" ~70% of the time. Use numbers when possible.
- suggested_exploit_slug: If this content best fits a specific exploit format, name the slug. Common formats: "commentary-on-tweet", "contrarian-take", "story-from-example", "listicle-from-data", "question-to-audience". Return null if no clear match.`;

// ─── Main function ─────────────────────────────────────────────────────────────

/**
 * Analyzes external content for commentary-worthiness and returns a structured assessment.
 * Returns null on error.
 */
export async function analyzeCreative(input: {
  content_text: string;
  source_platform: SourcePlatform;
  source_url?: string;
}): Promise<CreativeAnalysis | null> {
  const { content_text, source_platform, source_url } = input;

  try {
    const userMessage = [
      `SOURCE PLATFORM: ${source_platform}`,
      source_url ? `SOURCE URL: ${source_url}` : null,
      `CONTENT:\n${content_text}`,
    ]
      .filter(Boolean)
      .join('\n');

    const client = getAnthropicClient('creative-analyzer');
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: `${SYSTEM_PROMPT}\n\n${userMessage}` }],
    });

    const text = response.content?.[0]?.type === 'text' ? response.content[0].text : '';
    const raw = parseJsonResponse<{
      creative_type: string;
      topics: unknown;
      commentary_worthy_score: unknown;
      suggested_hooks: unknown;
      suggested_exploit_slug: unknown;
    }>(text);

    return {
      creative_type: normalizeCreativeType(raw.creative_type),
      topics: normalizeStringArray(raw.topics, 5),
      commentary_worthy_score: clampScore(raw.commentary_worthy_score),
      suggested_hooks: normalizeStringArray(raw.suggested_hooks, 3),
      suggested_exploit_slug:
        typeof raw.suggested_exploit_slug === 'string' ? raw.suggested_exploit_slug : null,
    };
  } catch (error) {
    logError('ai/creative-analyzer', error, { source_platform, source_url });
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeCreativeType(value: unknown): CreativeTypeRequired {
  if (typeof value === 'string' && VALID_CREATIVE_TYPES.includes(value as CreativeTypeRequired)) {
    return value as CreativeTypeRequired;
  }
  return 'custom';
}

function normalizeStringArray(value: unknown, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').slice(0, maxLength);
}

function clampScore(value: unknown): number {
  const num = typeof value === 'number' ? value : 5;
  return Math.max(0, Math.min(10, Math.round(num)));
}
