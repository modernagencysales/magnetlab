/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/copilot/conversations/route';
import { GET as GET_BY_ID, DELETE } from '@/app/api/copilot/conversations/[id]/route';
import { POST as POST_FEEDBACK } from '@/app/api/copilot/conversations/[id]/feedback/route';
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
 * Supports: from, select, insert, update, delete, eq, order, limit, single
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

let mock: ReturnType<typeof createMockSupabase>;

// Helper to build params matching Next.js 15 dynamic route shape
function buildRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('Copilot Conversations API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  // ─── GET /api/copilot/conversations ──────────────────────────────
  describe('GET /api/copilot/conversations', () => {
    it('returns 401 without auth', async () => {
      mockAuth.mockResolvedValue(null);

      const res = await GET();
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns conversation list for authenticated user', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const conversations = [
        { id: 'conv-1', title: 'First chat', entity_type: null, entity_id: null, model: null, created_at: '2026-02-27T00:00:00Z', updated_at: '2026-02-27T01:00:00Z' },
        { id: 'conv-2', title: 'Second chat', entity_type: 'post', entity_id: 'post-1', model: null, created_at: '2026-02-27T00:00:00Z', updated_at: '2026-02-27T02:00:00Z' },
      ];
      mock.setTableResult('copilot_conversations', { data: conversations, error: null });

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.conversations).toHaveLength(2);
      expect(data.conversations[0].id).toBe('conv-1');
      expect(mock.client.from).toHaveBeenCalledWith('copilot_conversations');
    });

    it('returns empty array when user has no conversations', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-empty' } });
      mock.setTableResult('copilot_conversations', { data: [], error: null });

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.conversations).toHaveLength(0);
    });

    it('returns 500 on database error', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_conversations', { data: null, error: { message: 'Connection timeout' } });

      const res = await GET();
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Connection timeout');
    });
  });

  // ─── POST /api/copilot/conversations ─────────────────────────────
  describe('POST /api/copilot/conversations', () => {
    it('returns 401 without auth', async () => {
      mockAuth.mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/copilot/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('creates a new conversation', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const created = {
        id: 'conv-new',
        title: 'My topic',
        entity_type: 'post',
        entity_id: 'post-42',
        created_at: '2026-02-27T00:00:00Z',
      };
      mock.setTableResult('copilot_conversations', { data: created, error: null });

      const req = new NextRequest('http://localhost/api/copilot/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'My topic', entityType: 'post', entityId: 'post-42' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.conversation.id).toBe('conv-new');
      expect(data.conversation.title).toBe('My topic');
    });

    it('uses default title when none provided', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const created = {
        id: 'conv-default',
        title: 'New conversation',
        entity_type: null,
        entity_id: null,
        created_at: '2026-02-27T00:00:00Z',
      };
      mock.setTableResult('copilot_conversations', { data: created, error: null });

      const req = new NextRequest('http://localhost/api/copilot/conversations', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.conversation.title).toBe('New conversation');
    });

    it('returns 500 on insert failure', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_conversations', { data: null, error: { message: 'unique violation' } });

      const req = new NextRequest('http://localhost/api/copilot/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'Dup' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
    });
  });

  // ─── GET /api/copilot/conversations/[id] ─────────────────────────
  describe('GET /api/copilot/conversations/[id]', () => {
    it('returns 401 without auth', async () => {
      mockAuth.mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-1');
      const res = await GET_BY_ID(req, buildRouteContext('conv-1'));
      expect(res.status).toBe(401);
    });

    it('returns 404 when conversation not found', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_conversations', { data: null, error: { message: 'not found' } });

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-missing');
      const res = await GET_BY_ID(req, buildRouteContext('conv-missing'));
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Conversation not found');
    });

    it('returns conversation with messages', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      // The route calls .single() for conversations and the thenable for messages.
      // Since both tables resolve via the mock, we set both.
      const conversation = {
        id: 'conv-1',
        title: 'Test chat',
        entity_type: null,
        entity_id: null,
        model: null,
        created_at: '2026-02-27T00:00:00Z',
        updated_at: '2026-02-27T01:00:00Z',
      };

      const messages = [
        { id: 'msg-1', role: 'user', content: 'Hello', tool_name: null, tool_args: null, tool_result: null, feedback: null, tokens_used: null, created_at: '2026-02-27T00:00:00Z' },
        { id: 'msg-2', role: 'assistant', content: 'Hi there!', tool_name: null, tool_args: null, tool_result: null, feedback: null, tokens_used: 50, created_at: '2026-02-27T00:01:00Z' },
      ];

      // conversations query uses .single(), messages query uses thenable
      mock.setTableResult('copilot_conversations', { data: conversation, error: null });
      mock.setTableResult('copilot_messages', { data: messages, error: null });

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-1');
      const res = await GET_BY_ID(req, buildRouteContext('conv-1'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.conversation.id).toBe('conv-1');
      expect(data.messages).toHaveLength(2);
      expect(data.messages[0].role).toBe('user');
      expect(data.messages[1].role).toBe('assistant');
    });
  });

  // ─── DELETE /api/copilot/conversations/[id] ──────────────────────
  describe('DELETE /api/copilot/conversations/[id]', () => {
    it('returns 401 without auth', async () => {
      mockAuth.mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-1', {
        method: 'DELETE',
      });
      const res = await DELETE(req, buildRouteContext('conv-1'));
      expect(res.status).toBe(401);
    });

    it('deletes conversation successfully', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_conversations', { data: null, error: null });

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-1', {
        method: 'DELETE',
      });
      const res = await DELETE(req, buildRouteContext('conv-1'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe(true);
      expect(mock.client.from).toHaveBeenCalledWith('copilot_conversations');
    });

    it('returns 500 on delete failure', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_conversations', { data: null, error: { message: 'FK constraint' } });

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-1', {
        method: 'DELETE',
      });
      const res = await DELETE(req, buildRouteContext('conv-1'));
      expect(res.status).toBe(500);
    });
  });

  // ─── POST /api/copilot/conversations/[id]/feedback ───────────────
  describe('POST /api/copilot/conversations/[id]/feedback', () => {
    it('returns 401 without auth', async () => {
      mockAuth.mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-1/feedback', {
        method: 'POST',
        body: JSON.stringify({ messageId: 'msg-1', rating: 'positive' }),
      });
      const res = await POST_FEEDBACK(req, buildRouteContext('conv-1'));
      expect(res.status).toBe(401);
    });

    it('returns 400 when messageId is missing', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-1/feedback', {
        method: 'POST',
        body: JSON.stringify({ rating: 'positive' }),
      });
      const res = await POST_FEEDBACK(req, buildRouteContext('conv-1'));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('messageId and rating are required');
    });

    it('returns 400 when rating is missing', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-1/feedback', {
        method: 'POST',
        body: JSON.stringify({ messageId: 'msg-1' }),
      });
      const res = await POST_FEEDBACK(req, buildRouteContext('conv-1'));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('messageId and rating are required');
    });

    it('returns 400 for invalid rating value', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-1/feedback', {
        method: 'POST',
        body: JSON.stringify({ messageId: 'msg-1', rating: 'neutral' }),
      });
      const res = await POST_FEEDBACK(req, buildRouteContext('conv-1'));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('rating must be positive or negative');
    });

    it('returns 404 when conversation not owned by user', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      // Conversation lookup returns null (not found / not owned)
      mock.setTableResult('copilot_conversations', { data: null, error: null });

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-other/feedback', {
        method: 'POST',
        body: JSON.stringify({ messageId: 'msg-1', rating: 'positive' }),
      });
      const res = await POST_FEEDBACK(req, buildRouteContext('conv-other'));
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Conversation not found');
    });

    it('saves positive feedback successfully', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      // Conversation lookup succeeds
      mock.setTableResult('copilot_conversations', { data: { id: 'conv-1' }, error: null });
      // Message update succeeds
      mock.setTableResult('copilot_messages', { data: null, error: null });

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-1/feedback', {
        method: 'POST',
        body: JSON.stringify({ messageId: 'msg-1', rating: 'positive', note: 'Helpful!' }),
      });
      const res = await POST_FEEDBACK(req, buildRouteContext('conv-1'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('saves negative feedback successfully', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mock.setTableResult('copilot_conversations', { data: { id: 'conv-1' }, error: null });
      mock.setTableResult('copilot_messages', { data: null, error: null });

      const req = new NextRequest('http://localhost/api/copilot/conversations/conv-1/feedback', {
        method: 'POST',
        body: JSON.stringify({ messageId: 'msg-2', rating: 'negative' }),
      });
      const res = await POST_FEEDBACK(req, buildRouteContext('conv-1'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
