/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock auth
const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

/**
 * Creates a chainable Supabase mock that routes different tables to different results.
 * Matches the pattern used in conversations.test.ts.
 */
function createMockSupabase() {
  type TableResult = { data: unknown; error: unknown };
  const tableResults: Record<string, TableResult> = {};

  function createChain(tableName: string) {
    const chain: Record<string, jest.Mock> = {};

    chain.select = jest.fn(() => chain);
    chain.insert = jest.fn(() => chain);
    chain.update = jest.fn(() => chain);
    chain.delete = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.order = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);
    chain.single = jest.fn(() => {
      const result = tableResults[tableName] || { data: null, error: null };
      return Promise.resolve(result);
    });

    // Make chain thenable so `await supabase.from(...).select(...)...` works
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

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { GET, POST } from '@/app/api/copilot/memories/route';
import { PATCH, DELETE } from '@/app/api/copilot/memories/[id]/route';

let mock: ReturnType<typeof createMockSupabase>;

// Helper to build params matching Next.js 15 dynamic route shape
function buildRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('Copilot Memories API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  // ─── GET /api/copilot/memories ───────────────────────────────────
  describe('GET /api/copilot/memories', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/copilot/memories');
      const res = await GET(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns memories for the authenticated user', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const mockMemories = [
        { id: 'm1', rule: 'No bullet points', category: 'structure', confidence: 0.9, source: 'conversation', active: true, created_at: '2026-02-28T00:00:00Z' },
        { id: 'm2', rule: 'Use casual tone', category: 'tone', confidence: 1.0, source: 'manual', active: true, created_at: '2026-02-27T00:00:00Z' },
      ];
      mock.setTableResult('copilot_memories', { data: mockMemories, error: null });

      const req = new NextRequest('http://localhost/api/copilot/memories');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.memories).toHaveLength(2);
      expect(body.memories[0].id).toBe('m1');
      expect(mock.client.from).toHaveBeenCalledWith('copilot_memories');
    });

    it('returns empty array when user has no memories', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-empty' } });
      mock.setTableResult('copilot_memories', { data: [], error: null });

      const req = new NextRequest('http://localhost/api/copilot/memories');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.memories).toHaveLength(0);
    });

    it('filters by active status from query param', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const activeOnly = [
        { id: 'm1', rule: 'Active rule', category: 'tone', confidence: 1.0, source: 'manual', active: true, created_at: '2026-02-28T00:00:00Z' },
      ];
      mock.setTableResult('copilot_memories', { data: activeOnly, error: null });

      const req = new NextRequest('http://localhost/api/copilot/memories?active=true');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.memories).toHaveLength(1);
    });

    it('returns 500 on database error', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_memories', { data: null, error: { message: 'Connection timeout' } });

      const req = new NextRequest('http://localhost/api/copilot/memories');
      const res = await GET(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Connection timeout');
    });
  });

  // ─── POST /api/copilot/memories ──────────────────────────────────
  describe('POST /api/copilot/memories', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/copilot/memories', {
        method: 'POST',
        body: JSON.stringify({ rule: 'Test', category: 'tone' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('creates a manual memory', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const created = { id: 'm-new', rule: 'Use casual tone', category: 'tone', confidence: 1.0, source: 'manual', active: true, created_at: '2026-02-28T00:00:00Z' };
      mock.setTableResult('copilot_memories', { data: created, error: null });

      const req = new NextRequest('http://localhost/api/copilot/memories', {
        method: 'POST',
        body: JSON.stringify({ rule: 'Use casual tone', category: 'tone' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.memory.id).toBe('m-new');
      expect(body.memory.rule).toBe('Use casual tone');
      expect(body.memory.source).toBe('manual');
    });

    it('returns 400 when rule is missing', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const req = new NextRequest('http://localhost/api/copilot/memories', {
        method: 'POST',
        body: JSON.stringify({ category: 'tone' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('rule is required');
    });

    it('returns 400 when rule is empty string', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const req = new NextRequest('http://localhost/api/copilot/memories', {
        method: 'POST',
        body: JSON.stringify({ rule: '   ', category: 'tone' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('rule is required');
    });

    it('returns 400 when category is invalid', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const req = new NextRequest('http://localhost/api/copilot/memories', {
        method: 'POST',
        body: JSON.stringify({ rule: 'Test', category: 'invalid' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('category must be one of');
    });

    it('returns 500 on insert failure', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_memories', { data: null, error: { message: 'unique violation' } });

      const req = new NextRequest('http://localhost/api/copilot/memories', {
        method: 'POST',
        body: JSON.stringify({ rule: 'Test', category: 'tone' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
    });
  });

  // ─── PATCH /api/copilot/memories/[id] ────────────────────────────
  describe('PATCH /api/copilot/memories/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/copilot/memories/m-1', {
        method: 'PATCH',
        body: JSON.stringify({ active: false }),
      });
      const res = await PATCH(req, buildRouteContext('m-1'));
      expect(res.status).toBe(401);
    });

    it('toggles active status', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_memories', { data: null, error: null });

      const req = new NextRequest('http://localhost/api/copilot/memories/m-1', {
        method: 'PATCH',
        body: JSON.stringify({ active: false }),
      });
      const res = await PATCH(req, buildRouteContext('m-1'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mock.client.from).toHaveBeenCalledWith('copilot_memories');
    });

    it('updates rule text', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_memories', { data: null, error: null });

      const req = new NextRequest('http://localhost/api/copilot/memories/m-1', {
        method: 'PATCH',
        body: JSON.stringify({ rule: 'Updated rule text' }),
      });
      const res = await PATCH(req, buildRouteContext('m-1'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('returns 400 when no valid fields to update', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const req = new NextRequest('http://localhost/api/copilot/memories/m-1', {
        method: 'PATCH',
        body: JSON.stringify({ foo: 'bar' }),
      });
      const res = await PATCH(req, buildRouteContext('m-1'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('No valid fields to update');
    });

    it('returns 500 on update failure', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_memories', { data: null, error: { message: 'DB error' } });

      const req = new NextRequest('http://localhost/api/copilot/memories/m-1', {
        method: 'PATCH',
        body: JSON.stringify({ active: true }),
      });
      const res = await PATCH(req, buildRouteContext('m-1'));
      expect(res.status).toBe(500);
    });
  });

  // ─── DELETE /api/copilot/memories/[id] ───────────────────────────
  describe('DELETE /api/copilot/memories/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/copilot/memories/m-1', {
        method: 'DELETE',
      });
      const res = await DELETE(req, buildRouteContext('m-1'));
      expect(res.status).toBe(401);
    });

    it('deletes memory successfully', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_memories', { data: null, error: null });

      const req = new NextRequest('http://localhost/api/copilot/memories/m-1', {
        method: 'DELETE',
      });
      const res = await DELETE(req, buildRouteContext('m-1'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mock.client.from).toHaveBeenCalledWith('copilot_memories');
    });

    it('returns 500 on delete failure', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_memories', { data: null, error: { message: 'FK constraint' } });

      const req = new NextRequest('http://localhost/api/copilot/memories/m-1', {
        method: 'DELETE',
      });
      const res = await DELETE(req, buildRouteContext('m-1'));
      expect(res.status).toBe(500);
    });
  });
});
