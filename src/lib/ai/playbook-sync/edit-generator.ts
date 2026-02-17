import { getAnthropicClient, parseJsonResponse } from '../content-pipeline/anthropic-client';
import { CLAUDE_OPUS_MODEL } from '../content-pipeline/model-config';
import type { KnowledgeEntry } from '@/lib/types/content-pipeline';

export interface GeneratedEdit {
  insert_after: string;
  new_content: string;
  summary: string;
}

export async function generateSopEdit(
  entries: KnowledgeEntry[],
  sopContent: string,
  sopTitle: string,
  targetSection: string
): Promise<GeneratedEdit> {
  const client = getAnthropicClient();

  const entriesText = entries
    .map(
      (e, i) =>
        `Entry ${i + 1} [${e.category}/${e.speaker}/${e.transcript_type}]:\n${e.content}\nContext: ${e.context || 'N/A'}`
    )
    .join('\n\n');

  const prompt = `You are editing a GTM playbook SOP to add real-world knowledge from coaching and sales calls. You must ONLY ADD content — never modify or remove existing text.

## Rules
1. NEVER change existing text. Only insert new blocks.
2. Use Docusaurus callout syntax for insertions.
3. Keep insertions concise: 1-3 sentences per callout.
4. If multiple entries cover the same point, combine into ONE callout.
5. Use the appropriate callout type:
   - \`:::tip From the Field\` — for insights, tactics, frameworks (from coaching calls)
   - \`:::tip From Sales Calls\` — for insights from sales/prospect conversations
   - \`:::warning Common Question\` — for questions and objections
   - \`:::info Real-World Example\` — for product intel, specific examples, data points
6. Place the insertion immediately AFTER the most relevant existing line.

## The SOP
Title: ${sopTitle}
Target Section: ${targetSection}

${sopContent}

## Knowledge Entries to Integrate
${entriesText}

## Your Task
Generate a single insertion. Return valid JSON:
{
  "insert_after": "The exact line of existing text to insert after (copy verbatim from the SOP — must be unique enough to locate)",
  "new_content": "The markdown callout block to insert (including ::: delimiters)",
  "summary": "Brief description of what was added (for the changelog)"
}

IMPORTANT: The "insert_after" must be an EXACT substring of the SOP content that uniquely identifies the insertion point. Pick a distinctive line near the target section.`;

  const response = await client.messages.create({
    model: CLAUDE_OPUS_MODEL,
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseJsonResponse<GeneratedEdit>(textContent.text);
}
