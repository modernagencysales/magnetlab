/**
 * @jest-environment node
 */

// Mock the Anthropic client factory — must come before imports
jest.mock('@/lib/ai/anthropic-client', () => ({
  createAnthropicClient: jest.fn(),
}));

import { analyzePostForCampaign, type AutoSetupInput } from '@/lib/ai/post-campaign/auto-setup';
import { createAnthropicClient } from '@/lib/ai/anthropic-client';

const mockCreateClient = createAnthropicClient as jest.Mock;

// ─── Test Fixtures ──────────────────────────────────────────────────────

const TEAM_PROFILES = [
  { id: 'profile-vlad', name: 'Vlad', unipileAccountId: 'unipile-vlad' },
  { id: 'profile-tim', name: 'Tim', unipileAccountId: 'unipile-tim' },
];

const PUBLISHED_FUNNELS = [
  {
    id: 'funnel-gtm-guide',
    title: 'GTM Guide',
    slug: 'gtm-guide',
    leadMagnetTitle: 'The Ultimate GTM Playbook',
  },
  {
    id: 'funnel-linkedin-tips',
    title: 'LinkedIn Tips',
    slug: 'linkedin-tips',
    leadMagnetTitle: '10 LinkedIn Growth Hacks',
  },
];

function makeInput(overrides?: Partial<AutoSetupInput>): AutoSetupInput {
  return {
    postText: 'Want the ultimate GTM playbook? Comment GTM below and connect with Vlad to get it.',
    publishedFunnels: PUBLISHED_FUNNELS,
    teamProfiles: TEAM_PROFILES,
    posterProfileId: 'unipile-tim',
    ...overrides,
  };
}

describe('auto-setup', () => {
  let mockMessagesCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessagesCreate = jest.fn();
    mockCreateClient.mockReturnValue({
      messages: { create: mockMessagesCreate },
    });
  });

  // ─── Happy Path: Full Match ───────────────────────────────────────────

  it('extracts keyword, delivery account, and funnel for a clear CTA post', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            keyword: 'GTM',
            delivery_person_name: 'Vlad',
            funnel_match_id: 'funnel-gtm-guide',
            funnel_match_name: 'GTM Guide',
          }),
        },
      ],
    });

    const result = await analyzePostForCampaign(makeInput());

    expect(result.keyword).toBe('GTM');
    expect(result.deliveryAccountId).toBe('unipile-vlad');
    expect(result.deliveryAccountName).toBe('Vlad');
    expect(result.funnelPageId).toBe('funnel-gtm-guide');
    expect(result.funnelName).toBe('GTM Guide');
    expect(result.confidence).toBe('high');
    expect(result.needsUserInput).toEqual([]);
    expect(result.posterAccountId).toBe('unipile-tim');
  });

  // ─── Delivery Fallback: No "connect with" ────────────────────────────

  it('uses poster as delivery account when no "connect with X" found', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            keyword: 'GUIDE',
            delivery_person_name: null,
            funnel_match_id: 'funnel-gtm-guide',
            funnel_match_name: 'GTM Guide',
          }),
        },
      ],
    });

    const input = makeInput({
      postText: 'Comment GUIDE below to get the playbook!',
    });
    const result = await analyzePostForCampaign(input);

    expect(result.deliveryAccountId).toBe('unipile-tim');
    expect(result.deliveryAccountName).toBe('Tim');
    expect(result.confidence).toBe('medium');
  });

  // ─── No Funnel Match ─────────────────────────────────────────────────

  it('returns funnelPageId=null and adds to needsUserInput when no funnel matches', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            keyword: 'SALES',
            delivery_person_name: 'Vlad',
            funnel_match_id: null,
            funnel_match_name: null,
          }),
        },
      ],
    });

    const input = makeInput({
      postText: 'Comment SALES below and connect with Vlad for the resource!',
      publishedFunnels: [],
    });
    const result = await analyzePostForCampaign(input);

    expect(result.funnelPageId).toBeNull();
    expect(result.funnelName).toBeNull();
    expect(result.needsUserInput).toContain('funnelPageId');
    expect(result.confidence).toBe('medium');
  });

  // ─── No Keyword ───────────────────────────────────────────────────────

  it('returns low confidence when no keyword is found', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            keyword: '',
            delivery_person_name: null,
            funnel_match_id: null,
            funnel_match_name: null,
          }),
        },
      ],
    });

    const input = makeInput({
      postText: 'Here are my top tips for growing your business...',
    });
    const result = await analyzePostForCampaign(input);

    expect(result.keyword).toBe('');
    expect(result.confidence).toBe('low');
    expect(result.needsUserInput).toContain('keyword');
    expect(result.needsUserInput).toContain('funnelPageId');
  });

  // ─── Templates ────────────────────────────────────────────────────────

  it('generates reply and DM templates with {{name}} and {{funnel_url}} placeholders', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            keyword: 'GTM',
            delivery_person_name: 'Vlad',
            funnel_match_id: 'funnel-gtm-guide',
            funnel_match_name: 'GTM Guide',
          }),
        },
      ],
    });

    const result = await analyzePostForCampaign(makeInput());

    expect(result.replyTemplate).toContain('{{name}}');
    expect(result.dmTemplate).toContain('{{name}}');
    expect(result.dmTemplate).toContain('{{funnel_url}}');
  });

  // ─── Delivery Name Mismatch ───────────────────────────────────────────

  it('falls back to poster when delivery person name does not match any profile', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            keyword: 'GTM',
            delivery_person_name: 'Unknown Person',
            funnel_match_id: 'funnel-gtm-guide',
            funnel_match_name: 'GTM Guide',
          }),
        },
      ],
    });

    const result = await analyzePostForCampaign(makeInput());

    // Falls back to poster (Tim)
    expect(result.deliveryAccountId).toBe('unipile-tim');
    expect(result.deliveryAccountName).toBe('Tim');
  });

  // ─── SDK Parameters ──────────────────────────────────────────────────

  it('passes correct parameters to the Anthropic SDK', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            keyword: 'GTM',
            delivery_person_name: 'Vlad',
            funnel_match_id: 'funnel-gtm-guide',
            funnel_match_name: 'GTM Guide',
          }),
        },
      ],
    });

    await analyzePostForCampaign(makeInput());

    expect(mockCreateClient).toHaveBeenCalledWith('auto-setup');
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-6-20250514');
    expect(callArgs.max_tokens).toBe(1024);
    expect(callArgs.messages[0].role).toBe('user');
    expect(callArgs.messages[0].content).toContain('GTM playbook');
    expect(callArgs.messages[0].content).toContain('funnel-gtm-guide');
    expect(callArgs.messages[0].content).toContain('Vlad');
  });

  // ─── Error Handling ───────────────────────────────────────────────────

  it('throws when API call fails (caller decides error handling)', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('API timeout'));

    await expect(analyzePostForCampaign(makeInput())).rejects.toThrow('API timeout');
  });

  it('handles malformed JSON response gracefully', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json at all' }],
    });

    const result = await analyzePostForCampaign(makeInput());

    // Should still return a result with defaults
    expect(result.keyword).toBe('');
    expect(result.confidence).toBe('low');
    expect(result.needsUserInput).toContain('keyword');
    expect(result.needsUserInput).toContain('funnelPageId');
  });

  it('handles non-text response content', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'test', name: 'test', input: {} }],
    });

    const result = await analyzePostForCampaign(makeInput());

    expect(result.keyword).toBe('');
    expect(result.confidence).toBe('low');
  });

  // ─── Case-Insensitive Name Matching ───────────────────────────────────

  it('matches delivery person name case-insensitively', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            keyword: 'GTM',
            delivery_person_name: 'vlad',
            funnel_match_id: 'funnel-gtm-guide',
            funnel_match_name: 'GTM Guide',
          }),
        },
      ],
    });

    const result = await analyzePostForCampaign(makeInput());

    expect(result.deliveryAccountId).toBe('unipile-vlad');
    expect(result.deliveryAccountName).toBe('Vlad');
  });
});
