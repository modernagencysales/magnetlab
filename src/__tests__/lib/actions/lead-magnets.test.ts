/**
 * @jest-environment node
 *
 * Lead Magnet Actions Tests (Teams V3)
 * Actions now delegate to lead-magnets.repo which uses DataScope via applyScope().
 * Team context filters by team_id; personal context filters by user_id.
 */

// Helper to create a thenable Supabase query chain mock
function createChain(resolveData: unknown = []) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['select', 'insert', 'update', 'eq', 'not', 'is', 'neq', 'order', 'limit', 'range'];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue({ data: resolveData, error: null });
  // Make the chain thenable for queries that don't end with .single()
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
  polishPost: jest
    .fn()
    .mockResolvedValue({ original: '', polished: '', changes: [], hookScore: 0 }),
}));

jest.mock('@/lib/ai/copilot/lead-magnet-creation', () => ({
  analyzeContextGaps: jest
    .fn()
    .mockResolvedValue({
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

import { executeAction, actionRequiresConfirmation } from '@/lib/actions/executor';
import type { ActionContext } from '@/lib/actions/types';

// Import all action modules to trigger registration
import '@/lib/actions/lead-magnets';

const testCtx: ActionContext = {
  scope: { type: 'team', userId: 'user-test-123', teamId: 'team-test-456' },
};

const personalCtx: ActionContext = {
  scope: { type: 'user', userId: 'user-test-123' },
};

describe('Lead Magnet Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.fromFn = jest.fn(() => createChain());
  });

  describe('list_lead_magnets', () => {
    it('returns lead magnets array on success', async () => {
      const mockMagnets = [
        {
          id: 'lm1',
          title: 'Growth Guide',
          status: 'published',
          archetype: 'guide',
          created_at: '2026-02-20T10:00:00Z',
          updated_at: '2026-02-25T10:00:00Z',
        },
        {
          id: 'lm2',
          title: 'Sales Checklist',
          status: 'draft',
          archetype: 'checklist',
          created_at: '2026-02-21T10:00:00Z',
          updated_at: '2026-02-26T10:00:00Z',
        },
      ];

      mockState.fromFn.mockReturnValueOnce(createChain(mockMagnets));

      const result = await executeAction(testCtx, 'list_lead_magnets', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('returns empty array when no lead magnets exist', async () => {
      mockState.fromFn.mockReturnValueOnce(createChain([]));

      const result = await executeAction(testCtx, 'list_lead_magnets', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('applies team scope (team_id filter) for team context', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_lead_magnets', {});

      // applyScope with team context filters by team_id
      expect(chain.eq).toHaveBeenCalledWith('team_id', 'team-test-456');
    });

    it('applies user scope (user_id filter) for personal context', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(personalCtx, 'list_lead_magnets', {});

      // applyScope with personal context filters by user_id
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-test-123');
    });

    it('filters by status when provided', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_lead_magnets', { status: 'published' });

      expect(chain.eq).toHaveBeenCalledWith('status', 'published');
    });

    it('orders by created_at descending', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_lead_magnets', {});

      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('returns error when supabase fails', async () => {
      const chain = createChain([]);
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { data: null; error: { message: string }; count: null }) => unknown) =>
          resolve({ data: null, error: { message: 'Database error' }, count: null })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'list_lead_magnets', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
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
      expect((result.data as { id: string }).id).toBe('lm1');
    });

    it('returns error when lead magnet not found', async () => {
      const chain = createChain(null);
      chain.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'get_lead_magnet', { id: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Lead magnet not found');
    });

    it('applies team scope to the query', async () => {
      const chain = createChain({ id: 'lm1' });
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'get_lead_magnet', { id: 'lm1' });

      expect(chain.eq).toHaveBeenCalledWith('id', 'lm1');
      // applyScope with team context filters by team_id
      expect(chain.eq).toHaveBeenCalledWith('team_id', 'team-test-456');
    });
  });

  describe('save_lead_magnet', () => {
    it('requires confirmation', () => {
      expect(actionRequiresConfirmation('save_lead_magnet')).toBe(true);
    });

    it('saves a lead magnet with content blocks', async () => {
      const mockCreated = {
        id: 'lm-new',
        title: 'My Guide',
        archetype: 'single-system',
        status: 'draft',
        created_at: '2026-03-10',
      };
      const chain = createChain(mockCreated);
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'save_lead_magnet', {
        title: 'My Guide',
        archetype: 'single-system',
        content_blocks: { structure: [] },
      });

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
    });

    it('inserts with correct user_id and team_id from scope', async () => {
      const chain = createChain({ id: 'lm-new' });
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'save_lead_magnet', {
        title: 'Test Guide',
        archetype: 'guide',
        content_blocks: {},
      });

      // createLeadMagnet inserts with user_id + team_id
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-test-123',
          team_id: 'team-test-456',
          status: 'draft',
        })
      );
    });

    it('returns error on supabase failure', async () => {
      const chain = createChain(null);
      chain.single = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'save_lead_magnet', {
        title: 'Test',
        archetype: 'single-system',
        content_blocks: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insert failed');
    });
  });
});
