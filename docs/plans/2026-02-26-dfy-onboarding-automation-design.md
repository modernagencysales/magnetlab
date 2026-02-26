# DFY Onboarding Automation Pipeline Design

**Goal:** Systematize and automate the DFY content review, brand application, quiz generation, and thank-you page setup as repeatable steps in the DFY onboarding pipeline.

**Architecture:** 4 new automation types added to the existing `dispatch-dfy-automation` system in gtm-system, each calling magnetlab external APIs. They chain off existing deliverables via the dependency cascade (`check-unblocked.ts`).

**Tech Stack:** Trigger.dev (gtm-system), Claude Sonnet (content review + quiz generation), magnetlab external APIs, Supabase (shared DB).

---

## Updated Dependency Chain

```
process_intake ──→ select_and_finish_posts ──→ review_and_polish_content ──→ [admin review]
                   lead_magnet_create ──→ build_funnel ──→ apply_branding    (parallel)
                                                          generate_quiz      (parallel)
                                                          setup_thankyou     (parallel)
                   heyreach_setup
```

`apply_branding`, `generate_quiz`, and `setup_thankyou` all depend on `build_funnel`. They run in parallel since they're independent.

`review_and_polish_content` depends on `select_and_finish_posts` and is a separate quality gate.

---

## 1. AI Content Review (`review_and_polish_content`)

**Trigger:** Fires automatically when `select_and_finish_posts` completes (via dependency cascade).

### Flow

1. Fetch all `cp_pipeline_posts` for the engagement's team profile with status `draft`
2. For each post, run AI prompt (`content-review`) that evaluates:
   - **AI refusal detection** — posts where the AI refused to write
   - **Quality score** (1-10) — hook strength, specificity, voice consistency, structure
   - **Category** — `excellent`, `good_with_edits`, `needs_rewrite`, `delete`
   - **Edit recommendations** — specific, actionable notes
   - **Consistency check** — cross-post analysis for contradictions, repeated hooks, name/gender inconsistencies
3. Store review results on each post (`review_data` JSONB column on `cp_pipeline_posts`)
4. Auto-delete posts categorized as `delete` (AI refusals, completely off-topic)
5. Push summary to Slack: "Rachel Pierre content review complete: 5 excellent, 7 good with edits, 4 need rewrite, 2 deleted"
6. Mark deliverable as `in_progress` with `needs_manual_action: true` — admin does final human pass

### Review Data Schema (per post)

```json
{
  "review_score": 7.5,
  "review_category": "excellent | good_with_edits | needs_rewrite | delete",
  "review_notes": ["Hook is too generic", "Add specific revenue number"],
  "consistency_flags": ["Charlie gender inconsistency with post #12"],
  "reviewed_at": "2026-02-26T..."
}
```

### Prompt

New slug `content-review` in prompt registry. Variables: `{{posts_json}}`, `{{voice_profile}}`, `{{icp_summary}}`.

### UI Integration

Posts tab in magnetlab shows review badges (color-coded by category) and expandable review notes inline. Filter by review category.

---

## 2. Brand Kit Auto-Application (`apply_branding`)

**Trigger:** Fires automatically when `build_funnel` completes.

### Flow

1. Fetch engagement's `processed_intake` for brand data (colors, fonts, logo)
2. Fetch or create team's `brand_kits` record from intake data
3. Apply branding to:
   - **Funnel pages** — theme, primary_color, background_style, font_family, font_url
   - **Funnel page sections** — logo_bar config with logos, testimonial config, steps config
   - **Lead magnet content page** — inherits from funnel_pages row
4. Mark deliverable complete (deterministic, no manual action needed)

### Font Handling

- Google Font name → set `font_family` (FontLoader handles CDN)
- Custom .woff2 → upload to Supabase Storage, set both `font_family` + `font_url`

### Existing Gap Fix

`POST /api/funnel` currently does NOT copy `font_family` or `font_url` from brand kit on funnel creation. Fix: add font fields to the merge so all new funnels (DFY and self-serve) get the brand font automatically.

### Re-Apply Button (All Users)

Add "Re-apply brand kit" action in funnel builder. Calls same logic. Available to all users, not just DFY.

---

## 3. Quiz Auto-Generation (`generate_quiz`)

**Trigger:** Fires automatically when `build_funnel` completes (parallel with `apply_branding`).

### Data Sources

1. **`processed_intake.icp`** — industry, company_size, job_titles, pain_points, buying_triggers
2. **Magnetlab knowledge base** — `market_intel`, `objection`, `question` type entries (via `searchKnowledgeV2`)
3. **Brand kit** — `urgent_pains`, `frequent_questions`, `credibility_markers`

### Flow

1. Gather context from all three sources
2. Call AI prompt (`quiz-generator`) to produce 3-5 qualification questions
3. Create `qualification_forms` record + insert generated `qualification_questions`
4. Link form to funnel via `funnel_pages.qualification_form_id`
5. Mark deliverable complete

### Question Output Format

```json
{
  "question_text": "What's your annual revenue range?",
  "answer_type": "multiple_choice",
  "options": ["Under $1M", "$1M-$5M", "$5M-$20M", "$20M+"],
  "qualifying_answer": ["$1M-$5M", "$5M-$20M", "$20M+"],
  "is_qualifying": true,
  "is_required": true
}
```

### Design Principles (Baked into Prompt)

- First question is easy/non-threatening (role or company size)
- Last question is open-ended text ("What's your biggest challenge with X?") — gives client a conversation starter
- Middle questions are qualifying multiple-choice
- 3-5 questions max (completion rate drops after 5)

### Prompt

New slug `quiz-generator` with variables: `{{icp_json}}`, `{{knowledge_context}}`, `{{brand_context}}`, `{{client_name}}`.

---

## 4. Thank-You Page Auto-Setup (`setup_thankyou`)

**Trigger:** Fires automatically when `build_funnel` completes (parallel with `apply_branding` and `generate_quiz`).

### Flow

1. Fetch engagement data for booking link (Cal.com URL from intake or engagement config)
2. Fetch brand kit for testimonial, logos, steps, theme/colors/fonts
3. Build thank-you page using `funnel_page_sections` with `page_location = 'thankyou'`:

| Order | Type | Content |
|-------|------|---------|
| 1 | `section_bridge` | "You're in! Here's what happens next" (accent variant) |
| 2 | `steps` | 3 steps: download resource → take quiz → book call |
| 3 | `marketing_block` | Booking CTA: "Book Your Free Strategy Call" with Cal.com link |
| 4 | `testimonial` | From `brand_kits.default_testimonial` (if available) |
| 5 | `logo_bar` | From `brand_kits.logos` (if available) |

4. Ensure `send_resource_email` is ON for resource delivery
5. Mark deliverable complete

### Graceful Degradation

- No booking link → skip CTA block
- No testimonial → skip testimonial section
- No logos → skip logo_bar section

---

## Data Model Changes

### Database (magnetlab)

| Table | Change |
|---|---|
| `cp_pipeline_posts` | Add `review_data` JSONB column (nullable) |
| `ai_prompt_templates` | Seed `content-review` and `quiz-generator` prompts |

### INTRO_OFFER_TEMPLATE (gtm-system)

4 new deliverables in the Fulfillment milestone:

| Deliverable | Category | Depends On | Trigger | Assignee |
|---|---|---|---|---|
| `review_and_polish_content` | content | `select_and_finish_posts` | `on_prerequisite_complete` | System |
| `apply_branding` | funnel | `build_funnel` | `on_prerequisite_complete` | System |
| `generate_quiz` | funnel | `build_funnel` | `on_prerequisite_complete` | System |
| `setup_thankyou` | funnel | `build_funnel` | `on_prerequisite_complete` | System |

---

## New Files

### gtm-system
- 4 new handler functions in `dispatch-automation.ts` for the new automation types

### magnetlab
- `src/lib/ai/content-pipeline/content-reviewer.ts` — AI review module
- `src/lib/ai/content-pipeline/quiz-generator.ts` — AI quiz generation module
- `src/app/api/external/review-content/route.ts` — API for gtm-system to trigger review
- `src/app/api/external/apply-branding/route.ts` — API for gtm-system to trigger branding
- `src/app/api/external/generate-quiz/route.ts` — API for gtm-system to trigger quiz generation
- `src/app/api/external/setup-thankyou/route.ts` — API for gtm-system to trigger thank-you setup
- Prompt defaults for `content-review` and `quiz-generator` in `prompt-defaults.ts`

### magnetlab (existing file changes)
- `POST /api/funnel` — Add `font_family` + `font_url` to brand kit merge
- Posts tab UI — Review badge + notes display + filter by review category
- Funnel builder — "Re-apply brand kit" button
