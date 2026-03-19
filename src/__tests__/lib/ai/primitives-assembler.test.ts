/**
 * @jest-environment node
 */

/**
 * Primitives Assembler Tests.
 * buildPromptFromPrimitives: pure function tests (no mocking needed).
 * generateFromPrimitives: mock Anthropic, test success and error paths.
 */

// ─── Mocks (for generateFromPrimitives only) ──────────────────────────────────

jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import {
  buildPromptFromPrimitives,
  generateFromPrimitives,
} from '@/lib/ai/content-pipeline/primitives-assembler';
import type {
  PrimitivesInput,
  ExploitInput,
  CreativeInput,
  KnowledgeInput,
  VoiceInput,
  TemplateInput,
  IdeaInput,
} from '@/lib/ai/content-pipeline/primitives-assembler';
import { getAnthropicClient } from '@/lib/ai/content-pipeline/anthropic-client';
import { logError } from '@/lib/utils/logger';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const exploit: ExploitInput = {
  name: 'Commentary on Tweet',
  prompt_template:
    'Write a LinkedIn post commenting on this tweet: {{creative_text}}\n\nUse this knowledge: {{knowledge_text}}',
  example_posts: ['Example post A', 'Example post B'],
};

const creative: CreativeInput = {
  content_text: 'Cold email is dead. Long live warm outreach.',
  image_url: null,
};

const knowledge: KnowledgeInput[] = [
  { content: 'Cold email generates 34 meetings/month for our clients.' },
  { content: 'Personalization increases reply rates by 3x.' },
];

const voice: VoiceInput = {
  tone: 'Direct and contrarian',
  vocabulary: ['GTM', 'pipeline', 'ICP'],
  banned_phrases: ['game-changer', 'crushing it'],
};

const template: TemplateInput = {
  structure: '[HOOK]\n[PROOF]\n[LESSON]\n[CTA]',
};

const idea: IdeaInput = {
  core_insight: 'Volume without personalization is spam',
  key_points: ['Personalization beats volume', 'Context matters more than copy'],
};

// ─── buildPromptFromPrimitives tests ─────────────────────────────────────────

describe('buildPromptFromPrimitives', () => {
  it('returns a string starting with the base system instruction', () => {
    const prompt = buildPromptFromPrimitives({});
    expect(prompt).toContain('You are a LinkedIn content writer');
  });

  it('replaces {{creative_text}} placeholder in exploit template', () => {
    const prompt = buildPromptFromPrimitives({ exploit, creative });
    expect(prompt).toContain(creative.content_text);
    expect(prompt).not.toContain('{{creative_text}}');
  });

  it('replaces {{knowledge_text}} placeholder in exploit template', () => {
    const prompt = buildPromptFromPrimitives({ exploit, creative, knowledge });
    expect(prompt).not.toContain('{{knowledge_text}}');
    expect(prompt).toContain('Cold email generates 34 meetings');
  });

  it('replaces {{idea_text}} placeholder in exploit template', () => {
    const exploitWithIdea: ExploitInput = {
      ...exploit,
      prompt_template: 'Use this idea: {{idea_text}}',
    };
    const prompt = buildPromptFromPrimitives({ exploit: exploitWithIdea, idea });
    expect(prompt).not.toContain('{{idea_text}}');
    expect(prompt).toContain('Volume without personalization is spam');
  });

  it('includes example posts when exploit is provided', () => {
    const prompt = buildPromptFromPrimitives({ exploit, creative });
    expect(prompt).toContain('Example post A');
    expect(prompt).toContain('Example post B');
  });

  it('includes tone and banned phrases when only voice is provided', () => {
    const prompt = buildPromptFromPrimitives({ voice });
    expect(prompt).toContain('Direct and contrarian');
    expect(prompt).toContain('game-changer');
    expect(prompt).toContain('crushing it');
  });

  it('includes vocabulary in voice section', () => {
    const prompt = buildPromptFromPrimitives({ voice });
    expect(prompt).toContain('GTM');
    expect(prompt).toContain('pipeline');
    expect(prompt).toContain('ICP');
  });

  it('includes template structure when provided', () => {
    const prompt = buildPromptFromPrimitives({ template });
    expect(prompt).toContain('[HOOK]');
    expect(prompt).toContain('[PROOF]');
    expect(prompt).toContain('[CTA]');
  });

  it('includes idea core_insight and key_points (without exploit)', () => {
    const prompt = buildPromptFromPrimitives({ idea });
    expect(prompt).toContain('Volume without personalization is spam');
    expect(prompt).toContain('Personalization beats volume');
    expect(prompt).toContain('Context matters more than copy');
  });

  it('includes hook as opening line instruction', () => {
    const prompt = buildPromptFromPrimitives({ hook: 'I tried cold email for 90 days.' });
    expect(prompt).toContain('I tried cold email for 90 days.');
  });

  it('includes freeform instructions', () => {
    const prompt = buildPromptFromPrimitives({ instructions: 'Keep it under 300 words.' });
    expect(prompt).toContain('Keep it under 300 words.');
  });

  it('builds prompt with exploit + creative (all exploit placeholders replaced)', () => {
    const prompt = buildPromptFromPrimitives({ exploit, creative });
    expect(prompt).toContain('Commentary on Tweet');
    expect(prompt).toContain(creative.content_text);
    expect(prompt).not.toContain('{{creative_text}}');
    expect(prompt).not.toContain('{{knowledge_text}}');
    expect(prompt).not.toContain('{{idea_text}}');
  });

  it('builds prompt with all primitives and contains all sections', () => {
    const input: PrimitivesInput = {
      exploit,
      creative,
      knowledge,
      voice,
      template,
      idea,
      hook: 'I saw this tweet and had to respond.',
      instructions: 'Be concise.',
    };
    const prompt = buildPromptFromPrimitives(input);

    // Base
    expect(prompt).toContain('You are a LinkedIn content writer');
    // Exploit
    expect(prompt).toContain('Commentary on Tweet');
    expect(prompt).toContain('Example post A');
    // Voice
    expect(prompt).toContain('Direct and contrarian');
    expect(prompt).toContain('game-changer');
    // Template
    expect(prompt).toContain('[HOOK]');
    // Hook override
    expect(prompt).toContain('I saw this tweet');
    // Instructions
    expect(prompt).toContain('Be concise.');
    // Closing instruction
    expect(prompt).toContain('Return ONLY the post text');
  });

  it('does not include creative section when exploit is present (exploit owns content injection)', () => {
    const prompt = buildPromptFromPrimitives({ exploit, creative });
    // The SOURCE MATERIAL section header should NOT appear — exploit owns injection
    expect(prompt).not.toContain('SOURCE MATERIAL');
  });

  it('includes standalone creative SOURCE MATERIAL section when no exploit', () => {
    const prompt = buildPromptFromPrimitives({ creative });
    expect(prompt).toContain('SOURCE MATERIAL');
    expect(prompt).toContain(creative.content_text);
  });

  it('ends with the return-only instruction', () => {
    const prompt = buildPromptFromPrimitives({});
    expect(prompt).toContain('Return ONLY the post text');
  });
});

// ─── generateFromPrimitives tests ─────────────────────────────────────────────

describe('generateFromPrimitives', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupSuccessMock(responseText: string) {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: responseText }],
    });
    (getAnthropicClient as jest.Mock).mockReturnValue({
      messages: { create: mockCreate },
    });
    return { mockCreate };
  }

  it('returns a GeneratedPost with content and hook_used on success', async () => {
    const postText = 'I tried cold email for 90 days.\n\nHere is what actually worked.';
    setupSuccessMock(postText);

    const result = await generateFromPrimitives({ creative });

    expect(result).not.toBeNull();
    expect(result?.content).toBe(postText);
    expect(result?.hook_used).toBe('I tried cold email for 90 days.');
  });

  it('uses first line of response as hook_used', async () => {
    setupSuccessMock('First line hook.\nSecond line.\nThird line.');

    const result = await generateFromPrimitives({ idea });

    expect(result?.hook_used).toBe('First line hook.');
  });

  it('calls getAnthropicClient with the primitives-assembler caller tag', async () => {
    setupSuccessMock('A generated post.');

    await generateFromPrimitives({ voice });

    expect(getAnthropicClient).toHaveBeenCalledWith('primitives-assembler');
  });

  it('calls claude-sonnet-4-20250514 with max_tokens 2000', async () => {
    const { mockCreate } = setupSuccessMock('A post.');

    await generateFromPrimitives({});

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-20250514');
    expect(callArgs.max_tokens).toBe(2000);
  });

  it('returns null when the API call throws', async () => {
    (getAnthropicClient as jest.Mock).mockReturnValue({
      messages: {
        create: jest.fn().mockRejectedValue(new Error('Timeout')),
      },
    });

    const result = await generateFromPrimitives({ creative });

    expect(result).toBeNull();
  });

  it('calls logError when the API throws', async () => {
    const err = new Error('API failure');
    (getAnthropicClient as jest.Mock).mockReturnValue({
      messages: { create: jest.fn().mockRejectedValue(err) },
    });

    await generateFromPrimitives({ exploit, creative });

    expect(logError).toHaveBeenCalledWith(
      'ai/primitives-assembler',
      err,
      expect.objectContaining({ hasExploit: true })
    );
  });

  it('returns null when response contains no text content', async () => {
    (getAnthropicClient as jest.Mock).mockReturnValue({
      messages: {
        create: jest.fn().mockResolvedValue({ content: [] }),
      },
    });

    const result = await generateFromPrimitives({ creative });

    expect(result).toBeNull();
  });
});
