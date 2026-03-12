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
