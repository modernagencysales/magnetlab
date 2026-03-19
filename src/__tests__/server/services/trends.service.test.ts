/**
 * @jest-environment node
 */

// ─── Mock external deps (before imports) ────────────────────────────────────

const mockSupabaseClient = {
  from: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import {
  updateTopicCounts,
  getTrendingTopics,
  getTopicSuggestions,
  getStatusCode,
} from '@/server/services/trends.service';

// ─── Chain builder ───────────────────────────────────────────────────────────

/**
 * Fluent Supabase chain mock. Each method returns the chain itself.
 * `then` makes the chain await-able.
 */
function buildChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};

  const resolve = () => Promise.resolve(result);

  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.gte = jest.fn(() => chain);
  chain.lte = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.upsert = jest.fn(resolve);
  chain.insert = jest.fn(() => chain);
  chain.single = jest.fn(resolve);
  chain.maybeSingle = jest.fn(resolve);

  Object.defineProperty(chain, 'then', {
    value: (onFulfilled?: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    enumerable: false,
  });

  return chain;
}

// ─── Test data ───────────────────────────────────────────────────────────────

const USER_ID = 'user-trend-test';

// ─── Tests: updateTopicCounts ─────────────────────────────────────────────────

describe('updateTopicCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates topics from creatives and upserts patterns', async () => {
    const creatives = [
      { topics: ['AI', 'Marketing', 'Lead Gen'], created_at: new Date().toISOString() },
      { topics: ['AI', 'Sales'], created_at: new Date().toISOString() },
      { topics: ['Marketing', 'Content'], created_at: new Date().toISOString() },
    ];

    const upsertChain = buildChain({ data: null, error: null });
    const fetchChain = buildChain({ data: creatives, error: null });

    mockSupabaseClient.from
      .mockImplementationOnce(() => fetchChain) // fetch cp_creatives
      .mockImplementationOnce(() => upsertChain); // upsert cp_performance_patterns

    await updateTopicCounts(USER_ID);

    // Verify upsert was called with aggregated topics
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ pattern_value: 'ai', sample_count: 2 }),
        expect.objectContaining({ pattern_value: 'marketing', sample_count: 2 }),
        expect.objectContaining({ pattern_value: 'lead gen', sample_count: 1 }),
        expect.objectContaining({ pattern_value: 'sales', sample_count: 1 }),
        expect.objectContaining({ pattern_value: 'content', sample_count: 1 }),
      ]),
      expect.objectContaining({ onConflict: 'user_id,pattern_type,pattern_value' })
    );
  });

  it('lowercases topic names during aggregation', async () => {
    const creatives = [
      { topics: ['LinkedIn', 'LINKEDIN', 'linkedin'], created_at: new Date().toISOString() },
    ];

    const upsertChain = buildChain({ data: null, error: null });
    const fetchChain = buildChain({ data: creatives, error: null });

    mockSupabaseClient.from
      .mockImplementationOnce(() => fetchChain)
      .mockImplementationOnce(() => upsertChain);

    await updateTopicCounts(USER_ID);

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ pattern_value: 'linkedin', sample_count: 3 })],
      expect.any(Object)
    );
  });

  it('assigns confidence=low for count < 3', async () => {
    const creatives = [
      { topics: ['Rare Topic'], created_at: new Date().toISOString() },
      { topics: ['Rare Topic'], created_at: new Date().toISOString() },
    ];

    const upsertChain = buildChain({ data: null, error: null });
    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: creatives, error: null }))
      .mockImplementationOnce(() => upsertChain);

    await updateTopicCounts(USER_ID);

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ confidence: 'low', sample_count: 2 })],
      expect.any(Object)
    );
  });

  it('assigns confidence=medium for count 3–10', async () => {
    const creatives = Array.from({ length: 5 }, () => ({
      topics: ['Medium Topic'],
      created_at: new Date().toISOString(),
    }));

    const upsertChain = buildChain({ data: null, error: null });
    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: creatives, error: null }))
      .mockImplementationOnce(() => upsertChain);

    await updateTopicCounts(USER_ID);

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ confidence: 'medium', sample_count: 5 })],
      expect.any(Object)
    );
  });

  it('assigns confidence=high for count > 10', async () => {
    const creatives = Array.from({ length: 11 }, () => ({
      topics: ['Hot Topic'],
      created_at: new Date().toISOString(),
    }));

    const upsertChain = buildChain({ data: null, error: null });
    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: creatives, error: null }))
      .mockImplementationOnce(() => upsertChain);

    await updateTopicCounts(USER_ID);

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ confidence: 'high', sample_count: 11 })],
      expect.any(Object)
    );
  });

  it('does nothing when no creatives exist', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() => buildChain({ data: [], error: null }));

    await updateTopicCounts(USER_ID);

    // Only one DB call (fetch), upsert never called
    expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
  });

  it('does nothing when creatives have empty topic arrays', async () => {
    const creatives = [
      { topics: [], created_at: new Date().toISOString() },
      { topics: null, created_at: new Date().toISOString() },
    ];

    mockSupabaseClient.from.mockImplementationOnce(() =>
      buildChain({ data: creatives, error: null })
    );

    await updateTopicCounts(USER_ID);

    // No upsert — no topics extracted
    expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
  });

  it('sets pattern_type = trending_topic on all rows', async () => {
    const creatives = [{ topics: ['Topic A'], created_at: new Date().toISOString() }];
    const upsertChain = buildChain({ data: null, error: null });

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: creatives, error: null }))
      .mockImplementationOnce(() => upsertChain);

    await updateTopicCounts(USER_ID);

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ pattern_type: 'trending_topic', user_id: USER_ID })],
      expect.any(Object)
    );
  });

  it('throws 500 when fetch fails', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() =>
      buildChain({ data: null, error: { message: 'DB error', code: '500' } })
    );

    await expect(updateTopicCounts(USER_ID)).rejects.toMatchObject({
      message: 'Failed to fetch creatives for trend analysis',
      statusCode: 500,
    });
  });

  it('throws 500 when upsert fails', async () => {
    const creatives = [{ topics: ['Some Topic'], created_at: new Date().toISOString() }];
    const upsertChain = buildChain({
      data: null,
      error: { message: 'Upsert failed', code: '500' },
    });

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: creatives, error: null }))
      .mockImplementationOnce(() => upsertChain);

    await expect(updateTopicCounts(USER_ID)).rejects.toMatchObject({
      message: 'Failed to upsert trending topics',
      statusCode: 500,
    });
  });
});

// ─── Tests: getTrendingTopics ─────────────────────────────────────────────────

describe('getTrendingTopics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns sorted topics by count DESC', async () => {
    const patterns = [
      { pattern_value: 'ai', sample_count: 15, confidence: 'high' },
      { pattern_value: 'marketing', sample_count: 7, confidence: 'medium' },
      { pattern_value: 'cold email', sample_count: 2, confidence: 'low' },
    ];

    mockSupabaseClient.from.mockImplementationOnce(() =>
      buildChain({ data: patterns, error: null })
    );

    const result = await getTrendingTopics(USER_ID);

    expect(result).toHaveLength(3);
    expect(result[0].topic).toBe('ai');
    expect(result[0].count).toBe(15);
    expect(result[0].confidence).toBe('high');
    expect(result[1].topic).toBe('marketing');
    expect(result[2].topic).toBe('cold email');
  });

  it('returns trend=stable for all topics (directional analysis not yet implemented)', async () => {
    const patterns = [{ pattern_value: 'ai', sample_count: 5, confidence: 'medium' }];

    mockSupabaseClient.from.mockImplementationOnce(() =>
      buildChain({ data: patterns, error: null })
    );

    const result = await getTrendingTopics(USER_ID);

    expect(result[0].trend).toBe('stable');
  });

  it('returns empty array when no trending topics exist', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() => buildChain({ data: [], error: null }));

    const result = await getTrendingTopics(USER_ID);

    expect(result).toHaveLength(0);
  });

  it('respects the limit parameter', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() => buildChain({ data: [], error: null }));

    await getTrendingTopics(USER_ID, 5);

    const chain = mockSupabaseClient.from.mock.results[0].value;
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it('defaults to limit=10 when not specified', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() => buildChain({ data: [], error: null }));

    await getTrendingTopics(USER_ID);

    const chain = mockSupabaseClient.from.mock.results[0].value;
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('throws 500 when database query fails', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() =>
      buildChain({ data: null, error: { message: 'DB error', code: '500' } })
    );

    await expect(getTrendingTopics(USER_ID)).rejects.toMatchObject({
      message: 'Failed to fetch trending topics',
      statusCode: 500,
    });
  });

  it('queries only trending_topic pattern_type for this user', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() => buildChain({ data: [], error: null }));

    await getTrendingTopics(USER_ID);

    const chain = mockSupabaseClient.from.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(chain.eq).toHaveBeenCalledWith('pattern_type', 'trending_topic');
  });
});

// ─── Tests: getTopicSuggestions ───────────────────────────────────────────────

describe('getTopicSuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns top 5 topics', async () => {
    const patterns = Array.from({ length: 8 }, (_, i) => ({
      pattern_value: `topic-${i}`,
      sample_count: 10 - i,
      confidence: 'medium',
    }));

    mockSupabaseClient.from.mockImplementationOnce(() =>
      buildChain({ data: patterns.slice(0, 5), error: null })
    );

    const result = await getTopicSuggestions(USER_ID);

    // limit=5 passed to getTrendingTopics
    expect(result.length).toBeLessThanOrEqual(5);
    const chain = mockSupabaseClient.from.mock.results[0].value;
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it('ignores exploitId parameter (future cross-reference stub)', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() => buildChain({ data: [], error: null }));

    // Should not throw
    const result = await getTopicSuggestions(USER_ID, 'some-exploit-id');
    expect(result).toEqual([]);
  });
});

// ─── Tests: getStatusCode ─────────────────────────────────────────────────────

describe('getStatusCode', () => {
  it('extracts statusCode from error object', () => {
    const err = Object.assign(new Error('Not found'), { statusCode: 404 });
    expect(getStatusCode(err)).toBe(404);
  });

  it('returns 500 for plain Error without statusCode', () => {
    expect(getStatusCode(new Error('generic error'))).toBe(500);
  });

  it('returns 500 for null, undefined, and primitives', () => {
    expect(getStatusCode(null)).toBe(500);
    expect(getStatusCode(undefined)).toBe(500);
    expect(getStatusCode('string error')).toBe(500);
    expect(getStatusCode(42)).toBe(500);
  });
});
