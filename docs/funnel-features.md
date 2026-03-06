<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## A/B Testing (Thank-You Page)

Self-serve A/B testing for thank-you pages to maximize survey completion rate. Tests one field at a time: headline, subline, video on/off, pass message, or page layout.

### Data Model

- `ab_experiments` table -- experiment definition (status, test_field, winner_id, significance, min_sample_size)
- `funnel_pages` columns added: `experiment_id`, `is_variant` (boolean), `variant_label`
- Variants are cloned `funnel_pages` rows linked via `experiment_id`. Existing `page_views` and `funnel_leads` tracking works unchanged per variant.

### How It Works

1. **Create test**: User picks a field to test on the funnel builder's thank-you tab. AI (Claude) generates 2-3 variant suggestions. User picks one (or writes custom).
2. **Bucketing**: Server-side deterministic hash (`SHA-256(IP + User-Agent + experiment_id)`) assigns visitors to variants. No cookies. Same visitor always sees same variant.
3. **Tracking**: Each variant has its own `funnel_page_id`, so `page_views` (page_type='thankyou') and `funnel_leads` track per-variant automatically.
4. **Auto-winner**: Trigger.dev scheduled task (`check-ab-experiments`, every 6 hours) runs two-proportion z-test. At p < 0.05 with min sample size met, declares winner.
5. **Winner promotion**: Winning field value is copied back to the control row. URL never changes. Variant rows are unpublished.

### API Routes

- `GET/POST /api/ab-experiments` -- list (with `?funnelPageId=` filter) and create experiments
- `GET/PATCH/DELETE /api/ab-experiments/[id]` -- get with stats, pause/resume/declare-winner, delete
- `POST /api/ab-experiments/suggest` -- AI variant suggestions using Claude (claude-sonnet-4-5-20250514)

### Key Files

- `src/components/funnel/ABTestPanel.tsx` -- dashboard UI (4 states: no test, creating, running, completed)
- `src/components/funnel/FunnelBuilder.tsx` -- integrates ABTestPanel in thankyou tab
- `src/app/p/[username]/[slug]/thankyou/page.tsx` -- server-side bucketing logic
- `src/trigger/check-ab-experiments.ts` -- auto-winner detection (6-hour cron)
- `src/app/api/ab-experiments/` -- CRUD + suggest APIs
- `supabase/migrations/20260218200000_ab_experiments.sql` -- migration

### Important Notes

- Always filter funnel queries with `.eq('is_variant', false)` to hide variant rows from funnel lists
- One experiment per funnel at a time (create API enforces this)
- Experiment paused/completed/draft → serve control (or winner if completed)

## Thank-You Page Layouts

Three layout variants for thank-you pages, controlled by `thankyou_layout` column on `funnel_pages`. A/B testable via the experiment system.

### Layout Variants

| Layout | Slug | Behavior |
|--------|------|----------|
| Survey First | `survey_first` | Default. Banner → headline → survey → video (after completion) → result → booking |
| Video First | `video_first` | Banner → headline → video (plays immediately) → survey → result → booking |
| Side by Side | `side_by_side` | Banner → headline → 2-column grid (video left, survey right) → result. Falls back to single-column when no video. Mobile: stacks vertically. |

### Data Model

- `funnel_pages.thankyou_layout` TEXT NOT NULL DEFAULT `'survey_first'` — CHECK constraint: `survey_first`, `video_first`, `side_by_side`
- Type: `ThankyouLayout` exported from `src/lib/types/funnel.ts`

### Key Rendering Logic

- `survey_first`: `aboveSections` render before survey (backward compat). Video gated behind `qualificationComplete`.
- `video_first` / `side_by_side`: Video shows immediately (not gated). `aboveSections` skipped to keep content above fold.
- `side_by_side`: Uses `grid grid-cols-1 md:grid-cols-2 gap-6`. Qualification result renders in-grid when video present, below grid otherwise.
- Extracted helper components: `SurveyCard`, `QualificationResult` in `ThankyouPage.tsx`.

### Key Files

- `src/components/funnel/public/ThankyouPage.tsx` — Core layout rendering (3 branches)
- `src/components/funnel/ThankyouPageEditor.tsx` — Layout selector radio cards
- `src/components/funnel/FunnelBuilder.tsx` — Layout state management
- `src/components/funnel/ABTestPanel.tsx` — Layout as testable field (`thankyou_layout`)
- `src/app/p/[username]/[slug]/thankyou/page.tsx` — Passes layout + variant bucketing
- `supabase/migrations/20260227200000_thankyou_layout.sql` — Migration

## External Thank-You Page Redirect

Funnel owners can redirect leads to an external URL instead of showing the built-in thank-you page.

### Configuration

Three modes via `redirect_trigger` column on `funnel_pages`:
- `none` (default): Built-in thank-you page
- `immediate`: Skip thank-you page, redirect right after opt-in
- `after_qualification`: Show survey first, then redirect based on result

### Data Model

- `redirect_trigger` TEXT NOT NULL DEFAULT 'none' — mode selector
- `redirect_url` TEXT — primary redirect URL (or qualified-lead URL)
- `redirect_fail_url` TEXT — unqualified-lead redirect URL (after_qualification only)

Both URLs get `?leadId=xxx&email=yyy` appended automatically.

### Key Files

- `src/components/funnel/ThankyouPageEditor.tsx` — redirect config UI (dropdown + URL inputs)
- `src/components/funnel/public/OptinPage.tsx` — immediate redirect logic
- `src/components/funnel/public/ThankyouPage.tsx` — post-qualification redirect effect
- `src/app/p/[username]/[slug]/page.tsx` — passes redirect config to OptinPage
- `src/app/p/[username]/[slug]/thankyou/page.tsx` — passes redirect config + lead email to ThankyouPage

## Default Resource Delivery Email

Auto-sends a "here is your resource" email on opt-in, with a per-funnel toggle (default ON).

### Priority Rules

| Active sequence? | Toggle ON | Result |
|---|---|---|
| Yes | Any | Sequence handles delivery (default email skipped) |
| No | ON | System sends fixed-template resource email |
| No | OFF | Resource shown directly on thank-you page |

### Data Model

- `funnel_pages.send_resource_email` BOOLEAN NOT NULL DEFAULT true — per-funnel toggle
- Fixed system template (no customization) — subject: "Your [Title] is ready"

### How It Works

1. Lead opts in → `POST /api/public/lead` creates lead, fires webhooks
2. Calls `triggerEmailSequenceIfActive()` — if sequence handles it, done
3. If no sequence: checks `send_resource_email` toggle
4. Toggle ON + content exists → triggers `send-resource-email` Trigger.dev task
5. Toggle OFF → thank-you page shows resource link/button directly

### Key Files

- `src/trigger/send-resource-email.ts` — Trigger.dev task (fixed HTML template via Resend)
- `src/app/api/public/lead/route.ts` — conditional trigger (sequence > resource email > nothing)
- `src/lib/services/email-sequence-trigger.ts` — exported `getSenderInfo()` + `getUserResendConfig()`
- `src/components/funnel/ThankyouPageEditor.tsx` — toggle UI (Resource Delivery section)
- `src/components/funnel/public/ThankyouPage.tsx` — conditional banner + resource button
- `src/app/p/[username]/[slug]/thankyou/page.tsx` — computes `showResourceOnPage` from toggle + sequence state
