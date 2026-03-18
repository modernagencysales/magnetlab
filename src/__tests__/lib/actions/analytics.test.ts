/**
 * @jest-environment node
 */
import { executeAction } from '@/lib/actions/executor';
import '@/lib/actions/analytics';
import type { ActionContext } from '@/lib/actions/types';
import type { DataScope } from '@/lib/utils/team-context';

// ─── Repo mocks ──────────────────────────────────────────────────────────────

// jest.mock is hoisted — mock data must be provided via beforeEach, not inline
jest.mock('@/server/repositories/posts.repo', () => ({
  findPosts: jest.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const userScope: DataScope = { type: 'user', userId: 'user-1' };
const teamScope: DataScope = { type: 'team', userId: 'user-1', teamId: 'team-1' };

const ctxUser: ActionContext = { scope: userScope };
const ctxTeam: ActionContext = { scope: teamScope };

const defaultMockPosts = [
  {
    id: 'post-1',
    draft_content: 'Draft content',
    final_content: 'Final content for post 1',
    status: 'published',
    engagement_stats: { likes: 50, comments: 10, shares: 5, impressions: 1000 },
    published_at: '2026-01-10T12:00:00Z',
  },
  {
    id: 'post-2',
    draft_content: 'Another post',
    final_content: null,
    status: 'published',
    engagement_stats: { likes: 100, comments: 20, shares: 15, impressions: 2000 },
    published_at: '2026-01-12T12:00:00Z',
  },
  {
    id: 'post-3',
    draft_content: 'No stats post',
    final_content: null,
    status: 'draft',
    engagement_stats: null,
    published_at: null,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Analytics Actions', () => {
  beforeEach(() => {
    const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
    findPosts.mockResolvedValue(defaultMockPosts);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get_post_performance', () => {
    it('returns posts with engagement stats', async () => {
      const result = await executeAction(ctxUser, 'get_post_performance', {});
      expect(result.success).toBe(true);
      const data = result.data as Array<{ id: string; engagement_stats: unknown }>;
      // post-3 has null engagement_stats and should be filtered out
      expect(data.every((p) => p.engagement_stats != null)).toBe(true);
    });

    it('passes scope to findPosts', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxUser, 'get_post_performance', { limit: 5 });
      expect(findPosts).toHaveBeenCalledWith(userScope, { limit: 5 });
    });

    it('passes team scope to findPosts', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxTeam, 'get_post_performance', {});
      expect(findPosts).toHaveBeenCalledWith(teamScope, expect.any(Object));
    });

    it('returns content_preview truncated to 100 chars', async () => {
      const result = await executeAction(ctxUser, 'get_post_performance', {});
      const data = result.data as Array<{ content_preview: string }>;
      expect(data.every((p) => p.content_preview.length <= 100)).toBe(true);
    });

    it('uses default limit of 10 when not specified', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxUser, 'get_post_performance', {});
      expect(findPosts).toHaveBeenCalledWith(userScope, { limit: 10 });
    });
  });

  describe('get_top_posts', () => {
    it('returns published posts sorted by total engagement', async () => {
      const result = await executeAction(ctxUser, 'get_top_posts', { limit: 2 });
      expect(result.success).toBe(true);
      const data = result.data as Array<{ id: string; engagement_stats: Record<string, number> }>;
      // post-2 has higher engagement (100+20+15+2000=2135) vs post-1 (50+10+5+1000=1065)
      expect(data[0].id).toBe('post-2');
    });

    it('filters to published posts via repo', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxUser, 'get_top_posts', {});
      expect(findPosts).toHaveBeenCalledWith(userScope, { status: 'published', limit: 100 });
    });

    it('respects limit param', async () => {
      const result = await executeAction(ctxUser, 'get_top_posts', { limit: 1 });
      const data = result.data as Array<unknown>;
      expect(data.length).toBeLessThanOrEqual(1);
    });

    it('passes team scope to findPosts', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxTeam, 'get_top_posts', {});
      expect(findPosts).toHaveBeenCalledWith(teamScope, expect.any(Object));
    });

    it('excludes posts with null engagement_stats', async () => {
      const result = await executeAction(ctxUser, 'get_top_posts', {});
      const data = result.data as Array<{ id: string }>;
      expect(data.some((p) => p.id === 'post-3')).toBe(false);
    });
  });
});
