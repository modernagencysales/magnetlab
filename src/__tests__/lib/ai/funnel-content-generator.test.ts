/**
 * @jest-environment node
 */

// ─── Mock Anthropic client ──────────────────────────────────────────

const mockMessagesCreate = jest.fn();

jest.mock('@/lib/ai/anthropic-client', () => ({
  createAnthropicClient: () => ({
    messages: { create: mockMessagesCreate },
  }),
}));

import {
  generateOptinContent,
  generateDefaultOptinContent,
} from '@/lib/ai/funnel-content-generator';
import type { GenerateOptinContentInput, BrainContext } from '@/lib/ai/funnel-content-generator';

// ─── Test data ───────────────────────────────────────────────────────

const BASE_INPUT: GenerateOptinContentInput = {
  leadMagnetTitle: 'Cold Email Checklist',
  concept: {
    painSolved: 'Stop landing in spam',
    deliveryFormat: 'checklist',
    contents: 'Step-by-step cold email guide',
    whyNowHook: 'Deliverability is getting harder',
  },
  extractedContent: null,
};

const BRAIN_POSITION: BrainContext = {
  thesis: 'Cold email works but requires proper infrastructure.',
  key_arguments: ['Infrastructure > copy', 'Multi-channel is essential'],
  unique_data_points: [{ claim: '1,500 emails, 3% reply rate', evidence_strength: 'measured' }],
  stories: [
    {
      hook: 'We burned $2K on Instantly',
      arc: 'Switched to PlusVibe',
      lesson: 'Infrastructure matters',
    },
  ],
  differentiators: ['Focuses on deliverability, not templates'],
  voice_markers: ['infrastructure matters more than copy'],
  specific_recommendations: [
    { recommendation: 'Use PlusVibe', reasoning: 'Better deliverability' },
  ],
};

const VALID_RESPONSE = JSON.stringify({
  headline: 'Why Your Cold Emails Land in Spam',
  subline:
    'The infrastructure fix that generated 33 positive replies from 1,500 cold emails last week.',
  socialProof: null,
  buttonText: 'Get the Checklist',
  thankyouSubline: 'Next: the multi-channel system behind our GTM pipeline.',
});

function mockAIResponse(json: string) {
  mockMessagesCreate.mockResolvedValue({
    content: [{ type: 'text', text: json }],
  });
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('generateOptinContent — brain context in prompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes brain position in prompt when provided', async () => {
    mockAIResponse(VALID_RESPONSE);

    await generateOptinContent({ ...BASE_INPUT, brainPosition: BRAIN_POSITION });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("CREATOR'S REAL EXPERTISE");
    expect(prompt).toContain('Cold email works but requires proper infrastructure.');
    expect(prompt).toContain('Focuses on deliverability, not templates');
    expect(prompt).toContain('1,500 emails, 3% reply rate');
    expect(prompt).toContain('We burned $2K on Instantly');
    expect(prompt).toContain('infrastructure matters more than copy');
  });

  it('includes brain entries in prompt when provided', async () => {
    mockAIResponse(VALID_RESPONSE);

    await generateOptinContent({
      ...BASE_INPUT,
      brainEntries: [
        {
          content: 'PlusVibe deliverability is 3x better',
          knowledge_type: 'insight',
          quality_score: 4,
        },
      ],
    });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('SPECIFIC KNOWLEDGE');
    expect(prompt).toContain('PlusVibe deliverability is 3x better');
    expect(prompt).toContain('[insight]');
  });

  it('includes brain rules when brain data is provided', async () => {
    mockAIResponse(VALID_RESPONSE);

    await generateOptinContent({ ...BASE_INPUT, brainPosition: BRAIN_POSITION });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('BRAIN DATA RULES');
    expect(prompt).toContain('DIRECTLY relevant');
    expect(prompt).toContain('NEVER fabricate');
    expect(prompt).toContain('different topic, IGNORE');
  });

  it('does NOT include brain sections when no brain data provided', async () => {
    mockAIResponse(VALID_RESPONSE);

    await generateOptinContent(BASE_INPUT);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain("CREATOR'S REAL EXPERTISE");
    expect(prompt).not.toContain('BRAIN DATA RULES');
    expect(prompt).not.toContain('SPECIFIC KNOWLEDGE');
  });

  it('allows socialProof to be null in response', async () => {
    mockAIResponse(VALID_RESPONSE);

    const result = await generateOptinContent({ ...BASE_INPUT, brainPosition: BRAIN_POSITION });

    expect(result.socialProof).toBeNull();
    expect(result.headline).toBe('Why Your Cold Emails Land in Spam');
  });

  it('returns thankyouSubline when AI provides it', async () => {
    mockAIResponse(VALID_RESPONSE);

    const result = await generateOptinContent({ ...BASE_INPUT, brainPosition: BRAIN_POSITION });

    expect(result.thankyouSubline).toBe('Next: the multi-channel system behind our GTM pipeline.');
  });

  it('returns null thankyouSubline when AI omits it', async () => {
    mockAIResponse(
      JSON.stringify({
        headline: 'Test',
        subline: 'Test subline',
        socialProof: 'Real stat',
        buttonText: 'Get It',
      })
    );

    const result = await generateOptinContent(BASE_INPUT);

    expect(result.thankyouSubline).toBeNull();
  });

  it('limits data points to 3 and entries to 5', async () => {
    mockAIResponse(VALID_RESPONSE);

    const manyDataPoints = Array.from({ length: 10 }, (_, i) => ({
      claim: `Data point ${i}`,
      evidence_strength: 'measured',
    }));
    const manyEntries = Array.from({ length: 10 }, (_, i) => ({
      content: `Entry ${i}`,
      knowledge_type: 'insight',
      quality_score: 4,
    }));

    await generateOptinContent({
      ...BASE_INPUT,
      brainPosition: { ...BRAIN_POSITION, unique_data_points: manyDataPoints },
      brainEntries: manyEntries,
    });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Data point 2');
    expect(prompt).not.toContain('Data point 3');
    expect(prompt).toContain('Entry 4');
    expect(prompt).not.toContain('Entry 5');
  });
});

describe('generateDefaultOptinContent', () => {
  it('returns null socialProof (never fabricated)', () => {
    const result = generateDefaultOptinContent('Test LM');
    expect(result.socialProof).toBeNull();
    expect(result.buttonText).toBe('Get Free Access');
  });
});
