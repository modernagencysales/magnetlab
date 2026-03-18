/**
 * @jest-environment node
 */
import { executeAction } from '@/lib/actions/executor';
import '@/lib/actions/content';
import type { ActionContext } from '@/lib/actions/types';
import type { DataScope } from '@/lib/utils/team-context';

// ─── Repo mocks ──────────────────────────────────────────────────────────────

jest.mock('@/server/repositories/posts.repo', () => ({
  findPosts: jest.fn().mockResolvedValue([
    { id: 'post-1', draft_content: 'Test content', final_content: null, status: 'draft', scheduled_time: null, hook_score: null },
  ]),
  createPost: jest.fn().mockResolvedValue({
    id: 'post-new', draft_content: 'Written post content', status: 'draft', created_at: '2026-01-01T00:00:00Z',
  }),
  findPostForPolish: jest.fn().mockResolvedValue({
    draft_content: 'Original content', final_content: null, team_profile_id: null,
  }),
  updatePost: jest.fn().mockResolvedValue({ id: 'post-1' }),
}));

// Voice profile lookup — now goes through team.repo
jest.mock('@/server/repositories/team.repo', () => ({
  getDefaultProfile: jest.fn().mockResolvedValue({
    id: 'profile-1', full_name: 'Tim', title: 'CEO', voice_profile: null,
  }),
  getTeamIdByOwnerProfileUserId: jest.fn().mockResolvedValue('team-personal'),
}));

jest.mock('@/lib/ai/content-pipeline/post-writer', () => ({
  writePost: jest.fn().mockResolvedValue({
    content: 'Written post content',
    variations: [{ content: 'Variation 1' }],
    dm_template: 'DM template',
    cta_word: 'comment',
  }),
}));

jest.mock('@/lib/ai/content-pipeline/post-polish', () => ({
  polishPost: jest.fn().mockResolvedValue({
    original: 'Original', polished: 'Polished', changes: ['Fixed hook'], hookScore: 8,
  }),
}));

jest.mock('@/lib/ai/content-pipeline/briefing-agent', () => ({
  buildContentBrief: jest.fn().mockResolvedValue({
    topic: 'pricing', compiledContext: 'Context', suggestedAngles: [], topicReadiness: 0.8,
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const userScope: DataScope = { type: 'user', userId: 'user-1' };
const teamScope: DataScope = { type: 'team', userId: 'user-1', teamId: 'team-1' };

const ctxUser: ActionContext = { scope: userScope };
const ctxTeam: ActionContext = { scope: teamScope };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Content Actions', () => {
  describe('write_post', () => {
    it('generates and persists a post (user scope)', async () => {
      const result = await executeAction(ctxUser, 'write_post', { topic: 'pricing objections' });
      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('post_preview');
    });

    it('passes teamId to buildContentBrief (team scope)', async () => {
      const { buildContentBrief } = jest.requireMock('@/lib/ai/content-pipeline/briefing-agent');
      await executeAction(ctxTeam, 'write_post', { topic: 'pricing' });
      expect(buildContentBrief).toHaveBeenCalledWith('user-1', 'pricing', expect.objectContaining({ teamId: 'team-1' }));
    });

    it('uses createPost repo to persist the post', async () => {
      const { createPost } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxUser, 'write_post', { topic: 'pricing' });
      expect(createPost).toHaveBeenCalledWith('user-1', expect.objectContaining({ status: 'draft' }));
    });
  });

  describe('polish_post', () => {
    it('polishes existing post via repo', async () => {
      const result = await executeAction(ctxUser, 'polish_post', { post_id: 'post-1' });
      expect(result.success).toBe(true);
      expect((result.data as { polished: string }).polished).toBe('Polished');
    });

    it('calls findPostForPolish with userId from scope', async () => {
      const { findPostForPolish } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxUser, 'polish_post', { post_id: 'post-1' });
      expect(findPostForPolish).toHaveBeenCalledWith('user-1', 'post-1');
    });

    it('calls updatePost to save polished content', async () => {
      const { updatePost } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxUser, 'polish_post', { post_id: 'post-1' });
      expect(updatePost).toHaveBeenCalledWith('user-1', 'post-1', expect.objectContaining({ polish_status: 'polished' }));
    });

    it('returns error when post not found', async () => {
      const { findPostForPolish } = jest.requireMock('@/server/repositories/posts.repo');
      findPostForPolish.mockResolvedValueOnce(null);
      const result = await executeAction(ctxUser, 'polish_post', { post_id: 'missing' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Post not found');
    });
  });

  describe('list_posts', () => {
    it('returns posts via repo (user scope)', async () => {
      const result = await executeAction(ctxUser, 'list_posts', { status: 'draft' });
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('passes scope to findPosts', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxUser, 'list_posts', { status: 'draft', limit: 5 });
      expect(findPosts).toHaveBeenCalledWith(userScope, { status: 'draft', limit: 5 });
    });

    it('passes team scope to findPosts for team context', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxTeam, 'list_posts', {});
      expect(findPosts).toHaveBeenCalledWith(teamScope, expect.any(Object));
    });

    it('returns formatted content_preview', async () => {
      const result = await executeAction(ctxUser, 'list_posts', {});
      const data = result.data as Array<{ id: string; content_preview: string }>;
      expect(data[0].content_preview).toBe('Test content');
    });
  });

  describe('update_post_content', () => {
    it('updates content via repo', async () => {
      const result = await executeAction(ctxUser, 'update_post_content', { post_id: 'post-1', content: 'New content' });
      expect(result.success).toBe(true);
    });

    it('calls updatePost with userId from scope', async () => {
      const { updatePost } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(ctxUser, 'update_post_content', { post_id: 'post-1', content: 'New content' });
      expect(updatePost).toHaveBeenCalledWith('user-1', 'post-1', expect.objectContaining({ draft_content: 'New content' }));
    });

    it('returns error when updatePost throws', async () => {
      const { updatePost } = jest.requireMock('@/server/repositories/posts.repo');
      updatePost.mockRejectedValueOnce(new Error('DB error'));
      const result = await executeAction(ctxUser, 'update_post_content', { post_id: 'post-1', content: 'x' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });
});
