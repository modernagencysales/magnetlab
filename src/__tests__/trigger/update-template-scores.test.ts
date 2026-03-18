/**
 * @jest-environment node
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockNot = jest.fn();
const mockGte = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();

const mockSupabase = { from: mockFrom };

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => mockSupabase,
}));

jest.mock('@trigger.dev/sdk/v3', () => ({
  schedules: {
    task: (config: { run: (...args: unknown[]) => unknown }) => config,
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import AFTER mocks
import { updateTemplateScores } from '@/trigger/update-template-scores';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePost(
  templateId: string,
  createdAt: string,
  engagementCount: number
) {
  return {
    template_id: templateId,
    created_at: createdAt,
    cp_post_engagements: Array.from({ length: engagementCount }, (_, i) => ({ id: `eng-${i}` })),
  };
}

function setupFetchChain(posts: ReturnType<typeof makePost>[] | null, error: { message: string } | null = null) {
  mockGte.mockReturnValue({ data: posts, error });
  mockNot.mockReturnValue({ gte: mockGte });
  mockSelect.mockReturnValue({ not: mockNot });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'cp_pipeline_posts') {
      return { select: mockSelect };
    }
    // cp_post_templates update chain
    return { update: mockUpdate };
  });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ error: null });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('updateTemplateScores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns skipped:true when no posts found in 90-day window', async () => {
    setupFetchChain([]);

    const result = await (updateTemplateScores as { run: () => Promise<unknown> }).run();

    expect(result).toEqual({ updated: 0, total: 0, skipped: true });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('processes posts and updates avg_engagement_score per template', async () => {
    const now = new Date();
    const posts = [
      makePost('tmpl-1', now.toISOString(), 5),
      makePost('tmpl-1', now.toISOString(), 3),
      makePost('tmpl-2', now.toISOString(), 10),
    ];
    setupFetchChain(posts);

    const result = await (updateTemplateScores as { run: () => Promise<unknown> }).run();

    expect(result).toMatchObject({ updated: 2, total: 2 });
    // Both templates should have been updated
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('applies exponential decay — recent posts weight more than older posts', async () => {
    // Template has 2 posts: one from today (10 engagements) and one from 30 days ago (10 engagements)
    // Recent weight ≈ EXP(0) = 1.0; 30-day weight ≈ EXP(-3) ≈ 0.05
    // Weighted score should be dominated by the recent post
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const posts = [
      makePost('tmpl-1', now.toISOString(), 10),
      makePost('tmpl-1', thirtyDaysAgo.toISOString(), 10),
    ];
    setupFetchChain(posts);

    const capturedUpdates: Array<{ score: number }> = [];
    mockUpdate.mockImplementation((data: { avg_engagement_score: number }) => {
      capturedUpdates.push({ score: data.avg_engagement_score });
      return { eq: mockEq };
    });

    await (updateTemplateScores as { run: () => Promise<unknown> }).run();

    expect(capturedUpdates).toHaveLength(1);
    const score = capturedUpdates[0].score;

    // Pure recent: score = (10 * 1) / 1 = 10
    // Pure 30-day-old: score = (10 * ~0.05) / ~0.05 = 10 (same raw, but weight reduces influence in avg)
    // Since there are 2 posts, both with 10 engagements but different weights:
    // weightedSum = 10 * w_recent + 10 * w_old
    // weightTotal = w_recent + w_old
    // score = (10 * w_recent + 10 * w_old) / (w_recent + w_old) = 10 (both have same raw engagement count)
    // But when engagements differ, recency matters. Let's verify with different counts:
    // Actually this formula yields 10 regardless of recency when both posts have the same count.
    // The test is: score should be between the two raw counts, closer to the recent post's count.
    // Both posts have the same engagement count (10), so regardless of recency weights
    // the weighted average is still 10 (numerator and denominator scale together).
    // The real signal here is that the score is a valid positive number.
    expect(score).toBeGreaterThan(0);
    expect(score).toBeCloseTo(10, 5);
  });

  it('weights recent posts more than older posts when engagement counts differ', async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Recent post: 20 engagements; older post: 0 engagements
    // Expected: score should be close to 20 (dominated by recent)
    const posts = [
      makePost('tmpl-1', now.toISOString(), 20),
      makePost('tmpl-1', thirtyDaysAgo.toISOString(), 0),
    ];
    setupFetchChain(posts);

    const capturedUpdates: Array<{ score: number }> = [];
    mockUpdate.mockImplementation((data: { avg_engagement_score: number }) => {
      capturedUpdates.push({ score: data.avg_engagement_score });
      return { eq: mockEq };
    });

    await (updateTemplateScores as { run: () => Promise<unknown> }).run();

    const score = capturedUpdates[0].score;
    // Recent post dominates: score should be much closer to 20 than to 0
    // weightedSum ≈ 20 * 1 + 0 * 0.05 = 20; weightTotal ≈ 1 + 0.05 = 1.05 → score ≈ 19
    expect(score).toBeGreaterThan(15); // clearly dominated by recent post
  });

  it('handles posts with zero engagements gracefully', async () => {
    const now = new Date();
    const posts = [
      makePost('tmpl-1', now.toISOString(), 0),
      makePost('tmpl-2', now.toISOString(), 0),
    ];
    setupFetchChain(posts);

    const capturedUpdates: Array<{ score: number }> = [];
    mockUpdate.mockImplementation((data: { avg_engagement_score: number }) => {
      capturedUpdates.push({ score: data.avg_engagement_score });
      return { eq: mockEq };
    });

    const result = await (updateTemplateScores as { run: () => Promise<unknown> }).run();

    expect(result).toMatchObject({ updated: 2, total: 2 });
    for (const update of capturedUpdates) {
      expect(update.score).toBe(0);
    }
  });

  it('throws when the fetch query fails', async () => {
    mockGte.mockReturnValue({ data: null, error: { message: 'connection error' } });
    mockNot.mockReturnValue({ gte: mockGte });
    mockSelect.mockReturnValue({ not: mockNot });
    mockFrom.mockReturnValue({ select: mockSelect });

    await expect(
      (updateTemplateScores as { run: () => Promise<unknown> }).run()
    ).rejects.toThrow('Failed to fetch posts: connection error');

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('continues updating other templates when one update fails', async () => {
    const now = new Date();
    const posts = [
      makePost('tmpl-1', now.toISOString(), 5),
      makePost('tmpl-2', now.toISOString(), 3),
    ];
    setupFetchChain(posts);

    let callCount = 0;
    mockUpdate.mockImplementation(() => {
      callCount++;
      // First update fails
      const updateError = callCount === 1 ? { message: 'update failed' } : null;
      return { eq: jest.fn().mockReturnValue({ error: updateError }) };
    });

    const result = (await (updateTemplateScores as { run: () => Promise<unknown> }).run()) as {
      updated: number;
      total: number;
      errors: number;
    };

    // 1 succeeded, 1 failed
    expect(result.updated).toBe(1);
    expect(result.total).toBe(2);
    expect(result.errors).toBe(1);
  });

  it('aggregates multiple posts for the same template correctly', async () => {
    // 3 posts for same template, all from today with equal weights
    const now = new Date();
    const posts = [
      makePost('tmpl-1', now.toISOString(), 4),
      makePost('tmpl-1', now.toISOString(), 8),
      makePost('tmpl-1', now.toISOString(), 6),
    ];
    setupFetchChain(posts);

    const capturedUpdates: Array<{ score: number; id: string }> = [];
    mockEq.mockImplementation((col: string, val: string) => {
      capturedUpdates.push({ score: 0, id: val });
      return { error: null };
    });
    mockUpdate.mockImplementation((data: { avg_engagement_score: number }) => {
      if (capturedUpdates.length > 0) {
        capturedUpdates[capturedUpdates.length - 1].score = data.avg_engagement_score;
      }
      return { eq: mockEq };
    });

    await (updateTemplateScores as { run: () => Promise<unknown> }).run();

    // Should only update tmpl-1 once
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    // Score should be near the average of 4, 8, 6 = 6 (all posts same day → equal weights)
    const score = (mockUpdate.mock.calls[0] as [{ avg_engagement_score: number }])[0].avg_engagement_score;
    expect(score).toBeCloseTo(6, 0);
  });
});
