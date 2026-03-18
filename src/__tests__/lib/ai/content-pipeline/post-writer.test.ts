/**
 * Post Writer Tests — single writePost() entry point.
 * Verifies template matching is called, no-match fallback works,
 * and deleted exports no longer exist.
 */

import * as postWriterModule from '@/lib/ai/content-pipeline/post-writer';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@/lib/ai/content-pipeline/template-matcher', () => ({
  matchAndRerankTemplates: jest.fn(),
  buildTemplateGuidance: jest.fn(),
}));

jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: jest.fn(),
  parseJsonResponse: jest.fn(),
}));

jest.mock('@/lib/ai/content-pipeline/voice-prompt-builder', () => ({
  buildVoicePromptSection: jest.fn().mockReturnValue(''),
}));

jest.mock('@/lib/services/prompt-registry', () => ({
  getPrompt: jest.fn(),
  interpolatePrompt: jest.fn(),
}));

import {
  matchAndRerankTemplates,
  buildTemplateGuidance,
} from '@/lib/ai/content-pipeline/template-matcher';
import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';
import type { RankedTemplate } from '@/lib/ai/content-pipeline/template-matcher';
import type { WritePostInput, WrittenPost } from '@/lib/ai/content-pipeline/post-writer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEAM_ID = 'team-abc';
const PROFILE_ID = 'profile-xyz';

function makeInput(overrides: Partial<WritePostInput> = {}): WritePostInput {
  return {
    idea: {
      id: 'idea-1',
      title: 'Why cold email still works',
      core_insight: 'Personalization beats volume',
      full_context: 'Based on our recent client results...',
      why_post_worthy: 'Contrarian take that challenges the "email is dead" narrative',
      content_type: 'contrarian',
    },
    targetAudience: 'Agency owners',
    ...overrides,
  };
}

function makeRankedTemplate(id: string): RankedTemplate {
  return {
    id,
    name: 'Hook + Proof + CTA',
    category: 'thought_leadership',
    structure: '[HOOK]\n[PROOF]\n[CTA]',
    example_posts: null,
    use_cases: ['contrarian', 'case_study'],
    similarity: 0.82,
    performance_score: 0.75,
    freshness_bonus: 0.6,
    rerank_score: 0.73,
  };
}

function makeWrittenPost(): WrittenPost {
  return {
    content: 'Cold email is dead. Except it delivered 34 meetings last month for our client.',
    variations: [
      { id: 'v1', content: 'Alt hook version', hook_type: 'bold_statement', selected: false },
    ],
    dm_template: 'Hey {first_name}, sent you something useful — [LINK]',
    cta_word: 'interested',
  };
}

function setupMocks({
  ranked = [] as RankedTemplate[],
  guidanceText = 'STRUCTURAL INSPIRATION: ...',
}: {
  ranked?: RankedTemplate[];
  guidanceText?: string;
} = {}) {
  const mockMessages = {
    create: jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{"content":"post","variations":[],"dm_template":"dm","cta_word":"send"}' }],
    }),
  };
  const mockClient = { messages: mockMessages };

  (matchAndRerankTemplates as jest.Mock).mockResolvedValue(ranked);
  (buildTemplateGuidance as jest.Mock).mockReturnValue(guidanceText);
  (getAnthropicClient as jest.Mock).mockReturnValue(mockClient);
  (getPrompt as jest.Mock).mockResolvedValue({
    user_prompt: 'Write a post about {{idea_title}}',
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
  });
  (interpolatePrompt as jest.Mock).mockReturnValue('Write a post about cold email');
  (parseJsonResponse as jest.Mock).mockReturnValue(makeWrittenPost());

  return { mockClient, mockMessages };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('writePost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls matchAndRerankTemplates with topic text derived from the idea', async () => {
    setupMocks({ ranked: [makeRankedTemplate('tpl-1')] });

    await postWriterModule.writePost(makeInput(), TEAM_ID, PROFILE_ID);

    expect(matchAndRerankTemplates).toHaveBeenCalledTimes(1);
    const [topicText, teamId, profileId, count] = (matchAndRerankTemplates as jest.Mock).mock.calls[0];
    expect(topicText).toContain('Why cold email still works');
    expect(teamId).toBe(TEAM_ID);
    expect(profileId).toBe(PROFILE_ID);
    expect(count).toBe(3);
  });

  it('injects template guidance into the prompt when templates are matched', async () => {
    const ranked = [makeRankedTemplate('tpl-1'), makeRankedTemplate('tpl-2')];
    setupMocks({ ranked, guidanceText: 'STRUCTURAL INSPIRATION: ...' });

    await postWriterModule.writePost(makeInput(), TEAM_ID, PROFILE_ID);

    expect(buildTemplateGuidance).toHaveBeenCalledWith(ranked);

    // interpolatePrompt should receive the merged knowledge section containing guidance
    const interpolateCall = (interpolatePrompt as jest.Mock).mock.calls[0];
    const vars = interpolateCall[1];
    expect(vars.knowledge_section).toContain('STRUCTURAL INSPIRATION');
  });

  it('still calls the LLM when no templates match (zero match fallback)', async () => {
    const { mockMessages } = setupMocks({ ranked: [] });

    const result = await postWriterModule.writePost(makeInput(), TEAM_ID, PROFILE_ID);

    expect(result).toBeDefined();
    expect(result.content).toBeTruthy();
    expect(mockMessages.create).toHaveBeenCalledTimes(1);
    // buildTemplateGuidance should not be called when there are no matches
    expect(buildTemplateGuidance).not.toHaveBeenCalled();
  });

  it('returns matchedTemplateId when templates are found', async () => {
    setupMocks({ ranked: [makeRankedTemplate('tpl-999')] });

    const result = await postWriterModule.writePost(makeInput(), TEAM_ID, PROFILE_ID);

    expect(result.matchedTemplateId).toBe('tpl-999');
  });

  it('returns matchedTemplateId as undefined when no templates match', async () => {
    setupMocks({ ranked: [] });

    const result = await postWriterModule.writePost(makeInput(), TEAM_ID, PROFILE_ID);

    expect(result.matchedTemplateId).toBeUndefined();
  });

  it('merges existing knowledgeContext with template guidance', async () => {
    setupMocks({
      ranked: [makeRankedTemplate('tpl-1')],
      guidanceText: 'STRUCTURAL INSPIRATION: use hook then proof',
    });

    await postWriterModule.writePost(
      makeInput({ knowledgeContext: 'Client said: "3x conversion rate"' }),
      TEAM_ID,
      PROFILE_ID
    );

    const interpolateCall = (interpolatePrompt as jest.Mock).mock.calls[0];
    const vars = interpolateCall[1];
    expect(vars.knowledge_section).toContain('3x conversion rate');
    expect(vars.knowledge_section).toContain('STRUCTURAL INSPIRATION');
  });
});

// ─── Export contract tests ────────────────────────────────────────────────────

describe('export contract', () => {
  it('exports writePost as the single entry point', () => {
    expect(typeof postWriterModule.writePost).toBe('function');
  });

  it('does not export writePostFreeform', () => {
    expect((postWriterModule as Record<string, unknown>).writePostFreeform).toBeUndefined();
  });

  it('does not export writePostWithTemplate', () => {
    expect((postWriterModule as Record<string, unknown>).writePostWithTemplate).toBeUndefined();
  });

  it('does not export writePostWithAutoTemplate', () => {
    expect((postWriterModule as Record<string, unknown>).writePostWithAutoTemplate).toBeUndefined();
  });

  it('still exports bulkWritePosts', () => {
    expect(typeof postWriterModule.bulkWritePosts).toBe('function');
  });

  it('still exports rewriteSection', () => {
    expect(typeof postWriterModule.rewriteSection).toBe('function');
  });
});
