# DFY Onboarding Automation

External APIs called by gtm-system. Auth: `Authorization: Bearer ${EXTERNAL_API_KEY}`.

## Routes

| Route | Purpose |
|-------|---------|
| `POST /api/external/review-content` | AI post review, quality flags |
| `POST /api/external/apply-branding` | Brand kit → funnel pages |
| `POST /api/external/generate-quiz` | Qualification questions from ICP |
| `POST /api/external/setup-thankyou` | Branded thank-you sections |

## Key Files

`content-reviewer.ts`, `quiz-generator.ts` | Prompt slugs: `content-review`, `quiz-generator`
