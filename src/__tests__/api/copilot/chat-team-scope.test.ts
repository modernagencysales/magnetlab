/**
 * @jest-environment node
 *
 * chat-team-scope.test.ts
 * Verifies that the copilot chat and confirm-action routes construct ActionContext
 * using getDataScope rather than a direct team_members query.
 */
import { POST as chatPOST } from '@/app/api/copilot/chat/route';
import { POST as confirmPOST } from '@/app/api/copilot/confirm-action/route';
import { NextRequest } from 'next/server';
import type { DataScope } from '@/lib/utils/team-context';

// ─── Auth mock ───────────────────────────────────────────────────────────────

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

// ─── getDataScope mock ───────────────────────────────────────────────────────

const mockGetDataScope = jest.fn<Promise<DataScope>, [string]>();
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: (...args: unknown[]) => mockGetDataScope(...(args as [string])),
}));

// ─── Supabase mock ───────────────────────────────────────────────────────────

function createChainableMock(resolvedValue: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['select', 'insert', 'update', 'eq', 'order', 'limit', 'single', 'maybeSingle'];
  for (const m of methods) chain[m] = jest.fn().mockReturnValue(chain);
  chain.single.mockResolvedValue(resolvedValue);
  chain.maybeSingle.mockResolvedValue(resolvedValue);
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => Promise.resolve(resolvedValue).then(resolve),
    enumerable: false,
  });
  return chain;
}

const convInsertChain = createChainableMock({ data: { id: 'conv-1' }, error: null });
const convSelectChain = createChainableMock({ data: { id: 'conv-1' }, error: null });
const historyChain = createChainableMock({ data: [], error: null });
const defaultChain = createChainableMock({ data: null, error: null });

const mockFrom = jest.fn((table: string) => {
  if (table === 'copilot_conversations') return convInsertChain;
  if (table === 'copilot_messages') return historyChain;
  return defaultChain;
});

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

// ─── Anthropic streaming mock ─────────────────────────────────────────────────

jest.mock('@/lib/ai/anthropic-client', () => ({
  createAnthropicClient: jest.fn(() => ({
    messages: {
      stream: jest.fn(() => {
        const emitter = {
          on: jest.fn().mockReturnThis(),
          finalMessage: jest.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'OK' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        };
        return emitter;
      }),
    },
  })),
}));

// ─── Action / system-prompt / memory mocks ───────────────────────────────────

const mockExecuteAction = jest.fn().mockResolvedValue({ success: true, data: {} });
jest.mock('@/lib/actions', () => ({
  executeAction: (...args: unknown[]) => mockExecuteAction(...args),
  actionRequiresConfirmation: jest.fn().mockReturnValue(false),
  getToolDefinitions: jest.fn().mockReturnValue([]),
}));

jest.mock('@/lib/ai/copilot/system-prompt', () => ({
  buildCopilotSystemPrompt: jest.fn().mockResolvedValue('System prompt'),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

jest.mock('@/lib/ai/copilot/memory-extractor', () => ({
  detectCorrectionSignal: jest.fn().mockReturnValue(false),
  extractMemories: jest.fn().mockResolvedValue([]),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeChatRequest(body: Record<string, unknown> = { message: 'Hello' }) {
  return new NextRequest('http://localhost/api/copilot/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function makeConfirmRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/copilot/confirm-action', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('copilot routes — ActionContext uses getDataScope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    // Re-wire chain returns after clearAllMocks
    for (const chain of [convInsertChain, convSelectChain, historyChain, defaultChain]) {
      for (const m of ['select', 'insert', 'update', 'eq', 'order', 'limit']) {
        (chain as Record<string, jest.Mock>)[m].mockReturnValue(chain);
      }
    }
    convInsertChain.single.mockResolvedValue({ data: { id: 'conv-1' }, error: null });
    convSelectChain.single.mockResolvedValue({ data: { id: 'conv-1' }, error: null });
    historyChain.single.mockResolvedValue({ data: [], error: null });
    defaultChain.single.mockResolvedValue({ data: null, error: null });
  });

  // ─── chat route ────────────────────────────────────────────────────────────

  describe('POST /api/copilot/chat', () => {
    it('calls getDataScope with the authenticated userId', async () => {
      const personalScope: DataScope = { type: 'user', userId: 'user-1' };
      mockGetDataScope.mockResolvedValue(personalScope);

      const req = makeChatRequest({ message: 'Hello' });
      await chatPOST(req);

      expect(mockGetDataScope).toHaveBeenCalledWith('user-1');
    });

    it('constructs ActionContext with scope from getDataScope (team mode)', async () => {
      const teamScope: DataScope = { type: 'team', userId: 'user-1', teamId: 'team-abc' };
      mockGetDataScope.mockResolvedValue(teamScope);

      const req = makeChatRequest({ message: 'Hello' });
      const res = await chatPOST(req);

      expect(res.status).toBe(200);
      // getDataScope called with the authenticated userId
      expect(mockGetDataScope).toHaveBeenCalledWith('user-1');
    });

    it('constructs personal-mode scope when no team cookie is set', async () => {
      const personalScope: DataScope = { type: 'user', userId: 'user-1' };
      mockGetDataScope.mockResolvedValue(personalScope);

      const req = makeChatRequest({ message: 'Hello' });
      await chatPOST(req);

      // getDataScope was called (not a raw team_members query)
      expect(mockGetDataScope).toHaveBeenCalledTimes(1);
      // No team_members table access
      expect(mockFrom).not.toHaveBeenCalledWith('team_members');
    });

    it('does NOT query team_members table directly', async () => {
      const personalScope: DataScope = { type: 'user', userId: 'user-1' };
      mockGetDataScope.mockResolvedValue(personalScope);

      const req = makeChatRequest({ message: 'Hello' });
      await chatPOST(req);

      const calledTables = (mockFrom.mock.calls as Array<[string]>).map(([t]) => t);
      expect(calledTables).not.toContain('team_members');
    });
  });

  // ─── confirm-action route ──────────────────────────────────────────────────

  describe('POST /api/copilot/confirm-action', () => {
    beforeEach(() => {
      // confirm-action uses its own supabase from; wire conversations to return found
      convInsertChain.single.mockResolvedValue({ data: { id: 'conv-1' }, error: null });
    });

    it('calls getDataScope before executing an approved action', async () => {
      const teamScope: DataScope = { type: 'team', userId: 'user-1', teamId: 'team-xyz' };
      mockGetDataScope.mockResolvedValue(teamScope);
      mockExecuteAction.mockResolvedValue({ success: true, data: {} });

      const req = makeConfirmRequest({
        conversationId: 'conv-1',
        toolUseId: 'tu-1',
        approved: true,
        toolName: 'publish_funnel',
        toolArgs: { id: 'f1' },
      });

      const res = await confirmPOST(req);
      expect(res.status).toBe(200);

      expect(mockGetDataScope).toHaveBeenCalledWith('user-1');
      expect(mockExecuteAction).toHaveBeenCalledWith(
        expect.objectContaining({ scope: teamScope }),
        'publish_funnel',
        { id: 'f1' }
      );
    });

    it('does NOT query team_members table directly', async () => {
      const personalScope: DataScope = { type: 'user', userId: 'user-1' };
      mockGetDataScope.mockResolvedValue(personalScope);
      mockExecuteAction.mockResolvedValue({ success: true, data: {} });

      const req = makeConfirmRequest({
        conversationId: 'conv-1',
        toolUseId: 'tu-1',
        approved: true,
        toolName: 'publish_funnel',
        toolArgs: { id: 'f1' },
      });

      await confirmPOST(req);

      const calledTables = (mockFrom.mock.calls as Array<[string]>).map(([t]) => t);
      expect(calledTables).not.toContain('team_members');
    });

    it('does not call getDataScope when action is rejected', async () => {
      const req = makeConfirmRequest({
        conversationId: 'conv-1',
        toolUseId: 'tu-1',
        approved: false,
      });

      const res = await confirmPOST(req);
      expect(res.status).toBe(200);
      expect(mockGetDataScope).not.toHaveBeenCalled();
    });
  });
});
