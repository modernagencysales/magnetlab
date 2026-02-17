# Playbook Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a weekly Trigger.dev cron task that matches new knowledge entries to Docusaurus playbook SOPs, generates additive-only edits, creates new SOPs when needed, and commits changes to GitHub.

**Architecture:** A scheduled Trigger.dev task fetches knowledge entries since the last sync, embeds and matches them against cached SOP embeddings via cosine similarity, uses Claude Opus 4.6 to classify and generate edits, clusters orphaned entries into new SOPs, and commits all changes via the GitHub API.

**Tech Stack:** Trigger.dev v4 (cron), Anthropic SDK (Opus 4.6 + Sonnet), OpenAI embeddings, Octokit (GitHub API), Supabase (PostgreSQL + pgvector)

---

## Task 1: Add Octokit Dependency

**Files:**
- Modify: `package.json`

**Step 1: Install octokit**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm install @octokit/rest`

**Step 2: Verify installation**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && node -e "const { Octokit } = require('@octokit/rest'); console.log('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add package.json package-lock.json
git commit -m "deps: add @octokit/rest for GitHub API access"
```

---

## Task 2: Create Supabase Migration for Sync Tables

**Files:**
- Create: `supabase/migrations/20260217000000_playbook_sync.sql`

**Step 1: Write the migration**

```sql
-- Playbook sync tables for the living wiki system

-- Cached SOP embeddings for semantic matching
CREATE TABLE IF NOT EXISTS cp_sop_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  embedding vector(1536),
  title TEXT,
  module TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_sop_embeddings_path ON cp_sop_embeddings(file_path);
CREATE INDEX IF NOT EXISTS idx_cp_sop_embeddings_vec ON cp_sop_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- Run log for each weekly sync
CREATE TABLE IF NOT EXISTS cp_playbook_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entries_processed INT NOT NULL DEFAULT 0,
  entries_enriched INT NOT NULL DEFAULT 0,
  entries_redundant INT NOT NULL DEFAULT 0,
  entries_orphaned INT NOT NULL DEFAULT 0,
  sops_enriched TEXT[] DEFAULT '{}',
  sops_created TEXT[] DEFAULT '{}',
  commit_sha TEXT,
  commit_message TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  error_log TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit trail: which knowledge entry matched which SOP
CREATE TABLE IF NOT EXISTS cp_knowledge_sop_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_entry_id UUID NOT NULL REFERENCES cp_knowledge_entries(id) ON DELETE CASCADE,
  sop_file_path TEXT,
  similarity_score FLOAT,
  action TEXT NOT NULL CHECK (action IN ('enrich', 'redundant', 'tangential', 'orphaned', 'new_sop')),
  edit_summary TEXT,
  sync_run_id UUID NOT NULL REFERENCES cp_playbook_sync_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_ksm_sync_run ON cp_knowledge_sop_matches(sync_run_id);
CREATE INDEX IF NOT EXISTS idx_cp_ksm_knowledge ON cp_knowledge_sop_matches(knowledge_entry_id);

-- RPC: match knowledge entries against SOP embeddings
CREATE OR REPLACE FUNCTION cp_match_sop_embeddings(
  query_embedding TEXT,
  threshold FLOAT DEFAULT 0.6,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  file_path TEXT,
  title TEXT,
  module TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  parsed_embedding vector(1536);
BEGIN
  parsed_embedding := query_embedding::vector(1536);
  RETURN QUERY
  SELECT
    se.file_path,
    se.title,
    se.module,
    (1 - (se.embedding <=> parsed_embedding))::FLOAT AS similarity
  FROM cp_sop_embeddings se
  WHERE se.embedding IS NOT NULL
    AND (1 - (se.embedding <=> parsed_embedding)) > threshold
  ORDER BY se.embedding <=> parsed_embedding
  LIMIT match_count;
END;
$$;
```

**Step 2: Push the migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx supabase db push --linked`

If local Supabase CLI isn't linked, push via Management API instead:

```bash
SUPABASE_TOKEN=$(security find-generic-password -s "Supabase CLI" -w | sed 's/go-keyring-base64://' | base64 -D)
curl -s -X POST "https://api.supabase.com/v1/projects/qvawbxpijxlwdkolmjrs/database/query" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "<SQL_CONTENTS>"}'
```

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add supabase/migrations/20260217000000_playbook_sync.sql
git commit -m "db: add playbook sync tables (sop_embeddings, sync_runs, knowledge_sop_matches)"
```

---

## Task 3: Create Model Config for Opus 4.6

**Files:**
- Modify: `src/lib/ai/content-pipeline/model-config.ts`

**Step 1: Add Opus model constant**

Add to the existing `model-config.ts`:

```typescript
export const CLAUDE_OPUS_MODEL = 'claude-opus-4-20250514';
```

This keeps the central model config pattern — all AI modules reference these constants.

**Step 2: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/ai/content-pipeline/model-config.ts
git commit -m "config: add Claude Opus 4.6 model constant"
```

---

## Task 4: Create GitHub Client Module

**Files:**
- Create: `src/lib/ai/playbook-sync/github-client.ts`

**Step 1: Write the GitHub client**

```typescript
import { Octokit } from '@octokit/rest';

const REPO_OWNER = 'modernagencysales';
const REPO_NAME = 'playbooks';

let octokit: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN is not set');
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

export interface RepoFile {
  path: string;
  content: string;
  sha: string;
}

/**
 * Fetch all markdown files from docs/ in the playbooks repo.
 * Uses the Git Trees API to get all files in one call, then fetches content.
 */
export async function fetchAllSopFiles(): Promise<RepoFile[]> {
  const gh = getOctokit();

  // Get the default branch SHA
  const { data: ref } = await gh.git.getRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: 'heads/main',
  });
  const treeSha = ref.object.sha;

  // Get the full tree recursively
  const { data: tree } = await gh.git.getTree({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    tree_sha: treeSha,
    recursive: 'true',
  });

  // Filter to docs/**/*.md files (SOPs and weekly guides)
  const mdFiles = tree.tree.filter(
    (item) =>
      item.type === 'blob' &&
      item.path?.startsWith('docs/') &&
      item.path?.endsWith('.md')
  );

  // Fetch content for each file
  const files: RepoFile[] = [];
  for (const file of mdFiles) {
    if (!file.path || !file.sha) continue;
    const { data: blob } = await gh.git.getBlob({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      file_sha: file.sha,
    });
    const content = Buffer.from(blob.content, 'base64').toString('utf-8');
    files.push({ path: file.path, content, sha: file.sha });
  }

  return files;
}

/**
 * Fetch the current sidebars.js content.
 */
export async function fetchSidebars(): Promise<{ content: string; sha: string }> {
  const gh = getOctokit();
  const { data } = await gh.repos.getContent({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    path: 'sidebars.js',
  });

  if (!('content' in data)) throw new Error('sidebars.js not found');
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { content, sha: data.sha };
}

export interface FileChange {
  path: string;
  content: string;
}

/**
 * Commit multiple file changes in a single commit using the Git Trees API.
 * This avoids race conditions and creates one atomic commit.
 */
export async function commitChanges(
  changes: FileChange[],
  message: string
): Promise<string> {
  const gh = getOctokit();

  // Get current HEAD
  const { data: ref } = await gh.git.getRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: 'heads/main',
  });
  const parentSha = ref.object.sha;

  // Create blobs for each changed file
  const treeItems = await Promise.all(
    changes.map(async (change) => {
      const { data: blob } = await gh.git.createBlob({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        content: change.content,
        encoding: 'utf-8',
      });
      return {
        path: change.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha,
      };
    })
  );

  // Create tree
  const { data: tree } = await gh.git.createTree({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    base_tree: parentSha,
    tree: treeItems,
  });

  // Create commit
  const { data: commit } = await gh.git.createCommit({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    message,
    tree: tree.sha,
    parents: [parentSha],
  });

  // Update ref
  await gh.git.updateRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: 'heads/main',
    sha: commit.sha,
  });

  return commit.sha;
}
```

**Step 2: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/ai/playbook-sync/github-client.ts
git commit -m "feat: add GitHub client for playbook repo operations"
```

---

## Task 5: Create SOP Embedding Cache Module

**Files:**
- Create: `src/lib/ai/playbook-sync/sop-embeddings.ts`

**Step 1: Write the SOP embedding cache**

```typescript
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { createHash } from 'crypto';
import { logger } from '@trigger.dev/sdk/v3';
import type { RepoFile } from './github-client';

export interface CachedSop {
  filePath: string;
  title: string;
  module: string;
  content: string;
  embedding: number[];
}

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function extractFrontmatter(content: string): { title: string; id: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { title: '', id: '' };
  const titleMatch = match[1].match(/title:\s*["']?(.+?)["']?\s*$/m);
  const idMatch = match[1].match(/id:\s*(.+)/);
  return {
    title: titleMatch?.[1] || '',
    id: idMatch?.[1]?.trim() || '',
  };
}

function extractModule(filePath: string): string {
  const match = filePath.match(/module-(\d+)/);
  return match ? `module-${match[1]}` : 'weekly-guide';
}

/**
 * Sync SOP embeddings: re-embed only files whose content hash changed.
 * Returns all SOPs with their embeddings for matching.
 */
export async function syncSopEmbeddings(sopFiles: RepoFile[]): Promise<CachedSop[]> {
  const supabase = createSupabaseAdminClient();

  // Fetch existing cache
  const { data: cached } = await supabase
    .from('cp_sop_embeddings')
    .select('file_path, content_hash, embedding, title, module');

  const cacheMap = new Map(
    (cached || []).map((c) => [c.file_path, c])
  );

  const results: CachedSop[] = [];
  let reembedded = 0;

  for (const file of sopFiles) {
    const hash = contentHash(file.content);
    const existing = cacheMap.get(file.path);
    const { title } = extractFrontmatter(file.content);
    const module = extractModule(file.path);

    if (existing && existing.content_hash === hash && existing.embedding) {
      // Cache hit — use existing embedding
      const embeddingArray = typeof existing.embedding === 'string'
        ? JSON.parse(existing.embedding)
        : existing.embedding;
      results.push({
        filePath: file.path,
        title: existing.title || title,
        module: existing.module || module,
        content: file.content,
        embedding: embeddingArray,
      });
      continue;
    }

    // Cache miss — re-embed
    logger.info('Re-embedding SOP', { path: file.path });
    const embeddingText = `${title}\n\n${file.content.slice(0, 8000)}`;
    const embedding = await generateEmbedding(embeddingText);
    reembedded++;

    // Upsert to cache
    await supabase
      .from('cp_sop_embeddings')
      .upsert(
        {
          file_path: file.path,
          content_hash: hash,
          embedding: JSON.stringify(embedding),
          title,
          module,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'file_path' }
      );

    results.push({ filePath: file.path, title, module, content: file.content, embedding });
  }

  logger.info('SOP embedding sync complete', {
    total: sopFiles.length,
    reembedded,
    cached: sopFiles.length - reembedded,
  });

  return results;
}
```

**Step 2: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/ai/playbook-sync/sop-embeddings.ts
git commit -m "feat: add SOP embedding cache with content-hash invalidation"
```

---

## Task 6: Create AI Classification Module (Opus 4.6)

**Files:**
- Create: `src/lib/ai/playbook-sync/classifier.ts`

**Step 1: Write the classifier**

```typescript
import { getAnthropicClient, parseJsonResponse } from '../content-pipeline/anthropic-client';
import { CLAUDE_OPUS_MODEL } from '../content-pipeline/model-config';
import { logger } from '@trigger.dev/sdk/v3';
import type { KnowledgeEntry } from '@/lib/types/content-pipeline';

export interface ClassificationResult {
  action: 'enrich' | 'redundant' | 'tangential';
  reasoning: string;
  target_section: string | null;
}

/**
 * Uses Claude Opus 4.6 to decide whether a knowledge entry should
 * enrich an SOP, is redundant, or is tangential.
 */
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
```

**Step 2: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/ai/playbook-sync/classifier.ts
git commit -m "feat: add Opus 4.6 knowledge-to-SOP classifier"
```

---

## Task 7: Create AI Edit Generator Module (Opus 4.6)

**Files:**
- Create: `src/lib/ai/playbook-sync/edit-generator.ts`

**Step 1: Write the edit generator**

```typescript
import { getAnthropicClient, parseJsonResponse } from '../content-pipeline/anthropic-client';
import { CLAUDE_OPUS_MODEL } from '../content-pipeline/model-config';
import type { KnowledgeEntry } from '@/lib/types/content-pipeline';

export interface GeneratedEdit {
  insert_after: string;
  new_content: string;
  summary: string;
}

/**
 * Uses Claude Opus 4.6 to generate an additive-only edit for an SOP.
 * Returns a block of markdown to insert and the anchor text to insert after.
 */
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
```

**Step 2: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/ai/playbook-sync/edit-generator.ts
git commit -m "feat: add Opus 4.6 additive-only SOP edit generator"
```

---

## Task 8: Create AI New SOP Generator Module (Opus 4.6)

**Files:**
- Create: `src/lib/ai/playbook-sync/sop-creator.ts`

**Step 1: Write the new SOP creator**

```typescript
import { getAnthropicClient, parseJsonResponse } from '../content-pipeline/anthropic-client';
import { CLAUDE_OPUS_MODEL } from '../content-pipeline/model-config';
import { CLAUDE_SONNET_MODEL } from '../content-pipeline/model-config';
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

/**
 * Uses Claude Sonnet to cluster orphaned knowledge entries by topic.
 * Returns clusters of 3+ entries that warrant a new SOP.
 */
export async function clusterOrphans(
  entries: KnowledgeEntry[],
  existingModules: string[]
): Promise<OrphanCluster[]> {
  if (entries.length < 3) return [];

  const client = getAnthropicClient();

  const entriesText = entries
    .map(
      (e, i) =>
        `[${i}] ${e.category} | Tags: ${e.tags?.join(', ')} | ${e.content.slice(0, 200)}`
    )
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

/**
 * Uses Claude Opus 4.6 to generate a complete new SOP from a cluster of knowledge entries.
 */
export async function generateNewSop(
  cluster: OrphanCluster,
  existingSopIds: string[],
  nextNumber: number
): Promise<NewSop> {
  const client = getAnthropicClient();

  const entriesText = cluster.entries
    .map(
      (e) =>
        `[${e.category}/${e.speaker}] ${e.content}\nContext: ${e.context || 'N/A'}`
    )
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
(as many steps as needed)

## Key Lessons
- Lesson from the field
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
```

**Step 2: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/ai/playbook-sync/sop-creator.ts
git commit -m "feat: add orphan clusterer (Sonnet) + new SOP generator (Opus)"
```

---

## Task 9: Create the Playbook Sync Trigger.dev Task

**Files:**
- Create: `src/trigger/playbook-sync.ts`

This is the main orchestrator task that ties all the modules together.

**Step 1: Write the task**

```typescript
import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding, cosineSimilarity } from '@/lib/ai/embeddings';
import { fetchAllSopFiles, commitChanges, fetchSidebars } from '@/lib/ai/playbook-sync/github-client';
import { syncSopEmbeddings } from '@/lib/ai/playbook-sync/sop-embeddings';
import { classifyKnowledgeForSop } from '@/lib/ai/playbook-sync/classifier';
import { generateSopEdit } from '@/lib/ai/playbook-sync/edit-generator';
import { clusterOrphans, generateNewSop } from '@/lib/ai/playbook-sync/sop-creator';
import type { KnowledgeEntry } from '@/lib/types/content-pipeline';
import type { FileChange } from '@/lib/ai/playbook-sync/github-client';
import type { GeneratedEdit } from '@/lib/ai/playbook-sync/edit-generator';

export const playbookSync = schedules.task({
  id: 'playbook-sync',
  cron: '0 0 * * 0', // Sunday midnight UTC
  maxDuration: 900, // 15 minutes
  retry: { maxAttempts: 1 },
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // --- Step 1: Determine the knowledge window ---
    logger.info('Step 1: Determining knowledge window');

    const { data: lastRun } = await supabase
      .from('cp_playbook_sync_runs')
      .select('run_at')
      .in('status', ['success', 'partial'])
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    const windowStart = lastRun?.run_at || '2020-01-01T00:00:00Z';

    // Create run record
    const { data: runRecord } = await supabase
      .from('cp_playbook_sync_runs')
      .insert({ status: 'running' })
      .select('id')
      .single();

    if (!runRecord) throw new Error('Failed to create sync run record');
    const runId = runRecord.id;

    // --- Step 2: Fetch new knowledge entries ---
    logger.info('Step 2: Fetching knowledge entries', { since: windowStart });

    const { data: entries, error: entriesError } = await supabase
      .from('cp_knowledge_entries')
      .select('id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, created_at, updated_at')
      .gt('created_at', windowStart)
      .order('created_at', { ascending: true });

    if (entriesError) {
      await supabase.from('cp_playbook_sync_runs').update({
        status: 'failed',
        error_log: `Failed to fetch entries: ${entriesError.message}`,
      }).eq('id', runId);
      throw new Error(`Failed to fetch knowledge entries: ${entriesError.message}`);
    }

    if (!entries?.length) {
      logger.info('No new knowledge entries since last run');
      await supabase.from('cp_playbook_sync_runs').update({
        status: 'success',
        entries_processed: 0,
        commit_message: 'No new entries to process',
      }).eq('id', runId);
      return { entriesProcessed: 0, message: 'No new entries' };
    }

    logger.info('Found entries to process', { count: entries.length });

    // Also fetch prior orphans (entries that weren't matched in previous runs)
    const { data: priorOrphans } = await supabase
      .from('cp_knowledge_sop_matches')
      .select('knowledge_entry_id')
      .eq('action', 'orphaned');

    const orphanIds = new Set((priorOrphans || []).map((o) => o.knowledge_entry_id));
    let priorOrphanEntries: KnowledgeEntry[] = [];
    if (orphanIds.size > 0) {
      const { data: orphanData } = await supabase
        .from('cp_knowledge_entries')
        .select('id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, created_at, updated_at')
        .in('id', Array.from(orphanIds));
      priorOrphanEntries = (orphanData || []) as KnowledgeEntry[];
    }

    // --- Step 3: Fetch and embed SOPs ---
    logger.info('Step 3: Fetching and embedding SOPs');

    const sopFiles = await fetchAllSopFiles();
    const cachedSops = await syncSopEmbeddings(sopFiles);

    logger.info('SOPs loaded', { count: cachedSops.length });

    // --- Step 4: Match and classify each entry ---
    logger.info('Step 4: Matching and classifying entries');

    const typedEntries = entries as KnowledgeEntry[];
    const enrichments: Map<string, { entries: KnowledgeEntry[]; targetSection: string }> = new Map();
    const orphans: KnowledgeEntry[] = [...priorOrphanEntries];
    let redundantCount = 0;

    for (const entry of typedEntries) {
      try {
        // Generate embedding for this entry
        const entryEmbedding = await generateEmbedding(
          `${entry.category}: ${entry.content}\nContext: ${entry.context || ''}`
        );

        // Find top matches
        const matches = cachedSops
          .map((sop) => ({
            sop,
            similarity: cosineSimilarity(entryEmbedding, sop.embedding),
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 3);

        const strongMatch = matches.find((m) => m.similarity >= 0.75);

        if (!strongMatch) {
          // No strong match — orphan
          orphans.push(entry);
          await supabase.from('cp_knowledge_sop_matches').insert({
            knowledge_entry_id: entry.id,
            sop_file_path: null,
            similarity_score: matches[0]?.similarity || 0,
            action: 'orphaned',
            sync_run_id: runId,
          });
          continue;
        }

        // Classify with Opus 4.6
        const classification = await classifyKnowledgeForSop(
          entry,
          strongMatch.sop.content,
          strongMatch.sop.title
        );

        // Log the match
        await supabase.from('cp_knowledge_sop_matches').insert({
          knowledge_entry_id: entry.id,
          sop_file_path: strongMatch.sop.filePath,
          similarity_score: strongMatch.similarity,
          action: classification.action,
          edit_summary: classification.reasoning,
          sync_run_id: runId,
        });

        if (classification.action === 'enrich') {
          const key = strongMatch.sop.filePath;
          const existing = enrichments.get(key);
          if (existing) {
            existing.entries.push(entry);
          } else {
            enrichments.set(key, {
              entries: [entry],
              targetSection: classification.target_section || 'Key Lessons',
            });
          }
        } else if (classification.action === 'redundant') {
          redundantCount++;
        } else {
          // tangential → orphan
          orphans.push(entry);
        }
      } catch (err) {
        logger.error('Failed to process entry', {
          entryId: entry.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('Classification complete', {
      enrichments: enrichments.size,
      orphans: orphans.length,
      redundant: redundantCount,
    });

    // --- Step 5: Generate edits ---
    logger.info('Step 5: Generating edits');

    const fileChanges: FileChange[] = [];
    const sopsEnriched: string[] = [];
    const editSummaries: string[] = [];

    for (const [filePath, { entries: matchedEntries, targetSection }] of enrichments) {
      try {
        const sop = cachedSops.find((s) => s.filePath === filePath);
        if (!sop) continue;

        const edit = await generateSopEdit(
          matchedEntries,
          sop.content,
          sop.title,
          targetSection
        );

        // Apply the edit to the SOP content
        const updatedContent = applyEdit(sop.content, edit);
        if (updatedContent !== sop.content) {
          fileChanges.push({ path: filePath, content: updatedContent });
          sopsEnriched.push(filePath);
          editSummaries.push(
            `  - ${filePath} (+${matchedEntries.length} entries: ${edit.summary})`
          );
        }
      } catch (err) {
        logger.error('Failed to generate edit', {
          filePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // --- Step 6: Cluster orphans and create new SOPs ---
    logger.info('Step 6: Processing orphans');

    const sopsCreated: string[] = [];
    // Only use current-run orphans (not prior) to avoid re-processing
    const newOrphans = orphans.filter((o) => !orphanIds.has(o.id));
    const allOrphansForClustering = orphans;

    if (allOrphansForClustering.length >= 3) {
      const existingModules = [
        'module-0-positioning',
        'module-1-lead-magnets',
        'module-2-tam-building',
        'module-3-linkedin-outreach',
        'module-4-cold-email',
        'module-5-linkedin-ads',
        'module-6-operating-system',
        'module-7-daily-content',
      ];

      const clusters = await clusterOrphans(allOrphansForClustering, existingModules);

      for (const cluster of clusters) {
        try {
          // Determine next SOP number in the module
          const moduleNum = cluster.suggestedModule.match(/module-(\d+)/)?.[1] || '7';
          const existingSopsInModule = cachedSops.filter(
            (s) => s.module === cluster.suggestedModule
          );
          const nextNumber = existingSopsInModule.length + 1;

          const newSop = await generateNewSop(
            cluster,
            cachedSops.map((s) => s.filePath),
            nextNumber
          );

          fileChanges.push({ path: newSop.filePath, content: newSop.content });
          sopsCreated.push(newSop.filePath);

          // Log entries as 'new_sop' action
          for (const entry of cluster.entries) {
            await supabase.from('cp_knowledge_sop_matches').upsert(
              {
                knowledge_entry_id: entry.id,
                sop_file_path: newSop.filePath,
                similarity_score: 1.0,
                action: 'new_sop',
                edit_summary: `Used to create new SOP: ${newSop.title}`,
                sync_run_id: runId,
              },
              { onConflict: 'knowledge_entry_id,sync_run_id', ignoreDuplicates: true }
            );
          }

          // Update sidebars.js to include the new SOP
          const sidebars = await fetchSidebars();
          const updatedSidebars = addToSidebars(
            sidebars.content,
            cluster.suggestedModule,
            newSop.sidebarEntry
          );
          if (updatedSidebars !== sidebars.content) {
            // Check if sidebars.js is already in fileChanges
            const existingSidebarChange = fileChanges.find(
              (f) => f.path === 'sidebars.js'
            );
            if (existingSidebarChange) {
              existingSidebarChange.content = addToSidebars(
                existingSidebarChange.content,
                cluster.suggestedModule,
                newSop.sidebarEntry
              );
            } else {
              fileChanges.push({ path: 'sidebars.js', content: updatedSidebars });
            }
          }

          editSummaries.push(
            `  - ${newSop.filePath} (NEW from ${cluster.entries.length} orphaned entries)`
          );
        } catch (err) {
          logger.error('Failed to create new SOP', {
            title: cluster.suggestedTitle,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // --- Step 7: Commit to GitHub ---
    if (fileChanges.length === 0) {
      logger.info('No changes to commit');
      await supabase.from('cp_playbook_sync_runs').update({
        status: 'success',
        entries_processed: typedEntries.length,
        entries_enriched: sopsEnriched.length,
        entries_redundant: redundantCount,
        entries_orphaned: newOrphans.length,
        commit_message: 'No actionable changes this run',
      }).eq('id', runId);
      return {
        entriesProcessed: typedEntries.length,
        enriched: 0,
        redundant: redundantCount,
        orphaned: newOrphans.length,
        committed: false,
      };
    }

    logger.info('Step 7: Committing to GitHub', { files: fileChanges.length });

    const commitLines = [
      `playbook-sync: ${new Date().toISOString().split('T')[0]} — ${sopsEnriched.length} SOPs enriched, ${sopsCreated.length} new SOPs created`,
      '',
      ...(sopsEnriched.length > 0 ? ['Enriched:', ...editSummaries.filter((s) => !s.includes('NEW')), ''] : []),
      ...(sopsCreated.length > 0 ? ['Created:', ...editSummaries.filter((s) => s.includes('NEW')), ''] : []),
      `Skipped: ${redundantCount} redundant, ${newOrphans.length} orphaned (queued)`,
      '',
      `Source: ${typedEntries.length} knowledge entries since ${windowStart}`,
    ];
    const commitMessage = commitLines.join('\n');

    let commitSha: string | null = null;
    try {
      commitSha = await commitChanges(fileChanges, commitMessage);
      logger.info('Committed to GitHub', { sha: commitSha });
    } catch (err) {
      // Retry once
      logger.warn('First commit attempt failed, retrying', {
        error: err instanceof Error ? err.message : String(err),
      });
      try {
        commitSha = await commitChanges(fileChanges, commitMessage);
      } catch (retryErr) {
        logger.error('Commit failed after retry', {
          error: retryErr instanceof Error ? retryErr.message : String(retryErr),
        });
        await supabase.from('cp_playbook_sync_runs').update({
          status: 'failed',
          entries_processed: typedEntries.length,
          error_log: `GitHub commit failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
        }).eq('id', runId);
        throw retryErr;
      }
    }

    // --- Step 8: Log the run ---
    const hasErrors = fileChanges.length < enrichments.size + sopsCreated.length;
    await supabase.from('cp_playbook_sync_runs').update({
      status: hasErrors ? 'partial' : 'success',
      entries_processed: typedEntries.length,
      entries_enriched: sopsEnriched.length,
      entries_redundant: redundantCount,
      entries_orphaned: newOrphans.length,
      sops_enriched: sopsEnriched,
      sops_created: sopsCreated,
      commit_sha: commitSha,
      commit_message: commitMessage,
    }).eq('id', runId);

    logger.info('Playbook sync complete', {
      entriesProcessed: typedEntries.length,
      enriched: sopsEnriched.length,
      created: sopsCreated.length,
      redundant: redundantCount,
      orphaned: newOrphans.length,
      commitSha,
    });

    return {
      entriesProcessed: typedEntries.length,
      enriched: sopsEnriched.length,
      created: sopsCreated.length,
      redundant: redundantCount,
      orphaned: newOrphans.length,
      commitSha,
    };
  },
});

// --- Helper functions ---

/**
 * Apply an additive edit to SOP content by finding the anchor text
 * and inserting the new content after it.
 */
function applyEdit(sopContent: string, edit: GeneratedEdit): string {
  const anchorIdx = sopContent.indexOf(edit.insert_after);
  if (anchorIdx === -1) {
    // Try a fuzzy match — find the line that best matches
    const lines = sopContent.split('\n');
    const targetLine = lines.find((line) =>
      line.trim().includes(edit.insert_after.trim().slice(0, 50))
    );
    if (!targetLine) return sopContent; // Can't find anchor, skip

    const lineIdx = sopContent.indexOf(targetLine);
    const insertPoint = lineIdx + targetLine.length;
    return (
      sopContent.slice(0, insertPoint) +
      '\n\n' +
      edit.new_content +
      '\n' +
      sopContent.slice(insertPoint)
    );
  }

  const insertPoint = anchorIdx + edit.insert_after.length;
  // Find end of the line
  const nextNewline = sopContent.indexOf('\n', insertPoint);
  const actualInsertPoint = nextNewline !== -1 ? nextNewline : insertPoint;

  return (
    sopContent.slice(0, actualInsertPoint) +
    '\n\n' +
    edit.new_content +
    '\n' +
    sopContent.slice(actualInsertPoint)
  );
}

/**
 * Add a new SOP entry to sidebars.js in the correct module category.
 */
function addToSidebars(
  sidebarsContent: string,
  moduleName: string,
  sopId: string
): string {
  // Find the module's items array and append the new SOP ID
  // The format in sidebars.js is: items: ['sops/module-X/sop-X-1', ...]
  const modulePattern = new RegExp(
    `(label:\\s*['"].*?${moduleName.replace('module-', 'Module ')}.*?['"][\\s\\S]*?items:\\s*\\[)([^\\]]*)(\\])`,
    'i'
  );

  // Try a simpler pattern matching the module directory
  const dirPattern = new RegExp(
    `(items:\\s*\\[[^\\]]*'sops/${moduleName}/[^']*')(\\s*\\])`,
  );

  const match = sidebarsContent.match(dirPattern);
  if (match) {
    return sidebarsContent.replace(
      dirPattern,
      `$1,\n            'sops/${moduleName}/${sopId}'$2`
    );
  }

  // Fallback: return unchanged if pattern not found
  return sidebarsContent;
}
```

**Step 2: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/trigger/playbook-sync.ts
git commit -m "feat: add playbook-sync scheduled task (weekly SOP enrichment)"
```

---

## Task 10: Set Environment Variables

**Step 1: Create a fine-grained GitHub PAT**

Go to https://github.com/settings/tokens?type=beta and create a token:
- Name: `playbook-sync-bot`
- Repository access: Only `modernagencysales/playbooks`
- Permissions: Contents → Read and write
- Expiration: 90 days (renew as needed)

**Step 2: Set the token in Trigger.dev env vars**

```bash
curl -s -X POST "https://api.trigger.dev/api/v1/projects/proj_jdjofdqazqwitpinxady/envvars/prod" \
  -H "Authorization: Bearer tr_prod_DB3vrdcduJYcXF19rrEB" \
  -H "Content-Type: application/json" \
  -d '{"name": "GITHUB_TOKEN", "value": "YOUR_GITHUB_PAT_HERE"}'
```

**Step 3: Verify existing env vars are set**

The task also needs `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` — both should already be set in Trigger.dev env vars from the content pipeline setup.

---

## Task 11: Deploy and Test

**Step 1: Deploy to Trigger.dev**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy
```

Expected: Build succeeds, `playbook-sync` task appears in the Trigger.dev dashboard.

**Step 2: Trigger a manual test run**

From the Trigger.dev dashboard, manually trigger the `playbook-sync` task to test the full flow. Verify:
- Knowledge entries are fetched correctly
- SOPs are fetched from GitHub
- Embeddings are generated/cached
- Classification produces sensible results
- Edits are additive-only
- Commit appears in the playbooks repo

**Step 3: Monitor the first automated run**

The cron fires Sunday midnight UTC. After the first automated run:
- Check `cp_playbook_sync_runs` for status
- Check the playbooks repo for the commit
- Review the diff to ensure quality

**Step 4: Commit any fixes**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add -A
git commit -m "fix: adjustments from first playbook-sync test run"
```

---

## Summary

| Task | What | Model | Files |
|------|------|-------|-------|
| 1 | Add Octokit | — | package.json |
| 2 | DB migration | — | supabase/migrations/ |
| 3 | Model config | — | model-config.ts |
| 4 | GitHub client | — | playbook-sync/github-client.ts |
| 5 | SOP embedding cache | OpenAI | playbook-sync/sop-embeddings.ts |
| 6 | Classifier | Opus 4.6 | playbook-sync/classifier.ts |
| 7 | Edit generator | Opus 4.6 | playbook-sync/edit-generator.ts |
| 8 | SOP creator | Opus 4.6 + Sonnet | playbook-sync/sop-creator.ts |
| 9 | Main task | All | trigger/playbook-sync.ts |
| 10 | Env vars | — | Trigger.dev dashboard |
| 11 | Deploy + test | — | CLI |
