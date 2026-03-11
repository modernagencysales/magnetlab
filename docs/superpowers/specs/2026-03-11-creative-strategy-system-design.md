# Creative Strategy System — Design Spec

## Problem

LinkedIn content performance is driven by format exploits — specific combinations of media type, hook pattern, and trending topics that trigger algorithmic amplification (50-100x normal reach). These exploits are discoverable by analyzing outlier posts, but the process is entirely manual today: a strategist scrolls feeds, spots winners, and shares findings over Loom videos.

The current swipe file in magnetlab is a static library of example posts. It has three problems:
1. **No ranking** — everything looks equal; users can't tell what's worth copying
2. **No context** — posts have no analysis of *why* they worked
3. **No workflow** — no path from "this worked" → "here's a reusable play" → "apply it to your next post"

## Solution

Replace the swipe file with a **Creative Strategy System** — a pipeline that automates scouting, structures analysis, validates plays through testing, and distributes proven plays to all users through the content pipeline.

### Core workflow

```
Scout (automated) → Analyze (AI + strategist) → Test (internal accounts) → Prove (data-driven) → Distribute (all users)
```

### Users

- **Content strategist** — scouts, analyzes, creates plays, manages the play board
- **Internal team** — tests plays on managed accounts, provides first-party validation data
- **SaaS users** — access proven plays in exchange for contributing anonymous performance data (opt-in gate)

### Value flywheel

Managed accounts serve as the R&D lab. Findings are productized as plays and distributed to SaaS users, increasing platform value. SaaS users' anonymous performance data accelerates play validation (crowdsourced signal across many accounts vs. testing on 2-3 internal accounts).

---

## Data Model

### New tables

#### `cs_signals` — Raw high-performing posts

Every post entering the system lands here first, regardless of source.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `source` | `'own_account' \| 'scraped' \| 'manual'` | How it was found |
| `source_account_id` | uuid, nullable | FK to connected LinkedIn account (own_account source) |
| `linkedin_url` | text, nullable, unique | Original post URL (dedup key) |
| `author_name` | text | Post author |
| `author_headline` | text, nullable | Author's LinkedIn headline |
| `author_follower_count` | int, nullable | For relative performance context |
| `content` | text | Post text |
| `media_type` | `'none' \| 'image' \| 'carousel' \| 'video' \| 'document' \| 'poll'` | Attached media type |
| `media_description` | text, nullable | AI-detected description (e.g., "tweet screenshot", "slack conversation") |
| `media_urls` | jsonb | URLs to media files |
| `impressions` | int, nullable | |
| `likes` | int | |
| `comments` | int | |
| `shares` | int, nullable | |
| `engagement_multiplier` | float, nullable | Post engagement vs. author's average |
| `niche` | text, nullable | Industry/niche tag |
| `status` | `'pending' \| 'reviewed' \| 'used' \| 'dismissed'` | Strategist workflow state |
| `ai_analysis` | jsonb, nullable | Pre-computed AI analysis |
| `submitted_by` | uuid, nullable | User who submitted (manual source) |
| `created_at` | timestamptz | |

No `user_id` — signals are a shared resource managed by the strategy team.

RLS: Super admins (`is_super_admin = true` on `users` table) can CRUD. All authenticated users can read `status IN ('reviewed', 'used')`.

#### `cs_plays` — Strategic insights

The strategist's analysis of why a format/approach delivers outsized results.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `title` | text | Play name (e.g., "Tweet Screenshot Exploit") |
| `thesis` | text | Why this works — the strategic insight |
| `exploit_type` | `'media_format' \| 'hook_pattern' \| 'topic_trend' \| 'engagement_hack' \| 'cta_pattern' \| 'composite'` | Category |
| `format_instructions` | text | How to execute this play |
| `status` | `'draft' \| 'testing' \| 'proven' \| 'declining' \| 'archived'` | Lifecycle stage |
| `visibility` | `'internal' \| 'public'` | Internal = team only, public = opted-in SaaS users |
| `niches` | text[], nullable | Which niches this applies to (null = universal) |
| `last_used_at` | timestamptz, nullable | For autopilot rotation (least-recently-used) |
| `created_by` | uuid | Strategist who created it |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

RLS: Super admins (`is_super_admin = true` on `users` table) can CRUD. Opted-in users can read `visibility = 'public'` AND `status IN ('proven', 'declining')`.

#### `cs_play_signals` — Junction table linking plays to evidence signals

| Column | Type | Purpose |
|--------|------|---------|
| `play_id` | uuid FK | FK to cs_plays (ON DELETE CASCADE) |
| `signal_id` | uuid FK | FK to cs_signals (ON DELETE CASCADE) |
| `added_at` | timestamptz | When the signal was linked |

Primary key: `(play_id, signal_id)`.

#### `cs_play_results` — Performance tracking

Tracks how each play performs when used to create actual posts. Includes both internal and anonymous SaaS user data.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `play_id` | uuid FK | FK to cs_plays |
| `post_id` | uuid FK | FK to cp_pipeline_posts |
| `account_id` | uuid, nullable | LinkedIn account (null for anonymous SaaS contributions) |
| `is_anonymous` | boolean, default false | True for SaaS user contributions |
| `baseline_impressions` | int, nullable | Account's 30-day average at time of test |
| `actual_impressions` | int, nullable | What this post achieved |
| `multiplier` | float, nullable | actual / baseline |
| `likes` | int | |
| `comments` | int | |
| `niche` | text, nullable | Account's niche (for per-niche breakdowns) |
| `tested_at` | timestamptz | |

RLS: Super admins can CRUD. System inserts for SaaS users via service role (not direct user access).

#### `cs_play_templates` — Executable format recipes

Structured templates that plug into the post writer AI.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `play_id` | uuid FK | FK to cs_plays |
| `name` | text | Template name |
| `structure` | jsonb | Post structure (hook pattern, body format, CTA style) |
| `media_instructions` | text | What media to create/attach |
| `example_output` | text | Example post using this template |
| `embedding` | vector(1536), nullable | For template matching |
| `created_at` | timestamptz | |

RLS: Same as cs_plays (readable by opted-in users for proven/public plays).

#### `cs_play_feedback` — User ratings on plays

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `play_id` | uuid FK | FK to cs_plays |
| `user_id` | uuid | Who rated (internal tracking, never exposed) |
| `rating` | `'up' \| 'down'` | Simple binary |
| `note` | text, nullable | Optional qualitative feedback |
| `created_at` | timestamptz | |

Unique constraint: `(play_id, user_id)` — one rating per user per play.

#### `cs_play_assignments` — Strategist recommendations to accounts

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `play_id` | uuid FK | FK to cs_plays |
| `user_id` | uuid | Account to try this play |
| `assigned_by` | uuid | Strategist who assigned |
| `status` | `'active' \| 'completed'` | |
| `assigned_at` | timestamptz | |
| `updated_at` | timestamptz | |

### Modified tables

| Table | Change |
|-------|--------|
| `cp_pipeline_posts` | Add `play_id uuid nullable` FK to cs_plays |
| `users` | Add `plays_data_sharing boolean default false` column |

### Config tables

#### `cs_scrape_config` — Strategist-managed scraping parameters

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `config_type` | `'own_account' \| 'watchlist' \| 'niche_discovery'` | |
| `outlier_threshold_multiplier` | float | e.g., 5.0 for own accounts |
| `min_reactions` | int | Absolute floor for external posts |
| `min_comments` | int | |
| `target_niches` | text[] | For niche discovery |
| `search_keywords` | text[] | |
| `active` | boolean | |

No `user_id` — global config managed by super admins. RLS: super admins can CRUD, no public read.

#### Watchlist

Reuse existing `signal_profile_monitors` table with a new `monitor_type` value: `'content_strategy'`. Requires a migration to alter the existing CHECK constraint:

```sql
ALTER TABLE signal_profile_monitors
  DROP CONSTRAINT signal_profile_monitors_monitor_type_check;
ALTER TABLE signal_profile_monitors
  ADD CONSTRAINT signal_profile_monitors_monitor_type_check
  CHECK (monitor_type IN ('competitor', 'influencer', 'content_strategy'));
```

The existing `signal-profile-scan` task must be updated to filter by `monitor_type` so it only processes `competitor`/`influencer` monitors (not `content_strategy` ones, which are handled by the creative strategy scraping logic).

---

## Signal Ingestion

Three input channels, all feeding into `cs_signals`.

### Channel 1: Own Account Performance (automated)

- **Source:** Unipile API for connected accounts (abstracted behind `linkedin-publisher.ts` — swappable to native LinkedIn OAuth later)
- **Task:** `scan-own-account-performance` (Trigger.dev, daily)
- **Logic:** Pull engagement stats for recent published posts → calculate multiplier against account's rolling 30-day average → posts hitting the configured threshold (default 5x) auto-create signals with `status: 'pending'`
- **AI pre-analysis** runs on insert (see Analysis section)
- **Dedup:** `linkedin_url` unique constraint

### Channel 2: External Scraping (automated)

- **Source:** Harvest API (existing `harvest-api.ts` client)
- **Two modes:**
  - **Watchlist** — extends existing `signal_profile_monitors` with `monitor_type: 'content_strategy'`. Daily task scrapes creator profiles, surfaces outlier posts.
  - **Niche discovery** — keyword/topic-based LinkedIn post search via Harvest API. Weekly frequency.
- **Tasks:** Extend existing `signal-keyword-scan` and `signal-profile-scan` to also write to `cs_signals` when posts meet engagement thresholds
- **Outlier detection for external posts:** Absolute thresholds (configurable via `cs_scrape_config`) — e.g., 500+ reactions, 50+ comments — combined with follower-relative engagement (reactions / follower count)
- **Same AI pre-analysis** as Channel 1

### Channel 3: Manual Submission

- **Source:** Strategist or user pastes a LinkedIn URL
- **UI:** Simple form — paste URL, optional notes. System scrapes post data via Harvest API to fill engagement stats and media.
- **Also available via MCP tool** for strategist working in Claude Code

---

## Analysis Workbench

Where the strategist turns raw signals into plays. AI does the grunt work, human does the judgment.

### AI Pre-Analysis (automated, on signal insert)

Trigger.dev task `analyze-signal` runs on each new signal. Stores results in `ai_analysis` jsonb:

- **Media classification** — Claude Vision on media URL: "tweet screenshot", "slack conversation", "carousel infographic", "selfie at event", "meme", etc.
- **Hook pattern detection** — "contrarian opener", "story hook", "bold claim", "question", "number-led", etc.
- **Format fingerprint** — short/long-form, line break pattern, emoji usage, CTA type, whitespace style
- **Topic/trend detection** — riding a trending topic? (e.g., "OpenAI", "layoffs", "AI tools")
- **Exploit hypothesis** — AI's best guess at why this outperformed
- **Similar plays** — vector similarity check against existing plays: "This looks like your Tweet Screenshot Exploit play"

### Strategist UI: Signal Queue

Queue-based workspace (not a dashboard), showing pending signals sorted by engagement multiplier (highest first).

Each signal card shows:
- Post preview + media thumbnail
- Engagement stats + multiplier badge
- AI-generated exploit hypothesis
- Similarity badge if it matches an existing play

Review actions per signal:
- **Create Play** — opens play form pre-filled with AI analysis
- **Add to Existing Play** — links as evidence to an existing play
- **Dismiss** — mark `status: 'dismissed'`
- **Star for Later** — mark `status: 'reviewed'`

### Play Creation Flow

When creating a play from a signal:
1. Title, thesis, exploit type — pre-filled by AI, strategist edits
2. Format instructions — strategist writes execution guide
3. AI drafts a `cs_play_template` from the signal post's structure — strategist refines
4. Play starts at `status: 'draft'`

---

## Play Board & Validation

Kanban board — the strategist's command center.

### Board columns

`Draft → Testing → Proven → Declining → Archived`

### Play card contents

- Title + exploit type badge
- Thesis (truncated, expandable)
- Evidence count ("Based on 4 signals")
- Test results ("3 tests, avg 8.2x multiplier") — once testing begins
- Usage count (posts generated using this play)
- Niches validated in
- Age (exploits decay)
- Community feedback ratio (thumbs up/down from SaaS users)

### Validation mechanics

When a play moves to `testing`:
- Every post with `play_id = this play` creates a `cs_play_results` row
- The existing `scrape-engagement` task picks up engagement stats for published posts
- Daily task `evaluate-play-results` computes:
  - **Average multiplier** across all test posts
  - **Consistency** — standard deviation (50x once + 1x twice = unreliable)
  - **Sample size** — minimum 3 test posts before promotion suggested
  - **Per-niche breakdown** — "Works 12x in B2B SaaS, only 3x in real estate"

### Auto-promotion suggestions

The system suggests status changes, the strategist confirms:
- "5 tests averaging 11x with low variance → **Suggest: Move to Proven**"
- "Last 3 posts averaged 1.8x, down from 9x → **Suggest: Move to Declining**"

Suggestions surface as badges on the play card. Strategist can override.

### Visibility gate

When moving to `proven`, strategist is prompted: "Make this visible to SaaS users?" — toggling `visibility` from `internal` to `public`.

---

## Content Pipeline Integration

### Autopilot mode (automated)

The existing `run-autopilot` task is extended:
- Before writing a post, check for `proven` plays matching the account's niche
- Rotate through plays via `last_used_at` — least-recently-used first, no spamming
- Play's `format_instructions` + `media_instructions` injected into the post writer prompt alongside existing writing style and template context
- Generated post gets `play_id` set on `cp_pipeline_posts`
- Media instructions surface as a note to the user: "This play works best with a tweet screenshot — attach one before publishing"
- Assigned plays (from `cs_play_assignments`) take priority in rotation

### Manual pick (user-initiated)

When creating a post manually:
- "Use a Play" panel shows proven plays relevant to user's niche
- Each card: title, thesis, avg multiplier, times used
- Selecting a play pre-configures the post writer + shows media guidance
- Accessible from the "What's Working Now" page (swipe file replacement)

### Strategist assignment (managed accounts)

- Strategist assigns specific plays to accounts from the Play Board
- Creates `cs_play_assignments` row
- Shows as nudge in user's content pipeline: "Your strategist recommends trying the Tweet Screenshot play this week"
- Autopilot prioritizes assigned plays

---

## Data Sharing & Distribution

### Opt-in gate

SaaS users must opt in to share anonymous performance data to access plays. No opt-in = no play access.

- Stored as `plays_data_sharing boolean default false` column on the `users` table
- **Opted in:**
  - See proven/public plays in post creation, autopilot, and "What's Working Now" page
  - Published posts with a `play_id` auto-create `cs_play_results` rows with `is_anonymous: true`, no `account_id`
  - Can submit `cs_play_feedback` (thumbs up/down + optional note)
- **Opted out:**
  - No play access — panel, page, and autopilot play integration hidden
  - No data flows back

### Performance data collection

The existing `scrape-engagement` task is extended:
- After scraping engagement for a post with a `play_id`, auto-upsert into `cs_play_results`
- Calculate `multiplier`: post engagement / account's rolling 30-day average
- For SaaS users: strip `account_id`, set `is_anonymous: true`

### "What's Working Now" page (swipe file replacement)

Replaces `/swipe-file`:
- **Proven plays** — cards sorted by avg multiplier, filterable by niche and exploit type
- Each card: title, thesis, multiplier badge, "Used by X accounts", niche tags, example signal posts
- **Play detail view:** full thesis, format instructions, example posts, performance over time, community feedback
- **"Use This Play" CTA** → drops into post creation with play pre-loaded
- **"Browse Library" tab** — old swipe file archive for raw examples (backward compat)

Only visible to users with `plays_data_sharing = true`.

---

## Technical Architecture

### Layer architecture (follows existing magnetlab pattern)

```
Route (src/app/api/creative-strategy/) → Service (src/server/services/cs-*.service.ts) → Repository (src/server/repositories/cs-*.repo.ts) → DB
  ↓
  AI modules (src/lib/ai/creative-strategy/): analyze-signal, exploit-hypothesis, media-classifier
  ↓
  Trigger.dev tasks (src/trigger/): background processing
```

All new code follows the layered architecture in `src/server/` (not `src/lib/services/` which is legacy).

### Trigger.dev tasks

| Task | Schedule | Purpose |
|------|----------|---------|
| `analyze-signal` | Triggered explicitly by the inserting code (API route or scraping task calls `tasks.trigger('analyze-signal', { signalId })` after insert) | AI pre-analysis: media classification, hook detection, exploit hypothesis |
| `evaluate-play-results` | Daily | Compute play multipliers, consistency, suggest promotions/declines |
| `scan-own-account-performance` | Daily | Pull engagement stats for own published posts, flag outliers as signals |
| `signal-keyword-scan` (extend) | Existing cron (every 12h) | Also write high-engagement posts to `cs_signals` |
| `signal-profile-scan` (extend) | Existing cron (every 10min) | Also write outlier posts from content_strategy monitors to `cs_signals` |

### API routes

```
/api/creative-strategy/signals           GET (list queue), POST (manual submit)
/api/creative-strategy/signals/[id]      PATCH (review: dismiss, star, use)
/api/creative-strategy/plays             GET (list), POST (create)
/api/creative-strategy/plays/[id]        GET, PATCH (status, visibility), DELETE
/api/creative-strategy/plays/[id]/results    GET (performance data)
/api/creative-strategy/plays/[id]/feedback   GET, POST
/api/creative-strategy/plays/[id]/assign     POST (strategist → user)
/api/creative-strategy/templates         GET, POST, PATCH, DELETE
/api/creative-strategy/config            GET, PUT (scrape config)
/api/creative-strategy/watchlist         CRUD (reuses signal monitors)
```

### UI pages

| Page | Purpose | Users |
|------|---------|-------|
| `/creative-strategy/workbench` | Signal queue + analysis | Strategist (internal) |
| `/creative-strategy/plays` | Kanban play board | Strategist (internal) |
| `/whats-working` (or `/posts?tab=plays`) | Proven plays feed — replaces swipe file | All opted-in users |
| `/swipe-file` → redirect | Points to new page | Everyone |

### MCP tools (new)

- `magnetlab_list_signals` — browse signal queue with filters
- `magnetlab_submit_signal` — manual signal submission
- `magnetlab_review_signal` — dismiss/star/use a signal
- `magnetlab_list_plays` — browse plays with filters
- `magnetlab_create_play` — create play from signal
- `magnetlab_update_play` — update play status/visibility
- `magnetlab_get_play_results` — performance data for a play
- `magnetlab_assign_play` — assign play to account

### Integration with existing systems

| System | Integration |
|--------|-------------|
| Signal Engine | Extend existing scraping tasks to also write to `cs_signals`. Reuse `signal_profile_monitors` with new `monitor_type`. Reuse `harvest-api.ts`. |
| Content Pipeline | Add `play_id` to `cp_pipeline_posts`. Extend `run-autopilot` to incorporate plays. Extend post writer prompts with play context. |
| Engagement Scraping | Extend `scrape-engagement` to auto-populate `cs_play_results` for posts with a `play_id`. |
| Swipe File | Replace primary page with "What's Working Now". Archive accessible as secondary tab. Existing `swipe_file_posts` and `swipe_file_lead_magnets` tables remain untouched. |
| LinkedIn Publishing | Auth-agnostic — works through existing `linkedin-publisher.ts` abstraction. Unipile today, native LinkedIn OAuth later. |

---

## What This Does NOT Include

- **Custom analytics dashboards** — play card stats are sufficient; no charting needed
- **Real-time feed monitoring** — scheduled tasks are appropriate for this use case
- **LinkedIn OAuth migration** — parallel workstream, abstracted behind publisher layer
- **Content pipeline rewrite** — this is a new layer on top, not a rewrite
- **AI-generated media** — media instructions tell the user what to attach; the system does not generate tweet screenshots or images

---

## Implementation Notes

### Auth model

"Strategy team" = users with `is_super_admin = true` on the `users` table. This is the existing RBAC mechanism in magnetlab. No new roles needed. RLS policies on all `cs_*` shared tables use `auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true)` for write access.

### Migration ordering

Single migration file, tables created in FK dependency order:

1. `cs_signals` (no FKs to other cs_ tables)
2. `cs_plays` (no FKs to other cs_ tables)
3. `cs_play_signals` (FKs to cs_signals + cs_plays)
4. `cs_play_results` (FKs to cs_plays + cp_pipeline_posts)
5. `cs_play_templates` (FK to cs_plays)
6. `cs_play_feedback` (FK to cs_plays)
7. `cs_play_assignments` (FK to cs_plays)
8. `cs_scrape_config` (no FKs)
9. ALTER `signal_profile_monitors` — drop + re-add `monitor_type` CHECK constraint
10. ALTER `cp_pipeline_posts` — add `play_id` column
11. ALTER `users` — add `plays_data_sharing` column

### Zod schemas (key request/response payloads)

**Signal submission (POST /api/creative-strategy/signals):**
```typescript
const SubmitSignalSchema = z.object({
  linkedin_url: z.string().url().optional(),
  content: z.string().min(1),
  author_name: z.string().min(1),
  media_urls: z.array(z.string().url()).optional(),
  niche: z.string().optional(),
  notes: z.string().optional(),
});
```

**Play creation (POST /api/creative-strategy/plays):**
```typescript
const CreatePlaySchema = z.object({
  title: z.string().min(1).max(200),
  thesis: z.string().min(1),
  exploit_type: z.enum(['media_format', 'hook_pattern', 'topic_trend', 'engagement_hack', 'cta_pattern', 'composite']),
  format_instructions: z.string().min(1),
  signal_ids: z.array(z.string().uuid()).min(1),
  niches: z.array(z.string()).optional(),
});
```

**Play update (PATCH /api/creative-strategy/plays/[id]):**
```typescript
const UpdatePlaySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  thesis: z.string().optional(),
  status: z.enum(['draft', 'testing', 'proven', 'declining', 'archived']).optional(),
  visibility: z.enum(['internal', 'public']).optional(),
  format_instructions: z.string().optional(),
  niches: z.array(z.string()).optional(),
});
```

**Play feedback (POST /api/creative-strategy/plays/[id]/feedback):**
```typescript
const PlayFeedbackSchema = z.object({
  rating: z.enum(['up', 'down']),
  note: z.string().max(500).optional(),
});
```

**Scrape config (PUT /api/creative-strategy/config):**
```typescript
const ScrapeConfigSchema = z.object({
  config_type: z.enum(['own_account', 'watchlist', 'niche_discovery']),
  outlier_threshold_multiplier: z.number().min(1).max(100),
  min_reactions: z.number().int().min(0),
  min_comments: z.number().int().min(0),
  target_niches: z.array(z.string()).optional(),
  search_keywords: z.array(z.string()).optional(),
  active: z.boolean(),
});
```

### AI model selection

| Task | Model | Rationale |
|------|-------|-----------|
| Media classification (vision) | Claude Sonnet (`claude-sonnet-4-6`) | Requires vision capabilities; Haiku lacks quality for image analysis |
| Hook pattern detection | Claude Haiku (`claude-haiku-4-5-20251001`) | Text-only classification, cost-sensitive, high volume |
| Exploit hypothesis generation | Claude Sonnet (`claude-sonnet-4-6`) | Needs reasoning quality for strategic insight |
| Similar play matching | pgvector cosine similarity | No LLM needed — reuse existing embedding infrastructure |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) | Matches existing content pipeline embedding model |

### Signal dedup

`linkedin_url` has a unique constraint but is nullable. To prevent duplicate URL-less manual submissions, the manual submit API route should require `linkedin_url` (even though the DB column is nullable — the nullable allows for edge cases in automated ingestion where URL extraction fails). The Zod schema for manual submission makes `linkedin_url` effectively required via API validation.

### Rate limits on manual submission

Manual signal submission (`POST /api/creative-strategy/signals`) is available to super admins only in v1. If opened to SaaS users later, add rate limiting: max 10 submissions per user per day (each triggers a Harvest API scrape call).

### Existing task cleanup

The `signal-keyword-scan` and `signal-profile-scan` tasks currently use `select('*')`. As part of extending them to write to `cs_signals`, refactor to use explicit column selects per project coding standards.

### MCP package

After implementing MCP tools, update `packages/mcp/`, run tests (`pnpm test`), build (`pnpm run build`), bump version in `package.json`, and publish (`npm publish --access public`).
