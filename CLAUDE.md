# CLAUDE.md

> This repo: `/Users/timlife/Documents/claude code/magnetlab`

## Identity

MagnetLab is a SaaS platform for creating AI-powered LinkedIn lead magnets -- users go through a 6-step wizard to extract their expertise, generate content variations, publish to Notion/LinkedIn, and capture leads through customizable funnel pages.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 18.3, TypeScript 5.6+
- **Database**: Supabase (PostgreSQL), 14 migrations
- **Auth**: NextAuth v5 beta -- Google OAuth + Notion OAuth
- **UI**: Tailwind CSS 3.4 + shadcn/ui + Framer Motion + Recharts
- **AI**: @anthropic-ai/sdk (Claude) for content generation, style extraction, email sequences + OpenAI (embeddings)
- **AI Brain**: pgvector semantic search over transcript knowledge base (content pipeline)
- **Payments**: Stripe (checkout, webhooks, subscriptions: free/pro/unlimited)
- **Email**: Resend (transactional) + Loops (marketing automation)
- **Jobs/Integrations**: Trigger.dev v4, Notion API, LeadShark, user webhooks
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
├── trigger/               # Background jobs: create-lead-magnet.ts, email-sequence.ts, process-transcript.ts, autopilot-batch.ts, run-autopilot.ts
├── middleware.ts          # Auth guard for dashboard routes
└── __tests__/             # 16 test files: api/, components/, lib/
```

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
| `/(dashboard)/settings` | Account settings, billing, integrations |
| `/(dashboard)/swipe-file` | Community post inspiration |

### Public Routes

| Route | Purpose |
|-------|---------|
| `/p/[username]/[slug]` | Public opt-in/landing page |
| `/p/[username]/[slug]/thankyou` | Post-opt-in thank you page |
| `/p/[username]/[slug]/content` | Hosted lead magnet content |

### API Routes (57 handlers)

Groups: `lead-magnet/` (CRUD, content, polish, ideation), `funnel/` (pages, sections, publish, themes), `stripe/` (checkout, webhooks, portal), `notion/` (auth, publish, connections), `leads/` (management, export), `leadshark/` (enrichment), `brand-kit/` (extraction), `thumbnail/` (generation), `email-sequence/` (CRUD, trigger), `swipe-file/` (browse, save), `webhooks/` (user-configured), `integrations/` (connect/disconnect), `public/` (lead capture, page data, content delivery), `linkedin/` (post helpers), `landing-page/` (quick create), `user/` (profile), `external/` (third-party callbacks).

## Database

Supabase PostgreSQL, 14 migrations. Tables:

- `users` -- user accounts (linked to NextAuth)
- `subscriptions` -- Stripe subscription state
- `usage_tracking` -- plan limit enforcement (free/pro/unlimited)
- `brand_kits` -- extracted brand styles and colors
- `lead_magnets` -- core content entities (title, archetype, content blocks)
- `lead_magnet_analytics` -- view/download metrics
- `extraction_sessions` -- wizard state persistence (6-step progress)
- `notion_connections` -- Notion OAuth tokens and workspace info
- `funnel_pages` -- published funnel/opt-in pages (slug, theme, config)
- `funnel_leads` -- captured leads with UTM tracking
- `qualification_questions` -- survey questions per funnel
- `funnel_page_sections` -- modular page sections (hero, CTA, testimonials, etc.)
- `page_views` -- analytics for public pages
- `email_sequences` -- drip email campaign definitions
- `swipe_file_posts` -- community-shared content
- `swipe_file_lead_magnets` -- user saves of swipe file posts
- `user_integrations` -- connected third-party accounts (encrypted keys)
- `polished_content` -- AI-polished versions of content

### Content Pipeline Tables (cp_ prefix)

- `cp_call_transcripts` -- raw transcripts from Grain, Fireflies, or paste
- `cp_knowledge_entries` -- extracted insights/questions/intel with vector embeddings
- `cp_knowledge_tags` -- tag usage tracking per user
- `cp_content_ideas` -- post-worthy ideas extracted from transcripts
- `cp_pipeline_posts` -- posts in the autopilot pipeline (draft → review → schedule → publish)
- `cp_posting_slots` -- user's publishing schedule (time slots per day)
- `cp_post_templates` -- reusable post templates with embeddings
- `cp_writing_styles` -- user style profiles

RPCs: `cp_match_knowledge_entries()` (pgvector cosine similarity), `cp_decrement_buffer_positions()` (buffer reordering)

### Content Pipeline API Routes

- `api/webhooks/grain/` -- Grain transcript webhook
- `api/webhooks/fireflies/` -- Fireflies transcript webhook
- `api/content-pipeline/transcripts/` -- paste/upload + list transcripts
- `api/content-pipeline/knowledge/` -- search/browse AI Brain knowledge base
- `api/content-pipeline/ideas/` -- list, update, delete ideas; write post from idea
- `api/content-pipeline/posts/` -- CRUD + polish posts
- `api/content-pipeline/schedule/slots/` -- posting slots CRUD
- `api/content-pipeline/schedule/autopilot/` -- trigger autopilot + status
- `api/content-pipeline/schedule/buffer/` -- approve/reject buffer posts

## System Context

MagnetLab is one of five interconnected repos in the GTM ecosystem:

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

MagnetLab is the customer-facing SaaS. On key events (lead captured, lead qualified, lead magnet deployed), it fires webhooks to gtm-system for downstream routing.

## Feature Decision Guide

Use this table to determine which repo owns a given feature. This prevents building features in the wrong codebase.

| Feature Type | Repo | Rationale |
|---|---|---|
| Lead magnet creation/AI content generation | magnetlab | Owns the lead magnet product, AI pipeline, funnel builder |
| LinkedIn profile scraping/enrichment | leadmagnet-backend | Owns the Blueprint pipeline (scrape -> enrich -> generate) |
| Blueprint admin UI/prompt editing | leadmagnet-admin | Admin dashboard for the Blueprint backend |
| Public Blueprint pages/prospect pages | copy-of-gtm-os | Hosts all public-facing Blueprint pages + student portals |
| GC member portal features | copy-of-gtm-os | Owns the Growth Collective member experience |
| Bootcamp LMS/student features | copy-of-gtm-os | Owns the LinkedIn Bootcamp product |
| Webhook ingestion from 3rd parties | gtm-system | Central webhook hub for 14+ integrations |
| Lead routing/pipeline orchestration | gtm-system | Owns lead lifecycle from capture to sales handoff |
| Cold email campaigns | gtm-system | Owns all cold email: UI, campaign management, enrichment, pipeline |
| Content scheduling/publishing | magnetlab | Owns content pipeline, autopilot, AI Brain (migrated from gtm-system) |
| Reply classification/delivery | gtm-system | Owns the reply pipeline (AI classify -> Blueprint -> deliver) |
| Funnel pages/opt-in pages | magnetlab | Owns funnel builder, opt-in, thank-you, content pages |
| Stripe billing/subscriptions | magnetlab (SaaS billing) or copy-of-gtm-os (bootcamp subs) | Depends on which product the billing is for |
| AI prompt management | leadmagnet-admin (Blueprint) or magnetlab (lead magnets) | Depends on which AI pipeline |

## Integration Points

- **GTM webhooks**: Fires `lead.created`, `lead.qualified`, `lead_magnet.deployed` to gtm-system via `lib/webhooks/gtm-system.ts` (fire-and-forget, 5s timeout, `x-webhook-secret` auth)
- **User webhooks**: Users configure their own endpoints for lead capture events (`lib/webhooks/sender.ts`, signature verify in `lib/webhooks/verify.ts`)
- **Notion**: OAuth flow at `/api/notion/auth` + `/api/notion/callback`, publishes content as Notion pages, tokens in `notion_connections`
- **Stripe**: Checkout/subscriptions/webhooks at `/api/stripe/`, state in `subscriptions` table, limits via `usage_tracking`

## Development

### Env Vars (`.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL` -- Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` -- Supabase service role key
- `NEXTAUTH_SECRET` -- NextAuth session secret
- `NEXTAUTH_URL` -- App URL (http://localhost:3000)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` -- Google OAuth
- `ANTHROPIC_API_KEY` -- Claude AI
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` -- Stripe
- `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` -- Notion OAuth
- `RESEND_API_KEY` -- Transactional email
- `TRIGGER_SECRET_KEY` -- Background jobs
- `GTM_SYSTEM_WEBHOOK_URL` / `GTM_SYSTEM_WEBHOOK_SECRET` -- GTM webhooks (optional, silently skipped if missing)
- `OPENAI_API_KEY` -- Embeddings (text-embedding-3-small) for AI Brain / content pipeline
- `GRAIN_WEBHOOK_SECRET` -- Grain transcript webhook auth
- `FIREFLIES_WEBHOOK_SECRET` -- Fireflies transcript webhook auth

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

Tests in `src/__tests__/` mirror source structure (api/, components/, lib/). Uses `jest-environment-jsdom`, `@/` mapped via `moduleNameMapper`, mocks in `__tests__/__mocks__/`.

## Deployment

- **Vercel**: Auto-deploy is broken for private org repos (needs Vercel Pro). Deploy manually:
  ```
  vercel --prod
  ```
- **Trigger.dev tasks**: Deployed separately. Uses the shared leadmagnet project (`proj_lueymlvtfuvbroyvxzjw`):
  ```
  TRIGGER_SECRET_KEY=tr_prod_Ep09hT1RE1QgjuCP9hXm npx trigger.dev@4.3.3 deploy
  ```
- **DO NOT** add Trigger.dev deploy to Vercel build — CLI needs `TRIGGER_ACCESS_TOKEN` (PAT), not `TRIGGER_SECRET_KEY`.

## Related Repos

| Repo | Path | Purpose |
|------|------|---------|
| gtm-system | `/Users/timlife/Documents/claude code/gtm-system` | GTM orchestrator, webhooks, lead routing |
| copy-of-gtm-os | `/Users/timlife/Documents/claude code/copy-of-gtm-os` | Public Blueprint pages, GC Portal, Bootcamp LMS |
| leadmagnet-admin | `/Users/timlife/linkedin-leadmagnet-admin` | Admin dashboard for Blueprint Generator backend |
| leadmagnet-backend | `/Users/timlife/linkedin-leadmagnet-backend` | Blueprint pipeline: scrape -> enrich -> generate |
