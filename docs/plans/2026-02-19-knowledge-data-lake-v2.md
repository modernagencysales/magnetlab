# Knowledge Data Lake v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add topic summaries, knowledge dashboard UI, knowledge-powered post writing, team sharing, and tests to the Knowledge Data Lake.

**Architecture:** Extends existing service layer (`knowledge-brain.ts`) with new functions, adds one AI module (`topic-summarizer.ts`), replaces the KnowledgeBrainTab UI with a multi-view dashboard, upgrades the autopilot briefing agent to use V2 search with quality/type awareness, and wires existing team infrastructure through API routes. All changes are in the magnetlab repo.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL + pgvector), Claude Haiku (AI), React 18, Tailwind CSS, Jest, Trigger.dev v4

---

### Task 1: Migration — add summary columns to cp_knowledge_topics

**Files:**
- Create: `supabase/migrations/20260220400000_knowledge_topic_summaries.sql`

**Step 1: Write the migration**

```sql
-- Add summary caching columns to cp_knowledge_topics
ALTER TABLE cp_knowledge_topics ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE cp_knowledge_topics ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ;
```

**Step 2: Push migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run db:push`
Expected: Migration applied successfully

**Step 3: Update TypeScript type**

Modify: `src/lib/types/content-pipeline.ts` — add to the `KnowledgeTopic` interface:

```typescript
  summary?: string | null;
  summary_generated_at?: string | null;
```

**Step 4: Update all select() calls that query cp_knowledge_topics**

These functions in `src/lib/services/knowledge-brain.ts` query `cp_knowledge_topics` and list columns explicitly. Add `summary, summary_generated_at` to their select strings:

- `listKnowledgeTopics()` (line ~172)
- `getTopicDetail()` (line ~200)
- `exportTopicKnowledge()` (line ~332)

**Step 5: Commit**

```bash
git add supabase/migrations/20260220400000_knowledge_topic_summaries.sql src/lib/types/content-pipeline.ts src/lib/services/knowledge-brain.ts
git commit -m "feat: add summary columns to cp_knowledge_topics"
```

---

### Task 2: Topic summarizer AI module

**Files:**
- Create: `src/lib/ai/content-pipeline/topic-summarizer.ts`
- Test: `src/__tests__/lib/ai/topic-summarizer.test.ts`

**Step 1: Write the test**

```typescript
/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock anthropic client
const mockCreate = jest.fn();
jest.unstable_mockModule('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: () => ({ messages: { create: mockCreate } }),
  parseJsonResponse: (text: string) => JSON.parse(text),
}));

jest.unstable_mockModule('@/lib/ai/content-pipeline/model-config', () => ({
  CLAUDE_HAIKU_MODEL: 'claude-haiku-test',
}));

const { generateTopicSummary } = await import('@/lib/ai/content-pipeline/topic-summarizer');

describe('generateTopicSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates a summary from entries grouped by type', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'This topic covers cold email strategies including...' }],
    });

    const result = await generateTopicSummary('Cold Email', {
      insight: [
        { content: 'Personalization increases reply rates by 40%', quality_score: 4 },
        { content: 'Subject lines under 5 words perform best', quality_score: 5 },
      ],
      how_to: [
        { content: 'Step 1: Research the prospect on LinkedIn', quality_score: 4 },
      ],
    });

    expect(result).toContain('cold email');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-test',
        max_tokens: 1500,
      })
    );
  });

  it('returns fallback summary when AI fails', async () => {
    mockCreate.mockRejectedValue(new Error('API error'));

    const result = await generateTopicSummary('Sales', {
      insight: [{ content: 'Test insight', quality_score: 3 }],
    });

    expect(result).toContain('Sales');
    expect(result).toContain('1 insight');
  });

  it('returns empty message for no entries', async () => {
    const result = await generateTopicSummary('Empty Topic', {});

    expect(result).toContain('no knowledge entries');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/lib/ai/topic-summarizer.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
import { getAnthropicClient } from './anthropic-client';
import { CLAUDE_HAIKU_MODEL } from './model-config';
import { logError } from '@/lib/utils/logger';

interface SummaryEntry {
  content: string;
  quality_score?: number | null;
}

/**
 * Generate a synthesized summary of all knowledge entries for a topic.
 * Groups entries by knowledge type and produces a coherent 200-400 word briefing.
 */
export async function generateTopicSummary(
  topicName: string,
  entriesByType: Record<string, SummaryEntry[]>
): Promise<string> {
  const totalEntries = Object.values(entriesByType).reduce((sum, entries) => sum + entries.length, 0);

  if (totalEntries === 0) {
    return `${topicName} has no knowledge entries yet. Process more transcripts to build knowledge on this topic.`;
  }

  // Build context from entries, prioritizing higher quality
  const sections: string[] = [];
  for (const [type, entries] of Object.entries(entriesByType)) {
    if (entries.length === 0) continue;
    const sorted = [...entries].sort((a, b) => (b.quality_score || 3) - (a.quality_score || 3));
    const label = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    sections.push(`## ${label} (${entries.length})`);
    for (const entry of sorted.slice(0, 10)) {
      sections.push(`- ${entry.content}`);
    }
  }

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Synthesize these knowledge entries about "${topicName}" into a concise briefing (200-400 words).

Organize by THEME (not by knowledge type). Include:
- Key insights and patterns
- Actionable takeaways
- Open questions or gaps
- Notable stories or examples

Do NOT use headers or bullet points — write flowing paragraphs. Reference specific knowledge when possible.

KNOWLEDGE ENTRIES:
${sections.join('\n')}`,
      }],
    });

    return response.content[0].type === 'text'
      ? response.content[0].text
      : `Summary generation failed for ${topicName}.`;
  } catch (error) {
    logError('ai/topic-summarizer', error);
    // Fallback: simple count summary
    const typeCounts = Object.entries(entriesByType)
      .filter(([, entries]) => entries.length > 0)
      .map(([type, entries]) => `${entries.length} ${type.replace(/_/g, ' ')}${entries.length > 1 ? 's' : ''}`)
      .join(', ');
    return `${topicName} contains ${totalEntries} knowledge entries: ${typeCounts}. AI summary generation is temporarily unavailable.`;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/lib/ai/topic-summarizer.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/lib/ai/content-pipeline/topic-summarizer.ts src/__tests__/lib/ai/topic-summarizer.test.ts
git commit -m "feat: add topic summarizer AI module with tests"
```

---

### Task 3: Topic summary service + API route

**Files:**
- Modify: `src/lib/services/knowledge-brain.ts` — add `generateAndCacheTopicSummary()`
- Create: `src/app/api/content-pipeline/knowledge/topics/[slug]/summary/route.ts`

**Step 1: Add service function to knowledge-brain.ts**

Add this function after `exportTopicKnowledge()`:

```typescript
import { generateTopicSummary } from '@/lib/ai/content-pipeline/topic-summarizer';

export async function generateAndCacheTopicSummary(
  userId: string,
  topicSlug: string,
  force: boolean = false
): Promise<{ summary: string; cached: boolean }> {
  const supabase = createSupabaseAdminClient();

  // Fetch topic with current summary state
  const { data: topic } = await supabase
    .from('cp_knowledge_topics')
    .select('id, slug, display_name, summary, summary_generated_at, last_seen')
    .eq('user_id', userId)
    .eq('slug', topicSlug)
    .single();

  if (!topic) throw new Error(`Topic not found: ${topicSlug}`);

  // Check if cached summary is still fresh
  if (!force && topic.summary && topic.summary_generated_at) {
    const summaryDate = new Date(topic.summary_generated_at);
    const lastSeen = new Date(topic.last_seen);
    if (summaryDate >= lastSeen) {
      return { summary: topic.summary, cached: true };
    }
  }

  // Fetch all entries for this topic, grouped by type
  const { data: entries } = await supabase
    .from('cp_knowledge_entries')
    .select('content, knowledge_type, quality_score')
    .eq('user_id', userId)
    .contains('topics', [topicSlug])
    .is('superseded_by', null)
    .order('quality_score', { ascending: false });

  const entriesByType: Record<string, Array<{ content: string; quality_score?: number | null }>> = {};
  for (const entry of entries || []) {
    const kt = entry.knowledge_type || 'unknown';
    if (!entriesByType[kt]) entriesByType[kt] = [];
    entriesByType[kt].push({ content: entry.content, quality_score: entry.quality_score });
  }

  const summary = await generateTopicSummary(topic.display_name, entriesByType);

  // Cache the summary
  await supabase
    .from('cp_knowledge_topics')
    .update({ summary, summary_generated_at: new Date().toISOString() })
    .eq('id', topic.id);

  return { summary, cached: false };
}
```

**Step 2: Create the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateAndCacheTopicSummary } from '@/lib/services/knowledge-brain';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const { searchParams } = request.nextUrl;
    const force = searchParams.get('force') === 'true';

    const result = await generateAndCacheTopicSummary(session.user.id, slug, force);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/services/knowledge-brain.ts src/app/api/content-pipeline/knowledge/topics/\[slug\]/summary/route.ts
git commit -m "feat: add topic summary generation + API route"
```

---

### Task 4: Upgrade briefing agent to V2

**Files:**
- Modify: `src/lib/ai/content-pipeline/briefing-agent.ts`
- Modify: `src/lib/types/content-pipeline.ts` — extend `ContentBrief`

**Step 1: Extend ContentBrief type**

In `src/lib/types/content-pipeline.ts`, modify the `ContentBrief` interface:

```typescript
export interface ContentBrief {
  topic: string;
  relevantInsights: KnowledgeEntryWithSimilarity[];
  relevantQuestions: KnowledgeEntryWithSimilarity[];
  relevantProductIntel: KnowledgeEntryWithSimilarity[];
  compiledContext: string;
  suggestedAngles: string[];
  // V2 fields
  topicReadiness?: number;
  topKnowledgeTypes?: KnowledgeType[];
}
```

**Step 2: Rewrite briefing-agent.ts**

Replace the entire `buildContentBrief` function and `compileContext` helper:

```typescript
import { searchKnowledgeV2 } from '@/lib/services/knowledge-brain';
import { CLAUDE_SONNET_MODEL } from './model-config';
import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import type { ContentBrief, KnowledgeEntryWithSimilarity, KnowledgeType } from '@/lib/types/content-pipeline';
import { logWarn } from '@/lib/utils/logger';

const KNOWLEDGE_TYPE_LABELS: Record<string, string> = {
  how_to: 'STEP-BY-STEP PROCESSES',
  insight: 'KEY INSIGHTS',
  story: 'REAL STORIES FROM YOUR EXPERIENCE',
  question: 'QUESTIONS YOUR AUDIENCE ASKS',
  objection: 'OBJECTIONS YOUR AUDIENCE HAS',
  mistake: 'MISTAKES TO WARN ABOUT',
  decision: 'DECISIONS & FRAMEWORKS',
  market_intel: 'MARKET INTELLIGENCE',
};

export async function buildContentBrief(
  userId: string,
  topic: string,
  options: {
    maxEntries?: number;
    includeCategories?: ('insight' | 'question' | 'product_intel')[];
    teamId?: string;
    profileId?: string;
  } = {}
): Promise<ContentBrief> {
  const { maxEntries = 20, teamId, profileId } = options;

  // Use V2 search for quality-aware retrieval
  const searchResult = await searchKnowledgeV2(userId, {
    query: topic,
    limit: maxEntries,
    threshold: 0.5,
    minQuality: 2,
    teamId,
    profileId,
  });

  if (searchResult.error) {
    logWarn('ai/briefing', 'Knowledge search error', { error: searchResult.error });
  }

  const allEntries = searchResult.entries;

  // Sort by quality score descending
  allEntries.sort((a, b) => (b.quality_score || 3) - (a.quality_score || 3));

  // Categorize by legacy categories (for backward compat)
  const insights = allEntries.filter(e => e.category === 'insight');
  const questions = allEntries.filter(e => e.category === 'question');
  const productIntel = allEntries.filter(e => e.category === 'product_intel');

  // Build V2 context using knowledge types
  const compiledContext = compileContextV2(allEntries);

  // Track which knowledge types are present
  const typeSet = new Set<KnowledgeType>();
  for (const e of allEntries) {
    if (e.knowledge_type) typeSet.add(e.knowledge_type as KnowledgeType);
  }

  // Compute readiness estimate (simple heuristic, no AI call)
  const avgQuality = allEntries.length > 0
    ? allEntries.reduce((sum, e) => sum + (e.quality_score || 3), 0) / allEntries.length
    : 0;
  const topicReadiness = Math.min(1, (allEntries.length / 15) * 0.5 + (typeSet.size / 5) * 0.3 + (avgQuality / 5) * 0.2);

  // Generate suggested angles if we have enough context
  let suggestedAngles: string[] = [];
  if (allEntries.length >= 3) {
    suggestedAngles = await generateSuggestedAngles(topic, compiledContext);
  }

  return {
    topic,
    relevantInsights: insights,
    relevantQuestions: questions,
    relevantProductIntel: productIntel,
    compiledContext,
    suggestedAngles,
    topicReadiness,
    topKnowledgeTypes: Array.from(typeSet),
  };
}

function compileContextV2(entries: KnowledgeEntryWithSimilarity[]): string {
  // Group by knowledge type
  const grouped: Record<string, KnowledgeEntryWithSimilarity[]> = {};
  for (const entry of entries) {
    const kt = entry.knowledge_type || entry.category;
    if (!grouped[kt]) grouped[kt] = [];
    grouped[kt].push(entry);
  }

  const sections: string[] = [];

  for (const [type, typeEntries] of Object.entries(grouped)) {
    const label = KNOWLEDGE_TYPE_LABELS[type] || type.toUpperCase();
    sections.push(label + ':');
    for (const entry of typeEntries.slice(0, 8)) {
      const qualityTag = (entry.quality_score || 0) >= 4 ? ' [HIGH QUALITY]' : '';
      sections.push(`- ${entry.content}${entry.context ? ` (Context: ${entry.context})` : ''}${qualityTag}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

// generateSuggestedAngles and buildContentBriefForIdea remain unchanged
```

Keep `generateSuggestedAngles` and `buildContentBriefForIdea` exactly as they are — they already call `buildContentBrief` which now uses V2.

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/ai/content-pipeline/briefing-agent.ts src/lib/types/content-pipeline.ts
git commit -m "feat: upgrade briefing agent to V2 with knowledge types + quality scoring"
```

---

### Task 5: Wire team_id through API routes

**Files:**
- Modify: `src/app/api/content-pipeline/knowledge/route.ts`
- Modify: `src/app/api/content-pipeline/knowledge/topics/route.ts`
- Modify: `src/app/api/content-pipeline/knowledge/topics/[slug]/route.ts`
- Modify: `src/app/api/content-pipeline/knowledge/gaps/route.ts`
- Modify: `src/app/api/content-pipeline/knowledge/export/route.ts`
- Modify: `src/app/api/content-pipeline/knowledge/recent/route.ts`
- Modify: `src/app/api/content-pipeline/knowledge/ask/route.ts`
- Modify: `src/lib/services/knowledge-brain.ts` — update `searchKnowledgeV2`, `listKnowledgeTopics`

**Step 1: Update searchKnowledgeV2 to support teamId**

In `src/lib/services/knowledge-brain.ts`, modify `searchKnowledgeV2()` to pass `teamId` to the team RPC when provided:

```typescript
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

    let data, error;
    if (teamId) {
      // Team-wide V2 search — use team RPC (no type/quality filters on team RPC yet, filter client-side)
      ({ data, error } = await supabase.rpc('cp_match_team_knowledge_entries', {
        query_embedding: JSON.stringify(queryEmbedding),
        p_team_id: teamId,
        p_profile_id: profileId || null,
        threshold,
        match_count: limit * 2, // fetch more, will filter client-side
      }));
    } else {
      ({ data, error } = await supabase.rpc('cp_match_knowledge_entries_v2', {
        query_embedding: JSON.stringify(queryEmbedding),
        p_user_id: userId,
        threshold,
        match_count: limit,
        p_knowledge_type: knowledgeType || null,
        p_topic_slug: topicSlug || null,
        p_min_quality: minQuality || null,
        p_since: since || null,
      }));
    }

    if (error) {
      logError('services/knowledge-brain', new Error('Enhanced search failed'), { detail: error.message });
      return { entries: [], error: error.message };
    }

    let results = (data || []) as KnowledgeEntryWithSimilarity[];

    // Client-side filters for team search (team RPC doesn't have these filters)
    if (teamId) {
      if (knowledgeType) results = results.filter(e => e.knowledge_type === knowledgeType);
      if (topicSlug) results = results.filter(e => (e.topics || []).includes(topicSlug));
      if (minQuality) results = results.filter(e => (e.quality_score || 0) >= minQuality);
      if (since) results = results.filter(e => e.source_date && e.source_date >= since);
      results = results.slice(0, limit);
    }

    if (category) results = results.filter(e => e.category === category);
    if (tags?.length) results = results.filter(e => tags.some(t => e.tags?.includes(t)));

    return { entries: results };
  }

  // Non-search browse path — team support
  const userFilter = teamId ? 'team_id' : 'user_id';
  const userValue = teamId || userId;

  let dbQuery = supabase
    .from('cp_knowledge_entries')
    .select('id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, knowledge_type, topics, quality_score, specificity, actionability, source_date, speaker_company, team_id, source_profile_id, superseded_by, created_at, updated_at')
    .eq(userFilter, userValue)
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

  const entries = (data || []).map(e => ({ ...e, similarity: 0 })) as KnowledgeEntryWithSimilarity[];
  return { entries };
}
```

**Step 2: Update listKnowledgeTopics to use teamId**

```typescript
export async function listKnowledgeTopics(
  userId: string,
  options: { teamId?: string; limit?: number } = {}
): Promise<KnowledgeTopic[]> {
  const { teamId, limit = 50 } = options;
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('cp_knowledge_topics')
    .select('id, user_id, team_id, slug, display_name, description, entry_count, avg_quality, first_seen, last_seen, parent_id, summary, summary_generated_at, created_at')
    .order('entry_count', { ascending: false })
    .limit(limit);

  if (teamId) {
    query = query.eq('team_id', teamId);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    logError('services/knowledge-brain', new Error('Failed to list topics'), { detail: error.message });
    return [];
  }

  return data || [];
}
```

**Step 3: Add team_id param to each API route**

For each route, add this line after the auth check:
```typescript
const teamId = searchParams.get('team_id') || undefined;
```

Then pass `{ teamId }` to the service calls. Apply to all 7 routes listed above.

Example for `src/app/api/content-pipeline/knowledge/topics/route.ts`:
```typescript
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const teamId = searchParams.get('team_id') || undefined;

    const topics = await listKnowledgeTopics(session.user.id, { teamId, limit });
    return NextResponse.json({ topics });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 4: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/services/knowledge-brain.ts src/app/api/content-pipeline/knowledge/
git commit -m "feat: wire team_id through knowledge API routes + service layer"
```

---

### Task 6: Knowledge Dashboard — Overview subtab

**Files:**
- Create: `src/components/content-pipeline/KnowledgeDashboard.tsx`
- Create: `src/components/content-pipeline/KnowledgeOverview.tsx`
- Modify: `src/components/content-pipeline/KnowledgeContent.tsx` — swap KnowledgeBrainTab for KnowledgeDashboard

**Step 1: Create KnowledgeDashboard.tsx**

```typescript
'use client';

import { useState } from 'react';
import { Brain, Layers, AlertTriangle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KnowledgeOverview } from './KnowledgeOverview';
import { ProfileSwitcher } from './ProfileSwitcher';

const SUBTABS = [
  { id: 'overview', label: 'Overview', icon: Brain },
  { id: 'topics', label: 'Topics', icon: Layers },
  { id: 'gaps', label: 'Gaps', icon: AlertTriangle },
  { id: 'search', label: 'Search', icon: Search },
] as const;

type SubtabId = typeof SUBTABS[number]['id'];

export function KnowledgeDashboard() {
  const [activeTab, setActiveTab] = useState<SubtabId>('overview');
  const [teamId, setTeamId] = useState<string | undefined>();

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Knowledge</h2>
            <p className="text-sm text-muted-foreground">Your AI-powered knowledge base</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProfileSwitcher />
          {/* Team toggle placeholder — wired in Task 11 */}
        </div>
      </div>

      {/* Subtab navigation */}
      <div className="mb-6 flex gap-1 rounded-lg border bg-muted/50 p-1">
        {SUBTABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'overview' && <KnowledgeOverview teamId={teamId} />}
      {activeTab === 'topics' && <div className="text-muted-foreground text-sm">Topics browser — coming in Task 7</div>}
      {activeTab === 'gaps' && <div className="text-muted-foreground text-sm">Gap analysis — coming in Task 8</div>}
      {activeTab === 'search' && <div className="text-muted-foreground text-sm">Search — coming in Task 9</div>}
    </div>
  );
}
```

**Step 2: Create KnowledgeOverview.tsx**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, TrendingUp, Hash, Star, FileText } from 'lucide-react';
import { KnowledgeEntryCard } from './KnowledgeEntryCard';

interface OverviewStats {
  entries_added: number;
  new_topics: string[];
  most_active_topics: Array<{ slug: string; display_name: string; count: number }>;
  highlights: Array<{
    id: string;
    category: 'insight' | 'question' | 'product_intel';
    content: string;
    context: string | null;
    tags: string[];
    knowledge_type?: string | null;
    quality_score?: number | null;
  }>;
}

export function KnowledgeOverview({ teamId }: { teamId?: string }) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [topicCount, setTopicCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (teamId) params.append('team_id', teamId);

      const [digestRes, topicsRes] = await Promise.all([
        fetch(`/api/content-pipeline/knowledge/recent?days=7&${params}`),
        fetch(`/api/content-pipeline/knowledge/topics?limit=1000&${params}`),
      ]);

      const digest = await digestRes.json();
      const topics = await topicsRes.json();

      setStats(digest);
      setTopicCount(topics.topics?.length || 0);
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={FileText} label="Entries (7d)" value={stats.entries_added} />
        <StatCard icon={Hash} label="Topics" value={topicCount} />
        <StatCard icon={TrendingUp} label="New Topics (7d)" value={stats.new_topics.length} />
        <StatCard icon={Star} label="Highlights (7d)" value={stats.highlights.length} />
      </div>

      {/* Most active topics */}
      {stats.most_active_topics.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Most Active Topics</h3>
          <div className="flex flex-wrap gap-2">
            {stats.most_active_topics.map((topic) => (
              <span
                key={topic.slug}
                className="rounded-full border bg-card px-3 py-1.5 text-sm"
              >
                {topic.display_name}
                <span className="ml-1.5 text-xs text-muted-foreground">({topic.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent highlights */}
      {stats.highlights.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">High-Quality Highlights</h3>
          <div className="space-y-3">
            {stats.highlights.slice(0, 5).map((entry) => (
              <KnowledgeEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
```

**Step 3: Wire KnowledgeDashboard into KnowledgeContent.tsx**

In `src/components/content-pipeline/KnowledgeContent.tsx`, replace the `KnowledgeBrainTab` dynamic import with `KnowledgeDashboard`:

Change `const KnowledgeBrainTab = dynamic(...)` to `const KnowledgeDashboard = dynamic(() => import('./KnowledgeDashboard').then(m => ({ default: m.KnowledgeDashboard })), { ... })` and swap the usage in the `ai-brain` tab render.

**Step 4: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run typecheck`

**Step 5: Commit**

```bash
git add src/components/content-pipeline/KnowledgeDashboard.tsx src/components/content-pipeline/KnowledgeOverview.tsx src/components/content-pipeline/KnowledgeContent.tsx
git commit -m "feat: add knowledge dashboard with overview subtab"
```

---

### Task 7: Knowledge Dashboard — Topics subtab

**Files:**
- Create: `src/components/content-pipeline/TopicBrowser.tsx`
- Create: `src/components/content-pipeline/TopicDetail.tsx`
- Modify: `src/components/content-pipeline/KnowledgeDashboard.tsx` — wire topics tab

**Step 1: Create TopicBrowser.tsx**

Topic card grid with entry count, avg quality, type breakdown bar, coverage score. Clicking a topic shows TopicDetail.

Key features:
- Fetch from `/api/content-pipeline/knowledge/topics`
- Each card shows: display_name, entry_count, avg_quality (stars), type breakdown (horizontal stacked bar)
- Clicking opens TopicDetail panel
- If `summary` exists on topic, show a "Has summary" badge

**Step 2: Create TopicDetail.tsx**

- Fetch from `/api/content-pipeline/knowledge/topics/[slug]`
- Shows: summary (with "Generate Summary" or "Regenerate" button), entries grouped by knowledge type, corroboration count
- Summary generation: POST to `/api/content-pipeline/knowledge/topics/[slug]/summary`
- Entries rendered using KnowledgeEntryCard

**Step 3: Wire into KnowledgeDashboard**

Replace the placeholder `{activeTab === 'topics' && ...}` with `<TopicBrowser teamId={teamId} />`.

**Step 4: Verify build + commit**

```bash
git add src/components/content-pipeline/TopicBrowser.tsx src/components/content-pipeline/TopicDetail.tsx src/components/content-pipeline/KnowledgeDashboard.tsx
git commit -m "feat: add topics browser + topic detail with summaries"
```

---

### Task 8: Knowledge Dashboard — Gaps subtab

**Files:**
- Create: `src/components/content-pipeline/GapAnalysis.tsx`
- Modify: `src/components/content-pipeline/KnowledgeDashboard.tsx` — wire gaps tab

**Step 1: Create GapAnalysis.tsx**

- Fetch from `/api/content-pipeline/knowledge/gaps`
- Gap cards: topic name, coverage score (progress bar), missing types (chips), gap patterns (text)
- Readiness panel: dropdown to pick topic, dropdown to pick goal (lead_magnet, blog_post, course, sop, content_week), "Assess Readiness" button
- Readiness result: ready/not badge, confidence %, reasoning text, gaps that would improve (list)

**Step 2: Wire into KnowledgeDashboard**

Replace the placeholder with `<GapAnalysis teamId={teamId} />`.

**Step 3: Verify build + commit**

```bash
git add src/components/content-pipeline/GapAnalysis.tsx src/components/content-pipeline/KnowledgeDashboard.tsx
git commit -m "feat: add gap analysis + readiness assessment UI"
```

---

### Task 9: Knowledge Dashboard — Search subtab

**Files:**
- Create: `src/components/content-pipeline/KnowledgeSearch.tsx`
- Modify: `src/components/content-pipeline/KnowledgeDashboard.tsx` — wire search tab

**Step 1: Create KnowledgeSearch.tsx**

Refactor from existing `KnowledgeBrainTab.tsx` — keep the same search/filter/tag UI but add V2 filters:
- Knowledge type dropdown (8 types + All)
- Topic dropdown (fetched from `/api/content-pipeline/knowledge/topics`)
- Min quality slider (1-5)
- Since date picker
- Keep existing: category, speaker, tag filters
- Keep: tag clusters, organize tags button
- Keep: manual knowledge entry button/modal

**Step 2: Wire into KnowledgeDashboard**

Replace the placeholder with `<KnowledgeSearch teamId={teamId} />`.

**Step 3: Verify build + commit**

```bash
git add src/components/content-pipeline/KnowledgeSearch.tsx src/components/content-pipeline/KnowledgeDashboard.tsx
git commit -m "feat: add enhanced search tab with V2 filters"
```

---

### Task 10: Team toggle in dashboard

**Files:**
- Modify: `src/components/content-pipeline/KnowledgeDashboard.tsx` — add team toggle

**Step 1: Add team/personal toggle**

Fetch user's team from `/api/content-pipeline/team` (or similar endpoint). If user has a team, show a toggle switch labeled "Team" / "Personal" in the header. When toggled, set `teamId` state which flows to all child components.

```typescript
// In KnowledgeDashboard header
{userTeamId && (
  <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-1">
    <button
      onClick={() => setTeamId(undefined)}
      className={cn(
        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        !teamId ? 'bg-background shadow-sm' : 'text-muted-foreground'
      )}
    >
      Personal
    </button>
    <button
      onClick={() => setTeamId(userTeamId)}
      className={cn(
        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        teamId ? 'bg-background shadow-sm' : 'text-muted-foreground'
      )}
    >
      Team
    </button>
  </div>
)}
```

**Step 2: Verify build + commit**

```bash
git add src/components/content-pipeline/KnowledgeDashboard.tsx
git commit -m "feat: add team/personal toggle to knowledge dashboard"
```

---

### Task 11: Tests — knowledge-dedup.ts

**Files:**
- Create: `src/__tests__/lib/services/knowledge-dedup.test.ts`

**Step 1: Write tests**

Mock `createSupabaseAdminClient()`. Test:
- `checkForDuplicate()`: returns `insert` when no matches, `supersede` when >0.90 same speaker, `corroborate` when >0.90 different speaker, `insert` when 0.85-0.90
- `supersedeEntry()`: calls update with correct params + userId scoping
- `recordCorroboration()`: verifies entry ownership, calls upsert

**Step 2: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/lib/services/knowledge-dedup.test.ts`

**Step 3: Commit**

```bash
git add src/__tests__/lib/services/knowledge-dedup.test.ts
git commit -m "test: add knowledge dedup service tests"
```

---

### Task 12: Tests — briefing-agent.ts

**Files:**
- Create: `src/__tests__/lib/ai/briefing-agent.test.ts`

**Step 1: Write tests**

Mock `searchKnowledgeV2()` and `getAnthropicClient()`. Test:
- `buildContentBrief()`: returns entries sorted by quality, compiles context with all 8 knowledge type labels, includes topicReadiness and topKnowledgeTypes
- `buildContentBriefForIdea()`: passes idea title + core_insight as search query
- Verify context format: entries with quality >= 4 get `[HIGH QUALITY]` tag
- Verify topicReadiness calculation: 0 entries → 0, 15+ entries with 5+ types → ~1.0
- Verify suggestedAngles: called when >= 3 entries, not called when < 3

**Step 2: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/lib/ai/briefing-agent.test.ts`

**Step 3: Commit**

```bash
git add src/__tests__/lib/ai/briefing-agent.test.ts
git commit -m "test: add briefing agent V2 tests"
```

---

### Task 13: Tests — knowledge API routes

**Files:**
- Create: `src/__tests__/api/content-pipeline/knowledge-api.test.ts`

**Step 1: Write tests**

Mock auth + service functions. Test for each route:
- 401 when unauthenticated
- Correct params passed to service functions
- team_id query param forwarded
- Response shape matches expected

Cover: gaps, readiness, export, topics, topics/[slug], topics/[slug]/summary, recent, ask

**Step 2: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/api/content-pipeline/knowledge-api.test.ts`

**Step 3: Commit**

```bash
git add src/__tests__/api/content-pipeline/knowledge-api.test.ts
git commit -m "test: add knowledge API route tests"
```

---

### Task 14: Build, deploy, update docs

**Files:**
- Modify: `CLAUDE.md` — update Knowledge Data Lake section

**Step 1: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test`
Expected: All pass

**Step 2: Typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Build**

Run: `npm run build`
Expected: Clean build

**Step 4: Deploy Trigger.dev**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy`

**Step 5: Deploy Vercel**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && vercel --prod`

**Step 6: Update CLAUDE.md**

Add to the Knowledge Data Lake section:
- Topic summaries: on-demand + cached, API route, AI module
- Knowledge Dashboard: 4 subtabs (overview, topics, gaps, search)
- Briefing agent V2: uses searchKnowledgeV2, 8 knowledge types, quality-aware
- Team sharing: team_id param on all knowledge API routes
- New files: topic-summarizer.ts, KnowledgeDashboard.tsx, KnowledgeOverview.tsx, TopicBrowser.tsx, TopicDetail.tsx, GapAnalysis.tsx, KnowledgeSearch.tsx
- New migration: 20260220400000_knowledge_topic_summaries.sql

**Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Knowledge Data Lake v2 features"
```

**Step 8: Push**

```bash
git push origin main
```
