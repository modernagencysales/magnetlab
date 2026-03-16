# Fixes Applied

All 27 bugs from the beta bugs report (`docs/beta-bugs.md`) have been fixed and verified.

For the explanation of each bug (what broke, why, and the plan), see [`bug-fix-plans.md`](./bug-fix-plans.md).

**Summary:** 27 fixes across 40+ files — 6 security patches, 2 database migrations, 8 team-scoping fixes, 5 frontend logic fixes, 6 data/backend fixes.

---

## Fix 1: Select.Item crash on team-scoped pages

**Bug:** Radix `<SelectItem>` crashes when `value=""`. Four components did this, breaking every page with a Select dropdown in team mode.

**Root cause:** Radix requires a non-empty string for `value`. Empty string collides with its internal "no selection" state.

**What we changed:**

| File | Old value | New value | Handler maps back to |
|------|-----------|-----------|---------------------|
| `ProfileSwitcher.tsx:47,52` | `""` | `"all"` | `null` |
| `BrandingSettings.tsx:533,544,550` | `""`, `"__custom__"` | `"system-default"`, `"custom"` | `""` |
| `TranscriptPasteModal.tsx:197,202` | `""` | `"auto"` | `""` |
| `AutopilotTab.tsx:281,286` | `""` | `"any"` | `""` |

**Pattern:** Use a readable sentinel string as the `value`, translate it back in `onValueChange`. Downstream logic receives the same values it always did.

---

## Fix 2: Screenshot fallback domain typo

**Bug:** "Generate Images" used `magnetlab.ai` as fallback domain. The actual domain is `magnetlab.app`.

**What we changed:**

```
File: src/server/services/lead-magnets.service.ts:397
```

```diff
- const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://magnetlab.ai';
+ const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://magnetlab.app';
```

One line. Corrected the fallback domain.

---

## Fix 3: Lead capture fails — NOT NULL constraint on `funnel_leads.lead_magnet_id`

**Bug:** Submitting the opt-in form returns "Failed to capture lead" when the funnel page has no lead magnet attached.

**Root cause:** A later migration made `funnel_pages.lead_magnet_id` nullable, but `funnel_leads.lead_magnet_id` still had NOT NULL. The insert passes `null` and the database rejects it.

**What we changed:**

```
New file: supabase/migrations/20260228300000_funnel_leads_nullable_lead_magnet.sql
```

```sql
ALTER TABLE funnel_leads ALTER COLUMN lead_magnet_id DROP NOT NULL;
```

One migration, one line. No service code changes needed — the code already handled null correctly.

---

## Fix 4: Broken images on public pages

**Bug:** Logos on public opt-in pages show a broken image icon when the URL points to an Imgur album or any non-image URL.

**Root cause:** No `onError` fallback on the `<Image>` component. Bad URLs fail silently with a broken icon visible to end-users.

**What we changed:**

```
File: src/components/funnel/public/OptinPage.tsx:147
```

Added `onError` handler to hide the image if it fails to load:

```tsx
onError={(e) => { e.currentTarget.style.display = 'none'; }}
```

Broken logo? Hidden. Valid logo? Displays normally. No extra components, no state.

---

## Fix 5: Qualification filter inverted on Leads page

**Bug:** "Qualified Only" filter shows unqualified leads, "Not Qualified" shows qualified leads.

**Root cause:** Dropdown sends `"true"`/`"false"` but the filter checks against `"qualified"` — never matches, always falls through to `false`.

**What we changed:**

```
File: src/components/leads/LeadsPageClient.tsx:103,161
```

```diff
- qualifiedFilter === 'all' ? undefined : qualifiedFilter === 'qualified' ? true : false,
+ qualifiedFilter === 'all' ? undefined : qualifiedFilter === 'true' ? true : false,
```

Same bug existed on two lines (initial load + debounced search). Fixed both with `replace_all`.

---

## Fix 6: Subscriber-sync webhook passes unnormalized email

**Bug:** Duplicate subscriber records created with mixed-case emails.

**Root cause:** Email is normalized on line 43 (`email = p.email.trim().toLowerCase()`) but line 60 passes the original `p.email` to the service.

**What we changed:**

```
File: src/app/api/webhooks/subscriber-sync/route.ts:60
```

```diff
- email: p.email as string,
+ email,
```

One word. Uses the already-normalized `email` variable instead of the raw payload.

---

## Fix 7: Can't delete GoHighLevel / HeyReach funnel integrations

**Bug:** Users can save GHL/HeyReach integrations but deleting returns `400: Invalid provider`.

**Root cause:** Delete uses `isEmailMarketingProvider()` (4 providers) instead of `isValidFunnelProvider()` (6 providers). GHL and HeyReach are CRM providers, not email marketing.

**What we changed:**

```
File: src/server/services/funnels.service.ts:731
```

```diff
- if (!isEmailMarketingProvider(provider)) {
+ if (!isValidFunnelProvider(provider)) {
```

Swapped to the same validation function that save already uses.

---

## Fix 8: Signal enrich task processes ALL users' events

**Bug:** Background job scores events for every user instead of only configured ones, burning AI credits.

**Root cause:** Supabase query builder is immutable. `.in()` returns a new query but the result wasn't reassigned — the filter was silently discarded.

**What we changed:**

```
File: src/trigger/signal-enrich-and-score.ts:187
```

```diff
- unscoredQuery.in('user_id', sentimentUserIds);
+ unscoredQuery = unscoredQuery.in('user_id', sentimentUserIds);
```

One `=` sign. The query now actually filters by user.

---

## Fix 9: Broadcast retry doesn't reset status to draft

**Bug:** Retry on a failed broadcast shows success toast but broadcast stays failed.

**Root cause:** Update payload missing `status: 'draft'`. Comment said "set status back to draft" but the code didn't do it.

**What we changed:**

```
File: src/components/email/BroadcastEditor.tsx:226
```

```diff
  await broadcastsApi.updateBroadcast(broadcastId, {
    subject,
    body,
    audience_filter: audienceFilter,
+   status: 'draft',
  });
```

One field added. Broadcast now actually resets to draft on retry.

---

## Fix 10: "Failed to create flow" on Email Flows

**Bug:** Creating an email flow fails with a NOT NULL constraint violation on `tenant_id`.

**Root cause:** Table created by gtm-system with `tenant_id NOT NULL`. Magnetlab uses `team_id` + `user_id` instead, never sets `tenant_id`.

**What we changed:**

```
New file: supabase/migrations/20260228400000_email_flows_nullable_tenant_id.sql
```

```sql
ALTER TABLE email_flows ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE email_flow_contacts ALTER COLUMN tenant_id DROP NOT NULL;
```

Two lines. Same pattern as Fix 3.

---

## Fix 11: isPolling always false during active polling

**Bug:** `isPolling` from `useBackgroundJob` is always `false`, even while actively polling.

**Root cause:** `startPolling` calls `setIsPolling(true)` then `stopPolling()` which calls `setIsPolling(false)`. React batches — `false` wins.

**What we changed:**

```
File: src/frontend/hooks/useBackgroundJob.ts:94-102
```

```diff
+ // Clear any existing intervals without resetting isPolling
+ if (intervalRef.current) clearInterval(intervalRef.current);
+ if (timeoutRef.current) clearTimeout(timeoutRef.current);
+
  // Reset state
  setStatus('pending');
  setResult(null);
  setError(null);
  setIsPolling(true);
-
- // Clear any existing intervals
- stopPolling();
```

Clear timers directly, then set state once. No conflicting state updates.

---

## Fix 12: Double API call on every Leads search keystroke

**Bug:** Each keystroke fires two API calls — one immediate, one debounced at 300ms.

**Root cause:** `fetchLeads` had `search` in its `useCallback` deps. Search change → new `fetchLeads` reference → `[fetchLeads]` effect fires immediately. Then debounced effect fires 300ms later.

**What we changed:**

```
File: src/components/leads/LeadsPageClient.tsx:91-113
```

1. Added `searchRef` to always read latest search value:
```ts
const searchRef = useRef(search);
searchRef.current = search;
```

2. Replaced `search` with `searchRef.current` inside `fetchLeads`
3. Removed `search` from `useCallback` deps

Search now only triggers via the 300ms debounced effect. Filter/page changes still trigger immediately.

---

## Fix 13: Hardcoded author "Tim Keen" in all generated content

**Bug:** Every user's generated lead magnet content references "Tim Keen" as the author.

**Root cause:** AI prompt hardcoded the name in 5 places. No way to pass the actual user's name.

**What we changed:**

```
File: src/lib/ai/generate-lead-magnet-content.ts:8
```

Added `authorName` param with `'the author'` default. Replaced all "Tim Keen" / "Tim" / "Tim's" references with `${authorName}`.

```
File: src/server/services/lead-magnets.service.ts:285
File: src/trigger/polish-lead-magnet-content.ts:71
File: src/trigger/rebuild-lead-magnet-content.ts:67
```

Each caller now fetches the user's name and passes it to `generateFullContent`.

---

## Fix 14: Auto-save on funnel tab switch saves stale data

**Bug:** Funnel auto-save on tab switch saves old form values, overwriting current edits.

**Root cause:** `handleSave` captures form state via closure. Auto-save effect only depends on `[activeTab]`, so it calls a stale `handleSave`.

**What we changed:**

```
File: src/frontend/hooks/useFunnelBuilder.ts:276-284
```

```ts
const handleSaveRef = useRef(handleSave);
handleSaveRef.current = handleSave;
```

Auto-save now calls `handleSaveRef.current()` — always the latest version with fresh form values. Same ref pattern as Fix 12.

---

## Fix 15 (Security): `findLeadMagnetByOwner` missing `user_id` filter

**Bug:** Authorization bypass — any authenticated user can read any other user's lead magnet by ID.

**Root cause:** Function accepts `userId` but never filters by it. Query only checks `id`.

**What we changed:**

```
File: src/server/repositories/lead-magnets.repo.ts:58-62
```

```diff
    .eq('id', id)
+   .eq('user_id', userId)
    .single();
```

One line. The `userId` param now actually does something.

---

## Fix 16 (Security): Admin import-subscribers missing superadmin check

**Bug:** Any authenticated user can bulk-import subscribers to any team.

**Root cause:** Missing `isSuperAdmin()` guard. Every other admin route has it.

**What we changed:**

```
File: src/app/api/admin/import-subscribers/route.ts:11-12
```

```diff
  if (!session?.user?.id) return ApiErrors.unauthorized();
+ if (!(await isSuperAdmin(session.user.id))) return ApiErrors.unauthorized();
```

One line + one import. Matches the pattern in every other admin route.

---

## Fix 17 (Security): Resend webhook signature verification is optional

**Bug:** Resend webhook accepts all requests when `RESEND_WEBHOOK_SECRET` is unset.

**Root cause:** `if (webhookSecret)` skipped verification when env var was missing. Fail-open design.

**What we changed:**

```
File: src/app/api/webhooks/resend/route.ts:13-17
```

```diff
- if (webhookSecret) {
-   // ... verify ...
- } else {
-   logWarn('webhooks/resend', 'RESEND_WEBHOOK_SECRET not set — skipping signature verification');
- }
+ if (!webhookSecret) {
+   logWarn('webhooks/resend', 'RESEND_WEBHOOK_SECRET not configured — rejecting request');
+   return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
+ }
```

Flipped from fail-open to fail-closed. No secret = no requests accepted.

---

## Fix 18 (Security): Unipile webhook has no authentication

**Bug:** Anyone can POST to the Unipile webhook to overwrite user integrations or trigger tasks.

**Root cause:** Zero authentication. Handler processes any request.

**What we changed:**

```
File: src/app/api/webhooks/unipile/route.ts:7-11
```

```diff
+ const secret = request.nextUrl.searchParams.get('secret');
+ if (!secret || secret !== process.env.UNIPILE_WEBHOOK_SECRET) {
+   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
+ }
```

Same `?secret=` pattern as Grain, Fireflies, Fathom webhooks. Requires `UNIPILE_WEBHOOK_SECRET` env var.

---

## Fix 19 (Security): Thankyou page leaks lead email via props

**Bug:** Anyone who guesses a lead UUID can read another lead's email from the thankyou page source.

**Root cause:** Lead query only filtered by `id`, not scoped to the current funnel page. Cross-funnel leaking.

**What we changed:**

```
File: src/app/p/[username]/[slug]/thankyou/page.tsx:184
```

```diff
      .eq('id', leadId)
+     .eq('funnel_page_id', activeFunnel.id)
      .single();
```

One line. Lead email only returned if the lead belongs to this funnel page.

---

## Fix 20 (Security): FontLoader CSS injection risk on public pages

**Bug:** Font URL interpolated into a style tag could allow CSS injection via crafted URL path/query.

**Root cause:** `isValidStorageUrl` only checked hostname, not path structure or query/fragment.

**What we changed:**

```
File: src/components/funnel/public/FontLoader.tsx:15-22
```

```diff
  function isValidStorageUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
-     return parsed.hostname.endsWith('.supabase.co');
+     if (!parsed.hostname.endsWith('.supabase.co')) return false;
+     if (parsed.search || parsed.hash) return false;
+     if (!/^\/storage\/v1\/object\//.test(parsed.pathname)) return false;
+     return true;
    } catch {
      return false;
    }
  }
```

Three checks: hostname, no query/hash, valid storage path. Blocks any URL that doesn't match the exact Supabase storage pattern.

---

## Fix 21: Team switching — content disappears + hosted page fails (Bug 5 + Bug 6 + T1)

**Bug:** Lead magnets disappear and hosted page setup fails after switching teams. Router Cache serves stale pages.

**Root cause:** `router.push('/')` without `router.refresh()`. Cookie changes but cached Server Components still render with the old team scope.

**What we changed:**

```
File: src/app/team-select/page.tsx:46,51
File: src/app/(dashboard)/team/page.tsx:115
```

```diff
  document.cookie = `ml-team-context=${teamId}; ...`;
+ router.refresh();
  router.push('/');
```

Added `router.refresh()` in three places: `selectTeam`, `selectPersonal`, and `enterTeam`. Invalidates the Router Cache so Server Components re-render with the new cookie.

---

## Fix 22: Analytics page crashes in team mode (T2)

**Bug:** Analytics page crashes with PostgREST 400 for all team users.

**Root cause:** `applyScope()` adds `.eq('team_id', ...)` but `cp_pipeline_posts` has no `team_id` column — it uses `team_profile_id`.

**What we changed:**

```
File: src/server/repositories/analytics.repo.ts:24
```

Replaced `applyScope` on `cp_pipeline_posts` with `team_profile_id`-based scoping — look up active team profiles, then filter with `.in('team_profile_id', profileIds)`. Same pattern as `posts.repo.ts`.

---

## Fix 23: Dashboard home shows wrong counts in team mode (T3)

**Bug:** Team members see zero counts for transcripts, posts, and brand kits on dashboard home.

**Root cause:** Three queries hardcoded `.eq('user_id', userId)` instead of using team scope.

**What we changed:**

```
File: src/app/(dashboard)/page.tsx:73-85
```

- `cp_call_transcripts` — replaced `.eq('user_id', userId)` with `applyScope` (has `team_id`)
- `cp_pipeline_posts` — replaced with `team_profile_id`-based scoping (same as Fix 22)
- `brand_kits` — replaced `.eq('user_id', userId)` with `applyScope` (has `team_id`)

---

## Fix 24: Bulk page import creates records without `team_id` (T4)

**Bug:** Bulk-imported lead magnets and funnel pages invisible in team mode.

**Root cause:** `bulkCreateFunnels` never sets `team_id` on inserts.

**What we changed:**

```
File: src/server/services/funnels.service.ts:743,764,769
File: src/app/api/funnel/bulk/route.ts:18
```

- Added `teamId` param to `bulkCreateFunnels`
- Added `team_id: teamId || null` to both lead magnet and funnel page inserts
- API route resolves scope via `getDataScope` and passes `scope.teamId`

---

## Fix 25: DFY automation webhook creates lead magnets without `team_id` (T5)

**Bug:** DFY-created lead magnets invisible in team mode.

**Root cause:** `createLeadMagnet` called with `null` for `team_id`.

**What we changed:**

```
File: src/server/services/webhooks-incoming.service.ts:298
```

```diff
+ const scope = await getDataScope(payload.userId);
- const magnet = await leadMagnetsRepo.createLeadMagnet(payload.userId, null, {
+ const magnet = await leadMagnetsRepo.createLeadMagnet(payload.userId, scope.teamId || null, {
```

Resolves user's team via `getDataScope` instead of hardcoding `null`.

---

## Fix 26: Email system broken for personal-mode users (T6)

**Bug:** All email features return "No team found for this user" for users without a team.

**Root cause:** 22 occurrences across 14 email route files return a cryptic error when `requireTeamScope` finds no team. The email system is team-scoped by design.

**What we changed:**

```
Files: 14 route files under src/app/api/email/ (22 occurrences)
```

```diff
- 'No team found for this user'
+ 'Email features require a team. Create or join a team in Settings to use email.'
```

Clear, actionable error message instead of a cryptic one. Users now know exactly what to do.

---

## Fix 27: Font saving doesn't persist in Branding Settings

**Bug:** Font selection doesn't save. No error shown to user. Also wipes existing brand kit data on every save.

**Root cause:** BrandingSettings sends partial updates via POST which runs `buildBrandKitPayload` (full payload). Missing fields become `undefined` → upsert fails or overwrites. Empty catch swallows the error.

**What we changed:**

6 files:

- `brand-kit.service.ts` — added `partialUpdateBrandKit()` that only includes fields present in request
- `brand-kit.repo.ts` — added `updateBrandKit()` using `.update()` (not `.upsert()`)
- `api/brand-kit/route.ts` — added PATCH handler for partial updates
- `frontend/api/brand-kit.ts` — added `patchBrandKit()` using `apiClient.patch`
- `BrandingSettings.tsx` — switched to `patchBrandKit`, added `console.error` in catch
- `settings/branding/page.tsx` — added `website_url` to SELECT query
