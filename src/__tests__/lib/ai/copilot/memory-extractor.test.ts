/**
 * @jest-environment node
 */

const mockMessagesCreate = jest.fn();
jest.mock('@/lib/ai/anthropic-client', () => ({
  createAnthropicClient: jest.fn(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

jest.mock('@/lib/services/prompt-registry', () => ({
  getPrompt: jest.fn().mockResolvedValue(null),
}));

import { extractMemories, detectCorrectionSignal } from '@/lib/ai/copilot/memory-extractor';

describe('memory-extractor', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('detectCorrectionSignal', () => {
    it('detects negation patterns', () => {
      expect(detectCorrectionSignal("Don't use bullet points")).toBe(true);
      expect(detectCorrectionSignal("Never start with a question")).toBe(true);
      expect(detectCorrectionSignal("Stop using emojis")).toBe(true);
    });

    it('detects preference patterns', () => {
      expect(detectCorrectionSignal("I prefer shorter paragraphs")).toBe(true);
      expect(detectCorrectionSignal("Always include a CTA")).toBe(true);
      expect(detectCorrectionSignal("Use a more casual tone instead")).toBe(true);
    });

    it('detects tone complaints', () => {
      expect(detectCorrectionSignal("This is too formal")).toBe(true);
      expect(detectCorrectionSignal("Make it more concise")).toBe(true);
      expect(detectCorrectionSignal("That's not my style")).toBe(true);
    });

    it('returns false for regular messages', () => {
      expect(detectCorrectionSignal("Write me a post about AI")).toBe(false);
      expect(detectCorrectionSignal("What topics are trending?")).toBe(false);
      expect(detectCorrectionSignal("Show me my analytics")).toBe(false);
    });
  });

  describe('extractMemories', () => {
    it('returns parsed memories from Claude response', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify([
          { rule: 'Never use bullet points', category: 'structure', confidence: 0.9 },
        ]) }],
      });

      const result = await extractMemories('user-1', [
        { role: 'assistant', content: 'Here is a post with bullet points...' },
        { role: 'user', content: "Don't use bullet points, I hate them" },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].rule).toBe('Never use bullet points');
      expect(result[0].category).toBe('structure');
      expect(result[0].confidence).toBe(0.9);
    });

    it('returns empty array when no memories extracted', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: '[]' }],
      });

      const result = await extractMemories('user-1', [
        { role: 'user', content: 'Write me a post about leadership' },
      ]);

      expect(result).toEqual([]);
    });

    it('returns empty array on malformed JSON', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not json' }],
      });

      const result = await extractMemories('user-1', [
        { role: 'user', content: "Don't use emojis" },
      ]);

      expect(result).toEqual([]);
    });

    it('filters out memories with invalid categories', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify([
          { rule: 'Good rule', category: 'tone', confidence: 0.9 },
          { rule: 'Bad category', category: 'invalid', confidence: 0.9 },
        ]) }],
      });

      const result = await extractMemories('user-1', [
        { role: 'user', content: "Be more casual" },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].rule).toBe('Good rule');
    });

    it('handles markdown code blocks in response', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: '```json\n[{"rule": "Short paragraphs", "category": "structure", "confidence": 0.85}]\n```' }],
      });

      const result = await extractMemories('user-1', [
        { role: 'user', content: "Keep paragraphs short" },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].rule).toBe('Short paragraphs');
    });

    it('returns empty array on API error', async () => {
      mockMessagesCreate.mockRejectedValueOnce(new Error('API error'));

      const result = await extractMemories('user-1', [
        { role: 'user', content: "Don't use emojis" },
      ]);

      expect(result).toEqual([]);
    });
  });
});
