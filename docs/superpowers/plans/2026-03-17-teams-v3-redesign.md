# Teams V3 Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate team access control from content identity, enable agency-to-client team linking, fix all copilot/MCP team scoping, and make templates soft guidance with smart matching.

**Architecture:** Split V2 `team_profiles` into `team_members` (access) + `team_profiles` (identity). Add `team_links` for agency relationships. Rewrite all copilot actions to use DataScope-aware repos. Consolidate template matching into shortlist+rerank pipeline.

**Tech Stack:** Supabase (PostgreSQL, pgvector), Next.js 15, TypeScript, Trigger.dev v4, Jest

**Spec:** `docs/superpowers/specs/2026-03-17-teams-v3-redesign.md`

---

## Dependency Graph

```
Task 1 (Migration) → Task 2 (Types) → Task 3 (Repo) → Task 4 (Access Layer)
                                                            ↓
                                          ┌─────────────────┼──────────────────┐
                                          ↓                 ↓                  ↓
                                     Task 5 (Delete V1)  Task 6 (Links API)  Task 7 (Teams API)
                                          ↓
                                     Task 8 (ActionContext + Routes)
                                          ↓
                                   ┌──────┼──────┐
                                   ↓      ↓      ↓
                              Task 9   Task 10  Task 11 (System Prompt)
                              (Actions  (Actions
                               batch 1) batch 2)
                                   ↓
                              Task 12 (MCP)
                                   ↓
                            ┌──────┼──────┐
                            ↓             ↓
                      Task 13          Task 14
                      (Template        (Post Writer
                       Matcher)         Consolidation)
                            ↓             ↓
                      Task 15          Task 16
                      (Feedback Job)   (Autopilot)
                            ↓
                      Task 17 (UI: Team Mgmt)
                            ↓
                      Task 18 (UI: Switcher + Sidebar)
```

---

### Task 1: SQL Migration

**Files:**
- Create: `supabase/migrations/20260317100000_teams_v3_redesign.sql`

**Context:** Read the spec section "Phase 1: Schema migration (SQL)" for exact SQL. Read existing migrations for patterns: `supabase/migrations/20260212000000_teams_v2.sql` (233 lines), `supabase/migrations/20260217000000_multi_team.sql` (26 lines).

- [ ] **Step 1: Write the migration file**

Write `supabase/migrations/20260317100000_teams_v3_redesign.sql` following the spec's 11-step SQL exactly:

1. `ALTER TABLE team_members RENAME TO team_members_v1_legacy;`
2. Create `team_links` (with `idx_team_links_client` index) + new `team_members`
3. Populate `team_members` — owners from `teams`, members from `team_profiles` with `ON CONFLICT DO NOTHING`
4. Verify no orphaned V1 members (RAISE WARNING)
5. Strip `role`, `invited_at`, `accepted_at` from `team_profiles`
6. Add `team_id` to `cp_post_templates`, backfill with `DISTINCT ON (owner_id)` oldest team
7. Add `team_id` to `cp_content_ideas`, backfill from `team_profiles.team_id`
8. Add `billing_team_id` to `teams` (`ON DELETE SET NULL`)
9. Rewrite `cp_match_templates` RPC — change `match_user_id` → `match_team_id`, WHERE uses `team_id` not `user_id`
10. `DROP TABLE team_members_v1_legacy;`
11. RLS policies per spec table (team_members, team_profiles, team_links, cp_post_templates)

For the `cp_match_templates` RPC rewrite, read the existing RPC in `supabase/migrations/20260218300000_templates_inspiration_pipeline.sql` to match the RETURNS TABLE signature exactly.

- [ ] **Step 2: Verify migration syntax**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm db:push --dry-run 2>&1 | head -50`

If `db:push --dry-run` isn't available, verify by reading through the SQL manually for syntax errors. Check: FK references use correct table names, UNIQUE constraints don't conflict, column types match.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260317100000_teams_v3_redesign.sql
git commit -m "feat: add Teams V3 migration — split members/profiles, add team_links"
```

---

### Task 2: Type Definitions

**Files:**
- Modify: `src/lib/types/content-pipeline.ts` (TeamProfile, Team, PostTemplate types)
- Modify: `src/lib/utils/team-context.ts:6-11` (DataScope interface only — do NOT rewrite functions yet)
- Modify: `src/lib/actions/types.ts` (ActionContext)

**Context:** Read `src/lib/types/content-pipeline.ts` for current type shapes. Read `src/lib/utils/team-context.ts:1-15` for DataScope. Read `src/lib/actions/types.ts` for ActionContext.

- [ ] **Step 1: Write tests for new type shapes**

Create `src/__tests__/lib/types/team-types.test.ts`:

```typescript
// Test that TeamProfile no longer has role/invited_at/accepted_at
// Test that TeamMember interface exists with team_id, user_id, role, status, joined_at
// Test that TeamLink interface exists with agency_team_id, client_team_id
// Test that DataScope has billingUserId instead of ownerId
// Test that ActionContext uses scope: DataScope
// Test that Team has billing_team_id
// Test that PostTemplate has team_id
```

Use type-level tests (e.g., `const _check: TeamMember = { ... }` that fail compile if types are wrong).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --testPathPattern="team-types" --no-coverage`

- [ ] **Step 3: Update type definitions**

In `src/lib/types/content-pipeline.ts`:
- Remove `role`, `invited_at`, `accepted_at` from `TeamProfile` interface (~line 175-194)
- Add `TeamMember` interface: `{ id, team_id, user_id, role: 'owner' | 'member', status, joined_at }`
- Add `TeamLink` interface: `{ id, agency_team_id, client_team_id, created_at }`
- Add `billing_team_id?: string` to `Team` interface (~line 117-127)
- Add `team_id?: string` to `PostTemplate` interface (~line 523-538)

In `src/lib/utils/team-context.ts`:
- Change `DataScope.ownerId` → `DataScope.billingUserId` (lines 6-11 only)

In `src/lib/actions/types.ts`:
- Change `ActionContext` from `{ userId, teamId? }` to `{ scope: DataScope }`
- Import `DataScope` from `@/lib/utils/team-context`

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test -- --testPathPattern="team-types" --no-coverage && pnpm typecheck 2>&1 | head -30`

Expect: type tests pass. Typecheck will show errors in files that use the old shapes — that's expected, we fix those in later tasks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/content-pipeline.ts src/lib/utils/team-context.ts src/lib/actions/types.ts src/__tests__/lib/types/team-types.test.ts
git commit -m "feat: update type definitions for Teams V3 — TeamMember, TeamLink, revised DataScope"
```

---

### Task 3: Team Repository Rewrite

**Files:**
- Modify: `src/server/repositories/team.repo.ts` (432 lines — major rewrite)

**Context:** Read the full `src/server/repositories/team.repo.ts`. Read the spec sections "Access Resolution & Scoping" and "Profile helpers." Read `src/server/repositories/posts.repo.ts` for the DataScope + applyScope pattern to follow.

- [ ] **Step 1: Write tests for hasTeamAccess**

Create `src/__tests__/server/repositories/team-repo.test.ts`:

```typescript
// Mock Supabase admin client
// Test hasTeamAccess: direct member returns { access: true, role, via: 'direct' }
// Test hasTeamAccess: team_link member returns { access: true, role: 'member', via: 'team_link' }
// Test hasTeamAccess: no access returns { access: false }
// Test hasTeamAccess: direct takes precedence over link
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --testPathPattern="team-repo" --no-coverage`

- [ ] **Step 3: Implement hasTeamAccess**

In `team.repo.ts`, add:
```typescript
export async function hasTeamAccess(userId: string, teamId: string): Promise<{
  access: boolean; role: 'owner' | 'member'; via: 'direct' | 'team_link';
}>
```
Two queries: direct check on `team_members`, then link check via `team_links` JOIN `team_members`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --testPathPattern="team-repo" --no-coverage`

- [ ] **Step 5: Write tests for getUserTeams**

Add to the same test file:
```typescript
// Test getUserTeams: returns direct memberships
// Test getUserTeams: returns linked teams
// Test getUserTeams: deduplicates (UNION not UNION ALL)
```

- [ ] **Step 6: Implement getUserTeams**

In `team.repo.ts`, add `getUserTeams(userId)` using the UNION query from the spec.

- [ ] **Step 7: Run tests**

Run: `pnpm test -- --testPathPattern="team-repo" --no-coverage`

- [ ] **Step 8: Write tests for member CRUD**

```typescript
// Test addMember(teamId, userId, role)
// Test removeMember(teamId, userId) — sets status='removed'
// Test listMembers(teamId)
```

- [ ] **Step 9: Implement member CRUD**

Add `addMember`, `removeMember`, `listMembers` functions. These operate on the new `team_members` table (NOT `team_profiles`).

- [ ] **Step 10: Write tests for team_links CRUD**

```typescript
// Test createTeamLink(agencyTeamId, clientTeamId)
// Test deleteTeamLink(linkId)
// Test listTeamLinks(teamId) — returns links where team is agency or client
```

- [ ] **Step 11: Implement team_links CRUD**

Add `createTeamLink`, `deleteTeamLink`, `listTeamLinks`.

- [ ] **Step 12: Write tests for profile helpers**

```typescript
// Test getTeamProfiles(teamId) — returns active profiles only
// Test getDefaultProfile(teamId) — returns is_default=true
// Test getTeamProfileIds(teamId) — returns string[]
```

- [ ] **Step 13: Implement profile helpers**

Separate from access control. Pure identity lookups.

- [ ] **Step 14: Run all tests + typecheck**

Run: `pnpm test -- --testPathPattern="team-repo" --no-coverage && pnpm typecheck 2>&1 | head -30`

- [ ] **Step 15: Commit**

```bash
git add src/server/repositories/team.repo.ts src/__tests__/server/repositories/team-repo.test.ts
git commit -m "feat: rewrite team.repo — hasTeamAccess, getUserTeams, member/link CRUD, profile helpers"
```

---

### Task 4: Access Layer Rewrite

**Files:**
- Modify: `src/lib/utils/team-context.ts` (192 lines — rewrite getDataScope, getScopeForResource, requireTeamScope)
- Modify: `src/lib/auth/rbac.ts` (60 lines — rewrite checkTeamRole → use hasTeamAccess)
- Modify: `src/lib/auth/plan-limits.ts` (95 lines — billingUserId resolution)

**Context:** Read all three files fully. Read the spec section "Access Resolution & Scoping" for new behavior. Read `src/server/repositories/team.repo.ts` for the functions you'll call.

- [ ] **Step 1: Write tests for revised getDataScope**

Create `src/__tests__/lib/utils/team-context-v3.test.ts`:

```typescript
// Test getDataScope with team cookie → returns team scope via hasTeamAccess
// Test getDataScope with no cookie, requestTeamId param → returns team scope
// Test getDataScope with no cookie, no requestTeamId, multi-team user → returns personal mode
// Test getDataScope resolves billingUserId via billing_team_id chain
// Test getDataScope with API key → resolves via team membership
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --testPathPattern="team-context-v3" --no-coverage`

- [ ] **Step 3: Rewrite getDataScope**

Change signature: `getDataScope(userId: string, requestTeamId?: string)`
- Replace `checkTeamRole()` calls with `hasTeamAccess()`
- Add `billingUserId` resolution: `team.billing_team_id ? billingTeam.owner_id : team.owner_id`
- Add `requestTeamId` fallback for MCP requests
- Multi-team ambiguity: return `type: 'user'` (not random pick)

- [ ] **Step 4: Rewrite getScopeForResource and requireTeamScope**

Both swap `checkTeamRole` for `hasTeamAccess`. `getScopeForResource` now resolves access through team links.

- [ ] **Step 5: Rewrite checkTeamRole in rbac.ts**

Replace the body to delegate to `hasTeamAccess()` from `team.repo.ts`. Keep the function signature for now (callers migrated in later tasks) but internals use the new access check.

- [ ] **Step 6: Add getBillingTeamId to plan-limits.ts**

```typescript
export function getBillingTeamId(team: Team): string {
  return team.billing_team_id ?? team.id;
}
```
Update `checkResourceLimit` to use `billingUserId` from DataScope instead of `ownerId`.

- [ ] **Step 7: Run all tests**

Run: `pnpm test -- --testPathPattern="team-context" --no-coverage && pnpm typecheck 2>&1 | head -30`

- [ ] **Step 8: Commit**

```bash
git add src/lib/utils/team-context.ts src/lib/auth/rbac.ts src/lib/auth/plan-limits.ts src/__tests__/lib/utils/team-context-v3.test.ts
git commit -m "feat: rewrite access layer — getDataScope with team links, billingUserId, requestTeamId"
```

---

### Task 5: Delete V1 Legacy Code

**Files:**
- Delete: `src/lib/utils/team-membership.ts` (114 lines)
- Delete: `src/server/services/team.service.ts` (148 lines)
- Delete: `src/app/api/team/route.ts` (57 lines)
- Delete: `src/app/api/team/memberships/route.ts` (22 lines)
- Delete: `src/app/api/team/[id]/route.ts` (50 lines)
- Delete: `src/app/api/team/[id]/activity/route.ts` (30 lines)
- Modify: Any files that import from deleted modules (find with grep)

**Context:** Grep for imports of deleted modules before deleting.

- [ ] **Step 1: Find all importers**

Run: `grep -r "team-membership" src/ --include="*.ts" --include="*.tsx" -l` and `grep -r "team.service" src/server/ --include="*.ts" -l` and `grep -r "from.*api/team" src/frontend/ --include="*.ts" -l`

- [ ] **Step 2: Update importers to use new functions**

For each file that imports `getMergedMemberships` or V1 team service functions, replace with calls to `getUserTeams()` from `team.repo.ts` or `teams.service.ts`.

- [ ] **Step 3: Delete V1 files**

```bash
rm src/lib/utils/team-membership.ts
rm src/server/services/team.service.ts
rm -rf src/app/api/team/
```

- [ ] **Step 4: Delete related tests**

Find and remove any tests for V1 team_members operations.

- [ ] **Step 5: Typecheck + test**

Run: `pnpm typecheck && pnpm test --no-coverage`

All tests must pass. If something breaks, it means a dependency was missed — fix it.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: delete V1 team_members code — team-membership.ts, team.service.ts, /api/team routes"
```

---

### Task 6: Team Links API Routes

**Files:**
- Create: `src/app/api/teams/links/route.ts`
- Create: `src/app/api/teams/links/[id]/route.ts`
- Modify: `src/server/services/teams.service.ts` (add team_links service methods)

**Context:** Read existing `src/app/api/teams/route.ts` and `src/app/api/teams/profiles/route.ts` for route patterns. Read the spec section "team_links API routes."

- [ ] **Step 1: Write tests for team links service methods**

Create `src/__tests__/server/services/team-links.test.ts`:

```typescript
// Test createTeamLink — agency owner can create
// Test createTeamLink — non-owner rejected
// Test deleteTeamLink — either team's owner can delete
// Test listTeamLinks — returns links for owned teams
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Add service methods to teams.service.ts**

`createTeamLink(userId, agencyTeamId, clientTeamId)`, `deleteTeamLink(userId, linkId)`, `listTeamLinks(userId)`. Auth checks: creating requires agency team ownership, deleting requires either team's ownership.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Write API route tests**

Create `src/__tests__/api/teams/links.test.ts`:

```typescript
// Test GET /api/teams/links — returns user's team links
// Test POST /api/teams/links — creates link (agency owner)
// Test POST /api/teams/links — 403 for non-owner
// Test DELETE /api/teams/links/[id] — removes link
```

- [ ] **Step 6: Implement GET/POST routes**

`src/app/api/teams/links/route.ts`: GET lists links, POST creates link with Zod validation.

- [ ] **Step 7: Implement DELETE route**

`src/app/api/teams/links/[id]/route.ts`: DELETE removes link.

- [ ] **Step 8: Run all tests**

Run: `pnpm test -- --testPathPattern="team-links|teams/links" --no-coverage`

- [ ] **Step 9: Commit**

```bash
git add src/app/api/teams/links/ src/server/services/teams.service.ts src/__tests__/
git commit -m "feat: add team_links API — create, list, delete agency-to-client links"
```

---

### Task 7: Teams V2 API Routes Update

**Files:**
- Modify: `src/app/api/teams/route.ts` (83 lines — remove getMergedMemberships usage)
- Modify: `src/app/api/teams/profiles/route.ts` (63 lines — profiles are now identity-only)
- Modify: `src/app/api/teams/profiles/[id]/route.ts` (78 lines — remove role field handling)
- Modify: `src/server/services/teams.service.ts` (210 lines — use new repo functions)
- Create: `src/app/api/teams/members/route.ts` (new — member CRUD)

**Context:** Read all existing V2 route files. Read `src/server/services/teams.service.ts` fully.

- [ ] **Step 1: Write tests for members route**

Create `src/__tests__/api/teams/members.test.ts`:

```typescript
// Test GET /api/teams/members — lists team members (direct + linked)
// Test POST /api/teams/members — adds a member (owner only)
```

- [ ] **Step 2: Implement members route**

`src/app/api/teams/members/route.ts`: calls `teamRepo.listMembers()` and `teamRepo.addMember()`.

- [ ] **Step 3: Update teams.service.ts**

Remove all `getMergedMemberships()` calls. Replace `checkTeamRole()` with `hasTeamAccess()`. Update `listTeams()` to use `getUserTeams()`.

- [ ] **Step 4: Update teams route.ts**

`GET /api/teams` now calls `getUserTeams()` instead of `getMergedMemberships()`.

- [ ] **Step 5: Update profiles routes**

Remove `role` from profile creation/update payloads. Profiles are identity-only — no access control fields accepted.

- [ ] **Step 6: Run all team tests**

Run: `pnpm test -- --testPathPattern="teams" --no-coverage && pnpm typecheck 2>&1 | head -30`

- [ ] **Step 7: Commit**

```bash
git add src/app/api/teams/ src/server/services/teams.service.ts src/__tests__/api/teams/
git commit -m "feat: update Teams V2 routes — separate members, identity-only profiles"
```

---

### Task 8: ActionContext + Copilot Routes

**Files:**
- Modify: `src/app/api/copilot/chat/route.ts:200-215` (delete team_members query, use getDataScope)
- Modify: `src/app/api/copilot/confirm-action/route.ts:40-50` (same fix)
- Modify: `src/lib/actions/executor.ts` (pass scope)
- Modify: `src/lib/actions/registry.ts` (if needed)

**Context:** Read `src/app/api/copilot/chat/route.ts` lines 195-220 for the broken team resolution. Read `src/app/api/copilot/confirm-action/route.ts` lines 35-55. The `ActionContext` type was already updated in Task 2.

- [ ] **Step 1: Write test for copilot route team resolution**

Create `src/__tests__/api/copilot/chat-team-scope.test.ts`:

```typescript
// Test that copilot chat route constructs ActionContext with scope from getDataScope
// Test that scope includes teamId when ml-team-context cookie is set
// Test that scope is personal mode when no cookie
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Fix copilot chat route**

In `src/app/api/copilot/chat/route.ts`:
- Delete the 12-line `team_members` query block (lines ~202-213)
- Replace with: `const scope = await getDataScope(userId);`
- Construct `ActionContext` as `{ scope }`

- [ ] **Step 4: Fix confirm-action route**

Same change in `src/app/api/copilot/confirm-action/route.ts`.

- [ ] **Step 5: Run tests**

Run: `pnpm test -- --testPathPattern="copilot" --no-coverage`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/copilot/ src/__tests__/api/copilot/
git commit -m "fix: copilot routes use getDataScope instead of broken team_members query"
```

---

### Task 9: Copilot Actions Rewrite — Batch 1 (Content, Analytics, Scheduling)

**Files:**
- Modify: `src/lib/actions/content.ts` (240 lines — 5 actions)
- Modify: `src/lib/actions/analytics.ts` (86 lines — 3 actions)
- Modify: `src/lib/actions/scheduling.ts` (74 lines — 2 actions)

**Context:** Read each action file. Read the repos they should call: `posts.repo.ts` (`findPosts`, `insertPost`, `updatePost`), `cp-schedule-slots.repo.ts`. Each action must change from raw `.eq('user_id', ctx.userId)` to calling repos with `ctx.scope`.

**IMPORTANT:** Actions become thin wrappers. Delete the raw Supabase queries entirely. Call existing repo methods with `ctx.scope` (DataScope).

- [ ] **Step 1: Write tests for content actions**

Create `src/__tests__/lib/actions/content-actions.test.ts`:

```typescript
// Mock postsRepo, templatesService
// Test list_posts calls postsRepo.findPosts(scope, filters)
// Test write_post calls postsRepo.insertPost with scope
// Test polish_post calls postsRepo.getPost + updatePost with scope
// Test update_post_content calls postsRepo.updatePost with scope
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Rewrite content.ts actions**

Replace every raw `.from('cp_pipeline_posts')` query with repo calls. Each action receives `ctx.scope` and passes it to the repo.

- [ ] **Step 4: Write tests for analytics actions**

```typescript
// Test get_post_performance uses postsRepo with scope
// Test get_top_posts uses postsRepo with scope
// Test get_autopilot_status uses postsRepo + slotsRepo with scope
```

- [ ] **Step 5: Rewrite analytics.ts actions**

- [ ] **Step 6: Write tests for scheduling actions**

```typescript
// Test schedule_post uses postsRepo.updatePost with scope
// Test get_schedule uses slotsRepo with scope
```

- [ ] **Step 7: Rewrite scheduling.ts actions**

- [ ] **Step 8: Run all action tests**

Run: `pnpm test -- --testPathPattern="actions" --no-coverage`

- [ ] **Step 9: Commit**

```bash
git add src/lib/actions/content.ts src/lib/actions/analytics.ts src/lib/actions/scheduling.ts src/__tests__/lib/actions/
git commit -m "fix: rewrite content/analytics/scheduling actions — use repos with DataScope"
```

---

### Task 10: Copilot Actions Rewrite — Batch 2 (Templates, Knowledge, Funnels, Lead Magnets, Email)

**Files:**
- Modify: `src/lib/actions/templates.ts` (51 lines — fix wrong columns, use service)
- Modify: `src/lib/actions/knowledge.ts` (74 lines — pass scope to knowledge brain)
- Modify: `src/lib/actions/funnels.ts` (114 lines — 3 actions)
- Modify: `src/lib/actions/lead-magnets.ts` (330 lines — 3+ actions)
- Modify: `src/lib/actions/email.ts` (93 lines — 2 actions)

**Context:** Read each file. For templates, the current `list_templates` references wrong columns (`content_type` instead of `category`, `example_post` instead of `example_posts`). For knowledge, pass `ctx.scope` instead of separate `userId`/`teamId`. For funnels/lead-magnets/email, replace raw queries with repo calls using `ctx.scope`.

- [ ] **Step 1: Write tests**

Create `src/__tests__/lib/actions/actions-batch2.test.ts`:

```typescript
// Test list_templates uses templatesService.list(scope) with correct columns
// Test list_writing_styles uses stylesRepo with scope
// Test search_knowledge passes scope to knowledgeBrain
// Test list_topics passes scope to knowledgeBrain
// Test build_content_brief passes scope to knowledgeBrain
// Test list_funnels uses funnelsRepo with scope
// Test get_funnel uses funnelsRepo with scope
// Test publish_funnel uses funnelsRepo with scope
// Test list_lead_magnets uses leadMagnetsRepo with scope
// Test get_lead_magnet uses leadMagnetsRepo with scope
// Test save_lead_magnet uses leadMagnetsRepo with scope
// Test list_email_sequences uses emailSequenceRepo with scope
// Test get_subscriber_count uses emailRepo with scope
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Rewrite all 5 action files**

Same pattern as Task 9: delete raw queries, call repos/services with `ctx.scope`.

- [ ] **Step 4: Run all tests**

Run: `pnpm test -- --testPathPattern="actions" --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/templates.ts src/lib/actions/knowledge.ts src/lib/actions/funnels.ts src/lib/actions/lead-magnets.ts src/lib/actions/email.ts src/__tests__/lib/actions/
git commit -m "fix: rewrite templates/knowledge/funnels/lead-magnets/email actions — use repos with DataScope"
```

---

### Task 11: Copilot System Prompt Fix

**Files:**
- Modify: `src/lib/ai/copilot/system-prompt.ts` (212 lines)

**Context:** Read the file. Lines 92-97 have the voice profile lookup using `.eq('user_id', userId)`. Line 134-136 has post performance lookup with `.eq('user_id', userId)`. Both need scope-aware resolution.

- [ ] **Step 1: Write test**

Create `src/__tests__/lib/ai/copilot/system-prompt.test.ts`:

```typescript
// Test: in team mode, voice profile comes from getDefaultProfile(teamId)
// Test: in personal mode, voice profile comes from user's linked profile
// Test: post performance scoped by team in team mode
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Fix voice profile lookup**

Replace `.eq('user_id', userId)` with: if `scope.teamId`, call `getDefaultProfile(scope.teamId)` from `team.repo.ts`. Otherwise, find the user's profile by `user_id`.

- [ ] **Step 4: Fix post performance lookup**

Replace `.eq('user_id', userId)` with scope-aware query using `applyScope` or `postsRepo.findPosts(scope, ...)`.

- [ ] **Step 5: Run tests**

Run: `pnpm test -- --testPathPattern="system-prompt" --no-coverage`

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/copilot/system-prompt.ts src/__tests__/lib/ai/copilot/
git commit -m "fix: system prompt uses scope-aware voice profile + post performance lookups"
```

---

### Task 12: MCP Client + Handlers Rewrite

**Files:**
- Modify: `packages/mcp/src/client.ts` (431 lines — add teamId param to all methods)
- Modify: `packages/mcp/src/handlers/*.ts` (11 handler files — pass team_id through)

**Context:** Read `packages/mcp/src/client.ts` to see method signatures. Read a few handler files (e.g., `handlers/posts.ts`, `handlers/knowledge.ts`) to see how they extract params and call client methods. The pattern is: handler extracts fields from validated input → calls client method → client method does HTTP.

- [ ] **Step 1: Write tests for MagnetLabClient team_id pass-through**

MCP package uses vitest. Create/update test in `packages/mcp/src/__tests__/client.test.ts`:

```typescript
// Test: client.listPosts({ teamId: 'X' }) sends ?team_id=X as query param
// Test: client.searchKnowledge({ teamId: 'X', query: 'foo' }) sends team_id
// Test: methods without teamId don't append query param
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/mcp && pnpm test -- --testPathPattern="client" 2>&1 | head -30`

- [ ] **Step 3: Update MagnetLabClient**

Add optional `teamId?: string` param to every method. When set, append `?team_id=${teamId}` (or `&team_id=` if URL already has params) to the API request URL.

Simplest approach: add a private `appendTeamId(url: string, teamId?: string): string` helper.

- [ ] **Step 4: Update all handlers to pass team_id through**

For each handler file in `packages/mcp/src/handlers/`:
- Extract `team_id` from the validated input (already validated by Zod)
- Pass it as `teamId` to the client method call

Example for `handlers/posts.ts`:
```typescript
// Before: return client.listPosts({ status, limit });
// After:  return client.listPosts({ status, limit, teamId: input.team_id });
```

- [ ] **Step 5: Run all MCP tests**

Run: `cd packages/mcp && pnpm test --no-coverage`

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/
git commit -m "fix: MCP handlers pass team_id to client, client sends as query param"
```

---

### Task 13: Template Matcher Rewrite

**Files:**
- Modify: `src/lib/ai/content-pipeline/template-matcher.ts` (136 lines — major rewrite)
- Modify: `src/server/repositories/cp-templates.repo.ts` (134 lines — team scoping)
- Modify: `src/server/services/cp-templates.service.ts` (295 lines — team scoping)

**Context:** Read all three files. Read the spec section "Template matching: shortlist + rerank." The current `findBestTemplate()` returns one match. The new `matchTemplates()` returns top 3 after reranking.

- [ ] **Step 1: Write tests for template repo team scoping**

Create/update `src/__tests__/server/repositories/cp-templates-repo.test.ts`:

```typescript
// Test matchTemplatesRpc now takes teamId instead of userId
// Test listTemplates scoped by DataScope (team mode uses team_id)
```

- [ ] **Step 2: Update template repo**

Change `matchTemplatesRpc(userId, ...)` → `matchTemplatesRpc(teamId, ...)` to call the rewritten RPC. Update `listTemplates` to accept DataScope and use `applyScope` or `team_id` filter.

- [ ] **Step 3: Write tests for reranking**

Create `src/__tests__/lib/ai/content-pipeline/template-matcher.test.ts`:

```typescript
// Test rerankTemplates: semantic * 0.4 + performance * 0.35 + freshness * 0.25
// Test rerankTemplates: NULL performance treated as 0.5
// Test rerankTemplates: freshness = min(days_since_last_use / 14, 1.0)
// Test rerankTemplates: never used by profile = freshness 1.0
// Test matchAndRerankTemplates returns top 3
// Test buildTemplateGuidance formats array of templates into menu
```

- [ ] **Step 4: Run tests to verify they fail**

- [ ] **Step 5: Rewrite template-matcher.ts**

Delete `findBestTemplate()`. Replace with:

```typescript
export async function matchAndRerankTemplates(
  topicText: string,
  teamId: string,
  profileId: string,
  count?: number
): Promise<RankedTemplate[]>
```

1. Call `matchTemplatesRpc(teamId, embedding, 10)` for candidates
2. For each candidate, fetch freshness: `SELECT MAX(created_at) FROM cp_pipeline_posts WHERE template_id = $1 AND team_profile_id = $2`
3. Compute `rerank_score` per spec formula
4. Sort, return top `count` (default 3)

Rewrite `buildTemplateGuidance(templates: RankedTemplate[])` to accept array and build the menu format.

- [ ] **Step 6: Update template service**

`cp-templates.service.ts`: update `list()`, `match()`, `create()` to accept team scoping.

- [ ] **Step 7: Run all tests**

Run: `pnpm test -- --testPathPattern="template" --no-coverage`

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/content-pipeline/template-matcher.ts src/server/repositories/cp-templates.repo.ts src/server/services/cp-templates.service.ts src/__tests__/
git commit -m "feat: rewrite template matcher — shortlist+rerank with performance and freshness"
```

---

### Task 14: Post Writer Consolidation

**Files:**
- Modify: `src/lib/ai/content-pipeline/post-writer.ts` (324 lines)
- Modify: `src/lib/ai/content-pipeline/quick-writer.ts` (96 lines)
- Modify: `src/lib/ai/content-pipeline/week-planner.ts` (248 lines)
- Modify: `src/lib/ai/content-pipeline/prompt-defaults.ts` (prompt templates)

**Context:** Read `post-writer.ts`. It has three entry points: `writePostFreeform()`, `writePostWithTemplate()`, `writePostWithAutoTemplate()`. Delete the first two, keep `writePostWithAutoTemplate` as the single `writePost()` entry point but using the new `matchAndRerankTemplates` (top 3 menu) instead of `findBestTemplate` (single match).

- [ ] **Step 1: Write tests**

Create `src/__tests__/lib/ai/content-pipeline/post-writer.test.ts`:

```typescript
// Test writePost: calls matchAndRerankTemplates, gets top 3
// Test writePost: builds template menu guidance with 3 templates
// Test writePost: works with 0 template matches (no guidance)
// Test writePost: passes voice profile from team_profiles
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Consolidate post-writer.ts**

Delete `writePostFreeform()` and `writePostWithTemplate()`. Rename `writePostWithAutoTemplate()` to `writePost()`. Change it to:
- Call `matchAndRerankTemplates()` instead of `findBestTemplate()`
- Use updated `buildTemplateGuidance()` that formats the 3-template menu
- Remove the "adhere strictly to template" prompt path

- [ ] **Step 4: Update quick-writer.ts**

Replace `findBestTemplate()` call with `matchAndRerankTemplates()`. Use multi-template guidance.

- [ ] **Step 5: Update week-planner.ts**

Replace `matchIdeasToTemplates()` to use the new `matchAndRerankTemplates()` per-idea instead of client-side cosine similarity.

- [ ] **Step 6: Run all tests**

Run: `pnpm test -- --testPathPattern="post-writer|quick-writer|week-planner" --no-coverage`

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/content-pipeline/post-writer.ts src/lib/ai/content-pipeline/quick-writer.ts src/lib/ai/content-pipeline/week-planner.ts src/lib/ai/content-pipeline/prompt-defaults.ts src/__tests__/
git commit -m "feat: consolidate post writer — single writePost() with multi-template soft guidance"
```

---

### Task 15: Template Performance Feedback Job

**Files:**
- Create: `src/trigger/update-template-scores.ts`

**Context:** Read the spec section "Template performance feedback loop" for the SQL. Read existing Trigger.dev tasks (e.g., `src/trigger/extract-winning-templates.ts`) for the task pattern. This is a scheduled nightly task.

- [ ] **Step 1: Write the Trigger.dev task**

Create `src/trigger/update-template-scores.ts`:

```typescript
import { schedules } from "@trigger.dev/sdk/v3";

export const updateTemplateScores = schedules.task({
  id: "update-template-scores",
  cron: "0 3 * * *", // 3 AM UTC, after engagement scraping
  run: async () => {
    // Execute the aggregate UPDATE query from the spec
    // Log: templates updated count
  }
});
```

Use the exact SQL from the spec with exponential decay and 90-day window.

- [ ] **Step 2: Write test**

Create `src/__tests__/trigger/update-template-scores.test.ts`:

```typescript
// Test: task executes the aggregate query
// Test: only considers posts from last 90 days
// Test: handles case with 0 engagement data gracefully
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- --testPathPattern="update-template-scores" --no-coverage`

- [ ] **Step 4: Commit**

```bash
git add src/trigger/update-template-scores.ts src/__tests__/trigger/
git commit -m "feat: add nightly template score feedback job — engagement → avg_engagement_score"
```

---

### Task 16: Autopilot Team Generation

**Files:**
- Modify: `src/lib/services/autopilot.ts` (520 lines)

**Context:** Read the full file. Focus on `runNightlyBatch()` (~line 280-400). Currently generates per-user. Needs to: iterate team profiles, pick ideas from shared pool, match templates per-profile (with freshness), write in each profile's voice.

- [ ] **Step 1: Write tests**

Create `src/__tests__/lib/services/autopilot-team.test.ts`:

```typescript
// Test: generates posts for each profile with open slots
// Test: same idea used across multiple profiles produces different posts
// Test: template matching uses per-profile freshness
// Test: each post gets the correct profile's voice_profile
// Test: 0 ideas → early return
// Test: 0 profiles with open slots → early return
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Rewrite runNightlyBatch**

Restructure the main loop:
1. Get DataScope for the team
2. Get shared idea pool (`cp_content_ideas` scoped by `team_id`)
3. Score ideas (existing logic)
4. Get all active profiles + their posting slots
5. For each profile with unfilled slots:
   - Pick an idea (round-robin or by expertise match)
   - `matchAndRerankTemplates(ideaText, teamId, profileId)` — freshness per-profile
   - `writePost()` with: idea + profile's voice_profile + template menu
   - Store `template_id` on the post

- [ ] **Step 4: Run tests**

Run: `pnpm test -- --testPathPattern="autopilot" --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/autopilot.ts src/__tests__/lib/services/
git commit -m "feat: autopilot generates per-profile with shared ideas, per-voice writing, per-profile freshness"
```

---

### Task 17: UI — Team Management Page

**Files:**
- Modify: `src/app/(dashboard)/team/page.tsx` (762 lines — major rewrite)
- Modify: `src/frontend/api/teams.ts` (client API module)

**Context:** Read the full `team/page.tsx`. Currently conflates members and profiles. Needs separate "Members" and "Profiles" tabs. Add "Linked Teams" section.

- [ ] **Step 1: Update frontend API module**

In `src/frontend/api/teams.ts`, add:
- `listMembers(teamId)` — calls GET `/api/teams/members`
- `addMember(teamId, userId)` — calls POST `/api/teams/members`
- `listTeamLinks(teamId)` — calls GET `/api/teams/links`
- `createTeamLink(agencyTeamId, clientTeamId)` — calls POST `/api/teams/links`
- `deleteTeamLink(linkId)` — calls DELETE `/api/teams/links/[id]`

- [ ] **Step 2: Rewrite team management page**

Split into three sections/tabs:
1. **Members** — list of users who can work in this team. Shows name, email, role (owner/member), "via [Agency]" badge for linked members. Owner can add/remove direct members.
2. **Profiles** — list of personas content is published as. Shows name, title, voice profile tone, LinkedIn URL. Owner can add/edit/remove profiles. No access control fields (role, invited_at gone).
3. **Linked Teams** — shows agency links. Owner can create new links or sever existing ones.

- [ ] **Step 3: Remove role from profile editor**

The profile create/edit modal should NOT show a "role" field. Profiles are identity-only.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/app/\\(dashboard\\)/team/page.tsx src/frontend/api/teams.ts
git commit -m "feat: team management UI — separate Members, Profiles, and Linked Teams tabs"
```

---

### Task 18: UI — Team Switcher + Sidebar

**Files:**
- Modify: `src/app/team-select/page.tsx` (136 lines)
- Modify: `src/components/dashboard/AppSidebar.tsx` (371 lines)
- Modify: `src/app/(dashboard)/layout.tsx` (dashboard layout — teamContext construction)

**Context:** Read all three files. Team switcher needs to show linked teams with a badge. Sidebar team indicator unchanged but should show "via [Agency]" when in a linked team.

- [ ] **Step 1: Update team-select page**

Replace `getTeamMemberships()` call with `getUserTeams()`. For each team, show:
- Team name + role
- If `via === 'team_link'`: show a "via [Agency Name]" badge

- [ ] **Step 2: Update dashboard layout**

`teamContext` construction: replace `checkTeamRole()` with `hasTeamAccess()`. Add `via` field to teamContext so sidebar can distinguish.

- [ ] **Step 3: Update sidebar**

When `teamContext.via === 'team_link'`, show the linked agency name in the team banner.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`

- [ ] **Step 5: Commit**

```bash
git add src/app/team-select/page.tsx src/components/dashboard/AppSidebar.tsx src/app/\\(dashboard\\)/layout.tsx
git commit -m "feat: team switcher shows linked teams with badge, sidebar shows agency link"
```

---

## Final Verification

After all 18 tasks are complete:

- [ ] **Full test suite:** `pnpm test --no-coverage` — all tests pass
- [ ] **Typecheck:** `pnpm typecheck` — zero errors
- [ ] **Build:** `pnpm build` — successful
- [ ] **Lint:** `pnpm lint` — clean
- [ ] **Code review:** Trigger `superpowers:requesting-code-review` against the spec
