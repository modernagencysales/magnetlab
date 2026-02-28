import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import { getPrompt } from '@/lib/services/prompt-registry';

interface ExtractedMemory {
  rule: string;
  category: 'tone' | 'structure' | 'vocabulary' | 'content' | 'general';
  confidence: number;
}

const VALID_CATEGORIES = new Set(['tone', 'structure', 'vocabulary', 'content', 'general']);

const CORRECTION_PATTERNS = [
  /\b(don'?t|do not|never|stop|avoid|no more)\b/i,
  /\b(always|prefer|instead|rather|please use)\b/i,
  /\b(too (formal|casual|long|short|verbose|wordy|generic))\b/i,
  /\b(more|less) (formal|casual|concise|detailed|direct)\b/i,
  /\b(wrong tone|bad tone|not my voice|not my style)\b/i,
];

export function detectCorrectionSignal(text: string): boolean {
  return CORRECTION_PATTERNS.some(pattern => pattern.test(text));
}

export async function extractMemories(
  _userId: string,
  conversationContext: Array<{ role: string; content: string }>,
): Promise<ExtractedMemory[]> {
  try {
    const prompt = await getPrompt('copilot-memory-extractor');
    const client = createAnthropicClient('copilot-memory', { timeout: 30_000 });

    const contextText = conversationContext
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const response = await client.messages.create({
      model: prompt?.model || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      temperature: prompt?.temperature ?? 0.3,
      system: prompt?.system_prompt || 'Output JSON array of extracted rules:\n[{"rule": "...", "category": "tone|structure|vocabulary|content|general", "confidence": 0.0-1.0}]\nOnly extract clear, specific preferences. Return empty array if nothing clear.',
      messages: [{
        role: 'user',
        content: prompt?.user_prompt
          ? prompt.user_prompt.replace('{{conversation_context}}', contextText)
          : `Here is the conversation context where the user provided feedback or corrections:\n${contextText}\nExtract any preferences or rules the user is expressing. Return a JSON array.`,
      }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (m: Record<string, unknown>) =>
        typeof m.rule === 'string' &&
        m.rule.length > 0 &&
        VALID_CATEGORIES.has(m.category as string) &&
        typeof m.confidence === 'number' &&
        m.confidence >= 0 &&
        m.confidence <= 1
    ) as ExtractedMemory[];
  } catch {
    return [];
  }
}
