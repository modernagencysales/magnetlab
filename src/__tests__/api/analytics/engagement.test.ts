/**
 * @jest-environment node
 */

import { GET } from '@/app/api/analytics/engagement/route';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/**
 * Creates a mock Supabase client that supports chaining and awaiting.
 * Each from() call creates an independent chain that captures its own table context.
 */
function createMockSupabase() {
  const tableResults: Record<string, { data: unknown; error: unknown }> = {};

  function createChain(table: string) {
    const resolve = () => Promise.resolve(tableResults[table] || { data: [], error: null });

    const chain: Record<string, unknown> = {
      then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
        return resolve().then(onFulfilled, onRejected);
      },
    };

    for (const method of ['select', 'eq', 'in', 'gte', 'order', 'single']) {
      chain[method] = jest.fn(() => chain);
    }

    return chain;
  }

  const client = {
    from: jest.fn((table: string) => createChain(table)),
  };

  return {
    client,
    setResult: (table: string, result: { data: unknown; error: unknown }) => {
      tableResults[table] = result;
    },
  };
}

let mock: ReturnType<typeof createMockSupabase>;

describe('GET /api/analytics/engagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  it('should return 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return zeros when user has no published posts', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('cp_pipeline_posts', { data: [], error: null });

    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.totals).toEqual({
      comments: 0,
      reactions: 0,
      dmsSent: 0,
      dmsFailed: 0,
    });
    expect(data.byPost).toEqual([]);
  });

  it('should aggregate engagement data by post', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    mock.setResult('cp_pipeline_posts', {
      data: [
        { id: 'post-1', title: 'First Post', published_at: '2026-02-10T10:00:00Z', linkedin_post_id: 'li-1' },
        { id: 'post-2', title: 'Second Post', published_at: '2026-02-12T10:00:00Z', linkedin_post_id: 'li-2' },
      ],
      error: null,
    });

    mock.setResult('cp_post_engagements', {
      data: [
        { post_id: 'post-1', engagement_type: 'comment' },
        { post_id: 'post-1', engagement_type: 'comment' },
        { post_id: 'post-1', engagement_type: 'reaction' },
        { post_id: 'post-2', engagement_type: 'reaction' },
        { post_id: 'post-2', engagement_type: 'reaction' },
      ],
      error: null,
    });

    mock.setResult('linkedin_automations', {
      data: [
        { id: 'auto-1', post_id: 'post-1' },
      ],
      error: null,
    });

    mock.setResult('linkedin_automation_events', {
      data: [
        { automation_id: 'auto-1', event_type: 'dm_sent' },
        { automation_id: 'auto-1', event_type: 'dm_sent' },
        { automation_id: 'auto-1', event_type: 'dm_failed' },
      ],
      error: null,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.totals.comments).toBe(2);
    expect(data.totals.reactions).toBe(3);
    expect(data.totals.dmsSent).toBe(2);
    expect(data.totals.dmsFailed).toBe(1);

    expect(data.byPost).toHaveLength(2);

    const post1 = data.byPost.find((p: { postId: string }) => p.postId === 'post-1');
    expect(post1.comments).toBe(2);
    expect(post1.reactions).toBe(1);
    expect(post1.dmsSent).toBe(2);

    const post2 = data.byPost.find((p: { postId: string }) => p.postId === 'post-2');
    expect(post2.comments).toBe(0);
    expect(post2.reactions).toBe(2);
    expect(post2.dmsSent).toBe(0);
  });

  it('should return 500 when engagement table errors occur', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    mock.setResult('cp_pipeline_posts', {
      data: [
        { id: 'post-1', title: 'My Post', published_at: '2026-02-10T10:00:00Z', linkedin_post_id: 'li-1' },
      ],
      error: null,
    });

    // Simulate table not existing
    mock.setResult('cp_post_engagements', {
      data: null,
      error: { message: 'relation does not exist', code: '42P01' },
    });

    mock.setResult('linkedin_automations', {
      data: null,
      error: { message: 'relation does not exist', code: '42P01' },
    });

    const response = await GET();

    expect(response.status).toBe(500);
  });

  it('should return 500 on database error for posts query', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    mock.setResult('cp_pipeline_posts', {
      data: null,
      error: { message: 'Database connection failed', code: '500' },
    });

    const response = await GET();

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.code).toBe('INTERNAL_ERROR');
  });
});
