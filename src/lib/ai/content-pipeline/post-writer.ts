import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import type { PostTemplate, StyleProfile, PostVariation, TeamVoiceProfile } from '@/lib/types/content-pipeline';

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

  const prompt = `You are writing a LinkedIn post. Write the post without any preamble. Your first word is the first word of the post.

${getBaseStyleGuidelines()}
${voiceSection}

Audience: ${targetAudience || 'B2B professionals, agency owners, and marketers'}
What this means for your writing:
- Match technical depth to their sophistication level
- Reference their specific reality and daily frustrations
- Don't write like you're introducing basic concepts
- Use "you" to speak directly to them
- If the post doesn't feel like it was written specifically for this person, rewrite it.

CONTEXT FOR THIS POST:
Title: ${idea.title}
Core Insight: ${idea.core_insight}
Full Context: ${idea.full_context}
Why Post-Worthy: ${idea.why_post_worthy}
Content Type: ${idea.content_type}
${knowledgeSection}
Using this context:
- Pull exact numbers and metrics
- Use the specific stories and examples provided. Do not generalize them.
- Include step-by-step details when a process is described
- Preserve memorable phrasing when it's strong

Post structure by type:
Story/Lesson: Hook with outcome > Setup situation > Mistake/turning point > Consequence > Takeaway
Framework/Process: Hook with result > Why it matters > Numbered steps with specifics
Contrarian/Reframe: Bold claim > What most people do wrong > Why it fails > What to do instead
Trend/Observation: Hook with shift > How it used to work > What changed > What to do

Length: Either SHORT (under 100 words, punchy, one idea) or LONG (300+ words, comprehensive). Pick based on how much substance the idea has.

Now write the post. Return ONLY valid JSON:
{
  "content": "The complete LinkedIn post",
  "variations": [
    {"id": "v1", "content": "Alternative version with different hook", "hook_type": "question|bold_statement|story|statistic", "selected": false},
    {"id": "v2", "content": "Second alternative version", "hook_type": "question|bold_statement|story|statistic", "selected": false}
  ],
  "dm_template": "Short DM (max 200 chars) using {first_name} and [LINK] placeholder",
  "cta_word": "simple keyword like interested, send, link"
}`;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseJsonResponse<WrittenPost>(textContent.text);
}

export async function writePostWithTemplate(input: WritePostInput): Promise<WrittenPost> {
  const { idea, template, targetAudience, knowledgeContext } = input;

  if (!template) {
    throw new Error('Template is required for writePostWithTemplate');
  }

  const knowledgeSection = knowledgeContext
    ? `\nKNOWLEDGE BASE CONTEXT (from your calls):
${knowledgeContext}
Use specific quotes, real numbers, and validated insights from this context.\n`
    : '';

  const prompt = `You are creating a LinkedIn post by combining a template with user-provided information.

TEMPLATE:
${template.structure}

${template.example_posts?.length ? `EXAMPLE POSTS USING THIS TEMPLATE:\n${template.example_posts.slice(0, 2).join('\n\n---\n\n')}` : ''}

CONTEXT FOR THIS POST:
Title: ${idea.title}
Core Insight: ${idea.core_insight}
Full Context: ${idea.full_context}
Why Post-Worthy: ${idea.why_post_worthy}
Content Type: ${idea.content_type}
${knowledgeSection}
Target Audience: ${targetAudience || 'B2B professionals, agency owners, and marketers'}

GUIDELINES:
- Start with a powerful, attention-grabbing hook
- Direct, conversational tone that's authoritative but not arrogant
- Include specific numbers and data points
- Short paragraphs, strategic line breaks
- Adhere strictly to the template format
- No emojis, hashtags, or em dashes
- Avoid cliches

Return ONLY valid JSON:
{
  "content": "The complete LinkedIn post following the template",
  "variations": [
    {"id": "v1", "content": "Alternative version with different hook", "hook_type": "question|bold_statement|story|statistic", "selected": false},
    {"id": "v2", "content": "Second alternative version", "hook_type": "question|bold_statement|story|statistic", "selected": false}
  ],
  "dm_template": "Short DM (max 200 chars) using {first_name} and [LINK] placeholder",
  "cta_word": "simple keyword like interested, send, link"
}`;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 4000,
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
          console.error(`Failed to write post for idea "${input.idea.title}":`, error);
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

  const prompt = `${sectionInstructions[section]}

CURRENT POST:
${post}

${feedback ? `FEEDBACK: ${feedback}` : ''}

${getBaseStyleGuidelines()}

Return ONLY the complete rewritten post (not just the changed section).`;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return textContent.text.trim();
}
