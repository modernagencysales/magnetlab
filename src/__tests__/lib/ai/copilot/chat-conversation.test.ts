/**
 * @jest-environment node
 */

// ─── Mock Setup ──────────────────────────────────────────

type MockChain = Record<string, jest.Mock>;

// Queue for .single() call results (select + insert)
const singleResults: Array<{ data: unknown; error: unknown }> = [];

function createMockChain(): MockChain {
  const chain: MockChain = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.single.mockImplementation(() => {
    const result = singleResults.shift();
    return Promise.resolve(result ?? { data: null, error: null });
  });

  return chain;
}

const mockChain = createMockChain();
const mockFrom = jest.fn().mockReturnValue(mockChain);

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

// ─── Imports ─────────────────────────────────────────────

import {
  getOrCreateConversation,
  saveUserMessage,
  touchConversation,
} from '@/lib/ai/copilot/chat-conversation';

// ─── Tests ───────────────────────────────────────────────

describe('chat-conversation service', () => {
  beforeEach(() => {
    singleResults.length = 0;
    jest.clearAllMocks();

    // Re-wire chain after clearAllMocks
    mockChain.select.mockReturnValue(mockChain);
    mockChain.insert.mockReturnValue(mockChain);
    mockChain.update.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.single.mockImplementation(() => {
      const result = singleResults.shift();
      return Promise.resolve(result ?? { data: null, error: null });
    });
    mockFrom.mockReturnValue(mockChain);
  });

  // ─── getOrCreateConversation ─────────────────────────

  describe('getOrCreateConversation', () => {
    it('returns existing conversationId when the conversation is found', async () => {
      singleResults.push({ data: { id: 'conv-123' }, error: null });

      const result = await getOrCreateConversation('user-abc', 'conv-123', 'Hello world');

      expect(result).toEqual({ conversationId: 'conv-123' });
      expect(mockFrom).toHaveBeenCalledWith('copilot_conversations');
      expect(mockChain.select).toHaveBeenCalledWith('id');
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'conv-123');
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-abc');
    });

    it('returns 404 when existing conversation belongs to a different user', async () => {
      singleResults.push({ data: null, error: null });

      const result = await getOrCreateConversation('user-abc', 'conv-999', 'Hello world');

      expect(result).toEqual({ error: 'Conversation not found', status: 404 });
    });

    it('creates a new conversation when no existingId is provided', async () => {
      singleResults.push({ data: { id: 'conv-new-456' }, error: null });

      const result = await getOrCreateConversation('user-abc', undefined, 'My first message', {
        entityType: 'lead_magnet',
        entityId: 'lm-789',
        entityTitle: 'My LM',
      });

      expect(result).toEqual({ conversationId: 'conv-new-456' });
      expect(mockFrom).toHaveBeenCalledWith('copilot_conversations');
      expect(mockChain.insert).toHaveBeenCalledWith({
        user_id: 'user-abc',
        entity_type: 'lead_magnet',
        entity_id: 'lm-789',
        title: 'My first message',
      });
    });

    it('uses null for entity fields when context is omitted', async () => {
      singleResults.push({ data: { id: 'conv-minimal' }, error: null });

      await getOrCreateConversation('user-abc', undefined, 'No context here');

      expect(mockChain.insert).toHaveBeenCalledWith({
        user_id: 'user-abc',
        entity_type: null,
        entity_id: null,
        title: 'No context here',
      });
    });

    it('truncates the title to 100 characters', async () => {
      singleResults.push({ data: { id: 'conv-long' }, error: null });

      const longMessage = 'A'.repeat(200);
      await getOrCreateConversation('user-abc', undefined, longMessage);

      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'A'.repeat(100) })
      );
    });

    it('returns 500 when conversation insert fails', async () => {
      singleResults.push({ data: null, error: { message: 'DB error' } });

      const result = await getOrCreateConversation('user-abc', undefined, 'Fail this insert');

      expect(result).toEqual({ error: 'Failed to create conversation', status: 500 });
    });
  });

  // ─── saveUserMessage ──────────────────────────────────

  describe('saveUserMessage', () => {
    it('inserts a message with the correct fields', async () => {
      await saveUserMessage('conv-123', 'Hello from user');

      expect(mockFrom).toHaveBeenCalledWith('copilot_messages');
      expect(mockChain.insert).toHaveBeenCalledWith({
        conversation_id: 'conv-123',
        role: 'user',
        content: 'Hello from user',
      });
    });
  });

  // ─── touchConversation ────────────────────────────────

  describe('touchConversation', () => {
    it('updates updated_at on the correct conversation', async () => {
      const before = Date.now();
      await touchConversation('conv-123');
      const after = Date.now();

      expect(mockFrom).toHaveBeenCalledWith('copilot_conversations');
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ updated_at: expect.any(String) })
      );
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'conv-123');

      // Verify the timestamp is a valid ISO string within test window
      const updateCall = mockChain.update.mock.calls[0][0];
      const ts = new Date(updateCall.updated_at).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });
});
