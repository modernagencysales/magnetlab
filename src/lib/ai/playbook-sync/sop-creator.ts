import { getAnthropicClient, parseJsonResponse } from '../content-pipeline/anthropic-client';
import { CLAUDE_OPUS_MODEL, CLAUDE_SONNET_MODEL } from '../content-pipeline/model-config';
import type { KnowledgeEntry } from '@/lib/types/content-pipeline';

/**
 * Escape curly-brace variable patterns that MDX interprets as JSX expressions.
 * Handles {var}, {{var}}, and {{{var}}} — wraps them in backticks.
 * Skips patterns already inside backticks or code fences.
 */
export function sanitizeMdxContent(content: string): string {
  const lines = content.split('\n');
  let inCodeFence = false;
  const result = lines.map((line) => {
    if (line.trim().startsWith('```')) {
      inCodeFence = !inCodeFence;
      return line;
    }
    if (inCodeFence) return line;

    // Match {var}, {{var}}, {{{var}}} NOT already inside backticks.
    // Captures the full brace expression including outer braces.
    return line.replace(
      /(?<!`)\{+([a-zA-Z_][a-zA-Z0-9_]*)\}+(?!`)/g,
      (match) => {
        // Check if this match is inside an existing backtick pair
        const idx = line.indexOf(match);
        const before = line.slice(0, idx);
        const _after = line.slice(idx + match.length);
        // Count unmatched backticks before — if odd, we're inside inline code
        const backticksBeforeCount = (before.match(/`/g) || []).length;
        if (backticksBeforeCount % 2 === 1) return match; // inside backticks
        return '`' + match + '`';
      }
    );
  });
  return result.join('\n');
}

export interface OrphanCluster {
  entries: KnowledgeEntry[];
  suggestedModule: string;
  suggestedTitle: string;
}

export interface NewSop {
  filePath: string;
  content: string;
  title: string;
  id: string;
  module: string;
  sidebarEntry: string;
}

export async function clusterOrphans(
  entries: KnowledgeEntry[],
  existingModules: string[]
): Promise<OrphanCluster[]> {
  if (entries.length < 3) return [];

  const client = getAnthropicClient();

  const entriesText = entries
    .map((e, i) => `[${i}] ${e.category} | Tags: ${e.tags?.join(', ')} | ${e.content.slice(0, 200)}`)
    .join('\n');

  const prompt = `You are organizing unmatched knowledge entries into topic clusters. Each cluster should represent a coherent SOP topic.

## Existing Modules in the Playbook
${existingModules.join('\n')}

## Unmatched Entries
${entriesText}

## Task
Group entries that share a common, actionable topic. Only create clusters of 3+ entries. Assign each cluster to the best-fit existing module.

Return valid JSON:
{
  "clusters": [
    {
      "entry_indices": [0, 3, 7],
      "suggested_module": "module-3-linkedin-outreach",
      "suggested_title": "LinkedIn Voice Notes for Warm Outreach"
    }
  ]
}

If no entries form a viable cluster of 3+, return {"clusters": []}.`;

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') return [];

  const parsed = parseJsonResponse<{
    clusters: Array<{
      entry_indices: number[];
      suggested_module: string;
      suggested_title: string;
    }>;
  }>(textContent.text);

  return parsed.clusters.map((c) => ({
    entries: c.entry_indices.map((i) => entries[i]).filter(Boolean),
    suggestedModule: c.suggested_module,
    suggestedTitle: c.suggested_title,
  }));
}

export async function generateNewSop(
  cluster: OrphanCluster,
  existingSopIds: string[],
  nextNumber: number
): Promise<NewSop> {
  const client = getAnthropicClient();

  const entriesText = cluster.entries
    .map((e) => `[${e.category}/${e.speaker}] ${e.content}\nContext: ${e.context || 'N/A'}`)
    .join('\n\n');

  const moduleNum = cluster.suggestedModule.match(/module-(\d+)/)?.[1] || '7';
  const sopId = `sop-${moduleNum}-${nextNumber}`;

  const prompt = `You are writing a short, punchy SOP for a GTM playbook based on knowledge from coaching and sales calls.

## Writing Style
- Write like a senior operator leaving notes for their team — direct, no fluff, no filler.
- Every sentence must earn its place. If it restates something already said, cut it.
- Steps should be 1 sentence each. "Do X" not "It's important to do X because Y and Z."
- Key Lessons: 1 sentence each. State the lesson, not a paragraph explaining it.
- Common Mistakes: 1 sentence each. State what NOT to do.
- Overview: 2 sentences max.
- Never use phrases like "It's worth noting", "This is crucial", "In practice", "It's important to", "Make sure to". Just state the action or fact.
- Target total length: 150-300 words (excluding frontmatter). Shorter is better.

## Template
\`\`\`markdown
---
id: ${sopId}-SLUG
title: "SOP ${moduleNum}.${nextNumber}: TITLE"
---

# SOP ${moduleNum}.${nextNumber}: TITLE

:::info Auto-Generated
This SOP was created from patterns identified across multiple coaching and sales calls.
:::

## Overview
1-2 sentences. What and why.

## Steps
1. **Step Name** — One sentence.
2. **Step Name** — One sentence.

## Key Lessons
- One sentence per lesson.

## Common Mistakes
- One sentence per mistake.
\`\`\`

## Knowledge Entries
${entriesText}

## Suggested Title: ${cluster.suggestedTitle}

## Task
Write a complete SOP following the template. Extract only the actionable, non-obvious insights from the entries. If two entries say the same thing, use the more specific one and drop the other. Do not pad sections — 3 great steps beat 7 mediocre ones.

The slug should be lowercase-hyphenated (e.g., "linkedin-voice-notes").

CRITICAL: MDX content — wrap any \`{variable}\` in backticks.

Return valid JSON:
{
  "slug": "the-slug",
  "title": "The Full Title",
  "content": "The complete markdown content including frontmatter"
}`;

  const response = await client.messages.create({
    model: CLAUDE_OPUS_MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const parsed = parseJsonResponse<{
    slug: string;
    title: string;
    content: string;
  }>(textContent.text);

  // Escape {variable} patterns that break MDX — wrap in backticks
  const sanitizedContent = sanitizeMdxContent(parsed.content);

  const id = `${sopId}-${parsed.slug}`;
  const filePath = `docs/sops/${cluster.suggestedModule}/${id}.md`;

  return {
    filePath,
    content: sanitizedContent,
    title: parsed.title,
    id,
    module: cluster.suggestedModule,
    sidebarEntry: id,
  };
}
