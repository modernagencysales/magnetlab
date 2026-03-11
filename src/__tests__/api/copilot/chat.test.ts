/**
 * @jest-environment node
 */
import { POST } from '@/app/api/copilot/chat/route';
import { NextRequest } from 'next/server';

// Mock auth
const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

// Build a chainable mock that supports all Supabase methods
function createChainableMock(
  resolvedValue: { data: unknown; error: unknown } = { data: null, error: null }
) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['from', 'select', 'insert', 'update', 'eq', 'order', 'limit', 'single'];

  for (const method of methods) {
    chain[method] = jest.fn();
  }

  // Every method returns the chain, except terminal methods
  for (const method of methods) {
    chain[method].mockReturnValue(chain);
  }

  // Terminal methods resolve with the provided value
  chain.single.mockResolvedValue(resolvedValue);

  // Make the chain itself thenable so `await supabase.from(...).insert(...)` works
  (chain as Record<string, unknown>).then = (
    resolve: (val: { data: unknown; error: unknown }) => void
  ) => {
    return Promise.resolve(resolvedValue).then(resolve);
  };

  return chain;
}

// Default chain for most operations
const defaultChain = createChainableMock({ data: null, error: null });

// Conversation insert chain (returns an id)
const convInsertChain = createChainableMock({ data: { id: 'conv-1' }, error: null });

// History select chain (returns empty array)
const historyChain = createChainableMock({ data: [], error: null });

// Team member chain (returns null - no team)
const teamChain = createChainableMock({ data: null, error: null });

const mockFrom = jest.fn((table: string) => {
  if (table === 'copilot_conversations') return convInsertChain;
  if (table === 'copilot_messages') return historyChain;
  if (table === 'team_members') return teamChain;
  return defaultChain;
});

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock anthropic
jest.mock('@/lib/ai/anthropic-client', () => ({
  createAnthropicClient: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Hello! How can I help?' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  })),
}));

// Mock actions
jest.mock('@/lib/actions', () => ({
  executeAction: jest.fn().mockResolvedValue({ success: true, data: {} }),
  actionRequiresConfirmation: jest.fn().mockReturnValue(false),
  getToolDefinitions: jest.fn().mockReturnValue([]),
}));

// Mock system prompt
jest.mock('@/lib/ai/copilot/system-prompt', () => ({
  buildCopilotSystemPrompt: jest.fn().mockResolvedValue('System prompt'),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// Mock memory extractor
jest.mock('@/lib/ai/copilot/memory-extractor', () => ({
  detectCorrectionSignal: jest.fn().mockReturnValue(false),
  extractMemories: jest.fn().mockResolvedValue([]),
}));

// Mock accelerator enrollment + usage
const mockGetEnrollmentByUserId = jest.fn();
const mockCheckUsageAllocation = jest.fn();
const mockTrackUsageEvent = jest.fn();

jest.mock('@/lib/services/accelerator-program', () => ({
  getEnrollmentByUserId: (...args: unknown[]) => mockGetEnrollmentByUserId(...args),
}));
jest.mock('@/lib/services/accelerator-usage', () => ({
  checkUsageAllocation: (...args: unknown[]) => mockCheckUsageAllocation(...args),
  trackUsageEvent: (...args: unknown[]) => mockTrackUsageEvent(...args),
}));

describe('POST /api/copilot/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    // Re-wire default chain returns after clearAllMocks
    for (const chain of [defaultChain, convInsertChain, historyChain, teamChain]) {
      for (const method of ['from', 'select', 'insert', 'update', 'eq', 'order', 'limit']) {
        (chain as Record<string, jest.Mock>)[method].mockReturnValue(chain);
      }
    }
    convInsertChain.single.mockResolvedValue({ data: { id: 'conv-1' }, error: null });
    historyChain.single.mockResolvedValue({ data: [], error: null });
    teamChain.single.mockResolvedValue({ data: null, error: null });
    defaultChain.single.mockResolvedValue({ data: null, error: null });
  });

  it('returns 401 without auth', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 without message', async () => {
    const req = new NextRequest('http://localhost/api/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({ message: '' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ─── Accelerator Enrollment + Usage ────────────────────

  it('returns 403 for accelerator requests without enrollment', async () => {
    mockGetEnrollmentByUserId.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Help', pageContext: { page: 'accelerator' } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe('ENROLLMENT_REQUIRED');
  });

  it('returns 429 when accelerator usage exceeds monthly limits', async () => {
    mockGetEnrollmentByUserId.mockResolvedValue({ id: 'enroll-1', status: 'active' });
    mockCheckUsageAllocation.mockResolvedValue({
      withinLimits: false,
      usage: { sessions: 31, deliverables: 5, api_calls: 100 },
      limits: { sessions: 30, deliverables: 15, api_calls: 500 },
    });

    const req = new NextRequest('http://localhost/api/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Help', pageContext: { page: 'accelerator' } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.code).toBe('USAGE_LIMIT_EXCEEDED');
  });

  it('allows accelerator requests when within usage limits', async () => {
    mockGetEnrollmentByUserId.mockResolvedValue({ id: 'enroll-1', status: 'active' });
    mockCheckUsageAllocation.mockResolvedValue({
      withinLimits: true,
      usage: { sessions: 5, deliverables: 2, api_calls: 50 },
      limits: { sessions: 30, deliverables: 15, api_calls: 500 },
    });
    mockTrackUsageEvent.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Help', pageContext: { page: 'accelerator' } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('skips enrollment check for non-accelerator requests', async () => {
    const req = new NextRequest('http://localhost/api/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', pageContext: { page: 'dashboard' } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockGetEnrollmentByUserId).not.toHaveBeenCalled();
    expect(mockCheckUsageAllocation).not.toHaveBeenCalled();
  });

  // ─── Conversation Creation ────────────────────────────

  it('creates conversation when conversationId not provided and returns SSE stream', async () => {
    const req = new NextRequest('http://localhost/api/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    // Verify conversation was created
    expect(mockFrom).toHaveBeenCalledWith('copilot_conversations');
    expect(convInsertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        title: 'Hello',
      })
    );
  });
});
