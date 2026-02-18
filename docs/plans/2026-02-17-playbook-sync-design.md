# Playbook Sync — Living Wiki Design

**Date:** 2026-02-17
**Status:** Approved

## Problem

We extract valuable knowledge from calls in magnetlab (insights, questions, product intel) but this knowledge stays siloed in the database. Meanwhile, our Docusaurus playbooks at `modernagencysales/playbooks` contain 42 SOPs across 8 modules that should evolve with what we learn. We need an automated bridge.

## Solution

A weekly Trigger.dev task (`playbook-sync`) in magnetlab that:
1. Reads new knowledge entries since the last run
2. Semantically matches them to existing SOPs
3. Generates additive-only edits (tips, examples, lessons)
4. Creates new SOPs when enough unmatched knowledge accumulates
5. Commits changes to the playbooks repo via GitHub API

## Architecture

```
WEEKLY CRON (Sun 00:00 UTC) — Trigger.dev: playbook-sync
    │
    ├─ 1. FETCH WINDOW
    │    cp_playbook_sync_runs → last successful run_at
    │    cp_knowledge_entries  → WHERE created_at > last_run
    │
    ├─ 2. LOAD SOPs
    │    GitHub API: GET docs/**/*.md
    │    cp_sop_embeddings → cache hit or re-embed (content hash)
    │
    ├─ 3. MATCH (per entry)
    │    Cosine similarity → top 3 SOPs per entry
    │    Threshold: >= 0.75 strong, 0.60-0.74 weak, < 0.60 no match
    │
    ├─ 4. CLASSIFY (per match) — Claude Opus 4.6
    │    enrich / redundant / tangential
    │    Log to cp_knowledge_sop_matches
    │
    ├─ 5a. ENRICH — Claude Opus 4.6
    │    Generate additive edits (callouts, bullets)
    │    insight → :::tip From the Field
    │    question → :::warning Common Question
    │    product_intel → :::info callout
    │
    ├─ 5b. CLUSTER ORPHANS — Claude Sonnet
    │    Tags + similarity grouping
    │    >= 3 entries → new SOP via Opus 4.6
    │
    ├─ 6. COMMIT TO GITHUB
    │    Single commit with structured changelog message
    │
    └─ 7. LOG RUN
         cp_playbook_sync_runs → advance window
```

## Model Selection

| Task | Model | Rationale |
|------|-------|-----------|
| Classification (enrich/redundant/tangential) | Opus 4.6 | Core judgment call — must understand SOP context deeply |
| Edit generation (callouts, bullets) | Opus 4.6 | Quality of written knowledge is the whole point |
| New SOP creation | Opus 4.6 | Structural decisions + writing quality |
| Orphan clustering (tag grouping) | Sonnet | Mechanical grouping, not judgment-heavy |
| Embedding text formatting | Sonnet | Lightweight text prep |
| SOP embedding generation | OpenAI text-embedding-3-small | Reuses existing infrastructure |

## Database Tables

### cp_sop_embeddings
| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| file_path | text | e.g. `docs/sops/module-4/sop-4-3-write-cold-email-copy.md` |
| content_hash | text | SHA-256 of file content — re-embed on change |
| embedding | vector(1536) | OpenAI text-embedding-3-small |
| title | text | From frontmatter |
| module | text | Extracted from path (e.g. `module-4`) |
| updated_at | timestamptz | Last embedded |

### cp_playbook_sync_runs
| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| run_at | timestamptz | When the sync ran |
| entries_processed | int | Total knowledge entries in window |
| entries_enriched | int | Matched and used |
| entries_redundant | int | Already covered |
| entries_orphaned | int | No match, queued |
| sops_enriched | text[] | List of SOP files modified |
| sops_created | text[] | List of new SOP files |
| commit_sha | text | GitHub commit hash |
| commit_message | text | Full changelog |
| status | text | success / partial / failed |
| error_log | text | Error details if any |

### cp_knowledge_sop_matches
| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| knowledge_entry_id | uuid | FK to cp_knowledge_entries |
| sop_file_path | text | NULL if orphaned |
| similarity_score | float | Cosine similarity |
| action | text | enrich / redundant / tangential / orphaned |
| edit_summary | text | What was added (if enriched) |
| sync_run_id | uuid | FK to cp_playbook_sync_runs |
| created_at | timestamptz | |

## Matching Logic

1. **Embed** each knowledge entry using the same OpenAI model
2. **Compare** against all cached SOP embeddings via cosine similarity
3. **Threshold**: >= 0.75 = strong match candidate
4. **Classify** (Opus 4.6): AI sees full SOP + knowledge entry, returns structured JSON:
   - `enrich`: knowledge adds new value to this SOP
   - `redundant`: already covered
   - `tangential`: similar topic but wrong SOP
5. **Orphans** accumulate across runs. Clustered by tag overlap + mutual similarity. Cluster of 3+ entries triggers new SOP creation.

## Edit Generation Rules

Hard constraints enforced in the AI prompt:

1. **Never modify or delete existing text** — only insert new blocks
2. Use Docusaurus callout syntax (`:::tip`, `:::warning`, `:::info`)
3. Source attribution: "From the Field" (coaching) or "From Sales Calls" (sales)
4. **1-3 sentences max** per insertion
5. Combine multiple entries for the same SOP section into a single callout
6. Place insertions immediately after the most relevant existing content

### Insertion by category:

| Category | Section | Format |
|----------|---------|--------|
| insight | Nearest step or "Key Principles" | `:::tip From the Field` |
| question | "Common Mistakes" or relevant step | `:::warning Common Question` |
| product_intel | "Why This Matters" or relevant step | `:::info` callout |

## New SOP Template

```markdown
---
id: sop-{module}-{number}-{slug}
title: "SOP {module}.{number}: {Title}"
---

# SOP {module}.{number}: {Title}

:::info Auto-Generated
This SOP was created from patterns identified across multiple coaching
and sales calls. It will continue to evolve as new knowledge is captured.
:::

## Overview
{AI-generated from clustered knowledge entries}

## Steps
{AI-structured from insights}

## Key Lessons
{Drawn from the knowledge entries}
```

## Commit Strategy

- One commit per run
- Structured changelog in commit message
- GitHub fine-grained PAT with `contents: write` on playbooks repo

## Failure Handling

- GitHub commit failure: retry once, then log as `failed`
- Individual AI call failure: skip entry, mark run as `partial`
- Knowledge window only advances on `success` or `partial` — never on `failed`
- Entries from failed runs are reprocessed next time

## File Locations

| Component | Path |
|-----------|------|
| Trigger.dev task | `src/trigger/playbook-sync.ts` |
| AI prompts | `src/lib/ai/playbook-sync/` |
| Embedding reuse | Existing `src/lib/ai/content-pipeline/embeddings.ts` |

## Env Vars (Trigger.dev)

- `GITHUB_TOKEN` — fine-grained PAT for playbooks repo
- `OPENAI_API_KEY` — already set
- `ANTHROPIC_API_KEY` — already set

## Cost Estimate

~$0.50–1.50 per weekly run based on ~16 knowledge entries/week and 42 SOPs.
