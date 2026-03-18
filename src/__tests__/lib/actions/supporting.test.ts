/**
 * @jest-environment node
 */

// Helper to create a thenable Supabase query chain mock
function createChain(resolveData: unknown = []) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['select', 'insert', 'update', 'eq', 'not', 'is', 'neq', 'order', 'limit', 'or', 'range', 'gte', 'contains'];
  methods.forEach(m => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue({ data: resolveData, error: null });
  // Make the chain thenable for queries that don't end with .single()
  (chain as unknown as PromiseLike<{ data: unknown; error: null }>).then = jest.fn(
    (resolve: (value: { data: unknown; error: null }) => unknown) =>
      resolve({ data: Array.isArray(resolveData) ? resolveData : [resolveData], error: null })
  ) as jest.Mock;
  return chain;
}

// Use a stable reference that can be reassigned before jest.mock hoisting
const mockState = { fromFn: jest.fn(() => createChain()) };

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: (table: string) => mockState.fromFn(table),
  })),
}));

// ─── Repo mocks (for analytics + scheduling actions) ─────────────────────────

jest.mock('@/server/repositories/posts.repo', () => ({
  findPosts: jest.fn().mockResolvedValue([]),
  createPost: jest.fn().mockResolvedValue({ id: 'post-new', status: 'draft' }),
  findPostForPolish: jest.fn().mockResolvedValue({ draft_content: 'content', final_content: null }),
  updatePost: jest.fn().mockResolvedValue({ id: 'post-1' }),
}));

jest.mock('@/server/repositories/cp-schedule-slots.repo', () => ({
  listSlots: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

jest.mock('@/server/repositories/cp-team-schedule.repo', () => ({
  getActiveProfiles: jest.fn().mockResolvedValue({ data: [], error: null }),
  getSlots: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

// Mock knowledge-brain and briefing-agent so knowledge.ts import succeeds
jest.mock('@/lib/services/knowledge-brain', () => ({
  searchKnowledgeV2: jest.fn().mockResolvedValue([]),
  listKnowledgeTopics: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/ai/content-pipeline/briefing-agent', () => ({
  buildContentBrief: jest.fn().mockResolvedValue({ compiledContext: '' }),
}));

jest.mock('@/lib/ai/content-pipeline/post-writer', () => ({
  writePost: jest.fn().mockResolvedValue({ content: '', variations: [] }),
}));

jest.mock('@/lib/ai/content-pipeline/post-polish', () => ({
  polishPost: jest.fn().mockResolvedValue({ original: '', polished: '', changes: [], hookScore: 0 }),
}));

import { executeAction, actionRequiresConfirmation } from '@/lib/actions/executor';
import type { ActionContext } from '@/lib/actions/types';

// Import all action modules to trigger registration
import '@/lib/actions/templates';
import '@/lib/actions/analytics';
import '@/lib/actions/scheduling';
import '@/lib/actions/knowledge';
import '@/lib/actions/content';

const testCtx: ActionContext = {
  scope: { type: 'team', userId: 'user-test-123', teamId: 'team-test-456' },
};

describe('Template Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.fromFn = jest.fn(() => createChain());
  });

  describe('list_templates', () => {
    it('returns templates array with expected shape', async () => {
      // Correct column names: category (not content_type), example_posts (not example_post)
      const mockTemplates = [
        { id: 't1', name: 'Contrarian Take', description: 'Challenge conventional wisdom', category: 'contrarian', example_posts: ['Example...'] },
        { id: 't2', name: 'Story Arc', description: 'Personal narrative', category: 'personal_story', example_posts: ['Once upon...'] },
      ];

      mockState.fromFn.mockReturnValueOnce(createChain(mockTemplates));

      const result = await executeAction(testCtx, 'list_templates', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('returns empty array when no templates exist', async () => {
      mockState.fromFn.mockReturnValueOnce(createChain([]));

      const result = await executeAction(testCtx, 'list_templates', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('limits results via client-side slice', async () => {
      // listTemplates returns all results from DB, action slices client-side
      const manyTemplates = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, name: `T${i}` }));
      mockState.fromFn.mockReturnValueOnce(createChain(manyTemplates));

      const result = await executeAction(testCtx, 'list_templates', { limit: 5 });

      expect(result.success).toBe(true);
      expect((result.data as unknown[]).length).toBeLessThanOrEqual(5);
    });

    it('returns error when supabase fails', async () => {
      const chain = createChain([]);
      // Override the thenable to return an error
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { data: null; error: { message: string } }) => unknown) =>
          resolve({ data: null, error: { message: 'Database error' } })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'list_templates', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('list_writing_styles', () => {
    it('returns styles array with expected shape', async () => {
      const mockStyles = [
        { id: 's1', name: 'Casual Expert', description: 'Relaxed but knowledgeable', tone_keywords: ['casual', 'expert'] },
      ];

      mockState.fromFn.mockReturnValueOnce(createChain(mockStyles));

      const result = await executeAction(testCtx, 'list_writing_styles', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toEqual(mockStyles);
    });

    it('returns empty array when no styles exist', async () => {
      mockState.fromFn.mockReturnValueOnce(createChain([]));

      const result = await executeAction(testCtx, 'list_writing_styles', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});

describe('Analytics Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.fromFn = jest.fn(() => createChain());
    // Reset repo mock to default empty
    const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
    findPosts.mockResolvedValue([]);
  });

  describe('get_post_performance', () => {
    it('returns posts with engagement stats and content preview', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      findPosts.mockResolvedValue([
        {
          id: 'p1',
          draft_content: 'A very long post about leadership that goes on and on and on to exceed the hundred character limit for content previews in the analytics display',
          final_content: null,
          status: 'published',
          engagement_stats: { likes: 42, comments: 7 },
          published_at: '2026-02-20T10:00:00Z',
        },
      ]);

      const result = await executeAction(testCtx, 'get_post_performance', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(Array.isArray(result.data)).toBe(true);

      const post = (result.data as Array<Record<string, unknown>>)[0];
      expect(post.id).toBe('p1');
      expect(post.engagement_stats).toEqual({ likes: 42, comments: 7 });
      expect(post.published_at).toBe('2026-02-20T10:00:00Z');
      expect((post.content_preview as string).length).toBeLessThanOrEqual(100);
    });

    it('uses final_content for preview when available', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      findPosts.mockResolvedValue([
        {
          id: 'p2',
          draft_content: 'Draft version',
          final_content: 'Polished version',
          status: 'published',
          engagement_stats: { likes: 10 },
          published_at: '2026-02-21T10:00:00Z',
        },
      ]);

      const result = await executeAction(testCtx, 'get_post_performance', {});

      const post = (result.data as Array<Record<string, unknown>>)[0];
      expect(post.content_preview).toBe('Polished version');
    });

    it('defaults limit to 10', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(testCtx, 'get_post_performance', {});
      expect(findPosts).toHaveBeenCalledWith(testCtx.scope, { limit: 10 });
    });

    it('respects custom limit', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(testCtx, 'get_post_performance', { limit: 3 });
      expect(findPosts).toHaveBeenCalledWith(testCtx.scope, { limit: 3 });
    });
  });

  describe('get_top_posts', () => {
    it('returns published posts with engagement stats', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      findPosts.mockResolvedValue([
        {
          id: 'p3',
          draft_content: 'Top post draft',
          final_content: 'Top post final',
          status: 'published',
          engagement_stats: { likes: 150, comments: 30 },
          published_at: '2026-02-19T10:00:00Z',
        },
      ]);

      const result = await executeAction(testCtx, 'get_top_posts', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(Array.isArray(result.data)).toBe(true);

      const post = (result.data as Array<Record<string, unknown>>)[0];
      expect(post.id).toBe('p3');
      expect(post.content_preview).toBe('Top post final');
      expect(post.status).toBe('published');
    });

    it('fetches up to 100 published posts to sort client-side', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      await executeAction(testCtx, 'get_top_posts', {});
      expect(findPosts).toHaveBeenCalledWith(testCtx.scope, { status: 'published', limit: 100 });
    });
  });
});

describe('Scheduling Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.fromFn = jest.fn(() => createChain());
    const { updatePost } = jest.requireMock('@/server/repositories/posts.repo');
    updatePost.mockResolvedValue({ id: 'post-1' });
    const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
    findPosts.mockResolvedValue([]);
    const { listSlots } = jest.requireMock('@/server/repositories/cp-schedule-slots.repo');
    listSlots.mockResolvedValue({ data: [], error: null });
  });

  describe('schedule_post', () => {
    it('requires confirmation', () => {
      expect(actionRequiresConfirmation('schedule_post')).toBe(true);
    });

    it('schedules a post successfully via repo', async () => {
      const scheduledTime = '2026-03-01T14:00:00Z';
      const result = await executeAction(testCtx, 'schedule_post', {
        post_id: 'post-abc',
        scheduled_time: scheduledTime,
      });

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('calendar');
      expect(result.data).toEqual({
        post_id: 'post-abc',
        scheduled_time: scheduledTime,
        status: 'scheduled',
      });
    });

    it('returns error when updatePost throws', async () => {
      const { updatePost } = jest.requireMock('@/server/repositories/posts.repo');
      updatePost.mockRejectedValueOnce(new Error('Update failed'));

      const result = await executeAction(testCtx, 'schedule_post', {
        post_id: 'post-abc',
        scheduled_time: '2026-03-01T14:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('get_autopilot_status', () => {
    it('returns buffer count and posting slots', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      findPosts.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }]);
      // testCtx uses team scope — getSlots (not listSlots) is called for team context
      const { getActiveProfiles, getSlots } = jest.requireMock('@/server/repositories/cp-team-schedule.repo');
      getActiveProfiles.mockResolvedValue({ data: [{ id: 'profile-1' }], error: null });
      getSlots.mockResolvedValue({
        data: [
          { id: 's1', day_of_week: 1, time_of_day: '09:00', is_active: true },
          { id: 's2', day_of_week: 3, time_of_day: '14:00', is_active: true },
        ],
        error: null,
      });

      const result = await executeAction(testCtx, 'get_autopilot_status', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');

      const data = result.data as { buffer_count: number; slots: unknown[] };
      expect(data.buffer_count).toBe(3);
      expect(data.slots).toHaveLength(2);
    });

    it('returns zero buffer count when no buffer posts', async () => {
      const result = await executeAction(testCtx, 'get_autopilot_status', {});

      expect(result.success).toBe(true);
      const data = result.data as { buffer_count: number; slots: unknown[] };
      expect(data.buffer_count).toBe(0);
    });

    it('returns error when findPosts throws', async () => {
      const { findPosts } = jest.requireMock('@/server/repositories/posts.repo');
      findPosts.mockRejectedValueOnce(new Error('posts.findPosts: Buffer query failed'));

      const result = await executeAction(testCtx, 'get_autopilot_status', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Buffer query failed');
    });
  });
});

describe('Action Registry', () => {
  it('all supporting actions are registered', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAllActions } = require('@/lib/actions/registry');
    const actions = getAllActions();
    const actionNames = actions.map((a: { name: string }) => a.name);

    // Templates
    expect(actionNames).toContain('list_templates');
    expect(actionNames).toContain('list_writing_styles');

    // Analytics
    expect(actionNames).toContain('get_post_performance');
    expect(actionNames).toContain('get_top_posts');

    // Scheduling
    expect(actionNames).toContain('schedule_post');
    expect(actionNames).toContain('get_autopilot_status');

    // Knowledge (from previous tasks)
    expect(actionNames).toContain('search_knowledge');
    expect(actionNames).toContain('list_topics');
    expect(actionNames).toContain('build_content_brief');

    // Content (from previous tasks)
    expect(actionNames).toContain('write_post');
    expect(actionNames).toContain('polish_post');
    expect(actionNames).toContain('list_posts');
    expect(actionNames).toContain('update_post_content');
  });

  it('schedule_post is the only action requiring confirmation', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAllActions } = require('@/lib/actions/registry');
    const actions = getAllActions();
    const confirmable = actions.filter((a: { requiresConfirmation?: boolean }) => a.requiresConfirmation);
    expect(confirmable).toHaveLength(1);
    expect(confirmable[0].name).toBe('schedule_post');
  });
});

describe('Barrel import (index.ts)', () => {
  it('exports executeAction and actionRequiresConfirmation', async () => {
    const barrel = await import('@/lib/actions/index');
    expect(typeof barrel.executeAction).toBe('function');
    expect(typeof barrel.actionRequiresConfirmation).toBe('function');
  });

  it('exports getToolDefinitions and getAllActions', async () => {
    const barrel = await import('@/lib/actions/index');
    expect(typeof barrel.getToolDefinitions).toBe('function');
    expect(typeof barrel.getAllActions).toBe('function');
  });

  it('getToolDefinitions returns valid tool definitions', async () => {
    const barrel = await import('@/lib/actions/index');
    const tools = barrel.getToolDefinitions();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThanOrEqual(13); // 3 knowledge + 4 content + 2 templates + 2 analytics + 2 scheduling

    for (const tool of tools) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('input_schema');
      expect(tool.input_schema.type).toBe('object');
    }
  });
});

describe('Unknown action handling', () => {
  it('returns error for unknown action', async () => {
    const result = await executeAction(testCtx, 'nonexistent_action', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown action');
  });
});
