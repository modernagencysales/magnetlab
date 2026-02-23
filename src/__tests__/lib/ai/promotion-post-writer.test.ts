/**
 * @jest-environment node
 */

const mockMessagesCreate = jest.fn();

jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: () => ({ messages: { create: mockMessagesCreate } }),
  parseJsonResponse: (text: string) => JSON.parse(text),
}));

jest.mock('@/lib/ai/content-pipeline/model-config', () => ({
  CLAUDE_SONNET_MODEL: 'claude-sonnet-test',
}));

import {
  generatePromotionPosts,
  type PromotionPostInput,
  type PromotionPost,
} from '@/lib/ai/content-pipeline/promotion-post-writer';
import type { TeamVoiceProfile } from '@/lib/types/content-pipeline';

function makeApiResponse(posts: PromotionPost[]) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(posts),
      },
    ],
  };
}

const samplePosts: PromotionPost[] = [
  {
    content: 'Most agencies spend 10+ hours a week on manual outreach. Here is how to cut that to 2.\n\nWe just released a step-by-step guide that walks you through our exact automation stack.\n\nGrab it here: https://example.com/guide',
    angle: 'problem_aware',
    hook_type: 'bold_statement',
  },
  {
    content: 'We interviewed 50 agency owners about their biggest bottleneck. The answer surprised us.\n\nThe full breakdown is in our new guide.\n\nRead it: https://example.com/guide',
    angle: 'curiosity',
    hook_type: 'story',
  },
  {
    content: 'Here is one insight from our new agency growth guide: the best-performing cold emails are under 60 words.\n\nWant the other 14 insights? They are all in the guide.\n\nhttps://example.com/guide',
    angle: 'value_first',
    hook_type: 'statistic',
  },
  {
    content: '200+ agency owners already grabbed this guide in the first week.\n\nIf your outreach pipeline needs work, this will save you months of trial and error.\n\nhttps://example.com/guide',
    angle: 'social_proof',
    hook_type: 'bold_statement',
  },
];

describe('generatePromotionPosts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------
  // 1. Generates 4 promotion posts with different angles
  // ----------------------------------------

  it('generates 4 promotion posts with different angles', async () => {
    mockMessagesCreate.mockResolvedValue(makeApiResponse(samplePosts));

    const input: PromotionPostInput = {
      leadMagnetTitle: 'The Agency Growth Playbook',
      leadMagnetDescription: 'A step-by-step guide to scaling your agency with cold outreach automation.',
      leadMagnetUrl: 'https://example.com/guide',
    };

    const result = await generatePromotionPosts(input);

    expect(result).toHaveLength(4);
    const angles = result.map(p => p.angle);
    expect(angles).toContain('problem_aware');
    expect(angles).toContain('curiosity');
    expect(angles).toContain('value_first');
    expect(angles).toContain('social_proof');
  });

  // ----------------------------------------
  // 2. Includes lead magnet details in prompt
  // ----------------------------------------

  it('includes lead magnet details in the prompt sent to Claude', async () => {
    mockMessagesCreate.mockResolvedValue(makeApiResponse(samplePosts));

    const input: PromotionPostInput = {
      leadMagnetTitle: 'The Cold Email Framework',
      leadMagnetDescription: '7 templates that generate 40%+ reply rates.',
      leadMagnetUrl: 'https://magnetlab.app/cold-email-framework',
    };

    await generatePromotionPosts(input);

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-test');
    expect(callArgs.max_tokens).toBe(3000);

    const prompt = callArgs.messages[0].content;
    expect(prompt).toContain('The Cold Email Framework');
    expect(prompt).toContain('7 templates that generate 40%+ reply rates');
    expect(prompt).toContain('https://magnetlab.app/cold-email-framework');
  });

  // ----------------------------------------
  // 3. Uses voice profile when provided
  // ----------------------------------------

  it('uses voice profile when provided', async () => {
    mockMessagesCreate.mockResolvedValue(makeApiResponse(samplePosts));

    const voiceProfile: TeamVoiceProfile = {
      tone: 'direct and punchy',
      banned_phrases: ['synergy', 'leverage'],
      vocabulary_preferences: {
        avoid: ['utilize'],
        prefer: ['use', 'build'],
      },
      structure_patterns: {
        linkedin: ['Short punchy sentences', 'End with a question'],
        email: ['Open with story'],
      },
      cta_style: 'Ask a question instead of telling',
      content_length: {
        linkedin: '150-200 words',
        email: '400 words',
      },
    };

    const input: PromotionPostInput = {
      leadMagnetTitle: 'Growth Guide',
      leadMagnetDescription: 'How to grow.',
      leadMagnetUrl: 'https://example.com',
      voiceProfile,
    };

    await generatePromotionPosts(input);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    // Voice profile sections should be embedded
    expect(prompt).toContain('direct and punchy');
    expect(prompt).toContain('synergy, leverage');
    expect(prompt).toContain('Short punchy sentences');
    // Should use linkedin structure patterns, not email
    expect(prompt).toContain('Structure (linkedin)');
    expect(prompt).toContain('150-200 words');
  });

  // ----------------------------------------
  // 4. Handles null voice profile gracefully
  // ----------------------------------------

  it('handles null voice profile gracefully', async () => {
    mockMessagesCreate.mockResolvedValue(makeApiResponse(samplePosts));

    const input: PromotionPostInput = {
      leadMagnetTitle: 'Test Guide',
      leadMagnetDescription: 'A test.',
      leadMagnetUrl: 'https://example.com',
      voiceProfile: null,
    };

    const result = await generatePromotionPosts(input);

    expect(result).toHaveLength(4);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    // Should NOT contain voice section header when null
    expect(prompt).not.toContain('## Writing Style');
  });

  it('handles undefined voice profile gracefully', async () => {
    mockMessagesCreate.mockResolvedValue(makeApiResponse(samplePosts));

    const input: PromotionPostInput = {
      leadMagnetTitle: 'Test Guide',
      leadMagnetDescription: 'A test.',
      leadMagnetUrl: 'https://example.com',
      // voiceProfile is undefined (not provided)
    };

    const result = await generatePromotionPosts(input);

    expect(result).toHaveLength(4);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('## Writing Style');
  });

  // ----------------------------------------
  // 5. Includes author name when provided
  // ----------------------------------------

  it('includes author name in prompt when provided', async () => {
    mockMessagesCreate.mockResolvedValue(makeApiResponse(samplePosts));

    const input: PromotionPostInput = {
      leadMagnetTitle: 'Guide',
      leadMagnetDescription: 'Description',
      leadMagnetUrl: 'https://example.com',
      authorName: 'Jane Smith',
    };

    await generatePromotionPosts(input);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Jane Smith');
  });

  it('omits author when not provided', async () => {
    mockMessagesCreate.mockResolvedValue(makeApiResponse(samplePosts));

    const input: PromotionPostInput = {
      leadMagnetTitle: 'Guide',
      leadMagnetDescription: 'Description',
      leadMagnetUrl: 'https://example.com',
    };

    await generatePromotionPosts(input);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('Author:');
  });

  // ----------------------------------------
  // 6. API error handling
  // ----------------------------------------

  it('throws when API call fails', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('API rate limit'));

    const input: PromotionPostInput = {
      leadMagnetTitle: 'Guide',
      leadMagnetDescription: 'Desc',
      leadMagnetUrl: 'https://example.com',
    };

    await expect(generatePromotionPosts(input)).rejects.toThrow('API rate limit');
  });

  it('throws when API returns non-text content', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'tool-1', name: 'test', input: {} }],
    });

    const input: PromotionPostInput = {
      leadMagnetTitle: 'Guide',
      leadMagnetDescription: 'Desc',
      leadMagnetUrl: 'https://example.com',
    };

    // parseJsonResponse will fail on empty string
    await expect(generatePromotionPosts(input)).rejects.toThrow();
  });

  // ----------------------------------------
  // 7. Each post has required fields
  // ----------------------------------------

  it('each returned post has content, angle, and hook_type', async () => {
    mockMessagesCreate.mockResolvedValue(makeApiResponse(samplePosts));

    const input: PromotionPostInput = {
      leadMagnetTitle: 'Guide',
      leadMagnetDescription: 'Desc',
      leadMagnetUrl: 'https://example.com',
    };

    const result = await generatePromotionPosts(input);

    for (const post of result) {
      expect(post).toHaveProperty('content');
      expect(post).toHaveProperty('angle');
      expect(post).toHaveProperty('hook_type');
      expect(typeof post.content).toBe('string');
      expect(typeof post.angle).toBe('string');
      expect(typeof post.hook_type).toBe('string');
    }
  });

  // ----------------------------------------
  // 8. Prompt contains key instructions
  // ----------------------------------------

  it('prompt contains formatting and angle instructions', async () => {
    mockMessagesCreate.mockResolvedValue(makeApiResponse(samplePosts));

    const input: PromotionPostInput = {
      leadMagnetTitle: 'Agency Growth Guide',
      leadMagnetDescription: 'Scale your agency.',
      leadMagnetUrl: 'https://example.com/guide',
    };

    await generatePromotionPosts(input);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Problem-aware');
    expect(prompt).toContain('Curiosity');
    expect(prompt).toContain('Value-first');
    expect(prompt).toContain('Social proof');
    expect(prompt).toContain('No emojis');
    expect(prompt).toContain('no hashtags');
    expect(prompt).toContain('100-200 words');
    expect(prompt).toContain('Return ONLY valid JSON');
  });
});
