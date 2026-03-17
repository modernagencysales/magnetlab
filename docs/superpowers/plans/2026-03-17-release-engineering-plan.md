# Release Engineering — magnetlab PR Backlog Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge 5 backed-up feature PRs into main without degrading code quality, raising the bar on every merge.

**Architecture:** Sequential phase execution with build gates between phases. Each phase produces a PR (or direct merge) that passes typecheck + tests + build before the next phase begins. Migrations applied to production Supabase before their corresponding code deploys.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL), pnpm, Jest, GitHub CLI (`gh`), Vercel CLI

**Spec:** `docs/superpowers/specs/2026-03-17-release-engineering-plan-design.md`

### Migration Application Method

All migrations are applied via the Supabase Management API:
```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w | sed 's/go-keyring-base64://' | base64 -D)
curl -s -X POST "https://api.supabase.com/v1/projects/qvawbxpijxlwdkolmjrs/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "<SQL HERE>"}'
```

### Rollback Strategy

| Phase | Method |
|-------|--------|
| Phase 1 | `git revert <commit>` — all changes are additive |
| Phase 2a (#37) | `git revert -m 1 <merge-commit>` — single revert of merge commit |
| Phase 2b (#42) | `git revert <commit>` — small rebase, clean revert |
| Phase 2c (#41) | `git revert <commit>` — DB columns persist safely (additive) |
| Phase 2d (#35) | `git revert <cherry-pick-commits>` — individual reverts |
| Phase 2e (#39) | `git revert <commit>` — CS files are self-contained |

All migrations are additive (new tables, new columns, DROP NOT NULL). No schema rollback needed.

---

## Task 1: Phase 1 — Fortify Main

**Files:**
- Modify: `src/lib/services/autopilot.ts`
- Modify: `src/server/services/external.service.ts`
- Modify: `src/server/repositories/wizard-draft.repo.ts`
- Create: `supabase/migrations/20260317000000_funnel_leads_backfill_team_id.sql`
- Modify: All `src/app/(dashboard)/**/page.tsx` files that call `getDataScope()`
- Modify: `src/server/repositories/admin.repo.ts`
- Modify: `src/server/repositories/competitors.repo.ts`
- Modify: `src/server/repositories/cp-transcripts.repo.ts`
- Modify: `src/server/repositories/signals.repo.ts`
- Modify: `src/server/repositories/linkedin.repo.ts`
- Modify: `src/lib/services/linkedin-automation.ts`
- Modify: `src/lib/services/team-integrations.ts`
- Modify: `src/lib/actions/content.ts`
- Modify: `src/app/(dashboard)/admin/prompts/[slug]/page.tsx`
- Modify: `src/trigger/signal-push-heyreach.ts`
- Modify: `src/trigger/signal-profile-scan.ts`
- Modify: `src/trigger/signal-company-scan.ts`
- Modify: `src/trigger/signal-enrich-and-score.ts`
- Modify: `src/trigger/signal-keyword-scan.ts`
- Modify: `src/trigger/playbook-sync.ts`

- [ ] **Step 1: Create branch and delete stale worktree**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git checkout main && git pull origin main
git checkout -b fix/fortify-main
rm -rf .worktrees/creative-strategy
```

This fixes the 11 Jest test suite failures caused by duplicate `@magnetlab/magnetui` package resolution.

- [ ] **Step 2: Fix T7 — Autopilot buffer team scoping**

Read `src/lib/services/autopilot.ts` and find `getBufferStatus`. Change the function signature to accept `DataScope` and use `team_profile_id` scoping for `cp_pipeline_posts` (same pattern used in `analytics.repo.ts` after Ankur's bugfix). For tables with `team_id`, use `applyScope()`. For `cp_pipeline_posts` (which uses `team_profile_id`), look up `team_profiles` by `team_id` then filter by `team_profile_id`.

- [ ] **Step 3: Fix T9 — external.service team_id**

Read `src/server/services/external.service.ts`. Find line ~92 where `null` is passed for `team_id` in a lead magnet creation call. Replace with resolved `teamId` matching the pattern at line ~145 (which correctly uses `teamRepo.getTeamIdByOwnerProfileUserId()`).

- [ ] **Step 4: Fix T10 — Wizard drafts team_id**

Read `src/server/repositories/wizard-draft.repo.ts`. Find `updateDraft()` (~line 53-56). Add `team_id` to the update payload, sourced from the caller's scope. The caller should pass `DataScope` and the repo should include `team_id: scope.teamId || null` in the update.

- [ ] **Step 5: Create T11 migration — funnel_leads backfill**

```sql
-- supabase/migrations/20260317000000_funnel_leads_backfill_team_id.sql
-- Backfill team_id on funnel_leads from their parent funnel_page's team_id
UPDATE funnel_leads fl
SET team_id = fp.team_id
FROM funnel_pages fp
WHERE fl.funnel_page_id = fp.id
  AND fl.team_id IS NULL
  AND fp.team_id IS NOT NULL;
```

- [ ] **Step 6: Fix T12 — Add force-dynamic to dashboard pages**

Find all `page.tsx` files under `src/app/(dashboard)/` that call `getDataScope()` or `cookies()`. Add `export const dynamic = 'force-dynamic';` after the imports. Use grep to find them:

```bash
grep -rl "getDataScope\|cookies()" src/app/\(dashboard\)/ --include="page.tsx"
```

- [ ] **Step 7: Fix F6 — select('*') cleanup (repos)**

For each repo file with `select('*')`, create a named column constant and replace the `select('*')` call. Verify columns against the database schema first:

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'TABLE_NAME' ORDER BY ordinal_position;
```

Files: `admin.repo.ts` (4 queries), `competitors.repo.ts` (1), `cp-transcripts.repo.ts` (1), `signals.repo.ts` (3), `linkedin.repo.ts` (3).

Pattern for each:
```typescript
const TABLE_COLUMNS = 'col1, col2, col3, ...';
// Replace: .select('*')
// With:    .select(TABLE_COLUMNS)
```

- [ ] **Step 8: Fix F6 — select('*') cleanup (services, actions, pages)**

Same pattern for: `linkedin-automation.ts` (1), `team-integrations.ts` (2), `content.ts` (1), `admin/prompts/[slug]/page.tsx` (2).

- [ ] **Step 9: Fix F6 — select('*') cleanup (trigger files)**

Same pattern for: `signal-push-heyreach.ts` (1), `signal-profile-scan.ts` (1), `signal-company-scan.ts` (1), `signal-enrich-and-score.ts` (1), `signal-keyword-scan.ts` (1), `playbook-sync.ts` (2).

- [ ] **Step 10: Run verification suite**

```bash
pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

All must pass. Fix any failures before proceeding.

- [ ] **Step 11: Commit and create PR**

```bash
git add src/lib/services/autopilot.ts src/server/services/external.service.ts src/server/repositories/wizard-draft.repo.ts supabase/migrations/ src/app/\(dashboard\)/ src/server/repositories/ src/lib/services/ src/lib/actions/ src/trigger/
git diff --cached --name-only  # Verify — no .env or secrets staged
git commit -m "fix: fortify main — 7 remaining bugs + 25 select('*') cleanups

- T7: Autopilot buffer now respects team scope via team_profile_id
- T9: external.service passes resolved teamId instead of null
- T10: Wizard drafts update team_id on team context change
- T11: Backfill funnel_leads.team_id from parent funnel_page
- T12: force-dynamic on all dashboard pages using getDataScope
- F6: Replace 25 select('*') with explicit column constants
- F7: Remove stale .worktrees/creative-strategy (fixes 11 test failures)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

Push and create PR. Merge to main.

- [ ] **Step 12: Build gate**

```bash
git checkout main && git pull origin main
pnpm install && pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

---

## Task 2: Phase 2a — PR #37 (Copilot + Shared Base)

**Scope:** Merge 95 commits (80 shared base + 15 copilot) into main. This is the largest and hardest merge — 12 conflict files, 53 hunks.

- [ ] **Step 1: Apply migrations to production Supabase**

Run against production Supabase (project ref `qvawbxpijxlwdkolmjrs`):

```sql
-- From 20260308000000_position_synthesis.sql
-- From 20260309000000_section_variants.sql
```

Read the actual migration files from the branch first:
```bash
git show origin/feat/copilot-driven-creation:supabase/migrations/20260308000000_position_synthesis.sql
git show origin/feat/copilot-driven-creation:supabase/migrations/20260309000000_section_variants.sql
```

Verify columns/tables exist after applying.

- [ ] **Step 2: Merge main into the feature branch**

```bash
git fetch origin
git checkout -b copilot-merge origin/feat/copilot-driven-creation
git merge origin/main
```

This will show 12 conflict files. Resolve each one following the strategy in the spec:

**Hard (read both versions, reconcile):**
- `PostDetailModal.tsx` (14 hunks) — keep main's template picker + #37's copilot integration
- `SectionsManager.tsx` (11 hunks) — keep both sets of editors

**Medium (combine additions):**
- `funnels.service.ts` (5 hunks) — preserve main's `teamId` in `bulkCreateFunnels` + #37's section validation
- `ContentPageTab.tsx` (3 hunks) — keep both buttons, reconcile ordering
- `DetailPane.tsx` (7 hunks) — merge both refactors

**Trivial/Easy:**
- `CLAUDE.md` — concatenate
- `ai-copilot.md` — take #37's version
- `SectionBridge.tsx` — pick either formatting
- `IdeasTab.tsx` — take #37's copilot button
- `PostsTab.tsx` — imports only
- `PostsContent.tsx` — keep main's magnetui + #37's Zap icon
- `MagnetsListClient.tsx` — keep both changes

- [ ] **Step 3: Review shared base feature systems**

Dispatch parallel review agents for each feature system in the shared base (see spec review checklists). For each system, verify:

1. Route → Service → Repo architecture
2. No select('*')
3. logError() not console.log
4. Components under 300 lines
5. JSDoc headers on new files
6. No empty catch blocks

Fix any violations found before committing the merge.

- [ ] **Step 4: Cross-reference bug fixes with Ankur's merge**

Check that MOD-346 through MOD-428 fixes don't duplicate or conflict with Ankur's 27-bug fixes (PR #43). Specifically verify MOD-381 (DFY scope) doesn't conflict with our `getDataScope` → `teamRepo` fix in `webhooks-incoming.service.ts`.

- [ ] **Step 5: Run verification suite**

```bash
pnpm install && pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

- [ ] **Step 6: Push and merge**

```bash
git push origin copilot-merge
gh pr create --base main --head copilot-merge --title "feat: copilot-driven creation + shared base (5 feature systems)" --body "..."
```

Merge the PR. Then close PR #37 and delete branches:
```bash
gh pr close 37 --repo modernagencysales/magnetlab --comment "Merged via #XX (copilot-merge branch). All 95 commits including shared base + copilot feature landed on main."
```
Delete `copilot-merge` branch and the original `feat/copilot-driven-creation` branch.

- [ ] **Step 7: Build gate**

```bash
git checkout main && git pull origin main
pnpm install && pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

---

## Task 3: Phase 2b — PR #42 (Post Campaign Automation)

**Scope:** Fix 2 critical + 5 medium + 3 low issues, rebase onto main, merge.

- [ ] **Step 1: Apply migration to production Supabase**

Read and apply from branch:
```bash
git show origin/feat/post-campaign-automation:supabase/migrations/20260316200000_post_campaigns.sql
```

- [ ] **Step 2: Create working branch and rebase**

```bash
git checkout -b post-campaigns-fix origin/feat/post-campaign-automation
git rebase origin/main
```

Resolve any conflicts (expected: `funnels.service.ts` imports).

- [ ] **Step 3: Fix C1 — RPC function name mismatch**

In `src/server/repositories/post-campaigns.repo.ts`, find `increment_linkedin_daily_limit` and change to `increment_daily_limit` (matching the migration's function name).

- [ ] **Step 4: Fix C2 — Column whitelist in SECURITY DEFINER RPC**

Create new migration:
```sql
-- supabase/migrations/20260317100000_fix_increment_daily_limit_whitelist.sql
CREATE OR REPLACE FUNCTION increment_daily_limit(p_user_id uuid, p_date date, p_field text)
RETURNS void AS $$
BEGIN
  IF p_field NOT IN ('dms_sent', 'connections_accepted', 'connection_requests_sent') THEN
    RAISE EXCEPTION 'Invalid field: %', p_field;
  END IF;
  INSERT INTO linkedin_daily_limits (user_id, date, dms_sent, connections_accepted, connection_requests_sent)
  VALUES (p_user_id, p_date, 0, 0, 0)
  ON CONFLICT (user_id, date) DO NOTHING;
  EXECUTE format('UPDATE linkedin_daily_limits SET %I = %I + 1 WHERE user_id = $1 AND date = $2', p_field, p_field)
  USING p_user_id, p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 5: Apply C2 fix migration to production Supabase**

Apply the migration created in Step 4 to production Supabase using the Management API method (see header). Verify the function was replaced by calling it with an invalid field and confirming it raises an exception.

- [ ] **Step 6: Fix M1 — Add Zod schemas**

Add `CreatePostCampaignSchema` and `UpdatePostCampaignSchema` to `src/lib/validations/api.ts`. Apply validation in the POST and PATCH route handlers.

- [ ] **Step 6: Fix M2 — Add ALLOWED_UPDATE_FIELDS**

In `src/server/repositories/post-campaigns.repo.ts`, add:
```typescript
const ALLOWED_UPDATE_FIELDS = ['name', 'post_url', 'dm_template', 'auto_accept_connections', 'daily_dm_limit', 'daily_connection_limit', 'status'] as const;
```
Filter the update payload through this whitelist before calling `.update()`.

- [ ] **Step 7: Fix M3 — Move test-dm logic to service**

Create `sendTestDm()` in `src/server/services/post-campaigns.service.ts`. Move the DB queries and DM sending logic from the route handler into this service function. Route handler should just call the service and return the result.

- [ ] **Step 8: Fix M4 — Add getStatusCode()**

Add `getStatusCode(err: unknown): number` export to `post-campaigns.service.ts`. Refactor route handlers to use it instead of inline status code mapping.

- [ ] **Step 9: Fix M5 — Batch HeyReach dedup query**

In `src/trigger/signal-push-heyreach.ts`, replace the N+1 loop with a single batch query:
```typescript
const existingUrls = await postCampaignsRepo.findLinkedInUrlsInAnyCampaign(linkedInUrls);
```
Add `findLinkedInUrlsInAnyCampaign(urls: string[])` to the repo that uses `.in('linkedin_url', urls)`.

- [ ] **Step 10: Fix L1 — Status param validation**

In the GET routes, validate the `status` query param against the literal union type before passing to the repo.

- [ ] **Step 11: Fix L2 + L3 — Add tests**

Create `src/__tests__/api/post-campaigns/route.test.ts` with tests for:
- POST: auth, validation (Zod), happy path
- GET: auth, pagination, status filtering
- PATCH: auth, validation, ALLOWED_UPDATE_FIELDS enforcement
- Activate/pause: auth, status transitions

Create `src/__tests__/lib/validations/post-campaigns.test.ts` with Zod schema tests.

- [ ] **Step 12: Run verification suite**

```bash
pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

- [ ] **Step 13: Push and merge**

Push the rebased branch with `--force-with-lease`, update the PR description, merge. Delete branch.

- [ ] **Step 14: Build gate**

```bash
git checkout main && git pull origin main
pnpm install && pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

---

## Task 4: Phase 2c — PR #41 (MCP v2 Agent-Native)

**Scope:** Re-merge the MCP v2 rewrite. Previously reverted because migrations weren't applied first.

- [ ] **Step 1: Apply migrations to production Supabase (CRITICAL)**

```bash
git show origin/feat/mcp-v2-agent-native:supabase/migrations/20260313000000_add_lead_magnet_content_field.sql
git show origin/feat/mcp-v2-agent-native:supabase/migrations/20260313010000_add_post_source_and_agent_metadata.sql
```

Apply both. Then verify:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'lead_magnets' AND column_name IN ('content', 'content_version');
SELECT column_name FROM information_schema.columns WHERE table_name = 'cp_pipeline_posts' AND column_name IN ('source', 'agent_metadata');
```

Both queries must return results before proceeding.

- [ ] **Step 2: Create working branch and rebase**

```bash
git checkout -b mcp-v2-fix origin/feat/mcp-v2-agent-native
git rebase origin/main
```

Resolve 7 conflicts. Critical: preserve `.eq('user_id', userId)` in `lead-magnets.repo.ts`.

- [ ] **Step 3: Fix C1 — Verify security fix preserved**

After rebase, check `src/server/repositories/lead-magnets.repo.ts` function `findLeadMagnetByOwner`. Confirm `.eq('user_id', userId)` is present. If not, add it.

- [ ] **Step 4: Fix C2 + C3 — Team scoping for agent posts**

In `src/server/services/posts.service.ts`, update `createAgentPost()` and `scheduleWeek()` to accept `DataScope` and use `team_profile_id` scoping (same pattern as `analytics.repo.ts`).

- [ ] **Step 5: Fix M1 — Slim down posts route**

Extract Zod error formatting from `POST /api/content-pipeline/posts/route.ts` into a shared helper. Get route under 30 lines.

- [ ] **Step 6: Fix M2 — Double auth() call**

In the analytics performance-insights route, capture `session.user.id` in a variable before the try block.

- [ ] **Step 7: Fix M3 — Verify LM_LIST_COLUMNS**

Check all components that render lead magnet lists. Verify none depend on `concept`, `extracted_content`, `polished_content`, or other fields excluded from `LM_LIST_COLUMNS`. If any do, they should use the detail endpoint instead.

```bash
grep -rn "concept\|extracted_content\|polished_content" src/components/ src/app/ --include="*.tsx" | grep -v "test\|__tests__"
```

- [ ] **Step 8: Run verification suite**

```bash
pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

- [ ] **Step 9: Push and merge**

```bash
git push origin mcp-v2-fix
gh pr create --base main --head mcp-v2-fix --title "feat: MCP v2 agent-native rearchitecture (37 direct tools)" --body "..."
```

Merge. Delete branches.

- [ ] **Step 10: Publish MCP package**

```bash
cd packages/mcp
# Bump patch version in package.json (e.g., 0.4.3 -> 0.4.4)
pnpm build && pnpm test
npm publish --access public  # npm publish is correct here — pnpm delegates to npm for publishing
cd ../..
```

- [ ] **Step 11: Build gate**

```bash
git checkout main && git pull origin main
pnpm install && pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

---

## Task 5: Phase 2d — PR #35 Remainder (Cherry-picks)

**Scope:** Cherry-pick 9 commits from `origin/early-users/experiments` (the 10 post-fork commits minus PromptVaultRenderer which is already on main).

- [ ] **Step 1: Create branch and fetch remote**

```bash
git checkout main && git pull origin main
git fetch origin early-users/experiments
git checkout -b fix/experiments-cherry-picks
```

- [ ] **Step 2: Cherry-pick bug fixes first**

```bash
git cherry-pick 3029dea  # MOD-429: clickable magnet rows + team modal
git cherry-pick 5d52fe3  # MOD-436: team-to-personal switching
git cherry-pick 22b0eb9  # avatar_url column fix
git cherry-pick 5a51817  # Attio transcript routing
git cherry-pick 2a9c7e0  # magnetui build fix
```

If `MagnetsListClient.tsx` conflicts (expected), resolve by keeping main's version and adding #35's changes on top.

- [ ] **Step 3: Cherry-pick enhancements**

```bash
git cherry-pick 05bca4e  # Editable header/subheader
git cherry-pick b2f1b5c  # Edit indicators
git cherry-pick 67d4433  # Font picker
git cherry-pick 65548d2  # resource-grid block
```

- [ ] **Step 4: Check standards on cherry-picked code**

For each cherry-picked file, verify:
- No select('*')
- No raw fetch() in components
- No empty catch blocks
- logError() used correctly

Fix any violations.

- [ ] **Step 5: Run verification suite**

```bash
pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

- [ ] **Step 6: Push, create PR, merge**

```bash
git push origin fix/experiments-cherry-picks
gh pr create --base main --head fix/experiments-cherry-picks --title "fix: cherry-pick UI fixes and enhancements from experiments branch" --body "..."
```

Merge. Close PR #35 with comment:
```bash
gh pr close 35 --repo modernagencysales/magnetlab --comment "Closed: bug fixes and enhancements cherry-picked into #XX. PromptVaultRenderer was already on main. The 80 shared-base commits were merged via PR #37."
```

- [ ] **Step 7: Build gate**

```bash
git checkout main && git pull origin main
pnpm install && pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

---

## Task 6: Phase 2e — PR #39 (Creative Strategy Extract)

**Scope:** Extract 34 creative strategy files from the 175-file PR. Fix 2 critical + 4 medium bugs. Defer accelerator, copilot rewrite, actions/providers for separate review.

- [ ] **Step 1: Apply CS migration to production Supabase**

```bash
git show origin/feat/creative-strategy-system:supabase/migrations/20260311000000_creative_strategy.sql
```

Apply only the CS migration. Do NOT apply the other 6 migrations (accelerator/providers).

- [ ] **Step 2: Create branch and extract CS files**

```bash
git checkout main && git pull origin main
git fetch origin feat/creative-strategy-system
git checkout -b feat/creative-strategy

# Extract dedicated CS files
git checkout origin/feat/creative-strategy-system -- \
  src/app/api/creative-strategy/ \
  src/server/repositories/cs-plays.repo.ts \
  src/server/repositories/cs-signals.repo.ts \
  src/server/services/cs-plays.service.ts \
  src/server/services/cs-signals.service.ts \
  src/lib/ai/creative-strategy/ \
  src/lib/types/creative-strategy.ts \
  src/lib/validations/creative-strategy.ts \
  src/trigger/analyze-signal.ts \
  src/trigger/evaluate-play-results.ts \
  src/trigger/scan-own-account-performance.ts \
  src/frontend/api/creative-strategy.ts \
  src/__tests__/api/creative-strategy/ \
  src/__tests__/lib/validations/creative-strategy.test.ts \
  src/__tests__/server/services/cs-plays.service.test.ts \
  src/__tests__/server/services/cs-signals.service.test.ts \
  supabase/migrations/20260311000000_creative_strategy.sql \
  docs/superpowers/specs/2026-03-11-creative-strategy-system-design.md \
  docs/superpowers/plans/2026-03-11-creative-strategy-system.md
```

- [ ] **Step 3: Manually apply shared trigger task modifications**

For these 3 files, read the diff from the CS branch and apply only the CS-related changes:
- `src/trigger/scrape-engagement.ts` — CS play results population
- `src/trigger/signal-keyword-scan.ts` — exclude `content_strategy` monitors
- `src/trigger/signal-profile-scan.ts` — exclude `content_strategy` monitors

Use `git diff main...origin/feat/creative-strategy-system -- src/trigger/scrape-engagement.ts` to see the changes.

- [ ] **Step 4: Fix C1 — Anonymity logic inversion**

In `src/trigger/scrape-engagement.ts` (or wherever play result anonymity is set), find:
```typescript
const isAnonymous = userData?.plays_data_sharing === true;
```
Fix to:
```typescript
const isAnonymous = !(userData?.plays_data_sharing === true);
```

- [ ] **Step 5: Fix C2 — Promotion threshold consistency**

Extract shared constants in `src/lib/types/creative-strategy.ts`:
```typescript
export const PLAY_PROMOTION_THRESHOLDS = {
  promoteMinMultiplier: 3,
  promoteMaxVariation: 0.5,
  declineMaxMultiplier: 1.0,
  minResultsForPromotion: 5,
} as const;
```

Update both `cs-plays.service.ts` (`computePromotionSuggestion`) and `evaluate-play-results.ts` to use these shared constants.

- [ ] **Step 6: Fix M1 — data-sharing route**

Move the direct Supabase call in `src/app/api/creative-strategy/data-sharing/route.ts` into a service function. Route should just call the service.

- [ ] **Step 7: Fix M2 — evaluate-play-results repo usage**

Replace direct `supabase.from('cs_plays').select(PLAY_COLUMNS)` in the cron task with `playsRepo.findPlays()`. Remove the duplicated `PLAY_COLUMNS` constant.

- [ ] **Step 8: Fix M3 — Frontend API type alignment**

Update `src/frontend/api/creative-strategy.ts` `getPlayResults()` return type to match the actual API response shape.

- [ ] **Step 9: Fix M4 — Typed task import**

In `scan-own-account-performance.ts`, replace the dynamic string-based task trigger with a typed import of the actual task.

- [ ] **Step 10: Run verification suite**

```bash
pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

- [ ] **Step 11: Push, create PR, merge**

```bash
git push origin feat/creative-strategy
gh pr create --base main --head feat/creative-strategy --title "feat: Creative Strategy System — signal scouting, plays, and content intelligence" --body "..."
```

Merge. Close PR #39:
```bash
gh pr close 39 --repo modernagencysales/magnetlab --comment "Closed: Creative Strategy system extracted into #XX (34 files). Remaining systems deferred for separate review: GTM Accelerator (35 files + 27 tests), Copilot Rewrite (18 files), Actions/Providers (15 files), Stripe changes (2 files)."
```

- [ ] **Step 12: Build gate**

```bash
git checkout main && git pull origin main
pnpm install && pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

---

## Task 7: Phase 3 — Cleanup

**Scope:** Delete ~25 dead branches, close 3 stale PRs.

- [ ] **Step 1: Verify fix branches before deleting**

```bash
# Check if these fixes were applied elsewhere
git log --oneline --all --grep="MOD-348" | head -5
git log --oneline --all --grep="MOD-309" | head -5
```

If the fixes are on main, safe to delete. If not, cherry-pick them first.

- [ ] **Step 2: Delete empty/superseded branches**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"

# Empty branches (0 ahead)
for branch in ops-standards ui/design-system-lib arch-fix-frontend fix/mod-262-polish-failures feat/email-marketing-integrations; do
  gh api -X DELETE "repos/modernagencysales/magnetlab/git/refs/heads/$branch" 2>/dev/null && echo "Deleted $branch" || echo "Failed: $branch"
done

# Net-zero / stale
for branch in ui/revamp-v2 apis-layered-arch-migration signal-worktree bugfix/beta-release-session bugfix/sess-02; do
  gh api -X DELETE "repos/modernagencysales/magnetlab/git/refs/heads/$branch" 2>/dev/null && echo "Deleted $branch" || echo "Failed: $branch"
done

# Stale feature branches
for branch in feat/email-system feat/ai-admin-panel; do
  gh api -X DELETE "repos/modernagencysales/magnetlab/git/refs/heads/$branch" 2>/dev/null && echo "Deleted $branch" || echo "Failed: $branch"
done
```

- [ ] **Step 3: Delete verified fix branches**

```bash
for branch in fix/mod-348-generate-content-timeout iza/mod-309-magnetlab-failed-to-save-funnel-integration; do
  gh api -X DELETE "repos/modernagencysales/magnetlab/git/refs/heads/$branch" 2>/dev/null && echo "Deleted $branch" || echo "Failed: $branch"
done
```

- [ ] **Step 4: Delete Cyrus agent branches**

```bash
gh api repos/modernagencysales/magnetlab/branches --paginate --jq '.[].name' | grep "^cyrus1/" | while read branch; do
  gh api -X DELETE "repos/modernagencysales/magnetlab/git/refs/heads/$branch" 2>/dev/null && echo "Deleted $branch" || echo "Failed: $branch"
done
```

- [ ] **Step 5: Delete merged feature branches**

```bash
for branch in early-users/experiments feat/copilot-driven-creation feat/post-campaign-automation feat/mcp-v2-agent-native feat/creative-strategy-system; do
  gh api -X DELETE "repos/modernagencysales/magnetlab/git/refs/heads/$branch" 2>/dev/null && echo "Deleted $branch" || echo "Failed: $branch"
done
```

- [ ] **Step 6: Close stale PRs**

```bash
gh pr close 1 --repo modernagencysales/magnetlab --comment "Closing: Cyrus agent PR from Jan 26, superseded by current auth implementation."
gh pr close 2 --repo modernagencysales/magnetlab --comment "Closing: Cyrus agent PR from Jan 26, security headers now handled in next.config.ts."
gh pr close 6 --repo modernagencysales/magnetlab --comment "Closing: Cyrus agent PR from Jan 26, test coverage now at 1628+ tests."
```

- [ ] **Step 7: Final verification**

```bash
# Verify branch count
gh api repos/modernagencysales/magnetlab/branches --paginate --jq '.[].name' | wc -l

# Verify open PR count
gh pr list --repo modernagencysales/magnetlab --state open --json number,title

# Verify all tests pass
cd "/Users/timlife/Documents/claude code/magnetlab"
git checkout main && git pull origin main
pnpm install && pnpm typecheck && pnpm test --passWithNoTests && pnpm build
```

- [ ] **Step 8: Update memory**

Remove `project_magnetlab_remaining_bugs.md` from auto-memory (bugs are fixed). Update MEMORY.md to reflect the new state of the repo.
