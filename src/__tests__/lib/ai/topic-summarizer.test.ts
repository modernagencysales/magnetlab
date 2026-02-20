/**
 * @jest-environment node
 */

// Mock modules — must come before imports
jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: jest.fn(),
  parseJsonResponse: jest.fn((text: string) => JSON.parse(text)),
}));

jest.mock('@/lib/ai/content-pipeline/model-config', () => ({
  CLAUDE_HAIKU_MODEL: 'claude-haiku-test',
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { generateTopicSummary } from '@/lib/ai/content-pipeline/topic-summarizer';
import { getAnthropicClient } from '@/lib/ai/content-pipeline/anthropic-client';

const mockGetAnthropic = getAnthropicClient as jest.Mock;

describe('generateTopicSummary', () => {
  let mockMessagesCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessagesCreate = jest.fn();
    mockGetAnthropic.mockReturnValue({
      messages: { create: mockMessagesCreate },
    });
  });

  it('generates a summary from entries grouped by type', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Cold email is a powerful outreach strategy...' }],
    });

    const result = await generateTopicSummary('Cold Email', {
      how_to: [{ content: 'Write short subject lines', quality_score: 4 }],
      insight: [{ content: 'Personalization increases reply rates by 30%', quality_score: 5 }],
    });

    expect(result).toBe('Cold email is a powerful outreach strategy...');
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-haiku-test');
    expect(callArgs.max_tokens).toBe(1500);
    expect(callArgs.messages[0].content).toContain('"Cold Email"');
  });

  it('returns fallback summary when AI fails', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('API timeout'));

    const result = await generateTopicSummary('Sales', {
      insight: [
        { content: 'Insight 1', quality_score: 4 },
        { content: 'Insight 2', quality_score: 3 },
      ],
      story: [{ content: 'Story 1', quality_score: 5 }],
    });

    expect(result).toContain('Sales');
    expect(result).toContain('3 knowledge entries');
    expect(result).toContain('2 insights');
    expect(result).toContain('1 story');
    expect(result).toContain('AI summary generation is temporarily unavailable');
  });

  it('returns empty message for no entries', async () => {
    const result = await generateTopicSummary('Empty Topic', {});

    expect(result).toContain('Empty Topic');
    expect(result).toContain('no knowledge entries');
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('also returns empty message when all types have zero entries', async () => {
    const result = await generateTopicSummary('Sparse Topic', {
      how_to: [],
      insight: [],
    });

    expect(result).toContain('Sparse Topic');
    expect(result).toContain('no knowledge entries');
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('sorts entries by quality within each type (higher first)', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Summary text' }],
    });

    await generateTopicSummary('Pricing', {
      insight: [
        { content: 'Low quality insight', quality_score: 1 },
        { content: 'High quality insight', quality_score: 5 },
        { content: 'Medium quality insight', quality_score: 3 },
      ],
    });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content as string;

    // Higher quality entries should appear before lower quality ones in the prompt
    const highIdx = prompt.indexOf('High quality insight');
    const medIdx = prompt.indexOf('Medium quality insight');
    const lowIdx = prompt.indexOf('Low quality insight');

    expect(highIdx).toBeLessThan(medIdx);
    expect(medIdx).toBeLessThan(lowIdx);
  });

  it('treats null/undefined quality_score as 3 for sorting', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Summary text' }],
    });

    await generateTopicSummary('Topic', {
      insight: [
        { content: 'Null quality', quality_score: null },
        { content: 'High quality', quality_score: 5 },
        { content: 'Low quality', quality_score: 1 },
      ],
    });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content as string;

    const highIdx = prompt.indexOf('High quality');
    const nullIdx = prompt.indexOf('Null quality');
    const lowIdx = prompt.indexOf('Low quality');

    // 5 > 3 (null default) > 1
    expect(highIdx).toBeLessThan(nullIdx);
    expect(nullIdx).toBeLessThan(lowIdx);
  });

  it('limits to 10 entries per type in the prompt', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Summary text' }],
    });

    // Create 15 entries
    const entries = Array.from({ length: 15 }, (_, i) => ({
      content: `Entry number ${i + 1}`,
      quality_score: 3,
    }));

    await generateTopicSummary('Big Topic', {
      how_to: entries,
    });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content as string;

    // Entries 1-10 should be present, 11-15 should not
    expect(prompt).toContain('Entry number 1');
    expect(prompt).toContain('Entry number 10');
    expect(prompt).not.toContain('Entry number 11');
    expect(prompt).not.toContain('Entry number 15');
  });

  it('skips empty type arrays in the prompt', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Summary text' }],
    });

    await generateTopicSummary('Mixed', {
      insight: [{ content: 'One insight', quality_score: 4 }],
      story: [],
      how_to: [{ content: 'One how-to', quality_score: 3 }],
    });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content as string;

    expect(prompt).toContain('## Insight (1)');
    expect(prompt).toContain('## How To (1)');
    expect(prompt).not.toContain('## Story');
  });

  it('formats type labels with underscores replaced and title-cased', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Summary text' }],
    });

    await generateTopicSummary('Topic', {
      market_intel: [{ content: 'Intel entry', quality_score: 3 }],
      how_to: [{ content: 'How-to entry', quality_score: 3 }],
    });

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content as string;

    expect(prompt).toContain('## Market Intel (1)');
    expect(prompt).toContain('## How To (1)');
  });

  it('handles non-text response content type', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'test', name: 'test', input: {} }],
    });

    const result = await generateTopicSummary('Topic', {
      insight: [{ content: 'Some insight', quality_score: 4 }],
    });

    expect(result).toBe('Summary generation failed for Topic.');
  });

  it('fallback pluralizes type names correctly for single vs multiple entries', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('fail'));

    const result = await generateTopicSummary('Test', {
      insight: [{ content: 'One', quality_score: 3 }],
      story: [
        { content: 'Story A', quality_score: 3 },
        { content: 'Story B', quality_score: 4 },
      ],
    });

    expect(result).toContain('1 insight');
    expect(result).not.toContain('1 insights');
    expect(result).toContain('2 storys');
  });
});
