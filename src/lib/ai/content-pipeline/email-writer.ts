import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { buildVoicePromptSection } from './voice-prompt-builder';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';
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

  const template = await getPrompt('email-newsletter');
  const prompt = interpolatePrompt(template.user_prompt, {
    topic: input.topic,
    linkedin_topic_section: input.todaysLinkedInTopic
      ? `Today's LinkedIn post topic (for thematic consistency, but write DIFFERENT content): ${input.todaysLinkedInTopic}`
      : '',
    author_section: input.authorName ? `AUTHOR: ${input.authorName}` : '',
    knowledge_context: input.knowledgeContext,
    voice_style_section: voiceSection,
  });

  const response = await client.messages.create({
    model: template.model,
    max_tokens: template.max_tokens,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const result = parseJsonResponse<EmailResult>(text);
  if (!result.subject || !result.body) {
    throw new Error('Email writer returned incomplete response');
  }
  return result;
}
