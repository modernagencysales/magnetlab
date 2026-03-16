# Beta Release - Bug Report

> Investigated 2026-03-12. All bugs found during manual QA of the new UI on `main`.

---

## Bug 1: Select.Item crash on all team-scoped pages

- **Severity:** Critical (crashes entire page)
- **Pages affected:** Posts, Knowledge, Content Pipeline, Branding Settings, Autopilot — any page with a Select dropdown when in team context. Confirmed on `/posts` and `/knowledge` pages.
- **Error:** `A <Select.Item /> must have a value prop that is not an empty string`
- **Root cause:** 4 components pass `value=""` to Radix `<SelectItem>`, which Radix explicitly forbids. The main culprit is `ProfileSwitcher.tsx` which only renders when in team mode (2+ profiles), explaining why it only crashes in team context.
- **Files to fix:**
  - `src/components/content-pipeline/ProfileSwitcher.tsx:52` — `<SelectItem value="">All Members</SelectItem>`
  - `src/components/settings/BrandingSettings.tsx:544` — `<SelectItem value="">System Default</SelectItem>`
  - `src/components/content-pipeline/TranscriptPasteModal.tsx:202` — `<SelectItem value="">Auto-detect / Default</SelectItem>`
  - `src/components/content-pipeline/AutopilotTab.tsx:286` — `<SelectItem value="">Any day</SelectItem>`
- **Fix:** Replace `value=""` with a sentinel value like `value="__all__"` / `value="__default__"` / `value="__any__"`, and update the `onValueChange` handlers to translate the sentinel back to `null`/`""`. Also update the Select's `value` prop (e.g., `ProfileSwitcher.tsx:47` passes `selectedProfileId || ''` — needs the same sentinel).

---

## Bug 2: Generate Images fails in dev (ScreenshotOne network error)

- **Severity:** Low (dev-only, works in production)
- **Page:** `/magnets/[id]?tab=post` — "Generate Images" button
- **Error:** `ScreenshotOne API error (500): network_error — can't connect to the provided URL`
- **Root cause:** `NEXT_PUBLIC_APP_URL` is `http://localhost:3000` in dev. The screenshot service sends this localhost URL to ScreenshotOne's external servers, which can't reach your machine.
- **Files:**
  - `src/server/services/lead-magnets.service.ts:397-398` — constructs URL from `NEXT_PUBLIC_APP_URL`
- **Fix:** Either (a) always use the production URL for screenshots regardless of env, or (b) show a user-facing warning in dev mode. Also: the fallback URL on line 397 is `magnetlab.ai` but should be `magnetlab.app`.

---

## Bug 3: Lead form submission "Failed to capture lead"

- **Severity:** Critical (blocks lead capture — core product feature)
- **Page:** `/p/[username]/[slug]` — public opt-in form
- **Error:** "Failed to capture lead" after entering email and clicking "Get Free Access"
- **Root cause:** The `funnel_leads` table has `lead_magnet_id NOT NULL` constraint (from original migration `20250126010000_funnel_pages.sql:77`), but a later migration (`20260204220000_libraries_and_assets.sql:97`) made `funnel_pages.lead_magnet_id` **nullable** to support library/external-resource pages. When a funnel page has no lead magnet attached, `funnel.lead_magnet_id` is null, and the insert fails with a NOT NULL constraint violation.
- **Files:**
  - `src/server/services/public.service.ts:263-276` — inserts `funnel.lead_magnet_id` (can be null)
  - `src/server/repositories/public.repo.ts:33-42` — raw Supabase insert
  - `src/app/api/public/lead/route.ts:68` — returns "Failed to capture lead"
- **Fix:** Create a migration: `ALTER TABLE funnel_leads ALTER COLUMN lead_magnet_id DROP NOT NULL;`

---

## Bug 4: User-uploaded images broken on public pages (also in production)

- **Severity:** High (visible to end-users on live pages)
- **Page:** `/p/rachel-pierre/the-paris-deployment-kit-...` — broken image icon above title
- **Root cause:** The `logo_url` stored in `funnel_pages` is an Imgur **album** URL (`https://imgur.com/a/yLnv1b4`), which returns HTML, not an image binary. The existing `normalizeImageUrl()` utility converts single Imgur image URLs (`imgur.com/{ID}` -> `i.imgur.com/{ID}.jpg`) but intentionally skips album URLs since they can't be resolved to a single image. No validation rejects non-image URLs on save.
- **Files:**
  - `src/components/funnel/public/OptinPage.tsx:146-148` — renders `<Image src={logoUrl}>` with no `onError` fallback
  - `src/lib/utils/normalize-image-url.ts:26` — skips album URLs
  - `src/components/funnel/ThemeEditor.tsx:206-244` — logo URL text input with no image validation
  - `src/lib/validations/api.ts:243` — Zod schema accepts any valid URL
- **Fix (3 layers):**
  1. Add `onError` handler to `<Image>` in `OptinPage.tsx` to hide broken logos (defensive)
  2. Reject known non-image URL patterns (album URLs, gallery pages) in `normalizeImageUrl()` or Zod validation
  3. Optionally: validate the URL returns an image Content-Type before saving

---

## Bug 5: Team switching — Lead Magnets disappear

- **Severity:** Critical (user loses access to all their work)
- **Page:** `/magnets` — after toggling between personal account and client team
- **Reporter:** creativemillion777@gmail.com (user_id: `05bbdcce-533b-4ea4-a01a-d3e6ec634c31`)
- **Error:** "All of my Lead Magnets were gone" after switching from client team back to personal account
- **Root cause:** Next.js Router Cache + client-side cookie. The `ml-team-context` cookie is set client-side via `document.cookie`, then `router.push('/')` navigates. But Next.js App Router caches Server Components aggressively. The `/magnets` page is a Server Component that reads the cookie via `getDataScope()`. After switching teams, the router cache may serve the previously rendered page (with the old team scope that has zero magnets).
- **Known bug:** Documented as MOD-95 in `src/__tests__/lib/utils/team-context.test.ts`
- **Contributing factor:** The multi-team migration (`20260217000000_multi_team.sql`) backfilled `team_id` on all existing lead_magnets, which could cause scoping confusion.
- **Files:**
  - `src/app/team-select/page.tsx:45-51` — sets cookie client-side
  - `src/lib/utils/team-context.ts:151-156` — `applyScope()` filters queries
  - `src/app/(dashboard)/magnets/page.tsx` — Server Component, may serve cached version
- **Fix:** Use `router.refresh()` after setting the cookie (or use a Server Action to set the cookie) to force Server Components to re-render with the new scope. Consider adding `revalidatePath('/')` or equivalent cache invalidation.

---

## Bug 6: Team switching — "Setting up hosted page isn't working"

- **Severity:** High (blocks lead magnet publishing for team users)
- **Page:** `/create` (wizard publish step)
- **Reporter:** creativemillion777@gmail.com (same user as Bug 5)
- **Root cause:** Same underlying team caching issue as Bug 5. The funnel creation service calls `verifyLeadMagnetOwnership(scope.userId, leadMagnetId)` which checks `.eq('user_id', userId)`. If the cached scope from the wrong team context is used, the ownership check fails.
- **Files:**
  - `src/server/services/funnels.service.ts:102` — ownership verification
  - `src/server/repositories/funnels.repo.ts:274-284` — `verifyLeadMagnetOwnership` query
- **Fix:** Same as Bug 5 — fix team switching cache invalidation. The ownership check itself is correct; the issue is stale scope data.

---

## Bug 7: Font saving doesn't persist in Branding Settings

- **Severity:** High (branding feature broken)
- **Page:** `/settings/branding` — font picker
- **Error:** User selects a Google Font and saves, but it doesn't persist. No error shown to user.
- **Root cause (3 layers):**
  1. `buildBrandKitPayload` in `brand-kit.service.ts` always constructs a full payload including `business_description` and `business_type` (lines 20-60). When BrandingSettings sends a partial update (just `fontFamily`), these fields are `undefined`. The Supabase upsert tries an INSERT with NULL for NOT NULL columns → constraint violation.
  2. Even if that were fixed, the function defaults array fields (`credibility_markers`, `urgent_pains`, `templates`, etc.) to `[]` via `?? []`. Every partial save from BrandingSettings would **wipe these arrays**.
  3. The error is silently swallowed — `BrandingSettings.tsx` has an empty `catch {}` block (lines 119-128).
- **Additional issue:** The branding page server component (`settings/branding/page.tsx:21`) omits `website_url` from its SELECT query, so website URL never loads.
- **Files to fix:**
  - `src/server/services/brand-kit.service.ts:20-60` — `buildBrandKitPayload` needs split into full upsert vs partial update
  - `src/server/repositories/brand-kit.repo.ts` — partial updates should use `.update()` not `.upsert()`
  - `src/components/settings/BrandingSettings.tsx:119-128` — empty catch block, surface errors to user
  - `src/app/(dashboard)/settings/branding/page.tsx:21` — add `website_url` to SELECT
- **Fix:** Split the brand-kit save into two modes: (a) full upsert from wizard (all fields), (b) partial update from BrandingSettings (only visual fields, use `.update()` not `.upsert()`). Surface errors in the catch block.

---

## Bug 8: "Failed to create flow" on Email > Flows

- **Severity:** High (email flows feature completely broken)
- **Page:** `/email/flows` — clicking "Create Your First Flow"
- **Error:** "Failed to create flow"
- **Root cause:** The `email_flows` table was originally created by gtm-system with `tenant_id UUID NOT NULL`. Magnetlab's migration used `CREATE TABLE IF NOT EXISTS` — a no-op since the table already existed with different columns. A fix migration (`20260224100000_email_system_fix_columns.sql`) added `team_id` and `user_id` columns but **never made `tenant_id` nullable**. The magnetlab insert sets `team_id` + `user_id` but never sets `tenant_id`, causing a NOT NULL constraint violation.
- **Files:**
  - `src/server/repositories/email.repo.ts:339-353` — insert never sets `tenant_id`
  - `src/server/services/email.service.ts:219` — `createFlow()` call
  - `src/app/api/email/flows/route.ts:52` — returns "Failed to create flow"
  - `supabase/migrations/20260224100000_email_system_fix_columns.sql` — fix migration that missed `tenant_id`
- **Fix:** Migration: `ALTER TABLE email_flows ALTER COLUMN tenant_id DROP NOT NULL;` — same fix needed for `email_flow_contacts` table.

---

## Teams Feature — Full Audit

> The teams feature has two systemic issues that cause most of the bugs below:
>
> 1. **No cache invalidation after team switch** — `router.push('/')` without `router.refresh()` serves stale server-rendered pages
> 2. **Dual scoping strategies** — core tables use `team_id`, content pipeline tables use `team_profile_id`. The generic `applyScope()` only handles `team_id`, so it breaks on content pipeline tables.

### P0 (Critical)

**T1: No `router.refresh()` after team switch — root cause of "content disappearing"**

- `src/app/team-select/page.tsx:46` — `router.push('/')` without `router.refresh()`
- `src/app/(dashboard)/team/page.tsx:115` — same issue
- No `revalidatePath()` calls anywhere for team switching
- No `export const dynamic = 'force-dynamic'` on any dashboard page
- **Fix:** Call `router.refresh()` after `router.push('/')`, or use a server action with `revalidatePath('/', 'layout')`

**T2: Analytics page crashes in team mode — `applyScope()` on `cp_pipeline_posts`**

- `src/server/repositories/analytics.repo.ts:24` — applies `.eq('team_id', teamId)` but `cp_pipeline_posts` has NO `team_id` column (uses `team_profile_id`)
- PostgREST returns 400, crashing analytics for all team users
- **Fix:** Use `team_profile_id`-based scoping (same as `posts.repo.ts`)

**T3: Dashboard home shows wrong counts in team mode**

- `src/app/(dashboard)/page.tsx:73-85` — hardcodes `.eq('user_id', userId)` for `cp_call_transcripts`, `cp_pipeline_posts`, `brand_kits`
- Team members (non-owners) see zero counts
- **Fix:** Use `applyScope()` for tables with `team_id`, `team_profile_id` pattern for posts

**T4: Bulk page import creates records without `team_id`**

- `src/server/services/funnels.service.ts:764` — omits `team_id` on lead magnet + funnel page inserts
- Records invisible in team mode
- **Fix:** Accept `scope: DataScope`, include `team_id: scope.teamId || null`

**T5: DFY automation webhook creates lead magnets without `team_id`**

- `src/server/services/webhooks-incoming.service.ts:298` — passes `null` for `team_id`
- **Fix:** Resolve user's team context and pass appropriate `team_id`

### P1 (High)

**T6: Email system broken for personal-mode users**

- All email API routes (subscribers, broadcasts, flows) use `requireTeamScope()`
- Returns "No team found for this user" for users without a team
- Entire email system non-functional for personal-mode users
- **Fix:** Fall back to `user_id` scoping, or show clear UI message

**T7: Autopilot buffer status ignores team context**

- `src/lib/services/autopilot.ts:448` — `getBufferStatus(userId)` hardcodes `.eq('user_id', userId)`
- Team members see empty buffer + incorrect "Buffer Low" warning
- **Fix:** Accept `DataScope`, use `team_profile_id` scoping

**T8: Content pipeline dual scoping strategy causes data gaps**

- `posts.repo.ts` and `ideas.repo.ts` use `team_profile_id` (correct)
- `analytics.repo.ts` uses `applyScope()` with `team_id` (wrong for `cp_` tables)
- **Fix:** Analytics repo should use `team_profile_id` for posts/ideas

**T9: `external.service.ts` inconsistent `team_id` in creation paths**

- Line 92: passes `null` for `team_id`
- Line 145: correctly passes `teamId`
- **Fix:** Pass resolved `teamId` in both paths

### P2 (Medium)

**T10: Wizard drafts don't update `team_id` on team switch**

- `src/server/repositories/wizard-draft.repo.ts:53-56` — `updateDraft()` filters by `user_id` only
- Draft started in personal mode invisible after switching to team
- **Fix:** Update `team_id` when draft is modified in different team context

**T11: `funnel_leads` backfill misses pre-team records**

- Migration `20260217000000_multi_team.sql:25` — only backfills where `user_id = owner_id`
- Historical leads from before team creation have NULL `team_id`, invisible in team mode
- **Fix:** Backfill based on `funnel_page.team_id`

**T12: No `force-dynamic` on any dashboard Server Component**

- All pages under `src/app/(dashboard)/` lack `export const dynamic = 'force-dynamic'`
- Cookie reads via `getDataScope()` should mark pages dynamic, but safer to be explicit
- **Fix:** Add `export const dynamic = 'force-dynamic'` to all dashboard pages using `getDataScope()`

---

## Code Review — Additional Bugs Found

### Security

**S1: Unipile webhook has NO authentication**

- `src/app/api/webhooks/unipile/route.ts:7-9` — zero auth. Anyone can POST to overwrite user integrations or trigger background tasks with arbitrary data.
- **Fix:** Add shared secret verification (like Grain/Fireflies webhooks use `?secret=` param)

**S2: `findLeadMagnetByOwner` missing `user_id` filter — authorization bypass**

- `src/server/repositories/lead-magnets.repo.ts:56-64` — accepts `userId` param but never filters by it. Query only filters by `id`.
- Callers in `external.service.ts` (lines 839, 983, 1005, 1022) don't do secondary `user_id` check — any authenticated external API user can access any other user's lead magnet by ID.
- **Fix:** Add `.eq('user_id', userId)` to the query

**S3: Thankyou page leaks lead email via props**

- `src/app/p/[username]/[slug]/thankyou/page.tsx:181-188,295` — `leadId` from query param is unauthenticated. Any visitor who guesses a UUID can read another lead's email from serialized React props.
- **Fix:** Verify the visitor is the lead (e.g., session token match)

**S4: Admin import-subscribers route missing superadmin check**

- `src/app/api/admin/import-subscribers/route.ts:8-11` — only checks `session?.user?.id`, not `isSuperAdmin()`. Any authenticated user can bulk-import subscribers to any team.
- **Fix:** Add `isSuperAdmin()` guard

**S5: Resend webhook signature verification is optional**

- `src/app/api/webhooks/resend/route.ts:14-37` — if `RESEND_WEBHOOK_SECRET` env var is unset, accepts ALL requests. Could corrupt email analytics.
- **Fix:** Fail closed — reject requests if secret is not configured

**S6: FontLoader CSS injection risk on public pages**

- `src/components/funnel/public/FontLoader.tsx:40` — `fontUrl` interpolated into `<style>` via `dangerouslySetInnerHTML`. `isValidStorageUrl()` checks hostname but not path/query injection.
- **Fix:** Stricter URL validation (allowlist path patterns)

### Data Bugs

**D1: Signal enrich task processes ALL users' events (discarded query filter)**

- `src/trigger/signal-enrich-and-score.ts:187` — Supabase query builder is immutable: `.in()` returns new query but result is not reassigned. The `user_id` filter is silently discarded, burning AI credits on all users' events.
- **Fix:** `unscoredQuery = unscoredQuery.in('user_id', sentimentUserIds)`

**D2: Subscriber-sync webhook passes unnormalized email**

- `src/app/api/webhooks/subscriber-sync/route.ts:59-60` — normalizes email on line 43 but passes original `p.email` to service. Creates duplicate subscriber records with mixed-case emails.
- **Fix:** Pass `email` (normalized) instead of `p.email`

**D3: `deleteFunnelIntegration` rejects GoHighLevel and HeyReach**

- `src/server/services/funnels.service.ts:731` — uses `isEmailMarketingProvider()` (only 4 providers) instead of `isValidFunnelProvider()` (6 providers). Users can save GHL/HeyReach integrations but can never delete them.
- **Fix:** Use `isValidFunnelProvider()` for the delete validation

**D4: Hardcoded author "Tim Keen" in all generated lead magnet content**

- `src/lib/ai/generate-lead-magnet-content.ts:23-24` — every user's generated content references Tim Keen's credentials
- **Fix:** Pass user's actual name/context from brand kit or profile

### Frontend Bugs

**F1: Qualification filter on Leads page is inverted**

- `src/components/leads/LeadsPageClient.tsx:103,284-286` — select options use `value="true"/"false"` but filter checks `=== 'qualified'`. Selecting "Qualified Only" shows unqualified leads instead.
- **Fix:** Change `'qualified'` to `'true'` on line 103

**F2: Broadcast retry doesn't actually reset status to draft**

- `src/components/email/BroadcastEditor.tsx:222-239` — `handleRetry` sends update without `status: 'draft'`. Shows success toast but broadcast stays in failed state.
- **Fix:** Include `status: 'draft'` in update payload

**F3: Double API call on every Leads search keystroke**

- `src/components/leads/LeadsPageClient.tsx:137-153` — two `useEffect` hooks both trigger `fetchLeads` on search change: one immediate, one debounced at 300ms. Doubles API load, causes table flicker.
- **Fix:** Remove `search` from `fetchLeads` useCallback deps, only trigger via debounced effect

**F4: Auto-save on funnel tab switch saves stale data**

- `src/frontend/hooks/useFunnelBuilder.ts:215,276-284` — `handleSave` captures form state via closure. Auto-save effect depends only on `[activeTab]`, so it fires with stale values.
- **Fix:** Wrap `handleSave` in `useCallback` with form values as deps

**F5: `isPolling` is always false during active polling**

- `src/frontend/hooks/useBackgroundJob.ts:99,102` — `startPolling` sets `true` then immediately calls `stopPolling()` which sets `false`. React batches = false wins.
- **Fix:** Clear intervals/timeouts directly without calling `stopPolling()`

### Remaining `select('*')` usage (13 queries across 5 files)

- `lead-magnets.repo.ts:27,74`
- `signals.repo.ts:14,71,220`
- `linkedin.repo.ts:67,121,132`
- `admin.repo.ts:23,34,45,80`
- `cp-transcripts.repo.ts:127`

---

## Test Suite Status

### Jest (unit/integration): 128/139 passing

- **11 failures** caused by stale git worktree (`.worktrees/creative-strategy/`) creating duplicate module conflicts
- **Fix:** Add `.worktrees/` to `testPathIgnorePatterns` in `jest.config.js` (1-line fix)
- All 1,628 tests are valid and cover API routes, schemas, AI modules, services, integrations

### Playwright (e2e): Rewritten on this branch

- Old tests were completely outdated (wrong routes, wrong selectors, broken mocking strategy)
- Rewrote 5 spec files with ~59 tests covering auth, navigation, dashboard smoke tests, public pages, wizard
- Removed 4 spec files that relied on client-side PostgREST mocking (no longer works with server-side data layer)
- Updated `playwright.config.ts` (`npm` -> `pnpm`)
