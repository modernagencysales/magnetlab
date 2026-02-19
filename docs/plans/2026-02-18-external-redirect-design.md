# External Thank-You Page Redirect — Design

## Problem

Users want to redirect leads to an external thank-you page (e.g., their own site, a booking page, a course platform) instead of using magnetlab's built-in thank-you page after email opt-in.

## Requirements

- Configurable per funnel: no redirect (default), immediate redirect, or redirect after qualification survey
- Append `leadId` and `email` as query params to the external URL
- Separate redirect URLs for qualified vs unqualified leads (when using after-qualification mode)
- Instant redirect (no countdown/delay)

## Schema Changes

Add 3 columns to `funnel_pages`:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `redirect_trigger` | `TEXT` | `'none'` | `'none'`, `'immediate'`, or `'after_qualification'` |
| `redirect_url` | `TEXT` | `NULL` | Redirect URL (immediate mode) or qualified-lead URL (after-qualification mode) |
| `redirect_fail_url` | `TEXT` | `NULL` | Unqualified-lead redirect URL (only used in after-qualification mode) |

## Redirect Logic

### Immediate (`redirect_trigger = 'immediate'`)

OptinPage.tsx: after successful lead creation, `window.location.href` to `redirect_url?leadId=xxx&email=yyy` instead of navigating to the thank-you page.

### After Qualification (`redirect_trigger = 'after_qualification'`)

ThankyouPage.tsx: after survey completion:
- Qualified + `redirect_url` set → redirect to `redirect_url?leadId=xxx&email=yyy`
- Unqualified + `redirect_fail_url` set → redirect to `redirect_fail_url?leadId=xxx&email=yyy`
- URL not set for that case → fall through to existing behavior (show pass/fail message)

### None (`redirect_trigger = 'none'`)

No change to current behavior.

## UI Changes (ThankyouPageEditor)

New "Redirect" section at the top of the editor:

1. Dropdown: "After opt-in, send leads to..." → `Our thank-you page` / `External URL immediately` / `External URL after qualification`
2. When "immediate": single URL input. Hide all other thank-you fields (headline, video, calendly, qualification) since they won't render.
3. When "after qualification": two URL inputs (qualified URL, unqualified URL). Keep qualification questions visible.

## Data Flow

```
Funnel Builder → saves redirect config to funnel_pages
Public opt-in → fetches config → immediate? redirect : go to thank-you
Thank-you page → passes redirect config as props → after qualification? redirect based on result
```

## Validation

- URLs: `z.string().url()` (HTTP/HTTPS only)
- `redirect_fail_url` only valid when `redirect_trigger = 'after_qualification'`
- `leadId` and `email` already visible in current thank-you page URLs — no new data exposure

## Files to Modify

1. New migration: `supabase/migrations/YYYYMMDD_funnel_redirect.sql`
2. `src/lib/types/funnel.ts` — extend FunnelPage + UpdateFunnelPagePayload
3. `src/lib/validations/api.ts` — add Zod fields
4. `src/components/funnel/FunnelBuilder.tsx` — add state + pass props
5. `src/components/funnel/ThankyouPageEditor.tsx` — add redirect config UI
6. `src/components/funnel/public/OptinPage.tsx` — immediate redirect logic
7. `src/app/p/[username]/[slug]/thankyou/page.tsx` — pass redirect props
8. `src/components/funnel/public/ThankyouPage.tsx` — post-qualification redirect
