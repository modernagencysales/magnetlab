/**
 * @jest-environment node
 */

import { POST } from '@/app/api/content-pipeline/posts/[id]/hook-score/route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock hook scorer AI module
jest.mock('@/lib/ai/content-pipeline/hook-scorer', () => ({
  scoreHook: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { scoreHook } from '@/lib/ai/content-pipeline/hook-scorer';

/**
 * Creates a mock Supabase client that supports chainable query patterns.
 */
function createMockSupabase() {
  type TableResult = { data: unknown; error: unknown };

  const tableResults: Record<string, TableResult> = {};
  const updateResults: Record<string, TableResult> = {};

  function createSelectChain(tableName: string) {
    const chain: Record<string, jest.Mock> = {};

    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.single = jest.fn(() => chain);

    Object.defineProperty(chain, 'then', {
      value: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        const result = tableResults[tableName] || { data: null, error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
      enumerable: false,
    });

    return chain;
  }

  function createUpdateChain(tableName: string) {
    const chain: Record<string, jest.Mock> = {};

    chain.update = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);

    Object.defineProperty(chain, 'then', {
      value: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        const result = updateResults[tableName] || { data: null, error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
      enumerable: false,
    });

    return chain;
  }

  // Track call order to return select chain first, update chain second
  const callCount: Record<string, number> = {};

  const client = {
    from: jest.fn((table: string) => {
      callCount[table] = (callCount[table] || 0) + 1;
      // First call is select, second call is update
      if (callCount[table] === 1) {
        return createSelectChain(table);
      }
      return createUpdateChain(table);
    }),
  };

  return {
    client,
    setTableResult: (table: string, result: TableResult) => {
      tableResults[table] = result;
    },
    setUpdateResult: (table: string, result: TableResult) => {
      updateResults[table] = result;
    },
    resetCallCount: () => {
      Object.keys(callCount).forEach(k => delete callCount[k]);
    },
  };
}

let mock: ReturnType<typeof createMockSupabase>;

describe('Hook Score API — POST /api/content-pipeline/posts/[id]/hook-score', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  it('should return 401 when not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/content-pipeline/posts/post-1/hook-score',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'post-1' }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when post not found', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setTableResult('cp_pipeline_posts', { data: null, error: { message: 'Not found' } });

    const request = new NextRequest(
      'http://localhost:3000/api/content-pipeline/posts/nonexistent/hook-score',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Post not found');
  });

  it('should return 400 when post has no content', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setTableResult('cp_pipeline_posts', {
      data: { id: 'post-1', final_content: null, draft_content: null },
      error: null,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/content-pipeline/posts/post-1/hook-score',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'post-1' }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Post has no content to score');
  });

  it('should return score + breakdown + suggestions for post with final_content', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setTableResult('cp_pipeline_posts', {
      data: {
        id: 'post-1',
        final_content: 'I lost $50,000 in 30 days.\n\nHere is what I learned.',
        draft_content: 'Some draft text',
      },
      error: null,
    });
    mock.setUpdateResult('cp_pipeline_posts', { data: null, error: null });

    const mockResult = {
      score: 8,
      breakdown: {
        curiosity_gap: 9,
        power_words: 7,
        pattern_interrupt: 8,
        specificity: 9,
      },
      suggestions: [
        'Add a time constraint for urgency',
        'Use a more unexpected opening word',
      ],
    };
    (scoreHook as jest.Mock).mockResolvedValue(mockResult);

    const request = new NextRequest(
      'http://localhost:3000/api/content-pipeline/posts/post-1/hook-score',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'post-1' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.score).toBe(8);
    expect(data.breakdown).toEqual({
      curiosity_gap: 9,
      power_words: 7,
      pattern_interrupt: 8,
      specificity: 9,
    });
    expect(data.suggestions).toHaveLength(2);
    expect(data.suggestions[0]).toBe('Add a time constraint for urgency');

    // Verify scoreHook was called with final_content (preferred over draft)
    expect(scoreHook).toHaveBeenCalledWith(
      'I lost $50,000 in 30 days.\n\nHere is what I learned.'
    );
  });

  it('should fall back to draft_content when final_content is null', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setTableResult('cp_pipeline_posts', {
      data: {
        id: 'post-2',
        final_content: null,
        draft_content: 'This is a draft hook.\n\nThe rest of the post.',
      },
      error: null,
    });
    mock.setUpdateResult('cp_pipeline_posts', { data: null, error: null });

    const mockResult = {
      score: 5,
      breakdown: {
        curiosity_gap: 4,
        power_words: 5,
        pattern_interrupt: 5,
        specificity: 6,
      },
      suggestions: ['Make the opening more specific'],
    };
    (scoreHook as jest.Mock).mockResolvedValue(mockResult);

    const request = new NextRequest(
      'http://localhost:3000/api/content-pipeline/posts/post-2/hook-score',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'post-2' }),
    });

    expect(response.status).toBe(200);
    expect(scoreHook).toHaveBeenCalledWith(
      'This is a draft hook.\n\nThe rest of the post.'
    );
  });

  it('should save hook_score back to the post', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setTableResult('cp_pipeline_posts', {
      data: {
        id: 'post-1',
        final_content: 'Great hook content',
        draft_content: null,
      },
      error: null,
    });
    mock.setUpdateResult('cp_pipeline_posts', { data: null, error: null });

    (scoreHook as jest.Mock).mockResolvedValue({
      score: 7,
      breakdown: {
        curiosity_gap: 7,
        power_words: 7,
        pattern_interrupt: 7,
        specificity: 7,
      },
      suggestions: [],
    });

    const request = new NextRequest(
      'http://localhost:3000/api/content-pipeline/posts/post-1/hook-score',
      { method: 'POST' }
    );
    await POST(request, {
      params: Promise.resolve({ id: 'post-1' }),
    });

    // Verify supabase update was called (second from() call on cp_pipeline_posts)
    expect(mock.client.from).toHaveBeenCalledTimes(2);
    expect(mock.client.from).toHaveBeenNthCalledWith(2, 'cp_pipeline_posts');
  });
});
