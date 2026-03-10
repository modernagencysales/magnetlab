# Knowledge Position Synthesis Layer — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cached synthesis layer between RAG retrieval and content generation that extracts structured understanding of the user's unique position on a topic — enabling every brain-connected feature downstream.

**Architecture:** Event-driven staleness + nightly cron synthesis. Positions cached in `cp_positions` table. Content generation consumers receive Positions (structured) instead of raw knowledge fragments (text dump).

**Tech Stack:** TypeScript, Claude Sonnet (LLM synthesis), Supabase (PostgreSQL + pgvector), Trigger.dev (cron), Vitest

---

## Core Concept

Positions are cached, structured understandings of what a user believes about a topic. They sit between raw knowledge entries and content generation.

```
Layer 1: Knowledge Store        (exists — raw entries with embeddings)
Layer 2: Position Synthesis     (NEW — cached, structured understanding per topic)
Layer 3: Content Generation     (exists — but now receives Positions, not raw text)
```

## Position Schema

```typescript
interface Position {
  topic: string;                    // "cold email infrastructure"
  topic_slug: string;               // "cold-email-infrastructure"
  thesis: string;                   // 2-3 sentence core position
  stance_type: 'contrarian' | 'conventional' | 'nuanced' | 'experiential';
  confidence: number;               // 0-1 based on entry count + consistency + evidence quality

  key_arguments: string[];          // 3-5 main supporting points

  unique_data_points: Array<{
    claim: string;                  // "1,500 cold emails sent, 3% reply rate, 33 positives"
    evidence_strength: 'anecdotal' | 'observed' | 'measured';
    source_entry_id: string;
  }>;

  stories: Array<{                  // Extracted narrative hooks for content
    hook: string;                   // "We burned $2K on Instantly before finding what works"
    arc: string;                    // Brief narrative description
    lesson: string;                 // What it teaches
    source_entry_id: string;
  }>;

  specific_recommendations: Array<{
    recommendation: string;         // "Use PlusVibe instead of Instantly"
    reasoning: string;              // "Better deliverability, simpler pricing"
    source_entry_id: string;
  }>;

  voice_markers: string[];          // Characteristic phrases/metaphors they use
  differentiators: string[];        // What makes this different from generic advice

  contradictions: Array<{           // Internal tensions (evolved thinking, context-dependent)
    tension: string;
    resolution?: string;
  }>;

  related_topics: string[];         // Cross-topic connections
  coverage_gaps: string[];          // What's missing from their knowledge

  supporting_entry_ids: string[];
  entry_count: number;
  synthesized_at: string;
}
```

## File Locations

```
src/lib/ai/content-pipeline/
  position-synthesizer.ts          # Core synthesis function (LLM call)

src/lib/types/content-pipeline.ts  # Position interface

src/lib/services/knowledge-brain.ts # getCachedPosition(), markPositionsStale()

src/trigger/
  synthesize-positions.ts          # Nightly Trigger.dev task

supabase/migrations/
  YYYYMMDD_position_synthesis.sql  # cp_positions table

packages/mcp/
  src/tools/knowledge.ts           # magnetlab_synthesize_position tool
  src/handlers/knowledge.ts        # Handler wiring
  src/client.ts                    # Client method
```

## Cron Strategy: Event-Driven Staleness + Nightly Synthesis

1. **When transcript processing completes** (`process-transcript.ts`), after topic stats are updated, mark affected topics' positions as `is_stale = true`

2. **Nightly cron** (piggyback on existing 2 AM UTC batch) re-synthesizes only stale positions. Cost: ~$0.03 per synthesis (Sonnet). Active user with 5 stale topics/week ≈ $0.15/week.

3. **On-demand fallback**: If content generation requests a Position that's stale or missing, synthesize inline before generating.

4. **Weekly full refresh** (piggyback on Sunday 3 AM `consolidate-knowledge`) — full re-synthesis of all positions to catch drift.

## Database

```sql
CREATE TABLE cp_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_slug TEXT NOT NULL,
  topic_label TEXT NOT NULL,
  position JSONB NOT NULL,
  entry_ids TEXT[] NOT NULL,
  entry_count INT NOT NULL DEFAULT 0,
  is_stale BOOLEAN NOT NULL DEFAULT false,
  synthesized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, topic_slug)
);

CREATE INDEX idx_cp_positions_stale ON cp_positions(user_id) WHERE is_stale = true;
```

## Integration with Existing System

`buildContentBrief()` becomes a thin wrapper:
- Calls `getCachedPosition(topic)` instead of raw entry search
- `compiledContext` generated from Position's structured fields
- `suggestedAngles` become Position's `key_arguments`
- Readiness score becomes Position's `confidence`
- Existing consumers keep working — no breaking changes

## MCP Exposure

New tool: `magnetlab_synthesize_position` — so Claude Code can ask "what's my position on cold email?" during brainstorming/ideation.

## Testing

- Unit test Position schema parsing from LLM response
- Unit test staleness marking on entry creation
- Unit test getCachedPosition() — cached when fresh, synthesize when stale
- Cold email integration test: verify contrarian stance, PlusVibe recommendation, real campaign data, multi-channel philosophy
