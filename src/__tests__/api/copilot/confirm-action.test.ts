/**
 * @jest-environment node
 */
import { POST } from '@/app/api/copilot/confirm-action/route';
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

    // Make chain thenable
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

  const chains: Record<string, ReturnType<typeof createChain>> = {};
  const mockFrom = jest.fn((table: string) => {
    if (!chains[table]) chains[table] = createChain(table);
    return chains[table];
  });

  return {
    from: mockFrom,
    chains,
    setResult: (table: string, result: TableResult) => {
      tableResults[table] = result;
      // Reset chain so next call picks up new result
      delete chains[table];
    },
  };
}

const mockSupabase = createMockSupabase();

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: mockSupabase.from,
  })),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/copilot/confirm-action', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/copilot/confirm-action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    // Default: conversation found
    mockSupabase.setResult('copilot_conversations', { data: { id: 'conv-1' }, error: null });
    // Default: message insert works
    mockSupabase.setResult('copilot_messages', { data: null, error: null });
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const req = makeRequest({
      conversationId: 'conv-1',
      toolUseId: 'tool-1',
      approved: true,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing conversationId', async () => {
    const req = makeRequest({
      toolUseId: 'tool-1',
      approved: true,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required fields');
  });

  it('returns 400 when missing toolUseId', async () => {
    const req = makeRequest({
      conversationId: 'conv-1',
      approved: true,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when missing approved', async () => {
    const req = makeRequest({
      conversationId: 'conv-1',
      toolUseId: 'tool-1',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when approved is not a boolean', async () => {
    const req = makeRequest({
      conversationId: 'conv-1',
      toolUseId: 'tool-1',
      approved: 'yes',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when conversation not found', async () => {
    mockSupabase.setResult('copilot_conversations', { data: null, error: null });

    const req = makeRequest({
      conversationId: 'conv-999',
      toolUseId: 'tool-1',
      approved: true,
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 200 and saves confirmation result when approved', async () => {
    const req = makeRequest({
      conversationId: 'conv-1',
      toolUseId: 'tool-1',
      approved: true,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify conversation ownership check
    expect(mockSupabase.from).toHaveBeenCalledWith('copilot_conversations');

    // Verify message was inserted
    expect(mockSupabase.from).toHaveBeenCalledWith('copilot_messages');
  });

  it('returns 200 and saves confirmation result when rejected', async () => {
    const req = makeRequest({
      conversationId: 'conv-1',
      toolUseId: 'tool-1',
      approved: false,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
