import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import { buildVoicePromptSection } from './voice-prompt-builder';
import type { TeamVoiceProfile } from '@/lib/types/content-pipeline';

export interface WriteEmailInput {
  topic: string;
  knowledgeContext: string;
  voiceProfile?: TeamVoiceProfile | null;
  todaysLinkedInTopic?: string;
  authorName?: string;
}

export interface EmailResult {
  subject: string;
  body: string;
}

export async function writeNewsletterEmail(input: WriteEmailInput): Promise<EmailResult> {
  const client = getAnthropicClient();
  const voiceSection = buildVoicePromptSection(input.voiceProfile, 'email');

  const prompt = `Write a daily newsletter email for a B2B audience.

TOPIC: ${input.topic}
${input.todaysLinkedInTopic ? `Today's LinkedIn post topic (for thematic consistency, but write DIFFERENT content): ${input.todaysLinkedInTopic}` : ''}
${input.authorName ? `AUTHOR: ${input.authorName}` : ''}

KNOWLEDGE CONTEXT:
${input.knowledgeContext}

${voiceSection}

NEWSLETTER EMAIL RULES:
- This is NOT a LinkedIn post. It should be longer, more detailed, more utility-focused.
- Include actionable takeaways the reader can use immediately.
- Use subheadings to break up the content.
- Open with a personal/relatable hook (not "Hey {{first_name}}")
- 300-500 words in the body.
- End with a soft CTA (reply to this email, check out a resource, etc.)
- Conversational but substantive — the reader should feel like they learned something.

Return ONLY valid JSON with "subject" (compelling, 5-10 words) and "body" (markdown formatted).`;

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const result = parseJsonResponse<EmailResult>(text);
  if (!result.subject || !result.body) {
    throw new Error('Email writer returned incomplete response');
  }
  return result;
}
