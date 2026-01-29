# Survey Questions System Design

## Overview

Transform the funnel thank you page qualification questions from simple yes/no into a full survey system with multiple answer types, qualification logic, and webhook integration.

## Answer Types

| Type | Input | Qualifying? | Example |
|------|-------|-------------|---------|
| `yes_no` | Two buttons | Yes — matching answer required | "Are you posting on LinkedIn?" |
| `text` | Short text input | No | "What's your full name?" |
| `textarea` | Multi-line text | No | "What is your biggest LinkedIn challenge?" |
| `multiple_choice` | Radio buttons | Yes — qualifying option(s) defined | "Monthly business income (approx.)" |

## Data Model

### qualification_questions table changes

New columns:
```sql
answer_type TEXT NOT NULL DEFAULT 'yes_no'
  CHECK (answer_type IN ('yes_no', 'text', 'textarea', 'multiple_choice'))
options JSONB DEFAULT NULL          -- ["Option A", "Option B"] for multiple_choice
placeholder TEXT DEFAULT NULL       -- placeholder for text/textarea inputs
is_qualifying BOOLEAN DEFAULT true  -- false = data-collection only
is_required BOOLEAN DEFAULT true    -- must answer to proceed
```

Modified columns:
- `qualifying_answer`: Change from `TEXT CHECK ('yes'|'no')` to `JSONB` — stores `"yes"`, `"no"`, or `["option1", "option2"]` for multiple choice qualifying options.

### funnel_leads.qualification_answers

Stays JSONB, now stores: `{ "q-uuid": "yes", "q-uuid": "Tim Smith", "q-uuid": "$10k+" }`

### Webhook payload

New `surveyAnswers` field with flat key-value pairs using slugified question text:
```json
{
  "event": "lead.qualified",
  "data": {
    "leadId": "uuid",
    "email": "user@example.com",
    "isQualified": true,
    "qualificationAnswers": { "q-uuid": "yes" },
    "surveyAnswers": {
      "full_name": "Tim",
      "monthly_income": "$10k+",
      "posting_on_linkedin": "yes"
    }
  }
}
```

## Qualification Logic

- Only questions with `is_qualifying = true` affect qualification
- For `yes_no`: answer must match `qualifying_answer` (e.g. `"yes"`)
- For `multiple_choice`: answer must be in `qualifying_answer` array (e.g. `["$10k+", "$5-10k"]`)
- `text` and `textarea` types cannot be qualifying
- All qualifying questions must pass = qualified (unchanged all-or-nothing logic)

## UX: One Question at a Time

Keep the existing one-at-a-time flow, but render the appropriate input per answer type:
- `yes_no`: Two buttons (Yes / No) — unchanged
- `text`: Input field with placeholder, "Next" button
- `textarea`: Textarea with placeholder, "Next" button
- `multiple_choice`: Radio button list, "Next" button

Progress indicator stays: "Question X of N" with dots.

Optional (is_required=false) questions show a "Skip" link.

## Template Questions

Hardcoded constant in code. "Load template" button in funnel builder populates all 12 questions:

1. Full name (text)
2. Mobile number (text)
3. Best email for bonuses (text)
4. Biggest LinkedIn challenge (textarea)
5. Business type (multiple_choice)
6. Part of LinkedIn you want help with (multiple_choice)
7. Posting on LinkedIn? (yes_no, qualifying=yes)
8. Send people from content into a funnel? (yes_no, qualifying=yes)
9. Investment in learning last year (multiple_choice, qualifying)
10. Monthly business income (multiple_choice, qualifying)
11. Want to learn about Modern Agency Sales system? (yes_no, qualifying=yes)
12. LinkedIn Profile URL (text)

## Funnel Builder Changes

### QuestionsManager updates
- Answer type selector when adding/editing a question
- Options editor for multiple_choice (add/remove/reorder options)
- Qualifying toggle per question
- Qualifying answer picker (which option(s) qualify for multiple_choice)
- "Load Template" button to populate all 12 template questions
- Placeholder field for text/textarea

## Files to Change

### Migration
- `supabase/migrations/20260129_survey_questions.sql`

### Types
- `src/lib/types/funnel.ts` — Update QualificationQuestion, payloads

### API
- `src/app/api/funnel/[id]/questions/route.ts` — Handle new fields
- `src/app/api/funnel/[id]/questions/[qid]/route.ts` — Handle new fields
- `src/app/api/public/lead/route.ts` — Updated qualification logic + webhook payload

### Components
- `src/components/funnel/QuestionsManager.tsx` — New question editor UI
- `src/components/funnel/public/ThankyouPage.tsx` — Render different input types

### Constants
- `src/lib/constants/survey-templates.ts` — Template questions data
