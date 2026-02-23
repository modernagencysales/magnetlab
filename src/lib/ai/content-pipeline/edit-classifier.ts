import { getAnthropicClient } from './anthropic-client';
import { CLAUDE_HAIKU_MODEL } from './model-config';

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
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Analyze what changed between the original and edited text. Identify specific writing style patterns.

Content type: ${input.contentType} (field: ${input.fieldName})

ORIGINAL:
${input.originalText}

EDITED:
${input.editedText}

Return JSON with "patterns" array. Each pattern has:
- "pattern": short snake_case label (e.g. "shortened_hook", "removed_jargon", "added_story", "softened_cta", "made_conversational", "added_specifics", "reduced_length")
- "description": one sentence explaining the change

Only include patterns that represent deliberate style choices, not typo fixes.
Return {"patterns": []} if no meaningful style changes detected.`,
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
