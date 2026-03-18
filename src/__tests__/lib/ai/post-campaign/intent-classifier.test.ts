/**
 * @jest-environment node
 */

// Mock the Anthropic client factory — must come before imports
jest.mock('@/lib/ai/anthropic-client', () => ({
  createAnthropicClient: jest.fn(),
}));

import { classifyCommentIntent } from '@/lib/ai/post-campaign/intent-classifier';
import { createAnthropicClient } from '@/lib/ai/anthropic-client';

const mockCreateClient = createAnthropicClient as jest.Mock;

describe('intent-classifier', () => {
  let mockMessagesCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessagesCreate = jest.fn();
    mockCreateClient.mockReturnValue({
      messages: { create: mockMessagesCreate },
    });
  });

  // ─── Happy Path ─────────────────────────────────────────────────────

  it('classifies "GTM please!" as interested when CTA is "comment GTM below"', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'YES' }],
    });

    const result = await classifyCommentIntent('comment GTM below', 'GTM please!');

    expect(result).toEqual({ isInterested: true, confidence: 0.8 });
  });

  it('classifies "Nice post" as not interested', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'NO' }],
    });

    const result = await classifyCommentIntent('comment GTM below to get the guide', 'Nice post');

    expect(result).toEqual({ isInterested: false, confidence: 0.2 });
  });

  it('classifies "Interested!" as interested', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'YES' }],
    });

    const result = await classifyCommentIntent('comment GTM below', 'Interested!');

    expect(result).toEqual({ isInterested: true, confidence: 0.8 });
  });

  it('classifies emoji "🙋‍♂️" as interested', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'YES' }],
    });

    const result = await classifyCommentIntent('comment GTM below to get the playbook', '🙋‍♂️');

    expect(result).toEqual({ isInterested: true, confidence: 0.8 });
  });

  // ─── Edge Cases ───────────────────────────────────────────────────────

  it('returns not interested for empty comment', async () => {
    const result = await classifyCommentIntent('comment GTM below', '');

    expect(result).toEqual({ isInterested: false, confidence: 0.2 });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns not interested for null comment', async () => {
    const result = await classifyCommentIntent('comment GTM below', null as unknown as string);

    expect(result).toEqual({ isInterested: false, confidence: 0.2 });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('handles response with extra text around YES', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'YES, they are interested.' }],
    });

    const result = await classifyCommentIntent('comment GUIDE below', 'Send it!');

    expect(result).toEqual({ isInterested: true, confidence: 0.8 });
  });

  it('handles lowercase yes response', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'yes' }],
    });

    const result = await classifyCommentIntent('comment GUIDE below', 'I want this!');

    expect(result).toEqual({ isInterested: true, confidence: 0.8 });
  });

  // ─── Error Handling ───────────────────────────────────────────────────

  it('returns not interested on API error', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('API timeout'));

    const result = await classifyCommentIntent('comment GTM below', 'Interested!');

    expect(result).toEqual({ isInterested: false, confidence: 0.2 });
  });

  it('returns not interested when client creation fails', async () => {
    mockCreateClient.mockImplementation(() => {
      throw new Error('ANTHROPIC_API_KEY is not set');
    });

    const result = await classifyCommentIntent('comment GTM below', 'Send it my way!');

    expect(result).toEqual({ isInterested: false, confidence: 0.2 });
  });

  it('returns not interested when response content is non-text', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'test', name: 'test', input: {} }],
    });

    const result = await classifyCommentIntent('comment GTM below', 'I need this');

    expect(result).toEqual({ isInterested: false, confidence: 0.2 });
  });

  // ─── SDK Parameters ──────────────────────────────────────────────────

  it('passes correct parameters to the Anthropic SDK', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'NO' }],
    });

    await classifyCommentIntent('comment GTM below', 'Great insight');

    expect(mockCreateClient).toHaveBeenCalledWith('intent-classifier');
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-haiku-4-5-20251001');
    expect(callArgs.max_tokens).toBe(10);
    expect(callArgs.messages[0].role).toBe('user');
    expect(callArgs.messages[0].content).toContain('comment GTM below');
    expect(callArgs.messages[0].content).toContain('Great insight');
    expect(callArgs.messages[0].content).toContain('YES or NO');
  });
});
