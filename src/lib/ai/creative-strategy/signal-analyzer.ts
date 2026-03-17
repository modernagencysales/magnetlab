/** Signal Analyzer. Detects hook patterns, format fingerprints, and generates exploit hypotheses. Never imports from Next.js HTTP layer. */

import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import { logError } from '@/lib/utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

type HookPattern =
  | 'contrarian'
  | 'story'
  | 'bold_claim'
  | 'question'
  | 'number_led'
  | 'cta'
  | 'emotional'
  | 'curiosity_gap'
  | 'other';

type EmojiUsage = 'none' | 'light' | 'heavy';

type PostLength = 'short' | 'medium' | 'long';

interface FormatFingerprint {
  length: PostLength;
  line_break_style: string;
  emoji_usage: EmojiUsage;
  cta_type: string | null;
}

/** Result from analyzeSignal — excludes media_classification and similar_play_ids (set elsewhere). */
export interface AnalysisResult {
  hook_pattern: HookPattern;
  format_fingerprint: FormatFingerprint;
  trending_topic: string | null;
  exploit_hypothesis: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_HOOK_PATTERNS: HookPattern[] = [
  'contrarian',
  'story',
  'bold_claim',
  'question',
  'number_led',
  'cta',
  'emotional',
  'curiosity_gap',
  'other',
];

const VALID_EMOJI_USAGE: EmojiUsage[] = ['none', 'light', 'heavy'];

const VALID_POST_LENGTH: PostLength[] = ['short', 'medium', 'long'];

const ANALYZE_PROMPT = `You are a LinkedIn content strategist. Analyze this post and extract structured signals.

{MEDIA_CONTEXT}

Post content:
---
{CONTENT}
---

Return ONLY this exact JSON, no other text:
{
  "hook_pattern": "contrarian|story|bold_claim|question|number_led|cta|emotional|curiosity_gap|other",
  "format_fingerprint": {
    "length": "short|medium|long",
    "line_break_style": "description of line break usage, e.g. 'single line breaks between paragraphs' or 'heavy whitespace, one sentence per line'",
    "emoji_usage": "none|light|heavy",
    "cta_type": "the CTA style used, e.g. 'comment below', 'DM me', 'link in comments', 'follow for more', or null if none"
  },
  "trending_topic": "name of current trend/topic referenced, or null if none",
  "exploit_hypothesis": "1-2 sentence theory about WHY this post performed well based on the content and format patterns"
}

Rules:
- hook_pattern: classify the first 1-3 lines (the hook) into one of the categories
- length: short = under 500 chars, medium = 500-1500, long = over 1500
- emoji_usage: none = 0, light = 1-5, heavy = 6+
- trending_topic: only name it if the post clearly references a recognizable current trend, event, or hot topic
- exploit_hypothesis: be specific about what structural/psychological element drives engagement`;

// ─── Main function ──────────────────────────────────────────────────────────

/**
 * Analyze a signal's content for hook patterns, format fingerprints, and exploit hypotheses.
 * Returns a partial SignalAiAnalysis (without media_classification and similar_play_ids).
 */
export async function analyzeSignal(
  content: string,
  mediaClassification: string | null
): Promise<AnalysisResult> {
  if (!content.trim()) {
    return fallbackResult();
  }

  try {
    const client = createAnthropicClient('cs-signal-analyzer', { timeout: 60_000 });

    const mediaContext = mediaClassification
      ? `The post includes media classified as: "${mediaClassification}". Factor this into your analysis.`
      : 'The post has no media attachment.';

    const prompt = ANALYZE_PROMPT.replace('{CONTENT}', content).replace(
      '{MEDIA_CONTEXT}',
      mediaContext
    );

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text = response.content?.[0]?.type === 'text' ? response.content[0].text : '';
    const parsed = parseJsonFromText<RawAnalysisResponse>(text);

    return validateResult(parsed);
  } catch (error) {
    logError('cs-signal-analyzer', error, { contentLength: content.length });
    return fallbackResult();
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface RawAnalysisResponse {
  hook_pattern?: string;
  format_fingerprint?: {
    length?: string;
    line_break_style?: string;
    emoji_usage?: string;
    cta_type?: string | null;
  };
  trending_topic?: string | null;
  exploit_hypothesis?: string | null;
}

function parseJsonFromText<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const codeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    }
    throw new Error(`Failed to parse JSON: ${text.substring(0, 200)}`);
  }
}

function validateResult(raw: RawAnalysisResponse): AnalysisResult {
  const hookPattern = VALID_HOOK_PATTERNS.includes(raw.hook_pattern as HookPattern)
    ? (raw.hook_pattern as HookPattern)
    : 'other';

  const fp = raw.format_fingerprint;
  const length = VALID_POST_LENGTH.includes(fp?.length as PostLength)
    ? (fp!.length as PostLength)
    : 'medium';
  const emojiUsage = VALID_EMOJI_USAGE.includes(fp?.emoji_usage as EmojiUsage)
    ? (fp!.emoji_usage as EmojiUsage)
    : 'none';

  return {
    hook_pattern: hookPattern,
    format_fingerprint: {
      length,
      line_break_style: typeof fp?.line_break_style === 'string' ? fp.line_break_style : 'unknown',
      emoji_usage: emojiUsage,
      cta_type: typeof fp?.cta_type === 'string' ? fp.cta_type : null,
    },
    trending_topic: typeof raw.trending_topic === 'string' ? raw.trending_topic : null,
    exploit_hypothesis: typeof raw.exploit_hypothesis === 'string' ? raw.exploit_hypothesis : null,
  };
}

function fallbackResult(): AnalysisResult {
  return {
    hook_pattern: 'other',
    format_fingerprint: {
      length: 'medium',
      line_break_style: 'unknown',
      emoji_usage: 'none',
      cta_type: null,
    },
    trending_topic: null,
    exploit_hypothesis: null,
  };
}
