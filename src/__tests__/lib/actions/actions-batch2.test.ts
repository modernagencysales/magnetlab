/**
 * @jest-environment node
 *
 * Batch 2 Action Tests — Templates, Knowledge, Funnels, Lead Magnets, Email
 *
 * These tests verify that the batch 2 action rewrites correctly use
 * DataScope (ctx.scope) instead of raw userId/teamId, and that template
 * actions use correct column names (category not content_type,
 * example_posts not example_post).
 */

// Helper to create a thenable Supabase query chain mock
function createChain(resolveData: unknown = []) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['select', 'insert', 'update', 'eq', 'not', 'is', 'neq', 'order', 'limit', 'range', 'or', 'gte', 'in', 'contains'];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue({ data: resolveData, error: null });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: resolveData, error: null });
  (chain as unknown as PromiseLike<{ data: unknown; error: null; count: number | null }>).then = jest.fn(
    (resolve: (value: { data: unknown; error: null; count: number | null }) => unknown) =>
      resolve({
        data: Array.isArray(resolveData) ? resolveData : [resolveData],
        error: null,
        count: Array.isArray(resolveData) ? resolveData.length : 1,
      })
  ) as jest.Mock;
  return chain;
}

const mockState = { fromFn: jest.fn(() => createChain()) };

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: (table: string) => mockState.fromFn(table),
  })),
}));

const mockSearchKnowledgeV2 = jest.fn().mockResolvedValue({ entries: [] });
const mockListKnowledgeTopics = jest.fn().mockResolvedValue([]);
const mockBuildContentBrief = jest.fn().mockResolvedValue({ compiledContext: '' });

jest.mock('@/lib/services/knowledge-brain', () => ({
  searchKnowledgeV2: (...args: unknown[]) => mockSearchKnowledgeV2(...args),
  listKnowledgeTopics: (...args: unknown[]) => mockListKnowledgeTopics(...args),
}));

jest.mock('@/lib/ai/content-pipeline/briefing-agent', () => ({
  buildContentBrief: (...args: unknown[]) => mockBuildContentBrief(...args),
}));

jest.mock('@/lib/ai/content-pipeline/post-writer', () => ({
  writePost: jest.fn().mockResolvedValue({ content: '', variations: [] }),
}));

jest.mock('@/lib/ai/content-pipeline/post-polish', () => ({
  polishPost: jest.fn().mockResolvedValue({ original: '', polished: '', changes: [], hookScore: 0 }),
}));

jest.mock('@/lib/ai/copilot/lead-magnet-creation', () => ({
  analyzeContextGaps: jest.fn().mockResolvedValue({
    questions: [],
    preAnsweredCount: 0,
    knowledgeContext: '',
    gapSummary: '',
    brainEntries: [],
  }),
  generateContent: jest.fn().mockResolvedValue({}),
  generatePosts: jest.fn().mockResolvedValue({ variations: [] }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

import { executeAction } from '@/lib/actions/executor';
import type { ActionContext } from '@/lib/actions/types';

// Import action modules to trigger registration
import '@/lib/actions/templates';
import '@/lib/actions/knowledge';
import '@/lib/actions/funnels';
import '@/lib/actions/lead-magnets';
import '@/lib/actions/email';

const teamCtx: ActionContext = {
  scope: { type: 'team', userId: 'user-abc', teamId: 'team-xyz' },
};

const personalCtx: ActionContext = {
  scope: { type: 'user', userId: 'user-abc' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockState.fromFn = jest.fn(() => createChain());
  mockSearchKnowledgeV2.mockResolvedValue({ entries: [] });
  mockListKnowledgeTopics.mockResolvedValue([]);
  mockBuildContentBrief.mockResolvedValue({ compiledContext: '' });
});

// ─── Templates ─────────────────────────────────────────────────────────────

describe('list_templates', () => {
  it('returns templates successfully', async () => {
    const mockTemplates = [
      {
        id: 't1',
        name: 'Hook Template',
        category: 'story',           // CORRECT: category (not content_type)
        description: 'A hook-first format',
        example_posts: ['post 1', 'post 2'], // CORRECT: example_posts (not example_post)
      },
    ];
    mockState.fromFn.mockReturnValueOnce(createChain(mockTemplates));

    const result = await executeAction(teamCtx, 'list_templates', {});

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.displayHint).toBe('text');
  });

  it('selects category (not content_type) from cp_post_templates', async () => {
    const chain = createChain([]);
    mockState.fromFn.mockReturnValueOnce(chain);

    await executeAction(teamCtx, 'list_templates', {});

    // Verify the SELECT includes 'category' (not 'content_type')
    const selectCall = chain.select.mock.calls[0]?.[0] as string | undefined;
    expect(selectCall).toContain('category');
    expect(selectCall).not.toContain('content_type');
  });

  it('selects example_posts (not example_post) from cp_post_templates', async () => {
    const chain = createChain([]);
    mockState.fromFn.mockReturnValueOnce(chain);

    await executeAction(teamCtx, 'list_templates', {});

    // Verify the SELECT includes 'example_posts' (not 'example_post')
    const selectCall = chain.select.mock.calls[0]?.[0] as string | undefined;
    expect(selectCall).toContain('example_posts');
    expect(selectCall).not.toMatch(/\bexample_post\b(?!s)/); // not singular form
  });

  it('applies limit parameter', async () => {
    const templates = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, name: `T${i}` }));
    mockState.fromFn.mockReturnValueOnce(createChain(templates));

    const result = await executeAction(teamCtx, 'list_templates', { limit: 5 });

    expect((result.data as unknown[]).length).toBeLessThanOrEqual(5);
  });

  it('returns empty array when no templates exist', async () => {
    mockState.fromFn.mockReturnValueOnce(createChain([]));

    const result = await executeAction(teamCtx, 'list_templates', {});

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });
});

describe('list_writing_styles', () => {
  it('returns writing styles with correct columns', async () => {
    const mockStyles = [
      { id: 's1', name: 'Bold & Direct', description: 'Punchy tone', tone_keywords: ['bold', 'direct'] },
    ];
    mockState.fromFn.mockReturnValueOnce(createChain(mockStyles));

    const result = await executeAction(teamCtx, 'list_writing_styles', {});

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.displayHint).toBe('text');
  });

  it('queries cp_writing_styles table', async () => {
    mockState.fromFn.mockReturnValueOnce(createChain([]));

    await executeAction(teamCtx, 'list_writing_styles', {});

    expect(mockState.fromFn).toHaveBeenCalledWith('cp_writing_styles');
  });
});

// ─── Knowledge ─────────────────────────────────────────────────────────────

describe('search_knowledge — scope passing', () => {
  it('passes userId from ctx.scope to searchKnowledgeV2', async () => {
    await executeAction(teamCtx, 'search_knowledge', { query: 'pricing' });

    expect(mockSearchKnowledgeV2).toHaveBeenCalledWith(
      'user-abc',
      expect.objectContaining({ query: 'pricing' })
    );
  });

  it('passes teamId from ctx.scope to searchKnowledgeV2 in team context', async () => {
    await executeAction(teamCtx, 'search_knowledge', { query: 'pricing' });

    expect(mockSearchKnowledgeV2).toHaveBeenCalledWith(
      'user-abc',
      expect.objectContaining({ teamId: 'team-xyz' })
    );
  });

  it('passes undefined teamId in personal context', async () => {
    await executeAction(personalCtx, 'search_knowledge', { query: 'growth' });

    expect(mockSearchKnowledgeV2).toHaveBeenCalledWith(
      'user-abc',
      expect.objectContaining({ teamId: undefined })
    );
  });
});

describe('list_topics — scope passing', () => {
  it('passes teamId to listKnowledgeTopics in team context', async () => {
    await executeAction(teamCtx, 'list_topics', {});

    expect(mockListKnowledgeTopics).toHaveBeenCalledWith(
      'user-abc',
      expect.objectContaining({ teamId: 'team-xyz' })
    );
  });

  it('passes undefined teamId in personal context', async () => {
    await executeAction(personalCtx, 'list_topics', {});

    expect(mockListKnowledgeTopics).toHaveBeenCalledWith(
      'user-abc',
      expect.objectContaining({ teamId: undefined })
    );
  });
});

describe('build_content_brief — scope passing', () => {
  it('passes teamId to buildContentBrief in team context', async () => {
    await executeAction(teamCtx, 'build_content_brief', { topic: 'growth' });

    expect(mockBuildContentBrief).toHaveBeenCalledWith(
      'user-abc',
      'growth',
      expect.objectContaining({ teamId: 'team-xyz' })
    );
  });
});

// ─── Funnels — DataScope ────────────────────────────────────────────────────

describe('list_funnels — DataScope', () => {
  it('uses team_id filter for team context (applyScope)', async () => {
    const chain = createChain([]);
    mockState.fromFn.mockReturnValueOnce(chain);

    await executeAction(teamCtx, 'list_funnels', {});

    expect(chain.eq).toHaveBeenCalledWith('team_id', 'team-xyz');
  });

  it('uses user_id filter for personal context (applyScope)', async () => {
    const chain = createChain([]);
    mockState.fromFn.mockReturnValueOnce(chain);

    await executeAction(personalCtx, 'list_funnels', {});

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-abc');
  });
});

describe('get_funnel — DataScope', () => {
  it('uses team_id filter for team context (applyScope)', async () => {
    const chain = createChain({ id: 'f1' });
    mockState.fromFn.mockReturnValueOnce(chain);

    await executeAction(teamCtx, 'get_funnel', { id: 'f1' });

    expect(chain.eq).toHaveBeenCalledWith('team_id', 'team-xyz');
  });
});

describe('publish_funnel — uses is_published not status', () => {
  it('updates is_published:true (not status:"published")', async () => {
    // assertFunnelAccess check
    const checkChain = createChain({ id: 'f1' });
    // updateFunnel
    const updateChain = createChain({ id: 'f1', is_published: true });
    mockState.fromFn
      .mockReturnValueOnce(checkChain)
      .mockReturnValueOnce(updateChain);

    await executeAction(teamCtx, 'publish_funnel', { id: 'f1' });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_published: true })
    );
    // Verify it does NOT use old status field
    const updateArg = updateChain.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateArg).not.toHaveProperty('status');
  });
});

// ─── Lead Magnets — DataScope ──────────────────────────────────────────────

describe('list_lead_magnets — DataScope', () => {
  it('uses team_id filter in team context', async () => {
    const chain = createChain([]);
    mockState.fromFn.mockReturnValueOnce(chain);

    await executeAction(teamCtx, 'list_lead_magnets', {});

    expect(chain.eq).toHaveBeenCalledWith('team_id', 'team-xyz');
  });
});

describe('save_lead_magnet — uses scope for insert', () => {
  it('inserts with user_id from scope.userId and team_id from scope.teamId', async () => {
    const chain = createChain({ id: 'new-lm' });
    mockState.fromFn.mockReturnValueOnce(chain);

    await executeAction(teamCtx, 'save_lead_magnet', {
      title: 'Test',
      archetype: 'guide',
      content_blocks: {},
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-abc',
        team_id: 'team-xyz',
      })
    );
  });

  it('inserts with null team_id for personal context', async () => {
    const chain = createChain({ id: 'new-lm' });
    mockState.fromFn.mockReturnValueOnce(chain);

    await executeAction(personalCtx, 'save_lead_magnet', {
      title: 'Test',
      archetype: 'guide',
      content_blocks: {},
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-abc',
        team_id: null,
      })
    );
  });
});

// ─── Email — DataScope ─────────────────────────────────────────────────────

describe('list_email_sequences — DataScope', () => {
  it('applies team_id filter for team context (applyScope)', async () => {
    const chain = createChain([]);
    mockState.fromFn.mockReturnValueOnce(chain);

    await executeAction(teamCtx, 'list_email_sequences', {});

    expect(chain.eq).toHaveBeenCalledWith('team_id', 'team-xyz');
  });

  it('applies user_id filter for personal context (applyScope)', async () => {
    const chain = createChain([]);
    mockState.fromFn.mockReturnValueOnce(chain);

    await executeAction(personalCtx, 'list_email_sequences', {});

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-abc');
  });
});

describe('get_subscriber_count — team-scoped', () => {
  it('returns count: 0 with note for personal context (no team)', async () => {
    const result = await executeAction(personalCtx, 'get_subscriber_count', {});

    expect(result.success).toBe(true);
    const data = result.data as { count: number; note?: string };
    expect(data.count).toBe(0);
    expect(data.note).toContain('team context');
  });

  it('queries email_subscribers with team_id for team context', async () => {
    const chain = createChain([]);
    (chain as unknown as PromiseLike<unknown>).then = jest.fn(
      (resolve: (value: { count: number; data: null; error: null }) => unknown) =>
        resolve({ count: 15, data: null, error: null })
    ) as jest.Mock;
    mockState.fromFn.mockReturnValueOnce(chain);

    const result = await executeAction(teamCtx, 'get_subscriber_count', {});

    expect(result.success).toBe(true);
    expect(mockState.fromFn).toHaveBeenCalledWith('email_subscribers');
    expect(chain.eq).toHaveBeenCalledWith('team_id', 'team-xyz');
    expect(chain.eq).toHaveBeenCalledWith('status', 'active');
  });
});

describe('generate_newsletter_email — scope passing', () => {
  it('passes teamId to searchKnowledgeV2 in team context', async () => {
    await executeAction(teamCtx, 'generate_newsletter_email', { topic: 'content marketing' });

    expect(mockSearchKnowledgeV2).toHaveBeenCalledWith(
      'user-abc',
      expect.objectContaining({ teamId: 'team-xyz' })
    );
  });

  it('passes undefined teamId in personal context', async () => {
    await executeAction(personalCtx, 'generate_newsletter_email', { topic: 'growth' });

    expect(mockSearchKnowledgeV2).toHaveBeenCalledWith(
      'user-abc',
      expect.objectContaining({ teamId: undefined })
    );
  });
});
