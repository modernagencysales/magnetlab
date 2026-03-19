# Ingredients Mixer — Design Spec

> **Date:** 2026-03-19
> **Status:** Draft
> **Repo:** magnetlab
> **Scope:** Redesign content creation UX around a combinatorial ingredient mixer

## Problem

Content creation primitives (Knowledge, Exploits, Styles, Templates, Creatives, Trends, Recycled Posts) are scattered across 3 pages + Settings. Users must navigate between Knowledge, Inspo, Posts (Ideas/Library tabs), and Settings (Writing Styles) to understand what they have and create content. There is no unified "create content from ingredients" flow. The backend already supports combinatorial generation (`magnetlab_generate_post` accepts any mix of ingredient IDs) but the UI doesn't expose it.

## Users

Agency operators writing LinkedIn posts on behalf of clients. Not necessarily technical. Each has their own workflow preferences. They want quality posts at scale, switching rapidly between client profiles.

## One-Sentence Summary

Pick ingredients, get content.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Page approach | Step-by-step mixer (not dashboard, not pantry) | Most intuitive for non-technical agency operators |
| Ingredient selection | Slide-over drawer with smart suggestions | Gives room for search, filters, performance data. Inline expand too cramped for 13+ items |
| Knowledge selection | Topic-based + semantic search | Users don't pick individual entries. They express intent ("Sales Objections") and the system finds relevant knowledge |
| Smart suggestions | Show only when performance data exists | Cold-start problem: random suggestions erode trust. No data = no suggestion, just sorted list |
| Generate output | Drafts primary, Ideas secondary | Agency operators want output, not more decisions. Ideas path available for deliberate work |
| Results display | Inline below mixer | Stay in context. Tweak recipe and regenerate without navigating away |
| Prompt architecture | New mixer assembly layer above existing writing quality layer | Existing LinkedIn writing guidance, banned phrases, hook rules, voice injection are battle-tested. Only the ingredient combination context is new |
| Feedback loop | Combo tracking with weighted scoring | No ML. Rank combos by engagement multiplier, penalize overuse, boost unused ingredients |
| Page naming | "Posts" in sidebar, mixer is the creation method | Users know what posts are. "Ingredients" is an internal concept, not a page name |

## Prerequisites

- The exploit-driven content migration (`20260319100000_exploit_driven_content.sql`) must be applied before the `cp_mix_recipes` migration. The mixer depends on `cp_exploits` and `cp_creatives` tables.

## Architecture

### Page Structure

The Posts page (`/posts`) becomes the primary content creation surface. It contains the mixer at the top. Pipeline, Calendar, Autopilot, and Content Queue move to a new Pipeline page (`/pipeline`) in the Distribute section.

#### Posts Page Zones (top to bottom)

**Zone 1 — The Mixer**

Ingredient tiles displayed as horizontal chips. Each tile has three states:
- **Unselected:** dashed border, dimmed, shows ingredient type name only
- **Selected:** solid colored border, shows type + selected item name + ✕ to deselect
- **Loading:** pulse animation while drawer fetches data

Tapping an unselected tile opens the ingredient drawer (Sheet component). Tapping a selected tile reopens the drawer to change selection. Tapping ✕ deselects without opening drawer.

Below the tiles: optional instructions text field + Generate buttons.
- **Primary:** "Generate Drafts" — produces 2-3 full LinkedIn post drafts
- **Secondary:** "Generate Ideas instead" — produces 3-5 idea cards (title + hook + angle)

Minimum 1 ingredient required to generate. No maximum.

**Zone 2 — Suggested Recipes**

Horizontal scrollable row of recipe cards. Each card shows:
- Ingredient type icons used in the combo
- Combo name (e.g. "Authority + Knowledge")
- Performance multiplier (e.g. "3.2x")
- Usage context (e.g. "Sarah's top combo · 12 posts")

Tapping a recipe card auto-fills the mixer tiles with those ingredients.

Special card: "Surprise me" — selects a smart combo the user hasn't tried recently. Uses weighted algorithm (not random).

Only shown when profile has performance data. Hidden for brand new profiles.

**Zone 3 — Your Inventory**

Grid of cards (4 columns on desktop) showing ingredient counts and health:
- Type icon + count number + type label
- Health badge: "healthy" (green), "12 new" (amber), "active" (green), or nothing
- Sub-label: "12 topics", "3 top performers", "1 active", etc.

Final card: "+ Add transcript or creative" — quick upload action.

"Manage →" link at section header opens full management view for all ingredients.

Clicking an individual inventory card opens that ingredient type's management drawer.

**Zone 4 — Inline Results (after generation)**

When user hits Generate Drafts:
1. Mixer collapses to a compact recipe summary bar showing selected ingredients as chips, with "Edit recipe" and "Regenerate" links
2. Results appear below: 2-3 draft cards with LinkedIn-style preview
3. Best draft gets "AI Pick" badge
4. Each draft has actions: "Send to Queue →" (sends to Pipeline as draft), "Edit first" (opens post editor), clipboard copy
5. Bulk action: "Send all to Queue →→"
6. Unhappy path: "Regenerate" or "tweak recipe" — stays on page
7. Suggested recipes + inventory dim but remain visible below for next round

When user hits Generate Ideas:
- Same flow but results are idea cards (title, hook, angle, relevance score)
- Generated ideas are persisted to `cp_content_ideas` with `status: 'extracted'` and linked to the `cp_mix_recipes` row via the recipe's `post_ids` array (overloaded for ideas too, or a separate `idea_ids` column)
- Each idea card has "Write Draft from this →" action which populates the mixer with the idea as context and regenerates as a draft

**Existing Ideas:** Users with saved ideas from the old Ideas tab can access them via a "Saved Ideas" section below the inventory. This section shows a count badge ("23 saved ideas") and expands to a filterable list. Each idea has "Write Draft from this →" to feed it into the mixer. This section is hidden when no saved ideas exist.

### Ingredient Drawer

Reusable Sheet component that opens from the right when tapping any ingredient tile. Consistent structure across all 7 types:

**Header:** Icon + "Pick a [Type]" + count available + close button

**Smart Suggestion (conditional):** Only shown when performance data exists for this profile.
- Amber "SUGGESTED" badge + reason ("Based on Sarah's top posts")
- Item name + performance stats + "Best paired with" hint
- "Use this" button for one-tap selection

**No-data fallback:** Dashed border placeholder: "Suggestions appear after a few published posts. We'll learn what works best for this client."

**Search bar:** Text input for filtering/searching items.

**Filter chips:** Type-specific filters (e.g. Exploits: All, Top, Regular, Lead Mag).

**Item list:** Scrollable list of items. Each shows:
- Name + description
- Performance stats when available (multiplier + usage count)
- "Best paired with" hint when available
- For Knowledge: topics with entry counts instead of individual entries

**Type-specific variations:**

| Type | Drawer content | Selection model |
|------|---------------|-----------------|
| Exploit | List of exploit patterns with performance | Pick one |
| Knowledge | Topics (clustered) + semantic search bar. Type a query or pick a topic | Pick one topic or type freeform query |
| Style | List of extracted voice profiles | Pick one |
| Template | List of structural formats with examples | Pick one |
| Creative | Scanned/pasted examples with scores | Pick one |
| Trend | This week's trending topics from scanned content | Pick one |
| Recycled | Eligible past posts with original performance | Pick one |

### Inventory Management

Each inventory card opens a management drawer/view for that ingredient type. This absorbs the functionality from the pages being removed:

| Ingredient | Management actions (from drawer) |
|------------|----------------------------------|
| Knowledge | Upload transcript (Grain/Fireflies/Fathom/manual), browse topics, view entries, semantic search (AI Brain functionality) |
| Exploits | Browse exploits, view stats. Exploits are mostly global/read-only |
| Styles | Extract from LinkedIn URL, browse styles, set active style, delete |
| Templates | Browse library (global + user-created), create new template |
| Creatives | Review queue (approve/dismiss), paste new creative, run scanner, configure scanner sources |
| Trends | View this week's trends. Read-only (derived from creatives) |
| Recycled | View eligible posts, filter by performance. Repost/cousin generation |

### Sidebar Changes

**Before:**
```
Home (ungrouped)

── Plan ──
Knowledge
Inspo

── Create ──
Lead Magnets
Pages
Posts
Email

── Edit ──
Content Queue

── Distribute ──
Campaigns
Signals
Leads

Bottom: Team, Docs, Help, Settings
```

**After:**
```
Home (ungrouped)

── Create ──
Posts              ← mixer + inventory + inline results
Lead Magnets       ← content + pages merged (Pages removed as separate item)
Email

── Distribute ──
Pipeline           ← kanban, calendar, autopilot, content queue
Campaigns
Signals
Leads

Bottom: Team, Docs, Help, Settings (unchanged)
```

Changes:
- Home stays ungrouped at top (unchanged)
- Plan section removed entirely (Knowledge + Inspo absorbed into Posts)
- Edit section removed (Content Queue moves to Pipeline)
- Pages merged into Lead Magnets (standalone pages accessible within Lead Magnets)
- Pipeline is new (absorbs Pipeline/Calendar/Autopilot tabs from old Posts + Content Queue)
- Bottom nav unchanged (Team, Docs, Help, Settings)
- `CreateNewDropdown` component updated: "New Page" link → `/lead-magnets/new`, "Quick Write" link → `/posts?quick_write=1` (unchanged)

### Routes

| Route | Purpose | Replaces |
|-------|---------|----------|
| `/posts` | Mixer page — create content from ingredients | Old `/posts` (minus Pipeline/Calendar/Autopilot/Ideas/Library) |
| `/pipeline` | Content distribution — kanban, calendar, autopilot, content queue | Old Posts Pipeline/Calendar/Autopilot tabs + `/content-queue` |
| `/magnets` | Lead magnet + pages combined (keeps existing route) | Old `/magnets` + `/pages` |
| *(removed)* `/knowledge` | Redirect to `/posts` | — |
| *(removed)* `/inspo` | Redirect to `/posts` | — |
| *(removed)* `/pages` | Redirect to `/magnets` | — |
| *(removed)* `/content-queue` | Redirect to `/pipeline` | — |

## Prompt Architecture

### Layers (bottom to top)

```
┌─────────────────────────────────────────┐
│ 4. Polish Layer (existing)              │
│    AI pattern detection, hook scoring,  │
│    auto-rewrite if issues found         │
├─────────────────────────────────────────┤
│ 3. Voice Layer (existing)              │
│    buildVoicePromptSection() — tone,    │
│    vocabulary, banned phrases, edit     │
│    patterns, approved examples          │
├─────────────────────────────────────────┤
│ 2. Writing Quality Layer (existing)     │
│    LinkedIn best practices, forbidden   │
│    patterns, hook requirements,         │
│    formatting rules, 43 banned phrases  │
├─────────────────────────────────────────┤
│ 1. Mixer Assembly Layer (NEW)           │
│    Ingredient context, combination      │
│    instructions, role definitions       │
└─────────────────────────────────────────┘
```

### Mixer Assembly Layer (new)

The mixer builds a NEW prompt pipeline. It does NOT wrap `primitives-assembler.ts` (which is a flat prompt builder without layered architecture). The mixer's `buildMixerPrompt()` function constructs the full prompt by composing the layers described above: mixer ingredient context → writing quality guidelines (from `post-writer.ts` base style) → voice section → output format. The existing `primitives-assembler.ts` remains for backward compatibility with `magnetlab_generate_post` but is not called by the mixer.

Builds context for the selected ingredients:

```
You are generating a LinkedIn post by combining specific ingredients
selected by the user. Each ingredient contributes a different dimension:

[If Exploit selected]
## FORMAT — Use this proven post structure
Name: {exploit.name}
Description: {exploit.description}
Examples: {exploit.example_posts}
Follow this format's hook pattern and structural flow.

[If Knowledge selected]
## SUBSTANCE — Draw on this expertise
Topic: {topic.name}
Relevant entries:
{entries[].content + context}
Use specific facts, numbers, stories, and quotes from this knowledge.
Do not make up facts — only use what is provided.

[If Style selected]
## VOICE — Match this writing style
Build from cp_writing_styles.style_profile (StyleProfile type).
Note: StyleProfile and TeamVoiceProfile are different types.
The mixer must transform StyleProfile fields into a voice prompt section:
  - StyleProfile.tone → tone line
  - StyleProfile.banned_phrases → banned phrases line
  - StyleProfile.signature_phrases → signature phrases
  - StyleProfile.hook_patterns → hook guidance
  - StyleProfile.formatting → formatting rules
  - StyleProfile.example_posts → approved examples
If the profile also has a TeamVoiceProfile (from team_profiles.voice_profile),
merge both — TeamVoiceProfile takes precedence on conflicts.
Implementation: new buildMixerVoiceSection(styleProfile?, teamVoiceProfile?)
that unifies both sources.

[If Template selected]
## STRUCTURE — Follow this skeleton
{template.structure}
{template.example_posts}

[If Creative selected]
## INSPIRATION — Riff on this example
{creative.content_text}
Use this as inspiration for angle/topic. Do not copy it.

[If Trend selected]
## TIMING — Tie into this trending topic
Topic: {trend.topic}
Context: {trend.context}
Make the connection natural, not forced.

[If Recycled selected]
## REMIX — Reimagine this previous post
Original: {post.content}
Original performance: {post.engagement_stats}
Create a fresh take — same core insight, different angle/hook.

[If Instructions provided]
## ADDITIONAL DIRECTION
{user_instructions}

Generate {count} drafts. Each should combine the above ingredients
into a cohesive LinkedIn post. More ingredients = more constrained
and distinctive output.
```

### Writing Quality Addition

One addition to the existing base style guidelines in `post-writer.ts`:

```
Formatting:
- Line breaks between most sentences. Not necessarily every sentence,
  but most. LinkedIn is read on mobile — dense paragraphs get skipped.
```

### Prompt Flow

```
User selects ingredients in mixer UI (or agent calls magnetlab_mix)
  → Mixer assembly layer builds ingredient context
  → Writing quality layer adds LinkedIn best practices
  → Voice layer adds client-specific style (if Style ingredient selected)
  → Claude generates {count} drafts
  → Polish layer checks for AI patterns, scores hooks, rewrites if needed
  → Results returned to UI or MCP caller
```

## MCP / Agent Interface

### New Tools

| Tool | Parameters | Returns |
|------|-----------|---------|
| `magnetlab_get_ingredient_inventory` | `team_profile_id` | Counts + health per ingredient type. What agents check first. |
| `magnetlab_get_suggested_recipes` | `team_profile_id`, `limit?` | Top combos with performance multipliers, sorted by effectiveness. |
| `magnetlab_mix` | `team_profile_id`, `exploit_id?`, `knowledge_topic?`, `knowledge_query?`, `style_id?`, `template_id?`, `creative_id?`, `trend_topic?`, `recycled_post_id?`, `idea_id?` (expand existing idea), `hook?` (custom opening line), `instructions?`, `count?` (default 3), `output?` ("drafts" | "ideas", default "drafts") | Array of draft posts or idea cards. |
| `magnetlab_get_combo_performance` | `team_profile_id`, `limit?` | Historical combo data: which ingredient combinations produced best-performing posts. |

### Agent Workflow (DFY Automation)

```
1. magnetlab_get_ingredient_inventory(profile_id)
   → "47 knowledge, 13 exploits, 3 styles, 87 creatives..."

2. magnetlab_get_suggested_recipes(profile_id)
   → [{combo: "Authority + Knowledge", multiplier: 3.2, posts: 12}, ...]

3. magnetlab_mix({
     team_profile_id: "...",
     exploit_id: "...",
     knowledge_topic: "sales-objections",
     style_id: "...",
     count: 3,
     output: "drafts"
   })
   → [draft1, draft2, draft3]

4. magnetlab_create_post(best_draft)
   → Post created in pipeline as draft
```

### Scoping

All mixer operations are scoped by `team_profile_id`. Ingredient lookups resolve the owning `user_id` and `team_id` from the team profile to query the correct data:
- `cp_exploits`: filtered by `user_id` OR `is_global = true`
- `cp_creatives`: filtered by `user_id` or `team_id`
- `cp_writing_styles`: filtered by `team_profile_id`
- `cp_post_templates`: filtered by `user_id` or `team_id` or `is_global = true`
- `cp_knowledge_entries`: filtered by `team_profile_id`

The mixer service resolves `team_profile_id → user_id, team_id` once at the start and passes the appropriate scope to each ingredient query.

### Existing Tools (unchanged)

All existing MCP tools remain. `magnetlab_generate_post` stays as a lower-level tool. `magnetlab_mix` wraps it with the mixer assembly layer and recipe tracking.

## Feedback Loop

### Data Collection

**New table: `cp_mix_recipes`**

```sql
CREATE TABLE cp_mix_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_profile_id UUID NOT NULL REFERENCES team_profiles(id),
  exploit_id UUID REFERENCES cp_exploits(id) ON DELETE SET NULL,
  knowledge_topic TEXT,
  knowledge_query TEXT,
  style_id UUID REFERENCES cp_writing_styles(id) ON DELETE SET NULL,
  template_id UUID REFERENCES cp_post_templates(id) ON DELETE SET NULL,
  creative_id UUID REFERENCES cp_creatives(id) ON DELETE SET NULL,
  trend_topic TEXT,
  recycled_post_id UUID REFERENCES cp_pipeline_posts(id) ON DELETE SET NULL,
  instructions TEXT,
  output_type TEXT NOT NULL DEFAULT 'drafts' CHECK (output_type IN ('drafts', 'ideas')),
  post_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cp_mix_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own mix recipes"
  ON cp_mix_recipes FOR ALL
  USING (team_profile_id IN (
    SELECT id FROM team_profiles WHERE team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_mix_recipes_profile ON cp_mix_recipes(team_profile_id);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON cp_mix_recipes
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

Note: `post_ids` is a UUID array — Postgres cannot enforce FK constraints on array elements. Dangling references are possible if posts are deleted. This is an accepted trade-off; a join table (`cp_mix_recipe_posts`) would add complexity for minimal benefit at current scale. If this becomes a problem, migrate to a join table later.

Every mixer generation (UI or MCP) inserts a row. When a draft is sent to the pipeline, `post_ids` is updated (and `updated_at` is set).

### Performance Computation

When posts accumulate engagement data, combo performance is computed:

1. Join `cp_mix_recipes.post_ids` → `cp_pipeline_posts` → `cp_post_engagements`
2. Compute average engagement per combo (group by ingredient combination)
3. Compare to profile baseline (average engagement across all posts)
4. Result: multiplier (e.g. 3.2x means this combo gets 3.2x the average)

### Suggestion Algorithm (V1)

Weighted scoring, no ML:

```
combo_score = (
  performance_multiplier * 0.5        // reward what works
  + recency_penalty * 0.2             // penalize overuse (diminishing returns)
  + novelty_bonus * 0.2               // boost unused ingredient combos
  + freshness_bonus * 0.1             // boost combos with fresh ingredients (new creatives, trends)
)
```

- **Performance multiplier:** Engagement vs baseline. New combos default to 1.0x.
- **Recency penalty:** -0.1 per use in last 7 days. Prevents audience fatigue.
- **Novelty bonus:** +0.5 if combo has never been used. +0.3 if an ingredient has unreviewed items.
- **Freshness bonus:** +0.3 if a trend is < 3 days old or creative is < 7 days old.

For new profiles: fall back to global averages across all profiles using the same exploit.

### Where Suggestions Surface

- Suggested Recipes row on Posts page (Zone 2)
- Smart suggestion card at top of each ingredient drawer
- `magnetlab_get_suggested_recipes` MCP tool
- "Best paired with" hint on individual ingredient items in drawer

## Migration Plan

### Pages Absorbed

| Source | Destination | Data Migration |
|--------|------------|----------------|
| `/knowledge` — AI Brain tab | Posts → Knowledge inventory card → management drawer (semantic search, topic browse) | None — same data, new UI surface |
| `/knowledge` — Transcripts tab | Posts → Knowledge inventory "+" tile → upload drawer | None |
| `/inspo` — Queue tab | Posts → Creatives inventory card → management drawer (review queue) | None |
| `/inspo` — Exploits tab | Posts → Exploits inventory card → drawer | None |
| `/inspo` — Recycle tab | Posts → Recycled inventory card → drawer | None |
| `/inspo` — Trends tab | Posts → Trends inventory card → drawer | None |
| Posts → Ideas tab | Removed. Existing ideas kept in DB. Accessible via "Saved Ideas" filter or archived | No data deleted |
| Posts → Library tab | Posts → Templates inventory card → drawer | None |
| Settings → Writing Styles | Posts → Styles inventory card → drawer (includes extract from URL) | None |
| Posts → Pipeline tab | `/pipeline` (new page) | None — same component, new route |
| Posts → Calendar tab | `/pipeline` — Calendar tab | None |
| Posts → Autopilot tab | `/pipeline` — Autopilot tab | None |
| `/content-queue` | `/pipeline` — Content Queue tab or filter | None |
| `/pages` | Merged into `/lead-magnets` | None — same data |

### Redirects

Old routes redirect to prevent broken bookmarks:
- `/knowledge` → `/posts`
- `/inspo` → `/posts`
- `/pages` → `/magnets`
- `/content-queue` → `/pipeline`
- `/magnets` route stays as-is (no rename to `/lead-magnets`)

### Database Changes

- **New table:** `cp_mix_recipes` (combo tracking for feedback loop)
- **No existing tables modified or deleted**
- **No data migrations** — all existing data stays in place, accessed from new UI surfaces

### Component Changes

**New components:**
- `IngredientTile` — selectable chip with 3 states
- `IngredientDrawer` — reusable Sheet with search, filters, suggestion
- `RecipeCard` — suggested combo card for horizontal scroll
- `DraftResultCard` — LinkedIn-preview draft with actions
- `InventoryCard` — count + health badge card
- `MixerBar` — collapsed recipe summary bar (post-generation)

**Reused components (moved, not rewritten):**
- `KnowledgeBrainTab` → Knowledge drawer content
- `TranscriptsTab` → Knowledge upload drawer
- `InspoQueueTab` → Creatives management drawer
- `InspoExploitsTab` → Exploits management drawer
- `InspoRecycleTab` → Recycled management drawer
- `InspoTrendsTab` → Trends management drawer
- `LibraryTab` → Templates management drawer
- `StylesSection` → Styles management drawer
- `PipelineView` → Pipeline page
- `CalendarView` → Pipeline page
- `AutopilotTab` → Pipeline page
- `IdeasTab` → Archived or "Saved Ideas" section

**Deleted pages (replaced by redirects):**
- `/knowledge/page.tsx`
- `/inspo/page.tsx`
- `/pages/page.tsx`
- `/content-queue/page.tsx`

### API Changes

**New endpoints:**
- `GET /api/content-pipeline/inventory` — ingredient counts + health per profile
- `GET /api/content-pipeline/recipes` — suggested combos with performance
- `POST /api/content-pipeline/mix` — the core mixer endpoint
- `GET /api/content-pipeline/combo-performance` — historical combo data

**Existing endpoints unchanged.** All current routes continue working.

### Risk Mitigation

- **Existing Ideas:** Not deleted. Kept in `cp_content_ideas`. Surfaced via "Saved Ideas" section or search. Users who relied on Ideas tab can still access their data.
- **Bookmarks:** Old routes redirect to new locations.
- **MCP backward compatibility:** `magnetlab_generate_post` remains. `magnetlab_mix` is additive.
- **Rollback:** Old pages can be restored by reverting sidebar config and removing redirects. No feature flag system exists; rollback is via git revert.

## Out of Scope

- ML-based suggestion algorithm (V1 uses weighted scoring)
- Automated scanner scheduling (exists, unchanged)
- Content recycling automation (repost/cousin — stubs exist, not part of this work)
- Prompt A/B testing infrastructure
- Multi-profile batch generation ("generate for 4 clients at once")
- Performance dashboard page (data surfaces in suggestions, no dedicated analytics view yet)
