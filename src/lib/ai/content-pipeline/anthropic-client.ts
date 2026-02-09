import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    anthropicClient = new Anthropic({ apiKey, timeout: 240_000 });
  }
  return anthropicClient;
}

export function parseJsonResponse<T>(text: string): T {
  // Try direct JSON parse first
  try {
    return JSON.parse(text) as T;
  } catch {
    // Try extracting from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    }
    throw new Error(`Failed to parse JSON response: ${text.substring(0, 200)}`);
  }
}
