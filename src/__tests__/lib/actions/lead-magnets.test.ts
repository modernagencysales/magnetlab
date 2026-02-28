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
import '@/lib/actions/lead-magnets';

const testCtx: ActionContext = {
  userId: 'user-test-123',
  teamId: 'team-test-456',
};

describe('Lead Magnet Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.fromFn = jest.fn(() => createChain());
  });

  describe('list_lead_magnets', () => {
    it('returns lead magnets array with expected shape', async () => {
      const mockMagnets = [
        { id: 'lm1', title: 'Growth Guide', status: 'published', archetype: 'guide', created_at: '2026-02-20T10:00:00Z', updated_at: '2026-02-25T10:00:00Z' },
        { id: 'lm2', title: 'Sales Checklist', status: 'draft', archetype: 'checklist', created_at: '2026-02-21T10:00:00Z', updated_at: '2026-02-26T10:00:00Z' },
      ];

      mockState.fromFn.mockReturnValueOnce(createChain(mockMagnets));

      const result = await executeAction(testCtx, 'list_lead_magnets', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data).toEqual(mockMagnets);
    });

    it('returns empty array when no lead magnets exist', async () => {
      mockState.fromFn.mockReturnValueOnce(createChain([]));

      const result = await executeAction(testCtx, 'list_lead_magnets', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('passes limit parameter', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_lead_magnets', { limit: 5 });

      expect(chain.limit).toHaveBeenCalledWith(5);
    });

    it('defaults limit to 10', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_lead_magnets', {});

      expect(chain.limit).toHaveBeenCalledWith(10);
    });

    it('filters by status when provided', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_lead_magnets', { status: 'published' });

      // eq called for user_id and status
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-test-123');
      expect(chain.eq).toHaveBeenCalledWith('status', 'published');
    });

    it('orders by updated_at descending', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_lead_magnets', {});

      expect(chain.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    });

    it('returns error when supabase fails', async () => {
      const chain = createChain([]);
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { data: null; error: { message: string } }) => unknown) =>
          resolve({ data: null, error: { message: 'Database error' } })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'list_lead_magnets', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('get_lead_magnet', () => {
    it('returns lead magnet details', async () => {
      const mockMagnet = {
        id: 'lm1',
        title: 'Growth Guide',
        archetype: 'guide',
        status: 'published',
        content_blocks: [{ type: 'text', content: 'Hello' }],
        extraction_data: { topics: ['growth'] },
        created_at: '2026-02-20T10:00:00Z',
      };

      mockState.fromFn.mockReturnValueOnce(createChain(mockMagnet));

      const result = await executeAction(testCtx, 'get_lead_magnet', { id: 'lm1' });

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(result.data).toEqual(mockMagnet);
    });

    it('returns error when lead magnet not found', async () => {
      const chain = createChain(null);
      chain.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'get_lead_magnet', { id: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Lead magnet not found');
    });

    it('scopes query to user_id', async () => {
      const chain = createChain({ id: 'lm1' });
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'get_lead_magnet', { id: 'lm1' });

      expect(chain.eq).toHaveBeenCalledWith('id', 'lm1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-test-123');
    });
  });

  describe('create_lead_magnet', () => {
    it('requires confirmation', () => {
      expect(actionRequiresConfirmation('create_lead_magnet')).toBe(true);
    });

    it('creates a lead magnet with default archetype', async () => {
      const mockCreated = { id: 'lm-new', title: 'My Guide', archetype: 'guide', status: 'draft' };
      const chain = createChain(mockCreated);
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'create_lead_magnet', { title: 'My Guide' });

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(result.data).toEqual(mockCreated);
      expect(chain.insert).toHaveBeenCalledWith({
        user_id: 'user-test-123',
        title: 'My Guide',
        archetype: 'guide',
        status: 'draft',
      });
    });

    it('creates a lead magnet with custom archetype', async () => {
      const mockCreated = { id: 'lm-new', title: 'My Checklist', archetype: 'checklist', status: 'draft' };
      const chain = createChain(mockCreated);
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'create_lead_magnet', { title: 'My Checklist', archetype: 'checklist' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreated);
      expect(chain.insert).toHaveBeenCalledWith({
        user_id: 'user-test-123',
        title: 'My Checklist',
        archetype: 'checklist',
        status: 'draft',
      });
    });

    it('returns error on supabase failure', async () => {
      const chain = createChain(null);
      chain.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'create_lead_magnet', { title: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insert failed');
    });
  });
});
