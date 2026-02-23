import { getAnthropicClient } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import { buildVoicePromptSection } from './voice-prompt-builder';
import type { TeamVoiceProfile } from '@/lib/types/content-pipeline';

// ============================================
// TYPES
// ============================================

export interface HookScore {
  score: number;
  suggestions: string[];
}

export interface PolishResult {
  original: string;
  polished: string;
  aiPatternsFound: string[];
  hookScore: HookScore;
  changes: string[];
}

export interface PolishOptions {
  rewriteAIPatterns?: boolean;
  strengthenHook?: boolean;
  formatOnly?: boolean;
  voiceProfile?: TeamVoiceProfile;
}

// ============================================
// AI PATTERN DETECTION
// ============================================

export const AI_PHRASES = [
  "Here's the thing",
  "Let me explain",
  "game-changer",
  "game changer",
  "At the end of the day",
  "In this article",
  "As a matter of fact",
  "It's important to note",
  "In conclusion",
  "Moving forward",
  "That being said",
  "Dive deep",
  "deep dive",
  "Unlock your potential",
  "Level up",
  "Take it to the next level",
  "Leverage",
  "synergy",
  "paradigm shift",
  "low-hanging fruit",
  "value proposition",
  "circle back",
  "touch base",
  "think outside the box",
  "drill down",
  "bandwidth",
  "unpack this",
  "double down",
  "at scale",
  "pivot",
  "disrupt",
  "ideate",
  "align on",
  "needle-moving",
  "mission-critical",
  "world-class",
  "best-in-class",
  "cutting-edge",
  "state-of-the-art",
  "next-generation",
  "holistic approach",
  "ecosystem",
  "robust",
  "seamless",
  "comprehensive",
];

export const AI_STRUCTURAL_PATTERNS = [
  /^(Every [a-z]+\.\s*){3,}/im,
  /That's the game\./i,
  /That's it\./i,
  /Full stop\./i,
  /Period\./i,
  /End of story\./i,
  /That's the secret\./i,
  /That's the key\./i,
  /(\b\w+\b)(\.|,)\s+\1(\.|,)\s+\1/i,
  /\bWant to know (the secret|what|how|why)\?/i,
  /\bHere's what (most people|nobody|everyone) (gets wrong|doesn't know|misses)/i,
  /\bwith that said\b/i,
  /\bhaving said that\b/i,
  /\bit goes without saying\b/i,
];

export function detectAIPatterns(text: string): string[] {
  const found: string[] = [];

  for (const phrase of AI_PHRASES) {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (regex.test(text)) {
      found.push(phrase);
    }
  }

  for (const pattern of AI_STRUCTURAL_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) {
        found.push(match[0].trim());
      }
    }
  }

  return [...new Set(found)];
}

// ============================================
// HOOK SCORING
// ============================================

const HOOK_STRENGTH_FACTORS = {
  hasNumbers: {
    weight: 2,
    test: (text: string) => /\$?\d+[,.\d]*%?/.test(text),
  },
  hasSpecificTimeframe: {
    weight: 1.5,
    test: (text: string) => /\d+\s*(days?|weeks?|months?|years?|hours?)/i.test(text),
  },
  isShort: {
    weight: 1,
    test: (text: string) => text.length <= 80,
  },
  hasContrast: {
    weight: 1.5,
    test: (text: string) => /\b(but|instead|not|never|stop|quit|wrong|mistake)\b/i.test(text),
  },
  hasFirstPerson: {
    weight: 1,
    test: (text: string) => /\b(I|my|me|we|our)\b/i.test(text),
  },
  hasQuestion: {
    weight: 0.5,
    test: (text: string) => text.includes('?'),
  },
  hasCuriosity: {
    weight: 1.5,
    test: (text: string) =>
      /\b(secret|surprising|unexpected|weird|strange|crazy|one thing|single)\b/i.test(text),
  },
  hasOutcome: {
    weight: 2,
    test: (text: string) =>
      /\b(revenue|profit|sales|customers|followers|growth|doubled|tripled|increased)\b/i.test(text),
  },
};

const HOOK_WEAKNESS_FACTORS: Record<string, { penalty: number; test: (text: string) => boolean }> = {
  isGeneric: {
    penalty: 2,
    test: (text: string) =>
      /^(Tips for|Thoughts on|Some thoughts|How to|Ways to|Things to|Ideas for)\b/i.test(text),
  },
  isVague: {
    penalty: 1.5,
    test: (text: string) =>
      /\b(better|improve|great|good|important|essential|key|must)\b/i.test(text) &&
      !/\d/.test(text),
  },
  isTooLong: {
    penalty: 1,
    test: (text: string) => text.length > 120,
  },
  hasAIPatterns: {
    penalty: 2,
    test: (text: string) => detectAIPatterns(text).length > 0,
  },
  lacksSpecificity: {
    penalty: 1.5,
    test: (text: string) => !/\d/.test(text) && !/\b(I|my|we)\b/i.test(text),
  },
};

export function scoreHook(hook: string): HookScore {
  let score = 5;
  const suggestions: string[] = [];

  for (const factor of Object.values(HOOK_STRENGTH_FACTORS)) {
    if (factor.test(hook)) {
      score += factor.weight;
    }
  }

  for (const [name, factor] of Object.entries(HOOK_WEAKNESS_FACTORS)) {
    if (factor.test(hook)) {
      score -= factor.penalty;

      switch (name) {
        case 'isGeneric':
          suggestions.push('Start with a specific result or story instead of generic intro');
          break;
        case 'isVague':
          suggestions.push('Add specific numbers or outcomes');
          break;
        case 'isTooLong':
          suggestions.push('Shorten to under 80 characters for maximum impact');
          break;
        case 'hasAIPatterns':
          suggestions.push('Remove AI-sounding phrases');
          break;
        case 'lacksSpecificity':
          suggestions.push('Add personal experience (I, my, we) or specific data');
          break;
      }
    }
  }

  if (!HOOK_STRENGTH_FACTORS.hasNumbers.test(hook)) {
    suggestions.push('Consider adding specific numbers ($X, Y%, Z days)');
  }

  if (!HOOK_STRENGTH_FACTORS.hasFirstPerson.test(hook)) {
    suggestions.push('Make it personal with first-person perspective');
  }

  score = Math.max(1, Math.min(10, Math.round(score)));

  return {
    score,
    suggestions: [...new Set(suggestions)],
  };
}

// ============================================
// POST FORMATTING
// ============================================

const EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu;

export function formatPost(content: string): string {
  let result = content;
  result = result.replace(EMOJI_REGEX, '');
  result = result.replace(/#\w+/g, '');
  result = result.replace(/\s*—\s*/g, ', ');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/\.([A-Z])/g, '.\n\n$1');
  result = result.replace(/[ \t]+/g, ' ');
  result = result.replace(/\n /g, '\n');
  result = result.replace(/ \n/g, '\n');
  result = result.trim();
  return result;
}

// ============================================
// FULL POLISH PIPELINE
// ============================================

export async function polishPost(
  content: string,
  options: PolishOptions = {}
): Promise<PolishResult> {
  const { rewriteAIPatterns = true, strengthenHook = true, formatOnly = false, voiceProfile } = options;

  let polished = formatPost(content);
  const aiPatternsFound = detectAIPatterns(content);
  const changes: string[] = [];

  const hookMatch = polished.match(/^[^\n.!?]+[.!?]?/);
  const hook = hookMatch ? hookMatch[0] : polished.split('\n')[0];
  const hookScore = scoreHook(hook);

  if (formatOnly) {
    if (polished !== content) {
      changes.push('Applied formatting fixes');
    }
    return { original: content, polished, aiPatternsFound, hookScore, changes };
  }

  if ((rewriteAIPatterns && aiPatternsFound.length > 0) || (strengthenHook && hookScore.score < 6)) {
    const prompt = buildPolishPrompt(polished, aiPatternsFound, hookScore, voiceProfile);
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const rewrittenContent =
      response.content?.[0]?.type === 'text' ? response.content[0].text : polished;

    const extractedPost = extractRewrittenPost(rewrittenContent);
    if (extractedPost) {
      polished = formatPost(extractedPost);
      if (aiPatternsFound.length > 0) {
        changes.push(`Rewrote ${aiPatternsFound.length} AI patterns`);
      }
      if (hookScore.score < 6) {
        changes.push('Strengthened hook');
      }
    }
  }

  return { original: content, polished, aiPatternsFound, hookScore, changes };
}

function buildPolishPrompt(content: string, aiPatterns: string[], hookScore: HookScore, voiceProfile?: TeamVoiceProfile): string {
  const issues: string[] = [];

  if (aiPatterns.length > 0) {
    issues.push(`AI-sounding phrases found: ${aiPatterns.join(', ')}`);
  }

  if (hookScore.score < 6) {
    issues.push(
      `Weak hook (score: ${hookScore.score}/10). Suggestions: ${hookScore.suggestions.join('; ')}`
    );
  }

  const styleSection = buildVoicePromptSection(voiceProfile, 'linkedin');
  const styleInstruction = styleSection
    ? `\n${styleSection}\n\nPolish the post to match this author's writing style.\n`
    : '';

  return `You are an expert LinkedIn content editor. Rewrite the following post to fix these issues:

${issues.join('\n')}

RULES:
1. Keep the same core message and structure
2. Replace AI-sounding phrases with natural, conversational language
3. Make the hook more specific, personal, and attention-grabbing
4. Keep the same length (within 10% variance)
5. Do NOT add emojis or hashtags
6. Do NOT use em dashes
7. Use short paragraphs for readability
${styleInstruction}
ORIGINAL POST:
${content}

Return ONLY the rewritten post, no explanations or comments.`;
}

function extractRewrittenPost(response: string): string | null {
  const trimmed = response.trim();

  const codeBlockMatch = trimmed.match(/```(?:text)?\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  const prefixPatterns = [
    /^(?:Here['']s|Here is) (?:the )?rewritten (?:post|version)[:\s]*/i,
    /^(?:Rewritten|Updated|Revised) (?:post|version)[:\s]*/i,
  ];

  let cleaned = trimmed;
  for (const pattern of prefixPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim() || null;
}
