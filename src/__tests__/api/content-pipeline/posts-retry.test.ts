/**
 * @jest-environment node
 */

import { POST } from '@/app/api/content-pipeline/posts/[id]/retry/route';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock logger (suppress output in tests)
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/**
 * Creates a mock Supabase client that supports chaining.
 * Tracks calls to from/select/update/eq/single so we can
 * control their return values per test.
 */
function createMockSupabase() {
  let selectResult: { data: unknown; error: unknown } = { data: null, error: null };
  let updateResult: { data: unknown; error: unknown } = { data: null, error: null };

  const chain: Record<string, jest.Mock> = {};

  // single() resolves the select chain
  chain.single = jest.fn(() => Promise.resolve(selectResult));

  // eq() returns the chain for further chaining
  chain.eq = jest.fn(() => chain);

  // select() returns the chain
  chain.select = jest.fn(() => chain);

  // update() switches to "update mode" -- subsequent eq()/select()/single() calls resolve with updateResult
  chain.update = jest.fn(() => {
    // Create a separate chain for updates
    const updateChain: Record<string, jest.Mock> = {};
    updateChain.eq = jest.fn(() => updateChain);
    updateChain.select = jest.fn(() => updateChain);
    updateChain.single = jest.fn(() => Promise.resolve(updateResult));
    updateChain.then = jest.fn((onFulfilled?: (value: unknown) => unknown) => {
      return Promise.resolve(updateResult).then(onFulfilled);
    }) as jest.Mock;
    return updateChain;
  });

  const client = {
    from: jest.fn(() => chain),
  };

  return {
    client,
    setSelectResult: (result: { data: unknown; error: unknown }) => {
      selectResult = result;
    },
    setUpdateResult: (result: { data: unknown; error: unknown }) => {
      updateResult = result;
    },
  };
}

function buildRequest(postId: string) {
  return new Request(`http://localhost:3000/api/content-pipeline/posts/${postId}/retry`, {
    method: 'POST',
  });
}

function buildParams(postId: string) {
  return { params: Promise.resolve({ id: postId }) };
}

let mock: ReturnType<typeof createMockSupabase>;

describe('POST /api/content-pipeline/posts/[id]/retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  it('should return 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(buildRequest('post-1'), buildParams('post-1'));

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when post not found', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setSelectResult({ data: null, error: { code: 'PGRST116', message: 'Not found' } });

    const response = await POST(buildRequest('nonexistent'), buildParams('nonexistent'));

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Post not found');
  });

  it('should return 400 when post is not in publish_failed status', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setSelectResult({
      data: { id: 'post-1', status: 'draft', user_id: 'user-1' },
      error: null,
    });

    const response = await POST(buildRequest('post-1'), buildParams('post-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Only failed posts can be retried');
  });

  it('should return 400 when post is in published status', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setSelectResult({
      data: { id: 'post-1', status: 'published', user_id: 'user-1' },
      error: null,
    });

    const response = await POST(buildRequest('post-1'), buildParams('post-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Only failed posts can be retried');
  });

  it('should reset publish_failed post to scheduled and clear error_log', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setSelectResult({
      data: { id: 'post-1', status: 'publish_failed', user_id: 'user-1' },
      error: null,
    });
    mock.setUpdateResult({ data: null, error: null });

    const response = await POST(buildRequest('post-1'), buildParams('post-1'));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Post queued for retry');

    // Verify supabase.from was called for the update
    expect(mock.client.from).toHaveBeenCalledWith('cp_pipeline_posts');
  });

  it('should return 500 when database update fails', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setSelectResult({
      data: { id: 'post-1', status: 'publish_failed', user_id: 'user-1' },
      error: null,
    });
    mock.setUpdateResult({
      data: null,
      error: { message: 'DB write failed', code: '500' },
    });

    const response = await POST(buildRequest('post-1'), buildParams('post-1'));

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('DB write failed');
  });
});
