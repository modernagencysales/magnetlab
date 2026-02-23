/**
 * @jest-environment node
 */

// Mock modules — must come before imports
jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: jest.fn(),
}));

jest.mock('@/lib/ai/content-pipeline/model-config', () => ({
  CLAUDE_HAIKU_MODEL: 'claude-haiku-test',
}));

import { classifyEditPatterns } from '@/lib/ai/content-pipeline/edit-classifier';
import { getAnthropicClient } from '@/lib/ai/content-pipeline/anthropic-client';

const mockGetAnthropic = getAnthropicClient as jest.Mock;

describe('classifyEditPatterns', () => {
  let mockMessagesCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessagesCreate = jest.fn();
    mockGetAnthropic.mockReturnValue({
      messages: { create: mockMessagesCreate },
    });
  });

  const baseInput = {
    originalText: 'Our product helps businesses grow their revenue through automation.',
    editedText: 'Our platform empowers agencies to scale through AI-driven outreach.',
    contentType: 'post',
    fieldName: 'draft_content',
  };

  it('returns patterns from a successful classification', async () => {
    const mockPatterns = {
      patterns: [
        { pattern: 'made_conversational', description: 'Changed formal tone to conversational' },
        { pattern: 'added_specifics', description: 'Added specific ICP language (agencies, outreach)' },
      ],
    };

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(mockPatterns) }],
    });

    const result = await classifyEditPatterns(baseInput);

    expect(result.patterns).toHaveLength(2);
    expect(result.patterns[0].pattern).toBe('made_conversational');
    expect(result.patterns[1].pattern).toBe('added_specifics');
  });

  it('passes correct parameters to Claude', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"patterns": []}' }],
    });

    await classifyEditPatterns(baseInput);

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-haiku-test');
    expect(callArgs.max_tokens).toBe(500);
    expect(callArgs.messages[0].content).toContain(baseInput.originalText);
    expect(callArgs.messages[0].content).toContain(baseInput.editedText);
    expect(callArgs.messages[0].content).toContain('post');
    expect(callArgs.messages[0].content).toContain('draft_content');
  });

  it('returns empty patterns when response has no JSON', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'I could not detect any patterns in this edit.' }],
    });

    const result = await classifyEditPatterns(baseInput);

    expect(result.patterns).toEqual([]);
  });

  it('returns empty patterns on malformed JSON', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"patterns": [invalid json}' }],
    });

    const result = await classifyEditPatterns(baseInput);

    expect(result.patterns).toEqual([]);
  });

  it('returns empty patterns when API call throws', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('API timeout'));

    const result = await classifyEditPatterns(baseInput);

    expect(result.patterns).toEqual([]);
  });

  it('returns empty patterns when response content is non-text', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'test', name: 'test', input: {} }],
    });

    const result = await classifyEditPatterns(baseInput);

    expect(result.patterns).toEqual([]);
  });

  it('extracts JSON from a response with surrounding text', async () => {
    const mockPatterns = {
      patterns: [
        { pattern: 'shortened_hook', description: 'Shortened the opening hook' },
      ],
    };

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: `Here is my analysis:\n${JSON.stringify(mockPatterns)}\n\nHope that helps!` }],
    });

    const result = await classifyEditPatterns(baseInput);

    expect(result.patterns).toHaveLength(1);
    expect(result.patterns[0].pattern).toBe('shortened_hook');
  });

  it('returns empty patterns when getAnthropicClient throws', async () => {
    mockGetAnthropic.mockImplementation(() => {
      throw new Error('ANTHROPIC_API_KEY is not set');
    });

    const result = await classifyEditPatterns(baseInput);

    expect(result.patterns).toEqual([]);
  });
});
