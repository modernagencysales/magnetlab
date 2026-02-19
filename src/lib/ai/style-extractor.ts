import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface StyleProfile {
  tone: 'conversational' | 'professional' | 'provocative' | 'educational' | 'inspirational';
  sentence_length: 'short' | 'medium' | 'long' | 'varied';
  vocabulary: 'simple' | 'technical' | 'mixed';
  formatting: {
    uses_emojis: boolean;
    uses_line_breaks: boolean;
    uses_lists: boolean;
    uses_bold: boolean;
    avg_paragraphs: number;
  };
  hook_patterns: string[];
  cta_patterns: string[];
  banned_phrases: string[];
  signature_phrases: string[];
}

export interface ExtractedStyle {
  name: string;
  description: string;
  style_profile: StyleProfile;
  example_posts: string[];
  key_patterns: string[];
  recommendations: string[];
}

export interface StyleExtractionInput {
  posts: string[];
  authorName?: string;
  authorHeadline?: string;
}

/**
 * Analyze a collection of posts and extract the author's writing style
 * using Claude Opus 4.5 for deep analysis
 */
export async function extractWritingStyle(
  input: StyleExtractionInput
): Promise<ExtractedStyle> {
  if (input.posts.length === 0) {
    throw new Error('No posts provided for style analysis');
  }

  // Format posts for analysis
  const formattedPosts = input.posts
    .slice(0, 10) // Analyze up to 10 posts
    .map((post, i) => `--- POST ${i + 1} ---\n${post}`)
    .join('\n\n');

  const authorContext = input.authorName
    ? `Author: ${input.authorName}${input.authorHeadline ? ` - ${input.authorHeadline}` : ''}`
    : 'Unknown author';

  const prompt = `You are analyzing LinkedIn posts from a creator to extract their unique writing style.

${authorContext}

POSTS TO ANALYZE:
${formattedPosts}

Your task is to perform a deep analysis of this creator's writing style and produce a comprehensive style profile that could be used to write content in their voice.

Analyze the following aspects:
1. TONE: Is the writing conversational, professional, provocative, educational, or inspirational?
2. SENTENCE STRUCTURE: Does the author use short punchy sentences, long flowing ones, or a mix?
3. VOCABULARY: Is the language simple/accessible, technical/jargon-heavy, or mixed?
4. FORMATTING:
   - Do they use emojis? If so, how?
   - Line break patterns (single lines? paragraph blocks?)
   - Lists (numbered? bullet points?)
   - Bold text or emphasis?
   - Average paragraphs per post
5. HOOK PATTERNS: What patterns do they use to start posts? (questions? bold claims? stories?)
6. CTA PATTERNS: How do they end posts? What calls-to-action do they use?
7. SIGNATURE PHRASES: Any recurring phrases, words, or expressions they commonly use
8. THINGS THEY AVOID: Any patterns they clearly avoid or never use

Return your analysis as JSON:
{
  "name": "Name that captures their style (e.g., 'Provocative Storyteller', 'Data-Driven Educator')",
  "description": "2-3 sentence summary of their overall writing approach and what makes it distinctive",
  "style_profile": {
    "tone": "conversational" | "professional" | "provocative" | "educational" | "inspirational",
    "sentence_length": "short" | "medium" | "long" | "varied",
    "vocabulary": "simple" | "technical" | "mixed",
    "formatting": {
      "uses_emojis": boolean,
      "uses_line_breaks": boolean,
      "uses_lists": boolean,
      "uses_bold": boolean,
      "avg_paragraphs": number
    },
    "hook_patterns": ["pattern 1", "pattern 2", "pattern 3"],
    "cta_patterns": ["cta pattern 1", "cta pattern 2"],
    "banned_phrases": ["phrase to avoid 1", "phrase to avoid 2"],
    "signature_phrases": ["signature phrase 1", "signature phrase 2", "signature phrase 3"]
  },
  "example_posts": ["Most representative post 1 (verbatim)", "Most representative post 2 (verbatim)"],
  "key_patterns": [
    "Key insight about their writing style",
    "Another pattern worth noting",
    "Third notable pattern"
  ],
  "recommendations": [
    "Tip for writing in this style",
    "Another recommendation",
    "Third tip"
  ]
}

Return ONLY valid JSON, no other text.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse JSON from response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse style extraction response');
  }

  const extracted = JSON.parse(jsonMatch[0]) as ExtractedStyle;

  // Validate required fields
  if (!extracted.name || !extracted.style_profile) {
    throw new Error('Extracted style missing required fields');
  }

  return extracted;
}

/**
 * Generate a style summary suitable for AI writing prompts
 */
export function generateStylePrompt(style: StyleProfile): string {
  const lines: string[] = [];

  lines.push(`WRITING STYLE GUIDELINES:`);
  lines.push(``);
  lines.push(`Tone: ${style.tone}`);
  lines.push(`Sentence length: ${style.sentence_length}`);
  lines.push(`Vocabulary: ${style.vocabulary}`);
  lines.push(``);

  lines.push(`Formatting:`);
  if (style.formatting.uses_emojis) {
    lines.push(`- Use emojis sparingly and appropriately`);
  } else {
    lines.push(`- Do NOT use emojis`);
  }
  if (style.formatting.uses_line_breaks) {
    lines.push(`- Use line breaks between thoughts/paragraphs`);
  }
  if (style.formatting.uses_lists) {
    lines.push(`- Feel free to use lists when appropriate`);
  }
  if (style.formatting.uses_bold) {
    lines.push(`- Use bold for emphasis on key points`);
  }
  lines.push(`- Target ${style.formatting.avg_paragraphs} paragraphs per post`);
  lines.push(``);

  if (style.hook_patterns.length > 0) {
    lines.push(`Hook patterns to use:`);
    style.hook_patterns.forEach((p) => lines.push(`- ${p}`));
    lines.push(``);
  }

  if (style.cta_patterns.length > 0) {
    lines.push(`CTA patterns to use:`);
    style.cta_patterns.forEach((p) => lines.push(`- ${p}`));
    lines.push(``);
  }

  if (style.signature_phrases.length > 0) {
    lines.push(`Signature phrases to incorporate:`);
    style.signature_phrases.forEach((p) => lines.push(`- "${p}"`));
    lines.push(``);
  }

  if (style.banned_phrases.length > 0) {
    lines.push(`NEVER use these phrases:`);
    style.banned_phrases.forEach((p) => lines.push(`- "${p}"`));
  }

  return lines.join('\n');
}
