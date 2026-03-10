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
  generateDefaultEmailSequence,
  generateEmailSequence,
} from '@/lib/ai/email-sequence-generator';
import type { EmailGenerationContext } from '@/lib/types/email';

// ─── Test data ───────────────────────────────────────────────────────

const BASE_CONTEXT: EmailGenerationContext = {
  leadMagnetTitle: 'Cold Email Checklist',
  leadMagnetFormat: 'checklist',
  leadMagnetContents: 'Step-by-step cold email guide',
  senderName: 'Tim',
  businessDescription: 'B2B growth agency',
  audienceStyle: 'casual-direct',
};

const BRAIN_POSITION: EmailGenerationContext['brainPosition'] = {
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
  coverage_gaps: ['No warm-up benchmarks'],
};

const BRAIN_ENTRIES: EmailGenerationContext['brainEntries'] = [
  { content: 'PlusVibe deliverability is 3x better', knowledge_type: 'insight', quality_score: 4 },
  { content: 'Warm-up pools need 14 days minimum', knowledge_type: 'how_to', quality_score: 3 },
];

const VALID_EMAILS_JSON = JSON.stringify([
  { day: 0, subject: 'your checklist', body: 'Here it is {{first_name}}', replyTrigger: 'Got it?' },
  {
    day: 1,
    subject: 'a surprising truth',
    body: 'Infrastructure > copy',
    replyTrigger: 'Thoughts?',
  },
  {
    day: 2,
    subject: 'real numbers',
    body: '1,500 emails, 3% reply rate',
    replyTrigger: 'Tried this?',
  },
  {
    day: 3,
    subject: 'costly mistake',
    body: 'We burned $2K on Instantly',
    replyTrigger: 'Sound familiar?',
  },
  {
    day: 4,
    subject: 'the bigger picture',
    body: 'Infrastructure matters',
    replyTrigger: 'Topics?',
  },
]);

function mockAIResponse(json: string) {
  mockMessagesCreate.mockResolvedValue({
    content: [{ type: 'text', text: json }],
  });
}

// ─── Brain context tests ─────────────────────────────────────────────

describe('generateEmailSequence — brain context in prompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes brain position data in prompt when provided', async () => {
    mockAIResponse(VALID_EMAILS_JSON);

    await generateEmailSequence({
      context: { ...BASE_CONTEXT, brainPosition: BRAIN_POSITION },
    });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('YOUR EXPERTISE');
    expect(prompt).toContain('Cold email works but requires proper infrastructure.');
    expect(prompt).toContain('Infrastructure > copy');
    expect(prompt).toContain('1,500 emails, 3% reply rate');
    expect(prompt).toContain('We burned $2K on Instantly');
    expect(prompt).toContain('Focuses on deliverability, not templates');
    expect(prompt).toContain('infrastructure matters more than copy');
    expect(prompt).toContain('Use PlusVibe');
  });

  it('includes brain entries in prompt when provided', async () => {
    mockAIResponse(VALID_EMAILS_JSON);

    await generateEmailSequence({
      context: { ...BASE_CONTEXT, brainEntries: BRAIN_ENTRIES },
    });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('SPECIFIC INSIGHTS FROM KNOWLEDGE BASE');
    expect(prompt).toContain('PlusVibe deliverability is 3x better');
    expect(prompt).toContain('[insight]');
    expect(prompt).toContain('[how_to]');
  });

  it('includes brain-enriched email structure override when position present', async () => {
    mockAIResponse(VALID_EMAILS_JSON);

    await generateEmailSequence({
      context: { ...BASE_CONTEXT, brainPosition: BRAIN_POSITION },
    });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('BRAIN-ENRICHED EMAIL STRUCTURE');
    expect(prompt).toContain('most compelling differentiator');
    expect(prompt).toContain('contrarian or surprising insight');
    expect(prompt).toContain('real numbers and recommendations');
    expect(prompt).toContain('common mistake');
    expect(prompt).toContain('broader thesis/framework');
  });

  it('does NOT include brain sections when no brain data provided', async () => {
    mockAIResponse(VALID_EMAILS_JSON);

    await generateEmailSequence({ context: BASE_CONTEXT });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('YOUR EXPERTISE');
    expect(prompt).not.toContain('BRAIN-ENRICHED EMAIL STRUCTURE');
    expect(prompt).not.toContain('SPECIFIC INSIGHTS FROM KNOWLEDGE BASE');
  });

  it('limits data points to 5 and stories to 3', async () => {
    mockAIResponse(VALID_EMAILS_JSON);

    const manyDataPoints = Array.from({ length: 10 }, (_, i) => ({
      claim: `Data point ${i}`,
      evidence_strength: 'measured',
    }));
    const manyStories = Array.from({ length: 5 }, (_, i) => ({
      hook: `Hook ${i}`,
      arc: `Arc ${i}`,
      lesson: `Lesson ${i}`,
    }));

    await generateEmailSequence({
      context: {
        ...BASE_CONTEXT,
        brainPosition: {
          ...BRAIN_POSITION,
          unique_data_points: manyDataPoints,
          stories: manyStories,
        },
      },
    });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Data point 4');
    expect(prompt).not.toContain('Data point 5');
    expect(prompt).toContain('Hook 2');
    expect(prompt).not.toContain('Hook 3');
  });
});

// ─── Default sequence tests ──────────────────────────────────────────

describe('generateDefaultEmailSequence', () => {
  it('uses [DOWNLOAD LINK] placeholder when no resourceUrl provided', () => {
    const emails = generateDefaultEmailSequence('Test Lead Magnet', 'John');
    const email1 = emails.find((e) => e.day === 0);
    expect(email1).toBeDefined();
    expect(email1!.body).toContain('[DOWNLOAD LINK]');
    expect(email1!.body).not.toContain('https://');
  });

  it('replaces [DOWNLOAD LINK] with actual URL when resourceUrl provided', () => {
    const url = 'https://www.magnetlab.app/p/john/test-slug/content';
    const emails = generateDefaultEmailSequence('Test Lead Magnet', 'John', url);
    const email1 = emails.find((e) => e.day === 0);
    expect(email1).toBeDefined();
    expect(email1!.body).not.toContain('[DOWNLOAD LINK]');
    expect(email1!.body).toContain(url);
  });

  it('returns 5 emails with correct days', () => {
    const emails = generateDefaultEmailSequence('Test', 'Jane');
    expect(emails).toHaveLength(5);
    expect(emails.map((e) => e.day)).toEqual([0, 1, 2, 3, 4]);
  });

  it('uses external URL when provided as resourceUrl', () => {
    const externalUrl = 'https://notion.so/my-resource';
    const emails = generateDefaultEmailSequence('Test', 'Jane', externalUrl);
    const email1 = emails.find((e) => e.day === 0);
    expect(email1!.body).toContain(externalUrl);
  });
});
