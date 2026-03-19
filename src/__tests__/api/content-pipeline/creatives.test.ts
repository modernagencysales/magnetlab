/**
 * @jest-environment node
 */

import { GET, POST } from '@/app/api/content-pipeline/creatives/route';
import { GET as GET_BY_ID, PATCH, DELETE } from '@/app/api/content-pipeline/creatives/[id]/route';
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

// Mock team-context (getDataScope returns personal scope by default)
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn().mockResolvedValue({ type: 'user', userId: 'user-1' }),
}));

// Mock AI creative analyzer (avoid real API calls in tests)
jest.mock('@/lib/ai/content-pipeline/creative-analyzer', () => ({
  analyzeCreative: jest.fn().mockResolvedValue({
    creative_type: 'tweet_screenshot',
    topics: ['cold email', 'B2B sales'],
    commentary_worthy_score: 8,
    suggested_hooks: ['Hook idea 1', 'Hook idea 2'],
    suggested_exploit_slug: 'commentary-on-tweet',
  }),
}));

// Mock exploits service (getExploitBySlug resolves to null by default)
jest.mock('@/server/services/exploits.service', () => ({
  getExploitBySlug: jest.fn().mockResolvedValue(null),
  getStatusCode: jest.fn((err: unknown) => {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      return (err as { statusCode: number }).statusCode;
    }
    return 500;
  }),
}));

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Mock Supabase chain builder ─────────────────────────────────────────────

function createMockSupabase() {
  type TableResult = { data: unknown; error: unknown; count?: number | null };
  const tableResults: Record<string, TableResult> = {};

  function createChain(tableName: string) {
    const chain: Record<string, jest.Mock> = {};

    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.or = jest.fn(() => chain);
    chain.in = jest.fn(() => chain);
    chain.order = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);
    chain.gte = jest.fn(() => chain);
    chain.insert = jest.fn(() => chain);
    chain.update = jest.fn(() => chain);
    chain.delete = jest.fn(() => chain);
    chain.maybeSingle = jest.fn(() =>
      Promise.resolve(tableResults[tableName] || { data: null, error: null })
    );

    Object.defineProperty(chain, 'then', {
      value: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        const result = tableResults[tableName] || { data: [], error: null, count: 0 };
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
      Object.keys(tableResults).forEach((k) => delete tableResults[k]);
    },
  };
}

let mock: ReturnType<typeof createMockSupabase>;

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CREATIVE = {
  id: 'creative-1',
  user_id: 'user-1',
  team_id: null,
  source_platform: 'twitter',
  source_url: 'https://x.com/example/status/123',
  source_author: '@example',
  content_text: 'Cold email is dead. Here is why...',
  image_url: null,
  creative_type: 'tweet_screenshot',
  topics: ['cold email', 'B2B sales'],
  commentary_worthy_score: 8,
  suggested_hooks: ['Hook idea 1', 'Hook idea 2'],
  suggested_exploit_id: null,
  status: 'new',
  times_used: 0,
  created_at: '2026-03-19T00:00:00Z',
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Content Pipeline — Creatives API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  // ─── GET /api/content-pipeline/creatives ───────────────────────────────

  describe('GET /api/content-pipeline/creatives', () => {
    it('returns 401 without auth', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/creatives');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns creatives list with 200', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const creatives = [MOCK_CREATIVE, { ...MOCK_CREATIVE, id: 'creative-2' }];
      mock.setTableResult('cp_creatives', { data: creatives, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/creatives');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.creatives).toHaveLength(2);
      expect(data.creatives[0].id).toBe('creative-1');
      expect(mock.client.from).toHaveBeenCalledWith('cp_creatives');
    });

    it('returns empty array when no creatives exist', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-empty' } });
      mock.setTableResult('cp_creatives', { data: [], error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/creatives');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.creatives).toHaveLength(0);
    });

    it('returns 500 when database query fails', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('cp_creatives', {
        data: null,
        error: { message: 'Connection timeout', code: '500' },
      });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/creatives');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });

  // ─── POST /api/content-pipeline/creatives ──────────────────────────────

  describe('POST /api/content-pipeline/creatives', () => {
    it('returns 401 without auth', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/creatives', {
        method: 'POST',
        body: JSON.stringify({ content_text: 'Some tweet content' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('returns 400 on invalid body (Zod validation)', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/creatives', {
        method: 'POST',
        // content_text is required and must not be empty
        body: JSON.stringify({ content_text: '' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('creates creative and returns 201', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('cp_creatives', { data: MOCK_CREATIVE, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/creatives', {
        method: 'POST',
        body: JSON.stringify({
          content_text: 'Cold email is dead. Here is why...',
          source_platform: 'twitter',
          source_url: 'https://x.com/example/status/123',
          source_author: '@example',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.creative).toBeDefined();
      expect(data.creative.id).toBe('creative-1');
      expect(data.creative.status).toBe('new');
    });
  });

  // ─── GET /api/content-pipeline/creatives/[id] ──────────────────────────

  describe('GET /api/content-pipeline/creatives/[id]', () => {
    it('returns 401 without auth', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/content-pipeline/creatives/creative-1'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'creative-1' }),
      });

      expect(response.status).toBe(401);
    });

    it('returns single creative by ID', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('cp_creatives', { data: MOCK_CREATIVE, error: null });

      const request = new NextRequest(
        'http://localhost:3000/api/content-pipeline/creatives/creative-1'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'creative-1' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.creative.id).toBe('creative-1');
    });

    it('returns 404 when creative not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('cp_creatives', { data: null, error: null });

      const request = new NextRequest(
        'http://localhost:3000/api/content-pipeline/creatives/nonexistent'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
    });
  });

  // ─── PATCH /api/content-pipeline/creatives/[id] ────────────────────────

  describe('PATCH /api/content-pipeline/creatives/[id]', () => {
    it('updates creative status', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      const updatedCreative = { ...MOCK_CREATIVE, status: 'approved' };
      mock.setTableResult('cp_creatives', { data: updatedCreative, error: null });

      const request = new NextRequest(
        'http://localhost:3000/api/content-pipeline/creatives/creative-1',
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'approved' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'creative-1' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.creative.status).toBe('approved');
    });

    it('returns 400 on invalid status value', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const request = new NextRequest(
        'http://localhost:3000/api/content-pipeline/creatives/creative-1',
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'invalid_status' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'creative-1' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('returns 404 when creative not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('cp_creatives', { data: null, error: null });

      const request = new NextRequest(
        'http://localhost:3000/api/content-pipeline/creatives/nonexistent',
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'approved' }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
    });
  });

  // ─── DELETE /api/content-pipeline/creatives/[id] ───────────────────────

  describe('DELETE /api/content-pipeline/creatives/[id]', () => {
    it('removes creative and returns success', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('cp_creatives', { data: null, error: null, count: 1 });

      const request = new NextRequest(
        'http://localhost:3000/api/content-pipeline/creatives/creative-1',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'creative-1' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/content-pipeline/creatives/creative-1',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'creative-1' }),
      });

      expect(response.status).toBe(401);
    });

    it('returns 404 when creative not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('cp_creatives', { data: null, error: null, count: 0 });

      const request = new NextRequest(
        'http://localhost:3000/api/content-pipeline/creatives/nonexistent',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
    });
  });
});
