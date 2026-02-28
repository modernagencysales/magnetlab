/**
 * @jest-environment node
 */

// Helper to create a thenable Supabase query chain mock
function createChain(resolveData: unknown = []) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['select', 'insert', 'update', 'eq', 'not', 'is', 'neq', 'order', 'limit'];
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
const mockState = { fromFn: jest.fn((_table?: string) => createChain()) };

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: (table: string) => mockState.fromFn(table),
  })),
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
  userId: 'user-test-123',
  teamId: 'team-test-456',
};

describe('Template Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.fromFn = jest.fn(() => createChain());
  });

  describe('list_templates', () => {
    it('returns templates array with expected shape', async () => {
      const mockTemplates = [
        { id: 't1', name: 'Contrarian Take', description: 'Challenge conventional wisdom', content_type: 'contrarian', example_post: 'Example...' },
        { id: 't2', name: 'Story Arc', description: 'Personal narrative', content_type: 'personal_story', example_post: 'Once upon...' },
      ];

      mockState.fromFn.mockReturnValueOnce(createChain(mockTemplates));

      const result = await executeAction(testCtx, 'list_templates', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data).toEqual(mockTemplates);
    });

    it('returns empty array when no templates exist', async () => {
      mockState.fromFn.mockReturnValueOnce(createChain([]));

      const result = await executeAction(testCtx, 'list_templates', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('passes limit parameter', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_templates', { limit: 5 });

      expect(chain.limit).toHaveBeenCalledWith(5);
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
      expect(result.error).toBe('Database error');
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
  });

  describe('get_post_performance', () => {
    it('returns posts with engagement stats and content preview', async () => {
      const mockPosts = [
        {
          id: 'p1',
          draft_content: 'A very long post about leadership that goes on and on and on to exceed the hundred character limit for content previews in the analytics display',
          final_content: null,
          status: 'published',
          engagement_stats: { likes: 42, comments: 7 },
          published_at: '2026-02-20T10:00:00Z',
        },
      ];

      mockState.fromFn.mockReturnValueOnce(createChain(mockPosts));

      const result = await executeAction(testCtx, 'get_post_performance', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(Array.isArray(result.data)).toBe(true);

      const post = (result.data as Array<Record<string, unknown>>)[0];
      expect(post.id).toBe('p1');
      expect(post.engagement_stats).toEqual({ likes: 42, comments: 7 });
      expect(post.published_at).toBe('2026-02-20T10:00:00Z');
      // Content preview should be truncated to 100 chars
      expect((post.content_preview as string).length).toBeLessThanOrEqual(100);
    });

    it('uses final_content for preview when available', async () => {
      const mockPosts = [
        {
          id: 'p2',
          draft_content: 'Draft version',
          final_content: 'Polished version',
          status: 'published',
          engagement_stats: { likes: 10 },
          published_at: '2026-02-21T10:00:00Z',
        },
      ];

      mockState.fromFn.mockReturnValueOnce(createChain(mockPosts));

      const result = await executeAction(testCtx, 'get_post_performance', {});

      const post = (result.data as Array<Record<string, unknown>>)[0];
      expect(post.content_preview).toBe('Polished version');
    });

    it('defaults limit to 10', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'get_post_performance', {});

      expect(chain.limit).toHaveBeenCalledWith(10);
    });

    it('respects custom limit', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'get_post_performance', { limit: 3 });

      expect(chain.limit).toHaveBeenCalledWith(3);
    });
  });

  describe('get_top_posts', () => {
    it('returns published posts with engagement stats', async () => {
      const mockPosts = [
        {
          id: 'p3',
          draft_content: 'Top post draft',
          final_content: 'Top post final',
          status: 'published',
          engagement_stats: { likes: 150, comments: 30 },
          published_at: '2026-02-19T10:00:00Z',
        },
      ];

      mockState.fromFn.mockReturnValueOnce(createChain(mockPosts));

      const result = await executeAction(testCtx, 'get_top_posts', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(Array.isArray(result.data)).toBe(true);

      const post = (result.data as Array<Record<string, unknown>>)[0];
      expect(post.id).toBe('p3');
      expect(post.content_preview).toBe('Top post final');
      expect(post.status).toBe('published');
    });

    it('fetches up to 100 then slices to requested limit', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'get_top_posts', {});

      // I7 FIX: fetches 100 to sort client-side by engagement, then slices
      expect(chain.limit).toHaveBeenCalledWith(100);
    });

    it('filters by published status', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'get_top_posts', {});

      expect(chain.eq).toHaveBeenCalledWith('status', 'published');
    });
  });
});

describe('Scheduling Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.fromFn = jest.fn(() => createChain());
  });

  describe('schedule_post', () => {
    it('requires confirmation', () => {
      expect(actionRequiresConfirmation('schedule_post')).toBe(true);
    });

    it('schedules a post successfully', async () => {
      const chain = createChain();
      // For update queries without .single(), mock the thenable
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { data: unknown; error: null }) => unknown) =>
          resolve({ data: null, error: null })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

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

      expect(chain.update).toHaveBeenCalledWith({
        scheduled_time: scheduledTime,
        status: 'scheduled',
      });
    });

    it('returns error on supabase failure', async () => {
      const chain = createChain();
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { data: null; error: { message: string } }) => unknown) =>
          resolve({ data: null, error: { message: 'Update failed' } })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

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
      const bufferChain = createChain([{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }]);
      const slotsChain = createChain([
        { id: 's1', day_of_week: 1, time_utc: '09:00', is_active: true },
        { id: 's2', day_of_week: 3, time_utc: '14:00', is_active: true },
      ]);

      mockState.fromFn
        .mockReturnValueOnce(bufferChain)
        .mockReturnValueOnce(slotsChain);

      const result = await executeAction(testCtx, 'get_autopilot_status', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');

      const data = result.data as { buffer_count: number; slots: unknown[] };
      expect(data.buffer_count).toBe(3);
      expect(data.slots).toHaveLength(2);
    });

    it('returns zero buffer count when no buffer posts', async () => {
      const bufferChain = createChain([]);
      const slotsChain = createChain([]);

      mockState.fromFn
        .mockReturnValueOnce(bufferChain)
        .mockReturnValueOnce(slotsChain);

      const result = await executeAction(testCtx, 'get_autopilot_status', {});

      expect(result.success).toBe(true);
      const data = result.data as { buffer_count: number; slots: unknown[] };
      expect(data.buffer_count).toBe(0);
      expect(data.slots).toEqual([]);
    });

    it('returns error when buffer query fails', async () => {
      const chain = createChain([]);
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { data: null; error: { message: string } }) => unknown) =>
          resolve({ data: null, error: { message: 'Buffer query failed' } })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'get_autopilot_status', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Buffer query failed');
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
