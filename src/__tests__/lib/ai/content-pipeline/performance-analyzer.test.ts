/**
 * @jest-environment node
 *
 * Performance Analyzer Tests
 * Covers exploit pattern extraction and biasIdeationPrompt exploit injection.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

const mockSupabase = { from: mockFrom };

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => mockSupabase,
}));

jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: jest.fn().mockReturnValue({
    messages: { create: jest.fn() },
  }),
  parseJsonResponse: jest.fn((text: string) => JSON.parse(text)),
}));

jest.mock('@/lib/ai/content-pipeline/model-config', () => ({
  CLAUDE_SONNET_MODEL: 'claude-sonnet-test',
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  analyzePerformancePatterns,
  getTopPerformingAttributes,
  biasIdeationPrompt,
} from '@/lib/ai/content-pipeline/performance-analyzer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a mockFrom chain that resolves the posts query with empty data. */
function mockEmptyPosts() {
  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ data: [], error: null }),
      }),
    }),
  });
}

/** Returns a mockFrom chain that resolves pattern queries with the given rows. */
function mockPatterns(rows: Array<Record<string, unknown>>) {
  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({ data: rows, error: null }),
      }),
    }),
  });
}

// ─── analyzePerformancePatterns ───────────────────────────────────────────────

describe('analyzePerformancePatterns', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns zero counts when no published posts exist', async () => {
    mockEmptyPosts();
    const result = await analyzePerformancePatterns('user-1');
    expect(result.totalPostsAnalyzed).toBe(0);
    expect(result.patternsCreated).toBe(0);
  });

  it('returns zero counts on DB error for posts query', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    });
    const result = await analyzePerformancePatterns('user-1');
    expect(result.totalPostsAnalyzed).toBe(0);
  });
});

// ─── getTopPerformingAttributes ───────────────────────────────────────────────

describe('getTopPerformingAttributes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty object when no patterns exist', async () => {
    mockPatterns([]);
    const result = await getTopPerformingAttributes('user-1');
    expect(result).toEqual({});
  });

  it('returns empty object on DB error', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({ data: null, error: { message: 'fail' } }),
        }),
      }),
    });
    const result = await getTopPerformingAttributes('user-1');
    expect(result).toEqual({});
  });

  it('groups patterns by pattern_type', async () => {
    mockPatterns([
      {
        pattern_type: 'content_type',
        pattern_value: 'story',
        avg_engagement_rate: 5.0,
        avg_views: 800,
        avg_likes: 30,
        avg_comments: 8,
        sample_count: 10,
        confidence: 'high',
      },
      {
        pattern_type: 'exploit',
        pattern_value: 'tweet-commentary',
        avg_engagement_rate: 8.2,
        avg_views: 1500,
        avg_likes: 60,
        avg_comments: 15,
        sample_count: 6,
        confidence: 'medium',
      },
      {
        pattern_type: 'exploit',
        pattern_value: 'meme-reaction',
        avg_engagement_rate: 3.1,
        avg_views: 400,
        avg_likes: 12,
        avg_comments: 2,
        sample_count: 3,
        confidence: 'low',
      },
    ]);

    const result = await getTopPerformingAttributes('user-1');
    expect(result).toHaveProperty('content_type');
    expect(result).toHaveProperty('exploit');
    expect(result['exploit']).toHaveLength(2);
    expect(result['exploit'][0].value).toBe('tweet-commentary');
  });

  it('returns exploit patterns with the correct TopAttribute shape', async () => {
    mockPatterns([
      {
        pattern_type: 'exploit',
        pattern_value: 'tweet-commentary',
        avg_engagement_rate: '8.2', // PostgREST returns numeric as string
        avg_views: 1500,
        avg_likes: 60,
        avg_comments: 15,
        sample_count: 6,
        confidence: 'medium',
      },
    ]);

    const result = await getTopPerformingAttributes('user-1');
    expect(result['exploit'][0]).toMatchObject({
      attribute: 'exploit',
      value: 'tweet-commentary',
      avgEngagementRate: 8.2,
      avgViews: 1500,
      sampleCount: 6,
      confidence: 'medium',
    });
  });
});

// ─── biasIdeationPrompt ───────────────────────────────────────────────────────

describe('biasIdeationPrompt', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns base prompt unchanged when no patterns exist', async () => {
    mockPatterns([]);
    const result = await biasIdeationPrompt('Write ideas about X', 'user-1');
    expect(result).toBe('Write ideas about X');
  });

  it('returns base prompt unchanged when only low-confidence patterns exist', async () => {
    mockPatterns([
      {
        pattern_type: 'content_type',
        pattern_value: 'story',
        avg_engagement_rate: 2.0,
        avg_views: 100,
        avg_likes: 3,
        avg_comments: 1,
        sample_count: 2,
        confidence: 'low',
      },
    ]);
    const result = await biasIdeationPrompt('Write ideas', 'user-1');
    expect(result).toBe('Write ideas');
  });

  it('prepends PERFORMANCE DATA section for medium/high confidence patterns', async () => {
    mockPatterns([
      {
        pattern_type: 'content_type',
        pattern_value: 'contrarian',
        avg_engagement_rate: 6.5,
        avg_views: 900,
        avg_likes: 40,
        avg_comments: 10,
        sample_count: 8,
        confidence: 'medium',
      },
    ]);
    const result = await biasIdeationPrompt('Write ideas', 'user-1');
    expect(result).toContain('PERFORMANCE DATA');
    expect(result).toContain('contrarian');
    expect(result).toContain('Write ideas');
  });

  it('includes BEST EXPLOIT FORMAT when exploit patterns are medium/high confidence', async () => {
    mockPatterns([
      {
        pattern_type: 'exploit',
        pattern_value: 'tweet-commentary',
        avg_engagement_rate: 9.1,
        avg_views: 2200,
        avg_likes: 80,
        avg_comments: 25,
        sample_count: 7,
        confidence: 'medium',
      },
    ]);
    const result = await biasIdeationPrompt('Generate content ideas', 'user-1');
    expect(result).toContain('BEST EXPLOIT FORMAT');
    expect(result).toContain('tweet-commentary');
  });

  it('includes exploit avg_views in the prompt', async () => {
    mockPatterns([
      {
        pattern_type: 'exploit',
        pattern_value: 'meme-reaction',
        avg_engagement_rate: 7.5,
        avg_views: 3100,
        avg_likes: 90,
        avg_comments: 20,
        sample_count: 5,
        confidence: 'medium',
      },
    ]);
    const result = await biasIdeationPrompt('Generate ideas', 'user-1');
    expect(result).toContain('meme-reaction');
    // avg_views 3100 — toLocaleString() may produce "3,100" or "3100"
    expect(result).toMatch(/3[,.]?100/);
  });

  it('omits BEST EXPLOIT FORMAT when all exploit patterns are low confidence', async () => {
    mockPatterns([
      {
        pattern_type: 'content_type',
        pattern_value: 'story',
        avg_engagement_rate: 5.0,
        avg_views: 700,
        avg_likes: 25,
        avg_comments: 8,
        sample_count: 6,
        confidence: 'high',
      },
      {
        pattern_type: 'exploit',
        pattern_value: 'tweet-commentary',
        avg_engagement_rate: 8.0,
        avg_views: 1000,
        avg_likes: 40,
        avg_comments: 10,
        sample_count: 2,
        confidence: 'low',
      },
    ]);
    const result = await biasIdeationPrompt('Write ideas', 'user-1');
    expect(result).toContain('PERFORMANCE DATA');
    expect(result).not.toContain('BEST EXPLOIT FORMAT');
  });
});
