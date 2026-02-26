import { getAnthropicClient } from './anthropic-client';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';

export interface ClassifyInput {
  originalText: string;
  editedText: string;
  contentType: string;
  fieldName: string;
}

export interface EditPattern {
  pattern: string;
  description: string;
}

export interface ClassifyResult {
  patterns: EditPattern[];
}

/**
 * Analyzes what changed between original and edited text using Claude Haiku.
 * Identifies deliberate style patterns (not typo fixes).
 * Returns { patterns: [] } on any failure — never throws.
 */
export async function classifyEditPatterns(input: ClassifyInput): Promise<ClassifyResult> {
  try {
    const client = getAnthropicClient('edit-classifier');

    const template = await getPrompt('edit-classifier');
    const prompt = interpolatePrompt(template.user_prompt, {
      content_type: input.contentType,
      field_name: input.fieldName,
      original_text: input.originalText,
      edited_text: input.editedText,
    });

    const response = await client.messages.create({
      model: template.model,
      max_tokens: template.max_tokens,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { patterns: [] };
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { patterns: [] };
  }
}
