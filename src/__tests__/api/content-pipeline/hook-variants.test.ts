/**
 * @jest-environment node
 */

import { POST } from '@/app/api/content-pipeline/posts/[id]/hook-variants/route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock hook generator AI module
jest.mock('@/lib/ai/content-pipeline/hook-generator', () => ({
  generateHookVariants: jest.fn(),
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
import { generateHookVariants } from '@/lib/ai/content-pipeline/hook-generator';

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

describe('Hook Variants API — POST /api/content-pipeline/posts/[id]/hook-variants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  it('should return 401 when not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/content-pipeline/posts/post-1/hook-variants',
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
      'http://localhost:3000/api/content-pipeline/posts/nonexistent/hook-variants',
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
      data: { id: 'post-1', final_content: null, draft_content: null, variations: null },
      error: null,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/content-pipeline/posts/post-1/hook-variants',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'post-1' }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Post has no content to generate variants from');
  });

  it('should return 3 variants with hook_type and content', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setTableResult('cp_pipeline_posts', {
      data: {
        id: 'post-1',
        final_content: 'I lost $50,000 in 30 days.\n\nHere is what I learned about sales.',
        draft_content: null,
        variations: null,
      },
      error: null,
    });
    mock.setUpdateResult('cp_pipeline_posts', { data: null, error: null });

    const mockVariants = [
      {
        hook_type: 'question',
        content: 'What would you do if you lost $50K?\n\nHere is what I learned about sales.',
      },
      {
        hook_type: 'story',
        content: 'I stared at the dashboard.\n\nHere is what I learned about sales.',
      },
      {
        hook_type: 'statistic',
        content: '73% of startups fail in year one.\n\nHere is what I learned about sales.',
      },
    ];
    (generateHookVariants as jest.Mock).mockResolvedValue(mockVariants);

    const request = new NextRequest(
      'http://localhost:3000/api/content-pipeline/posts/post-1/hook-variants',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'post-1' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.variants).toHaveLength(3);
    expect(data.variants[0].hook_type).toBe('question');
    expect(data.variants[1].hook_type).toBe('story');
    expect(data.variants[2].hook_type).toBe('statistic');

    // Each variant should have id, content, hook_type, selected
    for (const variant of data.variants) {
      expect(variant.id).toMatch(/^hook-variant-\d+-\d+$/);
      expect(typeof variant.content).toBe('string');
      expect(variant.selected).toBe(false);
    }

    // Verify generateHookVariants was called with final_content
    expect(generateHookVariants).toHaveBeenCalledWith(
      'I lost $50,000 in 30 days.\n\nHere is what I learned about sales.'
    );
  });

  it('should fall back to draft_content when final_content is null', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setTableResult('cp_pipeline_posts', {
      data: {
        id: 'post-2',
        final_content: null,
        draft_content: 'Draft hook here.\n\nDraft body content.',
        variations: null,
      },
      error: null,
    });
    mock.setUpdateResult('cp_pipeline_posts', { data: null, error: null });

    (generateHookVariants as jest.Mock).mockResolvedValue([
      { hook_type: 'question', content: 'Question variant?\n\nDraft body content.' },
    ]);

    const request = new NextRequest(
      'http://localhost:3000/api/content-pipeline/posts/post-2/hook-variants',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'post-2' }),
    });

    expect(response.status).toBe(200);
    expect(generateHookVariants).toHaveBeenCalledWith(
      'Draft hook here.\n\nDraft body content.'
    );
  });

  it('should save variants to post via supabase update', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setTableResult('cp_pipeline_posts', {
      data: {
        id: 'post-1',
        final_content: 'Great hook content.\n\nBody here.',
        draft_content: null,
        variations: null,
      },
      error: null,
    });
    mock.setUpdateResult('cp_pipeline_posts', { data: null, error: null });

    (generateHookVariants as jest.Mock).mockResolvedValue([
      { hook_type: 'question', content: 'Question?\n\nBody here.' },
      { hook_type: 'story', content: 'Story opener.\n\nBody here.' },
      { hook_type: 'statistic', content: '99% stat.\n\nBody here.' },
    ]);

    const request = new NextRequest(
      'http://localhost:3000/api/content-pipeline/posts/post-1/hook-variants',
      { method: 'POST' }
    );
    await POST(request, {
      params: Promise.resolve({ id: 'post-1' }),
    });

    // Verify supabase update was called (second from() call on cp_pipeline_posts)
    expect(mock.client.from).toHaveBeenCalledTimes(2);
    expect(mock.client.from).toHaveBeenNthCalledWith(2, 'cp_pipeline_posts');
  });

  it('should merge new variants with existing variations', async () => {
    const existingVariations = [
      { id: 'existing-1', content: 'Old variant', hook_type: 'question', selected: true },
    ];

    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setTableResult('cp_pipeline_posts', {
      data: {
        id: 'post-1',
        final_content: 'Hook line.\n\nBody content.',
        draft_content: null,
        variations: existingVariations,
      },
      error: null,
    });
    mock.setUpdateResult('cp_pipeline_posts', { data: null, error: null });

    (generateHookVariants as jest.Mock).mockResolvedValue([
      { hook_type: 'story', content: 'New story hook.\n\nBody content.' },
    ]);

    const request = new NextRequest(
      'http://localhost:3000/api/content-pipeline/posts/post-1/hook-variants',
      { method: 'POST' }
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: 'post-1' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    // Response should contain only the NEW variants (not existing ones)
    expect(data.variants).toHaveLength(1);
    expect(data.variants[0].hook_type).toBe('story');
  });
});
