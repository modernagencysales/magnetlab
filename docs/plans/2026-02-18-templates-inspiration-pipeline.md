# Templates & Inspiration Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-improving content intelligence engine that scrapes LinkedIn for winning posts, extracts templates, and uses RAG matching to guide all post generation.

**Architecture:** Separate Trigger.dev pipelines (scrape → extract) feeding a shared global template library. Bright Data for LinkedIn scraping, pgvector for semantic matching, Claude for template extraction and enrichment. All post-writing paths get automatic template guidance via RAG.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL + pgvector), Trigger.dev v4, Bright Data API, OpenAI embeddings (text-embedding-3-small), Claude Sonnet (template extraction/enrichment)

---

## Task 1: Database Migration — New Tables + Column Extensions

**Files:**
- Create: `supabase/migrations/20260218300000_templates_inspiration_pipeline.sql`

**Context:**
- Existing `cp_post_templates` table: `id, user_id, name, category, description, structure, example_posts, use_cases, tags, embedding vector(1536), usage_count, avg_engagement_score, is_active, created_at, updated_at`
- Existing `cp_viral_posts` table: `id, user_id, scrape_run_id, author_name, author_headline, author_url, content, likes, comments, shares, views, percentile_rank, extracted_template_id, created_at`
- FK convention: use `public.users(id)` (NextAuth), NOT `auth.users(id)`
- RLS pattern: 4 user CRUD policies + 1 service_role full access
- Index naming: `idx_tablename_column`

**Step 1: Write the migration SQL**

```sql
-- =============================================
-- Templates & Inspiration Pipeline
-- New tables: cp_tracked_creators, cp_scrape_searches, cp_scrape_runs (new version)
-- Extended: cp_post_templates (source, is_global, scraped_post_id)
-- Extended: cp_viral_posts (bright_data_id, engagement_score, creator_id, is_winner, template_extracted, source_search_id)
-- =============================================

-- 1. New table: cp_tracked_creators
CREATE TABLE cp_tracked_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_url TEXT UNIQUE NOT NULL,
  name TEXT,
  headline TEXT,
  avatar_url TEXT,
  avg_engagement FLOAT DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  added_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_tracked_creators_active ON cp_tracked_creators(is_active) WHERE is_active = true;
CREATE INDEX idx_cp_tracked_creators_user ON cp_tracked_creators(added_by_user_id);

ALTER TABLE cp_tracked_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tracked creators"
  ON cp_tracked_creators FOR SELECT
  USING (true);

CREATE POLICY "Users can insert tracked creators"
  ON cp_tracked_creators FOR INSERT
  WITH CHECK (added_by_user_id = auth.uid());

CREATE POLICY "Users can update their own tracked creators"
  ON cp_tracked_creators FOR UPDATE
  USING (added_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own tracked creators"
  ON cp_tracked_creators FOR DELETE
  USING (added_by_user_id = auth.uid());

CREATE POLICY "Service role full access on tracked creators"
  ON cp_tracked_creators FOR ALL
  USING (auth.role() = 'service_role');

-- 2. New table: cp_scrape_searches (admin-defined)
CREATE TABLE cp_scrape_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  description TEXT,
  post_format_filter TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_scrape_searches_active ON cp_scrape_searches(is_active) WHERE is_active = true;

ALTER TABLE cp_scrape_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scrape searches"
  ON cp_scrape_searches FOR SELECT
  USING (true);

CREATE POLICY "Service role full access on scrape searches"
  ON cp_scrape_searches FOR ALL
  USING (auth.role() = 'service_role');

-- 3. New table: cp_pipeline_scrape_runs (audit trail)
CREATE TABLE cp_pipeline_scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN ('creator', 'search', 'extraction')),
  source_id UUID,
  posts_found INTEGER DEFAULT 0,
  winners_found INTEGER DEFAULT 0,
  templates_extracted INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_log TEXT
);

CREATE INDEX idx_cp_pipeline_scrape_runs_type ON cp_pipeline_scrape_runs(run_type);

ALTER TABLE cp_pipeline_scrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pipeline scrape runs"
  ON cp_pipeline_scrape_runs FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Extend cp_post_templates
ALTER TABLE cp_post_templates
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user_created' CHECK (source IN ('user_created', 'scraped')),
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scraped_post_id UUID REFERENCES cp_viral_posts(id) ON DELETE SET NULL;

CREATE INDEX idx_cp_templates_global ON cp_post_templates(is_global) WHERE is_global = true;
CREATE INDEX idx_cp_templates_source ON cp_post_templates(source);

-- Update RLS: allow reading global templates
DROP POLICY IF EXISTS "Users can access own templates" ON cp_post_templates;

CREATE POLICY "Users can view own and global templates"
  ON cp_post_templates FOR SELECT
  USING (auth.uid() = user_id OR is_global = true);

CREATE POLICY "Users can insert own templates"
  ON cp_post_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON cp_post_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON cp_post_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on templates"
  ON cp_post_templates FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Extend cp_viral_posts
ALTER TABLE cp_viral_posts
  ADD COLUMN IF NOT EXISTS bright_data_id TEXT,
  ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES cp_tracked_creators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_winner BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_extracted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_search_id UUID REFERENCES cp_scrape_searches(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_cp_viral_posts_bright_data_id ON cp_viral_posts(bright_data_id) WHERE bright_data_id IS NOT NULL;
CREATE INDEX idx_cp_viral_posts_winner ON cp_viral_posts(is_winner) WHERE is_winner = true;
CREATE INDEX idx_cp_viral_posts_creator ON cp_viral_posts(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX idx_cp_viral_posts_needs_extraction ON cp_viral_posts(is_winner, template_extracted) WHERE is_winner = true AND template_extracted = false;

-- Make user_id nullable on cp_viral_posts (scraped posts don't belong to a user)
ALTER TABLE cp_viral_posts ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS on viral_posts: allow viewing all posts (scraped are shared)
DROP POLICY IF EXISTS "Users can manage their own viral posts" ON cp_viral_posts;

CREATE POLICY "Users can view own and scraped viral posts"
  ON cp_viral_posts FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own viral posts"
  ON cp_viral_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own viral posts"
  ON cp_viral_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own viral posts"
  ON cp_viral_posts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on viral posts"
  ON cp_viral_posts FOR ALL
  USING (auth.role() = 'service_role');

-- 6. RPC: cp_match_templates (semantic template matching)
CREATE OR REPLACE FUNCTION cp_match_templates(
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 3,
  min_similarity FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  description TEXT,
  structure TEXT,
  example_posts TEXT[],
  use_cases TEXT[],
  tags TEXT[],
  usage_count INTEGER,
  avg_engagement_score DECIMAL,
  source TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.category,
    t.description,
    t.structure,
    t.example_posts,
    t.use_cases,
    t.tags,
    t.usage_count,
    t.avg_engagement_score,
    t.source,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM cp_post_templates t
  WHERE t.is_active = true
    AND (t.is_global = true OR t.user_id = match_user_id)
    AND t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) >= min_similarity
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Step 2: Push the migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run db:push`
Expected: Migration applied successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/20260218300000_templates_inspiration_pipeline.sql
git commit -m "feat: add templates & inspiration pipeline schema

New tables: cp_tracked_creators, cp_scrape_searches, cp_pipeline_scrape_runs
Extended: cp_post_templates (source, is_global, scraped_post_id)
Extended: cp_viral_posts (bright_data_id, engagement_score, creator_id, is_winner, template_extracted)
New RPC: cp_match_templates for pgvector semantic template matching
Updated RLS: global templates readable by all users"
```

---

## Task 2: Bright Data LinkedIn Client

**Files:**
- Create: `src/lib/integrations/bright-data-linkedin.ts`
- Reference: gtm-system's `/Users/timlife/Documents/claude code/gtm-system/src/lib/integrations/brightdata.ts`

**Context:**
- gtm-system already has a Bright Data client with LinkedIn scraping
- Dataset IDs: `gd_lyy3tktm25m4avu764` (profile posts), `gd_l7q7dkf244hwjntr0` (search posts)
- Base URL: `https://api.brightdata.com/datasets/v3`
- Auth: `Authorization: Bearer ${BRIGHT_DATA_API_KEY}`
- Pattern: trigger async job → poll status → fetch results
- Env var in magnetlab: `BRIGHT_DATA_API_KEY`

**Step 1: Write the Bright Data client**

```typescript
// src/lib/integrations/bright-data-linkedin.ts

import { logError } from '@/lib/utils/logger';

const BRIGHT_DATA_BASE_URL = 'https://api.brightdata.com/datasets/v3';

const DATASET_IDS = {
  PROFILE_POSTS: 'gd_lyy3tktm25m4avu764',
  SEARCH_POSTS: 'gd_l7q7dkf244hwjntr0',
};

export interface LinkedInPost {
  url: string;
  author: {
    name: string;
    headline: string;
    profile_url: string;
    followers?: number;
  };
  content: string;
  posted_date: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
}

interface TriggerResponse {
  snapshot_id: string;
}

interface ProgressResponse {
  status: string;
  progress?: number;
}

function getApiKey(): string {
  const key = process.env.BRIGHT_DATA_API_KEY;
  if (!key) throw new Error('BRIGHT_DATA_API_KEY is not configured');
  return key;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  };
}

async function triggerScrape(
  datasetId: string,
  params: Record<string, unknown>[]
): Promise<string> {
  const res = await fetch(
    `${BRIGHT_DATA_BASE_URL}/trigger?dataset_id=${datasetId}&include_errors=true`,
    { method: 'POST', headers: headers(), body: JSON.stringify(params) }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bright Data trigger failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as TriggerResponse;
  return data.snapshot_id;
}

async function getProgress(snapshotId: string): Promise<ProgressResponse> {
  const res = await fetch(
    `${BRIGHT_DATA_BASE_URL}/progress/${snapshotId}`,
    { headers: headers() }
  );
  if (!res.ok) {
    throw new Error(`Bright Data progress check failed (${res.status})`);
  }
  return res.json() as Promise<ProgressResponse>;
}

async function getResults(snapshotId: string): Promise<LinkedInPost[]> {
  const res = await fetch(
    `${BRIGHT_DATA_BASE_URL}/snapshot/${snapshotId}?format=json`,
    { headers: headers() }
  );
  if (!res.ok) {
    throw new Error(`Bright Data results fetch failed (${res.status})`);
  }
  return res.json() as Promise<LinkedInPost[]>;
}

async function pollUntilReady(
  snapshotId: string,
  maxWaitMs: number = 180_000
): Promise<LinkedInPost[]> {
  const start = Date.now();
  const pollInterval = 5_000;

  while (Date.now() - start < maxWaitMs) {
    const progress = await getProgress(snapshotId);
    if (progress.status === 'ready') {
      return getResults(snapshotId);
    }
    if (progress.status === 'failed') {
      throw new Error(`Bright Data job ${snapshotId} failed`);
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }
  throw new Error(`Bright Data job ${snapshotId} timed out after ${maxWaitMs}ms`);
}

export async function scrapeCreatorPosts(
  profileUrl: string,
  daysBack: number = 7
): Promise<LinkedInPost[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const snapshotId = await triggerScrape(DATASET_IDS.PROFILE_POSTS, [
    {
      url: profileUrl,
      start_date: startDate.toISOString().split('T')[0],
    },
  ]);

  return pollUntilReady(snapshotId);
}

export async function scrapeCreatorPostsBatch(
  profileUrls: string[],
  daysBack: number = 7
): Promise<LinkedInPost[]> {
  if (profileUrls.length === 0) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString().split('T')[0];

  const snapshotId = await triggerScrape(
    DATASET_IDS.PROFILE_POSTS,
    profileUrls.map((url) => ({ url, start_date: startDateStr }))
  );

  return pollUntilReady(snapshotId, 300_000); // 5 min for batch
}

export async function scrapeSearchPosts(
  searchUrl: string
): Promise<LinkedInPost[]> {
  const snapshotId = await triggerScrape(DATASET_IDS.SEARCH_POSTS, [
    { url: searchUrl },
  ]);

  return pollUntilReady(snapshotId);
}

export function computeEngagementScore(post: LinkedInPost): number {
  return post.engagement.likes + post.engagement.comments * 3 + post.engagement.shares * 2;
}

export function filterWinners(
  posts: LinkedInPost[],
  opts: { absoluteFloor?: number; topPercentile?: number } = {}
): LinkedInPost[] {
  const { absoluteFloor = 100, topPercentile = 0.3 } = opts;

  // Filter by absolute floor
  const aboveFloor = posts.filter((p) => p.engagement.likes >= absoluteFloor);
  if (aboveFloor.length === 0) return [];

  // Sort by engagement score descending
  const scored = aboveFloor
    .map((p) => ({ post: p, score: computeEngagementScore(p) }))
    .sort((a, b) => b.score - a.score);

  // Take top percentile
  const cutoff = Math.max(1, Math.ceil(scored.length * topPercentile));
  return scored.slice(0, cutoff).map((s) => s.post);
}

export function isBrightDataConfigured(): boolean {
  return !!process.env.BRIGHT_DATA_API_KEY;
}
```

**Step 2: Commit**

```bash
git add src/lib/integrations/bright-data-linkedin.ts
git commit -m "feat: add Bright Data LinkedIn scraping client

Supports creator profile scraping, batch scraping, and search-based
discovery. Includes engagement scoring and winner filtering logic."
```

---

## Task 3: Template Matcher Module

**Files:**
- Create: `src/lib/ai/content-pipeline/template-matcher.ts`
- Modify: `src/lib/ai/embeddings.ts` (add idea-to-query text helper)

**Context:**
- Supabase RPC `cp_match_templates` created in Task 1
- `generateEmbedding()` in `src/lib/ai/embeddings.ts` already works
- `createIdeaEmbeddingText()` already exists — good for idea→embedding
- Need a function that takes an idea/topic and returns the best matching template
- Used by post-writer, quick-writer, autopilot, write-post-from-idea

**Step 1: Write the template matcher**

```typescript
// src/lib/ai/content-pipeline/template-matcher.ts

import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { generateEmbedding, isEmbeddingsConfigured } from '@/lib/ai/embeddings';
import { logError } from '@/lib/utils/logger';

export interface MatchedTemplate {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  structure: string;
  example_posts: string[] | null;
  use_cases: string[] | null;
  tags: string[] | null;
  usage_count: number;
  avg_engagement_score: number | null;
  source: string;
  similarity: number;
}

export async function matchTemplates(
  topicText: string,
  userId: string,
  opts: { count?: number; minSimilarity?: number } = {}
): Promise<MatchedTemplate[]> {
  const { count = 3, minSimilarity = 0.3 } = opts;

  if (!isEmbeddingsConfigured()) return [];

  try {
    const embedding = await generateEmbedding(topicText);
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase.rpc('cp_match_templates', {
      query_embedding: JSON.stringify(embedding),
      match_user_id: userId,
      match_count: count,
      min_similarity: minSimilarity,
    });

    if (error) {
      logError('template-matcher', error, { userId });
      return [];
    }

    return (data || []) as MatchedTemplate[];
  } catch (err) {
    logError('template-matcher', err, { userId });
    return [];
  }
}

export async function findBestTemplate(
  topicText: string,
  userId: string
): Promise<MatchedTemplate | null> {
  const matches = await matchTemplates(topicText, userId, { count: 3 });
  if (matches.length === 0) return null;

  // Return highest similarity match
  return matches[0];
}

export function buildTemplateGuidance(template: MatchedTemplate): string {
  const parts = [
    `TEMPLATE GUIDANCE (proven structure, adapt freely):`,
    `Template: ${template.name}`,
    template.category ? `Category: ${template.category}` : null,
    template.description ? `Purpose: ${template.description}` : null,
    `\nStructure:\n${template.structure}`,
    template.use_cases?.length
      ? `\nBest used for: ${template.use_cases.join('; ')}`
      : null,
    template.example_posts?.length
      ? `\nExample post using this template:\n${template.example_posts[0]}`
      : null,
    `\nIMPORTANT: Use this template as structural inspiration. Adapt the format to fit the specific topic and voice. Do not force content into placeholders that don't apply.`,
  ].filter(Boolean);

  return parts.join('\n');
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/content-pipeline/template-matcher.ts
git commit -m "feat: add template matcher module for RAG-based template selection

Semantic matching via pgvector cp_match_templates RPC. Returns top
matching templates for any topic text. Includes guidance builder
for injecting template context into post-writer prompts."
```

---

## Task 4: Integrate Template RAG into Post Writing

**Files:**
- Modify: `src/lib/ai/content-pipeline/post-writer.ts` — inject template matching into `writePostFreeform()`
- Modify: `src/lib/ai/content-pipeline/quick-writer.ts` — add template matching to `quickWrite()`
- Modify: `src/lib/services/autopilot.ts` — add template matching before post writing
- Modify: `src/trigger/write-post-from-idea.ts` — add template matching

**Context:**
- `writePostFreeform()` is the main writing path — all other paths call it or `writePostWithTemplate()`
- `writePost()` dispatches to either based on whether `input.template` is set
- Goal: before calling `writePostFreeform()`, do a RAG lookup and convert to `writePostWithTemplate()` if a good match is found
- Fallback: if no match above threshold, proceed freeform (existing behavior)
- The `writePostWithTemplate()` prompt already includes template structure + example posts
- Key change: merge template guidance into the freeform prompt rather than using the rigid template path

**Step 1: Add template-aware writing to post-writer.ts**

Add a new function `writePostWithAutoTemplate()` that wraps the RAG lookup + write flow. Modify `writePostFreeform()` to accept optional template guidance text.

In `src/lib/ai/content-pipeline/post-writer.ts`, add import at top:
```typescript
import { findBestTemplate, buildTemplateGuidance } from './template-matcher';
```

Add new function after `writePost()`:
```typescript
export async function writePostWithAutoTemplate(
  input: WritePostInput,
  userId: string
): Promise<WrittenPost & { matchedTemplateId?: string }> {
  // If template already provided, use it directly
  if (input.template) {
    const result = await writePostWithTemplate(input);
    return { ...result, matchedTemplateId: input.template.id };
  }

  // Build topic text for RAG matching
  const topicText = [
    input.idea.title,
    input.idea.core_insight,
    input.idea.full_context,
    input.idea.content_type,
  ]
    .filter(Boolean)
    .join('\n');

  const match = await findBestTemplate(topicText, userId);

  if (match) {
    // Inject template guidance into the freeform prompt via knowledgeContext
    const templateGuidance = buildTemplateGuidance(match);
    const enhancedInput: WritePostInput = {
      ...input,
      knowledgeContext: input.knowledgeContext
        ? `${input.knowledgeContext}\n\n${templateGuidance}`
        : templateGuidance,
    };
    const result = await writePostFreeform(enhancedInput);

    // Increment usage count (fire-and-forget)
    incrementTemplateUsage(match.id).catch(() => {});

    return { ...result, matchedTemplateId: match.id };
  }

  // No match — proceed freeform
  return writePostFreeform(input);
}

async function incrementTemplateUsage(templateId: string): Promise<void> {
  const { createSupabaseServiceClient } = await import('@/lib/supabase/service');
  const supabase = createSupabaseServiceClient();
  await supabase.rpc('cp_increment_template_usage', { template_id: templateId });
}
```

Note: We also need a small SQL function for incrementing usage. Add to the migration in Task 1 (or as a follow-up migration):
```sql
CREATE OR REPLACE FUNCTION cp_increment_template_usage(template_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE cp_post_templates
  SET usage_count = usage_count + 1
  WHERE id = template_id;
END;
$$;
```

**Step 2: Update autopilot.ts**

In `src/lib/services/autopilot.ts`, find the section where `writePostFreeform()` is called (around line 310-323). Replace with `writePostWithAutoTemplate()`:

Replace the import:
```typescript
import { writePostFreeform } from '@/lib/ai/content-pipeline/post-writer';
```
With:
```typescript
import { writePostWithAutoTemplate } from '@/lib/ai/content-pipeline/post-writer';
```

Replace the call (around line 310):
```typescript
// OLD: const written = await writePostFreeform({ ... });
const written = await writePostWithAutoTemplate({
  idea: ideaContext,
  targetAudience: config.targetAudience,
  knowledgeContext,
  voiceProfile: resolvedVoice,
  authorName: resolvedVoice?.display_name,
  authorTitle: resolvedVoice?.title,
}, config.userId);
```

Save `written.matchedTemplateId` to the pipeline post record if present (add `template_id` to the insert).

**Step 3: Update write-post-from-idea.ts**

In `src/trigger/write-post-from-idea.ts`, replace the `writePostFreeform()` call with `writePostWithAutoTemplate()`:

Replace import:
```typescript
import { writePostFreeform } from '@/lib/ai/content-pipeline/post-writer';
```
With:
```typescript
import { writePostWithAutoTemplate } from '@/lib/ai/content-pipeline/post-writer';
```

Replace the call (around line 73):
```typescript
const written = await writePostWithAutoTemplate({
  idea: ideaContext,
  knowledgeContext,
  voiceProfile: resolvedVoice,
  authorName: resolvedVoice?.display_name,
  authorTitle: resolvedVoice?.title,
}, payload.userId);
```

Set `template_id: written.matchedTemplateId` in the `cp_pipeline_posts` insert.

**Step 4: Update quick-writer.ts**

In `src/lib/ai/content-pipeline/quick-writer.ts`, after `expandToIdea()` returns the synthetic idea, do a template RAG lookup before writing:

Add import:
```typescript
import { findBestTemplate, buildTemplateGuidance } from './template-matcher';
```

In `quickWrite()`, after `expandToIdea()` (around line 62), before `writePostFreeform()`:
```typescript
// RAG template matching
let templateGuidance = '';
if (options.userId) {
  const topicText = [idea.title, idea.core_insight, idea.content_type].filter(Boolean).join('\n');
  const match = await findBestTemplate(topicText, options.userId);
  if (match) {
    templateGuidance = buildTemplateGuidance(match);
  }
}

const mergedKnowledge = [options.knowledgeContext, templateGuidance].filter(Boolean).join('\n\n');
```

Then pass `knowledgeContext: mergedKnowledge || undefined` to `writePostFreeform()`.

Note: `QuickWriteOptions` needs a `userId` field added:
```typescript
interface QuickWriteOptions {
  userId?: string; // For template RAG matching
  // ... existing fields
}
```

**Step 5: Commit**

```bash
git add src/lib/ai/content-pipeline/post-writer.ts src/lib/ai/content-pipeline/quick-writer.ts src/lib/services/autopilot.ts src/trigger/write-post-from-idea.ts
git commit -m "feat: integrate template RAG matching into all post-writing paths

writePostWithAutoTemplate() does semantic lookup before writing.
Autopilot, write-post-from-idea, and quick-write all now get
automatic template guidance. Falls back to freeform if no match."
```

---

## Task 5: CSV Seed Import Script

**Files:**
- Create: `src/lib/services/seed-templates.ts` — import + AI enrichment logic
- Create: `src/app/api/content-pipeline/templates/seed-csv/route.ts` — API endpoint to trigger import

**Context:**
- CSV at `/Users/timlife/Downloads/✅ LI Templates-Grid view (1).csv`
- 110 templates with columns: `Template ID & Name`, `TItle`, `Template`, `Funnel Stage`, `Rating`, `Post URL`, `Original Post`, `AI Template Generator`, `AI Template Title`, `Funnel Stage Generator`
- Map: `TItle` → name, `Template` → structure, `Funnel Stage` → tags, `Original Post` → example_posts
- AI enrichment: Claude generates description, tags, use_cases, category per template
- Embeddings: generate for each template via OpenAI
- Insert with `source = 'scraped'`, `is_global = true`, `user_id` = the calling user's ID (needed for FK)

**Step 1: Write the seed service**

```typescript
// src/lib/services/seed-templates.ts

import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';
import { CLAUDE_SONNET_MODEL } from '@/lib/ai/content-pipeline/model-config';
import { generateEmbedding, createTemplateEmbeddingText } from '@/lib/ai/embeddings';
import { logError } from '@/lib/utils/logger';

interface CSVTemplate {
  name: string;
  structure: string;
  funnelStage: string;
  originalPost?: string;
}

interface EnrichedTemplate {
  name: string;
  category: string;
  description: string;
  structure: string;
  use_cases: string[];
  tags: string[];
  example_posts: string[];
}

async function enrichTemplate(template: CSVTemplate): Promise<EnrichedTemplate> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `Analyze this LinkedIn post template and generate metadata for it.

TEMPLATE NAME: ${template.name}
TEMPLATE STRUCTURE:
${template.structure}

FUNNEL STAGE: ${template.funnelStage}

Return ONLY valid JSON:
{
  "category": "One of: story, framework, listicle, contrarian, case_study, question, educational, motivational",
  "description": "1-2 sentence description of what this template is for and when to use it",
  "use_cases": ["3-5 specific scenarios where this template works well"],
  "tags": ["5-8 tags covering topic, format, tone, audience, funnel stage. Include '${template.funnelStage.toLowerCase().replace(/ /g, '_')}' as a tag."]
}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const enriched = parseJsonResponse<{
    category: string;
    description: string;
    use_cases: string[];
    tags: string[];
  }>(textContent.text);

  return {
    name: template.name,
    category: enriched.category,
    description: enriched.description,
    structure: template.structure,
    use_cases: enriched.use_cases,
    tags: enriched.tags,
    example_posts: template.originalPost ? [template.originalPost] : [],
  };
}

export async function seedTemplatesFromCSV(
  templates: CSVTemplate[],
  userId: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const supabase = createSupabaseServiceClient();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  // Check for existing templates to avoid duplicates
  const { data: existing } = await supabase
    .from('cp_post_templates')
    .select('name')
    .eq('is_global', true);

  const existingNames = new Set((existing || []).map((t) => t.name.toLowerCase()));

  const BATCH_SIZE = 5;
  for (let i = 0; i < templates.length; i += BATCH_SIZE) {
    const batch = templates.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (template) => {
        if (existingNames.has(template.name.toLowerCase())) {
          skipped++;
          return null;
        }

        try {
          // AI enrichment
          const enriched = await enrichTemplate(template);

          // Generate embedding
          const embeddingText = createTemplateEmbeddingText(enriched);
          const embedding = await generateEmbedding(embeddingText);

          return { enriched, embedding };
        } catch (err) {
          const msg = `Failed to enrich "${template.name}": ${err instanceof Error ? err.message : String(err)}`;
          logError('seed-templates', err, { templateName: template.name });
          errors.push(msg);
          return null;
        }
      })
    );

    // Insert successful enrichments
    for (const result of results) {
      if (!result) continue;

      const { enriched, embedding } = result;
      const { error: insertError } = await supabase
        .from('cp_post_templates')
        .insert({
          user_id: userId,
          name: enriched.name,
          category: enriched.category,
          description: enriched.description,
          structure: enriched.structure,
          example_posts: enriched.example_posts,
          use_cases: enriched.use_cases,
          tags: enriched.tags,
          embedding: JSON.stringify(embedding),
          source: 'scraped',
          is_global: true,
        });

      if (insertError) {
        errors.push(`Failed to insert "${enriched.name}": ${insertError.message}`);
      } else {
        imported++;
        existingNames.add(enriched.name.toLowerCase());
      }
    }
  }

  return { imported, skipped, errors };
}

export function parseCSVTemplates(csvContent: string): CSVTemplate[] {
  const lines = csvContent.split('\n');
  const templates: CSVTemplate[] = [];
  let currentTemplate: Partial<CSVTemplate> | null = null;
  let currentField = '';
  let inQuotedField = false;
  let fieldBuffer = '';

  // Simple CSV parser that handles multiline quoted fields
  // The CSV has: Template ID & Name, TItle, Template, Funnel Stage, Rating, Post URL, Original Post, ...
  // We need columns 1 (TItle), 2 (Template), 3 (Funnel Stage), 6 (Original Post)

  // Use a proper row-by-row CSV parser
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (const line of lines) {
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (insideQuotes && j + 1 < line.length && line[j + 1] === '"') {
          currentCell += '"';
          j++; // skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (insideQuotes) {
      currentCell += '\n'; // multiline field
    } else {
      currentRow.push(currentCell);
      currentCell = '';
      rows.push(currentRow);
      currentRow = [];
    }
  }

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;

    const title = (row[1] || '').trim();
    const structure = (row[2] || '').trim();
    const funnelStage = (row[3] || '').trim();
    const originalPost = (row[6] || '').trim();

    if (!title || !structure) continue;

    templates.push({
      name: title,
      structure,
      funnelStage: funnelStage || 'Middle Of Funnel',
      originalPost: originalPost || undefined,
    });
  }

  return templates;
}
```

**Step 2: Write the API route**

```typescript
// src/app/api/content-pipeline/templates/seed-csv/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { seedTemplatesFromCSV, parseCSVTemplates } from '@/lib/services/seed-templates';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const csvContent = await file.text();
    const templates = parseCSVTemplates(csvContent);

    if (templates.length === 0) {
      return NextResponse.json({ error: 'No valid templates found in CSV' }, { status: 400 });
    }

    const result = await seedTemplatesFromCSV(templates, session.user.id);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import templates' },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/services/seed-templates.ts src/app/api/content-pipeline/templates/seed-csv/route.ts
git commit -m "feat: add CSV seed import with AI enrichment for global templates

Parses CSV, enriches each template with Claude (description, tags,
use_cases, category), generates embeddings, and inserts as global
templates. Deduplicates by name. Batched 5 at a time."
```

---

## Task 6: Scrape LinkedIn Content — Trigger.dev Task

**Files:**
- Create: `src/trigger/scrape-linkedin-content.ts`

**Context:**
- Cron: 4 AM UTC daily
- Scrapes all active tracked creators via Bright Data batch
- Runs all active scrape searches
- Deduplicates against existing cp_viral_posts by bright_data_id
- Computes engagement_score, applies winner filter
- Saves to cp_viral_posts (winners + non-winners for baseline)
- Updates cp_tracked_creators stats
- Logs to cp_pipeline_scrape_runs
- Triggers extract-winning-templates task on completion

**Step 1: Write the scraping task**

```typescript
// src/trigger/scrape-linkedin-content.ts

import { schedules, task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import {
  scrapeCreatorPostsBatch,
  scrapeSearchPosts,
  computeEngagementScore,
  filterWinners,
  isBrightDataConfigured,
  type LinkedInPost,
} from '@/lib/integrations/bright-data-linkedin';
import { extractWinningTemplates } from './extract-winning-templates';

interface CreatorRow {
  id: string;
  linkedin_url: string;
  name: string | null;
  avg_engagement: number;
}

interface SearchRow {
  id: string;
  query: string;
  post_format_filter: string | null;
}

export const scrapeLinkedInContent = schedules.task({
  id: 'scrape-linkedin-content',
  cron: '0 4 * * *', // 4 AM UTC daily
  maxDuration: 600, // 10 minutes
  retry: { maxAttempts: 1 },
  run: async () => {
    if (!isBrightDataConfigured()) {
      logger.warn('BRIGHT_DATA_API_KEY not configured, skipping scrape');
      return { skipped: true };
    }

    const supabase = createSupabaseServiceClient();
    const errors: string[] = [];
    let totalPostsFound = 0;
    let totalWinners = 0;

    // 1. Fetch active creators
    const { data: creators } = await supabase
      .from('cp_tracked_creators')
      .select('id, linkedin_url, name, avg_engagement')
      .eq('is_active', true);

    // 2. Fetch active searches
    const { data: searches } = await supabase
      .from('cp_scrape_searches')
      .select('id, query, post_format_filter')
      .eq('is_active', true);

    // 3. Scrape creator posts (batch)
    if (creators && creators.length > 0) {
      const runId = await logRunStart(supabase, 'creator');

      try {
        const profileUrls = creators.map((c: CreatorRow) => c.linkedin_url);
        const posts = await scrapeCreatorPostsBatch(profileUrls, 7);

        logger.info(`Scraped ${posts.length} posts from ${creators.length} creators`);
        totalPostsFound += posts.length;

        // Group posts by creator
        const creatorMap = new Map<string, CreatorRow>();
        for (const c of creators as CreatorRow[]) {
          creatorMap.set(c.linkedin_url, c);
        }

        // Process and save posts per creator
        for (const creator of creators as CreatorRow[]) {
          const creatorPosts = posts.filter(
            (p) => p.author.profile_url === creator.linkedin_url
          );

          if (creatorPosts.length === 0) continue;

          // Filter winners (relative to creator + absolute floor)
          const winners = filterWinners(creatorPosts, {
            absoluteFloor: 100,
            topPercentile: 0.3,
          });

          // Save all posts
          const { saved, winnersCount } = await savePosts(
            supabase,
            creatorPosts,
            winners,
            creator.id,
            null
          );
          totalWinners += winnersCount;

          // Update creator stats
          const avgEng =
            creatorPosts.reduce((sum, p) => sum + computeEngagementScore(p), 0) /
            creatorPosts.length;

          await supabase
            .from('cp_tracked_creators')
            .update({
              avg_engagement: avgEng,
              post_count: creator.linkedin_url ? creatorPosts.length : 0,
              last_scraped_at: new Date().toISOString(),
            })
            .eq('id', creator.id);
        }

        await logRunEnd(supabase, runId, totalPostsFound, totalWinners);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Creator scrape failed: ${msg}`);
        logger.error('Creator scrape failed', { error: msg });
        await logRunEnd(supabase, runId, 0, 0, msg);
      }
    }

    // 4. Scrape search results
    if (searches && searches.length > 0) {
      for (const search of searches as SearchRow[]) {
        const runId = await logRunStart(supabase, 'search', search.id);

        try {
          const posts = await scrapeSearchPosts(search.query);
          logger.info(`Search "${search.query}" returned ${posts.length} posts`);
          totalPostsFound += posts.length;

          // Search results use higher absolute floor (no creator baseline)
          const winners = filterWinners(posts, {
            absoluteFloor: 200,
            topPercentile: 0.3,
          });

          const { winnersCount } = await savePosts(
            supabase,
            posts,
            winners,
            null,
            search.id
          );
          totalWinners += winnersCount;

          await logRunEnd(supabase, runId, posts.length, winnersCount);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Search "${search.query}" failed: ${msg}`);
          logger.error('Search scrape failed', { error: msg, query: search.query });
          await logRunEnd(supabase, runId, 0, 0, msg);
        }
      }
    }

    // 5. Trigger template extraction for new winners
    if (totalWinners > 0) {
      await extractWinningTemplates.trigger({});
      logger.info('Triggered template extraction for new winners');
    }

    return {
      creatorsScraped: creators?.length || 0,
      searchesRun: searches?.length || 0,
      totalPostsFound,
      totalWinners,
      errors,
    };
  },
});

async function savePosts(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  allPosts: LinkedInPost[],
  winners: LinkedInPost[],
  creatorId: string | null,
  searchId: string | null
): Promise<{ saved: number; winnersCount: number }> {
  const winnerUrls = new Set(winners.map((w) => w.url));
  let saved = 0;
  let winnersCount = 0;

  for (const post of allPosts) {
    const isWinner = winnerUrls.has(post.url);
    const engagementScore = computeEngagementScore(post);

    const { error } = await supabase.from('cp_viral_posts').upsert(
      {
        bright_data_id: post.url, // Use post URL as dedup key
        user_id: null,
        author_name: post.author.name,
        author_headline: post.author.headline,
        author_url: post.author.profile_url,
        content: post.content,
        likes: post.engagement.likes,
        comments: post.engagement.comments,
        shares: post.engagement.shares,
        engagement_score: engagementScore,
        creator_id: creatorId,
        source_search_id: searchId,
        is_winner: isWinner,
      },
      { onConflict: 'bright_data_id' }
    );

    if (!error) {
      saved++;
      if (isWinner) winnersCount++;
    }
  }

  return { saved, winnersCount };
}

async function logRunStart(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  runType: string,
  sourceId?: string
): Promise<string> {
  const { data } = await supabase
    .from('cp_pipeline_scrape_runs')
    .insert({
      run_type: runType,
      source_id: sourceId || null,
    })
    .select('id')
    .single();

  return data?.id || '';
}

async function logRunEnd(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  runId: string,
  postsFound: number,
  winnersFound: number,
  errorLog?: string
): Promise<void> {
  if (!runId) return;
  await supabase
    .from('cp_pipeline_scrape_runs')
    .update({
      posts_found: postsFound,
      winners_found: winnersFound,
      completed_at: new Date().toISOString(),
      error_log: errorLog || null,
    })
    .eq('id', runId);
}
```

**Step 2: Commit**

```bash
git add src/trigger/scrape-linkedin-content.ts
git commit -m "feat: add daily LinkedIn content scraping task

Bright Data scrapes tracked creators (batch) and admin searches daily
at 4 AM UTC. Filters winners by engagement (100+ likes floor, top 30%).
Saves all posts for baseline, triggers template extraction for winners."
```

---

## Task 7: Extract Winning Templates — Trigger.dev Task

**Files:**
- Create: `src/trigger/extract-winning-templates.ts`

**Context:**
- Triggered by scrape task or on-demand
- Processes cp_viral_posts where is_winner=true AND template_extracted=false
- For each: extract template (Claude), generate embedding (OpenAI), save to cp_post_templates + swipe_file_posts
- Batch 3 at a time (rate limiting pattern from existing tasks)

**Step 1: Write the extraction task**

```typescript
// src/trigger/extract-winning-templates.ts

import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { extractTemplateFromPost } from '@/lib/ai/content-pipeline/template-extractor';
import { generateEmbedding, createTemplateEmbeddingText } from '@/lib/ai/embeddings';

export const extractWinningTemplates = task({
  id: 'extract-winning-templates',
  maxDuration: 300, // 5 minutes
  retry: { maxAttempts: 2 },
  run: async () => {
    const supabase = createSupabaseServiceClient();

    // Fetch unprocessed winners
    const { data: posts, error: fetchError } = await supabase
      .from('cp_viral_posts')
      .select('id, content, author_name, author_headline, author_url, likes, comments, shares, engagement_score')
      .eq('is_winner', true)
      .eq('template_extracted', false)
      .order('engagement_score', { ascending: false })
      .limit(30); // Process max 30 per run

    if (fetchError || !posts || posts.length === 0) {
      logger.info('No unprocessed winners found');
      return { processed: 0, templates: 0, swipeFiles: 0, errors: [] };
    }

    logger.info(`Processing ${posts.length} winning posts`);

    let templatesCreated = 0;
    let swipeFilesCreated = 0;
    const errors: string[] = [];

    // Process in batches of 3
    const BATCH_SIZE = 3;
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (post) => {
          try {
            // 1. Extract template via Claude
            const extracted = await extractTemplateFromPost(post.content);

            // 2. Generate embedding
            const embeddingText = createTemplateEmbeddingText({
              name: extracted.name,
              category: extracted.category,
              structure: extracted.structure,
              use_cases: extracted.use_cases,
              tags: extracted.tags,
            });
            const embedding = await generateEmbedding(embeddingText);

            // 3. Save template (global, no user owner needed — use a system approach)
            // We need a user_id for FK. Use the first admin/system user or the creator's added_by_user_id.
            // For now, find any user to own global templates (the FK is required).
            const { data: anyUser } = await supabase
              .from('users')
              .select('id')
              .limit(1)
              .single();

            if (!anyUser) {
              throw new Error('No users found for template ownership');
            }

            const { data: template, error: templateError } = await supabase
              .from('cp_post_templates')
              .insert({
                user_id: anyUser.id,
                name: extracted.name,
                category: extracted.category,
                description: `Extracted from ${post.author_name || 'unknown'}'s post (${post.likes} likes, ${post.comments} comments)`,
                structure: extracted.structure,
                example_posts: [post.content],
                use_cases: extracted.use_cases,
                tags: extracted.tags,
                embedding: JSON.stringify(embedding),
                source: 'scraped',
                is_global: true,
                scraped_post_id: post.id,
              })
              .select('id')
              .single();

            if (templateError) {
              throw new Error(`Template insert failed: ${templateError.message}`);
            }

            templatesCreated++;

            // 4. Save to swipe file
            const { error: swipeError } = await supabase
              .from('swipe_file_posts')
              .insert({
                content: post.content,
                author_name: post.author_name,
                author_headline: post.author_headline,
                likes: post.likes,
                comments: post.comments,
                type: extracted.category || 'educational',
                niche: 'other',
                is_featured: false,
              });

            if (!swipeError) {
              swipeFilesCreated++;
            }

            // 5. Mark viral post as processed
            await supabase
              .from('cp_viral_posts')
              .update({
                template_extracted: true,
                extracted_template_id: template?.id,
              })
              .eq('id', post.id);

            logger.info(`Extracted template from post ${post.id}: "${extracted.name}"`);
          } catch (err) {
            const msg = `Post ${post.id}: ${err instanceof Error ? err.message : String(err)}`;
            errors.push(msg);
            logger.error('Template extraction failed', { postId: post.id, error: msg });

            // Still mark as processed to avoid infinite retries
            await supabase
              .from('cp_viral_posts')
              .update({ template_extracted: true })
              .eq('id', post.id);
          }
        })
      );
    }

    // Log extraction run
    await supabase.from('cp_pipeline_scrape_runs').insert({
      run_type: 'extraction',
      posts_found: posts.length,
      templates_extracted: templatesCreated,
      completed_at: new Date().toISOString(),
      error_log: errors.length > 0 ? errors.join('\n') : null,
    });

    return {
      processed: posts.length,
      templates: templatesCreated,
      swipeFiles: swipeFilesCreated,
      errors,
    };
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/extract-winning-templates.ts
git commit -m "feat: add winning template extraction task

Processes viral posts marked as winners. Extracts template structure
via Claude, generates pgvector embedding, saves as global template,
and adds to swipe file. Batched 3 at a time."
```

---

## Task 8: API Routes — Creators & Scrape Searches

**Files:**
- Create: `src/app/api/content-pipeline/creators/route.ts` — GET (list) + POST (add creator)
- Create: `src/app/api/content-pipeline/creators/[id]/route.ts` — DELETE
- Create: `src/app/api/content-pipeline/scrape-searches/route.ts` — GET + POST
- Create: `src/app/api/content-pipeline/scrape-searches/[id]/route.ts` — DELETE
- Modify: `src/app/api/content-pipeline/templates/route.ts` — support `global` query param

**Step 1: Write creators API**

```typescript
// src/app/api/content-pipeline/creators/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('cp_tracked_creators')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { linkedin_url, name, headline } = body;

  if (!linkedin_url) {
    return NextResponse.json({ error: 'linkedin_url is required' }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  // Deduplicate by URL
  const { data: existing } = await supabase
    .from('cp_tracked_creators')
    .select('id')
    .eq('linkedin_url', linkedin_url)
    .single();

  if (existing) {
    return NextResponse.json({ message: 'Creator already tracked', id: existing.id });
  }

  const { data, error } = await supabase
    .from('cp_tracked_creators')
    .insert({
      linkedin_url,
      name: name || null,
      headline: headline || null,
      added_by_user_id: session.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

```typescript
// src/app/api/content-pipeline/creators/[id]/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from('cp_tracked_creators')
    .delete()
    .eq('id', id)
    .eq('added_by_user_id', session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 2: Write scrape-searches API**

```typescript
// src/app/api/content-pipeline/scrape-searches/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('cp_scrape_searches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { query, description, post_format_filter } = body;

  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('cp_scrape_searches')
    .insert({
      query,
      description: description || null,
      post_format_filter: post_format_filter || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

```typescript
// src/app/api/content-pipeline/scrape-searches/[id]/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from('cp_scrape_searches')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: Update templates API to support global query**

In `src/app/api/content-pipeline/templates/route.ts`, modify the GET handler to accept `?scope=global` or `?scope=mine` or `?scope=all` (default: all).

Add to the existing GET handler's query building:
```typescript
const scope = searchParams.get('scope'); // 'global' | 'mine' | 'all'
if (scope === 'global') {
  query = query.eq('is_global', true);
} else if (scope === 'mine') {
  query = query.eq('user_id', session.user.id).eq('is_global', false);
}
// 'all' or no scope: return both (RLS handles visibility)
```

Also add a `POST /templates/match` update to use the RPC:
```typescript
// In the existing match endpoint or as new POST handler
const { topic, count, minSimilarity } = await request.json();
const embedding = await generateEmbedding(topic);
const { data } = await supabase.rpc('cp_match_templates', {
  query_embedding: JSON.stringify(embedding),
  match_user_id: session.user.id,
  match_count: count || 3,
  min_similarity: minSimilarity || 0.3,
});
```

**Step 4: Commit**

```bash
git add src/app/api/content-pipeline/creators/ src/app/api/content-pipeline/scrape-searches/ src/app/api/content-pipeline/templates/route.ts
git commit -m "feat: add API routes for tracked creators and scrape searches

Creator CRUD with deduplication by LinkedIn URL.
Scrape search CRUD for admin-defined queries.
Templates API extended with scope filter (global/mine/all)
and RAG matching endpoint."
```

---

## Task 9: UI — Global Template Library & Template Search

**Files:**
- Create: `src/components/content-pipeline/GlobalTemplateLibrary.tsx`
- Create: `src/components/content-pipeline/TemplateSearch.tsx`
- Modify: `src/components/content-pipeline/TemplatesTab.tsx` — add global library section + search

**Context:**
- Existing `TemplatesTab.tsx` shows user templates in a grid with CRUD
- Need to add: global library section (read-only), semantic search bar, "Use This Template" button
- Two-section layout: "Global Library" (scraped, read-only browse) + "My Templates" (user CRUD)
- Search bar uses `POST /api/content-pipeline/templates/match` with topic text

**Step 1: Write TemplateSearch component**

A search input that calls the template match API and shows results ranked by similarity.

```tsx
// src/components/content-pipeline/TemplateSearch.tsx
'use client';

import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface MatchedTemplate {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  structure: string;
  tags: string[] | null;
  similarity: number;
  source: string;
}

interface TemplateSearchProps {
  onSelect?: (template: MatchedTemplate) => void;
}

export function TemplateSearch({ onSelect }: TemplateSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MatchedTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim() || query.trim().length < 3) return;

    setLoading(true);
    try {
      const res = await fetch('/api/content-pipeline/templates/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: query, count: 5, minSimilarity: 0.2 }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates by topic (e.g. 'client success story')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            className="pl-9"
          />
        </div>
        <button
          onClick={search}
          disabled={loading || query.trim().length < 3}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((t) => (
            <div
              key={t.id}
              className="p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => onSelect?.(t)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{t.name}</span>
                <div className="flex items-center gap-2">
                  {t.category && (
                    <Badge variant="secondary" className="text-xs">
                      {t.category}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {Math.round(t.similarity * 100)}% match
                  </Badge>
                </div>
              </div>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                {t.structure}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Write GlobalTemplateLibrary component**

Grid of global templates with category filtering and engagement stats.

```tsx
// src/components/content-pipeline/GlobalTemplateLibrary.tsx
'use client';

import { useState, useEffect } from 'react';
import { Globe, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GlobalTemplate {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  structure: string;
  tags: string[] | null;
  usage_count: number;
  avg_engagement_score: number | null;
}

const CATEGORIES = [
  'all', 'story', 'framework', 'listicle', 'contrarian',
  'case_study', 'question', 'educational', 'motivational',
];

export function GlobalTemplateLibrary() {
  const [templates, setTemplates] = useState<GlobalTemplate[]>([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/content-pipeline/templates?scope=global');
        if (res.ok) {
          const data = await res.json();
          setTemplates(data);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = category === 'all'
    ? templates
    : templates.filter((t) => t.category === category);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Global Template Library</h3>
        <Badge variant="secondary" className="text-xs">
          {templates.length} templates
        </Badge>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-2 py-1 text-xs rounded-full border transition-colors ${
              category === cat
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent border-border'
            }`}
          >
            {cat === 'all' ? 'All' : cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading templates...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="p-3 border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{t.name}</span>
                {t.category && (
                  <Badge variant="secondary" className="text-xs">
                    {t.category.replace('_', ' ')}
                  </Badge>
                )}
              </div>
              {t.description && (
                <p className="text-xs text-muted-foreground mb-2">{t.description}</p>
              )}
              {expandedId === t.id && (
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/50 p-2 rounded mt-2 max-h-48 overflow-y-auto">
                  {t.structure}
                </pre>
              )}
              <div className="flex items-center gap-3 mt-2">
                {t.usage_count > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Used {t.usage_count}x
                  </span>
                )}
                {t.tags?.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Update TemplatesTab to include global library + search**

In `src/components/content-pipeline/TemplatesTab.tsx`, add imports and the two new sections above the existing "My Templates" section. Add a subtab toggle between "Global Library" and "My Templates".

Key modifications:
- Import `GlobalTemplateLibrary` and `TemplateSearch`
- Add state for active subtab: `'global' | 'mine'`
- Render `TemplateSearch` at top of tab (always visible)
- Render `GlobalTemplateLibrary` when subtab is 'global'
- Render existing template grid when subtab is 'mine'

**Step 4: Commit**

```bash
git add src/components/content-pipeline/GlobalTemplateLibrary.tsx src/components/content-pipeline/TemplateSearch.tsx src/components/content-pipeline/TemplatesTab.tsx
git commit -m "feat: add global template library UI with semantic search

Two-section layout: Global Library (read-only browse with category
filter) and My Templates (existing CRUD). Semantic search bar uses
RAG matching to find templates by topic. Cards show engagement stats."
```

---

## Task 10: UI — Tracked Creators Management

**Files:**
- Create: `src/components/content-pipeline/TrackedCreators.tsx`
- Modify: `src/components/content-pipeline/TemplatesTab.tsx` — add Tracked Creators section

**Context:**
- Shows all tracked creators with stats (avg engagement, post count, last scraped)
- Add creator form (LinkedIn URL input, deduplicates)
- Delete button (only for creators you added)
- Rendered as a section within the Templates tab or Inspiration tab

**Step 1: Write TrackedCreators component**

```tsx
// src/components/content-pipeline/TrackedCreators.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Creator {
  id: string;
  linkedin_url: string;
  name: string | null;
  headline: string | null;
  avg_engagement: number;
  post_count: number;
  last_scraped_at: string | null;
  added_by_user_id: string;
}

export function TrackedCreators() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/content-pipeline/creators');
      if (res.ok) {
        setCreators(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addCreator = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/content-pipeline/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedin_url: newUrl.trim(), name: newName.trim() || undefined }),
      });
      if (res.ok) {
        setNewUrl('');
        setNewName('');
        load();
      }
    } finally {
      setAdding(false);
    }
  };

  const removeCreator = async (id: string) => {
    await fetch(`/api/content-pipeline/creators/${id}`, { method: 'DELETE' });
    setCreators((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Tracked Creators</h3>
        <Badge variant="secondary" className="text-xs">
          {creators.length} creators
        </Badge>
      </div>

      {/* Add creator form */}
      <div className="flex gap-2">
        <Input
          placeholder="LinkedIn profile URL"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="Name (optional)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="w-40"
        />
        <button
          onClick={addCreator}
          disabled={adding || !newUrl.trim()}
          className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50 flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          {adding ? 'Adding...' : 'Track'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : creators.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No creators tracked yet. Add LinkedIn profile URLs above to start discovering winning templates.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {creators.map((c) => (
            <div key={c.id} className="p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {c.name || 'Unknown Creator'}
                  </span>
                  <a
                    href={c.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <button
                  onClick={() => removeCreator(c.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {c.headline && (
                <p className="text-xs text-muted-foreground mt-1">{c.headline}</p>
              )}
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                <span>Avg: {Math.round(c.avg_engagement)} engagement</span>
                <span>{c.post_count} posts</span>
                {c.last_scraped_at && (
                  <span>
                    Last scraped: {new Date(c.last_scraped_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add to TemplatesTab**

Import and render `<TrackedCreators />` in the Templates tab, below the template library section.

**Step 3: Commit**

```bash
git add src/components/content-pipeline/TrackedCreators.tsx src/components/content-pipeline/TemplatesTab.tsx
git commit -m "feat: add tracked creators management UI

Add/remove LinkedIn creators to monitor. Shows avg engagement,
post count, last scraped date. Deduplicates by URL. Renders
in Templates tab alongside global library."
```

---

## Task 11: UI — Inspiration Feed Enhancements

**Files:**
- Modify: `src/components/swipe-file/SwipeFileContent.tsx` — add scraped winners section + "Track Creator" button

**Context:**
- Currently shows community swipe file (manually submitted posts)
- Need to add: section for scraped winning posts (from cp_viral_posts where is_winner=true)
- "Track This Creator" button on each post card
- "Extract Template" link that goes to viral posts section

**Step 1: Add scraped winners to SwipeFileContent**

Add a new tab or section "Discovered Posts" alongside existing "Posts" and "Lead Magnets" tabs. This section fetches from `cp_viral_posts WHERE is_winner = true` and renders them with engagement metrics, author info, and action buttons.

Key additions:
- New fetch for viral posts with engagement data
- Cards showing author, content preview, engagement metrics
- "Track Creator" button (calls POST /api/content-pipeline/creators)
- "View Template" link if template_extracted is true
- Filter by engagement range

**Step 2: Commit**

```bash
git add src/components/swipe-file/SwipeFileContent.tsx
git commit -m "feat: add discovered winning posts to inspiration feed

New 'Discovered' section shows scraped high-performing posts.
Track Creator button to follow any author. View Template link
when template has been extracted."
```

---

## Task 12: Environment Variables & Deploy

**Files:**
- No code changes — env var setup only

**Step 1: Set BRIGHT_DATA_API_KEY in Trigger.dev**

Run from magnetlab directory:
```bash
curl -X POST "https://api.trigger.dev/api/v1/projects/proj_jdjofdqazqwitpinxady/envvars/prod" \
  -H "Authorization: Bearer ${TRIGGER_SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name":"BRIGHT_DATA_API_KEY","value":"8d22b983-a144-4ecd-9290-fe851f3a132b"}'
```

**Step 2: Deploy Trigger.dev tasks**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy
```

**Step 3: Deploy to Vercel**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
vercel --prod
```

**Step 4: Run CSV seed import**

After deploy, trigger the seed import by uploading the CSV via the UI or calling the API:
```bash
curl -X POST "https://magnetlab.app/api/content-pipeline/templates/seed-csv" \
  -H "Cookie: <auth-cookie>" \
  -F "file=@/Users/timlife/Downloads/✅ LI Templates-Grid view (1).csv"
```

Or: use the existing CSV import button in the Templates tab (update the CSVTemplateImporter to use the new seed-csv endpoint for enriched import).

---

## Dependency Map

```
Task 1 (DB Migration)
  ├── Task 2 (Bright Data Client)
  ├── Task 3 (Template Matcher)
  │     └── Task 4 (Post-Writer Integration) — depends on 1 + 3
  ├── Task 5 (CSV Seed Import) — depends on 1
  ├── Task 6 (Scrape Task) — depends on 1 + 2
  │     └── Task 7 (Extract Task) — depends on 1 + 6
  ├── Task 8 (API Routes) — depends on 1
  ├── Task 9 (UI: Templates) — depends on 1 + 8
  ├── Task 10 (UI: Creators) — depends on 1 + 8
  └── Task 11 (UI: Inspiration) — depends on 1 + 8
Task 12 (Deploy) — depends on all
```

**Parallelizable groups:**
- After Task 1: Tasks 2, 3, 5, 8 can all run in parallel
- After Task 2 + 3: Tasks 4, 6 can run
- After Task 6: Task 7
- After Task 8: Tasks 9, 10, 11 can all run in parallel
