import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';

interface ExtractedTemplate {
  name: string;
  category: string;
  structure: string;
  use_cases: string[];
  tags: string[];
}

export async function extractTemplateFromPost(content: string): Promise<ExtractedTemplate> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Analyze this LinkedIn post and extract its reusable structure as a template. Replace specific details with placeholders like [TOPIC], [NUMBER], [RESULT], [STORY], etc.

POST:
${content}

Return ONLY valid JSON:
{
  "name": "Short descriptive name for this template (e.g., 'Before/After Transformation', 'Numbered Tips List')",
  "category": "One of: story, framework, listicle, contrarian, case_study, question, educational, motivational",
  "structure": "The template structure with placeholders. Each section on a new line. Use [PLACEHOLDER] format for variable parts. Keep the formatting pattern (line breaks, paragraph structure) of the original.",
  "use_cases": ["When to use this template - 2-3 short descriptions"],
  "tags": ["3-5 relevant tags like 'hooks', 'storytelling', 'data-driven'"]
}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseJsonResponse<ExtractedTemplate>(textContent.text);
}
