# Thank-You Page Conversion Redesign

> Rework `video_first` layout into a proper VSL conversion funnel, add iClosed pre-fill from survey answers, and configure Tim's account.

## Problem

The current thank-you page has three issues:

1. **No conversion flow** — `video_first` renders video → survey → booking with no framing, no CTA bridge, and social proof positioned after everything. The reference page (Agency Acquisitions) follows: resource → framed video → bold CTA → social proof → booking.
2. **People don't know what we offer** — leads book calls without watching the VSL because nothing sells the call before the survey. Adding video framing and a CTA bridge educates before qualifying.
3. **Double data entry** — CalendlyEmbed passes zero pre-fill data to iClosed. Leads fill in name/email/qualification answers twice. mas-platform already has `buildIClosedUrl()` that solves this.

## Solution

### 1. Rework `video_first` layout rendering order

**Current:** headline → video → survey → result → sections → booking

**New:**
```
1. Confirm banner + prominent resource access button (big CTA, not text link)
2. Logo
3. Headline + subline
4. VSL framing block (vsl_headline + vsl_subline above video)
5. VideoEmbed
6. CTA bridge (cta_headline + big button → smooth-scrolls to #survey or #booking)
7. ALL sections (logos, testimonials — social proof between CTA and survey)
8. Survey (#survey anchor) — CTA scrolls here when questions exist
9. Qualification result
10. Booking embed (pre-filled with lead data + survey answers)
```

For `video_first` only — `survey_first` and `side_by_side` stay unchanged.

**Graceful degradation:**
- No `vsl_headline`/`vsl_subline` → video renders without framing (same as today)
- No `vsl_url` → skip video + CTA bridge, go from headline → sections → survey
- No `vsl_url` (CTA bridge check) → CTA bridge only renders when `vsl_url` exists. The CTA makes no sense without a video preceding it. `cta_button_text` has a non-null default so we cannot rely on it being null to skip the bridge.
- No survey questions → CTA scrolls to booking directly
- No `calendly_url` → qualified message only, no booking embed
- No sections → clean page with just the core flow

**Existing `video_first` pages:** Pages already using `video_first` will see a layout change on deploy — sections move between CTA and survey instead of after booking. Since the new fields (`vsl_headline`, `cta_headline`) default to null, no framing or CTA bridge will render until configured. The core elements (video, survey, booking) remain in the same relative order. This is acceptable given the product is early-stage with Tim as primary user.

### 2. Add video framing and CTA bridge fields

4 new nullable columns on `funnel_pages`:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `vsl_headline` | text | null | Bold label above video ("THE MODERN AGENCY SALES METHOD") |
| `vsl_subline` | text | null | Descriptive text below label ("Watch this free training...") |
| `cta_headline` | text | null | Text above CTA button ("Want to see how this applies to your agency?") |
| `cta_button_text` | text | null | Button text (e.g. "BOOK YOUR CALL NOW") |

All 4 columns are nullable with null defaults. The CTA bridge renders only when `vsl_url` is present (the bridge makes no sense without a video above it).

### 3. Booking pre-fill from lead data + survey answers

#### 3a. Port iClosed helpers

Copy `buildIClosedUrl()` and `normalizePhone()` from `mas-platform/apps/gtm-os/shared/components/iclosed-helpers.ts` into magnetlab at `src/lib/utils/iclosed-helpers.ts`. These are pure utility functions with zero dependencies.

Do NOT port `mapQualificationData()` — that function does hardcoded value translation for GC-specific survey options. The `booking_prefill_key` approach makes it unnecessary; question options should match iClosed values directly.

Do NOT port `getPageUtmParams()` — UTM params are already captured at opt-in time and stored on the lead record. If needed later, it can be added separately.

#### 3b. Add `booking_prefill_key` to qualification questions

1 new nullable column on `qualification_questions`:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `booking_prefill_key` | text | null | iClosed field identifier this answer maps to |

Common values: `monthlyrevenue`, `businesstype`, `linkedinurl`, `iclosedPhone`.

When a question has `booking_prefill_key` set, its answer is passed as that key in the booking URL query params. The question's multiple choice options should match iClosed's dropdown values exactly (no translation layer needed).

`iclosedName` and `iclosedEmail` are populated automatically from the lead record — no question mapping needed for those.

#### 3c. Update CalendlyEmbed to accept pre-fill data

Current signature: `CalendlyEmbed({ url })`

New signature: `CalendlyEmbed({ url, prefillData? })`

```typescript
interface BookingPrefillData {
  leadName?: string | null;
  leadEmail?: string | null;
  surveyAnswers?: Record<string, string>; // booking_prefill_key → answer value
}
```

For iClosed URLs: use `buildIClosedUrl()` to construct the pre-filled URL, then pass it as the `data-url` attribute on the widget div. The iClosed widget.js reads `data-url` to create its iframe — query params in the URL are preserved. This matches how mas-platform passes pre-fill data in the inline embed mode (the MutationObserver approach in mas-platform is only for the LIFT floating widget, not the inline embed).

For Cal.com URLs: append `name` and `email` query params.
For Calendly URLs: use their `prefill` query param format.

#### 3d. Wire pre-fill through the component chain

The server page (`thankyou/page.tsx`) already fetches the lead's email. Changes:
- Also fetch lead's `name` from `funnel_leads`
- Fetch `booking_prefill_key` alongside each qualification question
- Pass both to `ThankyouPage` component

`ThankyouPage` collects survey answers in state. After qualification completes:
- Build `prefillData` from lead name/email + answers mapped via `booking_prefill_key`
- Pass to `CalendlyEmbed`

### 4. Admin editor updates

#### ThankyouPageEditor

Add 4 new inputs in the "Video" section (only visible when `layout === 'video_first'`):
- **VSL Headline** — text input, placeholder: "THE MODERN AGENCY SALES METHOD"
- **VSL Subline** — textarea, placeholder: "Watch this free training to learn..."
- **CTA Headline** — text input, placeholder: "Want to see how this applies to your agency?"
- **CTA Button Text** — text input, placeholder: "BOOK YOUR CALL NOW"

#### Question editor

Add optional `booking_prefill_key` text input per question. Show a helper listing common iClosed field names: `monthlyrevenue`, `businesstype`, `linkedinurl`, `iclosedPhone`.

### 5. Default updates

- `setupThankyou` (external API for DFY) defaults to `video_first` layout
- `setupThankyou` sets default CTA copy: headline = "Ready to Take the Next Step?", button = "BOOK YOUR STRATEGY CALL"
- New funnel creation falls back to user's `default_vsl_url` for video (already works)

### 6. Post-deploy: Tim's account configuration

Separate from the code changes. Run as SQL after deploy:

- Set `thankyou_layout = 'video_first'` on all Tim's funnel pages
- Set `calendly_url = 'https://app.iclosed.io/e/timkeen/li-growth'` on all funnel pages
- Set `vsl_url` from user's `default_vsl_url` (or find existing value from any configured funnel)
- Set default `vsl_headline`, `vsl_subline`, `cta_headline`, `cta_button_text`
- Map existing qualification questions to iClosed fields via `booking_prefill_key` (requires inspecting current question text to determine the correct iClosed field name)

## Files Changed

| File | Change |
|------|--------|
| **Migration** | Add 4 columns to `funnel_pages`, 1 column to `qualification_questions` |
| `src/lib/types/funnel.ts` | Add fields to `FunnelPage`, `FunnelPageRow`, `UpdateFunnelPagePayload`, `QualificationQuestion`, `QualificationQuestionRow`. Update `funnelPageFromRow()` and `qualificationQuestionFromRow()` mapper functions. |
| `src/components/funnel/public/ThankyouPage.tsx` | Rework `video_first` rendering: resource button, VSL framing, CTA bridge, section repositioning, survey anchor, pre-fill wiring |
| `src/components/funnel/public/CalendlyEmbed.tsx` | Accept `prefillData` prop, build pre-filled URLs for iClosed/Cal.com/Calendly |
| `src/lib/utils/iclosed-helpers.ts` | **New file** — port `buildIClosedUrl()` + `normalizePhone()` from mas-platform |
| `src/app/p/[username]/[slug]/thankyou/page.tsx` | Select new columns in THREE places: (1) main funnel select, (2) A/B variant select, (3) qualification question select for `booking_prefill_key`. Also fetch lead `name` alongside `email`. |
| `src/components/funnel/ThankyouPageEditor.tsx` | Add VSL framing + CTA inputs (visible when layout = video_first) |
| Question editor component | Add `booking_prefill_key` input per question |
| `src/components/funnel/FunnelBuilder.tsx` | Add state for 4 new fields, wire to ThankyouPageEditor + save payload |
| `src/server/services/external.service.ts` | `setupThankyou` defaults to `video_first`, adds CTA copy |
| `src/server/services/funnels.service.ts` | Handle new fields in create/update |
| `src/server/repositories/funnels.repo.ts` | Add new columns to `FUNNEL_FULL_COLUMNS` select constant + update whitelist |
| `src/server/repositories/qualification.repo.ts` | Add `booking_prefill_key` to select constants + update operations |
| `src/lib/validations/api.ts` | Add 4 new fields to `updateFunnelSchema` Zod schema, add `booking_prefill_key` to question schemas |
| `packages/mcp/` | Add new fields to funnel + question tool schemas |

## Not Changing

- `survey_first` and `side_by_side` layouts — untouched
- Survey logic, qualification logic, A/B testing — untouched
- Pixel tracking, redirect logic — untouched
- Other booking platforms (Cal.com, Calendly pre-fill uses simpler param format, same `prefillData` prop)

## Testing

- Schema tests for new Zod fields (funnel update, question update)
- ThankyouPage rendering tests: video_first with all fields, video_first with missing fields (degradation)
- CalendlyEmbed tests: iClosed URL building with pre-fill data, Cal.com pre-fill, no pre-fill
- iclosed-helpers unit tests (port existing tests from mas-platform if any, add new)
- API route tests: funnel update with new fields, question update with booking_prefill_key
