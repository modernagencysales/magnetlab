<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## DFY Onboarding Automation (Feb 2026)

4 automated steps in the DFY pipeline, triggered by gtm-system's dependency cascade after funnel/post creation.

### External API Routes (called by gtm-system)

| Route | Purpose |
|-------|---------|
| `POST /api/external/review-content` | AI reviews draft posts, flags bad ones, ranks quality, stores review_data |
| `POST /api/external/apply-branding` | Applies brand kit to funnel pages + sections (theme, colors, fonts, logos) |
| `POST /api/external/generate-quiz` | Generates qualification questions from ICP + knowledge + brand data |
| `POST /api/external/setup-thankyou` | Builds branded thank-you page with sections (bridge, steps, CTA, testimonial, logos) |

All authenticated via `Authorization: Bearer ${EXTERNAL_API_KEY}`.

### AI Modules

- `src/lib/ai/content-pipeline/content-reviewer.ts` -- Reviews posts for quality, AI patterns, consistency. Exports `reviewPosts()`, `parseReviewResults()`, `buildReviewPayload()`
- `src/lib/ai/content-pipeline/quiz-generator.ts` -- Generates qualification questions from ICP data. Exports `generateQuizQuestions()`, `parseQuizQuestions()`, `validateQuizQuestion()`

### Prompt Slugs

- `content-review` -- Batch post review with scoring (1-10), categorization (excellent/good_with_edits/needs_rewrite/delete), edit recommendations, consistency flags
- `quiz-generator` -- Qualification question generation (3-5 questions, yes_no/text/textarea/multiple_choice types)

### Database

- `cp_pipeline_posts.review_data` -- JSONB column for review results: `{review_score, review_category, review_notes, consistency_flags, reviewed_at}`
- Partial btree index on `review_data->>'review_category'` for filtering

### DFY Dependency Chain

```
process_intake -> select_and_finish_posts -> review_and_polish_content -> [admin review]
                  lead_magnet_create -> build_funnel -> apply_branding    (parallel)
                                                       generate_quiz      (parallel)
                                                       setup_thankyou     (parallel)
                  heyreach_setup
```

### Key Files

| File | Purpose |
|------|---------|
| `src/app/api/external/review-content/route.ts` | Review content API |
| `src/app/api/external/apply-branding/route.ts` | Apply branding API |
| `src/app/api/external/generate-quiz/route.ts` | Generate quiz API |
| `src/app/api/external/setup-thankyou/route.ts` | Setup thank-you API |
| `src/lib/ai/content-pipeline/content-reviewer.ts` | Content review AI module |
| `src/lib/ai/content-pipeline/quiz-generator.ts` | Quiz generator AI module |
| `src/lib/ai/content-pipeline/prompt-defaults.ts` | Prompt defaults (content-review, quiz-generator slugs) |
| `supabase/migrations/20260226100000_post_review_data.sql` | review_data column migration |
