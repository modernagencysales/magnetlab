# Knowledge Position Synthesis Layer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cached synthesis layer that extracts structured Position objects from knowledge entries, replacing raw text dumps in content generation with structured understanding of the user's unique stance per topic.

**Architecture:** `synthesizePosition()` AI module → `cp_positions` DB table with staleness tracking → nightly Trigger.dev cron → `getCachedPosition()` service function → MCP tool exposure. `buildContentBrief()` enriched to use cached Positions.

**Tech Stack:** TypeScript, Claude Sonnet 4.6 (synthesis LLM), Supabase PostgreSQL, Trigger.dev v4 (cron), Vitest (tests)

---

### Task 1: Position type definition

**Files:**
- Modify: `src/lib/types/content-pipeline.ts`

**Step 1: Add the Position interface and related types**

Add after the `KnowledgeReadiness` interface (around line 284):

```typescript
// ============================================
// POSITION SYNTHESIS
// ============================================

export type StanceType = 'contrarian' | 'conventional' | 'nuanced' | 'experiential';

export type EvidenceStrength = 'anecdotal' | 'observed' | 'measured';

export interface PositionDataPoint {
  claim: string;
  evidence_strength: EvidenceStrength;
  source_entry_id: string;
}

export interface PositionStory {
  hook: string;
  arc: string;
  lesson: string;
  source_entry_id: string;
}

export interface PositionRecommendation {
  recommendation: string;
  reasoning: string;
  source_entry_id: string;
}

export interface PositionContradiction {
  tension: string;
  resolution?: string;
}

export interface Position {
  topic: string;
  topic_slug: string;
  thesis: string;
  stance_type: StanceType;
  confidence: number;
  key_arguments: string[];
  unique_data_points: PositionDataPoint[];
  stories: PositionStory[];
  specific_recommendations: PositionRecommendation[];
  voice_markers: string[];
  differentiators: string[];
  contradictions: PositionContradiction[];
  related_topics: string[];
  coverage_gaps: string[];
  supporting_entry_ids: string[];
  entry_count: number;
  synthesized_at: string;
}

/** Row shape from cp_positions table. */
export interface PositionRow {
  id: string;
  user_id: string;
  topic_slug: string;
  topic_label: string;
  position: Position;
  entry_ids: string[];
  entry_count: number;
  is_stale: boolean;
  synthesized_at: string;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: PASS (types only, no imports yet)

**Step 3: Commit**

```bash
git add src/lib/types/content-pipeline.ts
git commit -m "feat: add Position type definitions for knowledge synthesis layer"
```

---

### Task 2: Database migration — cp_positions table

**Files:**
- Create: `supabase/migrations/20260308000000_position_synthesis.sql`

**Step 1: Write the migration**

```sql
-- Position synthesis cache table
-- Stores structured Position objects per user per topic
-- Positions are the synthesis layer between raw knowledge entries and content generation

CREATE TABLE IF NOT EXISTS cp_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_slug TEXT NOT NULL,
  topic_label TEXT NOT NULL,
  position JSONB NOT NULL,
  entry_ids TEXT[] NOT NULL DEFAULT '{}',
  entry_count INT NOT NULL DEFAULT 0,
  is_stale BOOLEAN NOT NULL DEFAULT false,
  synthesized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, topic_slug)
);

-- Fast lookup for stale positions during nightly cron
CREATE INDEX idx_cp_positions_stale ON cp_positions(user_id) WHERE is_stale = true;

-- Fast lookup by user for listing all positions
CREATE INDEX idx_cp_positions_user ON cp_positions(user_id);

-- RLS policies
ALTER TABLE cp_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own positions"
  ON cp_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions"
  ON cp_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions"
  ON cp_positions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions"
  ON cp_positions FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass (for Trigger.dev cron and API routes)
CREATE POLICY "Service role full access"
  ON cp_positions FOR ALL
  USING (auth.role() = 'service_role');

-- Helper function: mark positions stale for given topic slugs
CREATE OR REPLACE FUNCTION cp_mark_positions_stale(
  p_user_id UUID,
  p_topic_slugs TEXT[]
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE cp_positions
  SET is_stale = true, updated_at = now()
  WHERE user_id = p_user_id
    AND topic_slug = ANY(p_topic_slugs)
    AND is_stale = false;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
```

**Step 2: Push migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm db:push`

Note: If `db:push` is not available locally, the migration file will be applied on next deploy. The file existing is sufficient for now.

**Step 3: Commit**

```bash
git add supabase/migrations/20260308000000_position_synthesis.sql
git commit -m "feat: add cp_positions table for cached position synthesis"
```

---

### Task 3: Core synthesis function — position-synthesizer.ts

**Files:**
- Create: `src/lib/ai/content-pipeline/position-synthesizer.ts`

This is the core AI module. It takes knowledge entries + topic and returns a structured Position via Claude Sonnet.

**Step 1: Write the synthesizer**

```typescript
/** Position Synthesizer. Extracts structured Position from knowledge entries via LLM. Never imports Next.js or DB modules directly. */

import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import type { KnowledgeEntry, Position, StanceType, EvidenceStrength } from '@/lib/types/content-pipeline';

/** Minimum entries needed for meaningful synthesis. */
const MIN_ENTRIES_FOR_SYNTHESIS = 3;

/** Maximum entries to include in prompt (token budget). */
const MAX_ENTRIES_IN_PROMPT = 30;

/**
 * Synthesize a Position from knowledge entries on a topic.
 *
 * Pure AI function — no DB access. Caller is responsible for:
 * - Retrieving entries (via searchKnowledgeV2 or topic browse)
 * - Caching the result (via cp_positions table)
 *
 * @param entries - Knowledge entries filtered to the topic
 * @param topic - The topic string (display name)
 * @param topicSlug - URL-safe topic slug
 * @returns Position object or null if insufficient data
 */
export async function synthesizePosition(
  entries: KnowledgeEntry[],
  topic: string,
  topicSlug: string
): Promise<Position | null> {
  if (entries.length < MIN_ENTRIES_FOR_SYNTHESIS) {
    return null;
  }

  const trimmedEntries = entries.slice(0, MAX_ENTRIES_IN_PROMPT);
  const formattedEntries = formatEntriesForPrompt(trimmedEntries);

  const client = getAnthropicClient('position-synthesizer');

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: buildSynthesisPrompt(topic, formattedEntries),
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const raw = parseJsonResponse<RawPositionResponse>(text);

  return normalizeResponse(raw, topic, topicSlug, trimmedEntries);
}

// ─── Prompt ──────────────────────────────────────────────

function buildSynthesisPrompt(topic: string, formattedEntries: string): string {
  return `You are analyzing knowledge entries from a single expert to extract their overall position on a topic.

Topic: ${topic}

Entries (numbered, with metadata):
${formattedEntries}

Analyze these entries and extract the expert's position. Be specific — use their actual language, real numbers, and concrete examples. Do NOT generalize into generic advice.

Extract as JSON:

{
  "thesis": "2-3 sentence summary of this person's overall position on ${topic}. Use their framing, not generic language.",
  "stance_type": "contrarian | conventional | nuanced | experiential",
  "confidence": 0.0-1.0,
  "key_arguments": ["3-5 main points that support their position"],
  "unique_data_points": [
    {
      "claim": "specific quantitative claim from their experience",
      "evidence_strength": "anecdotal | observed | measured",
      "source_entry_index": 0
    }
  ],
  "stories": [
    {
      "hook": "one-line narrative hook that would grab attention",
      "arc": "brief description of the narrative arc",
      "lesson": "what this story teaches",
      "source_entry_index": 0
    }
  ],
  "specific_recommendations": [
    {
      "recommendation": "named tool, specific action, or concrete advice",
      "reasoning": "why they recommend this",
      "source_entry_index": 0
    }
  ],
  "voice_markers": ["characteristic phrases, metaphors, or communication patterns they use"],
  "differentiators": ["what makes their perspective different from generic advice on this topic"],
  "contradictions": [
    {
      "tension": "description of internal contradiction or evolved thinking",
      "resolution": "how they resolve it, if apparent (optional)"
    }
  ],
  "related_topics": ["other topics these entries connect to"],
  "coverage_gaps": ["what's missing from their knowledge that would strengthen the position"]
}

Rules:
- source_entry_index references the entry number (0-based) from the list above
- confidence: 0.0-0.3 = sparse/unclear, 0.3-0.6 = moderate, 0.6-0.8 = solid, 0.8-1.0 = authoritative
- For stance_type: "contrarian" = goes against mainstream advice, "conventional" = aligns with best practices, "nuanced" = acknowledges tradeoffs explicitly, "experiential" = based primarily on personal data/stories
- voice_markers: actual phrases they use, not descriptions of their style
- stories: only include if there's a clear narrative (beginning → conflict → lesson), not just a data point
- coverage_gaps: what would you want to ask this person to make their position stronger?
- If entries contradict each other, flag it — don't paper over it

Return ONLY the JSON object, no markdown or explanation.`;
}

function formatEntriesForPrompt(entries: KnowledgeEntry[]): string {
  return entries
    .map((e, i) => {
      const meta = [
        e.knowledge_type && `type: ${e.knowledge_type}`,
        e.quality_score && `quality: ${e.quality_score}/5`,
        e.tags?.length && `tags: ${e.tags.join(', ')}`,
        e.context && `context: ${e.context}`,
      ]
        .filter(Boolean)
        .join(' | ');

      return `[${i}] ${e.content}${meta ? `\n    (${meta})` : ''}`;
    })
    .join('\n\n');
}

// ─── Response Parsing ────────────────────────────────────

interface RawPositionResponse {
  thesis: string;
  stance_type: string;
  confidence: number;
  key_arguments: string[];
  unique_data_points: Array<{
    claim: string;
    evidence_strength: string;
    source_entry_index: number;
  }>;
  stories: Array<{
    hook: string;
    arc: string;
    lesson: string;
    source_entry_index: number;
  }>;
  specific_recommendations: Array<{
    recommendation: string;
    reasoning: string;
    source_entry_index: number;
  }>;
  voice_markers: string[];
  differentiators: string[];
  contradictions: Array<{
    tension: string;
    resolution?: string;
  }>;
  related_topics: string[];
  coverage_gaps: string[];
}

const VALID_STANCES: StanceType[] = ['contrarian', 'conventional', 'nuanced', 'experiential'];
const VALID_EVIDENCE: EvidenceStrength[] = ['anecdotal', 'observed', 'measured'];

function normalizeResponse(
  raw: RawPositionResponse,
  topic: string,
  topicSlug: string,
  entries: KnowledgeEntry[]
): Position {
  const entryIds = entries.map((e) => e.id);

  const resolveEntryId = (index: number): string =>
    entries[index]?.id || entries[0]?.id || 'unknown';

  return {
    topic,
    topic_slug: topicSlug,
    thesis: raw.thesis || '',
    stance_type: VALID_STANCES.includes(raw.stance_type as StanceType)
      ? (raw.stance_type as StanceType)
      : 'experiential',
    confidence: Math.max(0, Math.min(1, raw.confidence || 0)),
    key_arguments: (raw.key_arguments || []).slice(0, 7),
    unique_data_points: (raw.unique_data_points || []).map((dp) => ({
      claim: dp.claim,
      evidence_strength: VALID_EVIDENCE.includes(dp.evidence_strength as EvidenceStrength)
        ? (dp.evidence_strength as EvidenceStrength)
        : 'anecdotal',
      source_entry_id: resolveEntryId(dp.source_entry_index),
    })),
    stories: (raw.stories || []).map((s) => ({
      hook: s.hook,
      arc: s.arc,
      lesson: s.lesson,
      source_entry_id: resolveEntryId(s.source_entry_index),
    })),
    specific_recommendations: (raw.specific_recommendations || []).map((r) => ({
      recommendation: r.recommendation,
      reasoning: r.reasoning,
      source_entry_id: resolveEntryId(r.source_entry_index),
    })),
    voice_markers: (raw.voice_markers || []).slice(0, 10),
    differentiators: (raw.differentiators || []).slice(0, 5),
    contradictions: (raw.contradictions || []).map((c) => ({
      tension: c.tension,
      ...(c.resolution ? { resolution: c.resolution } : {}),
    })),
    related_topics: (raw.related_topics || []).slice(0, 10),
    coverage_gaps: (raw.coverage_gaps || []).slice(0, 5),
    supporting_entry_ids: entryIds,
    entry_count: entries.length,
    synthesized_at: new Date().toISOString(),
  };
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/ai/content-pipeline/position-synthesizer.ts
git commit -m "feat: add position-synthesizer AI module for knowledge synthesis"
```

---

### Task 4: Position caching service functions

**Files:**
- Modify: `src/lib/services/knowledge-brain.ts`

Add position caching functions at the end of the file. These handle DB read/write/stale operations.

**Step 1: Add imports and position functions**

Add at the end of `knowledge-brain.ts`:

```typescript
// ─── Position Synthesis Cache ─────────────────────────────

import { synthesizePosition } from '@/lib/ai/content-pipeline/position-synthesizer';
import type { Position, PositionRow } from '@/lib/types/content-pipeline';

const POSITION_SELECT = 'id, user_id, topic_slug, topic_label, position, entry_ids, entry_count, is_stale, synthesized_at, created_at, updated_at';

/**
 * Get a cached Position for a topic. If stale or missing, synthesizes on demand.
 * Returns null if there aren't enough entries to synthesize (< 3).
 */
export async function getCachedPosition(
  userId: string,
  topicSlug: string,
  options: { forceFresh?: boolean; teamId?: string; profileId?: string } = {}
): Promise<Position | null> {
  const supabase = createSupabaseAdminClient();

  // Check cache first (unless forceFresh)
  if (!options.forceFresh) {
    const { data: cached } = await supabase
      .from('cp_positions')
      .select(POSITION_SELECT)
      .eq('user_id', userId)
      .eq('topic_slug', topicSlug)
      .single();

    if (cached && !cached.is_stale) {
      return cached.position as Position;
    }
  }

  // Synthesize fresh position
  return synthesizeAndCachePosition(userId, topicSlug, options);
}

/**
 * Synthesize a fresh position and cache it. Called by getCachedPosition and nightly cron.
 */
export async function synthesizeAndCachePosition(
  userId: string,
  topicSlug: string,
  options: { teamId?: string; profileId?: string } = {}
): Promise<Position | null> {
  const supabase = createSupabaseAdminClient();

  // Get topic display name
  const { data: topicRow } = await supabase
    .from('cp_knowledge_topics')
    .select('display_name')
    .eq('user_id', userId)
    .eq('slug', topicSlug)
    .single();

  const topicLabel = topicRow?.display_name || topicSlug;

  // Retrieve entries for this topic
  const searchResult = await searchKnowledgeV2(userId, {
    topicSlug,
    limit: 30,
    threshold: 0.4,
    minQuality: 2,
    sort: 'quality',
    teamId: options.teamId,
    profileId: options.profileId,
  });

  if (searchResult.entries.length < 3) {
    return null;
  }

  const position = await synthesizePosition(searchResult.entries, topicLabel, topicSlug);
  if (!position) return null;

  // Upsert into cache
  const entryIds = searchResult.entries.map((e) => e.id);
  await supabase
    .from('cp_positions')
    .upsert(
      {
        user_id: userId,
        topic_slug: topicSlug,
        topic_label: topicLabel,
        position: position as unknown as Record<string, unknown>,
        entry_ids: entryIds,
        entry_count: searchResult.entries.length,
        is_stale: false,
        synthesized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,topic_slug' }
    );

  return position;
}

/**
 * Mark positions stale for given topic slugs. Called after transcript processing.
 */
export async function markPositionsStale(
  userId: string,
  topicSlugs: string[]
): Promise<number> {
  if (topicSlugs.length === 0) return 0;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.rpc('cp_mark_positions_stale', {
    p_user_id: userId,
    p_topic_slugs: topicSlugs,
  });

  return (data as number) || 0;
}

/**
 * List all cached positions for a user.
 */
export async function listPositions(
  userId: string,
  options: { includeStale?: boolean } = {}
): Promise<PositionRow[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('cp_positions')
    .select(POSITION_SELECT)
    .eq('user_id', userId)
    .order('synthesized_at', { ascending: false });

  if (!options.includeStale) {
    query = query.eq('is_stale', false);
  }

  const { data } = await query;
  return (data as PositionRow[]) || [];
}
```

**Step 2: Add createSupabaseAdminClient import if not present**

Check the top of `knowledge-brain.ts` — it likely already imports this. If not, add:

```typescript
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/services/knowledge-brain.ts
git commit -m "feat: add position caching service (getCachedPosition, markPositionsStale)"
```

---

### Task 5: Hook staleness into transcript processing

**Files:**
- Modify: `src/trigger/process-transcript.ts`

After topic stats are updated (around line 251), mark affected positions as stale.

**Step 1: Add the staleness hook**

After the topic stats update block (the `Promise.allSettled` for `cp_update_topic_stats`), add:

```typescript
    // Mark affected positions as stale for re-synthesis
    if (topicSlugsToUpdate.size > 0) {
      try {
        await supabase.rpc('cp_mark_positions_stale', {
          p_user_id: userId,
          p_topic_slugs: Array.from(topicSlugsToUpdate),
        });
      } catch {
        // Non-critical — positions will be refreshed on next cron or on-demand
      }
    }
```

This goes right after line 251 (after the tag count increment block at line 264 is fine too — the exact position doesn't matter as long as it's after `topicSlugsToUpdate` is populated).

**Step 2: Commit**

```bash
git add src/trigger/process-transcript.ts
git commit -m "feat: mark positions stale after transcript processing"
```

---

### Task 6: Nightly position synthesis Trigger.dev task

**Files:**
- Create: `src/trigger/synthesize-positions.ts`

**Step 1: Write the nightly task**

```typescript
/** Nightly Position Synthesis. Re-synthesizes stale positions for all users. */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { synthesizeAndCachePosition } from '@/lib/services/knowledge-brain';

/** Max topics to synthesize per user per run (cost guard). */
const MAX_TOPICS_PER_USER = 10;

/** Max users to process per run (time guard). */
const MAX_USERS_PER_RUN = 50;

export const nightlyPositionSynthesis = schedules.task({
  id: 'nightly-position-synthesis',
  cron: '30 2 * * *', // 2:30 AM UTC daily (after autopilot batch at 2:00)
  maxDuration: 600, // 10 min
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Find all stale positions grouped by user
    const { data: staleRows } = await supabase
      .from('cp_positions')
      .select('user_id, topic_slug')
      .eq('is_stale', true)
      .limit(MAX_USERS_PER_RUN * MAX_TOPICS_PER_USER);

    if (!staleRows || staleRows.length === 0) {
      logger.info('No stale positions to synthesize');
      return { synthesized: 0, errors: 0 };
    }

    // Group by user
    const byUser = new Map<string, string[]>();
    for (const row of staleRows) {
      const topics = byUser.get(row.user_id) || [];
      topics.push(row.topic_slug);
      byUser.set(row.user_id, topics);
    }

    logger.info('Synthesizing positions', {
      users: byUser.size,
      totalTopics: staleRows.length,
    });

    let synthesized = 0;
    let errors = 0;

    for (const [userId, topicSlugs] of byUser) {
      const batch = topicSlugs.slice(0, MAX_TOPICS_PER_USER);

      for (const slug of batch) {
        try {
          const position = await synthesizeAndCachePosition(userId, slug);
          if (position) {
            synthesized++;
          }
        } catch (err) {
          errors++;
          logger.error('Position synthesis failed', {
            userId,
            topicSlug: slug,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    logger.info('Position synthesis complete', { synthesized, errors });
    return { synthesized, errors };
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/synthesize-positions.ts
git commit -m "feat: add nightly position synthesis Trigger.dev cron task"
```

---

### Task 7: Weekly full refresh in consolidate-knowledge

**Files:**
- Modify: `src/trigger/consolidate-knowledge.ts`

At the end of the weekly consolidation (after existing phases), add a phase that marks ALL positions stale, which the nightly cron will pick up.

**Step 1: Add full refresh phase**

At the end of the user loop (or after it), add:

```typescript
    // Phase 3: Mark all positions stale for weekly full refresh
    // The nightly cron will re-synthesize them over the next few days
    for (const userId of uniqueUsers) {
      const { data: positionTopics } = await supabase
        .from('cp_positions')
        .select('topic_slug')
        .eq('user_id', userId)
        .eq('is_stale', false);

      if (positionTopics && positionTopics.length > 0) {
        await supabase.rpc('cp_mark_positions_stale', {
          p_user_id: userId,
          p_topic_slugs: positionTopics.map((p) => p.topic_slug),
        });
        topicsUpdated += positionTopics.length;
      }
    }
```

**Step 2: Commit**

```bash
git add src/trigger/consolidate-knowledge.ts
git commit -m "feat: mark all positions stale during weekly knowledge consolidation"
```

---

### Task 8: API route for position synthesis

**Files:**
- Create: `src/app/api/content-pipeline/knowledge/position/route.ts`

**Step 1: Write the API route**

```typescript
/** Position Synthesis API. GET = cached position, POST = force fresh synthesis. */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { getCachedPosition, listPositions } from '@/lib/services/knowledge-brain';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const topicSlug = searchParams.get('topic');

  // If no topic specified, list all positions
  if (!topicSlug) {
    const positions = await listPositions(session.user.id, { includeStale: true });
    return NextResponse.json({ positions });
  }

  const position = await getCachedPosition(session.user.id, topicSlug);
  if (!position) {
    return NextResponse.json(
      { error: 'Not enough knowledge entries to synthesize a position on this topic (need at least 3)' },
      { status: 404 }
    );
  }

  return NextResponse.json({ position });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const topicSlug = body.topic as string;
  if (!topicSlug) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 });
  }

  const position = await getCachedPosition(session.user.id, topicSlug, {
    forceFresh: true,
  });

  if (!position) {
    return NextResponse.json(
      { error: 'Not enough knowledge entries to synthesize a position on this topic (need at least 3)' },
      { status: 404 }
    );
  }

  return NextResponse.json({ position });
}
```

**Step 2: Commit**

```bash
git add src/app/api/content-pipeline/knowledge/position/route.ts
git commit -m "feat: add API route for position synthesis (GET cached, POST fresh)"
```

---

### Task 9: MCP client method + tool + handler

**Files:**
- Modify: `packages/mcp/src/client.ts`
- Modify: `packages/mcp/src/tools/content-pipeline.ts`
- Modify: `packages/mcp/src/handlers/content-pipeline.ts`
- Modify: `packages/mcp/src/tools/index.ts`

**Step 1: Add client method**

In `packages/mcp/src/client.ts`, after the `listKnowledgeTopics` method (around line 731), add:

```typescript
  async synthesizePosition(params: { topic: string; force_fresh?: boolean }) {
    if (params.force_fresh) {
      return this.aiRequest<{ position: unknown }>(
        'POST',
        `/content-pipeline/knowledge/position`,
        { topic: params.topic }
      );
    }
    const searchParams = new URLSearchParams({ topic: params.topic });
    return this.request<{ position: unknown }>(
      'GET',
      `/content-pipeline/knowledge/position?${searchParams}`
    );
  }

  async listPositions() {
    return this.request<{ positions: unknown[] }>(
      'GET',
      `/content-pipeline/knowledge/position`
    );
  }
```

**Step 2: Add tool definition**

In `packages/mcp/src/tools/content-pipeline.ts`, after the knowledge tools section (after `magnetlab_topic_detail`), add:

```typescript
  {
    name: 'magnetlab_synthesize_position',
    description:
      'Synthesize the user\'s overall position on a topic from their AI Brain knowledge entries. ' +
      'Returns a structured Position object with: thesis (core stance), stance_type (contrarian/conventional/nuanced/experiential), ' +
      'key arguments, unique data points with evidence strength, extractable stories with narrative hooks, ' +
      'specific recommendations, voice markers, differentiators from generic advice, contradictions, and coverage gaps. ' +
      'Positions are cached — set force_fresh=true to re-synthesize. Requires at least 3 knowledge entries on the topic.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Topic slug (from magnetlab_list_topics)' },
        force_fresh: {
          type: 'boolean',
          default: false,
          description: 'Force re-synthesis even if cached position exists (slower, costs an LLM call)',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'magnetlab_list_positions',
    description:
      'List all synthesized positions for the user. Shows which topics have cached position synthesis, their stance type, confidence score, and whether they are stale. ' +
      'Use this to see what the AI Brain has synthesized so far, then use magnetlab_synthesize_position to get full details.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
```

**Step 3: Add handler cases**

In `packages/mcp/src/handlers/content-pipeline.ts`, add cases in the switch statement (in the Knowledge base section):

```typescript
    case 'magnetlab_synthesize_position':
      return client.synthesizePosition({
        topic: args.topic as string,
        force_fresh: args.force_fresh as boolean | undefined,
      });

    case 'magnetlab_list_positions':
      return client.listPositions();
```

**Step 4: Update tool index**

In `packages/mcp/src/tools/index.ts`, add the two new tool names to the `knowledgeToolNames` array:

```typescript
const knowledgeToolNames = [
  // ... existing 14 names ...
  'magnetlab_synthesize_position',
  'magnetlab_list_positions',
]
```

**Step 5: Update tests**

In `packages/mcp/src/__tests__/tools.test.ts`, update the count assertions:

- Total tools: 114 → 116
- `contentPipeline` handler category: 44 → 46
- `knowledge` discovery category: 14 → 16
- Content pipeline split total: 44 → 46 (knowledge 14→16, writing 19, scheduling 11)

**Step 6: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp" && npx vitest run`
Expected: All tests PASS

**Step 7: Build**

Run: `npm run build`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/mcp/src/client.ts packages/mcp/src/tools/content-pipeline.ts packages/mcp/src/handlers/content-pipeline.ts packages/mcp/src/tools/index.ts packages/mcp/src/__tests__/tools.test.ts
git commit -m "feat: add MCP tools for position synthesis (synthesize + list)"
```

---

### Task 10: Enrich buildContentBrief with cached positions

**Files:**
- Modify: `src/lib/ai/content-pipeline/briefing-agent.ts`
- Modify: `src/lib/types/content-pipeline.ts`

**Step 1: Update ContentBrief interface**

In `src/lib/types/content-pipeline.ts`, update the `ContentBrief` interface:

```typescript
export interface ContentBrief {
  topic: string;
  relevantInsights: KnowledgeEntryWithSimilarity[];
  relevantQuestions: KnowledgeEntryWithSimilarity[];
  relevantProductIntel: KnowledgeEntryWithSimilarity[];
  compiledContext: string;
  suggestedAngles: string[];
  topicReadiness?: number;
  topKnowledgeTypes?: KnowledgeType[];
  /** Synthesized position for this topic (null if insufficient entries or not yet cached). */
  position?: Position | null;
}
```

**Step 2: Update buildContentBrief to fetch cached position**

In `briefing-agent.ts`, add at the top:

```typescript
import { getCachedPosition } from '@/lib/services/knowledge-brain';
```

Then in the `buildContentBrief` function, before the return statement, add:

```typescript
  // Fetch cached position if available (non-blocking — don't fail the brief)
  let position: Position | null = null;
  try {
    // Extract topic slug from search results or try normalizing the topic string
    const topicSlug = allEntries[0]?.topics?.[0] || topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    position = await getCachedPosition(userId, topicSlug, { teamId, profileId });
  } catch {
    // Position synthesis not critical for brief
  }
```

And add `position` to the return object:

```typescript
  return {
    topic,
    relevantInsights: insights,
    relevantQuestions: questions,
    relevantProductIntel: productIntel,
    compiledContext,
    suggestedAngles,
    topicReadiness,
    topKnowledgeTypes,
    position,
  };
```

**Step 3: Add Position import**

```typescript
import type { ContentBrief, KnowledgeEntryWithSimilarity, KnowledgeType, Position, TeamVoiceProfile } from '@/lib/types/content-pipeline';
```

**Step 4: Commit**

```bash
git add src/lib/ai/content-pipeline/briefing-agent.ts src/lib/types/content-pipeline.ts
git commit -m "feat: enrich ContentBrief with cached Position from synthesis layer"
```

---

### Task 11: Update workflow recipes

**Files:**
- Modify: `packages/mcp/src/tools/category-tools.ts`

**Step 1: Update the create_lead_magnet recipe**

In the `create_lead_magnet` workflow recipe, update step 1 (RESEARCH) to include position synthesis:

After the existing RESEARCH step, add a new step:

```
1b. SYNTHESIZE — Get or build the user's position on the topic
   → magnetlab_execute({tool: "magnetlab_synthesize_position", arguments: {topic: "<topic-slug>"}})
   Returns thesis, stance type, key arguments, stories, data points, and differentiators.
   Use this structured position to guide all content generation — it's far richer than raw search results.
```

Also update the `write_linkedin_post` recipe similarly — add position synthesis after knowledge search.

**Step 2: Commit**

```bash
git add packages/mcp/src/tools/category-tools.ts
git commit -m "feat: update workflow recipes to include position synthesis step"
```

---

### Task 12: Unit tests for position synthesizer

**Files:**
- Create: `src/__tests__/lib/ai/position-synthesizer.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the anthropic client
vi.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: () => ({
    messages: {
      create: vi.fn(),
    },
  }),
  parseJsonResponse: vi.fn(),
}));

vi.mock('@/lib/ai/content-pipeline/model-config', () => ({
  CLAUDE_SONNET_MODEL: 'claude-sonnet-4-6',
}));

import { synthesizePosition } from '@/lib/ai/content-pipeline/position-synthesizer';
import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';
import type { KnowledgeEntry } from '@/lib/types/content-pipeline';

function mockEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2, 8)}`,
    user_id: 'user-1',
    transcript_id: 'tx-1',
    category: 'insight',
    speaker: 'host',
    content: 'Test knowledge entry content',
    context: null,
    tags: [],
    transcript_type: 'coaching',
    knowledge_type: 'insight',
    quality_score: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const MOCK_POSITION_RESPONSE = {
  thesis: 'Cold email works but only with the right infrastructure.',
  stance_type: 'contrarian',
  confidence: 0.85,
  key_arguments: ['PlusVibe over Instantly', 'Multi-channel is essential'],
  unique_data_points: [
    { claim: '1,500 emails, 3% reply rate', evidence_strength: 'measured', source_entry_index: 0 },
  ],
  stories: [
    { hook: 'We burned $2K on Instantly', arc: 'Switched to PlusVibe', lesson: 'Infrastructure matters', source_entry_index: 1 },
  ],
  specific_recommendations: [
    { recommendation: 'Use PlusVibe', reasoning: 'Better deliverability', source_entry_index: 0 },
  ],
  voice_markers: ['infrastructure matters more than copy'],
  differentiators: ['Focuses on deliverability, not templates'],
  contradictions: [],
  related_topics: ['linkedin-outreach', 'lead-generation'],
  coverage_gaps: ['No deliverability metrics'],
};

describe('synthesizePosition', () => {
  beforeEach(() => {
    vi.mocked(parseJsonResponse).mockReturnValue(MOCK_POSITION_RESPONSE);
    const client = getAnthropicClient() as { messages: { create: ReturnType<typeof vi.fn> } };
    client.messages.create.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(MOCK_POSITION_RESPONSE) }],
    });
  });

  it('returns null when fewer than 3 entries', async () => {
    const result = await synthesizePosition(
      [mockEntry(), mockEntry()],
      'cold email',
      'cold-email'
    );
    expect(result).toBeNull();
  });

  it('returns Position with correct shape for valid entries', async () => {
    const entries = [mockEntry({ id: 'e1' }), mockEntry({ id: 'e2' }), mockEntry({ id: 'e3' })];
    const result = await synthesizePosition(entries, 'cold email', 'cold-email');

    expect(result).not.toBeNull();
    expect(result!.topic).toBe('cold email');
    expect(result!.topic_slug).toBe('cold-email');
    expect(result!.thesis).toBe('Cold email works but only with the right infrastructure.');
    expect(result!.stance_type).toBe('contrarian');
    expect(result!.confidence).toBe(0.85);
    expect(result!.key_arguments).toHaveLength(2);
    expect(result!.supporting_entry_ids).toEqual(['e1', 'e2', 'e3']);
    expect(result!.entry_count).toBe(3);
    expect(result!.synthesized_at).toBeTruthy();
  });

  it('resolves source_entry_index to actual entry IDs', async () => {
    const entries = [mockEntry({ id: 'e1' }), mockEntry({ id: 'e2' }), mockEntry({ id: 'e3' })];
    const result = await synthesizePosition(entries, 'cold email', 'cold-email');

    expect(result!.unique_data_points[0].source_entry_id).toBe('e1');
    expect(result!.stories[0].source_entry_id).toBe('e2');
  });

  it('clamps confidence to 0-1 range', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({ ...MOCK_POSITION_RESPONSE, confidence: 1.5 });
    const entries = [mockEntry(), mockEntry(), mockEntry()];
    const result = await synthesizePosition(entries, 'test', 'test');
    expect(result!.confidence).toBe(1);
  });

  it('defaults invalid stance_type to experiential', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({ ...MOCK_POSITION_RESPONSE, stance_type: 'invalid' });
    const entries = [mockEntry(), mockEntry(), mockEntry()];
    const result = await synthesizePosition(entries, 'test', 'test');
    expect(result!.stance_type).toBe('experiential');
  });

  it('defaults invalid evidence_strength to anecdotal', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({
      ...MOCK_POSITION_RESPONSE,
      unique_data_points: [{ claim: 'test', evidence_strength: 'unknown', source_entry_index: 0 }],
    });
    const entries = [mockEntry(), mockEntry(), mockEntry()];
    const result = await synthesizePosition(entries, 'test', 'test');
    expect(result!.unique_data_points[0].evidence_strength).toBe('anecdotal');
  });

  it('handles empty arrays in response gracefully', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({
      thesis: 'Test',
      stance_type: 'nuanced',
      confidence: 0.5,
      key_arguments: [],
      unique_data_points: [],
      stories: [],
      specific_recommendations: [],
      voice_markers: [],
      differentiators: [],
      contradictions: [],
      related_topics: [],
      coverage_gaps: [],
    });
    const entries = [mockEntry(), mockEntry(), mockEntry()];
    const result = await synthesizePosition(entries, 'test', 'test');
    expect(result!.key_arguments).toEqual([]);
    expect(result!.stories).toEqual([]);
  });

  it('caps arrays at their maximum lengths', async () => {
    vi.mocked(parseJsonResponse).mockReturnValue({
      ...MOCK_POSITION_RESPONSE,
      key_arguments: Array(20).fill('arg'),
      voice_markers: Array(20).fill('marker'),
    });
    const entries = [mockEntry(), mockEntry(), mockEntry()];
    const result = await synthesizePosition(entries, 'test', 'test');
    expect(result!.key_arguments.length).toBeLessThanOrEqual(7);
    expect(result!.voice_markers.length).toBeLessThanOrEqual(10);
  });
});
```

**Step 2: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern=position-synthesizer`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/__tests__/lib/ai/position-synthesizer.test.ts
git commit -m "test: add unit tests for position synthesizer"
```

---

### Task Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Position type definitions | types/content-pipeline.ts |
| 2 | Database migration (cp_positions) | supabase migration |
| 3 | Core synthesizer (AI module) | position-synthesizer.ts |
| 4 | Position caching service | knowledge-brain.ts |
| 5 | Staleness hook in transcript processing | process-transcript.ts |
| 6 | Nightly synthesis cron | synthesize-positions.ts |
| 7 | Weekly full refresh | consolidate-knowledge.ts |
| 8 | API route | knowledge/position/route.ts |
| 9 | MCP tool + handler + client | packages/mcp/* |
| 10 | Enrich buildContentBrief | briefing-agent.ts |
| 11 | Update workflow recipes | category-tools.ts |
| 12 | Unit tests | position-synthesizer.test.ts |
