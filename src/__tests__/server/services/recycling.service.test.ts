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

const mockGenerateFromPrimitives = jest.fn();
jest.mock('@/lib/ai/content-pipeline/primitives-assembler', () => ({
  generateFromPrimitives: (...args: unknown[]) => mockGenerateFromPrimitives(...args),
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import {
  getUserPerformanceBaseline,
  detectWinners,
  listRecyclablePosts,
  createRepost,
  createCousin,
  runRecyclingLoop,
  getStatusCode,
} from '@/server/services/recycling.service';

// ─── Chain builder ───────────────────────────────────────────────────────────

/**
 * Creates a fluent Supabase chain mock. Each method returns the chain itself.
 * `resolveWith` sets the terminal value for `await chain`.
 * `.single()` and `.maybeSingle()` resolve with the same value.
 */
function buildChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};

  const resolve = () => Promise.resolve(result);

  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.is = jest.fn(() => chain);
  chain.in = jest.fn(() => chain);
  chain.lte = jest.fn(() => chain);
  chain.gte = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.insert = jest.fn(() => chain);
  chain.single = jest.fn(resolve);
  chain.maybeSingle = jest.fn(resolve);

  // Make the chain await-able for queries that don't call single/maybeSingle
  Object.defineProperty(chain, 'then', {
    value: (onFulfilled?: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    enumerable: false,
  });

  return chain;
}

// ─── Test data ───────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';

const MOCK_POST = {
  id: 'post-1',
  user_id: USER_ID,
  draft_content: 'Draft content here',
  final_content: 'Final polished content here',
  status: 'published',
  exploit_id: 'exploit-1',
  creative_id: 'creative-1',
  image_url: null,
  published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
  recycle_after: null,
  engagement_stats: null,
};

const MOCK_EXPLOIT = {
  id: 'exploit-1',
  name: 'Commentary',
  prompt_template: 'Write a commentary post based on: {{creative_text}}',
  example_posts: [],
};

const MOCK_CREATIVE = {
  id: 'creative-1',
  content_text: 'Here is the original creative content',
  image_url: null,
};

// ─── Tests: getUserPerformanceBaseline ───────────────────────────────────────

describe('getUserPerformanceBaseline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns zeros when user has no published posts', async () => {
    mockSupabaseClient.from.mockImplementation(() => buildChain({ data: [], error: null }));

    const result = await getUserPerformanceBaseline(USER_ID);

    expect(result.avgImpressions).toBe(0);
    expect(result.avgEngagementRate).toBe(0);
    expect(result.postCount).toBe(0);
  });

  it('returns zeros when posts exist but no performance data', async () => {
    mockSupabaseClient.from
      .mockImplementationOnce(() =>
        buildChain({ data: [{ id: 'post-1' }, { id: 'post-2' }], error: null })
      )
      .mockImplementationOnce(() => buildChain({ data: [], error: null }));

    const result = await getUserPerformanceBaseline(USER_ID);

    expect(result.avgImpressions).toBe(0);
    expect(result.avgEngagementRate).toBe(0);
    expect(result.postCount).toBe(2);
  });

  it('calculates correct averages from performance data', async () => {
    const perfRows = [
      { post_id: 'post-1', impressions: 1000, engagement_rate: 2.0 },
      { post_id: 'post-2', impressions: 3000, engagement_rate: 4.0 },
    ];

    mockSupabaseClient.from
      .mockImplementationOnce(() =>
        buildChain({ data: [{ id: 'post-1' }, { id: 'post-2' }], error: null })
      )
      .mockImplementationOnce(() => buildChain({ data: perfRows, error: null }));

    const result = await getUserPerformanceBaseline(USER_ID);

    expect(result.avgImpressions).toBe(2000); // (1000 + 3000) / 2
    expect(result.avgEngagementRate).toBe(3.0); // (2.0 + 4.0) / 2
    expect(result.postCount).toBe(2);
  });

  it('throws 500 when posts query fails', async () => {
    mockSupabaseClient.from.mockImplementation(() =>
      buildChain({ data: null, error: { message: 'DB error', code: '500' } })
    );

    await expect(getUserPerformanceBaseline(USER_ID)).rejects.toMatchObject({
      message: 'Failed to fetch posts for baseline',
      statusCode: 500,
    });
  });

  it('throws 500 when performance query fails', async () => {
    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: [{ id: 'post-1' }], error: null }))
      .mockImplementationOnce(() =>
        buildChain({ data: null, error: { message: 'DB error', code: '500' } })
      );

    await expect(getUserPerformanceBaseline(USER_ID)).rejects.toMatchObject({
      message: 'Failed to fetch performance data for baseline',
      statusCode: 500,
    });
  });
});

// ─── Tests: detectWinners ────────────────────────────────────────────────────

describe('detectWinners', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0 when user has no post history (zero baseline)', async () => {
    // getUserPerformanceBaseline: posts → empty, so baseline is zeros
    mockSupabaseClient.from.mockImplementation(() => buildChain({ data: [], error: null }));

    const result = await detectWinners(USER_ID);

    expect(result).toBe(0);
  });

  it('flags posts that exceed 2x impressions and 1.5x engagement thresholds', async () => {
    // Call sequence: baseline posts, baseline perf, candidate posts, candidate perf, update
    const baselinePost = { id: 'base-1' };
    const baselinePerf = [{ post_id: 'base-1', impressions: 1000, engagement_rate: 2.0 }];
    const candidatePost = {
      id: 'winner-1',
      published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const candidatePerf = [
      { post_id: 'winner-1', impressions: 3000, engagement_rate: 4.0 }, // > 2x and > 1.5x
    ];

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: [baselinePost], error: null })) // baseline posts
      .mockImplementationOnce(() => buildChain({ data: baselinePerf, error: null })) // baseline perf
      .mockImplementationOnce(() => buildChain({ data: [candidatePost], error: null })) // candidate posts
      .mockImplementationOnce(() => buildChain({ data: candidatePerf, error: null })) // candidate perf
      .mockImplementationOnce(() => buildChain({ data: null, error: null })); // update

    const result = await detectWinners(USER_ID);

    expect(result).toBe(1);
  });

  it('skips posts that only exceed one threshold', async () => {
    const baselinePost = { id: 'base-1' };
    const baselinePerf = [{ post_id: 'base-1', impressions: 1000, engagement_rate: 2.0 }];
    const candidatePost = {
      id: 'candidate-1',
      published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };
    // High impressions but LOW engagement — should NOT be flagged
    const candidatePerf = [{ post_id: 'candidate-1', impressions: 3000, engagement_rate: 1.0 }];

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: [baselinePost], error: null }))
      .mockImplementationOnce(() => buildChain({ data: baselinePerf, error: null }))
      .mockImplementationOnce(() => buildChain({ data: [candidatePost], error: null }))
      .mockImplementationOnce(() => buildChain({ data: candidatePerf, error: null }));

    const result = await detectWinners(USER_ID);

    expect(result).toBe(0);
  });

  it('skips candidates with no performance data', async () => {
    const baselinePost = { id: 'base-1' };
    const baselinePerf = [{ post_id: 'base-1', impressions: 1000, engagement_rate: 2.0 }];
    const candidatePost = {
      id: 'candidate-1',
      published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: [baselinePost], error: null }))
      .mockImplementationOnce(() => buildChain({ data: baselinePerf, error: null }))
      .mockImplementationOnce(() => buildChain({ data: [candidatePost], error: null }))
      .mockImplementationOnce(() => buildChain({ data: [], error: null })); // no perf data

    const result = await detectWinners(USER_ID);

    expect(result).toBe(0);
  });
});

// ─── Tests: listRecyclablePosts ──────────────────────────────────────────────

describe('listRecyclablePosts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns posts with recycle_after <= now', async () => {
    const recyclablePost = {
      ...MOCK_POST,
      recycle_after: new Date(Date.now() - 1000).toISOString(), // 1 second ago
    };

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: [recyclablePost], error: null }))
      .mockImplementationOnce(() =>
        buildChain({ data: [{ id: 'exploit-1', name: 'Commentary' }], error: null })
      );

    const result = await listRecyclablePosts(USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('post-1');
    expect(result[0].exploit_name).toBe('Commentary');
  });

  it('returns empty array when no posts are due for recycling', async () => {
    mockSupabaseClient.from.mockImplementation(() => buildChain({ data: [], error: null }));

    const result = await listRecyclablePosts(USER_ID);

    expect(result).toHaveLength(0);
  });

  it('sets exploit_name to null when post has no exploit_id', async () => {
    const postWithoutExploit = {
      ...MOCK_POST,
      exploit_id: null,
      recycle_after: new Date(Date.now() - 1000).toISOString(),
    };

    mockSupabaseClient.from.mockImplementation(() =>
      buildChain({ data: [postWithoutExploit], error: null })
    );

    const result = await listRecyclablePosts(USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].exploit_name).toBeNull();
  });

  it('throws 500 when database query fails', async () => {
    mockSupabaseClient.from.mockImplementation(() =>
      buildChain({ data: null, error: { message: 'Connection error', code: '500' } })
    );

    await expect(listRecyclablePosts(USER_ID)).rejects.toMatchObject({
      message: 'Failed to list recyclable posts',
      statusCode: 500,
    });
  });
});

// ─── Tests: createRepost ─────────────────────────────────────────────────────

describe('createRepost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a repost with correct lineage fields and auto-approved status', async () => {
    const insertedRepost = {
      ...MOCK_POST,
      id: 'repost-1',
      parent_post_id: 'post-1',
      lineage_type: 'repost',
      status: 'approved',
      draft_content: MOCK_POST.final_content,
      final_content: MOCK_POST.final_content,
    };

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: MOCK_POST, error: null })) // fetch original
      .mockImplementationOnce(() => buildChain({ data: insertedRepost, error: null })) // insert repost
      .mockImplementationOnce(() => buildChain({ data: null, error: null })); // update original

    const result = await createRepost(USER_ID, 'post-1');

    expect(result.id).toBe('repost-1');
    expect(result.lineage_type).toBe('repost');
    expect(result.status).toBe('approved');
    expect(result.parent_post_id).toBe('post-1');
  });

  it('uses final_content as the repost content (preferred over draft)', async () => {
    const originalWithBoth = {
      ...MOCK_POST,
      draft_content: 'Draft version',
      final_content: 'Final polished version',
    };

    const insertedRepost = {
      ...originalWithBoth,
      id: 'repost-1',
      parent_post_id: 'post-1',
      lineage_type: 'repost',
      status: 'approved',
      draft_content: 'Final polished version',
      final_content: 'Final polished version',
    };

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: originalWithBoth, error: null }))
      .mockImplementationOnce(() => buildChain({ data: insertedRepost, error: null }))
      .mockImplementationOnce(() => buildChain({ data: null, error: null }));

    const result = await createRepost(USER_ID, 'post-1');

    // The repost content should be the final_content
    expect(result.draft_content).toBe('Final polished version');
  });

  it('copies exploit_id and creative_id from original', async () => {
    const insertedRepost = {
      ...MOCK_POST,
      id: 'repost-1',
      parent_post_id: 'post-1',
      lineage_type: 'repost',
      status: 'approved',
    };

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: MOCK_POST, error: null }))
      .mockImplementationOnce(() => buildChain({ data: insertedRepost, error: null }))
      .mockImplementationOnce(() => buildChain({ data: null, error: null }));

    const result = await createRepost(USER_ID, 'post-1');

    expect(result.exploit_id).toBe('exploit-1');
    expect(result.creative_id).toBe('creative-1');
  });

  it('throws 404 when original post not found', async () => {
    mockSupabaseClient.from.mockImplementation(() => buildChain({ data: null, error: null }));

    await expect(createRepost(USER_ID, 'missing-post')).rejects.toMatchObject({
      message: 'Original post not found',
      statusCode: 404,
    });
  });

  it('throws 500 when fetch fails', async () => {
    mockSupabaseClient.from.mockImplementation(() =>
      buildChain({ data: null, error: { message: 'DB error', code: '500' } })
    );

    await expect(createRepost(USER_ID, 'post-1')).rejects.toMatchObject({
      message: 'Failed to fetch original post',
      statusCode: 500,
    });
  });
});

// ─── Tests: createCousin ─────────────────────────────────────────────────────

describe('createCousin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a cousin with draft status and calls generateFromPrimitives', async () => {
    mockGenerateFromPrimitives.mockResolvedValue({
      content: 'A fresh take on the same topic with a new hook',
      hook_used: 'A fresh take on the same topic with a new hook',
    });

    const insertedCousin = {
      ...MOCK_POST,
      id: 'cousin-1',
      parent_post_id: 'post-1',
      lineage_type: 'cousin',
      status: 'draft',
      draft_content: 'A fresh take on the same topic with a new hook',
      final_content: null,
    };

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: MOCK_POST, error: null })) // fetch original
      .mockImplementationOnce(() => buildChain({ data: MOCK_EXPLOIT, error: null })) // fetch exploit
      .mockImplementationOnce(() => buildChain({ data: MOCK_CREATIVE, error: null })) // fetch creative
      .mockImplementationOnce(() => buildChain({ data: insertedCousin, error: null })); // insert cousin

    const result = await createCousin(USER_ID, 'post-1');

    expect(result.id).toBe('cousin-1');
    expect(result.lineage_type).toBe('cousin');
    expect(result.status).toBe('draft');
    expect(result.parent_post_id).toBe('post-1');
    expect(mockGenerateFromPrimitives).toHaveBeenCalledTimes(1);
  });

  it('passes exploit and creative to primitives assembler', async () => {
    mockGenerateFromPrimitives.mockResolvedValue({
      content: 'Generated cousin content',
      hook_used: 'Generated cousin content',
    });

    const insertedCousin = {
      ...MOCK_POST,
      id: 'cousin-1',
      parent_post_id: 'post-1',
      lineage_type: 'cousin',
      status: 'draft',
      draft_content: 'Generated cousin content',
      final_content: null,
    };

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: MOCK_POST, error: null }))
      .mockImplementationOnce(() => buildChain({ data: MOCK_EXPLOIT, error: null }))
      .mockImplementationOnce(() => buildChain({ data: MOCK_CREATIVE, error: null }))
      .mockImplementationOnce(() => buildChain({ data: insertedCousin, error: null }));

    await createCousin(USER_ID, 'post-1');

    expect(mockGenerateFromPrimitives).toHaveBeenCalledWith(
      expect.objectContaining({
        exploit: expect.objectContaining({ name: 'Commentary' }),
        creative: expect.objectContaining({ content_text: MOCK_CREATIVE.content_text }),
        instructions: expect.stringContaining('Do NOT copy the original post'),
      })
    );
  });

  it('falls back to original content when AI generation returns null', async () => {
    mockGenerateFromPrimitives.mockResolvedValue(null);

    const insertedCousin = {
      ...MOCK_POST,
      id: 'cousin-1',
      parent_post_id: 'post-1',
      lineage_type: 'cousin',
      status: 'draft',
      draft_content: MOCK_POST.final_content,
      final_content: null,
    };

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: MOCK_POST, error: null }))
      .mockImplementationOnce(() => buildChain({ data: null, error: null })) // exploit not found
      .mockImplementationOnce(() => buildChain({ data: null, error: null })) // creative not found
      .mockImplementationOnce(() => buildChain({ data: insertedCousin, error: null }));

    const result = await createCousin(USER_ID, 'post-1');

    expect(result.id).toBe('cousin-1');
    // Falls back to original content — no AI result
    expect(result.draft_content).toBe(MOCK_POST.final_content);
  });

  it('throws 404 when original post not found', async () => {
    mockSupabaseClient.from.mockImplementation(() => buildChain({ data: null, error: null }));

    await expect(createCousin(USER_ID, 'missing-post')).rejects.toMatchObject({
      message: 'Original post not found',
      statusCode: 404,
    });
  });

  it('throws 500 when insert fails', async () => {
    mockGenerateFromPrimitives.mockResolvedValue({
      content: 'Generated content',
      hook_used: 'Generated content',
    });

    mockSupabaseClient.from
      .mockImplementationOnce(() => buildChain({ data: MOCK_POST, error: null }))
      .mockImplementationOnce(() => buildChain({ data: MOCK_EXPLOIT, error: null }))
      .mockImplementationOnce(() => buildChain({ data: MOCK_CREATIVE, error: null }))
      .mockImplementationOnce(() =>
        buildChain({ data: null, error: { message: 'DB error', code: '500' } })
      );

    await expect(createCousin(USER_ID, 'post-1')).rejects.toMatchObject({
      message: 'Failed to create cousin post',
      statusCode: 500,
    });
  });
});

// ─── Tests: runRecyclingLoop ─────────────────────────────────────────────────

describe('runRecyclingLoop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns zero counts when no posts are recyclable', async () => {
    mockSupabaseClient.from.mockImplementation(() => buildChain({ data: [], error: null }));

    const result = await runRecyclingLoop(USER_ID);

    expect(result.repostsCreated).toBe(0);
    expect(result.cousinsCreated).toBe(0);
  });

  it('creates one repost and one cousin per recyclable post', async () => {
    const recyclablePost = {
      ...MOCK_POST,
      recycle_after: new Date(Date.now() - 1000).toISOString(),
    };

    mockGenerateFromPrimitives.mockResolvedValue({
      content: 'Cousin content',
      hook_used: 'Cousin content',
    });

    const repost = { ...MOCK_POST, id: 'repost-1', lineage_type: 'repost', status: 'approved' };
    const cousin = { ...MOCK_POST, id: 'cousin-1', lineage_type: 'cousin', status: 'draft' };

    mockSupabaseClient.from
      // listRecyclablePosts: posts query
      .mockImplementationOnce(() => buildChain({ data: [recyclablePost], error: null }))
      // listRecyclablePosts: exploit names query (no exploit_ids to resolve in this test)
      // exploit_id exists so it triggers exploit name lookup
      .mockImplementationOnce(() =>
        buildChain({ data: [{ id: 'exploit-1', name: 'Commentary' }], error: null })
      )
      // createRepost: fetch original
      .mockImplementationOnce(() => buildChain({ data: MOCK_POST, error: null }))
      // createRepost: insert repost
      .mockImplementationOnce(() => buildChain({ data: repost, error: null }))
      // createRepost: update original recycle_after
      .mockImplementationOnce(() => buildChain({ data: null, error: null }))
      // createCousin: fetch original
      .mockImplementationOnce(() => buildChain({ data: MOCK_POST, error: null }))
      // createCousin: fetch exploit
      .mockImplementationOnce(() => buildChain({ data: MOCK_EXPLOIT, error: null }))
      // createCousin: fetch creative
      .mockImplementationOnce(() => buildChain({ data: MOCK_CREATIVE, error: null }))
      // createCousin: insert cousin
      .mockImplementationOnce(() => buildChain({ data: cousin, error: null }));

    const result = await runRecyclingLoop(USER_ID);

    expect(result.repostsCreated).toBe(1);
    expect(result.cousinsCreated).toBe(1);
  });

  it('continues processing other posts even if one repost fails', async () => {
    const recyclablePost = {
      ...MOCK_POST,
      exploit_id: null, // no exploit — simplifies mock setup
      recycle_after: new Date(Date.now() - 1000).toISOString(),
    };

    mockGenerateFromPrimitives.mockResolvedValue({
      content: 'Cousin content',
      hook_used: 'Cousin content',
    });

    const cousin = { ...MOCK_POST, id: 'cousin-1', lineage_type: 'cousin', status: 'draft' };

    mockSupabaseClient.from
      // listRecyclablePosts
      .mockImplementationOnce(() => buildChain({ data: [recyclablePost], error: null }))
      // createRepost: fetch original — returns not-found to trigger error
      .mockImplementationOnce(() => buildChain({ data: null, error: null }))
      // createCousin: fetch original
      .mockImplementationOnce(() =>
        buildChain({ data: { ...MOCK_POST, exploit_id: null, creative_id: null }, error: null })
      )
      // createCousin: insert cousin
      .mockImplementationOnce(() => buildChain({ data: cousin, error: null }));

    const result = await runRecyclingLoop(USER_ID);

    // Repost failed (post not found), cousin succeeded
    expect(result.repostsCreated).toBe(0);
    expect(result.cousinsCreated).toBe(1);
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
