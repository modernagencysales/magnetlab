# Thank-You Page A/B Testing — Design

**Goal:** Self-serve A/B testing for thank-you pages that maximizes survey completion rate through AI-generated variants and automatic winner detection.

**Approach:** Variant rows on `funnel_pages` linked via an `ab_experiments` table. Existing page_views and funnel_leads tracking works unchanged per variant.

---

## Data Model

### New table: `ab_experiments`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| funnel_page_id | UUID FK → funnel_pages | The control variant |
| user_id | UUID FK → users | Owner |
| name | TEXT | e.g. "Headline Test #1" |
| status | TEXT | `draft`, `running`, `completed`, `paused` |
| test_field | TEXT | `headline`, `subline`, `vsl_url`, `pass_message` |
| winner_id | UUID FK → funnel_pages | Set when auto-declared |
| significance | FLOAT | p-value when winner declared |
| min_sample_size | INT DEFAULT 50 | Min views per variant before checking |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### New columns on `funnel_pages`

| Column | Type | Notes |
|--------|------|-------|
| experiment_id | UUID FK → ab_experiments | NULL for normal pages |
| is_variant | BOOLEAN DEFAULT false | True for cloned variant rows |
| variant_label | TEXT | e.g. "Variant B" |

No changes to `page_views` or `funnel_leads` — they already track per `funnel_page_id`.

---

## Visitor Bucketing

Server-side, deterministic, no cookies:

1. Thank-you server component checks if control has active experiment (`status = 'running'`)
2. Fetches all variant funnel_page_ids for that experiment (including control)
3. Hashes `IP + User-Agent + experiment_id` with SHA-256 (same approach as page_views dedup)
4. `variantIndex = hash_int % numVariants`
5. Loads selected variant's funnel_page data and renders it

Same visitor always sees same variant. Adding experiment_id to hash means different experiments can bucket differently.

**Edge cases:**
- Experiment paused/completed/draft → serve control (or winner if completed)
- New variants added mid-test → hash redistributes naturally

---

## AI Variant Generation

1. User clicks "New A/B Test" on funnel detail page
2. Picks test field: headline, subline, video on/off, or pass message
3. Claude generates 2-3 variant suggestions using: current value, lead magnet title/concept/audience, goal (maximize survey completions)
4. User reviews suggestions, can edit inline
5. User picks one (or writes custom), clicks "Launch Test"
6. System clones funnel_page row with changed field, creates experiment, status → `running`

One field per test. No multi-field tests (keeps statistical analysis clean).

Video on/off is a simple toggle — no AI needed.

---

## Auto-Winner Detection

Trigger.dev scheduled task runs every 6 hours:

1. For each experiment with `status = 'running'`:
   - Count page_views per variant (`page_type = 'thankyou'`)
   - Count funnel_leads per variant with `qualification_answers IS NOT NULL`
   - Skip if any variant < min_sample_size views
   - Two-proportion z-test on completion rates
   - If p < 0.05 → declare winner

2. When winner declared:
   - Set `winner_id`, `significance`, `status = 'completed'`, `completed_at`
   - **Promote winner to control**: copy winning field values back onto control row (URL never changes)
   - Set variant rows `is_published = false`
   - Record notification for dashboard

3. User can also manually declare winner at any time via "Declare Winner" button.

---

## Dashboard UI

Lives on the funnel detail page (`/(dashboard)/library/[id]/funnel`), below thank-you settings.

**No test:** "Optimize your thank-you page" card + "New A/B Test" button.

**Running:** Control vs Variant side-by-side, live stats (views, completions, rate), bar chart, pause/declare-winner buttons, sample progress indicator.

**Completed:** Winner badge, final stats + confidence, "Run Another Test" button, past test history accordion.

**Funnel list:** Filter with `WHERE is_variant = false` so variants don't appear as separate funnels.

---

## Scope Boundaries

**In scope:**
- One field per test (headline, subline, vsl_url, pass_message)
- AI variant suggestions with human edit
- Server-side deterministic bucketing
- Auto-winner at 95% significance
- Inline UI on funnel detail page

**Out of scope (future):**
- Multi-field tests
- Question set testing
- Section layout testing
- Auto-launch next test after winner
- Traffic allocation weighting (always 50/50)
