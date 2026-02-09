import type { TranscriptType } from '@/lib/types/content-pipeline';
import { CLAUDE_SONNET_MODEL } from './model-config';
import { getAnthropicClient } from './anthropic-client';

export async function classifyTranscript(transcript: string): Promise<TranscriptType> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 50,
    messages: [
      {
        role: 'user',
        content: `Classify this call transcript as either "coaching" or "sales".

Coaching calls: mentoring, teaching, advising, strategy sessions, consulting
Sales calls: discovery, demos, pitches, negotiations, closing

Respond with ONLY the word "coaching" or "sales".

TRANSCRIPT (first 3000 chars):
${transcript.slice(0, 3000)}`,
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text.trim().toLowerCase() : '';

  if (text === 'coaching' || text === 'sales') {
    return text;
  }

  // Default to coaching if ambiguous
  return 'coaching';
}
