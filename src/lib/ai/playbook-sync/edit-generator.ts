import { getAnthropicClient, parseJsonResponse } from '../content-pipeline/anthropic-client';
import { CLAUDE_OPUS_MODEL, CLAUDE_SONNET_MODEL } from '../content-pipeline/model-config';
import { sanitizeMdxContent } from '../playbook-sync/sop-creator';
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
3. MAX 1-2 sentences per callout. Be brutally concise — write like a field note, not an essay.
4. If multiple entries cover the same point, combine into ONE callout. Never repeat a point the SOP already makes.
5. Only add genuinely NEW information — a specific tactic, number, quote, or example not already in the SOP. If an entry just restates what the SOP says, skip it entirely.
6. Use the appropriate callout type:
   - \`:::tip From the Field\` — for insights, tactics, frameworks (from coaching calls)
   - \`:::tip From Sales Calls\` — for insights from sales/prospect conversations
   - \`:::warning Common Question\` — for questions and objections
   - \`:::info Real-World Example\` — for product intel, specific examples, data points
7. Place the insertion immediately AFTER the most relevant existing line.
8. CRITICAL: This is MDX content. NEVER use bare {variable} or {{variable}} patterns — wrap in backticks: \`{variable}\`.
9. No filler phrases like "It's worth noting", "In practice", "This is important because". Just state the insight directly.

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

  const edit = parseJsonResponse<GeneratedEdit>(textContent.text);
  edit.new_content = sanitizeMdxContent(edit.new_content);
  return edit;
}

/**
 * Format product_intel entries into a Docusaurus reference section.
 * Uses Sonnet for light formatting — grouping by tool/topic with callouts.
 */
export async function formatReferenceEntries(
  entries: KnowledgeEntry[]
): Promise<string> {
  const client = getAnthropicClient();

  const entriesText = entries
    .map(
      (e, i) =>
        `[${i + 1}] [${e.speaker || 'Unknown'}] ${e.content}\nContext: ${e.context || 'N/A'}`
    )
    .join('\n\n');

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Format these product/tool mentions from coaching and sales calls into a Docusaurus reference section.

## Entries
${entriesText}

## Rules
1. Group entries by tool/product (e.g., "Clay", "LinkedIn Sales Navigator", "Cold Email Tools")
2. Use \`:::info\` callouts for each group
3. Keep the original insight — do not add interpretation or filler
4. MAX 1 sentence per insight. Merge duplicates — if two entries say the same thing, keep only the most specific version.
5. Add speaker attribution at the end: *— {speaker}*
6. CRITICAL: MDX content — wrap any \`{variable}\` in backticks.
7. No introductory sentences, no summaries, no "Here's what was mentioned" preambles. Jump straight into the callouts.

Return ONLY the formatted markdown (no JSON wrapper, no frontmatter, no top-level heading).`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  return textContent?.type === 'text' ? sanitizeMdxContent(textContent.text) : '';
}

/**
 * Format question entries into a Docusaurus FAQ section.
 * Uses Sonnet for light formatting — extracting clear Q&A pairs.
 */
export async function formatFaqEntries(
  entries: KnowledgeEntry[]
): Promise<string> {
  const client = getAnthropicClient();

  const entriesText = entries
    .map(
      (e, i) =>
        `[${i + 1}] [${e.speaker || 'Unknown'}] ${e.content}\nContext: ${e.context || 'N/A'}`
    )
    .join('\n\n');

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Format these questions from coaching and sales calls into a Docusaurus FAQ section.

## Questions
${entriesText}

## Rules
1. Each entry becomes a ### heading with a short, direct question
2. If the question is implicit, extract it from the content
3. Keep answers to 1-2 sentences. Give the answer, not a discussion.
4. Use \`:::tip\` only if the answer contains a specific actionable step — don't add tips just to have them
5. Add attribution: *— {speaker}*
6. CRITICAL: MDX content — wrap any \`{variable}\` in backticks.
7. Merge duplicate questions. If two people asked the same thing, combine into one entry with the best answer.
8. No filler like "Great question" or "This comes up often". Just the Q&A.

Return ONLY the formatted markdown FAQ entries (no JSON wrapper, no frontmatter, no top-level heading).`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  return textContent?.type === 'text' ? sanitizeMdxContent(textContent.text) : '';
}
