import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import { buildVoicePromptSection } from './voice-prompt-builder';
import type { TeamVoiceProfile } from '@/lib/types/content-pipeline';

export interface PromotionPostInput {
  leadMagnetTitle: string;
  leadMagnetDescription: string;
  leadMagnetUrl: string;
  voiceProfile?: TeamVoiceProfile | null;
  authorName?: string;
}

export interface PromotionPost {
  content: string;
  angle: string; // problem_aware, curiosity, value_first, social_proof
  hook_type: string; // question, bold_statement, story, statistic
}

/**
 * Generate 4 LinkedIn promotional posts for a published lead magnet.
 * Each post uses a different persuasion angle and the author's evolved voice profile.
 */
export async function generatePromotionPosts(
  input: PromotionPostInput
): Promise<PromotionPost[]> {
  const client = getAnthropicClient();
  const voiceSection = buildVoicePromptSection(input.voiceProfile, 'linkedin');

  const prompt = `Generate 4 LinkedIn promotional posts for this lead magnet. Each uses a DIFFERENT angle.

LEAD MAGNET:
Title: ${input.leadMagnetTitle}
Description: ${input.leadMagnetDescription}
URL: ${input.leadMagnetUrl}
${input.authorName ? `Author: ${input.authorName}` : ''}

${voiceSection}

ANGLES (one post per angle):
1. Problem-aware: Lead with the pain point this solves
2. Curiosity-driven: Tease the insights without giving everything away
3. Value-first: Share one key takeaway, then point to the full resource
4. Social proof / FOMO: "X people already downloaded" or "This is what we use internally"

RULES:
- Each post 100-200 words
- Include a clear CTA with the link: ${input.leadMagnetUrl}
- Don't say "download my free guide" -- be creative with CTAs
- No emojis, no hashtags, no em dashes
- Each post should stand alone (not a series)

Return ONLY valid JSON array of objects with: "content", "angle" (problem_aware|curiosity|value_first|social_proof), "hook_type" (question|bold_statement|story|statistic)`;

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseJsonResponse<PromotionPost[]>(text);
}
