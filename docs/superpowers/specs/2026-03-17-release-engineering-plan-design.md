# Release Engineering Plan — magnetlab PR Backlog

> Spec date: 2026-03-17
> Status: Approved
> Goal: Merge 5 backed-up feature PRs without degrading code quality, while raising the bar.

## Context

developerankur's bug fix branch (PR #43, 27 bugs) was reviewed and merged. 5 feature PRs remain open, all created by the repo owner (kimprobably). The developer is out today. We need to safely merge valuable features while enforcing coding standards on every line that touches main.

### Current State of Main

- Last commit: `678a369` (UNIPILE_WEBHOOK_SECRET fix, Mar 17)
- PR #43 merged: 27 bug fixes (security, UI, data scoping)
- Env vars set: `RESEND_WEBHOOK_SECRET`, `UNIPILE_WEBHOOK_SECRET` in Vercel

### Open PRs

| PR | Branch | Ahead | Behind | Files | Status |
|----|--------|-------|--------|-------|--------|
| #42 | feat/post-campaign-automation | 14 | 5 | 40 | Well-scoped feature, 2 critical bugs |
| #41 | feat/mcp-v2-agent-native | 23 | 5 | 102 | MCP rewrite, previously merged+reverted |
| #39 | feat/creative-strategy-system | 106 | 48 | 175 | Bundles 5 systems: CS (26 files), Accelerator (35), Copilot rewrite (18), Actions/Providers (15), other |
| #37 | feat/copilot-driven-creation | 95 | 48 | 226 | Forked from #35, coherent copilot feature |
| #35 | early-users/experiments | 90 | 48 | 220 | Rolling dev branch, not a feature PR |

### Branch Relationships

PR #37 forked from PR #35 at commit `29198c0` (Mar 10). They share 80 identical commits. After the fork:
- #35 has 10 unique commits (bug fixes + small features)
- #37 has 15 unique commits (copilot-driven creation)

PR #41's MCP rewrite supersedes all MCP changes in #37's shared base.

## Architecture Decisions

### Merge Order

```
Phase 1: Fortify Main (remaining bugs + tech debt)
    ↓
Phase 2a: PR #37 (shared base + copilot) — largest code drop
    ↓  ← Apply migrations 20260308, 20260309 before deploy
Phase 2b: PR #42 (post campaign automation)
    ↓  ← Apply migration 20260316 before deploy
Phase 2c: PR #41 (MCP v2) — supersedes #37's MCP additions
    ↓  ← Apply migrations 20260313, 20260313 before deploy
Phase 2d: PR #35 remainder (cherry-pick 9 commits)
    ↓
Phase 2e: PR #39 (creative strategy extract only)
    ↓  ← Apply its migration before deploy
Phase 3: Cleanup (delete branches, close stale PRs)
```

**Rationale for order:**
- Phase 1 first: establishes the quality bar everything else builds on
- #37 before #41: #37's shared base adds MCP tools that #41's rewrite will cleanly replace
- #42 between #37 and #41: independent feature, small, quick
- #35 after #37: the 80 shared commits are already on main via #37, leaving only 9 cherry-picks
- #39 last: fully independent, benefits from all other changes landing first
- Migrations before each deploy: prevents the runtime failure that caused #41's revert

### Merge Strategy

**PR #37: Merge (not rebase).** 95 commits, 12 conflict files, 53 conflict hunks. Rebasing would apply conflicts up to 95 times. Merge resolves them once.

**PR #42, #41: Rebase onto main.** Small enough for clean rebases.

**PR #35: Cherry-pick.** Only 9 post-fork commits (PromptVaultRenderer skipped — already on main).

**PR #39: Cherry-pick creative strategy files only.** Drop accelerator (~102 files) for separate review.

---

## Phase 1: Fortify Main

### Work Items

| ID | Item | Files | Description |
|----|------|-------|-------------|
| F1 | T7: Autopilot buffer team scoping | `src/lib/services/autopilot.ts` | Accept `DataScope`, use `team_profile_id` scoping instead of hardcoded `.eq('user_id')` |
| F2 | T9: external.service team_id | `src/server/services/external.service.ts:92` | Pass resolved `teamId` instead of `null` (line 145 already does this correctly) |
| F3 | T10: Wizard drafts team_id | `src/server/repositories/wizard-draft.repo.ts` | Update `team_id` when draft modified in different team context |
| F4 | T11: funnel_leads backfill | New migration | Backfill `team_id` from `funnel_page.team_id` for pre-team records |
| F5 | T12: force-dynamic | All `src/app/(dashboard)/*.tsx` pages | Add `export const dynamic = 'force-dynamic'` to pages using `getDataScope()` |
| F6 | select('*') cleanup | 15 source files, 25 queries | Replace with named column constants across: `admin.repo.ts:23,34,45,80`, `competitors.repo.ts:23`, `cp-transcripts.repo.ts:127`, `signals.repo.ts:14,71,220`, `linkedin.repo.ts:66,120,131`, `linkedin-automation.ts:32`, `team-integrations.ts:181,283`, `content.ts:63`, `admin/prompts/[slug]/page.tsx:22,30`, `signal-push-heyreach.ts:23`, `signal-profile-scan.ts:35`, `signal-company-scan.ts:24`, `signal-enrich-and-score.ts:47`, `signal-keyword-scan.ts:25`, `playbook-sync.ts:226,245` |
| F7 | .worktrees cleanup | `.worktrees/creative-strategy/` | Delete stale worktree causing 11 test suite failures in Jest |

### Standards Applied
- Every new column constant gets a named export (e.g., `SIGNAL_LEAD_COLUMNS`)
- Column lists verified against `information_schema.columns` before committing
- T11 migration tested locally before push

### Deliverable
Single PR: `fix/fortify-main`. All items in one commit or logically grouped commits.

---

## Phase 2a: PR #37 — Copilot + Shared Base

### Overview
95 commits, 226 files. Contains 80 shared-base commits (5 feature systems + 15 bug fixes) plus 15 copilot-specific commits.

### Pre-Merge: Apply Migrations
```sql
-- 20260308000000_position_synthesis.sql (new table, no dependencies)
-- 20260309000000_section_variants.sql (adds variant column to funnel_page_sections)
```
Apply to production Supabase before deploying.

### Merge Conflicts (12 files, 53 hunks)

| File | Hunks | Difficulty | Resolution Strategy |
|------|-------|------------|-------------------|
| `PostDetailModal.tsx` | 14 | Hard | Both sides reworked UI heavily. Read both versions, reconcile feature additions. Keep main's template picker + #37's copilot integration. |
| `SectionsManager.tsx` | 11 | Hard | Main added per-type config editors, #37 restructured existing editors. Keep both — they're additive in different areas. |
| `funnels.service.ts` | 5 | Medium | Main added `teamId` to `bulkCreateFunnels` (bugfix). #37 added section placement validation. Keep both. |
| `ContentPageTab.tsx` | 3 | Medium | Main added "Open Content Page" button, #37 restructured edit actions. Reconcile button ordering. |
| `DetailPane.tsx` | 7 | Medium | Both refactored the component. Read both diffs, merge intent. |
| `CLAUDE.md` | 1 | Trivial | Concatenate both additions. |
| `ai-copilot.md` | 4 | Trivial | Take #37's version (it's the feature doc). |
| `SectionBridge.tsx` | 1 | Trivial | CSS formatting — pick either. |
| `IdeasTab.tsx` | 1 | Trivial | #37 added copilot button, no semantic conflict. |
| `PostsTab.tsx` | 1 | Trivial | Import formatting only. |
| `PostsContent.tsx` | 2 | Easy | Main migrated to magnetui; #37 added Zap icon. Keep main's design system + #37's feature. |
| `MagnetsListClient.tsx` | 3 | Easy | Main reformatted, #37 added copilot trigger. Keep both. |

### Feature Systems in Shared Base — Review Checklist

**Funnel Restyler (~8 commits)**
- [ ] `restyle.service.ts` follows Route → Service → Repo
- [ ] `plan-generator.ts` AI module uses `createAnthropicClient` pattern
- [ ] RestylePanel.tsx under 300 lines
- [ ] API routes under 30 lines
- [ ] Tests exist for service + AI module

**Enhanced Page Builder (~12 commits)**
- [ ] 6 new renderers (ds/) follow component standards
- [ ] Section variant schemas have Zod tests
- [ ] Migration adds column safely (nullable or with default)
- [ ] No components over 300 lines
- [ ] SectionsManager changes don't break existing section editing

**Inline Content Editor (~4 commits)**
- [ ] No raw `fetch()` in components
- [ ] State management uses hooks, not prop drilling
- [ ] Editor save flow handles errors visibly

**Knowledge Position Synthesis (~3 commits)**
- [ ] Route → Service → Repo pattern followed
- [ ] Trigger task has error handling + logging
- [ ] Migration creates new table (safe, no existing table changes)

**MCP Enhancements (~8 commits)**
- [ ] Will be overwritten by PR #41 — review for correctness but don't block on style
- [ ] Pagination implementation is sound
- [ ] No breaking changes to existing MCP tools

**AI Brain Wiring (~3 commits)**
- [ ] Knowledge context injection uses `getRelevantContext` or `searchKnowledge`
- [ ] Failure to get knowledge context doesn't block the main operation
- [ ] Context is size-limited to prevent prompt overflow

**Bug Fixes (MOD-346 through MOD-428)**
- [ ] Cross-reference with Ankur's bugfix merge — no duplicates
- [ ] Each fix is correct and doesn't introduce new issues
- [ ] MOD-381 (DFY funnel/email-sequence scope) doesn't conflict with our `getDataScope` fix

**Standards/CLI (~6 commits)**
- [ ] GitHub Actions are non-blocking (won't prevent merges if they fail)
- [ ] CLI in `packages/mcp/` will be overwritten by PR #41 — no concern
- [ ] Scripts in `.github/scripts/` don't modify source code

### Copilot Feature (15 unique commits) — Review Checklist
- [ ] CopilotProvider follows existing provider patterns
- [ ] ContentReviewPanel under 300 lines
- [ ] 6 copilot actions use service layer, not direct DB access
- [ ] Brain-aware extraction handles missing knowledge gracefully
- [ ] 46 tests cover happy path + error cases
- [ ] System prompt changes don't break existing copilot functionality
- [ ] Entry points (wizard, ideas, library) are wired correctly

### Standards Fixes During Merge
Any violations found during review get fixed in the merge commit or a follow-up commit before the PR is marked as merged. No "fix later."

### Deliverable
Merge main into `feat/copilot-driven-creation`, resolve all 12 conflict files, fix any standards violations found during review, push, merge PR.

---

## Phase 2b: PR #42 — Post Campaign Automation

### Pre-Merge: Apply Migration
```sql
-- 20260316200000_post_campaigns.sql (3 new tables + RPC function)
```

### Critical Fixes

| ID | Issue | Fix |
|----|-------|-----|
| C1 | RPC name mismatch: `increment_daily_limit` in SQL vs `increment_linkedin_daily_limit` in repo | Change repo call to `increment_daily_limit` |
| C2 | Unconstrained column access in `SECURITY DEFINER` RPC: any authed user can increment any column via PostgREST | Add `IF p_field NOT IN ('dms_sent', 'connections_accepted', 'connection_requests_sent') THEN RAISE EXCEPTION` inside function. Create a new migration for this. |

### Medium Fixes

| ID | Issue | Fix |
|----|-------|-----|
| M1 | No Zod validation on POST/PATCH | Add `CreatePostCampaignSchema`, `UpdatePostCampaignSchema` to `src/lib/validations/api.ts` |
| M2 | No `ALLOWED_UPDATE_FIELDS` | Add to repo, filter updates through whitelist |
| M3 | `test-dm` route bypasses service layer | Move DB logic into `postCampaignsService.sendTestDm()` |
| M4 | No `getStatusCode()` on service | Add + refactor route handlers to use it |
| M5 | N+1 query in HeyReach dedup | Batch `IN` query for `isLinkedInUrlInAnyCampaign()` |

### Low Fixes

| ID | Issue | Fix |
|----|-------|-----|
| L1 | Status query param unsafe cast | Validate against literal union type |
| L2 | Missing route tests | Add tests for POST, GET, PATCH, activate, pause |
| L3 | Missing Zod schema tests | Add tests for both new schemas |

### Conflict Resolution
After #37 is merged, `funnels.service.ts` will have a small conflict in the import block. Resolve by keeping #37's imports + adding #42's additions.

### Deliverable
Rebase onto main (post-#37), apply all fixes, push, merge PR.

---

## Phase 2c: PR #41 — MCP v2 Agent-Native

### Pre-Merge: Apply Migrations (CRITICAL — this caused the revert)
```sql
-- 20260313000000_add_lead_magnet_content_field.sql (content + content_version on lead_magnets)
-- 20260313010000_add_post_source_and_agent_metadata.sql (source + agent_metadata on cp_pipeline_posts)
```
**Verify columns exist with `information_schema.columns` query before merging.**

### Critical Fixes

| ID | Issue | Fix |
|----|-------|-----|
| C1 | Missing `findLeadMagnetByOwner` user_id security fix | Ensure `.eq('user_id', userId)` is present after rebase (main has this fix) |
| C2 | `createAgentPost()` skips team scoping | Accept `DataScope`, use `team_profile_id` |
| C3 | `scheduleWeek()` skips team scoping | Accept `DataScope`, use `team_profile_id` |

### Medium Fixes

| ID | Issue | Fix |
|----|-------|-----|
| M1 | `POST /content-pipeline/posts` is 54 lines | Extract Zod error formatting to helper |
| M2 | Analytics error handler calls `auth()` twice | Capture `session.user.id` before try/catch |
| M3 | Verify `LM_LIST_COLUMNS` doesn't break UI | Check all list-view components for dependency on excluded fields |

### Conflict Resolution (7 files)
Hardest: `funnels.service.ts` (MCP adds `validateContentForPublish()` logic, main's bugfix reformats same area). Strategy: take main as base, layer MCP's validation on top.

Critical: `lead-magnets.repo.ts` must preserve the `.eq('user_id', userId)` security fix while incorporating `LM_LIST_COLUMNS` and `updateLeadMagnetContent()`.

### Post-Merge
`npm publish` the updated MCP package from `packages/mcp/`.

### Deliverable
Rebase onto main (post-#42), apply all fixes, verify migrations are live, push, merge PR.

---

## Phase 2d: PR #35 — Experiments Remainder

### Context
With #37 merged, the 80 shared commits are on main. Only 10 post-fork commits remain.

### Source
Cherry-picks come from `origin/early-users/experiments` (remote ref). The local branch may be stale — always use the remote.

### Cherry-Pick List

| Commit | SHA | Action |
|--------|-----|--------|
| MOD-429: clickable magnet rows + team modal | `3029dea` | Cherry-pick |
| MOD-436: team-to-personal switching | `5d52fe3` | Cherry-pick |
| Editable header/subheader | `05bca4e` | Cherry-pick |
| Font picker in funnel builder | `67d4433` | Cherry-pick |
| Edit indicators for header/subheader | `b2f1b5c` | Cherry-pick |
| Attio transcript routing | `5a51817` | Cherry-pick |
| PromptVaultRenderer | `38fd600` | **Skip** — already on main |
| magnetui build fix | `2a9c7e0` | Cherry-pick |
| avatar_url column fix | `22b0eb9` | Cherry-pick |
| resource-grid block type | `65548d2` | Cherry-pick |

### Conflict Risk
1 file (`MagnetsListClient.tsx`) modified by both #35 and #37. Cherry-pick will need manual resolution.

### Standards Check
- Each cherry-picked change gets typecheck + build verification
- Fix any standards violations discovered during cherry-pick
- Add tests if any cherry-picked feature lacks them

### Deliverable
New branch `fix/experiments-cherry-picks` from main. Cherry-pick 9 commits, fix conflicts, create PR, merge. Close PR #35 with comment documenting what was extracted and what was skipped.

---

## Phase 2e: PR #39 — Creative Strategy Extract

### Full PR #39 Audit (175 files, some shared across categories)

| Category | Files | Disposition |
|----------|-------|-------------|
| **Creative Strategy** | 26 | **Extract now** — well-isolated, good tests |
| **CS Tests** | 5 | **Extract now** — paired with CS files |
| **Accelerator** | 35 | **Defer** — separate review cycle |
| **Accelerator Tests** | 27 | **Defer** — paired with accelerator |
| **Copilot Rewrite** | 18 | **Defer** — conflicts with #37's copilot additions |
| **Copilot Tests** | 11 | **Defer** |
| **Actions/Providers Framework** | 15 | **Defer** — tied to accelerator |
| **Provider Tests** | 4 | **Defer** |
| **Stripe Changes** | 2 | **Defer** — accelerator billing |
| **Stripe Test** | 1 | **Defer** |
| **Middleware** | 1 | **Defer** — adds `/accelerator` route |
| **Migrations** | 7 | **1 CS (extract), 1 providers + 5 accelerator (defer)** |
| **Docs** | 11 | **2 CS (extract), 8 accelerator + 1 SOP (defer)** |
| **Other** | 11 | **CLAUDE.md CS section (extract), rest defer** |
| **Eval Scripts** | 5 | **Defer** |
| **Seed Scripts** | 6 | **Defer** |

### Extraction Method
**File-level extraction, not cherry-pick.** The CS commits are mostly isolated (14 of 17 touch only CS files), but 3 commits modify shared trigger tasks (`scrape-engagement.ts`, `signal-keyword-scan.ts`, `signal-profile-scan.ts`). Use `git checkout feat/creative-strategy-system -- <file-list>` for the 26 dedicated CS files, then manually apply the 3 shared-file modifications.

### Creative Strategy Files to Extract (34 total)
**API Routes (11):** `src/app/api/creative-strategy/` — config, data-sharing, plays CRUD, signals CRUD, templates CRUD
**Server (4):** `cs-plays.repo.ts`, `cs-signals.repo.ts`, `cs-plays.service.ts`, `cs-signals.service.ts`
**AI (2):** `media-classifier.ts`, `signal-analyzer.ts`
**Types/Validations (2):** `creative-strategy.ts` types + validations
**Trigger (3 new):** `analyze-signal.ts`, `evaluate-play-results.ts`, `scan-own-account-performance.ts`
**Trigger (3 modified):** CS additions to `scrape-engagement.ts`, `signal-keyword-scan.ts`, `signal-profile-scan.ts`
**Frontend (1):** `creative-strategy.ts` API module
**Tests (5):** plays, signals, validations, service tests
**Migration (1):** `20260311000000_creative_strategy.sql`
**Docs (2):** CS design doc + implementation plan

### Deferred Systems (for separate review cycles)
1. **GTM Accelerator** (35 files + 27 tests + 5 migrations + 6 scripts + 8 docs) — full coaching/copilot system with Stripe billing, enrollment, diagnostics, sub-agents. Needs its own design review.
2. **Copilot Rewrite** (18 files + 11 tests) — sub-agent dispatch, chat-agent-loop. Will conflict with #37's copilot additions. Must be reconciled after #37 lands.
3. **Actions/Providers Framework** (15 files + 4 tests + 1 migration) — tied to accelerator enrollment and provider execution.
4. **Stripe Changes** (2 files + 1 test) — accelerator-specific billing modifications.

### Critical Fixes Before Merge

| ID | Issue | Fix |
|----|-------|-----|
| C1 | Anonymity logic inverted: `plays_data_sharing === true` marks user as anonymous | Flip to `!(userData?.plays_data_sharing === true)` |
| C2 | Promotion thresholds contradictory: service says 5x, cron says 1.5x | Extract shared constants, use one set of thresholds |

### Medium Fixes

| ID | Issue | Fix |
|----|-------|-----|
| M1 | `data-sharing/route.ts` bypasses service layer | Move to service, route just delegates |
| M2 | `evaluate-play-results` cron bypasses repo layer | Use `playsRepo.findPlays()` instead of direct Supabase |
| M3 | Frontend API types don't match API responses | Align `getPlayResults()` return type |
| M4 | `scan-own-account` uses string task ID instead of typed import | Import actual task for type safety |

### Deliverable
New branch `feat/creative-strategy` from main. Extract CS files via `git checkout feat/creative-strategy-system -- <file-list>`, manually apply the 3 shared trigger task modifications, apply all fixes, create PR, merge. Close PR #39 with comment explaining accelerator was extracted for separate review cycle.

---

## Phase 3: Cleanup

### Delete Branches (~25)

**Empty/superseded:**
- `ops-standards` (0 ahead)
- `ui/design-system-lib` (0 ahead)
- `ui/revamp-v2` (net-zero: commit + revert)
- `arch-fix-frontend` (0 ahead, 118 behind)
- `fix/mod-262-polish-failures` (0 ahead, 257 behind)
- `feat/email-marketing-integrations` (0 ahead)
- `apis-layered-arch-migration` (superseded)
- `signal-worktree` (stale worktree)
- `bugfix/beta-release-session` (superseded by sess-02)
- `bugfix/sess-02` (merged as PR #43)

**Stale feature branches:**
- `feat/email-system` (18 ahead, 419 behind)
- `feat/ai-admin-panel` (15 ahead, 290 behind)

**Check before deleting:**
- `fix/mod-348-generate-content-timeout` (1 ahead, 161 behind) — verify fix was applied elsewhere
- `iza/mod-309-funnel-integration` (1 ahead, 262 behind) — verify fix was applied elsewhere

**Cyrus agent branches (16):**
- All `cyrus1/mod-*` branches — 100-500+ commits behind, all superseded

### Close Stale PRs
- PR #1 (email verification) — Cyrus agent, Jan 26, stale
- PR #2 (security headers) — Cyrus agent, Jan 26, stale
- PR #6 (unit tests) — Cyrus agent, Jan 26, stale

### Post-Merge Cleanup
- Delete `early-users/experiments` branch (after cherry-picks extracted)
- Delete `feat/copilot-driven-creation` branch (after merged)
- Delete `feat/post-campaign-automation` branch (after merged)
- Delete `feat/mcp-v2-agent-native` branch (after merged)
- Delete `feat/creative-strategy-system` branch (after CS extracted)
- Remove `.worktrees/creative-strategy/` directory (if not already done in Phase 1)

### Final State
- main: all bugs fixed, 4 features landed at full standards, tech debt cleaned
- Branches: only main + any active development branches
- PRs: no stale PRs
- Tests: all passing (including the 11 suites that were failing due to .worktrees)

---

## Build Gates Between Phases

After each phase merges to main, run the full verification suite before starting the next phase:

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git checkout main && git pull origin main
pnpm install
pnpm typecheck
pnpm test --passWithNoTests
pnpm build
```

If any step fails, fix it on main before proceeding. Do not start the next phase with a broken main.

## Rollback Strategy

| Phase | Rollback Method |
|-------|----------------|
| Phase 1 | `git revert <commit>` — all changes are additive |
| Phase 2a (#37) | `git revert -m 1 <merge-commit>` — single revert of merge commit |
| Phase 2b (#42) | `git revert <commit>` — small rebase, clean revert |
| Phase 2c (#41) | `git revert <commit>` — but DB columns persist (safe, they're additive) |
| Phase 2d (#35) | `git revert <cherry-pick-commits>` — individual reverts |
| Phase 2e (#39) | `git revert <commit>` — CS files are self-contained |

**Migration rollback:** All migrations in this plan are additive (new tables, new columns, DROP NOT NULL). None need schema rollback — the columns/tables can safely persist even if code is reverted.

## Success Criteria

1. **Zero standards regressions** — every merged line meets the coding standards in CLAUDE.md
2. **All critical bugs fixed** — RPC mismatch, SQL injection, anonymity inversion, missing auth
3. **All migrations applied before code deploys** — no repeat of the #41 revert
4. **Clean git history** — no rolling dev branches, no 200-file PRs, clear commit messages
5. **Developer reaction** — "wow that's amazing" when Ankur reviews the state of main
