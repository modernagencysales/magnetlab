# CLAUDE.md

> This repo: `/Users/timlife/Documents/claude code/magnetlab`

## Identity

MagnetLab is a SaaS platform for creating AI-powered LinkedIn lead magnets -- users go through a 6-step wizard to extract their expertise, generate content variations, publish to LinkedIn, and capture leads through customizable funnel pages.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 18.3, TypeScript 5.6+
- **Database**: Supabase (PostgreSQL), 14 migrations
- **Auth**: NextAuth v5 beta -- Google OAuth
- **UI**: Tailwind CSS 3.4 + shadcn/ui + Framer Motion + Recharts
- **AI**: @anthropic-ai/sdk (Claude) for content generation, style extraction, email sequences + OpenAI (embeddings)
- **AI Brain**: pgvector semantic search over transcript knowledge base (content pipeline)
- **Payments**: Stripe (checkout, webhooks, subscriptions: free/pro/unlimited)
- **Email**: Resend (transactional) + Loops (marketing automation)
- **Jobs/Integrations**: Trigger.dev v4, user webhooks
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

Groups: `lead-magnet/` (CRUD, content, polish, ideation), `funnel/` (pages, sections, publish, themes), `stripe/` (checkout, webhooks, portal), `leads/` (management, export), `brand-kit/` (extraction), `thumbnail/` (generation), `email-sequence/` (CRUD, trigger), `swipe-file/` (browse, save), `webhooks/` (user-configured), `integrations/` (connect/disconnect), `public/` (lead capture, page data, content delivery), `linkedin/` (post helpers), `landing-page/` (quick create), `user/` (profile), `external/` (third-party callbacks).

## Database

Supabase PostgreSQL, 14 migrations. Tables:

- `users` -- user accounts (linked to NextAuth)
- `subscriptions` -- Stripe subscription state
- `usage_tracking` -- plan limit enforcement (free/pro/unlimited)
- `brand_kits` -- extracted brand styles and colors
- `lead_magnets` -- core content entities (title, archetype, content blocks)
- `lead_magnet_analytics` -- view/download metrics
- `extraction_sessions` -- wizard state persistence (6-step progress)
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

## Branding & Conversion Tracking

Team-level branding settings that apply across all funnels. Configured in Settings > Branding & Defaults.

### Brand Kit Fields (on `brand_kits` table)

- `logos` (jsonb array) -- client logos for logo bar sections
- `default_testimonial` (jsonb) -- `{quote, author, role}` for testimonial sections
- `default_steps` (jsonb) -- `{steps: [{icon, title, description}]}` for next-steps sections
- `default_theme` -- `dark` or `light`
- `default_primary_color` -- hex color (default `#8b5cf6`)
- `default_background_style` -- `solid`, `gradient`, or `pattern`
- `logo_url` -- uploaded logo (Supabase Storage `public-assets` bucket)
- `font_family` -- Google Font name or custom font name
- `font_url` -- custom .woff2 font URL (Supabase Storage)

### How Branding Flows

1. User configures branding in Settings (`BrandingSettings` component)
2. On funnel creation (`POST /api/funnel`), brand kit values are fetched and merged into template sections (logo_bar, testimonial, steps) + theme/color/font defaults
3. Font is snapshotted on `funnel_pages.font_family` / `font_url` at creation time -- changes to brand kit don't retroactively affect existing funnels
4. `FontLoader` component handles both Google Fonts (CDN link) and custom .woff2 fonts (`@font-face` injection with XSS sanitization)

### Conversion Tracking

- `page_views` table has `page_type` column (`optin` or `thankyou`) with unique constraint on `(funnel_page_id, viewer_hash, page_type)`
- Thank-you page tracks views via `POST /api/public/view` with `pageType: 'thankyou'`
- Analytics API (`/api/analytics/funnel/[id]`) returns `thankyouViews`, `responded` (leads with qualification answers), and `responseRate`
- Magnets page shows conversion rate badges (views → leads)

### Key Files

- `src/components/settings/BrandingSettings.tsx` -- 5-card settings UI (logo, theme, font, testimonial, steps)
- `src/app/api/brand-kit/upload/route.ts` -- logo/font upload to Supabase Storage
- `src/components/funnel/public/FontLoader.tsx` -- font loading + XSS sanitization, exports `GOOGLE_FONTS`
- `src/app/api/public/view/route.ts` -- page view tracking with `pageType` validation

## A/B Testing (Thank-You Page)

Self-serve A/B testing for thank-you pages to maximize survey completion rate. Tests one field at a time: headline, subline, video on/off, or pass message.

### Data Model

- `ab_experiments` table -- experiment definition (status, test_field, winner_id, significance, min_sample_size)
- `funnel_pages` columns added: `experiment_id`, `is_variant` (boolean), `variant_label`
- Variants are cloned `funnel_pages` rows linked via `experiment_id`. Existing `page_views` and `funnel_leads` tracking works unchanged per variant.

### How It Works

1. **Create test**: User picks a field to test on the funnel builder's thank-you tab. AI (Claude) generates 2-3 variant suggestions. User picks one (or writes custom).
2. **Bucketing**: Server-side deterministic hash (`SHA-256(IP + User-Agent + experiment_id)`) assigns visitors to variants. No cookies. Same visitor always sees same variant.
3. **Tracking**: Each variant has its own `funnel_page_id`, so `page_views` (page_type='thankyou') and `funnel_leads` track per-variant automatically.
4. **Auto-winner**: Trigger.dev scheduled task (`check-ab-experiments`, every 6 hours) runs two-proportion z-test. At p < 0.05 with min sample size met, declares winner.
5. **Winner promotion**: Winning field value is copied back to the control row. URL never changes. Variant rows are unpublished.

### API Routes

- `GET/POST /api/ab-experiments` -- list (with `?funnelPageId=` filter) and create experiments
- `GET/PATCH/DELETE /api/ab-experiments/[id]` -- get with stats, pause/resume/declare-winner, delete
- `POST /api/ab-experiments/suggest` -- AI variant suggestions using Claude (claude-sonnet-4-5-20250514)

### Key Files

- `src/components/funnel/ABTestPanel.tsx` -- dashboard UI (4 states: no test, creating, running, completed)
- `src/components/funnel/FunnelBuilder.tsx` -- integrates ABTestPanel in thankyou tab
- `src/app/p/[username]/[slug]/thankyou/page.tsx` -- server-side bucketing logic
- `src/trigger/check-ab-experiments.ts` -- auto-winner detection (6-hour cron)
- `src/app/api/ab-experiments/` -- CRUD + suggest APIs
- `supabase/migrations/20260218200000_ab_experiments.sql` -- migration

### Important Notes

- Always filter funnel queries with `.eq('is_variant', false)` to hide variant rows from funnel lists
- One experiment per funnel at a time (create API enforces this)
- Experiment paused/completed/draft → serve control (or winner if completed)

## External Thank-You Page Redirect

Funnel owners can redirect leads to an external URL instead of showing the built-in thank-you page.

### Configuration

Three modes via `redirect_trigger` column on `funnel_pages`:
- `none` (default): Built-in thank-you page
- `immediate`: Skip thank-you page, redirect right after opt-in
- `after_qualification`: Show survey first, then redirect based on result

### Data Model

- `redirect_trigger` TEXT NOT NULL DEFAULT 'none' — mode selector
- `redirect_url` TEXT — primary redirect URL (or qualified-lead URL)
- `redirect_fail_url` TEXT — unqualified-lead redirect URL (after_qualification only)

Both URLs get `?leadId=xxx&email=yyy` appended automatically.

### Key Files

- `src/components/funnel/ThankyouPageEditor.tsx` — redirect config UI (dropdown + URL inputs)
- `src/components/funnel/public/OptinPage.tsx` — immediate redirect logic
- `src/components/funnel/public/ThankyouPage.tsx` — post-qualification redirect effect
- `src/app/p/[username]/[slug]/page.tsx` — passes redirect config to OptinPage
- `src/app/p/[username]/[slug]/thankyou/page.tsx` — passes redirect config + lead email to ThankyouPage

## Default Resource Delivery Email

Auto-sends a "here is your resource" email on opt-in, with a per-funnel toggle (default ON).

### Priority Rules

| Active sequence? | Toggle ON | Result |
|---|---|---|
| Yes | Any | Sequence handles delivery (default email skipped) |
| No | ON | System sends fixed-template resource email |
| No | OFF | Resource shown directly on thank-you page |

### Data Model

- `funnel_pages.send_resource_email` BOOLEAN NOT NULL DEFAULT true — per-funnel toggle
- Fixed system template (no customization) — subject: "Your [Title] is ready"

### How It Works

1. Lead opts in → `POST /api/public/lead` creates lead, fires webhooks
2. Calls `triggerEmailSequenceIfActive()` — if sequence handles it, done
3. If no sequence: checks `send_resource_email` toggle
4. Toggle ON + content exists → triggers `send-resource-email` Trigger.dev task
5. Toggle OFF → thank-you page shows resource link/button directly

### Key Files

- `src/trigger/send-resource-email.ts` — Trigger.dev task (fixed HTML template via Resend)
- `src/app/api/public/lead/route.ts` — conditional trigger (sequence > resource email > nothing)
- `src/lib/services/email-sequence-trigger.ts` — exported `getSenderInfo()` + `getUserResendConfig()`
- `src/components/funnel/ThankyouPageEditor.tsx` — toggle UI (Resource Delivery section)
- `src/components/funnel/public/ThankyouPage.tsx` — conditional banner + resource button
- `src/app/p/[username]/[slug]/thankyou/page.tsx` — computes `showResourceOnPage` from toggle + sequence state

## Custom Domains & White-Label

Team-level custom domain and white-label support. One domain per team via CNAME → Vercel. Pro+ plan only.

### Database

- `team_domains` table: `id, team_id, domain, vercel_domain_id, status, dns_config, last_checked_at, created_at, updated_at`
- `teams` table columns: `hide_branding`, `custom_favicon_url`, `custom_site_name`, `custom_email_sender_name`, `whitelabel_enabled`
- Status values: `pending_dns`, `verified`, `active`, `error`
- RLS: public SELECT (middleware needs unauthenticated lookup), owner CRUD

### How It Works

1. **Domain setup**: User enters domain in Settings → `POST /api/settings/team-domain` → Vercel Domains API adds domain → returns DNS instructions
2. **DNS verification**: User configures CNAME → clicks Verify (or auto-poll 10s×12) → `POST /api/settings/team-domain/verify` → Vercel API checks → status → `active`
3. **Request routing**: `middleware.ts` reads Host header → `lookupCustomDomain()` (LRU cached 60s, 500 entries) → rewrites to `/p/[username]/[slug]` → sets `x-custom-domain` + `x-team-id` headers
4. **White-label rendering**: Server components fetch `getWhitelabelConfig(teamId)` → pass `hideBranding` to client components → conditional "Powered by" footer
5. **Metadata**: `custom_site_name` replaces "MagnetLab" in `<title>` suffix and og:site_name; `custom_favicon_url` as `<link rel="icon">`

### Key Files

- `src/lib/utils/domain-lookup.ts` -- LRU-cached domain → team/username resolution
- `src/lib/utils/whitelabel.ts` -- `getWhitelabelConfig(teamId)` helper
- `src/lib/integrations/vercel-domains.ts` -- Vercel Domains API client (add, check, remove, config)
- `src/middleware.ts` -- Custom domain routing (Host header → rewrite)
- `src/app/api/settings/team-domain/route.ts` -- Domain CRUD (GET, POST, DELETE)
- `src/app/api/settings/team-domain/verify/route.ts` -- DNS verification
- `src/app/api/settings/whitelabel/route.ts` -- White-label settings (GET, PATCH)
- `src/components/settings/WhiteLabelSettings.tsx` -- Settings UI (domain + branding)
- `src/components/funnel/public/OptinPage.tsx` -- Conditional branding
- `src/components/funnel/public/ThankyouPage.tsx` -- Conditional branding
- `src/components/content/ContentFooter.tsx` -- Conditional branding
- `supabase/migrations/20260219000000_team_domains_whitelabel.sql` -- Migration

### Env Vars

- `VERCEL_TOKEN` -- Vercel API bearer token (required for domain provisioning)
- `VERCEL_PROJECT_ID` -- Vercel project ID for magnetlab
- `VERCEL_TEAM_ID` -- Vercel team ID (optional, for org accounts)

### Whitelabel Email Domains

Teams can verify their own email sending domain via Resend API (in-app), so transactional emails send from their domain instead of `sends.magnetlab.app`.

- `team_email_domains` table: `id, team_id, domain, resend_domain_id, status, dns_records, region, last_checked_at, created_at, updated_at`
- `teams.custom_from_email` column: full sender address (e.g., `hello@clientbrand.com`)
- Status values: `pending`, `verified`, `failed`
- DNS records from Resend include SPF (TXT), DKIM (TXT), and MX with per-record verification status
- Sender resolution priority in `getSenderInfo()`: user's own Resend account > team verified email domain + `custom_from_email` > default `hello@sends.magnetlab.app`

Key files:
- `src/lib/integrations/resend-domains.ts` -- Resend Domains API client (create, get, verify, delete)
- `src/app/api/settings/team-email-domain/route.ts` -- Email domain CRUD
- `src/app/api/settings/team-email-domain/verify/route.ts` -- DNS verification
- `src/app/api/settings/team-email-domain/from-email/route.ts` -- From-email with domain suffix validation
- `src/lib/services/email-sequence-trigger.ts` -- `getSenderInfo()` resolves team email domain

### Deprecation / Removed

- `funnel_pages.custom_domain` column is ignored — domain is now team-level via `team_domains`
- **Loops integration removed** — `src/lib/integrations/loops.ts` deleted, all Loops types and references cleaned from email types and API routes. DB columns `loops_synced_at` / `loops_transactional_ids` remain in `email_sequences` table (harmless).

## Integration Points

- **GTM webhooks**: Fires `lead.created`, `lead.qualified`, `lead_magnet.deployed` to gtm-system via `lib/webhooks/gtm-system.ts` (fire-and-forget, 5s timeout, `x-webhook-secret` auth). **Scoped to GTM system owner only** (`GTM_SYSTEM_USER_ID` env var) — other magnetlab users' leads are NOT sent to gtm-system.
- **User webhooks**: Users configure their own endpoints for lead capture events (`lib/webhooks/sender.ts`, signature verify in `lib/webhooks/verify.ts`)
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
- `RESEND_API_KEY` -- Transactional email
- `TRIGGER_SECRET_KEY` -- Background jobs
- `GTM_SYSTEM_WEBHOOK_URL` / `GTM_SYSTEM_WEBHOOK_SECRET` / `GTM_SYSTEM_USER_ID` -- GTM webhooks (optional, only fires for this user's leads)
- `OPENAI_API_KEY` -- Embeddings (text-embedding-3-small) for AI Brain / content pipeline
- `GRAIN_WEBHOOK_SECRET` -- Grain transcript webhook auth
- `FIREFLIES_WEBHOOK_SECRET` -- Fireflies transcript webhook auth
- `VERCEL_TOKEN` -- Vercel API token for custom domain provisioning
- `VERCEL_PROJECT_ID` -- Vercel project ID for domain management
- `VERCEL_TEAM_ID` -- Vercel team ID (optional, for org accounts)

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

## Testing Philosophy

### What to test and when

| Layer | Tool | What it catches | When to write |
|-------|------|----------------|---------------|
| **Schema validation** | Jest | Zod schema ↔ actual data shape mismatches | Every new/changed API route or Zod schema |
| **API integration** | Jest | Route handler logic, auth, DB errors | Every new API route |
| **Critical path e2e** | Playwright | Save flow, funnel publish, lead capture broken end-to-end | Every new archetype or major wizard change |
| **Typecheck** | `tsc --noEmit` | Type errors | Always (run before commit) |

### The #1 bug pattern to guard against

**Zod schemas drifting from actual data shapes.** TypeScript can't catch this because DB columns accept `Json`/`unknown`. The Zod schema is the only runtime check, so if it's wrong, bad data silently passes or valid data gets rejected.

**Rule: When you add or change a Zod schema, add a Jest test with realistic data matching what the UI actually sends.** See `src/__tests__/api/lead-magnet/create.test.ts` for the pattern — it tests each archetype's payload against `createLeadMagnetSchema`.

### Jest tests (fast, run often)

```
npm run test                              # All tests
npx jest src/__tests__/api/lead-magnet/   # Specific directory
npx jest --no-coverage path/to/test.ts    # Single file, fast
```

- API route tests: mock Supabase + auth, test request/response shapes
- Schema tests: validate Zod accepts realistic payloads, rejects bad ones
- Use `@jest-environment node` for API route tests

### Playwright e2e tests (slower, critical paths only)

```
npm run test:e2e                  # All e2e (needs dev server)
npm run test:e2e:headed           # With browser visible
npx playwright test e2e/wizard.spec.ts   # Single file
```

- Auth: cookie-based setup in `e2e/fixtures/auth.ts`
- Mocks: `e2e/helpers/index.ts` has Supabase, Stripe, AI, and auth mocks
- API contract tests in `e2e/wizard.spec.ts` POST realistic payloads directly to validate schema acceptance
- Config: `playwright.config.ts` (chromium, firefox, mobile-safari)

### When NOT to test

- Don't write Playwright tests for every UI variation — only critical user flows
- Don't test Supabase/Stripe internals — mock them and test your logic
- Don't duplicate what `tsc --noEmit` already catches

## Engagement Intelligence

Scrapes LinkedIn post engagement (commenters + likers) via Apify, stores in DB, pushes leads to HeyReach campaigns. Supports own posts and competitor profile monitoring.

### Tool Responsibility Split

| Tool | Does | Doesn't |
|------|------|---------|
| Unipile | Publish posts, like comments, reply to comments | Scrape, DM, connect |
| Apify | Scrape all engagement (own + competitor posts) | Any actions |
| HeyReach | DMs, connection requests (via campaign enrollment) | Scraping |

### Apify Actors

- **`scraping_solutions/linkedin-posts-engagers`** ($30/mo) — takes post URL + type (`commenters` or `likers`), returns ~50 engagers
- **`supreme_coder/linkedin-post`** (already rented) — takes profile URL, returns recent posts with engagement counts
- Both called via `run-sync-get-dataset-items` endpoint (blocks until complete)
- API token: `APIFY_API_TOKEN` env var

### Database Tables

- `cp_monitored_competitors` — up to 10 competitor LinkedIn profiles per user (user_id scoped, RLS)
- `cp_post_engagements` — extended with `source` (`own_post`/`competitor`), `source_post_url`, `competitor_id`, `subtitle`; `post_id` now nullable
- `linkedin_automations` — extended with `heyreach_campaign_id`, `resource_url`

### Cron: `scrape-engagement` (every 10 min)

1. Auto-disable expired posts (7+ days)
2. Scrape own posts (Apify engagers actor, adaptive schedule)
3. Scrape competitor posts (profile posts actor → engagers per post, every 60 min)
4. Push new leads to HeyReach campaigns

### Comment Automation Flow

Unipile webhook → keyword match → HeyReach campaign enrollment (DM/connect) + Unipile like/reply (low-risk actions). No more Unipile DMs or follow-up scheduling.

### Key Files

- `src/lib/integrations/apify-engagers.ts` — Apify client (`scrapeEngagers`, `scrapeProfilePosts`)
- `src/lib/integrations/heyreach.ts` — HeyReach push with custom variables
- `src/lib/integrations/unipile.ts` — Stripped to publishing + like/reply only
- `src/trigger/scrape-engagement.ts` — Unified cron (own + competitor scraping)
- `src/lib/services/linkedin-automation.ts` — Comment automation (HeyReach for DM, Unipile for like/reply)
- `src/app/api/competitors/` — Competitor monitoring CRUD
- `src/components/settings/CompetitorMonitoring.tsx` — Settings UI

### Env Vars

| Var | Where | Purpose |
|-----|-------|---------|
| `APIFY_API_TOKEN` | `.env.local` + Vercel + Trigger.dev | Apify API calls |
| `HEYREACH_API_KEY` | Trigger.dev | HeyReach campaign enrollment |

## Deployment

- **Vercel**: Auto-deploy is broken for private org repos (needs Vercel Pro). Deploy manually:
  ```
  vercel --prod
  ```
- **Trigger.dev tasks**: Deployed separately. Uses its own dedicated project (`proj_jdjofdqazqwitpinxady`):
  ```
  TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy
  ```
- **DO NOT** add Trigger.dev deploy to Vercel build — CLI needs `TRIGGER_ACCESS_TOKEN` (PAT), not `TRIGGER_SECRET_KEY`.

## Related Repos

| Repo | Path | Purpose |
|------|------|---------|
| gtm-system | `/Users/timlife/Documents/claude code/gtm-system` | GTM orchestrator, webhooks, lead routing |
| copy-of-gtm-os | `/Users/timlife/Documents/claude code/copy-of-gtm-os` | Public Blueprint pages, GC Portal, Bootcamp LMS |
| leadmagnet-admin | `/Users/timlife/linkedin-leadmagnet-admin` | Admin dashboard for Blueprint Generator backend |
| leadmagnet-backend | `/Users/timlife/linkedin-leadmagnet-backend` | Blueprint pipeline: scrape -> enrich -> generate |

## Post-Feature Workflow

After completing any new feature:

1. **Code review** -- trigger `superpowers:requesting-code-review` to catch security issues, missing scoping, and spec compliance
2. **Resolve issues** -- fix all critical and important findings from the review
3. **Update docs** -- add feature documentation to this CLAUDE.md (architecture, key files, data flow)
