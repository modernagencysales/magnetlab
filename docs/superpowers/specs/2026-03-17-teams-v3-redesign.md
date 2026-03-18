# Teams V3 Redesign — Excavate & Fix

**Date:** 2026-03-17
**Status:** Approved
**Scope:** magnetlab

## Problem

The teams feature conflates access control (who can work in a team) with content identity (who posts are published as). This causes:

1. **Copilot is completely broken for teams** — chat route queries `team_members.team_id` which doesn't exist. `actionCtx.teamId` is never set. Every copilot action falls back to `userId` scoping.
2. **Most copilot actions bypass team-aware repos** — raw `.eq('user_id', ctx.userId)` instead of using DataScope/repos.
3. **MCP handlers silently discard `team_id`** — validated by Zod, stripped before API calls.
4. **V1 `team_members` and V2 `team_profiles` coexist** — merged at runtime by `getMergedMemberships()`, creating confusion about which table is authoritative.
5. **No agency-to-client team linking** — can't add MAS as a team to a client's workspace.
6. **Template matching ignores performance and variety** — pure semantic similarity, no feedback loop.

## Goals

1. Separate access (members) from identity (profiles) into distinct tables
2. Enable team-to-team linking so an agency team gets automatic access to client teams
3. Fix all copilot actions and MCP tools to use proper team-scoped repos
4. Make templates soft guidance with smart multi-signal matching
5. Delete legacy code — no compatibility layers, no wrappers

## Non-Goals

- New UI for content distribution (autopilot handles it)
- Template ML/recommendation engine (simple reranking is sufficient)
- RLS rewrite for anon client (admin client usage is fine for now)

---

## Data Model

### `teams` (existing — one addition)

```sql
teams
  id              UUID PK
  owner_id        UUID FK → users       -- creator, can transfer
  name            TEXT NOT NULL
  description     TEXT
  industry        TEXT
  target_audience TEXT
  shared_goal     TEXT
  billing_team_id UUID FK → teams       -- whose plan pays. NULL = self
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

`billing_team_id`: when NULL, the team's own owner pays. When set to another team's ID, that team's owner's plan is checked for resource limits. Accessed via `getBillingTeamId(team)` helper that encapsulates the COALESCE.

### `team_members` (new — replaces access control)

```sql
team_members
  id        UUID PK DEFAULT gen_random_uuid()
  team_id   UUID FK → teams    NOT NULL
  user_id   UUID FK → users    NOT NULL
  role      TEXT NOT NULL CHECK (role IN ('owner', 'member'))
  status    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'removed'))
  joined_at TIMESTAMPTZ DEFAULT NOW()
  UNIQUE(team_id, user_id)
```

Only about access. No voice profile, no LinkedIn URL, no bio. A user either can work in this team or they can't.

### `team_profiles` (existing — stripped to identity only)

```sql
team_profiles
  id              UUID PK DEFAULT gen_random_uuid()
  team_id         UUID FK → teams    NOT NULL
  user_id         UUID FK → users    -- nullable UX link only, NOT for access control
  full_name       TEXT NOT NULL
  email           TEXT
  title           TEXT
  linkedin_url    TEXT
  bio             TEXT
  expertise_areas JSONB
  voice_profile   JSONB
  avatar_url      TEXT
  is_default      BOOLEAN DEFAULT FALSE
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed'))
  created_at      TIMESTAMPTZ DEFAULT NOW()
  updated_at      TIMESTAMPTZ DEFAULT NOW()
  UNIQUE(team_id, email)
```

**Removed from current schema:** `role`, `invited_at`, `accepted_at`. A profile is a persona — it doesn't need access control fields.

**`user_id` is a UX convenience link only.** It answers "which profile is mine?" for the UI (e.g., default "post as yourself"). It is NEVER used for access control. Access is always through `team_members` + `team_links`.

### `team_links` (new — agency-to-client relationships)

```sql
team_links
  id              UUID PK DEFAULT gen_random_uuid()
  agency_team_id  UUID FK → teams   NOT NULL
  client_team_id  UUID FK → teams   NOT NULL
  created_at      TIMESTAMPTZ DEFAULT NOW()
  UNIQUE(agency_team_id, client_team_id)
```

When this row exists, every active member of `agency_team_id` implicitly has member access to `client_team_id`. Resolved at query time — no duplicated rows. When someone joins or leaves the agency team, their access to all linked client teams updates automatically.

### `cp_post_templates` (existing — add team_id)

```sql
ALTER TABLE cp_post_templates ADD COLUMN team_id UUID REFERENCES teams(id);
```

Templates become team-scoped. Global templates (`is_global=true`) remain visible to everyone.

### What gets dropped

| Drop | Reason |
|------|--------|
| V1 `team_members` table (owner_id/member_id) | Fully replaced by new `team_members` |
| `team_profiles.role` column | Access control moved to `team_members` |
| `team_profiles.invited_at` column | Access control moved to `team_members` |
| `team_profiles.accepted_at` column | Access control moved to `team_members` |
| `getMergedMemberships()` | No V1 to merge |
| V1 team service (`team.service.ts`) | V1 API gone |
| V1 API routes (`/api/team` GET/POST/DELETE) | Replaced by V2 `/api/teams/*` |

### Unchanged tables

- `cp_pipeline_posts` — `team_profile_id` stays, now cleanly means "published as this persona"
- `cp_content_ideas` — team-scoped, shared pool (no profile assignment)
- `cp_posting_slots` — `team_profile_id` stays (per-profile schedule)
- `cp_writing_styles` — `team_profile_id` stays
- `cp_knowledge_entries`, `cp_call_transcripts`, `cp_knowledge_tags` — `team_id` stays
- `lead_magnets`, `funnel_pages`, `email_sequences`, `brand_kits` — already team-scoped correctly

---

## Access Resolution & Scoping

### `hasTeamAccess(userId, teamId)`

Single function to check if a user can work in a team:

```typescript
async function hasTeamAccess(userId: string, teamId: string): Promise<{
  access: boolean;
  role: 'owner' | 'member';
  via: 'direct' | 'team_link';
}>
```

1. **Direct check:** `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'active'`
2. **Link check:** `SELECT 'member' FROM team_links tl JOIN team_members tm ON tm.team_id = tl.agency_team_id WHERE tl.client_team_id = $1 AND tm.user_id = $2 AND tm.status = 'active'`

Direct hit → return that role. Link hit → return `member` + `via: 'team_link'`. Both miss → no access.

### `getUserTeams(userId)`

For the team switcher:

```typescript
async function getUserTeams(userId: string): Promise<Array<{
  team: Team;
  role: 'owner' | 'member';
  via: 'direct' | 'team_link';
}>>
```

```sql
SELECT t.*, tm.role, 'direct' as via
FROM team_members tm JOIN teams t ON t.id = tm.team_id
WHERE tm.user_id = $1 AND tm.status = 'active'
UNION ALL
SELECT t.*, 'member' as role, 'team_link' as via
FROM team_links tl
JOIN team_members tm ON tm.team_id = tl.agency_team_id
JOIN teams t ON t.id = tl.client_team_id
WHERE tm.user_id = $1 AND tm.status = 'active'
```

### Revised `DataScope`

```typescript
interface DataScope {
  type: 'user' | 'team';
  userId: string;         // logged-in user (always set)
  teamId?: string;        // active team context
  billingUserId?: string; // resolved from billing_team_id → owner_id
}
```

Dropped `ownerId` — replaced with `billingUserId` which follows the `billing_team_id` chain.

### `getDataScope()` changes

Same flow (read `ml-team-context` cookie), but:
- Replaces `checkTeamRole()` with `hasTeamAccess()` (handles team links)
- Resolves `billingUserId` via `billing_team_id → team.owner_id`
- New fallback: if no cookie and no API key, check for `team_id` query param and verify access via `hasTeamAccess()` (for MCP requests)

### `applyScope()` — unchanged

Still `query.eq('team_id', scope.teamId)` in team mode, `query.eq('user_id', scope.userId)` in personal mode.

### Profile helpers (identity, not access)

```typescript
async function getTeamProfiles(teamId: string): Promise<TeamProfile[]>
// Active profiles for the team — the "post as" options

async function getDefaultProfile(teamId: string): Promise<TeamProfile>
// The is_default=true profile

async function getTeamProfileIds(teamId: string): Promise<string[]>
// For scoping queries: all active profile IDs in the team
```

Pure identity lookups. No access control mixed in.

---

## Content Generation Model

### The formula: Idea × Voice × Template

Every post is the combination of three inputs:

- **Idea** — what to talk about. Shared team pool (`cp_content_ideas`). Never assigned to a profile. Reusable — the same idea can produce 5 different posts for 5 different voices.
- **Voice** — who's saying it. From `team_profiles.voice_profile` (tone, signature phrases, banned phrases, storytelling style, perspective notes) + `bio` + `expertise_areas`.
- **Template** — structural guidance. A proven post framework (hook type, narrative arc, CTA style). Soft guidance only — the AI adapts freely.

### Ideas are a shared pool

`cp_content_ideas` stays team-scoped with no `team_profile_id` assignment. Ideas are scored and reusable. A strong idea can generate posts for weeks. You need 3-5 strong ideas per week, not 25 — each person gives their own take.

### Templates as soft guidance, always

**Delete `writePostWithTemplate()` (strict mode).** One entry point: `writePost()`. Templates are always soft guidance.

The "adhere strictly to the template format" prompt is replaced with the multi-template menu:

```
STRUCTURAL INSPIRATION (3 proven formats — use elements freely, blend, or ignore):

1. "Before/After Transformation" (story) — 8.2 avg engagement
   [BOLD RESULT]  →  [BEFORE]  →  [TURNING POINT]  →  [AFTER]  →  [TAKEAWAY]

2. "Contrarian Take" (contrarian) — 7.5 avg engagement
   [CHALLENGE CONVENTION]  →  [WHY THEY'RE WRONG]  →  [THE TRUTH]  →  [PROOF]

3. "Quick Tip" (educational) — 6.8 avg engagement
   [ONE-LINE HOOK]  →  [THE TIP]  →  [WHY IT WORKS]  →  [CTA]
```

The LLM sees options, not a mandate. It can pick one, blend elements, or ignore all three.

### Template matching: shortlist + rerank

**Step 1 — Retrieve candidates (pgvector):**
Semantic search returns top 10 templates matching the idea's topic text. Already implemented via `cp_match_templates` RPC.

**Step 2 — Rerank by three signals:**

```
rerank_score = semantic_similarity * 0.4
             + performance_score   * 0.35
             + freshness_bonus     * 0.25
```

- **Semantic similarity** — from pgvector cosine distance (already have)
- **Performance score** — `avg_engagement_score` normalized to 0-1 (need feedback loop)
- **Freshness bonus** — penalize templates recently used by this specific profile. Query `cp_pipeline_posts` for "when was this template last used by profile X?" More recent = lower score. Forces variety.

**Step 3 — Pass top 3 to the LLM** as the guidance menu above.

### Template performance feedback loop (new)

The path exists but isn't wired: `cp_post_engagements` → `cp_pipeline_posts.template_id` → `cp_post_templates.avg_engagement_score`

**Nightly job:**
1. For each template used on posts with engagement data, JOIN posts → engagements
2. Calculate weighted average engagement (reactions + comments), with recency weighting
3. Update `avg_engagement_score` on the template
4. Simple aggregate query — no ML

### Autopilot team generation flow

Rewrite `runNightlyBatch()` to generate for a team:

1. Score ideas from the team's shared pool
2. For each profile with open slots:
   - Pick an idea (same idea can serve multiple profiles)
   - Retrieve top 10 templates by semantic match to the idea
   - Rerank by performance + freshness-for-this-profile (top 3)
   - Write the post: idea content + this profile's voice + template menu
3. Store `template_id` on the post (best-fit from the 3, tracked for feedback loop)

Less ideas, more mileage. 3-5 ideas per week × 5 voices × different templates = 25 unique posts that share themes but feel authentic to each person.

---

## Copilot & MCP Fixes

### ActionContext rewrite

Delete:
```typescript
interface ActionContext {
  userId: string;
  teamId?: string;
}
```

Replace:
```typescript
interface ActionContext {
  scope: DataScope;
}
```

### Copilot route changes

**`/api/copilot/chat/route.ts`** — delete the 12-line `team_members` query block. Replace:
```typescript
const scope = await getDataScope(userId);
const actionCtx: ActionContext = { scope };
```

**`/api/copilot/confirm-action/route.ts`** — same fix.

### Action rewrites

Every action that does raw Supabase queries gets replaced with repo/service calls:

| Action | Delete | Replace with |
|--------|--------|-------------|
| `list_posts` | Raw `.eq('user_id')` | `postsRepo.findPosts(scope, filters)` |
| `write_post` | Raw insert + template fetch | `postsRepo.insertPost()` + `templatesService.match()` |
| `polish_post` | Raw query/update | `postsRepo.getPost()` + `postsRepo.updatePost()` |
| `update_post_content` | Raw update | `postsRepo.updatePost()` |
| `schedule_post` | Raw update | `postsRepo.updatePost()` |
| `get_autopilot_status` | Raw queries on posts + slots | `postsRepo.findPosts()` + `slotsRepo.getSlots()` |
| `get_post_performance` | Raw query | `postsRepo.findPosts()` with engagement join |
| `get_top_posts` | Raw query | `postsRepo.findPosts()` |
| `list_templates` | Wrong columns, raw query | `templatesService.list(scope)` |
| `list_writing_styles` | Raw `.eq('user_id')` | `stylesRepo.listStyles(scope)` |
| `search_knowledge` | userId + broken teamId | `knowledgeBrain.search(scope)` |
| `generate_newsletter_email` | Missing teamId | Pass `scope` through |

Actions become thin wrappers: validate input → call repo/service with scope → format response.

### System prompt fix

`system-prompt.ts` voice profile lookup: delete `.eq('user_id', userId)`. Replace with `getDefaultProfile(scope.teamId)` in team mode, falling back to the user's linked profile in personal mode.

### MCP handler rewrite

Delete: handlers that validate `team_id` via Zod then discard it.

Replace: pass `team_id` as a query parameter to the API.

- `MagnetLabClient` methods get a `teamId?: string` parameter, append `?team_id=X` to API calls
- `getDataScope()` gets a new fallback: if no cookie and no API key, check for `team_id` query param and verify via `hasTeamAccess()`
- Handlers pass validated `team_id` through to client methods

---

## Migration Phases

### Phase 1: Schema migration (SQL)

Single atomic migration file:

1. **Create** `team_links` table
2. **Create** new `team_members` table
3. **Populate** `team_members` from existing data:
   - Team owners from `teams.owner_id`
   - Team members from `team_profiles` where `user_id IS NOT NULL AND status = 'active'`
4. **Strip** access fields from `team_profiles`: drop `role`, `invited_at`, `accepted_at`
5. **Add** `team_id` to `cp_post_templates`, backfill from user's owned team
6. **Add** `billing_team_id` to `teams`
7. **Drop** V1 `team_members` table
8. **Update** RLS policies for new `team_members` + team-scoped `team_profiles`

### Phase 2: Access layer rewrite

**Delete:**
- `team-membership.ts` (`getMergedMemberships`)
- `checkTeamRole()` in `rbac.ts`
- Team resolution blocks in copilot routes
- V1 team service (`team.service.ts`)
- V1 API routes (`/api/team` GET/POST/DELETE)

**Rewrite:**
- `hasTeamAccess()`, `getUserTeams()` — new functions
- `getDataScope()` — use `hasTeamAccess`, add `billingUserId`, add query param fallback
- `team.repo.ts` — work with new `team_members` separate from `team_profiles`
- `teams.service.ts` — add `team_links` CRUD

**New:**
- `getBillingTeamId(team)` helper

### Phase 3: Copilot & MCP rewrite

**Delete:**
- Every raw `.eq('user_id', ctx.userId)` in action files
- Old `ActionContext` interface
- `writePostWithTemplate()` strict mode
- `findBestTemplate()` single-match function

**Rewrite:**
- `ActionContext` → `{ scope: DataScope }`
- Each action → thin wrapper calling repos/services
- `system-prompt.ts` → scope-aware profile resolution
- MCP handlers → pass `team_id` through
- `MagnetLabClient` → accept optional `teamId`

### Phase 4: Template system rewrite

**Delete:**
- `writePostWithTemplate()` strict path
- `findBestTemplate()` single-match

**Rewrite:**
- Template matcher: retrieve 10 → rerank (semantic + performance + freshness) → return top 3
- `buildTemplateGuidance()` → accepts array, builds menu format
- `writePost()` → single entry point with optional template menu
- `cp_post_templates` scoping → team-aware via `applyScope`
- `list_templates` copilot action → fix column names, use service

**New:**
- Template performance feedback job (nightly aggregate)
- Freshness tracking (query recent usage per profile)

### Phase 5: Autopilot team generation

**Rewrite:**
- `runNightlyBatch()` → generate for team, iterate profiles, pick ideas, match templates per-profile, write per-voice

### Phase 6: UI updates

- Team management page → separate "Members" and "Profiles" tabs
- Add "Linked Teams" section for agency connections
- Team switcher → show linked teams with badge
- Remove UI that treats profiles as access control

---

## Key Constraints

1. **`team_profiles.user_id` is NEVER used for access control.** Access is always through `team_members` + `team_links`. The `user_id` on a profile is a UX convenience link only. Enforced by code review, not by removing the column.

2. **No raw Supabase queries in copilot actions.** Actions call repos/services with `DataScope`. Direct `.from('table').eq()` in action files is a code review rejection.

3. **Templates are always soft guidance.** No "adhere strictly" mode. One `writePost()` entry point.

4. **Team link access is resolved at query time.** No materialized rows for linked members. `hasTeamAccess()` and `getUserTeams()` handle the JOIN.

5. **Excavate and fix — no compatibility layers.** V1 `team_members` is dropped, not maintained. `getMergedMemberships()` is deleted, not deprecated. `writePostWithTemplate()` is removed, not flagged.
