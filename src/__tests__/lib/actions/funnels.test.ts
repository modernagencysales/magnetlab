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
  userId: 'user-test-123',
  teamId: 'team-test-456',
};

describe('Funnel Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.fromFn = jest.fn(() => createChain());
  });

  describe('list_funnels', () => {
    it('returns funnels array with expected shape', async () => {
      const mockFunnels = [
        { id: 'f1', slug: 'growth-guide', title: 'Growth Guide Funnel', status: 'published', created_at: '2026-02-20T10:00:00Z', updated_at: '2026-02-25T10:00:00Z' },
        { id: 'f2', slug: 'sales-playbook', title: 'Sales Playbook Funnel', status: 'draft', created_at: '2026-02-21T10:00:00Z', updated_at: '2026-02-26T10:00:00Z' },
      ];

      mockState.fromFn.mockReturnValueOnce(createChain(mockFunnels));

      const result = await executeAction(testCtx, 'list_funnels', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data).toEqual(mockFunnels);
    });

    it('returns empty array when no funnels exist', async () => {
      mockState.fromFn.mockReturnValueOnce(createChain([]));

      const result = await executeAction(testCtx, 'list_funnels', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('excludes A/B test variants', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_funnels', {});

      expect(chain.eq).toHaveBeenCalledWith('is_variant', false);
    });

    it('passes limit parameter', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_funnels', { limit: 5 });

      expect(chain.limit).toHaveBeenCalledWith(5);
    });

    it('defaults limit to 10', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_funnels', {});

      expect(chain.limit).toHaveBeenCalledWith(10);
    });

    it('filters by status when provided', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_funnels', { status: 'published' });

      expect(chain.eq).toHaveBeenCalledWith('status', 'published');
    });

    it('orders by updated_at descending', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_funnels', {});

      expect(chain.order).toHaveBeenCalledWith('updated_at', { ascending: false });
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
      expect(result.error).toBe('Database error');
    });
  });

  describe('get_funnel', () => {
    it('returns funnel details with theme and sections', async () => {
      const mockFunnel = {
        id: 'f1',
        slug: 'growth-guide',
        title: 'Growth Guide Funnel',
        status: 'published',
        theme: 'dark',
        sections: [{ type: 'hero', title: 'Welcome' }],
      };

      mockState.fromFn.mockReturnValueOnce(createChain(mockFunnel));

      const result = await executeAction(testCtx, 'get_funnel', { id: 'f1' });

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(result.data).toEqual(mockFunnel);
    });

    it('returns error when funnel not found', async () => {
      const chain = createChain(null);
      chain.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'get_funnel', { id: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Funnel not found');
    });

    it('scopes query to user_id', async () => {
      const chain = createChain({ id: 'f1' });
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'get_funnel', { id: 'f1' });

      expect(chain.eq).toHaveBeenCalledWith('id', 'f1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-test-123');
    });
  });

  describe('publish_funnel', () => {
    it('requires confirmation', () => {
      expect(actionRequiresConfirmation('publish_funnel')).toBe(true);
    });

    it('publishes a funnel successfully', async () => {
      // First call: existence check (select → single)
      const checkChain = createChain({ id: 'f1' });
      // Second call: update
      const updateChain = createChain();
      (updateChain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { data: unknown; error: null }) => unknown) =>
          resolve({ data: null, error: null })
      ) as jest.Mock;
      mockState.fromFn
        .mockReturnValueOnce(checkChain)
        .mockReturnValueOnce(updateChain);

      const result = await executeAction(testCtx, 'publish_funnel', { id: 'f1' });

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(result.data).toEqual({ id: 'f1', status: 'published' });
      expect(updateChain.update).toHaveBeenCalledWith({ status: 'published' });
    });

    it('returns error when funnel not found', async () => {
      const checkChain = createChain(null);
      checkChain.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
      mockState.fromFn.mockReturnValueOnce(checkChain);

      const result = await executeAction(testCtx, 'publish_funnel', { id: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Funnel not found');
    });

    it('returns error on supabase update failure', async () => {
      // Existence check passes
      const checkChain = createChain({ id: 'f1' });
      // Update fails
      const updateChain = createChain();
      (updateChain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { data: null; error: { message: string } }) => unknown) =>
          resolve({ data: null, error: { message: 'Update failed' } })
      ) as jest.Mock;
      mockState.fromFn
        .mockReturnValueOnce(checkChain)
        .mockReturnValueOnce(updateChain);

      const result = await executeAction(testCtx, 'publish_funnel', { id: 'f1' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });
});
