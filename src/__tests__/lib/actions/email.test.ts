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

const mockSearchKnowledgeV2 = jest.fn().mockResolvedValue({ entries: [] });

jest.mock('@/lib/services/knowledge-brain', () => ({
  searchKnowledgeV2: (...args: unknown[]) => mockSearchKnowledgeV2(...args),
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

import { executeAction } from '@/lib/actions/executor';
import type { ActionContext } from '@/lib/actions/types';

// Import all action modules to trigger registration
import '@/lib/actions/email';

const testCtx: ActionContext = {
  userId: 'user-test-123',
  teamId: 'team-test-456',
};

describe('Email Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.fromFn = jest.fn(() => createChain());
    mockSearchKnowledgeV2.mockResolvedValue({ entries: [] });
  });

  describe('list_email_sequences', () => {
    it('returns sequences array with expected shape', async () => {
      const mockSequences = [
        { id: 'es1', name: 'Welcome Series', status: 'active', created_at: '2026-02-20T10:00:00Z' },
        { id: 'es2', name: 'Nurture Drip', status: 'draft', created_at: '2026-02-21T10:00:00Z' },
      ];

      mockState.fromFn.mockReturnValueOnce(createChain(mockSequences));

      const result = await executeAction(testCtx, 'list_email_sequences', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data).toEqual(mockSequences);
    });

    it('returns empty array when no sequences exist', async () => {
      mockState.fromFn.mockReturnValueOnce(createChain([]));

      const result = await executeAction(testCtx, 'list_email_sequences', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('passes limit parameter', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_email_sequences', { limit: 5 });

      expect(chain.limit).toHaveBeenCalledWith(5);
    });

    it('defaults limit to 10', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_email_sequences', {});

      expect(chain.limit).toHaveBeenCalledWith(10);
    });

    it('filters by status when provided', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_email_sequences', { status: 'active' });

      expect(chain.eq).toHaveBeenCalledWith('status', 'active');
    });

    it('orders by created_at descending', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'list_email_sequences', {});

      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('returns error when supabase fails', async () => {
      const chain = createChain([]);
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { data: null; error: { message: string } }) => unknown) =>
          resolve({ data: null, error: { message: 'Database error' } })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'list_email_sequences', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('get_subscriber_count', () => {
    it('returns count of active subscribers', async () => {
      const chain = createChain([]);
      // For head:true queries, Supabase returns { count, data, error }
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { count: number; data: null; error: null }) => unknown) =>
          resolve({ count: 42, data: null, error: null })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'get_subscriber_count', {});

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');
      expect(result.data).toEqual({ count: 42 });
    });

    it('returns zero when no subscribers', async () => {
      const chain = createChain([]);
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { count: number; data: null; error: null }) => unknown) =>
          resolve({ count: 0, data: null, error: null })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'get_subscriber_count', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ count: 0 });
    });

    it('filters by active status', async () => {
      const chain = createChain([]);
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { count: number; data: null; error: null }) => unknown) =>
          resolve({ count: 0, data: null, error: null })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'get_subscriber_count', {});

      expect(chain.eq).toHaveBeenCalledWith('status', 'active');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-test-123');
    });

    it('uses head:true count query', async () => {
      const chain = createChain([]);
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { count: number; data: null; error: null }) => unknown) =>
          resolve({ count: 0, data: null, error: null })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

      await executeAction(testCtx, 'get_subscriber_count', {});

      expect(chain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    });

    it('returns error when supabase fails', async () => {
      const chain = createChain([]);
      (chain as unknown as PromiseLike<unknown>).then = jest.fn(
        (resolve: (value: { count: null; data: null; error: { message: string } }) => unknown) =>
          resolve({ count: null, data: null, error: { message: 'Count failed' } })
      ) as jest.Mock;
      mockState.fromFn.mockReturnValueOnce(chain);

      const result = await executeAction(testCtx, 'get_subscriber_count', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Count failed');
    });
  });

  describe('generate_newsletter_email', () => {
    it('searches knowledge base and returns brief', async () => {
      const mockEntries = [
        { id: 'k1', content: 'Insight about growth', knowledge_type: 'insight', similarity: 0.92 },
        { id: 'k2', content: 'How to scale', knowledge_type: 'how_to', similarity: 0.88 },
      ];
      mockSearchKnowledgeV2.mockResolvedValue({ entries: mockEntries });

      const result = await executeAction(testCtx, 'generate_newsletter_email', { topic: 'growth strategies' });

      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('text');

      const data = result.data as { topic: string; knowledge_results: { entries: unknown[] }; brief: string };
      expect(data.topic).toBe('growth strategies');
      expect(data.knowledge_results.entries).toHaveLength(2);
      expect(data.brief).toContain('growth strategies');
    });

    it('calls searchKnowledgeV2 with user ID and topic', async () => {
      await executeAction(testCtx, 'generate_newsletter_email', { topic: 'AI automation' });

      expect(mockSearchKnowledgeV2).toHaveBeenCalledWith('user-test-123', { query: 'AI automation' });
    });

    it('handles empty knowledge results', async () => {
      mockSearchKnowledgeV2.mockResolvedValue({ entries: [] });

      const result = await executeAction(testCtx, 'generate_newsletter_email', { topic: 'obscure topic' });

      expect(result.success).toBe(true);
      const data = result.data as { brief: string };
      expect(data.brief).toContain('0 relevant knowledge entries');
    });

    it('handles searchKnowledgeV2 throwing an error', async () => {
      mockSearchKnowledgeV2.mockRejectedValue(new Error('Embedding service unavailable'));

      const result = await executeAction(testCtx, 'generate_newsletter_email', { topic: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Embedding service unavailable');
    });
  });
});
