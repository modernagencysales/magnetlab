# Knowledge Data Lake Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the existing knowledge base from a thin extraction layer (3 categories, no quality scoring, freeform tags) into a structured, scored, deduplicated data lake with 8 knowledge types, auto-discovered topics, and 5 retrieval modes that any downstream tool can query.

**Architecture:** Add new columns to `cp_knowledge_entries`, create `cp_knowledge_topics` + `cp_knowledge_corroborations` tables, upgrade the AI extraction prompt to produce richer metadata, add deduplication at extraction time + weekly consolidation, build 5 new retrieval API endpoints, and upgrade the MCP server with 7 new tools. The existing `category`/`tags` columns remain for backward compatibility.

**Tech Stack:** Supabase PostgreSQL (pgvector, new columns + tables), Claude Sonnet (extraction + classification), OpenAI text-embedding-3-small (embeddings), Trigger.dev v4 (backfill + weekly consolidation), Next.js 15 API routes, MCP server (TypeScript)

---

## Phase 1: Database Schema

### Task 1: Create the knowledge data lake migration

**Files:**
- Create: `supabase/migrations/20260220300000_knowledge_data_lake.sql`

**Step 1: Write the migration SQL**

```sql
-- Knowledge Data Lake: enriched types, topics, quality scoring, dedup
-- Design doc: docs/plans/2026-02-19-knowledge-data-lake-design.md

-- ============================================
-- 1. Enrich cp_knowledge_entries with new columns
-- ============================================

-- Knowledge type (8 universal types) — replaces 3-category system
ALTER TABLE cp_knowledge_entries
  ADD COLUMN IF NOT EXISTS knowledge_type TEXT CHECK (knowledge_type IN (
    'how_to', 'insight', 'story', 'question', 'objection', 'mistake', 'decision', 'market_intel'
  ));

-- Normalized topic slugs (1-3 per entry)
ALTER TABLE cp_knowledge_entries
  ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';

-- Quality score (1-5)
ALTER TABLE cp_knowledge_entries
  ADD COLUMN IF NOT EXISTS quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 5);

-- Specificity flag
ALTER TABLE cp_knowledge_entries
  ADD COLUMN IF NOT EXISTS specificity BOOLEAN DEFAULT FALSE;

-- Actionability level
ALTER TABLE cp_knowledge_entries
  ADD COLUMN IF NOT EXISTS actionability TEXT CHECK (actionability IN (
    'immediately_actionable', 'contextual', 'theoretical'
  ));

-- Dedup: points to newer/better version of this entry
ALTER TABLE cp_knowledge_entries
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES cp_knowledge_entries(id) ON DELETE SET NULL;

-- When the call happened (not when extracted)
ALTER TABLE cp_knowledge_entries
  ADD COLUMN IF NOT EXISTS source_date DATE;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_cp_knowledge_type ON cp_knowledge_entries(user_id, knowledge_type);
CREATE INDEX IF NOT EXISTS idx_cp_knowledge_topics ON cp_knowledge_entries USING GIN (topics);
CREATE INDEX IF NOT EXISTS idx_cp_knowledge_quality ON cp_knowledge_entries(user_id, quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_cp_knowledge_superseded ON cp_knowledge_entries(superseded_by) WHERE superseded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cp_knowledge_source_date ON cp_knowledge_entries(user_id, source_date DESC);

-- ============================================
-- 2. cp_knowledge_topics — normalized topic vocabulary
-- ============================================
CREATE TABLE IF NOT EXISTS cp_knowledge_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  entry_count INTEGER NOT NULL DEFAULT 0,
  avg_quality FLOAT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  parent_id UUID REFERENCES cp_knowledge_topics(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_cp_topics_user ON cp_knowledge_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_cp_topics_entry_count ON cp_knowledge_topics(user_id, entry_count DESC);

-- RLS for cp_knowledge_topics
ALTER TABLE cp_knowledge_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY cp_knowledge_topics_select ON cp_knowledge_topics FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY cp_knowledge_topics_insert ON cp_knowledge_topics FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY cp_knowledge_topics_update ON cp_knowledge_topics FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY cp_knowledge_topics_delete ON cp_knowledge_topics FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 3. cp_knowledge_corroborations — tracks when different speakers say the same thing
-- ============================================
CREATE TABLE IF NOT EXISTS cp_knowledge_corroborations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES cp_knowledge_entries(id) ON DELETE CASCADE,
  corroborated_by UUID NOT NULL REFERENCES cp_knowledge_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_id, corroborated_by)
);

CREATE INDEX IF NOT EXISTS idx_cp_corroborations_entry ON cp_knowledge_corroborations(entry_id);

-- RLS for cp_knowledge_corroborations (via entry ownership)
ALTER TABLE cp_knowledge_corroborations ENABLE ROW LEVEL SECURITY;

CREATE POLICY cp_corroborations_select ON cp_knowledge_corroborations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM cp_knowledge_entries WHERE id = entry_id AND user_id = auth.uid()
  ));
CREATE POLICY cp_corroborations_insert ON cp_knowledge_corroborations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM cp_knowledge_entries WHERE id = entry_id AND user_id = auth.uid()
  ));

-- ============================================
-- 4. RPC: update topic stats (called after entries are inserted/updated)
-- ============================================
CREATE OR REPLACE FUNCTION cp_update_topic_stats(p_user_id UUID, p_topic_slug TEXT)
RETURNS void AS $$
BEGIN
  UPDATE cp_knowledge_topics
  SET
    entry_count = (
      SELECT COUNT(*) FROM cp_knowledge_entries
      WHERE user_id = p_user_id
        AND p_topic_slug = ANY(topics)
        AND superseded_by IS NULL
    ),
    avg_quality = (
      SELECT AVG(quality_score)::FLOAT FROM cp_knowledge_entries
      WHERE user_id = p_user_id
        AND p_topic_slug = ANY(topics)
        AND superseded_by IS NULL
        AND quality_score IS NOT NULL
    ),
    last_seen = now()
  WHERE user_id = p_user_id AND slug = p_topic_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. RPC: enhanced knowledge search (adds type, topic, quality filters)
-- ============================================
CREATE OR REPLACE FUNCTION cp_match_knowledge_entries_v2(
  query_embedding TEXT,
  p_user_id UUID,
  threshold FLOAT DEFAULT 0.6,
  match_count INT DEFAULT 20,
  p_knowledge_type TEXT DEFAULT NULL,
  p_topic_slug TEXT DEFAULT NULL,
  p_min_quality INT DEFAULT NULL,
  p_since DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  transcript_id UUID,
  category TEXT,
  speaker TEXT,
  content TEXT,
  context TEXT,
  tags TEXT[],
  transcript_type TEXT,
  knowledge_type TEXT,
  topics TEXT[],
  quality_score INT,
  specificity BOOLEAN,
  actionability TEXT,
  source_date DATE,
  speaker_company TEXT,
  team_id UUID,
  source_profile_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.user_id, e.transcript_id, e.category, e.speaker,
    e.content, e.context, e.tags, e.transcript_type,
    e.knowledge_type, e.topics, e.quality_score, e.specificity,
    e.actionability, e.source_date, e.speaker_company,
    e.team_id, e.source_profile_id, e.created_at, e.updated_at,
    1 - (e.embedding <=> query_embedding::vector) AS similarity
  FROM cp_knowledge_entries e
  WHERE e.user_id = p_user_id
    AND e.superseded_by IS NULL
    AND 1 - (e.embedding <=> query_embedding::vector) > threshold
    AND (p_knowledge_type IS NULL OR e.knowledge_type = p_knowledge_type)
    AND (p_topic_slug IS NULL OR p_topic_slug = ANY(e.topics))
    AND (p_min_quality IS NULL OR e.quality_score >= p_min_quality)
    AND (p_since IS NULL OR e.source_date >= p_since)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

**Step 2: Push the migration to Supabase**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx supabase db push --linked
```
Expected: Migration applied successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/20260220300000_knowledge_data_lake.sql
git commit -m "feat: add knowledge data lake schema — types, topics, quality, dedup"
```

---

## Phase 2: Types & Constants

### Task 2: Add Knowledge Data Lake types

**Files:**
- Modify: `src/lib/types/content-pipeline.ts`

**Step 1: Add the new types**

Add after the existing `KnowledgeCategory` type (line 60):

```typescript
// Knowledge Data Lake types (8 universal knowledge types)
export type KnowledgeType =
  | 'how_to'
  | 'insight'
  | 'story'
  | 'question'
  | 'objection'
  | 'mistake'
  | 'decision'
  | 'market_intel';

export const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeType, string> = {
  how_to: 'How-To',
  insight: 'Insight',
  story: 'Story',
  question: 'Question',
  objection: 'Objection',
  mistake: 'Mistake',
  decision: 'Decision',
  market_intel: 'Market Intel',
};

export type Actionability = 'immediately_actionable' | 'contextual' | 'theoretical';

export const ACTIONABILITY_LABELS: Record<Actionability, string> = {
  immediately_actionable: 'Immediately Actionable',
  contextual: 'Contextual',
  theoretical: 'Theoretical',
};
```

**Step 2: Update KnowledgeEntry interface**

Modify the existing `KnowledgeEntry` interface (line 146-160) to add the new fields:

```typescript
export interface KnowledgeEntry {
  id: string;
  user_id: string;
  transcript_id: string;
  category: KnowledgeCategory;
  speaker: KnowledgeSpeaker;
  content: string;
  context: string | null;
  tags: string[];
  transcript_type: TranscriptType | null;
  team_id?: string | null;
  source_profile_id?: string | null;
  speaker_company?: string | null;
  // Knowledge Data Lake fields
  knowledge_type?: KnowledgeType | null;
  topics?: string[];
  quality_score?: number | null;
  specificity?: boolean;
  actionability?: Actionability | null;
  superseded_by?: string | null;
  source_date?: string | null;
  created_at: string;
  updated_at: string;
}
```

**Step 3: Add KnowledgeTopic interface**

Add after `KnowledgeEntryWithSimilarity`:

```typescript
export interface KnowledgeTopic {
  id: string;
  user_id: string;
  team_id: string | null;
  slug: string;
  display_name: string;
  description: string | null;
  entry_count: number;
  avg_quality: number | null;
  first_seen: string;
  last_seen: string;
  parent_id: string | null;
  created_at: string;
}

export interface KnowledgeCorroboration {
  id: string;
  entry_id: string;
  corroborated_by: string;
  created_at: string;
}

export interface KnowledgeGap {
  topic_slug: string;
  topic_name: string;
  coverage_score: number; // 0-1, based on how many of 8 types are filled
  type_breakdown: Record<KnowledgeType, number>;
  missing_types: KnowledgeType[];
  gap_patterns: string[];
  entry_count: number;
  avg_quality: number | null;
  last_entry_date: string | null;
}

export interface KnowledgeReadiness {
  ready: boolean;
  confidence: number; // 0-1
  reasoning: string;
  gaps_that_would_improve: string[];
  suggested_archetypes: string[];
  topic_coverage: Record<string, number>;
}
```

**Step 4: Commit**

```bash
git add src/lib/types/content-pipeline.ts
git commit -m "feat: add Knowledge Data Lake types and interfaces"
```

---

## Phase 3: Topic Auto-Discovery

### Task 3: Create the topic normalizer AI module

**Files:**
- Create: `src/lib/ai/content-pipeline/topic-normalizer.ts`

**Step 1: Write the topic normalizer**

```typescript
import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_HAIKU_MODEL } from './model-config';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

interface NormalizedTopic {
  slug: string;
  display_name: string;
  description: string;
  is_new: boolean;
}

/**
 * Given raw topic suggestions from the AI extractor, normalize them
 * against the user's existing topic vocabulary. Returns slugs to use.
 */
export async function normalizeTopics(
  userId: string,
  suggestedTopics: string[],
  entryContent: string
): Promise<NormalizedTopic[]> {
  if (suggestedTopics.length === 0) return [];

  const supabase = createSupabaseAdminClient();

  // Fetch existing topic vocabulary
  const { data: existingTopics } = await supabase
    .from('cp_knowledge_topics')
    .select('slug, display_name, description')
    .eq('user_id', userId)
    .order('entry_count', { ascending: false })
    .limit(100);

  const vocabulary = (existingTopics || []).map(
    (t) => `${t.slug} (${t.display_name}${t.description ? ': ' + t.description : ''})`
  ).join('\n');

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_HAIKU_MODEL,
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Map these suggested topics to the user's existing vocabulary, or create new topics if none match.

SUGGESTED TOPICS: ${suggestedTopics.join(', ')}

ENTRY CONTENT (for context): ${entryContent.slice(0, 500)}

EXISTING VOCABULARY:
${vocabulary || '(empty — all topics will be new)'}

RULES:
- Map to existing slugs when the meaning is the same (e.g., "cold email" matches "cold-email")
- Create new slugs only for genuinely new subjects
- Slugs: lowercase, hyphens, no spaces (e.g., "cold-email", "linkedin-outreach")
- Return 1-3 topics max
- Display names: Title Case
- Description: 1 short sentence

Return JSON array:
[{"slug": "cold-email", "display_name": "Cold Email", "description": "Cold email strategy and execution", "is_new": false}]`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

  try {
    const normalized = parseJsonResponse<NormalizedTopic[]>(text);
    return normalized.slice(0, 3);
  } catch (error) {
    logError('ai/topic-normalizer', error);
    // Fallback: create slugs from raw suggestions
    return suggestedTopics.slice(0, 3).map((t) => ({
      slug: t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      display_name: t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: '',
      is_new: true,
    }));
  }
}

/**
 * Ensure topics exist in cp_knowledge_topics, creating new ones as needed.
 * Returns the slugs that were upserted.
 */
export async function upsertTopics(
  userId: string,
  topics: NormalizedTopic[]
): Promise<string[]> {
  const supabase = createSupabaseAdminClient();

  for (const topic of topics) {
    if (topic.is_new) {
      await supabase.from('cp_knowledge_topics').upsert(
        {
          user_id: userId,
          slug: topic.slug,
          display_name: topic.display_name,
          description: topic.description || null,
          entry_count: 0,
        },
        { onConflict: 'user_id,slug' }
      );
    }
  }

  return topics.map((t) => t.slug);
}
```

**Step 2: Check model config has Haiku**

Read `src/lib/ai/content-pipeline/model-config.ts` to verify `CLAUDE_HAIKU_MODEL` exists. If not, add it.

**Step 3: Commit**

```bash
git add src/lib/ai/content-pipeline/topic-normalizer.ts
git commit -m "feat: add topic normalizer AI module for knowledge data lake"
```

---

## Phase 4: Enhanced Knowledge Extraction

### Task 4: Upgrade the knowledge extraction prompt

**Files:**
- Modify: `src/lib/ai/content-pipeline/knowledge-extractor.ts`

**Step 1: Update ExtractedKnowledgeEntry interface**

Replace the existing interface (lines 6-13):

```typescript
export interface ExtractedKnowledgeEntry {
  category: KnowledgeCategory; // kept for backward compat
  knowledge_type: KnowledgeType;
  speaker: KnowledgeSpeaker;
  content: string;
  context: string;
  tags: string[]; // kept for backward compat
  suggested_topics: string[]; // raw topic suggestions for normalizer
  quality_score: number; // 1-5
  specificity: boolean;
  actionability: 'immediately_actionable' | 'contextual' | 'theoretical';
  speaker_company?: string;
}
```

Add import at top:

```typescript
import type { KnowledgeCategory, KnowledgeSpeaker, KnowledgeType, TranscriptType } from '@/lib/types/content-pipeline';
```

**Step 2: Update the extraction prompt**

Replace the prompt string (lines 72-125) with the enhanced version. The key changes:
- Replace the 3-category instruction with the 8-type taxonomy
- Add quality scoring rubric
- Add specificity detection
- Add actionability classification
- Add topic suggestion (separate from tags)
- Map each knowledge_type back to a legacy `category` for backward compat

The new prompt section for the extraction task:

```
Task: Extract every piece of valuable knowledge from this transcript. For each entry, provide:

1. **knowledge_type**: One of:
   - "how_to" — Process, method, steps, or technique someone can follow
   - "insight" — Strategic observation, principle, framework, or mental model
   - "story" — Specific example with outcome — client result, case study, anecdote with lesson
   - "question" — Something someone asked plus the answer if given
   - "objection" — Pushback, resistance, or concern raised — plus how it was handled
   - "mistake" — Something that went wrong, a failed approach, or a lesson from failure
   - "decision" — A choice made between alternatives, with the reasoning
   - "market_intel" — Information about competitors, market trends, pricing, or industry shifts

2. **category**: Legacy field. Map knowledge_type to:
   - how_to/insight/story/mistake/decision → "insight"
   - question/objection → "question"
   - market_intel → "product_intel"

3. **speaker**: "host" | "participant" | "unknown"

4. **content**: The actual knowledge, standalone and useful without the transcript.

5. **context**: 1-2 sentences explaining what prompted this.

6. **tags**: 2-5 lowercase freeform tags (e.g., "cold email subject lines").

7. **suggested_topics**: 1-3 broad topic labels for this entry (e.g., "Cold Email", "LinkedIn Outreach", "Sales Objections"). These will be normalized later.

8. **quality_score**: Rate 1-5:
   - 5: Specific + actionable + concrete details (numbers, names, timeframes) + novel
   - 4: Specific and actionable, somewhat expected but well-articulated
   - 3: Useful context, not immediately actionable but good to know
   - 2: General observation, nothing surprising
   - 1: Filler, obvious, too vague, or incomplete

9. **specificity**: true if contains concrete details (numbers, names, timeframes, specific examples), false otherwise.

10. **actionability**: One of:
    - "immediately_actionable" — someone could do this right now
    - "contextual" — useful background, informs decisions
    - "theoretical" — abstract principle or observation
```

Update the JSON format in the prompt:

```
Return your response as valid JSON:
{
  "entries": [
    {
      "knowledge_type": "how_to|insight|story|question|objection|mistake|decision|market_intel",
      "category": "insight|question|product_intel",
      "speaker": "host|participant|unknown",
      "content": "...",
      "context": "...",
      "tags": ["specific", "lowercase"],
      "suggested_topics": ["Cold Email", "Outbound"],
      "quality_score": 4,
      "specificity": true,
      "actionability": "immediately_actionable|contextual|theoretical"
    }
  ],
  "total_count": number
}
```

**Step 3: Commit**

```bash
git add src/lib/ai/content-pipeline/knowledge-extractor.ts
git commit -m "feat: upgrade extraction prompt with 8 types, quality scoring, topics"
```

---

### Task 5: Update process-transcript to use new fields + topic normalization

**Files:**
- Modify: `src/trigger/process-transcript.ts`

**Step 1: Add imports**

Add at top:
```typescript
import { normalizeTopics, upsertTopics } from '@/lib/ai/content-pipeline/topic-normalizer';
```

**Step 2: Update the knowledge insert block**

Replace the `knowledgeInserts` mapping (lines 104-131) to include the new fields:

```typescript
// Normalize topics for all entries (batch: collect unique suggestions first)
const allSuggestedTopics = new Set<string>();
for (const entry of knowledgeResult.entries) {
  for (const topic of entry.suggested_topics || []) {
    allSuggestedTopics.add(topic);
  }
}

// Normalize and upsert topics
const topicSlugsMap = new Map<string, string>();
if (allSuggestedTopics.size > 0) {
  const normalized = await normalizeTopics(
    userId,
    Array.from(allSuggestedTopics),
    knowledgeResult.entries.map(e => e.content).join('\n').slice(0, 2000)
  );
  const slugs = await upsertTopics(userId, normalized);
  // Map original suggestions to normalized slugs
  for (const n of normalized) {
    topicSlugsMap.set(n.display_name.toLowerCase(), n.slug);
    topicSlugsMap.set(n.slug, n.slug);
  }
}

const knowledgeInserts = knowledgeResult.entries.map((entry, idx) => {
  for (const tag of entry.tags) {
    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }

  // Resolve topic slugs
  const entryTopics = (entry.suggested_topics || [])
    .map(t => topicSlugsMap.get(t.toLowerCase()) || topicSlugsMap.get(t))
    .filter(Boolean) as string[];

  // Determine speaker_company
  let speakerCompany: string | null = null;
  if (entry.speaker === 'host' && hostCompany) {
    speakerCompany = hostCompany;
  } else if (entry.speaker === 'participant' && participantCompanies.length > 0) {
    speakerCompany = participantCompanies[0];
  }

  return {
    user_id: userId,
    transcript_id: transcriptId,
    category: entry.category,
    speaker: entry.speaker,
    content: entry.content,
    context: entry.context,
    tags: entry.tags,
    transcript_type: transcriptType,
    embedding: embeddings[idx] ? JSON.stringify(embeddings[idx]) : null,
    team_id: teamId || null,
    source_profile_id: speakerProfileId || null,
    speaker_company: speakerCompany,
    // New data lake fields
    knowledge_type: entry.knowledge_type,
    topics: entryTopics,
    quality_score: entry.quality_score,
    specificity: entry.specificity ?? false,
    actionability: entry.actionability || null,
    source_date: transcript.call_date ? transcript.call_date.split('T')[0] : null,
  };
});
```

**Step 3: Add topic stats update after insert**

After the knowledge insert block (after line 143), add:

```typescript
// Update topic stats
const topicSlugsToUpdate = new Set<string>();
for (const insert of knowledgeInserts) {
  for (const slug of insert.topics || []) {
    topicSlugsToUpdate.add(slug);
  }
}
await Promise.allSettled(
  Array.from(topicSlugsToUpdate).map((slug) =>
    supabase.rpc('cp_update_topic_stats', { p_user_id: userId, p_topic_slug: slug })
  )
);
```

**Step 4: Commit**

```bash
git add src/trigger/process-transcript.ts
git commit -m "feat: process-transcript uses new types, quality scores, topic normalization"
```

---

## Phase 5: Enhanced Retrieval

### Task 6: Upgrade knowledge-brain.ts with new search + retrieval modes

**Files:**
- Modify: `src/lib/services/knowledge-brain.ts`

**Step 1: Add enhanced search function**

Add a new function alongside the existing `searchKnowledge`:

```typescript
import type {
  KnowledgeEntry,
  KnowledgeEntryWithSimilarity,
  KnowledgeCategory,
  KnowledgeType,
  KnowledgeTopic,
} from '@/lib/types/content-pipeline';

export interface EnhancedSearchOptions {
  query?: string;
  knowledgeType?: KnowledgeType;
  topicSlug?: string;
  minQuality?: number;
  since?: string; // ISO date
  category?: KnowledgeCategory;
  tags?: string[];
  limit?: number;
  threshold?: number;
  teamId?: string;
  profileId?: string;
}

export async function searchKnowledgeV2(
  userId: string,
  options: EnhancedSearchOptions = {}
): Promise<SearchKnowledgeResult> {
  const {
    query,
    knowledgeType,
    topicSlug,
    minQuality,
    since,
    category,
    tags,
    limit = 20,
    threshold = 0.6,
    teamId,
    profileId,
  } = options;

  const supabase = createSupabaseAdminClient();

  // Semantic search path
  if (query) {
    const queryEmbedding = await generateEmbedding(query);
    const { data, error } = await supabase.rpc('cp_match_knowledge_entries_v2', {
      query_embedding: JSON.stringify(queryEmbedding),
      p_user_id: userId,
      threshold,
      match_count: limit,
      p_knowledge_type: knowledgeType || null,
      p_topic_slug: topicSlug || null,
      p_min_quality: minQuality || null,
      p_since: since || null,
    });

    if (error) {
      logError('services/knowledge-brain', new Error('Enhanced search failed'), { detail: error.message });
      return { entries: [], error: error.message };
    }

    let results = (data || []) as KnowledgeEntryWithSimilarity[];

    // Post-filter by legacy category/tags if specified
    if (category) results = results.filter(e => e.category === category);
    if (tags?.length) results = results.filter(e => tags.some(t => e.tags?.includes(t)));

    return { entries: results };
  }

  // Non-search browse path with new filters
  let dbQuery = supabase
    .from('cp_knowledge_entries')
    .select('*')
    .eq('user_id', userId)
    .is('superseded_by', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (knowledgeType) dbQuery = dbQuery.eq('knowledge_type', knowledgeType);
  if (topicSlug) dbQuery = dbQuery.contains('topics', [topicSlug]);
  if (minQuality) dbQuery = dbQuery.gte('quality_score', minQuality);
  if (since) dbQuery = dbQuery.gte('source_date', since);
  if (category) dbQuery = dbQuery.eq('category', category);

  const { data, error } = await dbQuery;

  if (error) {
    logError('services/knowledge-brain', new Error('Browse failed'), { detail: error.message });
    return { entries: [], error: error.message };
  }

  return { entries: (data || []) as KnowledgeEntryWithSimilarity[] };
}
```

**Step 2: Add topic listing function**

```typescript
export async function listKnowledgeTopics(
  userId: string,
  options: { teamId?: string; limit?: number } = {}
): Promise<KnowledgeTopic[]> {
  const { limit = 50 } = options;
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('cp_knowledge_topics')
    .select('*')
    .eq('user_id', userId)
    .order('entry_count', { ascending: false })
    .limit(limit);

  if (error) {
    logError('services/knowledge-brain', new Error('Failed to list topics'), { detail: error.message });
    return [];
  }

  return data || [];
}
```

**Step 3: Add topic detail function**

```typescript
export async function getTopicDetail(
  userId: string,
  topicSlug: string
): Promise<{
  topic: KnowledgeTopic | null;
  type_breakdown: Record<string, number>;
  top_entries: Record<string, KnowledgeEntry[]>;
  corroboration_count: number;
}> {
  const supabase = createSupabaseAdminClient();

  // Get topic metadata
  const { data: topic } = await supabase
    .from('cp_knowledge_topics')
    .select('*')
    .eq('user_id', userId)
    .eq('slug', topicSlug)
    .single();

  if (!topic) return { topic: null, type_breakdown: {}, top_entries: {}, corroboration_count: 0 };

  // Get entries for this topic
  const { data: entries } = await supabase
    .from('cp_knowledge_entries')
    .select('*')
    .eq('user_id', userId)
    .contains('topics', [topicSlug])
    .is('superseded_by', null)
    .order('quality_score', { ascending: false })
    .limit(100);

  const allEntries = (entries || []) as KnowledgeEntry[];

  // Build type breakdown
  const type_breakdown: Record<string, number> = {};
  const top_entries: Record<string, KnowledgeEntry[]> = {};

  for (const entry of allEntries) {
    const kt = entry.knowledge_type || 'unknown';
    type_breakdown[kt] = (type_breakdown[kt] || 0) + 1;
    if (!top_entries[kt]) top_entries[kt] = [];
    if (top_entries[kt].length < 3) top_entries[kt].push(entry);
  }

  // Count corroborations
  const entryIds = allEntries.map(e => e.id);
  let corroboration_count = 0;
  if (entryIds.length > 0) {
    const { count } = await supabase
      .from('cp_knowledge_corroborations')
      .select('*', { count: 'exact', head: true })
      .in('entry_id', entryIds);
    corroboration_count = count || 0;
  }

  return { topic, type_breakdown, top_entries, corroboration_count };
}
```

**Step 4: Commit**

```bash
git add src/lib/services/knowledge-brain.ts
git commit -m "feat: enhanced knowledge search v2, topic listing, topic detail"
```

---

### Task 7: Add new API routes for knowledge retrieval

**Files:**
- Modify: `src/app/api/content-pipeline/knowledge/route.ts`
- Create: `src/app/api/content-pipeline/knowledge/topics/route.ts`
- Create: `src/app/api/content-pipeline/knowledge/topics/[slug]/route.ts`
- Create: `src/app/api/content-pipeline/knowledge/gaps/route.ts`
- Create: `src/app/api/content-pipeline/knowledge/recent/route.ts`

**Step 1: Update the main knowledge route to support new filters**

Add v2 search params to the existing GET handler in `knowledge/route.ts`:

```typescript
// New query params
const knowledgeType = searchParams.get('type') as KnowledgeType | null;
const topicSlug = searchParams.get('topic');
const minQuality = searchParams.get('min_quality') ? parseInt(searchParams.get('min_quality')!, 10) : undefined;
const since = searchParams.get('since');
```

When any new filter is present, use `searchKnowledgeV2` instead of the old functions.

**Step 2: Create topics list route**

`topics/route.ts`:
```typescript
// GET /api/content-pipeline/knowledge/topics
// Returns all topics with counts, quality, freshness
```

**Step 3: Create topic detail route**

`topics/[slug]/route.ts`:
```typescript
// GET /api/content-pipeline/knowledge/topics/[slug]
// Returns coverage matrix, type breakdown, top entries per type
```

**Step 4: Create gaps route**

`gaps/route.ts`:
```typescript
// GET /api/content-pipeline/knowledge/gaps
// Returns topics with coverage_score, type_breakdown, gaps[], overall summary
```

**Step 5: Create recent digest route**

`recent/route.ts`:
```typescript
// GET /api/content-pipeline/knowledge/recent?days=7
// Returns entries_added, new_topics, most_active_topics, quality 4+ highlights
```

**Step 6: Commit**

```bash
git add src/app/api/content-pipeline/knowledge/
git commit -m "feat: add knowledge topics, gaps, and recent digest API routes"
```

---

## Phase 6: Gap Analysis AI

### Task 8: Create the gap analysis module

**Files:**
- Create: `src/lib/ai/content-pipeline/knowledge-gap-analyzer.ts`

**Step 1: Write the gap analyzer**

This module takes topic data and produces gap analysis using AI:

```typescript
import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_HAIKU_MODEL } from './model-config';
import type { KnowledgeType, KnowledgeGap } from '@/lib/types/content-pipeline';

const KNOWLEDGE_TYPES: KnowledgeType[] = [
  'how_to', 'insight', 'story', 'question',
  'objection', 'mistake', 'decision', 'market_intel',
];

/**
 * Analyze knowledge gaps across all topics for a user.
 */
export function analyzeTopicGaps(
  topicSlug: string,
  topicName: string,
  typeBreakdown: Record<string, number>,
  avgQuality: number | null,
  lastEntryDate: string | null
): KnowledgeGap {
  const entryCount = Object.values(typeBreakdown).reduce((a, b) => a + b, 0);
  const filledTypes = KNOWLEDGE_TYPES.filter(t => (typeBreakdown[t] || 0) > 0);
  const missingTypes = KNOWLEDGE_TYPES.filter(t => (typeBreakdown[t] || 0) === 0);
  const coverageScore = filledTypes.length / KNOWLEDGE_TYPES.length;

  // Detect gap patterns
  const patterns: string[] = [];

  const questionCount = typeBreakdown['question'] || 0;
  const howToCount = typeBreakdown['how_to'] || 0;
  if (questionCount > 3 && howToCount === 0) {
    patterns.push('Asked but not answered — many questions, no how-to processes documented');
  }

  const insightCount = typeBreakdown['insight'] || 0;
  const storyCount = typeBreakdown['story'] || 0;
  if (insightCount > 3 && storyCount === 0) {
    patterns.push('Theory without proof — insights but no case studies or stories');
  }

  if (entryCount > 10 && howToCount === 0) {
    patterns.push('All talk, no process — lots of knowledge but no documented SOPs');
  }

  if (lastEntryDate) {
    const daysSince = Math.floor((Date.now() - new Date(lastEntryDate).getTime()) / 86400000);
    if (daysSince > 90) {
      patterns.push(`Stale knowledge — last entry was ${daysSince} days ago`);
    }
  }

  if (entryCount <= 5 && entryCount >= 2) {
    patterns.push('Thin but trending — a few more calls and you\'ll have enough');
  }

  return {
    topic_slug: topicSlug,
    topic_name: topicName,
    coverage_score: coverageScore,
    type_breakdown: Object.fromEntries(
      KNOWLEDGE_TYPES.map(t => [t, typeBreakdown[t] || 0])
    ) as Record<KnowledgeType, number>,
    missing_types: missingTypes,
    gap_patterns: patterns,
    entry_count: entryCount,
    avg_quality: avgQuality,
    last_entry_date: lastEntryDate,
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/content-pipeline/knowledge-gap-analyzer.ts
git commit -m "feat: add knowledge gap analysis module"
```

---

### Task 9: Create the readiness assessment module

**Files:**
- Create: `src/lib/ai/content-pipeline/knowledge-readiness.ts`

**Step 1: Write the readiness assessor**

```typescript
import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_HAIKU_MODEL } from './model-config';
import { searchKnowledgeV2 } from '@/lib/services/knowledge-brain';
import type { KnowledgeReadiness } from '@/lib/types/content-pipeline';
import { logError } from '@/lib/utils/logger';

/**
 * Assess whether the user has enough knowledge on a topic for a given goal.
 */
export async function assessReadiness(
  userId: string,
  topic: string,
  goal: 'lead_magnet' | 'blog_post' | 'course' | 'sop' | 'content_week'
): Promise<KnowledgeReadiness> {
  // Fetch all knowledge for this topic
  const result = await searchKnowledgeV2(userId, {
    query: topic,
    limit: 50,
    threshold: 0.5,
    minQuality: 2,
  });

  const entries = result.entries;
  const typeCount: Record<string, number> = {};
  for (const e of entries) {
    const kt = (e as any).knowledge_type || e.category;
    typeCount[kt] = (typeCount[kt] || 0) + 1;
  }

  const totalEntries = entries.length;
  const avgQuality = entries.reduce((sum, e) => sum + ((e as any).quality_score || 3), 0) / Math.max(totalEntries, 1);
  const highQualityCount = entries.filter(e => ((e as any).quality_score || 3) >= 4).length;

  // Goal-specific thresholds
  const thresholds: Record<string, { minEntries: number; minTypes: number; minAvgQuality: number }> = {
    lead_magnet: { minEntries: 8, minTypes: 3, minAvgQuality: 3.5 },
    blog_post: { minEntries: 5, minTypes: 2, minAvgQuality: 3.0 },
    course: { minEntries: 20, minTypes: 5, minAvgQuality: 3.5 },
    sop: { minEntries: 5, minTypes: 2, minAvgQuality: 3.0 },
    content_week: { minEntries: 10, minTypes: 3, minAvgQuality: 3.0 },
  };

  const threshold = thresholds[goal] || thresholds.lead_magnet;
  const typesPresent = Object.keys(typeCount).length;

  // Use AI to generate a nuanced assessment
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Assess knowledge readiness. Topic: "${topic}", Goal: "${goal}".

Stats: ${totalEntries} entries, ${typesPresent} types, avg quality ${avgQuality.toFixed(1)}/5, ${highQualityCount} high-quality entries.

Type breakdown: ${JSON.stringify(typeCount)}

Sample high-quality entries:
${entries.slice(0, 5).map(e => `- [${(e as any).knowledge_type || e.category}] ${e.content.slice(0, 150)}`).join('\n')}

Return JSON: {"ready": bool, "confidence": 0-1, "reasoning": "...", "gaps_that_would_improve": ["..."], "suggested_archetypes": ["..."]}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const assessment = parseJsonResponse<Omit<KnowledgeReadiness, 'topic_coverage'>>(text);

    return {
      ...assessment,
      topic_coverage: typeCount,
    };
  } catch (error) {
    logError('ai/knowledge-readiness', error);
    // Fallback to rule-based assessment
    const ready = totalEntries >= threshold.minEntries
      && typesPresent >= threshold.minTypes
      && avgQuality >= threshold.minAvgQuality;

    return {
      ready,
      confidence: ready ? 0.7 : 0.4,
      reasoning: ready
        ? `You have ${totalEntries} entries across ${typesPresent} types with ${avgQuality.toFixed(1)} avg quality.`
        : `Need more knowledge: ${totalEntries}/${threshold.minEntries} entries, ${typesPresent}/${threshold.minTypes} types.`,
      gaps_that_would_improve: [],
      suggested_archetypes: [],
      topic_coverage: typeCount,
    };
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/content-pipeline/knowledge-readiness.ts
git commit -m "feat: add knowledge readiness assessment module"
```

---

## Phase 7: Deduplication

### Task 10: Add dedup-at-extraction to process-transcript

**Files:**
- Modify: `src/trigger/process-transcript.ts`
- Create: `src/lib/services/knowledge-dedup.ts`

**Step 1: Create the dedup service**

```typescript
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { cosineSimilarity } from '@/lib/ai/embeddings';
import { logError } from '@/lib/utils/logger';

interface DedupResult {
  action: 'insert' | 'supersede' | 'corroborate';
  existingEntryId?: string;
}

/**
 * Check if a new entry is a duplicate of an existing one.
 * Uses embedding similarity (> 0.90 = likely dup, > 0.85 = possible refinement).
 */
export async function checkForDuplicate(
  userId: string,
  embedding: number[],
  speaker: string,
  content: string
): Promise<DedupResult> {
  const supabase = createSupabaseAdminClient();

  // Find near-duplicates via pgvector
  const { data, error } = await supabase.rpc('cp_match_knowledge_entries', {
    query_embedding: JSON.stringify(embedding),
    p_user_id: userId,
    threshold: 0.85,
    match_count: 5,
  });

  if (error || !data?.length) {
    return { action: 'insert' };
  }

  const topMatch = data[0];
  const similarity = topMatch.similarity;

  if (similarity > 0.90) {
    // Same speaker = true duplicate or refinement
    if (topMatch.speaker === speaker) {
      return { action: 'supersede', existingEntryId: topMatch.id };
    }
    // Different speaker = corroboration
    return { action: 'corroborate', existingEntryId: topMatch.id };
  }

  if (similarity > 0.85 && topMatch.speaker === speaker) {
    // Possible refinement — keep both for now, let weekly consolidation handle it
    return { action: 'insert' };
  }

  return { action: 'insert' };
}

/**
 * Supersede an existing entry with a new one.
 * The new entry replaces the old one; old gets superseded_by pointer.
 */
export async function supersedeEntry(
  oldEntryId: string,
  newEntryId: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_knowledge_entries')
    .update({ superseded_by: newEntryId })
    .eq('id', oldEntryId);

  if (error) {
    logError('services/knowledge-dedup', new Error('Failed to supersede'), { oldEntryId, newEntryId });
  }
}

/**
 * Record a corroboration link between two entries.
 */
export async function recordCorroboration(
  entryId: string,
  corroboratedById: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_knowledge_corroborations')
    .upsert(
      { entry_id: entryId, corroborated_by: corroboratedById },
      { onConflict: 'entry_id,corroborated_by' }
    );

  if (error) {
    logError('services/knowledge-dedup', new Error('Failed to record corroboration'), { entryId, corroboratedById });
  }
}
```

**Step 2: Integrate dedup into process-transcript**

After inserting knowledge entries, loop through inserted entries and run dedup check for each. If supersede or corroborate, apply the action.

This is a lightweight check — only runs for entries that have embeddings.

**Step 3: Commit**

```bash
git add src/lib/services/knowledge-dedup.ts src/trigger/process-transcript.ts
git commit -m "feat: add knowledge dedup at extraction time"
```

---

### Task 11: Create weekly consolidation Trigger.dev task

**Files:**
- Create: `src/trigger/consolidate-knowledge.ts`

**Step 1: Write the weekly consolidation task**

```typescript
import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export const consolidateKnowledge = schedules.task({
  id: 'consolidate-knowledge',
  cron: '0 3 * * 0', // Every Sunday at 3 AM UTC
  run: async () => {
    const supabase = createSupabaseAdminClient();
    logger.info('Starting weekly knowledge consolidation');

    // Get all users who have knowledge entries
    const { data: users } = await supabase
      .from('cp_knowledge_entries')
      .select('user_id')
      .is('superseded_by', null)
      .limit(1000);

    const uniqueUsers = [...new Set((users || []).map(u => u.user_id))];
    logger.info(`Processing ${uniqueUsers.length} users`);

    let totalConsolidated = 0;

    for (const userId of uniqueUsers) {
      // Get entries clustered by topic + high similarity
      // For each cluster with > 1 entry from same speaker:
      //   - Keep highest quality_score entry as HEAD
      //   - Set superseded_by on others
      // This is Phase 2 consolidation from the design doc

      // For now: just update topic stats (the lightweight version)
      const { data: topics } = await supabase
        .from('cp_knowledge_topics')
        .select('slug')
        .eq('user_id', userId);

      for (const topic of topics || []) {
        await supabase.rpc('cp_update_topic_stats', {
          p_user_id: userId,
          p_topic_slug: topic.slug,
        });
      }
    }

    logger.info('Weekly consolidation complete', { totalConsolidated });
    return { usersProcessed: uniqueUsers.length, consolidated: totalConsolidated };
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/consolidate-knowledge.ts
git commit -m "feat: add weekly knowledge consolidation scheduled task"
```

---

## Phase 8: MCP Server Upgrade

### Task 12: Add new knowledge tools to MCP server

**Files:**
- Modify: `packages/mcp/src/tools/content-pipeline.ts`
- Modify: `packages/mcp/src/constants.ts`

**Step 1: Add KnowledgeType to constants**

In `packages/mcp/src/constants.ts`, add:
```typescript
export type KnowledgeType = 'how_to' | 'insight' | 'story' | 'question' | 'objection' | 'mistake' | 'decision' | 'market_intel';
export type Actionability = 'immediately_actionable' | 'contextual' | 'theoretical';
```

**Step 2: Update existing knowledge tools**

In `content-pipeline.ts`, update `magnetlab_search_knowledge` to include new filter params:
- `type` (KnowledgeType enum)
- `topic` (string, topic slug)
- `min_quality` (number, 1-5)
- `since` (string, ISO date)

**Step 3: Add 7 new tools**

Add to the content pipeline tools array:

1. `magnetlab_ask_knowledge` — "What do we know about X?" → AI-summarized answer
2. `magnetlab_knowledge_gaps` — "Where are we thin?" → gap analysis
3. `magnetlab_knowledge_readiness` — "Can I write a magnet about X?" → readiness check
4. `magnetlab_recent_knowledge` — "What did I learn this week?" → digest
5. `magnetlab_export_knowledge` — "Export cold email knowledge" → structured export
6. `magnetlab_list_topics` — all topics with counts, quality, freshness
7. `magnetlab_topic_detail` — coverage matrix, type breakdown, top entries per type

Each tool needs: name, description, inputSchema.

**Step 4: Update tool count in tests**

Update `tools.test.ts` to expect 106 tools (99 + 7 new).

**Step 5: Commit**

```bash
git add packages/mcp/
git commit -m "feat: add 7 new knowledge data lake MCP tools"
```

---

### Task 13: Add MCP client methods for new knowledge tools

**Files:**
- Modify: `packages/mcp/src/client.ts`

**Step 1: Add client methods**

Add these methods to `MagnetLabClient`:

```typescript
// Enhanced knowledge search
async searchKnowledgeV2(params: {
  query?: string;
  type?: string;
  topic?: string;
  min_quality?: number;
  since?: string;
  category?: string;
}): Promise<unknown> { ... }

// AI-summarized knowledge query
async askKnowledge(params: { question: string }): Promise<unknown> { ... }

// Knowledge gaps
async getKnowledgeGaps(): Promise<unknown> { ... }

// Knowledge readiness
async getKnowledgeReadiness(params: { topic: string; goal: string }): Promise<unknown> { ... }

// Recent knowledge digest
async getRecentKnowledge(params: { days?: number }): Promise<unknown> { ... }

// Structured knowledge export
async exportKnowledge(params: { topic: string; format?: string }): Promise<unknown> { ... }

// List topics
async listKnowledgeTopics(): Promise<unknown> { ... }

// Topic detail
async getTopicDetail(slug: string): Promise<unknown> { ... }
```

**Step 2: Commit**

```bash
git add packages/mcp/src/client.ts
git commit -m "feat: add MCP client methods for knowledge data lake"
```

---

### Task 14: Add MCP handler routing for new tools

**Files:**
- Modify: `packages/mcp/src/handlers/content-pipeline.ts`

**Step 1: Add cases for new tools**

Add switch cases for:
- `magnetlab_ask_knowledge` → `client.askKnowledge({ question: args.question })`
- `magnetlab_knowledge_gaps` → `client.getKnowledgeGaps()`
- `magnetlab_knowledge_readiness` → `client.getKnowledgeReadiness({ topic, goal })`
- `magnetlab_recent_knowledge` → `client.getRecentKnowledge({ days })`
- `magnetlab_export_knowledge` → `client.exportKnowledge({ topic, format })`
- `magnetlab_list_topics` → `client.listKnowledgeTopics()`
- `magnetlab_topic_detail` → `client.getTopicDetail(args.slug)`

Also update `magnetlab_search_knowledge` to pass new filter params through.

**Step 2: Commit**

```bash
git add packages/mcp/src/handlers/content-pipeline.ts
git commit -m "feat: add MCP handler routing for knowledge data lake tools"
```

---

## Phase 9: Ask Knowledge (AI Summary Route)

### Task 15: Create the ask-knowledge API route and AI module

**Files:**
- Create: `src/app/api/content-pipeline/knowledge/ask/route.ts`
- Create: `src/lib/ai/content-pipeline/knowledge-answerer.ts`

**Step 1: Write the AI answerer**

```typescript
import { getAnthropicClient } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import { searchKnowledgeV2 } from '@/lib/services/knowledge-brain';

export async function answerKnowledgeQuestion(
  userId: string,
  question: string
): Promise<{ answer: string; sources: Array<{ id: string; content: string; type: string }> }> {
  // Retrieve relevant entries
  const result = await searchKnowledgeV2(userId, {
    query: question,
    limit: 15,
    threshold: 0.5,
    minQuality: 2,
  });

  if (result.entries.length === 0) {
    return {
      answer: 'I don\'t have enough knowledge on this topic yet. Process more call transcripts to build your knowledge base.',
      sources: [],
    };
  }

  const context = result.entries
    .map((e, i) => `[${i + 1}] (${(e as any).knowledge_type || e.category}) ${e.content}`)
    .join('\n\n');

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Answer this question using ONLY the knowledge base entries below. Be specific and reference what you know.

QUESTION: ${question}

KNOWLEDGE BASE:
${context}

Answer concisely. If the knowledge is incomplete, say what's missing.`,
    }],
  });

  const answer = response.content[0].type === 'text' ? response.content[0].text : 'Unable to generate answer.';

  return {
    answer,
    sources: result.entries.slice(0, 5).map(e => ({
      id: e.id,
      content: e.content.slice(0, 200),
      type: (e as any).knowledge_type || e.category,
    })),
  };
}
```

**Step 2: Write the API route**

```typescript
// POST /api/content-pipeline/knowledge/ask
// Body: { question: string }
// Returns: { answer: string, sources: [...] }
```

**Step 3: Commit**

```bash
git add src/lib/ai/content-pipeline/knowledge-answerer.ts src/app/api/content-pipeline/knowledge/ask/
git commit -m "feat: add ask-knowledge AI-powered Q&A endpoint"
```

---

## Phase 10: Backfill

### Task 16: Create backfill Trigger.dev task

**Files:**
- Create: `src/trigger/backfill-knowledge-types.ts`

**Step 1: Write the backfill task**

This one-time task re-classifies existing knowledge entries with the new taxonomy:

```typescript
import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';
import { CLAUDE_HAIKU_MODEL } from '@/lib/ai/content-pipeline/model-config';
import { normalizeTopics, upsertTopics } from '@/lib/ai/content-pipeline/topic-normalizer';

export const backfillKnowledgeTypes = task({
  id: 'backfill-knowledge-types',
  maxDuration: 1800, // 30 min
  retry: { maxAttempts: 1 },
  run: async (payload: { userId: string; batchSize?: number }) => {
    const { userId, batchSize = 20 } = payload;
    const supabase = createSupabaseAdminClient();

    // Get entries without knowledge_type
    const { data: entries, error } = await supabase
      .from('cp_knowledge_entries')
      .select('id, category, speaker, content, context, tags')
      .eq('user_id', userId)
      .is('knowledge_type', null)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error || !entries?.length) {
      logger.info('No entries to backfill', { error: error?.message });
      return { processed: 0 };
    }

    logger.info(`Backfilling ${entries.length} entries`);

    // Classify in batches of 10 via Claude Haiku
    const BATCH = 10;
    let processed = 0;

    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const client = getAnthropicClient();

      const response = await client.messages.create({
        model: CLAUDE_HAIKU_MODEL,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Classify these knowledge entries. For each, return knowledge_type, quality_score, specificity, actionability, and suggested_topics.

${batch.map((e, idx) => `[${idx}] (${e.category}) ${e.content}`).join('\n\n')}

knowledge_type: how_to|insight|story|question|objection|mistake|decision|market_intel
quality_score: 1-5
specificity: true/false
actionability: immediately_actionable|contextual|theoretical
suggested_topics: 1-3 topic labels

Return JSON array: [{"index": 0, "knowledge_type": "...", "quality_score": 4, "specificity": true, "actionability": "...", "suggested_topics": ["..."]}]`,
        }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

      try {
        const classifications = parseJsonResponse<Array<{
          index: number;
          knowledge_type: string;
          quality_score: number;
          specificity: boolean;
          actionability: string;
          suggested_topics: string[];
        }>>(text);

        for (const cls of classifications) {
          const entry = batch[cls.index];
          if (!entry) continue;

          // Normalize topics
          const normalized = await normalizeTopics(userId, cls.suggested_topics, entry.content);
          const slugs = await upsertTopics(userId, normalized);

          await supabase
            .from('cp_knowledge_entries')
            .update({
              knowledge_type: cls.knowledge_type,
              quality_score: cls.quality_score,
              specificity: cls.specificity,
              actionability: cls.actionability,
              topics: slugs,
            })
            .eq('id', entry.id);

          processed++;
        }
      } catch (parseError) {
        logger.error('Failed to parse backfill response', { batch: i });
      }

      // Rate limiting between batches
      await new Promise(r => setTimeout(r, 1000));
    }

    logger.info('Backfill complete', { processed });
    return { processed };
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/backfill-knowledge-types.ts
git commit -m "feat: add one-time backfill task for knowledge type classification"
```

---

## Phase 11: Validation & Testing

### Task 17: Add tests for new modules

**Files:**
- Create: `src/__tests__/lib/knowledge-gap-analyzer.test.ts`
- Create: `src/__tests__/lib/topic-normalizer.test.ts`

**Step 1: Write gap analyzer tests**

Test `analyzeTopicGaps()` with various type breakdowns:
- Full coverage (7-8 types filled) → high coverage_score, few gaps
- Empty topic → 0 coverage, all 8 types missing
- "Asked but not answered" pattern (many questions, no how_to)
- "Theory without proof" pattern (insights but no stories)
- Stale knowledge (last entry > 90 days)

**Step 2: Write topic normalizer tests**

Mock the Anthropic client and test:
- New topics created correctly
- Existing topics mapped correctly
- Fallback slug generation from raw strings
- Max 3 topics returned

**Step 3: Run tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npm run test -- --testPathPattern="knowledge-gap|topic-normalizer"
```

**Step 4: Commit**

```bash
git add src/__tests__/lib/
git commit -m "test: add tests for knowledge gap analyzer and topic normalizer"
```

---

### Task 18: Add MCP validation schemas for new tools

**Files:**
- Modify: `packages/mcp/src/validation.ts`

**Step 1: Add Zod schemas for new tools**

```typescript
magnetlab_ask_knowledge: z.object({
  question: z.string().min(3),
}),
magnetlab_knowledge_readiness: z.object({
  topic: z.string().min(1),
  goal: z.enum(['lead_magnet', 'blog_post', 'course', 'sop', 'content_week']),
}),
magnetlab_recent_knowledge: z.object({
  days: z.number().int().min(1).max(90).optional(),
}),
magnetlab_export_knowledge: z.object({
  topic: z.string().min(1),
  format: z.enum(['structured', 'markdown', 'json']).optional(),
}),
magnetlab_topic_detail: z.object({
  slug: z.string().min(1),
}),
```

`magnetlab_knowledge_gaps` and `magnetlab_list_topics` have no required params.

Also update `magnetlab_search_knowledge` schema to include optional `type`, `topic`, `min_quality`, `since` params.

**Step 2: Update MCP tests**

Update `validation.test.ts` and `handlers.test.ts` to cover new schemas and routing.

**Step 3: Run tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp"
npm run test
```

**Step 4: Commit**

```bash
git add packages/mcp/
git commit -m "test: add validation schemas and tests for knowledge data lake MCP tools"
```

---

## Phase 12: Build, Deploy, Publish

### Task 19: Build, verify, and deploy

**Step 1: Build magnetlab**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npm run build
```

**Step 2: Build MCP package**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp"
npm run build
npm run test
```

**Step 3: Push migration to Supabase**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx supabase db push --linked
```

**Step 4: Bump MCP version**

Bump `packages/mcp/package.json` version to `0.2.0`.

**Step 5: Deploy Trigger.dev**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy
```

**Step 6: Deploy Vercel**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
vercel --prod
```

**Step 7: Publish npm**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp"
npm publish --access public
```

**Step 8: Commit final state**

```bash
git add -A
git commit -m "chore: bump MCP to 0.2.0, build artifacts"
git push
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|------------------|
| 1. Database | 1 | New columns, topics table, corroborations table, v2 RPC |
| 2. Types | 2 | TypeScript interfaces for all new data structures |
| 3. Topics | 3 | AI topic normalizer module |
| 4. Extraction | 4-5 | Enhanced prompt (8 types, quality, topics), updated process-transcript |
| 5. Retrieval | 6-7 | searchKnowledgeV2, topic listing/detail, 5 new API routes |
| 6. Gap Analysis | 8-9 | Gap analyzer + readiness assessor modules |
| 7. Dedup | 10-11 | Dedup at extraction + weekly consolidation |
| 8. MCP Server | 12-14 | 7 new tools, client methods, handler routing |
| 9. Ask Knowledge | 15 | AI-powered Q&A endpoint |
| 10. Backfill | 16 | One-time reclassification of existing entries |
| 11. Testing | 17-18 | Unit tests + MCP validation |
| 12. Deploy | 19 | Build, deploy, publish |
