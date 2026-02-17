import { getAnthropicClient, parseJsonResponse } from '../content-pipeline/anthropic-client';
import { CLAUDE_OPUS_MODEL, CLAUDE_SONNET_MODEL } from '../content-pipeline/model-config';
import type { KnowledgeEntry } from '@/lib/types/content-pipeline';

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

  const prompt = `You are writing a new SOP (Standard Operating Procedure) for a GTM playbook based on knowledge extracted from coaching and sales calls.

## Template
Every SOP follows this structure:
\`\`\`markdown
---
id: ${sopId}-SLUG
title: "SOP ${moduleNum}.${nextNumber}: TITLE"
---

# SOP ${moduleNum}.${nextNumber}: TITLE

:::info Auto-Generated
This SOP was created from patterns identified across multiple coaching and sales calls. It will continue to evolve as new knowledge is captured.
:::

## Overview
Brief description of what this SOP covers and why it matters.

## Steps
1. **Step Name** — Description
2. **Step Name** — Description

## Key Lessons
- Lesson from the field

## Common Mistakes
- Mistake to avoid
\`\`\`

## Knowledge Entries
${entriesText}

## Suggested Title: ${cluster.suggestedTitle}

## Task
Write a complete SOP following the template above. The content should be grounded in the knowledge entries — extract actionable steps, principles, and lessons. Make the SOP useful as a standalone reference.

The slug should be lowercase-hyphenated (e.g., "linkedin-voice-notes").

Return valid JSON:
{
  "slug": "the-slug",
  "title": "The Full Title",
  "content": "The complete markdown content including frontmatter"
}`;

  const response = await client.messages.create({
    model: CLAUDE_OPUS_MODEL,
    max_tokens: 4000,
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

  const id = `${sopId}-${parsed.slug}`;
  const filePath = `docs/sops/${cluster.suggestedModule}/${id}.md`;

  return {
    filePath,
    content: parsed.content,
    title: parsed.title,
    id,
    module: cluster.suggestedModule,
    sidebarEntry: id,
  };
}
