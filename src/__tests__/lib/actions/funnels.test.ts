/**
 * @jest-environment node
 *
 * Funnel Actions Tests (Teams V3)
 * Actions now delegate to funnels.repo which uses DataScope via applyScope().
 * Team context filters by team_id; personal context filters by user_id.
 */

// Helper to create a thenable Supabase query chain mock
function createChain(resolveData: unknown = []) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['select', 'insert', 'update', 'eq', 'not', 'is', 'neq', 'order', 'limit'];
  methods.forEach(m => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue({ data: resolveData, error: null });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: resolveData, error: null });
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

// Mock dependencies required by other action modules loaded via barrel
jest.mock('@/lib/services/knowledge-brain', () => ({
  searchKnowledgeV2: jest.fn().mockResolvedValue({ entries: [] }),
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
import '@/lib/actions/funnels';

const testCtx: ActionContext = {
  scope: { type: 'team', userId: 'user-test-123', teamId: 'team-test-456' },
};

const personalCtx: ActionContext = {
  scope: { type: 'user', userId: 'user-test-123' },
};

describe('Funnel Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.fromFn = jest.fn(() => createChain());
  });

  describe('list_funnels', () => {
    it('returns funnels array on success', async () => {
      const mockFunnels = [
        { id: 'f1', slug: 'growth-guide', optin_headline: 'Growth Guide', is_published: true, created_at: '2026-02-20T10:00:00Z' },
        { id: 'f2', slug: 'sales-playbook', optin_headline: 'Sales Playbook', is_published: false, created_at: '2026-02-21T10:00:00Z' },
      ];

      mockState.fromFn.mockReturnValueOnce(createChain(mockFunnels));

      const result = await executeAction(testCtx, 'list_funnels', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('returns empty array when no funnels exist', async () => {
      mockState.fromFn.mockReturnValueOnce(createChain([]));

      const result = await executeAction(testCtx, 'list_funnels', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('excludes A/B test variants via is_variant=false', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_funnels', {});

      expect(chain.eq).toHaveBeenCalledWith('is_variant', false);
    });

    it('applies team scope (team_id filter) for team context', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_funnels', {});

      // applyScope with team context applies team_id filter
      expect(chain.eq).toHaveBeenCalledWith('team_id', 'team-test-456');
    });

    it('applies user scope (user_id filter) for personal context', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(personalCtx, 'list_funnels', {});

      // applyScope with personal context applies user_id filter
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-test-123');
    });

    it('filters published funnels when status=published', async () => {
      const mockFunnels = [
        { id: 'f1', is_published: true },
        { id: 'f2', is_published: false },
      ];
      mockState.fromFn.mockReturnValueOnce(createChain(mockFunnels));

      const result = await executeAction(testCtx, 'list_funnels', { status: 'published' });

      expect(result.success).toBe(true);
      const data = result.data as Array<{ is_published: boolean }>;
      expect(data.every(f => f.is_published === true)).toBe(true);
    });

    it('respects limit parameter', async () => {
      const mockFunnels = Array.from({ length: 20 }, (_, i) => ({
        id: `f${i}`, is_published: true,
      }));
      mockState.fromFn.mockReturnValueOnce(createChain(mockFunnels));

      const result = await executeAction(testCtx, 'list_funnels', { limit: 5 });

      expect(result.success).toBe(true);
      expect((result.data as unknown[]).length).toBeLessThanOrEqual(5);
    });

    it('orders by created_at descending', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_funnels', {});

      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('returns error when supabase fails', async () => {
      const chain = createChain([]);
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { data: null; error: { message: string } }) => unknown) =>
          resolve({ data: null, error: { message: 'Database error' } })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'list_funnels', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('get_funnel', () => {
    it('returns funnel details on success', async () => {
      const mockFunnel = {
        id: 'f1',
        slug: 'growth-guide',
        is_published: true,
        theme: 'dark',
      };

      mockState.fromFn.mockReturnValueOnce(createChain(mockFunnel));

      const result = await executeAction(testCtx, 'get_funnel', { id: 'f1' });

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect((result.data as { id: string }).id).toBe('f1');
    });

    it('returns error when funnel not found', async () => {
      const chain = createChain(null);
      chain.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'get_funnel', { id: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Funnel not found');
    });

    it('applies scope (team_id) to the query', async () => {
      const chain = createChain({ id: 'f1' });
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'get_funnel', { id: 'f1' });

      expect(chain.eq).toHaveBeenCalledWith('id', 'f1');
      // applyScope with team context applies team_id
      expect(chain.eq).toHaveBeenCalledWith('team_id', 'team-test-456');
    });
  });

  describe('publish_funnel', () => {
    it('requires confirmation', () => {
      expect(actionRequiresConfirmation('publish_funnel')).toBe(true);
    });

    it('publishes a funnel successfully using is_published field', async () => {
      // assertFunnelAccess: select id → returns id
      const checkChain = createChain({ id: 'f1' });
      // updateFunnel: update → select → single
      const updateChain = createChain({ id: 'f1', is_published: true });
      mockState.fromFn
        .mockReturnValueOnce(checkChain)
        .mockReturnValueOnce(updateChain);

      const result = await executeAction(testCtx, 'publish_funnel', { id: 'f1' });

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(result.data).toEqual({ id: 'f1', status: 'published' });
      // Confirm update uses is_published: true (not status: 'published')
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_published: true })
      );
    });

    it('sets published_at timestamp when publishing', async () => {
      const checkChain = createChain({ id: 'f1' });
      const updateChain = createChain({ id: 'f1', is_published: true });
      mockState.fromFn
        .mockReturnValueOnce(checkChain)
        .mockReturnValueOnce(updateChain);

      await executeAction(testCtx, 'publish_funnel', { id: 'f1' });

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ published_at: expect.any(String) })
      );
    });

    it('returns error when funnel not found', async () => {
      const checkChain = createChain(null);
      checkChain.single = jest.fn().mockResolvedValue({ data: null, error: null });
      mockState.fromFn.mockReturnValueOnce(checkChain);

      const result = await executeAction(testCtx, 'publish_funnel', { id: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Funnel not found');
    });

    it('returns error on supabase update failure', async () => {
      // Existence check passes
      const checkChain = createChain({ id: 'f1' });
      // Update throws via repo
      const updateChain = createChain();
      updateChain.select = jest.fn().mockReturnValue(updateChain);
      updateChain.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } });
      mockState.fromFn
        .mockReturnValueOnce(checkChain)
        .mockReturnValueOnce(updateChain);

      const result = await executeAction(testCtx, 'publish_funnel', { id: 'f1' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Update failed');
    });
  });
});
