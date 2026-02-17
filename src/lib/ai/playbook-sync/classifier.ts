import {
  getAnthropicClient,
  parseJsonResponse,
} from '../content-pipeline/anthropic-client';
import { CLAUDE_OPUS_MODEL } from '../content-pipeline/model-config';
import type { KnowledgeEntry } from '@/lib/types/content-pipeline';

export interface ClassificationResult {
  action: 'enrich' | 'redundant' | 'tangential';
  reasoning: string;
  target_section: string | null;
}

export async function classifyKnowledgeForSop(
  entry: KnowledgeEntry,
  sopContent: string,
  sopTitle: string
): Promise<ClassificationResult> {
  const client = getAnthropicClient();

  const prompt = `You are a knowledge curator for a GTM (go-to-market) playbook. Your job is to decide whether a piece of extracted knowledge belongs in a specific SOP (Standard Operating Procedure).

## The SOP
Title: ${sopTitle}

${sopContent}

## The Knowledge Entry
Category: ${entry.category}
Speaker: ${entry.speaker}
Source: ${entry.transcript_type} call
Content: ${entry.content}
Context: ${entry.context || 'N/A'}
Tags: ${entry.tags?.join(', ') || 'none'}

## Your Task
Decide ONE action:

1. **enrich** — This knowledge adds genuine NEW value to this SOP. It provides a tip, example, lesson learned, common question, or real-world insight that isn't already covered. It belongs in this SOP's topic area.

2. **redundant** — The SOP already covers this information adequately. The knowledge doesn't add meaningful new detail.

3. **tangential** — The knowledge was matched by semantic similarity but doesn't actually belong in this SOP. The topic is adjacent but not a fit.

If "enrich", also identify which section of the SOP would benefit most (e.g., "Steps", "Key Principles", "Common Mistakes", or a specific step number).

Return valid JSON:
{
  "action": "enrich" | "redundant" | "tangential",
  "reasoning": "1-2 sentences explaining your decision",
  "target_section": "section name or null if not enrich"
}`;

  const response = await client.messages.create({
    model: CLAUDE_OPUS_MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseJsonResponse<ClassificationResult>(textContent.text);
}
