import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { findBestTemplate, buildTemplateGuidance } from './template-matcher';
import { buildVoicePromptSection } from './voice-prompt-builder';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';
import type { PostTemplate, StyleProfile, PostVariation, TeamVoiceProfile } from '@/lib/types/content-pipeline';
import { logError } from '@/lib/utils/logger';

export interface IdeaContext {
  id?: string;
  title: string;
  core_insight: string | null;
  full_context: string | null;
  why_post_worthy: string | null;
  content_type: string | null;
  hook?: string | null;
  key_points?: string[] | null;
}

export interface WritePostInput {
  idea: IdeaContext;
  template?: PostTemplate;
  styleProfile?: StyleProfile;
  targetAudience?: string;
  knowledgeContext?: string; // AI Brain context injected by briefing agent
  voiceProfile?: TeamVoiceProfile;
  authorName?: string;
  authorTitle?: string;
}

function buildVoiceSection(input: WritePostInput): string {
  const { voiceProfile, authorName, authorTitle } = input;
  if (!voiceProfile || !authorName) return '';

  const parts: string[] = [];
  parts.push(`\nYOU ARE WRITING AS: ${authorName}${authorTitle ? `, ${authorTitle}` : ''}`);

  if (voiceProfile.first_person_context) {
    parts.push(`FIRST-PERSON CONTEXT: ${voiceProfile.first_person_context}`);
  }
  if (voiceProfile.perspective_notes) {
    parts.push(`PERSPECTIVE: ${voiceProfile.perspective_notes}`);
  }
  if (voiceProfile.tone) {
    parts.push(`TONE: ${voiceProfile.tone}`);
  }
  if (voiceProfile.signature_phrases?.length) {
    parts.push(`SIGNATURE PHRASES (use naturally): ${voiceProfile.signature_phrases.join(', ')}`);
  }
  if (voiceProfile.banned_phrases?.length) {
    parts.push(`BANNED PHRASES (never use): ${voiceProfile.banned_phrases.join(', ')}`);
  }
  if (voiceProfile.industry_jargon?.length) {
    parts.push(`DOMAIN TERMS: ${voiceProfile.industry_jargon.join(', ')}`);
  }
  if (voiceProfile.storytelling_style) {
    parts.push(`STORYTELLING STYLE: ${voiceProfile.storytelling_style}`);
  }

  parts.push(`\nWrite as this specific person. Use "I" from their experience. Do NOT write generically.\n`);
  return parts.join('\n');
}

export interface WrittenPost {
  content: string;
  variations: PostVariation[];
  dm_template: string;
  cta_word: string;
}

function getBaseStyleGuidelines(): string {
  return `Voice:
- Direct, conversational, authoritative but not arrogant
- No-BS, results-focused, slightly contrarian
- Use industry jargon naturally to signal expertise
- Confident claims backed by specifics, not hype
- STRONG POINT OF VIEW. Take a stance. Have an opinion. Don't hedge.

Writing style (CRITICAL):
The goal is writing that sounds like a smart person explaining something to a peer. Not a copywriter. Not a LinkedIn guru. Not an AI.

Sentence construction: Most sentences should be real sentences with actual construction. Subject, verb, object. Clauses. Actual flow. Short punchy fragments are reserved for genuine dramatic moments only.

GOOD: "So now his only option is to cold email 12,000 people and ask them to join his list after they've already gotten what they wanted. He'll convert some percentage, but the leverage is gone."
BAD: "12,000 people. Cold email. No leverage. Gone."

Paragraph construction: Paragraphs should be 1-4 sentences. They should flow into each other.

Making points: Make your points through explanation and specifics. Do not make points through declaration, repetition, or rhythm.
BAD: "The lead magnet is not the point. The email list is the point."
GOOD: "The lead magnet was never supposed to be the deliverable. It's the exchange mechanism. Someone raises their hand, you send them to an opt-in page, they give you their email, and then they get access."

Forbidden patterns:
Phrases: "it all comes down to," "the secret is," "game-changer," "next level," "here's the thing," "here's the deal," "here's what most people miss," "let me explain," "the truth is," "the reality is," "killer," "insane," "crushing it," "absolute game-changer," "genius," "let's dive in," "let's go," "let's break it down," "don't wait," "stick with me"

Structures to avoid:
- Three-item dramatic lists: "Every X, every Y, every Z."
- Stacked one-liner declarations: "That's the game. That's it. Full stop."
- Repetition for emphasis: "Not one. Not two. Not three."
- Throat-clearing before a point: "Here's what most people don't realize:"

Formatting:
- Short paragraphs (1-4 sentences max)
- Strategic line breaks for emphasis, but not after every sentence
- Numbered lists only when teaching a process
- Occasional all-caps for ONE key word, not whole phrases
- No headers or bold text
- No emojis
- No em dashes. Use periods or commas instead.
- No hashtags

Hook requirements:
- First line must stop the scroll
- Use a number when possible
- Start with "I" about 70% of the time
- Make a bold claim OR present a result OR create a knowledge gap
- 1-2 sentences max`;
}

export async function writePostFreeform(input: WritePostInput): Promise<WrittenPost> {
  const { idea, targetAudience, knowledgeContext } = input;

  const knowledgeSection = knowledgeContext
    ? `\nKNOWLEDGE BASE CONTEXT (from your calls):
${knowledgeContext}
Use specific quotes, real numbers, and validated insights from this context.\n`
    : '';

  const voiceSection = buildVoiceSection(input);
  const styleSection = buildVoicePromptSection(input.voiceProfile, 'linkedin');

  const template = await getPrompt('post-writer-freeform');
  const prompt = interpolatePrompt(template.user_prompt, {
    style_guidelines: getBaseStyleGuidelines(),
    voice_section: voiceSection,
    voice_style_section: styleSection,
    target_audience: targetAudience || 'B2B professionals, agency owners, and marketers',
    idea_title: idea.title,
    idea_core_insight: idea.core_insight || '',
    idea_full_context: idea.full_context || '',
    idea_why_post_worthy: idea.why_post_worthy || '',
    idea_content_type: idea.content_type || '',
    knowledge_section: knowledgeSection,
  });

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: template.model,
    max_tokens: template.max_tokens,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseJsonResponse<WrittenPost>(textContent.text);
}

export async function writePostWithTemplate(input: WritePostInput): Promise<WrittenPost> {
  const { idea, template: postTemplate, targetAudience, knowledgeContext } = input;

  if (!postTemplate) {
    throw new Error('Template is required for writePostWithTemplate');
  }

  const knowledgeSection = knowledgeContext
    ? `\nKNOWLEDGE BASE CONTEXT (from your calls):
${knowledgeContext}
Use specific quotes, real numbers, and validated insights from this context.\n`
    : '';

  const voiceSection = buildVoiceSection(input);
  const styleSection = buildVoicePromptSection(input.voiceProfile, 'linkedin');

  const promptTemplate = await getPrompt('post-writer-template');
  const prompt = interpolatePrompt(promptTemplate.user_prompt, {
    template_structure: postTemplate.structure,
    template_examples: postTemplate.example_posts?.length
      ? `EXAMPLE POSTS USING THIS TEMPLATE:\n${postTemplate.example_posts.slice(0, 2).join('\n\n---\n\n')}`
      : '',
    voice_section: voiceSection,
    voice_style_section: styleSection,
    idea_title: idea.title,
    idea_core_insight: idea.core_insight || '',
    idea_full_context: idea.full_context || '',
    idea_why_post_worthy: idea.why_post_worthy || '',
    idea_content_type: idea.content_type || '',
    knowledge_section: knowledgeSection,
    target_audience: targetAudience || 'B2B professionals, agency owners, and marketers',
  });

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: promptTemplate.model,
    max_tokens: promptTemplate.max_tokens,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseJsonResponse<WrittenPost>(textContent.text);
}

export async function writePost(input: WritePostInput): Promise<WrittenPost> {
  if (input.template) {
    return writePostWithTemplate(input);
  }
  return writePostFreeform(input);
}

export async function writePostWithAutoTemplate(
  input: WritePostInput,
  userId: string
): Promise<WrittenPost & { matchedTemplateId?: string }> {
  // If template already provided, use it directly
  if (input.template) {
    const result = await writePostWithTemplate(input);
    return { ...result, matchedTemplateId: input.template.id };
  }

  // Build topic text for RAG matching
  const topicText = [
    input.idea.title,
    input.idea.core_insight,
    input.idea.full_context,
    input.idea.content_type,
  ]
    .filter(Boolean)
    .join('\n');

  const match = await findBestTemplate(topicText, userId);

  if (match) {
    // Inject template guidance into the freeform prompt via knowledgeContext
    const templateGuidance = buildTemplateGuidance(match);
    const enhancedInput: WritePostInput = {
      ...input,
      knowledgeContext: input.knowledgeContext
        ? `${input.knowledgeContext}\n\n${templateGuidance}`
        : templateGuidance,
    };
    const result = await writePostFreeform(enhancedInput);

    // Increment usage count (fire-and-forget)
    incrementTemplateUsage(match.id).catch(() => {});

    return { ...result, matchedTemplateId: match.id };
  }

  // No match — proceed freeform
  return writePostFreeform(input);
}

async function incrementTemplateUsage(templateId: string): Promise<void> {
  const { createSupabaseAdminClient } = await import('@/lib/utils/supabase-server');
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('cp_increment_template_usage', { template_id: templateId });
}

export async function bulkWritePosts(
  inputs: WritePostInput[]
): Promise<Map<string, WrittenPost | null>> {
  const results = new Map<string, WrittenPost | null>();

  const BATCH_SIZE = 3;
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (input) => {
        try {
          const result = await writePost(input);
          return { ideaId: input.idea.id || input.idea.title, result };
        } catch (error) {
          logError('ai/post-writer', error, { ideaTitle: input.idea.title });
          return { ideaId: input.idea.id || input.idea.title, result: null };
        }
      })
    );

    for (const { ideaId, result } of batchResults) {
      results.set(ideaId, result);
    }
  }

  return results;
}

export async function rewriteSection(
  post: string,
  section: 'hook' | 'body' | 'cta',
  feedback?: string
): Promise<string> {
  const sectionInstructions = {
    hook: 'Rewrite just the opening/hook (first 1-2 sentences) to be more attention-grabbing.',
    body: 'Rewrite the main body while keeping the same hook and CTA.',
    cta: 'Rewrite just the call-to-action at the end to be more engaging.',
  };

  const template = await getPrompt('post-rewrite-section');
  const prompt = interpolatePrompt(template.user_prompt, {
    section_instruction: sectionInstructions[section],
    post_content: post,
    feedback_section: feedback ? `FEEDBACK: ${feedback}` : '',
    style_guidelines: getBaseStyleGuidelines(),
  });

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: template.model,
    max_tokens: template.max_tokens,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return textContent.text.trim();
}
