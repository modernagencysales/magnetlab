# Interactive Lead Magnets Design

**Date:** 2026-02-16
**Status:** Approved

## Problem

The ideation step suggests interactive archetypes (calculators, scorecards, GPTs) but the wizard always produces text output. Users expect a working interactive tool when the AI recommends one.

## Solution

Extend the existing wizard to generate and host interactive lead magnets — calculators, assessments/scorecards, and GPT chat tools — reusing components from copy-of-gtm-os (AI chat interface, typeform-style survey) and magnetlab's existing qualification logic.

## Approach

Unified Interactive Content Model (Approach A): single `interactive_config` JSONB column on `lead_magnets` with discriminated union types. Minimal schema changes, fully backward-compatible.

---

## 1. Data Model

Add `interactive_config JSONB DEFAULT NULL` to `lead_magnets`. Null = text lead magnet (existing behavior).

### Calculator Config

```typescript
interface CalculatorConfig {
  type: 'calculator';
  headline: string;
  description: string;
  inputs: Array<{
    id: string;
    label: string;
    type: 'number' | 'select' | 'slider';
    placeholder?: string;
    options?: Array<{ label: string; value: number }>;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
    unit?: string;
  }>;
  formula: string; // Safe math expression using input IDs as variables
  resultLabel: string;
  resultFormat: 'number' | 'currency' | 'percentage';
  resultInterpretation: Array<{
    range: [number, number];
    label: string;
    description: string;
    color: 'green' | 'yellow' | 'red';
  }>;
}
```

### Assessment Config

```typescript
interface AssessmentConfig {
  type: 'assessment';
  headline: string;
  description: string;
  questions: Array<{
    id: string;
    text: string;
    type: 'single_choice' | 'multiple_choice' | 'scale';
    options?: Array<{ label: string; value: number }>;
    scaleMin?: number;
    scaleMax?: number;
    scaleLabels?: { min: string; max: string };
  }>;
  scoring: {
    method: 'sum' | 'average';
    ranges: Array<{
      min: number;
      max: number;
      label: string;
      description: string;
      recommendations: string[];
    }>;
  };
}
```

### GPT Config

```typescript
interface GPTConfig {
  type: 'gpt';
  name: string;
  description: string;
  systemPrompt: string;
  welcomeMessage: string;
  suggestedPrompts: string[];
  maxTokens?: number; // default 2048
}
```

### Chat Persistence Tables

```sql
CREATE TABLE interactive_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_magnet_id UUID NOT NULL REFERENCES lead_magnets(id) ON DELETE CASCADE,
  funnel_lead_id UUID REFERENCES funnel_leads(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_magnet_id, session_token)
);

CREATE TABLE interactive_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES interactive_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Indexes on `lead_magnet_id`, `session_token`, and `chat_id`.

---

## 2. Wizard Flow Changes

Six-step wizard stays the same. Changes:

- **Step 2 (Ideation):** Add "Interactive" badge on `single-calculator`, `assessment`, `prompt` concept cards.
- **Step 3 (Extraction):** Archetype-specific questions:
  - Calculator: what it calculates, inputs, formula logic, result meanings
  - Assessment: what it assesses, diagnostic questions, score levels, recommendations
  - Prompt/GPT: purpose, expertise, tone, common user questions
- **Step 4 (Content):** AI generates `interactive_config` JSON instead of text. Shows live preview + editor.
- **Step 5 (Post):** No changes (post naturally references "free calculator" etc.)
- **Step 6 (Publish):** No changes (includes `interactive_config` in save payload)

---

## 3. Interactive Components (Public-facing)

Render on `/p/[username]/[slug]/content` based on `interactive_config.type`.

### Calculator
- Renders inputs from config (number fields, dropdowns, sliders)
- Recalculates on every change (no submit button)
- Formula evaluated via `expr-eval` (safe math-only, no eval())
- Result with color-coded interpretation badge

### Assessment
- Adapted from copy-of-gtm-os OnboardingSurvey — typeform-style one-at-a-time
- Progress bar, keyboard support, cumulative scoring
- Final screen: score, level, description, recommendations
- Option to restart

### GPT Chat
- Adapted from copy-of-gtm-os ChatInterface (simplified: no sidebar)
- Streaming via SSE, markdown rendering
- Session token in localStorage for persistence
- Welcome message + suggested prompts

### Shared Wrapper
- Lead magnet title + description header
- Branded with funnel page theme/colors

---

## 4. AI Content Generation

Three new functions in `src/lib/ai/lead-magnet-generator.ts`:

- `generateCalculatorConfig()` — produces CalculatorConfig JSON from extraction answers
- `generateAssessmentConfig()` — produces AssessmentConfig JSON (8-12 questions, 3-4 score tiers)
- `generateGPTConfig()` — produces GPTConfig JSON (system prompt, welcome, suggested prompts)

Each output validated against Zod schema. "Regenerate" button if validation fails.

Text `ExtractedContent` still generated as lightweight fallback/SEO companion.

---

## 5. Editor UI (Step 4)

Split view: live preview left, editor right (stacked on mobile).

### Calculator Editor
- Add/remove/reorder inputs with label, type, unit, min/max, default
- Formula text field with available variable helper
- Result ranges with label, description, color

### Assessment Editor
- Drag-to-reorder questions list
- Edit question text, type, options with scores
- Scoring method + range editor

### GPT Editor
- System prompt textarea
- Welcome message textarea
- Suggested prompts list
- Test chat button (mini preview)

All editors: regenerate button, auto-save to draft, inline validation.

---

## 6. Chat API

### `POST /api/public/chat`

Request: `{ leadMagnetId, sessionToken, message, chatId? }`
Response: SSE stream + final JSON with chatId

Flow: load config → find/create chat → load history → stream Anthropic response → save messages

### Rate Limiting
- 50 messages/hour, 200/day per session
- 5,000 messages/day per lead magnet
- Simple DB counter (no Redis needed)

### Cost Control
- Default maxTokens: 2048
- Claude Haiku by default
- Conversation history truncated to last 20 messages

Public endpoint, no auth required. Session token (client-generated UUID) is the identifier.

---

## 7. Content Delivery

`/p/[username]/[slug]/content` page:
- If `interactive_config` exists → render interactive component
- If null → render text (existing behavior, unchanged)

Library detail page (`/magnets/[id]`):
- Shows editor UI for tweaking after publish
- Usage stats (tool uses, assessment completions, chat messages)
- GPT conversation logs

No changes to opt-in page, thank you page, or funnel builder.

---

## 8. Migration

Single migration:
1. `ALTER TABLE lead_magnets ADD COLUMN interactive_config JSONB DEFAULT NULL`
2. `CREATE TABLE interactive_chats` (with unique constraint on lead_magnet_id + session_token)
3. `CREATE TABLE interactive_chat_messages`
4. Three indexes

RLS: chat tables accessed via service role from API routes. No direct client access.

---

## Reused Code

| Source | Component | Used For |
|--------|-----------|----------|
| copy-of-gtm-os | `ChatInterface` + related | GPT chat UI (simplified) |
| copy-of-gtm-os | `OnboardingSurvey` | Assessment typeform flow |
| magnetlab | Qualification logic | Assessment scoring patterns |
| magnetlab | Funnel page system | Hosting, theming, lead capture |
| magnetlab | Anthropic SDK | GPT chat streaming |

## New Dependencies

- `expr-eval` — safe math expression evaluator for calculator formulas
