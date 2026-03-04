/**
 * @jest-environment node
 */

const mockMessagesCreate = jest.fn();

jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: () => ({ messages: { create: mockMessagesCreate } }),
  parseJsonResponse: (text: string) => JSON.parse(text),
}));

jest.mock('@/lib/services/prompt-registry', () => ({
  getPrompt: jest.fn(() =>
    Promise.resolve({
      slug: 'email-newsletter',
      model: 'claude-sonnet-test',
      max_tokens: 2000,
      temperature: 1.0,
      user_prompt: `Write a daily newsletter email for a B2B audience.

TOPIC: {{topic}}
{{linkedin_topic_section}}
{{author_section}}

KNOWLEDGE CONTEXT:
{{knowledge_context}}

{{voice_style_section}}

NEWSLETTER EMAIL RULES:
- This is NOT a LinkedIn post. It should be longer, more detailed, more utility-focused.
- Include actionable takeaways the reader can use immediately.
- Use subheadings to break up the content.
- Open with a personal/relatable hook (not "Hey {{first_name}}")
- 300-500 words in the body.
- End with a soft CTA (reply to this email, check out a resource, etc.)
- Conversational but substantive — the reader should feel like they learned something.

Return ONLY valid JSON with "subject" (compelling, 5-10 words) and "body" (markdown formatted).`,
      system_prompt: '',
    })
  ),
  interpolatePrompt: jest.fn((template: string, vars: Record<string, string>) => {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }),
}));

jest.mock('@/lib/ai/content-pipeline/voice-prompt-builder', () => ({
  buildVoicePromptSection: jest.fn((profile: unknown, _contentType: string) => {
    if (!profile) return '';
    const p = profile as {
      tone?: string;
      banned_phrases?: string[];
      structure_patterns?: Record<string, string[]>;
      content_length?: Record<string, string>;
    };
    const sections: string[] = [];
    sections.push('## Writing Style (learned from author edits)');
    if (p.tone) sections.push(`Tone: ${p.tone}`);
    if (p.banned_phrases?.length) {
      sections.push(`NEVER use these phrases: ${p.banned_phrases.join(', ')}`);
    }
    const structurePatterns = p.structure_patterns?.['email'];
    if (structurePatterns?.length) {
      sections.push(`Structure (email): ${structurePatterns.join('. ')}`);
    }
    const lengthTarget = p.content_length?.['email'];
    if (lengthTarget) sections.push(`Length target: ${lengthTarget}`);
    return sections.join('\n');
  }),
}));

import { writeNewsletterEmail, type WriteEmailInput } from '@/lib/ai/content-pipeline/email-writer';
import type { TeamVoiceProfile } from '@/lib/types/content-pipeline';

function makeApiResponse(subject: string, body: string) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ subject, body }),
      },
    ],
  };
}

describe('writeNewsletterEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------
  // 1. Generates email with subject and body
  // ----------------------------------------

  it('generates email with subject and body from topic + knowledge context', async () => {
    const expectedSubject = 'Why Cold Outreach Still Works in 2026';
    const expectedBody = '## The Problem\n\nMost people think cold email is dead...\n\n## What Actually Works\n\n1. Personalization at scale\n2. Multi-channel follow-up\n\nHit reply and tell me your biggest cold email challenge.';

    mockMessagesCreate.mockResolvedValue(makeApiResponse(expectedSubject, expectedBody));

    const input: WriteEmailInput = {
      topic: 'Cold outreach strategies',
      knowledgeContext: 'Insight: Personalization at scale is key. Story: Client doubled reply rates with video.',
    };

    const result = await writeNewsletterEmail(input);

    expect(result.subject).toBe(expectedSubject);
    expect(result.body).toBe(expectedBody);

    // Verify the API was called with correct model and prompt structure
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-test');
    expect(callArgs.max_tokens).toBe(2000);
    expect(callArgs.messages[0].role).toBe('user');
    expect(callArgs.messages[0].content).toContain('Cold outreach strategies');
    expect(callArgs.messages[0].content).toContain('Personalization at scale is key');
  });

  // ----------------------------------------
  // 2. Includes voice profile in prompt
  // ----------------------------------------

  it('includes voice profile section in prompt when provided', async () => {
    mockMessagesCreate.mockResolvedValue(
      makeApiResponse('Subject', 'Body content')
    );

    const voiceProfile: TeamVoiceProfile = {
      tone: 'direct and witty',
      banned_phrases: ['game-changer', 'leverage'],
      structure_patterns: {
        linkedin: ['Bold hook'],
        email: ['Open with story', 'Close with CTA'],
      },
      content_length: {
        linkedin: '300 words',
        email: '400-500 words',
      },
    };

    const input: WriteEmailInput = {
      topic: 'Sales automation',
      knowledgeContext: 'Some context here',
      voiceProfile,
    };

    await writeNewsletterEmail(input);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    // Voice profile sections should be embedded in the prompt
    expect(prompt).toContain('direct and witty');
    expect(prompt).toContain('game-changer, leverage');
    // Should use email-specific structure patterns
    expect(prompt).toContain('Structure (email): Open with story. Close with CTA');
    expect(prompt).toContain('400-500 words');
    // Should NOT include linkedin-specific patterns
    expect(prompt).not.toContain('Structure (linkedin)');
    expect(prompt).not.toContain('300 words');
  });

  // ----------------------------------------
  // 3. Handles null/undefined voice profile
  // ----------------------------------------

  it('handles null voice profile gracefully', async () => {
    mockMessagesCreate.mockResolvedValue(
      makeApiResponse('Subject Line', 'Email body')
    );

    const input: WriteEmailInput = {
      topic: 'Scaling your agency',
      knowledgeContext: 'Context about agency scaling',
      voiceProfile: null,
    };

    const result = await writeNewsletterEmail(input);

    expect(result.subject).toBe('Subject Line');
    expect(result.body).toBe('Email body');

    // The prompt should NOT contain voice profile section header
    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('## Writing Style');
  });

  it('handles undefined voice profile gracefully', async () => {
    mockMessagesCreate.mockResolvedValue(
      makeApiResponse('Subject Line', 'Email body')
    );

    const input: WriteEmailInput = {
      topic: 'Content strategy',
      knowledgeContext: 'Some context',
      // voiceProfile is undefined (not provided)
    };

    const result = await writeNewsletterEmail(input);

    expect(result.subject).toBe('Subject Line');
    expect(result.body).toBe('Email body');

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('## Writing Style');
  });

  // ----------------------------------------
  // 4. Includes LinkedIn topic for thematic consistency
  // ----------------------------------------

  it('includes LinkedIn topic in prompt when provided', async () => {
    mockMessagesCreate.mockResolvedValue(
      makeApiResponse('Subject', 'Body')
    );

    const input: WriteEmailInput = {
      topic: 'Prospecting on LinkedIn',
      knowledgeContext: 'Context here',
      todaysLinkedInTopic: 'Why LinkedIn DMs get 3x more replies than cold email',
    };

    await writeNewsletterEmail(input);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Why LinkedIn DMs get 3x more replies than cold email');
    expect(prompt).toContain('thematic consistency');
    expect(prompt).toContain('write DIFFERENT content');
  });

  it('omits LinkedIn topic section when not provided', async () => {
    mockMessagesCreate.mockResolvedValue(
      makeApiResponse('Subject', 'Body')
    );

    const input: WriteEmailInput = {
      topic: 'Prospecting on LinkedIn',
      knowledgeContext: 'Context here',
      // todaysLinkedInTopic not provided
    };

    await writeNewsletterEmail(input);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('thematic consistency');
  });

  // ----------------------------------------
  // 5. Includes author name when provided
  // ----------------------------------------

  it('includes author name in prompt when provided', async () => {
    mockMessagesCreate.mockResolvedValue(
      makeApiResponse('Subject', 'Body')
    );

    const input: WriteEmailInput = {
      topic: 'B2B sales tips',
      knowledgeContext: 'Context',
      authorName: 'Tim Johnson',
    };

    await writeNewsletterEmail(input);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('AUTHOR: Tim Johnson');
  });

  it('omits author section when not provided', async () => {
    mockMessagesCreate.mockResolvedValue(
      makeApiResponse('Subject', 'Body')
    );

    const input: WriteEmailInput = {
      topic: 'B2B sales tips',
      knowledgeContext: 'Context',
    };

    await writeNewsletterEmail(input);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('AUTHOR:');
  });

  // ----------------------------------------
  // 6. Handles API errors gracefully
  // ----------------------------------------

  it('throws when API call fails', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('API rate limit exceeded'));

    const input: WriteEmailInput = {
      topic: 'Topic',
      knowledgeContext: 'Context',
    };

    await expect(writeNewsletterEmail(input)).rejects.toThrow('API rate limit exceeded');
  });

  it('throws when API returns non-text content', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'tool-1', name: 'test', input: {} }],
    });

    const input: WriteEmailInput = {
      topic: 'Topic',
      knowledgeContext: 'Context',
    };

    // parseJsonResponse will fail to parse empty string
    await expect(writeNewsletterEmail(input)).rejects.toThrow();
  });

  // ----------------------------------------
  // 7. Prompt contains newsletter-specific rules
  // ----------------------------------------

  it('includes newsletter-specific instructions in prompt', async () => {
    mockMessagesCreate.mockResolvedValue(
      makeApiResponse('Subject', 'Body')
    );

    const input: WriteEmailInput = {
      topic: 'Agency growth',
      knowledgeContext: 'Growth strategies context',
    };

    await writeNewsletterEmail(input);

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('NOT a LinkedIn post');
    expect(prompt).toContain('300-500 words');
    expect(prompt).toContain('actionable takeaways');
    expect(prompt).toContain('subheadings');
    expect(prompt).toContain('soft CTA');
    expect(prompt).toContain('Return ONLY valid JSON');
  });
});
