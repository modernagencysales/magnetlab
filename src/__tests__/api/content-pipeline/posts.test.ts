/**
 * @jest-environment node
 */

import { GET } from '@/app/api/content-pipeline/posts/route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

// Mock team context (scope from cookie/headers)
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/**
 * Creates a mock Supabase client that supports the chainable query pattern
 * used by the posts route: from → select → eq → order → limit → eq (filter)
 */
function createMockSupabase() {
  type TableResult = { data: unknown; error: unknown };

  const tableResults: Record<string, TableResult> = {};

  function createChain(tableName: string) {
    const chain: Record<string, jest.Mock> = {};

    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.in = jest.fn(() => chain);
    chain.order = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);

    // Make the chain thenable so `await query` resolves
    Object.defineProperty(chain, 'then', {
      value: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        const result = tableResults[tableName] || { data: [], error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
      enumerable: false,
    });

    return chain;
  }

  const client = {
    from: jest.fn((table: string) => createChain(table)),
  };

  return {
    client,
    setTableResult: (table: string, result: TableResult) => {
      tableResults[table] = result;
    },
    reset: () => {
      Object.keys(tableResults).forEach(k => delete tableResults[k]);
    },
  };
}

let mock: ReturnType<typeof createMockSupabase>;

describe('Content Pipeline — Posts API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
    // Default: user scope (no team)
    (getDataScope as jest.Mock).mockImplementation(async (userId: string) => ({
      type: 'user',
      userId,
    }));
  });

  describe('GET /api/content-pipeline/posts', () => {
    it('should return 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should list only the authenticated user\'s posts', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const posts = [
        {
          id: 'post-1',
          user_id: 'user-1',
          idea_id: 'idea-1',
          template_id: null,
          style_id: null,
          draft_content: 'Draft content here',
          final_content: null,
          dm_template: null,
          cta_word: null,
          variations: null,
          status: 'draft',
          hook_score: null,
          polish_status: null,
          polish_notes: null,
          scheduled_time: null,
          auto_publish_after: null,
          is_buffer: false,
          buffer_position: null,
          linkedin_post_id: null,
          publish_provider: null,
          lead_magnet_id: null,
          published_at: null,
          engagement_stats: null,
          team_profile_id: null,
          created_at: '2026-02-14T00:00:00Z',
          updated_at: '2026-02-14T00:00:00Z',
        },
        {
          id: 'post-2',
          user_id: 'user-1',
          idea_id: 'idea-2',
          template_id: null,
          style_id: null,
          draft_content: 'Another draft',
          final_content: 'Polished content',
          dm_template: null,
          cta_word: null,
          variations: null,
          status: 'review',
          hook_score: 85,
          polish_status: 'polished',
          polish_notes: null,
          scheduled_time: null,
          auto_publish_after: null,
          is_buffer: false,
          buffer_position: null,
          linkedin_post_id: null,
          publish_provider: null,
          lead_magnet_id: null,
          published_at: null,
          engagement_stats: null,
          team_profile_id: null,
          created_at: '2026-02-13T00:00:00Z',
          updated_at: '2026-02-14T01:00:00Z',
        },
      ];

      mock.setTableResult('cp_pipeline_posts', { data: posts, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.posts).toHaveLength(2);
      expect(data.posts[0].id).toBe('post-1');
      expect(data.posts[1].id).toBe('post-2');

      // Verify correct table was queried
      expect(mock.client.from).toHaveBeenCalledWith('cp_pipeline_posts');
    });

    it('should return posts filtered by status when query param provided', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const reviewPosts = [
        {
          id: 'post-3',
          user_id: 'user-1',
          idea_id: null,
          template_id: null,
          style_id: null,
          draft_content: 'Ready for review',
          final_content: 'Final version',
          dm_template: null,
          cta_word: null,
          variations: null,
          status: 'review',
          hook_score: 90,
          polish_status: 'polished',
          polish_notes: null,
          scheduled_time: null,
          auto_publish_after: null,
          is_buffer: false,
          buffer_position: null,
          linkedin_post_id: null,
          publish_provider: null,
          lead_magnet_id: null,
          published_at: null,
          engagement_stats: null,
          team_profile_id: null,
          created_at: '2026-02-14T00:00:00Z',
          updated_at: '2026-02-14T00:00:00Z',
        },
      ];

      mock.setTableResult('cp_pipeline_posts', { data: reviewPosts, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts?status=review');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.posts).toHaveLength(1);
      expect(data.posts[0].status).toBe('review');
    });

    it('should return empty array when user has no posts', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-empty' } });
      mock.setTableResult('cp_pipeline_posts', { data: [], error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.posts).toHaveLength(0);
    });

    it('should return 500 when database query fails', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('cp_pipeline_posts', {
        data: null,
        error: { message: 'Connection timeout', code: '500' },
      });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('should filter by is_buffer query param', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const bufferPosts = [
        {
          id: 'post-buf-1',
          user_id: 'user-1',
          idea_id: null,
          template_id: null,
          style_id: null,
          draft_content: 'Buffer post',
          final_content: null,
          dm_template: null,
          cta_word: null,
          variations: null,
          status: 'scheduled',
          hook_score: null,
          polish_status: null,
          polish_notes: null,
          scheduled_time: '2026-02-15T09:00:00Z',
          auto_publish_after: null,
          is_buffer: true,
          buffer_position: 1,
          linkedin_post_id: null,
          publish_provider: null,
          lead_magnet_id: null,
          published_at: null,
          engagement_stats: null,
          team_profile_id: null,
          created_at: '2026-02-14T00:00:00Z',
          updated_at: '2026-02-14T00:00:00Z',
        },
      ];

      mock.setTableResult('cp_pipeline_posts', { data: bufferPosts, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts?is_buffer=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.posts).toHaveLength(1);
      expect(data.posts[0].is_buffer).toBe(true);
    });
  });
});
