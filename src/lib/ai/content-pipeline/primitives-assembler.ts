/**
 * Primitives Assembler.
 * Builds an AI prompt from any combination of content primitives.
 * Replaces the rigid post-writer as the primary generation path.
 * Never imports from Next.js HTTP layer.
 */

import { getAnthropicClient } from './anthropic-client';
import { logError } from '@/lib/utils/logger';

// ─── Primitive input types ────────────────────────────────────────────────────

export interface ExploitInput {
  name: string;
  prompt_template: string;
  example_posts: string[];
}

export interface CreativeInput {
  content_text: string;
  image_url: string | null;
}

export interface KnowledgeInput {
  content: string;
}

export interface VoiceInput {
  tone: string;
  vocabulary: string[];
  banned_phrases: string[];
}

export interface TemplateInput {
  structure: string;
}

export interface IdeaInput {
  core_insight: string;
  key_points: string[];
}

export interface PrimitivesInput {
  exploit?: ExploitInput;
  creative?: CreativeInput;
  knowledge?: KnowledgeInput[];
  voice?: VoiceInput;
  template?: TemplateInput;
  idea?: IdeaInput;
  hook?: string;
  instructions?: string;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface GeneratedPost {
  content: string;
  hook_used: string;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Assembles a prompt from any combination of primitives.
 * Pure function — no API calls.
 */
export function buildPromptFromPrimitives(input: PrimitivesInput): string {
  const sections: string[] = [];

  sections.push(
    'You are a LinkedIn content writer. Write a single LinkedIn post based on the inputs below.'
  );

  // ── Exploit ──
  if (input.exploit) {
    const { name, prompt_template, example_posts } = input.exploit;
    sections.push(`\n── EXPLOIT FORMAT: ${name} ──`);

    let resolvedTemplate = prompt_template;
    resolvedTemplate = resolvedTemplate.replace(
      '{{creative_text}}',
      input.creative?.content_text ?? ''
    );
    resolvedTemplate = resolvedTemplate.replace(
      '{{idea_text}}',
      input.idea ? `${input.idea.core_insight}\n${input.idea.key_points.join('\n')}` : ''
    );
    resolvedTemplate = resolvedTemplate.replace(
      '{{knowledge_text}}',
      input.knowledge?.map((k) => k.content).join('\n\n') ?? ''
    );

    sections.push(resolvedTemplate);

    if (example_posts.length > 0) {
      sections.push('\nEXAMPLE POSTS (for tone and structure reference only — do not copy):');
      example_posts.forEach((post, i) => {
        sections.push(`Example ${i + 1}:\n${post}`);
      });
    }
  }

  // ── Creative ──
  if (input.creative && !input.exploit) {
    sections.push('\n── SOURCE MATERIAL ──');
    sections.push(`Use this content as your source:\n${input.creative.content_text}`);
    if (input.creative.image_url) {
      sections.push(`Image reference: ${input.creative.image_url}`);
    }
  }

  // ── Knowledge ──
  if (input.knowledge && input.knowledge.length > 0 && !input.exploit) {
    sections.push('\n── EXPERTISE CONTEXT ──');
    sections.push('Draw on this knowledge to add depth and authority:');
    input.knowledge.forEach((k, i) => {
      sections.push(`[${i + 1}] ${k.content}`);
    });
  }

  // ── Template ──
  if (input.template) {
    sections.push('\n── POST STRUCTURE ──');
    sections.push(`Follow this structure:\n${input.template.structure}`);
  }

  // ── Idea ──
  if (input.idea && !input.exploit) {
    sections.push('\n── CORE IDEA ──');
    sections.push(`Core insight: ${input.idea.core_insight}`);
    if (input.idea.key_points.length > 0) {
      sections.push('Key points to cover:');
      input.idea.key_points.forEach((point) => {
        sections.push(`- ${point}`);
      });
    }
  }

  // ── Hook ──
  if (input.hook) {
    sections.push('\n── OPENING LINE ──');
    sections.push(`Start with this hook: ${input.hook}`);
  }

  // ── Voice ──
  if (input.voice) {
    sections.push('\n── VOICE & STYLE ──');
    sections.push(`Tone: ${input.voice.tone}`);
    if (input.voice.vocabulary.length > 0) {
      sections.push(`Use these terms naturally: ${input.voice.vocabulary.join(', ')}`);
    }
    if (input.voice.banned_phrases.length > 0) {
      sections.push(`Never use: ${input.voice.banned_phrases.join(', ')}`);
    }
  }

  // ── Freeform instructions ──
  if (input.instructions) {
    sections.push('\n── ADDITIONAL INSTRUCTIONS ──');
    sections.push(input.instructions);
  }

  sections.push('\nReturn ONLY the post text. No explanations, no preamble, no markdown wrapping.');

  return sections.join('\n');
}

// ─── Generator ───────────────────────────────────────────────────────────────

/**
 * Generates a LinkedIn post from any combination of primitives.
 * Returns null on error.
 */
export async function generateFromPrimitives(
  input: PrimitivesInput
): Promise<GeneratedPost | null> {
  try {
    const prompt = buildPromptFromPrimitives(input);
    const client = getAnthropicClient('primitives-assembler');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content?.[0]?.type === 'text' ? response.content[0].text.trim() : '';
    if (!text) {
      throw new Error('No text content in response');
    }

    const hook_used = text.split('\n')[0] ?? text;

    return { content: text, hook_used };
  } catch (error) {
    logError('ai/primitives-assembler', error, { hasExploit: !!input.exploit });
    return null;
  }
}
