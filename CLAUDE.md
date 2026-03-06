# CLAUDE.md

> This repo: `/Users/timlife/Documents/claude code/magnetlab`

## Identity

MagnetLab is a SaaS platform for creating AI-powered LinkedIn lead magnets -- users go through a 6-step wizard to extract their expertise, generate content variations, publish to LinkedIn, and capture leads through customizable funnel pages.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 18.3, TypeScript 5.6+
- **Database**: Supabase (PostgreSQL), 72 migrations
- **Auth**: NextAuth v5 beta -- Google OAuth
- **UI**: Tailwind CSS 3.4 + shadcn/ui + Framer Motion + Recharts
- **AI**: @anthropic-ai/sdk (Claude) for content generation, style extraction, email sequences + OpenAI (embeddings)
- **AI Brain**: pgvector semantic search over transcript knowledge base (content pipeline)
- **Payments**: Stripe (checkout, webhooks, subscriptions: free/pro/unlimited)
- **Email**: Resend (transactional)
- **Jobs/Integrations**: Trigger.dev v4, user webhooks
- **Testing**: Jest 29 + React Testing Library + Playwright
- **Deploy**: Vercel

## Architecture

### Directory

```
src/
├── app/           — (marketing), (auth), (dashboard)/, api/ (57 routes), p/[username]/[slug]/
├── server/        — repositories/ (DB queries), services/ (business logic) ← NEW layered arch
├── components/    — wizard/, funnel/, content/, dashboard/, settings/, leads/, copilot/, ui/
├── lib/           — ai/, integrations/, auth/, types/, utils/, services/, validations/, webhooks/
├── trigger/       — Background jobs (8 tasks)
├── middleware.ts   — Auth guard + custom domain routing
└── __tests__/     — Tests mirroring src/
```

### Layered Architecture

**Route → Service → Repository → Supabase.** Dependencies flow one direction only.

| Layer | Location | Responsibility | Constraint |
|-------|----------|---------------|------------|
| **Route** | `src/app/api/` | Auth + parse params + call service + return JSON | Max 30 lines. No Supabase, no business logic. |
| **Service** | `src/server/services/` | Business logic, validation, orchestration | Never imports NextRequest, NextResponse, or cookies. |
| **Repository** | `src/server/repositories/` | ALL Supabase queries | Never imported by client components. Named column selects. |

**New API domains**: Create `{domain}.repo.ts` + `{domain}.service.ts` before writing the route handler.

**Scoping**: Every read operation accepts `scope: DataScope` (resolved in routes via `getDataScope(userId)`).

**Error flow**: Services throw `Object.assign(new Error(msg), { statusCode: N })`. Each service exports `getStatusCode(err)`. Routes catch and map to HTTP status.

**Update pattern**: Services use `ALLOWED_UPDATE_FIELDS` whitelists. Never spread request body into DB.

### Patterns

- Server Components for data fetching; Client Components (`"use client"`) for interactive UI
- Middleware checks `authjs.session-token` cookie; redirects unauthed to `/login`
- API handlers use `auth()` + return 401 if missing; Zod validates request bodies
- Fire-and-forget GTM webhooks (5s timeout, non-blocking)
- Stripe billing enforces plan limits via `usage_tracking` table
- `@/` path alias maps to `src/`

## Key Routes

**Dashboard**: `create/` (wizard), `library/`, `leads/`, `analytics/`, `pages/`, `settings/`, `swipe-file/`, `signals/`, `admin/` (super-admin only)

**Settings** (sidebar layout): account, integrations, signals, branding, copilot, developer

**Public**: `/p/[username]/[slug]` (opt-in), `/thankyou`, `/content`

**API** (57 handlers): lead-magnet/, funnel/, stripe/, leads/, brand-kit/, email-sequence/, integrations/, webhooks/, public/, linkedin/, external/, copilot/, content-pipeline/, ab-experiments/, signals/

## Database

### Core Tables

`users`, `subscriptions`, `usage_tracking`, `brand_kits`, `lead_magnets`, `lead_magnet_analytics`, `extraction_sessions`, `funnel_pages`, `funnel_leads`, `qualification_questions`, `funnel_page_sections`, `page_views`, `email_sequences`, `swipe_file_posts`, `user_integrations`, `polished_content`

### Content Pipeline (cp_ prefix)

`cp_call_transcripts`, `cp_knowledge_entries` (pgvector), `cp_knowledge_tags`, `cp_knowledge_topics`, `cp_knowledge_corroborations`, `cp_content_ideas`, `cp_pipeline_posts`, `cp_posting_slots`, `cp_post_templates`, `cp_writing_styles`, `cp_edit_history`

### Other Feature Tables

`ab_experiments`, `team_domains`, `team_email_domains`, `funnel_integrations`, `signal_configs`, `signal_keyword_monitors`, `signal_company_monitors`, `signal_profile_monitors`, `signal_leads`, `signal_events`, `copilot_conversations`, `copilot_messages`, `copilot_memories`, `ai_prompt_templates`, `ai_prompt_versions`, `engagement_enrichments`, `linkedin_automations`, `team_profile_integrations`

### Key RPCs

`cp_match_knowledge_entries()`, `cp_match_knowledge_entries_v2()`, `cp_decrement_buffer_positions()`, `cp_update_topic_stats()`, `cp_match_team_knowledge_entries()`

### Gotchas

- Always filter funnel queries with `.eq('is_variant', false)` to hide A/B test variant rows
- `lead_magnet_status` enum: ONLY `draft`, `published`, `scheduled`, `archived`
- `select('*')` silently fails if ANY column is missing — always use named columns

## System Context

```
            gtm-system (orchestrator hub)
              │ webhooks
    ┌─────────┼──────────┐
    v         v          v
magnetlab  leadmagnet  copy-of-gtm-os
(THIS REPO) -backend   (public pages,
 SaaS app  (pipeline)   GC portal, LMS)
                ^
          leadmagnet-admin (admin UI)
```

MagnetLab fires webhooks to gtm-system on: lead captured, lead qualified, lead magnet deployed. Scoped to `GTM_SYSTEM_USER_ID` only.

## Feature Decision Guide

| Feature Type | Repo |
|---|---|
| Lead magnet creation/AI content generation | magnetlab |
| LinkedIn scraping/enrichment | leadmagnet-backend |
| Blueprint admin UI/prompts | leadmagnet-admin |
| Public Blueprint pages, GC portal, LMS | copy-of-gtm-os |
| Webhook ingestion from 3rd parties | gtm-system |
| Lead routing/pipeline orchestration | gtm-system |
| Cold email campaigns | gtm-system |
| Content scheduling/publishing | magnetlab |
| Reply classification/delivery | gtm-system |
| Funnel pages/opt-in pages | magnetlab |
| Stripe billing | magnetlab (SaaS) or copy-of-gtm-os (bootcamp) |

## Feature Documentation Index

Detailed docs for each feature system (extracted from this file for brevity):

| Feature | Doc |
|---------|-----|
| Content Pipeline & AI Brain | `docs/content-pipeline.md` |
| AI Co-pilot | `docs/ai-copilot.md` |
| LinkedIn Signal Engine | `docs/signal-engine.md` |
| CRM Integrations (GHL, Kajabi, HeyReach) | `docs/integrations-crm.md` |
| Email Marketing Integrations | `docs/integrations-email-marketing.md` |
| Custom Domains & White-Label | `docs/custom-domains.md` |
| Funnel Features (A/B, layouts, redirect, resource email) | `docs/funnel-features.md` |
| Content Production System | `docs/content-production-workflow.md` |
| Team Command Center | `docs/team-command-center.md` |
| AI Admin Panel | `docs/ai-admin-panel.md` |
| DFY Onboarding Automation | `docs/dfy-onboarding.md` |
| Engagement Cold Email Pipeline | `docs/engagement-email-pipeline.md` |
| Branding & Conversion Tracking | `docs/branding-and-tracking.md` |
| Email Sequences | `docs/email-sequences.md` |
| Testing Strategy | `docs/testing-strategy.md` |

Read the relevant doc when working on that feature.

## Integration Points

- **GTM webhooks**: `lib/webhooks/gtm-system.ts` — fire-and-forget, `x-webhook-secret` auth, scoped to `GTM_SYSTEM_USER_ID`
- **User webhooks**: Custom endpoints for lead capture events (`lib/webhooks/sender.ts`)
- **Notetakers**: Grain, Fireflies (shared secrets), Fathom (per-user webhook URLs) — all webhook-based
- **Stripe**: Checkout/subscriptions/webhooks at `/api/stripe/`
- **Email ESPs**: Kit, MailerLite, Mailchimp (OAuth), ActiveCampaign — see `docs/integrations-email-marketing.md`
- **CRMs**: GoHighLevel, Kajabi — see `docs/integrations-crm.md`
- **LinkedIn**: Unipile (publish/interact), Harvest API (scrape), HeyReach (DMs/campaigns)

## Development

### Commands

```
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint (flat config)
npm run typecheck        # tsc --noEmit
npm run test             # Run all Jest tests
npm run test:watch       # Tests in watch mode
npm run test:coverage    # Tests with coverage (50% min thresholds)
npm run db:push          # Push Supabase migrations
npm run db:reset         # Reset Supabase database
npm run db:generate      # Regenerate TS types from DB schema
```

### Env Vars

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `TRIGGER_SECRET_KEY`, `GTM_SYSTEM_WEBHOOK_URL`, `GTM_SYSTEM_WEBHOOK_SECRET`, `GTM_SYSTEM_USER_ID`, `OPENAI_API_KEY`, `GRAIN_WEBHOOK_SECRET`, `FIREFLIES_WEBHOOK_SECRET`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `MAILCHIMP_CLIENT_ID`, `MAILCHIMP_CLIENT_SECRET`, `HARVEST_API_KEY`

### Deployment

```
vercel --prod   # Manual deploy (Vercel Pro needed for private org repos)
TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy   # Trigger.dev tasks
```

DO NOT add Trigger.dev deploy to Vercel build — CLI needs `TRIGGER_ACCESS_TOKEN` (PAT), not `TRIGGER_SECRET_KEY`.

## Post-Feature Workflow

1. **Write tests** -- schema validation, API route, and utility tests. No exceptions.
2. **Code review** -- trigger `superpowers:requesting-code-review` (checks against Code Standards in global CLAUDE.md)
3. **Resolve issues** -- fix all critical and important findings
4. **Update docs** -- add feature documentation to this file or a `docs/` file
