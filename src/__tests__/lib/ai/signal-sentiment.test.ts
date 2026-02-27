/**
 * @jest-environment node
 */

// Mock the Anthropic client factory — must come before imports
jest.mock('@/lib/ai/anthropic-client', () => ({
  createAnthropicClient: jest.fn(),
}));

import {
  classifyCommentSentiment,
  batchClassifySentiment,
} from '@/lib/ai/signal-sentiment';
import { createAnthropicClient } from '@/lib/ai/anthropic-client';

const mockCreateClient = createAnthropicClient as jest.Mock;

describe('signal-sentiment', () => {
  let mockMessagesCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessagesCreate = jest.fn();
    mockCreateClient.mockReturnValue({
      messages: { create: mockMessagesCreate },
    });
  });

  // =============================================
  // classifyCommentSentiment
  // =============================================

  describe('classifyCommentSentiment', () => {
    it('returns low_intent for null/undefined input', async () => {
      const result = await classifyCommentSentiment(null as unknown as string);
      expect(result).toEqual({
        sentiment: 'low_intent',
        reasoning: 'Empty or trivial comment',
      });
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it('returns low_intent for empty string', async () => {
      const result = await classifyCommentSentiment('');
      expect(result).toEqual({
        sentiment: 'low_intent',
        reasoning: 'Empty or trivial comment',
      });
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it('returns low_intent for whitespace-only string', async () => {
      const result = await classifyCommentSentiment('   ');
      expect(result).toEqual({
        sentiment: 'low_intent',
        reasoning: 'Empty or trivial comment',
      });
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it('returns low_intent for string shorter than 3 chars', async () => {
      const result = await classifyCommentSentiment('Hi');
      expect(result).toEqual({
        sentiment: 'low_intent',
        reasoning: 'Empty or trivial comment',
      });
      expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it('classifies a high_intent comment', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"sentiment": "high_intent", "reasoning": "User is asking about integration details, indicating active evaluation."}',
          },
        ],
      });

      const result = await classifyCommentSentiment(
        'Does this integrate with Salesforce?'
      );

      expect(result).toEqual({
        sentiment: 'high_intent',
        reasoning:
          'User is asking about integration details, indicating active evaluation.',
      });
    });

    it('classifies a question comment', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"sentiment": "question", "reasoning": "Genuine question seeking clarification."}',
          },
        ],
      });

      const result = await classifyCommentSentiment(
        'Can you elaborate on what you mean by outbound automation?'
      );

      expect(result).toEqual({
        sentiment: 'question',
        reasoning: 'Genuine question seeking clarification.',
      });
    });

    it('classifies a medium_intent comment', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"sentiment": "medium_intent", "reasoning": "Shows genuine interest beyond politeness."}',
          },
        ],
      });

      const result = await classifyCommentSentiment(
        "Interesting approach, we've been thinking about this at our agency."
      );

      expect(result).toEqual({
        sentiment: 'medium_intent',
        reasoning: 'Shows genuine interest beyond politeness.',
      });
    });

    it('classifies a low_intent comment', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"sentiment": "low_intent", "reasoning": "Generic polite engagement."}',
          },
        ],
      });

      const result = await classifyCommentSentiment('Great post! Love this.');

      expect(result).toEqual({
        sentiment: 'low_intent',
        reasoning: 'Generic polite engagement.',
      });
    });

    it('passes correct parameters to the Anthropic SDK', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"sentiment": "low_intent", "reasoning": "Test."}',
          },
        ],
      });

      await classifyCommentSentiment('How does pricing work?');

      expect(mockCreateClient).toHaveBeenCalledWith('signal-sentiment');
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);

      const callArgs = mockMessagesCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('claude-haiku-4-5-20251001');
      expect(callArgs.max_tokens).toBe(150);
      expect(callArgs.system).toContain('high_intent');
      expect(callArgs.system).toContain('question');
      expect(callArgs.system).toContain('medium_intent');
      expect(callArgs.system).toContain('low_intent');
      expect(callArgs.messages[0].role).toBe('user');
      expect(callArgs.messages[0].content).toContain('How does pricing work?');
    });

    it('returns low_intent when API response has no JSON', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'I cannot classify this comment.',
          },
        ],
      });

      const result = await classifyCommentSentiment(
        'Some comment that confuses the AI'
      );

      expect(result).toEqual({
        sentiment: 'low_intent',
        reasoning: 'Classification failed',
      });
    });

    it('returns low_intent on malformed JSON response', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"sentiment": "high_intent", broken json}',
          },
        ],
      });

      const result = await classifyCommentSentiment('How does this work?');

      expect(result).toEqual({
        sentiment: 'low_intent',
        reasoning: 'Classification failed',
      });
    });

    it('returns low_intent when sentiment is an invalid value', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"sentiment": "very_interested", "reasoning": "Made up category."}',
          },
        ],
      });

      const result = await classifyCommentSentiment('I love this product!');

      expect(result).toEqual({
        sentiment: 'low_intent',
        reasoning: 'Classification failed',
      });
    });

    it('returns low_intent when API call throws an error', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('API timeout'));

      const result = await classifyCommentSentiment(
        'Does this integrate with HubSpot?'
      );

      expect(result).toEqual({
        sentiment: 'low_intent',
        reasoning: 'Classification failed',
      });
    });

    it('returns low_intent when createAnthropicClient throws', async () => {
      mockCreateClient.mockImplementation(() => {
        throw new Error('ANTHROPIC_API_KEY is not set');
      });

      const result = await classifyCommentSentiment(
        'How much does this cost?'
      );

      expect(result).toEqual({
        sentiment: 'low_intent',
        reasoning: 'Classification failed',
      });
    });

    it('returns low_intent when response content is non-text', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'tool_use', id: 'test', name: 'test', input: {} }],
      });

      const result = await classifyCommentSentiment(
        'Tell me more about this'
      );

      expect(result).toEqual({
        sentiment: 'low_intent',
        reasoning: 'Classification failed',
      });
    });

    it('extracts JSON from response with surrounding text', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Here is my analysis:\n{"sentiment": "high_intent", "reasoning": "Asking about pricing."}\nDone.',
          },
        ],
      });

      const result = await classifyCommentSentiment(
        'What is the pricing for teams?'
      );

      expect(result).toEqual({
        sentiment: 'high_intent',
        reasoning: 'Asking about pricing.',
      });
    });

    it('provides default reasoning when response has none', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"sentiment": "medium_intent"}',
          },
        ],
      });

      const result = await classifyCommentSentiment(
        'This looks promising for our team'
      );

      expect(result).toEqual({
        sentiment: 'medium_intent',
        reasoning: 'No reasoning provided',
      });
    });
  });

  // =============================================
  // batchClassifySentiment
  // =============================================

  describe('batchClassifySentiment', () => {
    it('processes multiple comments and returns results with ids', async () => {
      // Return different sentiments for different calls
      mockMessagesCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"sentiment": "high_intent", "reasoning": "Asking about features."}',
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"sentiment": "low_intent", "reasoning": "Generic praise."}',
            },
          ],
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"sentiment": "question", "reasoning": "Asking for clarification."}',
            },
          ],
        });

      const results = await batchClassifySentiment([
        { id: 'c1', text: 'Does this work with Salesforce?' },
        { id: 'c2', text: 'Great post!' },
        { id: 'c3', text: 'What do you mean by outbound?' },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        id: 'c1',
        sentiment: 'high_intent',
        reasoning: 'Asking about features.',
      });
      expect(results[1]).toEqual({
        id: 'c2',
        sentiment: 'low_intent',
        reasoning: 'Generic praise.',
      });
      expect(results[2]).toEqual({
        id: 'c3',
        sentiment: 'question',
        reasoning: 'Asking for clarification.',
      });
    });

    it('returns empty array for empty input', async () => {
      const results = await batchClassifySentiment([]);
      expect(results).toEqual([]);
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    it('handles short comments without calling the API', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"sentiment": "high_intent", "reasoning": "Active interest."}',
          },
        ],
      });

      const results = await batchClassifySentiment([
        { id: 'c1', text: 'Hi' },
        { id: 'c2', text: 'How does this integrate with our CRM?' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: 'c1',
        sentiment: 'low_intent',
        reasoning: 'Empty or trivial comment',
      });
      expect(results[1]).toEqual({
        id: 'c2',
        sentiment: 'high_intent',
        reasoning: 'Active interest.',
      });
      // Only one API call — short comment was skipped
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    });

    it('processes in batches of 10', async () => {
      // Create 15 comments
      const comments = Array.from({ length: 15 }, (_, i) => ({
        id: `c${i}`,
        text: `This is comment number ${i} with enough text to classify`,
      }));

      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"sentiment": "low_intent", "reasoning": "Generic comment."}',
          },
        ],
      });

      const results = await batchClassifySentiment(comments);

      expect(results).toHaveLength(15);
      // All 15 comments should be classified
      expect(mockMessagesCreate).toHaveBeenCalledTimes(15);
      // Verify ids are preserved
      results.forEach((result, i) => {
        expect(result.id).toBe(`c${i}`);
      });
    });

    it('handles mixed successes and failures', async () => {
      mockMessagesCreate
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"sentiment": "high_intent", "reasoning": "Active evaluation."}',
            },
          ],
        })
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"sentiment": "medium_intent", "reasoning": "Shows interest."}',
            },
          ],
        });

      const results = await batchClassifySentiment([
        { id: 'c1', text: 'How much does the enterprise plan cost?' },
        { id: 'c2', text: 'Tell me about the features' },
        { id: 'c3', text: 'We have been exploring solutions like this' },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].sentiment).toBe('high_intent');
      expect(results[1]).toEqual({
        id: 'c2',
        sentiment: 'low_intent',
        reasoning: 'Classification failed',
      });
      expect(results[2].sentiment).toBe('medium_intent');
    });
  });
});
