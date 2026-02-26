import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from '@/lib/ai/anthropic-client';

/**
 * Get an Anthropic client for content-pipeline callers.
 * Routes through Helicone when HELICONE_API_KEY is set.
 *
 * @param caller - Optional caller name for Helicone tracking (defaults to 'content-pipeline')
 */
export function getAnthropicClient(caller?: string): Anthropic {
  return createAnthropicClient(caller || 'content-pipeline', { timeout: 240_000 });
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
