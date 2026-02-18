# Templates & Inspiration Pipeline Design

**Date**: 2026-02-18
**Status**: Approved

## Overview

Expand magnetlab's templates and inspiration systems into a self-improving content intelligence engine. Three pillars:

1. **Template RAG** — every post generation uses semantic matching to find the best-fitting proven template
2. **LinkedIn scraping pipeline** — Bright Data scrapes tracked creators + admin-defined searches daily, extracting winning posts and templates automatically
3. **Crowdsourced discovery** — users add creators they admire, the system scrapes their best content and surfaces templates for everyone

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Post sourcing | Bright Data | Higher volume than Unipile, no connected account needed, already have API key |
| CSV import | Direct import + AI enrichment | 110 templates enriched with descriptions, tags, use_cases, embeddings |
| Template usage in writing | Always match a template | Every post gets structural guidance via RAG; AI can go freeform if no good match |
| Discovery strategy | System list + user lists + admin searches | Crowdsourced creator tracking, admin-defined format searches |
| Winning post threshold | Relative + absolute minimum | 100+ likes floor AND top 30% of creator's posts; generous to build diverse library |
| Dual output | Both automatically | Every winning post becomes a swipe file entry AND an extracted template |
| Scrape cadence | Daily (4 AM UTC) | Aligns with existing daily-inspiration-pull cron |
| Sharing model | Scraped = shared, user-created = private | Global library grows via crowdsourcing; users keep their custom templates private |
| Architecture | Separate pipelines, shared library | Scraper and template extractor are independent Trigger.dev tasks; independent retry |

## Data Model

### Extended Tables

**`cp_post_templates`** (existing — extend):
- Add `source` enum: `user_created` | `scraped` (default: `user_created`)
- Add `is_global` boolean (default: `false`; `true` for scraped templates)
- Add `scraped_post_id` uuid FK → `cp_viral_posts.id` (nullable; links template to source post)

**`cp_viral_posts`** (existing — extend):
- Add `bright_data_id` text (dedup key for Bright Data results)
- Add `engagement_score` integer (computed: likes + comments*3 + reposts*2)
- Add `creator_id` uuid FK → `cp_tracked_creators.id` (nullable)
- Add `is_winner` boolean (default: false)
- Add `template_extracted` boolean (default: false)
- Add `source_search_id` uuid FK → `cp_scrape_searches.id` (nullable; for search-sourced posts)

### New Tables

**`cp_tracked_creators`**:
```
id              uuid PK
linkedin_url    text UNIQUE NOT NULL
name            text
headline        text
avatar_url      text
avg_engagement  float
post_count      integer DEFAULT 0
added_by_user_id uuid FK → auth.users (who first added this creator)
is_active       boolean DEFAULT true
last_scraped_at timestamptz
created_at      timestamptz DEFAULT now()
```
- Shared across all users — deduplicated by `linkedin_url`
- When user adds a creator already tracked, no duplicate created

**`cp_scrape_searches`**:
```
id                  uuid PK
query               text NOT NULL
description         text
post_format_filter  text (e.g. 'carousel', 'storytelling', 'listicle')
is_active           boolean DEFAULT true
created_at          timestamptz DEFAULT now()
```
- Admin-defined searches (configured by Tim, not end users)

**`cp_scrape_runs`**:
```
id                  uuid PK
run_type            text NOT NULL ('creator' | 'search' | 'extraction')
source_id           uuid (creator_id or search_id, nullable)
posts_found         integer DEFAULT 0
winners_found       integer DEFAULT 0
templates_extracted integer DEFAULT 0
started_at          timestamptz DEFAULT now()
completed_at        timestamptz
error_log           text
```

## Scraping Pipeline

### Task 1: `scrape-linkedin-content` (Trigger.dev, cron: 4 AM UTC daily)

1. Fetch all active creators from `cp_tracked_creators`
2. Fetch all active searches from `cp_scrape_searches`
3. For each creator — Bright Data scrape recent posts (last 7 days)
4. For each search — Bright Data LinkedIn search, collect results
5. Deduplicate against existing `cp_viral_posts` by `bright_data_id` or LinkedIn post URL
6. Compute `engagement_score` for each new post (likes + comments*3 + reposts*2)
7. Apply winner filter:
   - **Creator posts**: 100+ likes floor AND top 30% of that creator's scraped posts by engagement
   - **Search results** (no creator baseline): 200+ likes floor
8. Save all posts to `cp_viral_posts` (winners flagged `is_winner = true`, others `false` for baseline)
9. Update `cp_tracked_creators.last_scraped_at` and `avg_engagement`
10. Log run to `cp_scrape_runs`
11. Trigger Task 2 on completion

### Task 2: `extract-winning-templates` (Trigger.dev, triggered after scrape OR on-demand)

1. Query `cp_viral_posts WHERE is_winner = true AND template_extracted = false`
2. For each winning post (batched 3 at a time):
   a. Run `extractTemplateFromPost()` (Claude) → name, category, structure, use_cases, tags
   b. Generate embedding via `generateEmbedding(createTemplateEmbeddingText(template))`
   c. Insert into `cp_post_templates` with `source = 'scraped'`, `is_global = true`, `scraped_post_id` linked
   d. Insert into `swipe_file_posts` (full post text, author, engagement metrics)
   e. Mark viral post `template_extracted = true`
3. Log run to `cp_scrape_runs`

## RAG Integration

### New Supabase RPC: `cp_match_templates`

```sql
CREATE FUNCTION cp_match_templates(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int DEFAULT 3,
  min_similarity float DEFAULT 0.3
)
RETURNS TABLE (id uuid, name text, category text, structure text, use_cases jsonb, tags text[], similarity float)
AS $$
  SELECT id, name, category, structure, use_cases, tags,
         1 - (embedding <=> query_embedding) AS similarity
  FROM cp_post_templates
  WHERE is_active = true
    AND (is_global = true OR user_id = match_user_id)
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) >= min_similarity
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$
```

### Modified Post-Writing Flow (all paths)

```
idea/topic text
    │
    ▼
generateEmbedding(idea text)
    │
    ▼
cp_match_templates(embedding, user_id, count=3, min_similarity=0.3)
    │
    ▼
If matches found: AI picks best fit from top 3
If no matches: proceed freeform (current behavior)
    │
    ▼
writePostWithTemplate() — template as soft structural guidance
```

Applies to: `writePostFreeform()` (merged into template-aware flow), `quickWrite()`, `run-autopilot`, `autopilot-batch`, `write-post-from-idea`.

The prompt instructs the AI: "Here's a proven template structure. Use it as inspiration for the post's structure, but adapt freely to the specific topic and voice."

## CSV Seed Import (110 Templates)

One-time script to bootstrap the global library:

1. Parse CSV: `TItle` → name, `Template` → structure, `Funnel Stage` → tags, `Original Post` → example_posts
2. AI enrichment (Claude, batched 5 at a time):
   - Generate `description` (1-2 sentences)
   - Generate `tags` (topic + format tags)
   - Generate `use_cases` (3-5 scenarios)
   - Classify `category` (from existing enum)
3. Generate embeddings for each template
4. Insert with `source = 'scraped'`, `is_global = true`
5. Deduplicate by name similarity (CSV has some near-duplicates)

## UI Changes

### Templates Tab (`/posts?tab=templates`)

1. **Two-section layout**: "Global Library" (scraped, read-only browse) + "My Templates" (user CRUD)
2. **Semantic search bar**: Type a topic → RAG search across all templates → show results with similarity score
3. **Enhanced cards**: Source badge (scraped/user), engagement stats from original post, usage count
4. **"Use This Template" button**: Opens post writer pre-loaded with template

### Inspiration Tab (`/posts?tab=inspiration`)

1. **Scraped winners feed**: Recent winning posts from tracked creators, filterable by creator/engagement/topic
2. **"Track This Creator" button**: One-click to add creator to tracked list from any post
3. **"Extract Template" button**: Already exists — now on inspiration feed items too

### New: Tracked Creators Section (within Templates or Inspiration)

1. **Creator list**: All tracked creators, avg engagement, post count, last scraped
2. **Add creator**: LinkedIn URL input, auto-deduplicates
3. **Creator stats**: Winning posts found, templates extracted

### Post Writer — No UI Changes

Template matching happens automatically. Writer gets better structural guidance without extra clicks.

## Key Files to Modify

**New files:**
- `src/trigger/scrape-linkedin-content.ts` — Bright Data scraping task
- `src/trigger/extract-winning-templates.ts` — Template extraction task
- `src/lib/integrations/bright-data-linkedin.ts` — Bright Data LinkedIn API client
- `src/lib/ai/content-pipeline/template-matcher.ts` — RAG matching logic
- `src/components/content-pipeline/GlobalTemplateLibrary.tsx` — Global library UI
- `src/components/content-pipeline/TrackedCreators.tsx` — Creator management UI
- `src/components/content-pipeline/TemplateSearch.tsx` — Semantic search component
- `src/app/api/content-pipeline/creators/route.ts` — Creator CRUD API
- `src/app/api/content-pipeline/scrape-searches/route.ts` — Search config API
- Migration SQL for new tables + column additions

**Modified files:**
- `src/lib/ai/content-pipeline/post-writer.ts` — Add template RAG lookup to all paths
- `src/lib/ai/content-pipeline/quick-writer.ts` — Add template matching
- `src/trigger/run-autopilot.ts` — Template matching in autopilot loop
- `src/trigger/write-post-from-idea.ts` — Template matching
- `src/components/content-pipeline/TemplatesTab.tsx` — Global vs private sections
- `src/components/swipe-file/SwipeFileContent.tsx` — Scraped winners feed
- `src/lib/ai/embeddings.ts` — Ensure template embedding functions are solid
- `src/app/api/content-pipeline/templates/route.ts` — Support global template queries
