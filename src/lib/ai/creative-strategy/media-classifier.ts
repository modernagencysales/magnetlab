/** Media Classifier. Classifies LinkedIn post media type using Claude Vision. Never imports from Next.js HTTP layer. */

import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import { logError } from '@/lib/utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────────

const MEDIA_CLASSIFICATIONS = [
  'tweet screenshot',
  'slack conversation',
  'infographic',
  'photo',
  'meme',
  'chart/graph',
  'carousel slide',
  'document page',
  'selfie',
  'product screenshot',
  'other',
] as const;

const CLASSIFY_PROMPT = `You are an image classifier for LinkedIn post media. Classify this image into exactly one of these categories:

${MEDIA_CLASSIFICATIONS.map((c) => `- ${c}`).join('\n')}

Respond with ONLY the classification label, nothing else. No punctuation, no explanation.`;

// ─── Main function ──────────────────────────────────────────────────────────

/**
 * Classify a media URL using Claude Vision (Haiku for speed/cost).
 * Returns a single classification string from the known set.
 * Falls back to 'other' on any error.
 */
export async function classifyMedia(mediaUrl: string): Promise<string> {
  if (!mediaUrl.trim()) return 'other';

  try {
    const client = createAnthropicClient('cs-media-classifier', { timeout: 30_000 });

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: mediaUrl },
            },
            {
              type: 'text',
              text: CLASSIFY_PROMPT,
            },
          ],
        },
      ],
    });

    const text =
      response.content?.[0]?.type === 'text' ? response.content[0].text.trim().toLowerCase() : '';

    // Validate against known classifications
    const matched = MEDIA_CLASSIFICATIONS.find((c) => text === c);
    return matched ?? 'other';
  } catch (error) {
    logError('cs-media-classifier', error, { mediaUrl: mediaUrl.substring(0, 100) });
    return 'other';
  }
}
