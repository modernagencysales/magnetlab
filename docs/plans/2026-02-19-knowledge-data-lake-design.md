# Knowledge Data Lake Design

> Approved: 2026-02-19
> Status: Design complete, pending implementation plan

## Problem

The knowledge extraction pipeline captures valuable business expertise from call transcripts, but the data model is too thin for the knowledge to be maximally useful. Only 3 categories (insight/question/product_intel), no quality scoring, no topic normalization, no deduplication, and only 2 consumption surfaces (content briefing + UI browser). The knowledge base should be a structured, searchable data lake that any downstream tool can query.

## Design Principles

- **Structure without rigidity**: Fixed universal types for the SHAPE of knowledge, flexible auto-discovered topics for the SUBJECT
- **Quality over quantity**: Every entry scored, duplicates consolidated, noise suppressed
- **Never delete, always supersede**: Full history preserved, HEAD always points to best version
- **Any tool can consume**: MCP, API, Slack, n8n, Zapier all get the same structured data

---

## 1. Enriched Knowledge Entry

### New Fields (added to cp_knowledge_entries)

```
knowledge_type    TEXT          — one of 8 fixed types
topics            TEXT[]        — 1-3 normalized topic slugs
quality_score     INTEGER       — 1-5
specificity       BOOLEAN       — contains concrete details/numbers/names?
actionability     TEXT          — immediately_actionable | contextual | theoretical
superseded_by     UUID nullable — points to newer entry that replaced this one
source_date       DATE          — when the call happened, not when extracted
```

### Knowledge Types (8 universal, fixed)

| Type | What it captures |
|------|-----------------|
| `how_to` | Process, method, steps, or technique someone can follow |
| `insight` | Strategic observation, principle, framework, or mental model |
| `story` | Specific example with outcome — client result, case study, anecdote with lesson |
| `question` | Something someone asked (or commonly asks) plus the answer if given |
| `objection` | Pushback, resistance, or concern raised — plus how it was handled |
| `mistake` | Something that went wrong, a failed approach, or a lesson from failure |
| `decision` | A choice made between alternatives, with the reasoning |
| `market_intel` | Information about competitors, market trends, pricing, or industry shifts |

These describe the SHAPE of knowledge and work for any business type.

### Quality Score Rubric (1-5)

| Score | Criteria |
|-------|----------|
| **5** | Specific + actionable + concrete details (numbers, names, timeframes) + novel |
| **4** | Specific and actionable, somewhat expected but well-articulated |
| **3** | Useful context, not immediately actionable but good to know |
| **2** | General observation, nothing surprising |
| **1** | Filler, obvious, too vague, or incomplete |

Entries scoring 1 are extracted but hidden from default results.

---

## 2. Topic Auto-Discovery & Normalization

### How It Works

1. AI extracts entry and suggests 1-3 topic labels
2. System fetches user's existing topic vocabulary
3. AI maps suggested topics to existing vocabulary or creates new ones
4. New topics get a slug, display name, and optional description

AI-based mapping is preferred over embedding similarity because short phrases like "cold email" and "outbound email sequences" are semantically identical but have mediocre embedding similarity.

### Topic Data Model

```
cp_knowledge_topics:
  id            UUID PK
  user_id       FK auth.users
  team_id       FK nullable (for shared topics)
  slug          TEXT UNIQUE per user
  display_name  TEXT
  description   TEXT nullable (AI-generated 1-liner)
  entry_count   INTEGER (denormalized)
  avg_quality   FLOAT
  first_seen    TIMESTAMP
  last_seen     TIMESTAMP
  parent_id     FK self nullable (optional hierarchy)
  created_at    TIMESTAMP
```

Replaces freeform `cp_knowledge_tags` for structured retrieval. Old tags column remains for backward compat.

---

## 3. Deduplication & Knowledge Evolution

### Three Scenarios

| Scenario | Detection | Action |
|----------|-----------|--------|
| **True duplicate** | Same speaker, embedding similarity > 0.90 | Keep higher quality, archive other via `superseded_by` |
| **Refinement** | Same speaker, similar content but new version is better | Keep refined version, link old via `superseded_by` |
| **Corroboration** | Different speakers, similar content | Keep both, create corroboration link (signal of importance) |

### Two-Phase Dedup

**Phase 1: At extraction time** — Before saving each new entry, check for near-duplicates (embedding > 0.90). Apply rules above.

**Phase 2: Weekly consolidation** — Trigger.dev scheduled task clusters entries by topic + embedding similarity (0.85), AI produces consolidated "best version" entries, originals get `superseded_by`.

### Corroboration Tracking

```
cp_knowledge_corroborations:
  id              UUID PK
  entry_id        FK cp_knowledge_entries
  corroborated_by FK cp_knowledge_entries
  created_at      TIMESTAMP
  UNIQUE(entry_id, corroborated_by)
```

Corroboration count is a retrieval signal — entries confirmed by multiple people rank higher.

### Knowledge Evolution

The `superseded_by` chain creates a history: Entry A (Jan, vague) -> Entry B (Feb, specific) -> Entry C (Mar, with data). Retrieval always returns the HEAD (latest, best version).

---

## 4. Knowledge Gap Analysis

### Coverage Matrix

For each topic, compute type distribution:

```
Topic: "Cold Email" — 39 entries, 7/8 types filled = STRONG
  how_to: 14, insight: 8, story: 3, question: 6,
  objection: 2, mistake: 5, decision: 1, market_intel: 0
```

### Gap Patterns

| Pattern | Detection | Recommendation |
|---------|-----------|----------------|
| Asked but not answered | Many `question`, few `how_to` | "Document your process for X" |
| Theory without proof | `insight` but no `story` | "Capture a case study next time" |
| All talk, no process | High count but few `how_to` | "Good SOP candidate" |
| Stale knowledge | Last entry 90+ days ago | "Is this still current?" |
| Thin but trending | New topic, last 2-3 transcripts | "Emerging — a few more calls and you'll have enough" |
| Concentration risk | One team member holds all knowledge | "Bus factor problem" |

### Gap Analysis API

```
GET /api/content-pipeline/knowledge/gaps

Returns: topics with coverage_score, type_breakdown, gaps[], overall summary
```

---

## 5. Enhanced Retrieval API

### Five Retrieval Modes

**Mode 1: Semantic Search (enhanced)**
```
GET /api/content-pipeline/knowledge?q=...&type=how_to&topic=cold-email&min_quality=3&since=2026-01-01
```

**Mode 2: Topic Summary (new, AI-powered)**
```
GET /api/content-pipeline/knowledge/topics/{slug}/summary
Returns: synthesized natural language summary of everything known about topic
```

**Mode 3: Recent Knowledge Digest (new)**
```
GET /api/content-pipeline/knowledge/recent?days=7
Returns: entries_added, new_topics, most_active_topics, quality 4+ highlights
```

**Mode 4: Knowledge Export (new)**
```
GET /api/content-pipeline/knowledge/export?topic=cold-email&format=structured
Returns: entries organized by type (processes, principles, case_studies, faq, objection_handling, lessons, decisions, market_context)
```

**Mode 5: Readiness Assessment (new)**
```
GET /api/content-pipeline/knowledge/readiness?goal=lead_magnet&topic=cold-email
Returns: ready (bool), confidence (0-1), reasoning, gaps_that_would_improve, suggested_archetypes
```

---

## 6. MCP Tools Upgrade

### Enhanced Existing
- `magnetlab_search_knowledge` — add type, topic, min_quality, since filters

### New Tools
- `magnetlab_ask_knowledge` — "What do we know about X?" -> AI-summarized answer
- `magnetlab_knowledge_gaps` — "Where are we thin?" -> gap analysis
- `magnetlab_knowledge_readiness` — "Can I write a magnet about X?" -> readiness assessment
- `magnetlab_recent_knowledge` — "What did I learn this week?" -> digest
- `magnetlab_export_knowledge` — "Export cold email knowledge" -> structured export
- `magnetlab_list_topics` — all topics with counts, quality, freshness
- `magnetlab_topic_detail` — coverage matrix, type breakdown, top entries per type

---

## 7. Team Knowledge Sharing

### Scoping

Each team member extracts knowledge independently. Entries tagged with `team_id`. Topic vocabulary shared at team level.

### Retrieval Scopes
- `personal` (default) — my knowledge only
- `team` — everyone on the team
- `team_weighted` — team knowledge, boosted for my contributions

### Team Features
- Shared topic vocabulary across team members
- Team gap analysis (who knows what, concentration risk)
- Attribution via `source_profile_id`
- Cross-member corroboration tracking

---

## 8. Migration Strategy

### Database Changes
- Add new columns to `cp_knowledge_entries` (knowledge_type, topics, quality_score, specificity, actionability, superseded_by, source_date)
- Create `cp_knowledge_topics` table
- Create `cp_knowledge_corroborations` table
- Keep old `category` and `tags` columns for backward compat

### Backfill
One-time Trigger.dev task: re-classify existing entries with new taxonomy using Claude Haiku. ~$0.01/entry.

### Rollout Phases
1. Add columns, deploy new extraction for NEW entries
2. Run backfill on existing entries
3. Update UI and API to use new fields (fallback to old)
4. Update MCP tools, add new retrieval modes
5. Deprecate old `category` field in API responses
