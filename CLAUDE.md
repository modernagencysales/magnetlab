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
- **Design System**: `@magnetlab/magnetui` (packages/magnetui) — Radix + CVA + Tailwind
- **Monorepo**: pnpm workspaces (`packages/*`)
- **Testing**: Jest 29 + React Testing Library + Playwright
- **Deploy**: Vercel

## Architecture

### Directory (2 levels)

```
src/
├── app/
│   ├── (marketing)/       # Landing pages
│   ├── (auth)/            # Login, callbacks
│   ├── (dashboard)/       # create/, library/, leads/, analytics/, pages/, settings/, swipe-file/
│   ├── api/               # 57 route handlers (see API Routes below)
│   └── p/[username]/[slug]/ # Public opt-in, thankyou, content pages
├── components/            # wizard/, funnel/, content/, dashboard/, ds/, settings/, leads/, ui/
├── lib/                   # ai/, integrations/, auth/, types/, utils/, services/, validations/, webhooks/, constants/, api/
├── trigger/               # Background jobs
├── frontend/              # Client data layer: API client, domain modules, hooks, Zustand stores
├── middleware.ts          # Auth guard for dashboard routes
└── __tests__/             # 16 test files: api/, components/, lib/
```

### Frontend (client data layer)

All client-side API calls and shared client state live under `src/frontend/`: `api/` (API client + domain modules), `hooks/api/` (e.g. useIdeas, usePosts), and `stores/` (Zustand, e.g. content-pipeline). Components use `@/frontend/api/*` and `@/frontend/hooks/api/*`; they should not call `fetch('/api/...')` directly. See [docs/frontend-refactor-plan.md](docs/frontend-refactor-plan.md).

### Patterns

- Server Components for data fetching; Client Components (`"use client"`) for interactive UI
- Middleware checks `authjs.session-token` cookie; redirects unauthed to `/login`
- API handlers use `getServerSession()` + return 401 if missing; Zod validates request bodies
- Fire-and-forget GTM webhooks (5s timeout, non-blocking)
- Stripe billing enforces plan limits via `usage_tracking` table
- `@/` path alias maps to `src/`

## Key Features

### Dashboard Routes

| Route | Purpose |
|-------|---------|
| `/(dashboard)/create` | 6-step lead magnet creation wizard |
| `/(dashboard)/create/page-quick` | Quick landing page generator |
| `/(dashboard)/library` | Lead magnet library (list, search, manage) |
| `/(dashboard)/library/[id]/funnel` | Funnel builder for a specific lead magnet |
| `/(dashboard)/leads` | Lead management table with filters |
| `/(dashboard)/analytics` | Metrics dashboard (Recharts) |
| `/(dashboard)/pages` | Funnel page management |
| `/(dashboard)/settings` | Settings hub (redirects to /settings/account) |
| `/(dashboard)/swipe-file` | Community post inspiration |
| `/(dashboard)/signals` | LinkedIn Signal Engine leads |

### Settings Routes

| Route | Content |
|-------|---------|
| `/settings/account` | Profile, Username, Subscription, Team Members, Brand Kit summary |
| `/settings/integrations` | LinkedIn, Resend, Email Marketing, CRM, HeyReach, Fathom, Conductor, Tracking Pixels, Webhooks |
| `/settings/signals` | ICP Configuration, Keyword Monitors, Company Monitors, Competitor Monitoring |
| `/settings/branding` | Branding (6-card accordion), Page Defaults (video, template), White Label (Pro+) |
| `/settings/developer` | API Keys, Webhooks, Documentation |

### Public Routes

| Route | Purpose |
|-------|---------|
| `/p/[username]/[slug]` | Public opt-in/landing page |
| `/p/[username]/[slug]/thankyou` | Post-opt-in thank you page |
| `/p/[username]/[slug]/content` | Hosted lead magnet content |

### API Routes (57 handlers)

Groups: `lead-magnet/` (CRUD, content, polish, ideation), `funnel/` (pages, sections, publish, themes), `stripe/` (checkout, webhooks, portal), `leads/` (management, export), `brand-kit/` (extraction), `thumbnail/` (generation), `email-sequence/` (CRUD, trigger), `swipe-file/` (browse, save), `webhooks/` (user-configured), `integrations/` (connect/disconnect), `public/` (lead capture, page data, content delivery), `linkedin/` (post helpers), `landing-page/` (quick create), `user/` (profile), `external/` (third-party callbacks), `content-pipeline/` (knowledge, ideas, posts, schedule, broadcast), `copilot/` (AI assistant), `signals/` (config, keywords, companies, leads), `ab-experiments/` (A/B testing), `admin/` (prompts, learning).

## Database

Supabase PostgreSQL. Key tables:

**Core**: `users`, `subscriptions`, `usage_tracking`, `brand_kits`, `lead_magnets`, `lead_magnet_analytics`, `extraction_sessions`, `funnel_pages`, `funnel_leads`, `qualification_questions`, `funnel_page_sections`, `page_views`, `email_sequences`, `swipe_file_posts`, `user_integrations`, `polished_content`

**Content Pipeline** (`cp_` prefix): `cp_call_transcripts`, `cp_knowledge_entries`, `cp_knowledge_tags`, `cp_knowledge_topics`, `cp_knowledge_corroborations`, `cp_content_ideas`, `cp_pipeline_posts`, `cp_posting_slots`, `cp_post_templates`, `cp_writing_styles`, `cp_edit_history`, `cp_post_engagements`

**Signal Engine**: `signal_configs`, `signal_keyword_monitors`, `signal_company_monitors`, `signal_profile_monitors`, `signal_leads`, `signal_events`

**Other**: `ab_experiments`, `team_domains`, `team_email_domains`, `team_profile_integrations`, `funnel_integrations`, `copilot_conversations`, `copilot_messages`, `copilot_memories`, `ai_prompt_templates`, `ai_prompt_versions`, `engagement_enrichments`, `linkedin_automations`

RPCs: `cp_match_knowledge_entries()`, `cp_match_knowledge_entries_v2()`, `cp_decrement_buffer_positions()`, `cp_update_topic_stats()`, `cp_match_team_knowledge_entries()`

## Integration Points

- **GTM webhooks**: Fires `lead.created`, `lead.qualified`, `lead_magnet.deployed` to gtm-system (fire-and-forget, 5s timeout, `x-webhook-secret` auth). Scoped to `GTM_SYSTEM_USER_ID` only.
- **User webhooks**: Users configure their own endpoints for lead capture events
- **Notetaker integrations (Grain, Fireflies, Fathom)**: All webhook-based. Fathom uses per-user webhook URLs with unique secrets.
- **Stripe**: Checkout/subscriptions/webhooks at `/api/stripe/`
- **Email Marketing (Kit, MailerLite, Mailchimp, ActiveCampaign)**: See [docs/integrations-email-marketing.md](docs/integrations-email-marketing.md)
- **GoHighLevel CRM**: See [docs/integrations-crm.md](docs/integrations-crm.md)
- **HeyReach LinkedIn Delivery**: See [docs/integrations-crm.md](docs/integrations-crm.md)
- **LinkedIn Signal Engine**: Harvest API for scraping, Unipile for publishing, HeyReach for DMs. See [docs/signal-engine.md](docs/signal-engine.md)
- **PlusVibe Cold Email**: Enrichment waterfall + push. See [docs/engagement-email-pipeline.md](docs/engagement-email-pipeline.md)

## System Context

```
            gtm-system (orchestrator hub)
              | webhooks
    +---------+----------+
    v         v          v
magnetlab  leadmagnet  copy-of-gtm-os
(THIS REPO) -backend   (public pages,
 SaaS app  (pipeline)   GC portal, LMS)
                ^
          leadmagnet-admin (admin UI)
```

## Feature Decision Guide

| Feature Type | Repo | Rationale |
|---|---|---|
| Lead magnet creation/AI content generation | magnetlab | Owns the lead magnet product, AI pipeline, funnel builder |
| LinkedIn profile scraping/enrichment | leadmagnet-backend | Owns the Blueprint pipeline |
| Blueprint admin UI/prompt editing | leadmagnet-admin | Admin dashboard for Blueprint backend |
| Public Blueprint pages/prospect pages | copy-of-gtm-os | Hosts all public-facing Blueprint pages + student portals |
| GC member portal features | copy-of-gtm-os | Owns the Growth Collective member experience |
| Bootcamp LMS/student features | copy-of-gtm-os | Owns the LinkedIn Bootcamp product |
| Webhook ingestion from 3rd parties | gtm-system | Central webhook hub for 14+ integrations |
| Lead routing/pipeline orchestration | gtm-system | Owns lead lifecycle from capture to sales handoff |
| Cold email campaigns | gtm-system | Owns all cold email: UI, campaign management, enrichment, pipeline |
| Content scheduling/publishing | magnetlab | Owns content pipeline, autopilot, AI Brain |
| Reply classification/delivery | gtm-system | Owns the reply pipeline |
| Funnel pages/opt-in pages | magnetlab | Owns funnel builder, opt-in, thank-you, content pages |

## Development

### Env Vars (`.env.local`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `TRIGGER_SECRET_KEY`, `GTM_SYSTEM_WEBHOOK_URL`, `GTM_SYSTEM_WEBHOOK_SECRET`, `GTM_SYSTEM_USER_ID`, `OPENAI_API_KEY`, `GRAIN_WEBHOOK_SECRET`, `FIREFLIES_WEBHOOK_SECRET`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `MAILCHIMP_CLIENT_ID`, `MAILCHIMP_CLIENT_SECRET`, `HARVEST_API_KEY`, `LEADMAGIC_API_KEY`, `PROSPEO_API_KEY`, `BLITZ_API_KEY`, `ZEROBOUNCE_API_KEY`, `BOUNCEBAN_API_KEY`, `PLUSVIBE_API_KEY`, `SUBSCRIBER_SYNC_WEBHOOK_SECRET`

### Package Manager

**pnpm only** — this is a pnpm workspace monorepo. Never use `npm` or `yarn`. Always use `pnpm`.

### Commands

```
pnpm dev                 # Start dev server
pnpm build               # Production build
pnpm lint                # ESLint (flat config)
pnpm typecheck           # tsc --noEmit
pnpm test                # Run all Jest tests
pnpm test:watch          # Tests in watch mode
pnpm test:coverage       # Tests with coverage (50% min thresholds)
pnpm db:push             # Push Supabase migrations
pnpm db:reset            # Reset Supabase database
pnpm db:generate         # Regenerate TS types from DB schema
```

### Design System (packages/magnetui)

```
pnpm --filter @magnetlab/magnetui storybook       # Storybook dev (port 6006)
pnpm --filter @magnetlab/magnetui build            # Build package
pnpm --filter @magnetlab/magnetui build-storybook  # Static Storybook build
```

Tests in `src/__tests__/` mirror source structure (api/, components/, lib/). Uses `jest-environment-jsdom`, `@/` mapped via `moduleNameMapper`.

## Testing Philosophy

| Layer | Tool | When to write |
|-------|------|---------------|
| Schema validation | Jest | Every new/changed API route or Zod schema |
| API integration | Jest | Every new API route |
| Critical path e2e | Playwright | Every new archetype or major wizard change |
| Typecheck | `tsc --noEmit` | Always (run before commit) |

**#1 bug pattern**: Zod schemas drifting from actual data shapes. Rule: When you add or change a Zod schema, add a Jest test with realistic data. See `src/__tests__/api/lead-magnet/create.test.ts` for the pattern.

## Deployment

- **Vercel**: GitHub Actions deploy on CI success. See [docs/deployment-standards.md](docs/deployment-standards.md).
- **Branch mapping**: `main` → dev (preview); `release/*` → production
- **Trigger.dev**: `TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB pnpm dlx trigger.dev@4.3.3 deploy`
- **DO NOT** add Trigger.dev deploy to Vercel build

## Related Repos

| Repo | Path | Purpose |
|------|------|---------|
| gtm-system | `/Users/timlife/Documents/claude code/gtm-system` | GTM orchestrator, webhooks, lead routing |
| copy-of-gtm-os | `/Users/timlife/Documents/claude code/copy-of-gtm-os` | Public Blueprint pages, GC Portal, Bootcamp LMS |
| leadmagnet-admin | `/Users/timlife/linkedin-leadmagnet-admin` | Admin dashboard for Blueprint Generator backend |
| leadmagnet-backend | `/Users/timlife/linkedin-leadmagnet-backend` | Blueprint pipeline: scrape -> enrich -> generate |

## Feature Documentation

Detailed docs for each feature live in `docs/`. Consult these when working on a specific feature:

| Feature | Doc |
|---------|-----|
| Content Pipeline + Knowledge Data Lake | [docs/content-pipeline.md](docs/content-pipeline.md) |
| AI Co-pilot | [docs/ai-copilot.md](docs/ai-copilot.md) |
| LinkedIn Signal Engine | [docs/signal-engine.md](docs/signal-engine.md) |
| CRM Integrations (GHL, HeyReach) | [docs/integrations-crm.md](docs/integrations-crm.md) |
| Email Marketing Integrations | [docs/integrations-email-marketing.md](docs/integrations-email-marketing.md) |
| Custom Domains & White-Label | [docs/custom-domains.md](docs/custom-domains.md) |
| Funnel Features (A/B Testing, Layouts, Redirects, Resource Email) | [docs/funnel-features.md](docs/funnel-features.md) |
| Branding & Conversion Tracking | [docs/branding-and-tracking.md](docs/branding-and-tracking.md) |
| Content Production System | [docs/content-production-workflow.md](docs/content-production-workflow.md) |
| Team Command Center | [docs/team-command-center.md](docs/team-command-center.md) |
| AI Admin Panel | [docs/ai-admin-panel.md](docs/ai-admin-panel.md) |
| DFY Onboarding Automation | [docs/dfy-onboarding.md](docs/dfy-onboarding.md) |
| Engagement Cold Email Pipeline | [docs/engagement-email-pipeline.md](docs/engagement-email-pipeline.md) |
| Email Sequences | [docs/email-sequences.md](docs/email-sequences.md) |
| Testing Strategy | [docs/testing-strategy.md](docs/testing-strategy.md) |
| Deployment Standards | [docs/deployment-standards.md](docs/deployment-standards.md) |
| Frontend Architecture | [docs/frontend-refactor-plan.md](docs/frontend-refactor-plan.md) |
| Coding Standards | [docs/coding-standards.md](docs/coding-standards.md) |

## Post-Feature Workflow

After completing any new feature:

1. **Write tests** -- Zod schema tests, API route tests, utility function tests. No exceptions.
2. **Code review** -- trigger `superpowers:requesting-code-review`
3. **Resolve issues** -- fix all critical and important findings
4. **Update docs** -- add feature documentation to `docs/` and link from the Feature Documentation table above
