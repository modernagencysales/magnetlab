/**
 * @jest-environment node
 */

/**
 * Creative Analyzer Tests.
 * Verifies analyzeCreative() returns structured analysis on success
 * and null on error.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: jest.fn(),
  parseJsonResponse: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { analyzeCreative } from '@/lib/ai/content-pipeline/creative-analyzer';
import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';
import { logError } from '@/lib/utils/logger';
import type { CreativeAnalysis } from '@/lib/types/exploits';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRawAnalysis(
  overrides: Partial<CreativeAnalysis & { suggested_exploit_slug: string | null }> = {}
) {
  return {
    creative_type: 'tweet_screenshot',
    topics: ['cold email', 'B2B sales'],
    commentary_worthy_score: 8,
    suggested_hooks: [
      'I saw this tweet and had to comment.',
      '3 cold email mistakes this tweet reveals.',
    ],
    suggested_exploit_slug: 'commentary-on-tweet',
    ...overrides,
  };
}

function setupMocks(rawAnalysis: ReturnType<typeof makeRawAnalysis> = makeRawAnalysis()) {
  const mockCreate = jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(rawAnalysis) }],
  });
  const mockClient = { messages: { create: mockCreate } };

  (getAnthropicClient as jest.Mock).mockReturnValue(mockClient);
  (parseJsonResponse as jest.Mock).mockReturnValue(rawAnalysis);

  return { mockCreate, mockClient };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('analyzeCreative', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('returns a structured CreativeAnalysis on success', async () => {
      setupMocks();

      const result = await analyzeCreative({
        content_text: 'Cold email is dead. Here is why I disagree.',
        source_platform: 'twitter',
        source_url: 'https://x.com/user/status/123',
      });

      expect(result).not.toBeNull();
      expect(result?.creative_type).toBe('tweet_screenshot');
      expect(result?.topics).toEqual(['cold email', 'B2B sales']);
      expect(result?.commentary_worthy_score).toBe(8);
      expect(result?.suggested_hooks).toHaveLength(2);
      expect(result?.suggested_exploit_slug).toBe('commentary-on-tweet');
    });

    it('clamps commentary_worthy_score to 0-10', async () => {
      setupMocks(makeRawAnalysis({ commentary_worthy_score: 15 }));

      const result = await analyzeCreative({
        content_text: 'Some content',
        source_platform: 'linkedin',
      });

      expect(result?.commentary_worthy_score).toBe(10);
    });

    it('clamps score below 0 to 0', async () => {
      setupMocks(makeRawAnalysis({ commentary_worthy_score: -3 }));

      const result = await analyzeCreative({
        content_text: 'Some content',
        source_platform: 'reddit',
      });

      expect(result?.commentary_worthy_score).toBe(0);
    });

    it('falls back to custom for an unrecognised creative_type', async () => {
      setupMocks(makeRawAnalysis({ creative_type: 'unknown_format' } as never));

      const result = await analyzeCreative({
        content_text: 'Some content',
        source_platform: 'manual',
      });

      expect(result?.creative_type).toBe('custom');
    });

    it('returns null suggested_exploit_slug when AI returns null', async () => {
      setupMocks(makeRawAnalysis({ suggested_exploit_slug: null }));

      const result = await analyzeCreative({
        content_text: 'Neutral informational content',
        source_platform: 'other',
      });

      expect(result?.suggested_exploit_slug).toBeNull();
    });

    it('caps topics array at 5 entries', async () => {
      setupMocks(
        makeRawAnalysis({
          topics: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'],
        })
      );

      const result = await analyzeCreative({
        content_text: 'Some content',
        source_platform: 'twitter',
      });

      expect(result?.topics).toHaveLength(5);
    });

    it('caps suggested_hooks array at 3 entries', async () => {
      setupMocks(
        makeRawAnalysis({
          suggested_hooks: ['Hook 1', 'Hook 2', 'Hook 3', 'Hook 4'],
        })
      );

      const result = await analyzeCreative({
        content_text: 'Some content',
        source_platform: 'twitter',
      });

      expect(result?.suggested_hooks).toHaveLength(3);
    });

    it('calls getAnthropicClient with the caller tag', async () => {
      const { mockClient } = setupMocks();

      await analyzeCreative({ content_text: 'test', source_platform: 'twitter' });

      expect(getAnthropicClient).toHaveBeenCalledWith('creative-analyzer');
      expect(mockClient.messages.create).toHaveBeenCalledTimes(1);
    });

    it('works without source_url (optional field)', async () => {
      setupMocks();

      const result = await analyzeCreative({
        content_text: 'Some content without URL',
        source_platform: 'manual',
      });

      expect(result).not.toBeNull();
    });
  });

  describe('error handling', () => {
    it('returns null when the API call throws', async () => {
      (getAnthropicClient as jest.Mock).mockReturnValue({
        messages: {
          create: jest.fn().mockRejectedValue(new Error('Network error')),
        },
      });

      const result = await analyzeCreative({
        content_text: 'Some content',
        source_platform: 'twitter',
      });

      expect(result).toBeNull();
    });

    it('calls logError when the API call throws', async () => {
      const err = new Error('API failure');
      (getAnthropicClient as jest.Mock).mockReturnValue({
        messages: {
          create: jest.fn().mockRejectedValue(err),
        },
      });

      await analyzeCreative({
        content_text: 'Some content',
        source_platform: 'linkedin',
        source_url: 'https://linkedin.com/post/123',
      });

      expect(logError).toHaveBeenCalledWith(
        'ai/creative-analyzer',
        err,
        expect.objectContaining({ source_platform: 'linkedin' })
      );
    });

    it('returns null when JSON parsing fails', async () => {
      (getAnthropicClient as jest.Mock).mockReturnValue({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'not valid json' }],
          }),
        },
      });
      (parseJsonResponse as jest.Mock).mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await analyzeCreative({
        content_text: 'Some content',
        source_platform: 'reddit',
      });

      expect(result).toBeNull();
    });
  });
});
