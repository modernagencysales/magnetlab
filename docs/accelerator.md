# GTM Accelerator

## Overview

The GTM Accelerator is a self-paced bootcamp delivered entirely through an AI coaching agent. Users purchase access for a $997 one-time payment via Stripe checkout. After enrollment, they interact with an orchestrator copilot that dispatches 8 specialist sub-agents — one per module — to guide them through building a complete go-to-market machine.

**8 modules** (completed in order):

| ID | Module | Description |
|----|--------|-------------|
| m0 | Positioning & ICP | Define the ideal client using the Caroline Framework |
| m1 | Lead Magnets | Create lead magnets, funnels, and email sequences |
| m2 | TAM Building | Build a segmented, enriched Total Addressable Market |
| m3 | LinkedIn Outreach | Set up and run LinkedIn DM campaigns |
| m4 | Cold Email | Launch cold email infrastructure and campaigns |
| m5 | LinkedIn Ads | Plan and optimize LinkedIn Ads |
| m6 | Operating System | Build daily rhythms, weekly reviews, and a GTM OS |
| m7 | Daily Content | Create a content engine with scheduling |

Phases: Phase 1 = m0, m1, m7 — Phase 2 = m2, m3, m4 — Phase 3 = m5, m6.

---

## Architecture

### Multi-Agent Design

The orchestrator is the copilot AI (`/api/copilot/chat`) with a program-aware system prompt injected by `accelerator-prompt.ts`. When the user needs deep module work, the orchestrator dispatches a specialist sub-agent via the `dispatch_sub_agent` tool. Sub-agent types:

| Sub-Agent Type | Handles |
|----------------|---------|
| `icp` | m0 — Positioning & ICP |
| `lead_magnet` | m1 — Lead Magnets |
| `tam` | m2 — TAM Building |
| `outreach` | m3 (LinkedIn DMs) and m4 (Cold Email) |
| `linkedin_ads` | m5 — LinkedIn Ads |
| `operating_system` | m6 — Operating System |
| `content` | m7 — Daily Content |
| `troubleshooter` | Cross-module diagnostics |

The orchestrator DOES NOT dispatch for: general questions, status checks, cross-module planning, or simple conversation.

### Conversation Flow

All interaction happens through the copilot SSE chat protocol (`/api/copilot/chat`). The chat sends `pageContext: { page: 'accelerator', entityType: 'accelerator', entityId: enrollmentId }` so the copilot system prompt includes the accelerator context section.

### Coaching Modes

Enrollment-level setting, with per-module override support:

| Mode | Behavior |
|------|----------|
| `do_it` | Execute and present results. Minimal explanation. "Good to go?" |
| `guide_me` | Do the work, explain key decisions, ask at decision points. (Default) |
| `teach_me` | Walk through every step. Explain the why. Let the user drive. |

### Onboarding Flow

On first session (`intake_data` is null), the orchestrator runs a 5-step onboarding:
1. Welcome (30 sec)
2. Quick intake — 5 questions captured via `save_intake_data` action
3. First win: ICP sub-agent runs the Caroline Framework
4. Second win (optional): Lead Magnet sub-agent generates 5 concepts
5. Session close: recap deliverables, show progress panel, set next-session expectations

---

## Database Tables

All tables are in the shared Supabase project (`qvawbxpijxlwdkolmjrs`). These tables use `user_id` / `enrollment_id` scoping — not tenant-scoped.

| Table | Purpose |
|-------|---------|
| `program_enrollments` | User enrollment record — Stripe IDs, coaching mode, intake data, status |
| `program_modules` | Per-module progress — status, current step, started/completed timestamps |
| `program_deliverables` | Artifact tracking — type, status, validation result, link to entity |
| `program_usage_events` | Append-only event log — session starts, deliverable creates, API calls |
| `program_sops` | Standard operating procedures per module — content, quality bars, deliverables |
| `program_metrics` | Performance metrics collected from providers — value, benchmark, status |
| `program_schedules` | Background task scheduling — cron expressions, next run time, task type |
| `diagnostic_rules` | Troubleshooter rules — symptom, threshold, common causes, diagnostic questions |
| `program_support_tickets` | Escalation tickets (reserved for future use) |

### Key Column Notes

- `program_enrollments.stripe_subscription_id` — stores the Stripe **payment intent ID** (reused field, not a subscription; it's a one-time payment)
- `program_enrollments.coaching_mode` — default `guide_me` on creation
- `program_modules.coaching_mode_override` — nullable; if set, overrides enrollment-level mode for that module
- `program_deliverables.entity_id` + `entity_type` — optional link to a MagnetLab entity (e.g., a lead magnet ID)
- `program_deliverables.validation_result` — JSONB: `{ passed, checks: [{ check, passed, severity, feedback }], feedback }`

### Enrollment Statuses

`active` | `paused` | `completed` | `churned`

### Module Statuses

`not_started` | `active` | `blocked` | `completed` | `skipped`

### Deliverable Statuses

`not_started` | `in_progress` | `pending_review` | `approved` | `rejected`

### Deliverable Types

`icp_definition`, `lead_magnet`, `funnel`, `email_sequence`, `tam_list`, `outreach_campaign`, `tam_segment`, `dm_campaign`, `email_campaign`, `email_infrastructure`, `content_plan`, `post_drafts`, `metrics_digest`, `diagnostic_report`, `ad_campaign`, `ad_targeting`, `weekly_ritual`, `operating_playbook`

---

## API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/accelerator/program-state` | GET | Session | Fetch enrollment + full program state (modules, deliverables, review queue, usage) |
| `/api/accelerator/enroll` | POST | Session | Create Stripe checkout session for $997 one-time payment |

Both routes return 401 if no valid session. The enroll route returns 400 if the user is already enrolled, or 500 if `ACCELERATOR_STRIPE_PRICE_ID` is not configured.

The Stripe webhook handler in `src/server/services/stripe.service.ts` handles `checkout.session.completed` events where `metadata.product === 'accelerator'`. It calls `createPaidEnrollment()` and fires a PostHog `accelerator_enrolled` event.

---

## Key Services

All services live in `src/lib/services/`. None import NextRequest, NextResponse, or cookies.

| Service | Purpose |
|---------|---------|
| `accelerator-enrollment.ts` | Create paid enrollments from Stripe webhooks; check access; store `ACCELERATOR_STRIPE_PRICE_ID` constant |
| `accelerator-program.ts` | CRUD for enrollments, modules, and deliverables; composite `getProgramState()` |
| `accelerator-metrics.ts` | Record, query, and summarize performance metrics; SOP-derived benchmarks; `computeMetricStatus()` |
| `accelerator-scheduler.ts` | CRUD for `program_schedules`; cron parser (`computeNextRun()`); `initializeSystemSchedules()` |
| `accelerator-troubleshooter.ts` | Load diagnostic rules; `matchRulesToMetrics()` to find triggered rules |
| `accelerator-usage.ts` | Append-only usage event tracking; monthly allocation checks (30 sessions, 15 deliverables, 500 API calls) |
| `accelerator-validation.ts` | Validate deliverable content against SOP quality bars using Claude Haiku; non-breaking on failure |

---

## Frontend Components

All components live in `src/components/accelerator/`.

| Component | Purpose |
|-----------|---------|
| `AcceleratorPage.tsx` | Main layout — fetches program state, renders chat + progress panel, or EnrollmentCTA |
| `AcceleratorChat.tsx` | Full-screen SSE chat interface; shows sub-agent indicator banner; delegates state to `useAcceleratorChat` |
| `EnrollmentCTA.tsx` | Sales page for unenrolled users — 8-module grid, $997 pricing, Stripe checkout button |
| `ProgressPanel.tsx` | Collapsible right sidebar — module map, review queue, deliverables summary |
| `useAcceleratorChat.ts` | Custom hook — SSE streaming, message state, sub-agent tracking, auto-onboarding trigger, module focus |

### Inline Card Components (`cards/`)

Rendered inside the chat via `displayHint` routing in `CopilotMessage`:

| Card | Triggered By |
|------|-------------|
| `ApprovalCard.tsx` | Deliverable ready for user approval |
| `CheckoutCard.tsx` | Enrollment / checkout prompt |
| `DeliverableCard.tsx` | Deliverable status display |
| `MetricsCard.tsx` | Metrics summary or diagnostic output |
| `OnboardingIntakeCard.tsx` | Onboarding intake form |
| `QualityCheckCard.tsx` | Validation result display |
| `TaskBoardCard.tsx` | Module task board view |

### Display Hints

The `AcceleratorDisplayHint` type controls which inline card renders:
`task_board` | `deliverable_card` | `approval_card` | `quality_check` | `metrics_card` | `onboarding_intake` | `enrollment_card` | `checkout_card`

---

## AI Agents

### Orchestrator (`accelerator-prompt.ts`)

`buildAcceleratorPromptSection()` generates the accelerator context injected into the copilot system prompt when the user has an active enrollment. It includes:
1. Program identity and critical rules (module order enforced, validation required)
2. Full program state summary (module statuses, deliverable counts, review queue)
3. Coaching mode instructions (do_it / guide_me / teach_me)
4. Active module SOPs with quality bars (from `program_sops` table)
5. Sub-agent dispatch routing table
6. Review queue alert (if pending items exist)
7. Onboarding flow (if `intake_data` is null)

### Sub-Agent Dispatch Rules

Dispatch when:
- Starting a new deliverable within a module
- User asks for module-specific work help
- Quality checks fail and content needs rework
- Metrics are below benchmark and user needs diagnosis

Do NOT dispatch for: general questions, status checks, cross-module planning, greetings.

---

## Trigger.dev Tasks

All tasks live in `src/trigger/`. They are polled and dispatched by the scheduler task.

| Task ID | File | Purpose |
|---------|------|---------|
| `accelerator-scheduler` | `accelerator-scheduler.ts` | Cron: every 15 min. Polls `program_schedules` for due tasks and dispatches them |
| `accelerator-collect-metrics` | `accelerator-collect-metrics.ts` | Collects metrics from providers (PlusVibe for email M4, HeyReach for DMs M3) and MagnetLab internal data (content M7, funnels M1). Stores to `program_metrics` |
| `accelerator-digest` | `accelerator-digest.ts` | Weekly: generates a metrics digest email (via Resend) and creates a `metrics_digest` deliverable |

### Default System Schedules (created on enrollment)

| Task | Cron | Description |
|------|------|-------------|
| `collect_metrics` | `0 6 * * *` | Daily at 06:00 UTC |
| `weekly_digest` | `0 9 * * 1` | Mondays at 09:00 UTC |
| `warmup_check` | `0 7 * * *` | Daily at 07:00 UTC |

---

## Metrics and Benchmarks

Metrics are collected per module. Each metric has `benchmark_low` and `benchmark_high` values (SOP-derived). Status: `below` / `at` / `above`.

| Metric Key | Module | Low | High |
|------------|--------|-----|------|
| `email_sent` | m4 | 20 | 50 |
| `email_open_rate` | m4 | 40% | 65% |
| `email_reply_rate` | m4 | 3% | 10% |
| `email_bounce_rate` | m4 | 0% | 5% |
| `dm_sent` | m3 | 15 | 30 |
| `dm_acceptance_rate` | m3 | 30% | 60% |
| `dm_reply_rate` | m3 | 10% | 25% |
| `tam_size` | m2 | 500 | 5000 |
| `tam_email_coverage` | m2 | 40% | 75% |
| `content_posts_published` | m7 | 3 | 7 |
| `content_avg_impressions` | m7 | 500 | 3000 |
| `content_avg_engagement` | m7 | 2% | 8% |
| `funnel_opt_in_rate` | m1 | 15% | 40% |
| `funnel_page_views` | m1 | 50 | 500 |
| `ads_spend` | m5 | $1500 | $5000 |
| `ads_cpl` | m5 | $20 | $150 |
| `ads_ctr` | m5 | 0.3% | 1.0% |
| `ads_roas` | m5 | 1x | 5x |
| `os_weekly_reviews` | m6 | 3 | 4 |
| `os_daily_sessions` | m6 | 15 | 25 |

---

## Key Files

### Types
- `src/lib/types/accelerator.ts` — all types, DB column constants, module IDs and names

### Services
- `src/lib/services/accelerator-enrollment.ts` — enrollment creation, access check, `ACCELERATOR_STRIPE_PRICE_ID`
- `src/lib/services/accelerator-program.ts` — CRUD + `getProgramState()` composite
- `src/lib/services/accelerator-metrics.ts` — metrics recording, benchmarks, summary
- `src/lib/services/accelerator-scheduler.ts` — schedule CRUD, cron parser, system schedule init
- `src/lib/services/accelerator-troubleshooter.ts` — diagnostic rule loading and matching
- `src/lib/services/accelerator-usage.ts` — usage event tracking and allocation checks
- `src/lib/services/accelerator-validation.ts` — Claude Haiku quality bar validation

### AI
- `src/lib/ai/copilot/accelerator-prompt.ts` — builds the accelerator section of the copilot system prompt

### API Routes
- `src/app/api/accelerator/program-state/route.ts` — GET program state
- `src/app/api/accelerator/enroll/route.ts` — POST Stripe checkout

### Frontend
- `src/frontend/api/accelerator.ts` — client API module (`startEnrollment`, `getProgramState`)
- `src/components/accelerator/AcceleratorPage.tsx` — main layout
- `src/components/accelerator/AcceleratorChat.tsx` — SSE chat
- `src/components/accelerator/EnrollmentCTA.tsx` — unenrolled sales page
- `src/components/accelerator/ProgressPanel.tsx` — module/deliverable sidebar
- `src/components/accelerator/useAcceleratorChat.ts` — chat hook

### Dashboard Route
- `src/app/(dashboard)/accelerator/page.tsx` — server component, auth gate, renders AcceleratorPage

### Trigger.dev Tasks
- `src/trigger/accelerator-scheduler.ts` — 15-min cron dispatcher
- `src/trigger/accelerator-collect-metrics.ts` — provider metric collection
- `src/trigger/accelerator-digest.ts` — weekly digest email

### Stripe Integration
- `src/server/services/stripe.service.ts` — `checkout.session.completed` handler calls `createPaidEnrollment()`

---

## Env Vars

```
ACCELERATOR_STRIPE_PRICE_ID  # Stripe price ID for the $997 one-time accelerator payment
```

This var is read in `accelerator-enrollment.ts` and validated at enroll time. If missing, the `/api/accelerator/enroll` route returns 500.

---

## Data Flow

```
User → /accelerator (unenrolled) → EnrollmentCTA
  → POST /api/accelerator/enroll
  → Stripe checkout (mode: payment, $997)
  → Stripe webhook: checkout.session.completed (product: accelerator)
  → stripe.service.ts: createPaidEnrollment()
    → program_enrollments row (status: active, coaching_mode: guide_me)
    → program_modules rows (8 rows, all not_started)
    → initializeSystemSchedules() (3 Trigger.dev cron schedules)

User → /accelerator (enrolled) → AcceleratorPage
  → GET /api/accelerator/program-state → ProgramState
  → AcceleratorChat + ProgressPanel

AcceleratorChat → POST /api/copilot/chat (SSE)
  → copilot system prompt includes buildAcceleratorPromptSection()
    → active module SOPs, coaching mode, program state, review queue
  → orchestrator responds or dispatches sub-agent
    → sub_agent_start SSE event → banner shown in UI
    → sub-agent executes tools:
        create_deliverable → program_deliverables
        update_module_progress → program_modules
        validate_deliverable → Claude Haiku quality check
        save_intake_data → program_enrollments.intake_data
    → tool_result SSE events → AcceleratorPage calls loadProgramState()
    → sub_agent_end SSE event → banner hidden

Background (Trigger.dev):
  accelerator-scheduler (every 15 min)
    → getDueSchedules() → program_schedules
    → collect_metrics task → PlusVibe / HeyReach / MagnetLab → program_metrics
    → weekly_digest task → MetricsSummary → Resend email → metrics_digest deliverable
```

---

## Setup Guide

### Required Environment Variables

| Variable | Description | Where |
|----------|-------------|-------|
| `ACCELERATOR_STRIPE_PRICE_ID` | Stripe price ID for $997 one-time payment | Vercel env |
| `ANTHROPIC_API_KEY` | Claude API key (for copilot chat + Haiku validation) | Vercel + Trigger.dev |
| `TRIGGER_SECRET_KEY` | Trigger.dev project key | Vercel + Trigger.dev |

### Database Setup

Run all Supabase migrations. Key accelerator tables:
- `program_enrollments` — enrollment records with intake data
- `program_modules` — 8 module rows per enrollment
- `program_deliverables` — work products created by sub-agents
- `program_sops` — curriculum content (52 SOPs from dwy-playbook)
- `program_schedules` — Trigger.dev cron schedules
- `program_metrics` — performance metrics per module
- `diagnostic_rules` — troubleshooter rule patterns

### SOP Content Seeding

SOPs are seeded via a one-time extraction script that parses markdown files from `dwy-playbook/docs/sops/` using Claude Haiku:

```bash
# From magnetlab root
npx tsx scripts/seed-sops.ts
```

This generates `supabase/migrations/20260311500000_seed_program_sops.sql` (52 SOPs with quality bars, deliverables, and tools). Apply via Supabase Management API or `supabase db push`.

The script:
1. Discovers all `sop-*.md` files in dwy-playbook
2. Extracts structured data (title, content, quality bars, deliverables, tools) via Claude Haiku
3. Validates against known deliverable types and tools
4. Generates idempotent SQL with `ON CONFLICT (module_id, sop_number) DO UPDATE`

### Diagnostic Rules

The `diagnostic_rules` table drives the troubleshooter sub-agent. Rules are manually inserted via SQL — see `supabase/migrations/` for examples.

---

## Sub-Agent Hardening

The action executor (`src/lib/actions/executor.ts`) includes:
- **Per-tool timeout**: Default 30s, configurable via `ExecuteActionOptions.timeoutMs`
- **Exponential backoff retry**: Up to 2 retries for transient errors (ECONNRESET, 429, 502-504)
- **Retryable error detection**: Pattern matching on error messages for known transient failures
- **Graceful degradation**: Individual tool failures in sub-agent dispatch are caught and returned as error results so the AI can adapt

---

## UI Components

All accelerator UI uses inline SVG icons (no emoji/Unicode) with `aria-hidden="true"` for accessibility.

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `AcceleratorPage` | Main layout (chat + sidebar) | Loading/error/enrollment states, retry on error |
| `AcceleratorChat` | SSE chat interface | Sub-agent spinner, SVG send button |
| `ProgressPanel` | Right sidebar with modules/deliverables | Collapsible, mini progress bars, status SVG icons |
| `EnrollmentCTA` | Sales page for unenrolled users | 8 SVG module icons, Stripe checkout |
| `DeliverableCard` | Deliverable preview in chat | Per-status SVG icons, validation feedback |
| `TaskBoardCard` | Checklist of module steps | Progress bar, animated active step |
| `MetricsCard` | Performance metrics grid | SVG trend arrows, responsive layout |
| `ApprovalCard` | Confirmation dialog | Warning triangle icon, 3-button hierarchy |
| `CheckoutCard` | Tool provisioning checkout | Feature checkmarks, lock icon |
| `OnboardingIntakeCard` | Multiple-choice intake form | SVG radio/checkbox icons |
| `QualityCheckCard` | Pass/fail quality results | Per-check SVG icons, severity styling |
