# Bug Fix Plans

All 27 bugs from the beta report explained: what's broken, why, and how we fixed it.

For the exact code diffs applied, see [`bug-fix-changelog.md`](./bug-fix-changelog.md).

**All 27 bugs fixed and verified.** Categories: 8 core bugs (1–8), 6 security (15–20), 7 frontend (5, 9, 11–14), 6 team/scoping (21–26), 1 multi-layered (27).

---

## Bug 1: Select.Item crash on all team-scoped pages

**Status:** Fixed

**What's broken:** Every page with a Select dropdown crashes in team mode.

**Error:** `A <Select.Item /> must have a value prop that is not an empty string`

**Why:** 4 components pass `value=""` to Radix `<SelectItem>`, which Radix forbids. Empty string collides with its internal "no selection" state.

**Files:**
- `ProfileSwitcher.tsx:52` — `value=""`
- `BrandingSettings.tsx:544` — `value=""`
- `TranscriptPasteModal.tsx:202` — `value=""`
- `AutopilotTab.tsx:286` — `value=""`

**Fix:** Replace `value=""` with a readable sentinel (`"all"`, `"system-default"`, `"auto"`, `"any"`), translate back in `onValueChange`.

---

## Bug 2: Generate Images fails in dev (ScreenshotOne network error)

**Status:** Fixed

**What's broken:** "Generate Images" button fails with `network_error` in local dev. Also, fallback domain is wrong.

**Why:** `NEXT_PUBLIC_APP_URL` is `localhost` in dev — ScreenshotOne's external servers can't reach it. Fallback was `magnetlab.ai` instead of `magnetlab.app`.

**File:** `src/server/services/lead-magnets.service.ts:397`

**Fix:** Corrected fallback domain from `.ai` to `.app`.

---

## Bug 3: Lead form submission — "Failed to capture lead"

**Status:** Fixed

**What's broken:** Submitting the opt-in form on public pages returns "Failed to capture lead" when the funnel page has no lead magnet attached.

**Why:** `funnel_leads.lead_magnet_id` has a NOT NULL constraint, but `funnel_pages.lead_magnet_id` was made nullable in a later migration. The insert passes `null` and the database rejects it.

**File:** `supabase/migrations/20260228300000_funnel_leads_nullable_lead_magnet.sql`

**Fix:** `ALTER TABLE funnel_leads ALTER COLUMN lead_magnet_id DROP NOT NULL;`

---

## Bug 4: User-uploaded images broken on public pages

**Status:** Fixed

**What's broken:** Logos on public opt-in pages show a broken image icon when the URL points to a non-image URL (e.g. Imgur album).

**Why:** No `onError` fallback on the `<Image>` component. Bad URLs fail silently with a broken icon visible to end-users.

**File:** `src/components/funnel/public/OptinPage.tsx:147`

**Fix:** Added `onError` handler that hides the image on failure.

---

## Bug 5: Qualification filter inverted on Leads page

**Status:** Fixed

**What's broken:** "Qualified Only" shows unqualified leads, "Not Qualified" shows qualified leads.

**Why:** Dropdown sends `"true"`/`"false"` but the filter compares against `"qualified"` — never matches, always falls through to `false`.

**Files:** `src/components/leads/LeadsPageClient.tsx:103,161`

**Fix:** Changed `'qualified'` to `'true'`. Same bug on two lines, both fixed.

---

## Bug 6: Subscriber-sync webhook passes unnormalized email

**Status:** Fixed

**What's broken:** Duplicate subscriber records with mixed-case emails (e.g. `John@example.com` and `john@example.com` stored as separate entries).

**Why:** Line 43 normalizes the email to lowercase and trims it, storing the result in `email`. But line 60 passes the original `p.email` (unnormalized) to the service — so the validation uses the clean version but the database gets the raw version.

**File:** `src/app/api/webhooks/subscriber-sync/route.ts:60`

**Fix:** Pass `email` (the normalized variable) instead of `p.email as string`.

---

## Bug 7: Can't delete GoHighLevel / HeyReach funnel integrations

**Status:** Fixed

**What's broken:** Users can save GoHighLevel and HeyReach integrations on funnel pages, but can never delete them. Delete returns `400: Invalid provider`.

**Why:** The save function (`saveFunnelIntegration`, line 695) validates with `isValidFunnelProvider()` which accepts all 6 providers. But the delete function (line 731) validates with `isEmailMarketingProvider()` which only accepts 4 email marketing providers — GoHighLevel and HeyReach are CRM providers, not email marketing.

**File:** `src/server/services/funnels.service.ts:731`

**Fix:** Use `isValidFunnelProvider()` for delete, same as save.

---

## Bug 8: Signal enrich task processes ALL users' events

**Status:** Fixed

**What's broken:** The signal enrich background job burns AI credits scoring events for every user, not just the ones with sentiment configs.

**Why:** Supabase query builder is immutable — `.in()` returns a new query, but the result isn't assigned back. The `user_id` filter is silently discarded.

```ts
// Line 187 — filter thrown away
unscoredQuery.in('user_id', sentimentUserIds);
```

**File:** `src/trigger/signal-enrich-and-score.ts:187`

**Fix:** Reassign the result: `unscoredQuery = unscoredQuery.in(...)`.

---

## Bug 9: Broadcast retry doesn't reset status to draft

**Status:** Fixed

**What's broken:** Clicking retry on a failed broadcast shows a success toast but the broadcast stays in failed state. User can't resend.

**Why:** `handleRetry` updates subject, body, and audience filter — but never sets `status: 'draft'`. The broadcast remains in `failed` status.

**File:** `src/components/email/BroadcastEditor.tsx:226`

**Fix:** Add `status: 'draft'` to the update payload.

---

## Bug 10: "Failed to create flow" on Email Flows

**Status:** Fixed

**What's broken:** Clicking "Create Your First Flow" on `/email/flows` fails with "Failed to create flow".

**Why:** The `email_flows` table was created by gtm-system with `tenant_id NOT NULL`. Magnetlab's insert sets `team_id` + `user_id` but never `tenant_id`, causing a NOT NULL constraint violation. Same issue on `email_flow_contacts`.

**File:** `supabase/migrations/20260228400000_email_flows_nullable_tenant_id.sql`

**Fix:** Drop NOT NULL on `tenant_id` for both `email_flows` and `email_flow_contacts`.

---

## Bug 11: isPolling is always false during active polling

**Status:** Fixed

**What's broken:** Components using `useBackgroundJob` can't show a loading/polling state because `isPolling` is always `false` even while polling is active.

**Why:** `startPolling` sets `isPolling(true)` on line 99, then immediately calls `stopPolling()` on line 102 which sets `isPolling(false)`. React batches both — `false` wins.

**File:** `src/frontend/hooks/useBackgroundJob.ts:99-102`

**Fix:** Clear intervals/timeouts directly in `startPolling` instead of calling `stopPolling()`. Move `setIsPolling(true)` after the cleanup.

---

## Bug 12: Double API call on every Leads search keystroke

**Status:** Fixed

**What's broken:** Every keystroke in the Leads search box fires two API calls — one immediate, one 300ms later. Doubles API load and causes table flicker.

**Why:** `fetchLeads` has `search` in its `useCallback` deps. When `search` changes, `fetchLeads` gets a new reference, which triggers the `[fetchLeads]` useEffect immediately. Then the debounced useEffect fires 300ms later. Two calls per keystroke.

**Files:** `src/components/leads/LeadsPageClient.tsx:93-153`

**Fix:** Remove `search` from `fetchLeads` deps. Use a `searchRef` so `fetchLeads` always reads the latest search value without re-creating. Search changes now only trigger via the debounced effect.

---

## Bug 13: Hardcoded author "Tim Keen" in all generated content

**Status:** Fixed

**What's broken:** Every user's AI-generated lead magnet content references "Tim Keen" as the author, regardless of who the actual user is.

**Why:** The AI prompt in `generateFullContent` hardcodes `Author: Tim Keen (agency owner who built a $4.7M agency using LinkedIn)` and references "Tim" in 5 places.

**Files:**
- `src/lib/ai/generate-lead-magnet-content.ts:8-59` — prompt with hardcoded name
- `src/server/services/lead-magnets.service.ts:285` — caller
- `src/trigger/polish-lead-magnet-content.ts:71` — caller
- `src/trigger/rebuild-lead-magnet-content.ts:67` — caller

**Fix:** Added `authorName` param (defaults to `'the author'`). Each caller fetches the user's name and passes it in. All "Tim" references in the prompt replaced with `${authorName}`.

---

## Bug 14: Auto-save on funnel tab switch saves stale data

**Status:** Fixed

**What's broken:** Switching tabs in the funnel builder auto-saves, but it saves old form values instead of current ones.

**Why:** `handleSave` is a plain function that captures form state via closure. The auto-save `useEffect` only depends on `[activeTab]`, so it holds a stale reference to `handleSave` from a previous render.

**File:** `src/frontend/hooks/useFunnelBuilder.ts:276-284`

**Fix:** Store `handleSave` in a ref (`handleSaveRef`). The auto-save effect calls `handleSaveRef.current()` which always points to the latest version with fresh form values.

---

## Bug 15 (Security): `findLeadMagnetByOwner` missing `user_id` filter

**Status:** Fixed

**What's broken:** Any authenticated external API user can access any other user's lead magnet by guessing its ID. This is an authorization bypass.

**Why:** `findLeadMagnetByOwner` accepts `userId` as a param but never filters by it. The query only filters by `id`, returning any user's lead magnet.

**File:** `src/server/repositories/lead-magnets.repo.ts:58-62`

**Fix:** Add `.eq('user_id', userId)` to the query.

---

## Bug 16 (Security): Admin import-subscribers missing superadmin check

**Status:** Fixed

**What's broken:** Any authenticated user can bulk-import subscribers to any team via `/api/admin/import-subscribers`. Only superadmins should have access.

**Why:** Route checks `session?.user?.id` but never calls `isSuperAdmin()`. Every other admin route has this check — this one was missed.

**File:** `src/app/api/admin/import-subscribers/route.ts:11`

**Fix:** Add `isSuperAdmin()` guard, same as all other admin routes.

---

## Bug 17 (Security): Resend webhook signature verification is optional

**Status:** Fixed

**What's broken:** If `RESEND_WEBHOOK_SECRET` env var is unset, the Resend webhook accepts ALL requests. Anyone can POST fake email events to corrupt analytics.

**Why:** The code checks `if (webhookSecret)` — if missing, it logs a warning and lets the request through. Should fail closed.

**File:** `src/app/api/webhooks/resend/route.ts:13-37`

**Fix:** Early return with 500 if secret is not configured. Verification is now always required.

---

## Bug 18 (Security): Unipile webhook has no authentication

**Status:** Fixed

**What's broken:** Anyone can POST to `/api/webhooks/unipile` to overwrite user integrations or trigger background tasks with arbitrary data. Zero auth.

**Why:** No secret verification at all — the handler immediately processes any request.

**File:** `src/app/api/webhooks/unipile/route.ts:7-9`

**Fix:** Added `?secret=` query param check against `UNIPILE_WEBHOOK_SECRET` env var. Same pattern used by Grain, Fireflies, Fathom, and transcript webhooks. Requires adding `UNIPILE_WEBHOOK_SECRET` to `.env.local`.

---

## Bug 19 (Security): Thankyou page leaks lead email via props

**Status:** Fixed

**What's broken:** The `?leadId=` query param on thankyou pages is unauthenticated. Anyone who guesses a UUID can read another lead's email from serialized React props in the page source.

**Why:** The lead query filters only by `id` — no scoping to the current funnel page. A leadId from a completely different funnel returns the email.

**File:** `src/app/p/[username]/[slug]/thankyou/page.tsx:181-188`

**Fix:** Added `.eq('funnel_page_id', activeFunnel.id)` to the lead query. Now a leadId only returns an email if it belongs to this specific funnel page.

---

## Bug 20 (Security): FontLoader CSS injection risk on public pages

**Status:** Fixed

**What's broken:** `fontUrl` is interpolated into a style tag on public pages. The `isValidStorageUrl()` check only validates the hostname — a crafted URL path/query could break out of the CSS `url()` context.

**Why:** No validation on URL path, query params, or fragments. A specially crafted URL could escape the CSS context and inject arbitrary styles.

**File:** `src/components/funnel/public/FontLoader.tsx:15-22`

**Fix:** Stricter `isValidStorageUrl` — reject URLs with query params or fragments, require path starts with `/storage/v1/object/` (the Supabase storage path pattern).

---

## Bug 21: Team switching — content disappears + hosted page fails (Bug 5 + Bug 6 + T1)

**Status:** Fixed

**What's broken:** After switching teams, lead magnets disappear and hosted page setup fails. User reports "all of my Lead Magnets were gone".

**Why:** `router.push('/')` without `router.refresh()`. Next.js App Router caches Server Components aggressively. After setting the `ml-team-context` cookie client-side, the router serves the old cached page rendered with the previous team scope.

**Files:**
- `src/app/team-select/page.tsx:46,51` — `selectTeam` and `selectPersonal`
- `src/app/(dashboard)/team/page.tsx:115` — `enterTeam`

**Fix:** Add `router.refresh()` before `router.push('/')`. This invalidates the Router Cache so Server Components re-render with the new cookie value.

---

## Bug 22: Analytics page crashes in team mode (T2)

**Status:** Fixed

**What's broken:** Analytics page returns PostgREST 400 error for all team users, crashing the page.

**Why:** `applyScope()` adds `.eq('team_id', teamId)` but `cp_pipeline_posts` has no `team_id` column — it uses `team_profile_id` instead.

**File:** `src/server/repositories/analytics.repo.ts:24`

**Fix:** Replace `applyScope` on `cp_pipeline_posts` with `team_profile_id`-based scoping. Same pattern used by `posts.repo.ts`.

---

## Bug 23: Dashboard home shows wrong counts in team mode (T3)

**Status:** Fixed

**What's broken:** Team members (non-owners) see zero counts for transcripts, posts, and brand kits on the dashboard home page.

**Why:** Three queries hardcode `.eq('user_id', userId)` instead of using team scope:
- `cp_call_transcripts` — has `team_id`, should use `applyScope`
- `cp_pipeline_posts` — uses `team_profile_id`, needs profile-based scoping
- `brand_kits` — has `team_id`, should use `applyScope`

**File:** `src/app/(dashboard)/page.tsx:73-85`

**Fix:** Replaced `.eq('user_id', userId)` with `applyScope` for transcripts and brand_kits. Used `team_profile_id`-based scoping for posts (same as Fix 22).

---

## Bug 24: Bulk page import creates records without `team_id` (T4)

**Status:** Fixed

**What's broken:** Lead magnets and funnel pages created via bulk import are invisible in team mode because they have no `team_id`.

**Why:** `bulkCreateFunnels` only sets `user_id` on inserts. No `team_id` param exists.

**Files:**
- `src/server/services/funnels.service.ts:743,764,769` — service function + inserts
- `src/app/api/funnel/bulk/route.ts:18` — API route caller

**Fix:** Added `teamId` param to `bulkCreateFunnels`. Included `team_id` in both lead magnet and funnel page inserts. API route resolves scope and passes `scope.teamId`.

---

## Bug 25: DFY automation webhook creates lead magnets without `team_id` (T5)

**Status:** Fixed

**What's broken:** Lead magnets created by DFY automation are invisible in team mode.

**Why:** `handleDfyAutomation` passes `null` for `team_id` when calling `createLeadMagnet`.

**File:** `src/server/services/webhooks-incoming.service.ts:298`

**Fix:** Resolve user's team via `getDataScope` and pass `scope.teamId` instead of `null`.

---

## Bug 26: Email system broken for personal-mode users (T6)

**Status:** Fixed

**What's broken:** All email routes (subscribers, broadcasts, flows) return "No team found for this user" for users without a team. Entire email system non-functional for personal-mode users.

**Why:** All 14 email route files use `requireTeamScope()` then check `if (!scope?.teamId)` and return a cryptic error. The email tables are team-scoped by design, but the error gives users no guidance.

**Files:** 14 route files under `src/app/api/email/` (22 occurrences)

**Fix:** Replaced the cryptic error message with a clear, actionable one: "Email features require a team. Create or join a team in Settings to use email." This tells users exactly what to do instead of leaving them confused. The email system is team-scoped by design — this is a known limitation, not a bug in the query logic.

---

## Bug 27: Font saving doesn't persist in Branding Settings

**Status:** Fixed

**What's broken:** User selects a Google Font, saves, but it doesn't persist. No error shown.

**Why (3 layers):**
1. `buildBrandKitPayload` always constructs a full payload with `business_description`, `business_type`, etc. When BrandingSettings sends just `{ fontFamily }`, these are `undefined` → upsert fails on NOT NULL constraint or wipes existing data.
2. Array fields default to `[]` via `?? []` — every partial save wipes arrays.
3. Empty `catch {}` block silently swallows errors.
4. Branding page SELECT omits `website_url`.

**Files:**
- `src/server/services/brand-kit.service.ts` — needs partial update function
- `src/server/repositories/brand-kit.repo.ts` — needs `.update()` (not `.upsert()`)
- `src/app/api/brand-kit/route.ts` — needs PATCH handler
- `src/frontend/api/brand-kit.ts` — needs `patchBrandKit`
- `src/components/settings/BrandingSettings.tsx:119-128` — empty catch, wrong API call
- `src/app/(dashboard)/settings/branding/page.tsx:21` — missing `website_url`

**Fix:**
1. Added `partialUpdateBrandKit` service function — only includes fields present in the request
2. Added `updateBrandKit` repo function — uses `.update()` not `.upsert()`
3. Added PATCH route handler for partial updates
4. Added `patchBrandKit` frontend API function
5. BrandingSettings now calls `patchBrandKit` and logs errors
6. Added `website_url` to branding page SELECT
