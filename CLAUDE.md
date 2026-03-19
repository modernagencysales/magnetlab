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
| `/(dashboard)/content-queue` | Cross-team content editing queue |

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

Groups: `lead-magnet/` (CRUD, content, polish, ideation), `funnel/` (pages, sections, publish, themes), `stripe/` (checkout, webhooks, portal), `leads/` (management, export), `brand-kit/` (extraction), `thumbnail/` (generation), `email-sequence/` (CRUD, trigger), `swipe-file/` (browse, save), `webhooks/` (user-configured), `integrations/` (connect/disconnect), `public/` (lead capture, page data, content delivery), `linkedin/` (post helpers), `landing-page/` (quick create), `user/` (profile), `external/` (third-party callbacks), `content-pipeline/` (knowledge, ideas, posts, schedule, broadcast), `content-queue/` (DFY editing queue, post updates, batch submit), `copilot/` (AI assistant), `signals/` (config, keywords, companies, leads), `ab-experiments/` (A/B testing), `admin/` (prompts, learning).

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
| Development Workflow | [docs/development-workflow.md](docs/development-workflow.md) |
| Frontend Architecture | [docs/frontend-refactor-plan.md](docs/frontend-refactor-plan.md) |
| Coding Standards | [docs/coding-standards.md](docs/coding-standards.md) |
| AI Standards Learning Loop | [docs/standards-learning-loop.md](docs/standards-learning-loop.md) |
| Docs Index | [docs/README.md](docs/README.md) |
| MCP v2 Agent-Native Spec | [docs/superpowers/specs/2026-03-13-mcp-v2-agent-native-rearchitecture.md](docs/superpowers/specs/2026-03-13-mcp-v2-agent-native-rearchitecture.md) |
| Content Queue | [docs/superpowers/specs/2026-03-17-dfy-content-queue-design.md](docs/superpowers/specs/2026-03-17-dfy-content-queue-design.md) |
| Unified Asset Review Queue | [docs/superpowers/specs/2026-03-18-unified-asset-review-queue-design.md](docs/superpowers/specs/2026-03-18-unified-asset-review-queue-design.md) |
| Outreach Sequence Engine | [docs/superpowers/specs/2026-03-18-outreach-sequence-engine-design.md](docs/superpowers/specs/2026-03-18-outreach-sequence-engine-design.md) |

## Outreach Sequence Engine (Mar 2026)

Proactive LinkedIn outreach — create campaigns with preset sequences, add leads, and the system automatically executes view profile → connect → message → follow-up steps with human-like timing.

### Architecture

```
Agent creates campaign + adds leads via MCP
  → advance-outreach-sequences evaluates leads every 5 min
  → enqueues actions into linkedin_action_queue
  → execute-linkedin-actions drains queue per account (safety-gated)
  → check-outreach-replies detects replies every 30 min
```

All LinkedIn actions (from both outreach sequences AND post campaigns) flow through a single shared queue. One action at a time per account, randomized delays, operating hours, circuit breaker.

### Key Files

| File | Purpose |
|------|---------|
| `src/trigger/execute-linkedin-actions.ts` | Shared queue executor (drains all LinkedIn actions) |
| `src/trigger/advance-outreach-sequences.ts` | Lead state machine (evaluates next steps per preset) |
| `src/trigger/check-outreach-replies.ts` | Reply detection + follow-up |
| `src/server/services/linkedin-action-executor.ts` | Maps action types to Unipile API calls |
| `src/server/repositories/linkedin-action-queue.repo.ts` | Queue CRUD operations |
| `src/server/services/outreach-campaigns.service.ts` | Campaign CRUD + validation |
| `src/server/repositories/outreach-campaigns.repo.ts` | Campaign + lead DB access |
| `src/lib/types/outreach-campaigns.ts` | Types, presets (warm_connect, direct_connect, nurture) |
| `src/lib/types/linkedin-action-queue.ts` | Queue types, priority constants |

### Presets

| Preset | Steps |
|--------|-------|
| warm_connect | view profile → wait 1 day → connect → message on accept → follow up 3 days |
| direct_connect | view profile → connect immediately → message on accept → follow up 3 days |
| nurture | view profile → wait 3 days → connect → message on accept → follow up 5 days |

### MCP Tools (12)

`magnetlab_create_outreach_campaign`, `magnetlab_list_outreach_campaigns`, `magnetlab_get_outreach_campaign`, `magnetlab_update_outreach_campaign`, `magnetlab_activate_outreach_campaign`, `magnetlab_pause_outreach_campaign`, `magnetlab_delete_outreach_campaign`, `magnetlab_add_outreach_leads`, `magnetlab_list_outreach_leads`, `magnetlab_get_outreach_lead`, `magnetlab_skip_outreach_lead`, `magnetlab_get_linkedin_activity`

## MCP Server (v2 — Agent-Native)

The MCP server (`packages/mcp/`) provides 63 direct tools for AI agents. No execute gateway, no category browsers — every tool is registered with full parameter schemas.

**Philosophy:** Backend handles CRUD + rendering + embeddings. Agent handles all creative content work. Content is a single `content` JSONB field validated against archetype-specific Zod schemas at publish time.

**Key concepts:**
- **Unified content model**: Single `content` field replaces 3-layer pipeline (extracted/generated/polished). Archetype Zod schemas at `src/lib/schemas/archetypes/`.
- **Deep-merge updates**: PATCH `/lead-magnet/[id]` with shallow merge, array replacement, null deletion, `content_version` optimistic locking.
- **Compound actions**: `launch_lead_magnet` (create + funnel + publish atomic), `schedule_content_week` (batch post creation).
- **Team scoping**: Every tool accepts optional `team_id`. No implicit session state.

**Tool categories (63 tools):**
| Category | Tools | Count |
|----------|-------|-------|
| Lead Magnets | list, get, create, update, delete | 5 |
| Funnels | list, get, create, update, delete, publish, unpublish | 7 |
| Knowledge | search, browse, clusters, ask, submit_transcript | 5 |
| Posts | list, get, create, update, delete, publish | 6 |
| Email | get_sequence, save_sequence, activate | 3 |
| Leads | list, get, export | 3 |
| Schema | list_archetypes, get_archetype_schema, get_business_context | 3 |
| Compound | launch_lead_magnet, schedule_content_week | 2 |
| Feedback | performance_insights, recommendations | 2 |
| Outreach | create, list, get, update, activate, pause, delete, add_leads, list_leads, get_lead, skip_lead | 11 |
| LinkedIn Activity | get_linkedin_activity | 1 |
| Account | list_teams | 1 |
| Content Queue | list_content_queue, update_queue_post, submit_queue_batch, review_lead_magnet, review_funnel, submit_asset_review | 6 |

**New API routes (v2):**
- PATCH `/lead-magnet/[id]` — deep-merge content update
- POST `/content-pipeline/posts` — agent-authored post (no AI generation)
- PUT `/email-sequence/[leadMagnetId]` — full-replace semantics
- GET `/leads/[id]` — single lead detail
- POST `/lead-magnet/launch` — compound create + publish
- POST `/content-pipeline/posts/schedule-week` — batch scheduling
- GET `/analytics/performance-insights` — aggregated metrics
- GET `/analytics/recommendations` — Phase 1 stub

**Tests:** 272 MCP package tests (vitest), plus API route tests in main app (Jest).

## Post-Feature Workflow

After completing any new feature:

1. **Write tests** -- Zod schema tests, API route tests, utility function tests. No exceptions.
2. **Code review** -- trigger `superpowers:requesting-code-review`
3. **Resolve issues** -- fix all critical and important findings
4. **Update docs** -- add feature documentation to `docs/` and link from the Feature Documentation table above

## Funnel Restyler (Mar 2026)

AI-powered funnel restyling — takes text prompts ("make it more corporate") and/or example URLs, generates a structured branding plan, user reviews/tweaks individual items, then applies.

### Architecture

```
User input (prompt + optional URLs)
  → POST /api/funnel/[id]/restyle
  → restyle.service.ts
    → If URLs: Claude Vision analyzes screenshots for style signals
    → Builds prompt with current funnel state + style intent
    → Claude generates structured branding plan (JSON)
  → Returns plan to caller (MCP or UI)
  → User reviews, removes items they don't want
  → POST /api/funnel/[id]/apply-restyle
    → Updates funnel fields (theme, color, font, background)
    → Adds/removes/reorders sections
```

### What Changes

- **Field changes:** theme (dark/light), primaryColor, backgroundStyle, fontFamily, fontUrl
- **Section changes:** add/remove/reorder logo_bar, steps, testimonial, marketing_block, section_bridge
- **Does NOT change:** text content, qualification questions, integrations

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/ai/restyle/plan-generator.ts` | Prompt builder, vision prompt, plan parser |
| `src/server/services/restyle.service.ts` | Orchestrates plan generation and application |
| `src/app/api/funnel/[id]/restyle/route.ts` | Generate plan API |
| `src/app/api/funnel/[id]/apply-restyle/route.ts` | Apply plan API |
| `src/components/funnel/RestylePanel.tsx` | UI panel (Restyle with AI section) |
| `src/components/funnel/ThemeEditor.tsx` | Hosts RestylePanel in theme tab |
| `packages/mcp/src/tools/funnels.ts` | MCP tool definitions |
| `packages/mcp/src/handlers/funnels.ts` | MCP handler wiring |
| `packages/mcp/src/client.ts` | MCP client methods |

### MCP Tools

- `magnetlab_restyle_funnel` — generate plan: `{ funnel_id, prompt?, urls? }`
- `magnetlab_apply_restyle` — apply plan: `{ funnel_id, plan }`

## Enhanced Page Builder (Mar 2026)

9 section types with named layout variants, position rules engine, and scroll animations. AI picks sections/variants on creation; user refines via restyler.

### Section Types & Variants

| Type | Variants | Max Per Page |
|------|----------|-------------|
| hero | centered, split-image, full-bleed-gradient | 1 (optin only) |
| logo_bar | inline, grid | 1 (optin only) |
| stats_bar | inline, cards, animated-counters | 1 |
| steps | numbered, timeline, icon-cards | 1 |
| feature_grid | icon-top, icon-left, minimal | 1 |
| testimonial | quote-card, highlight, avatar | 2 |
| social_proof_wall | grid, carousel, stacked | 1 |
| section_bridge | divider, accent-bar, gradient-fade | 3 |
| marketing_block | feature-card, benefit, faq-accordion, cta-banner | 3 |

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/types/funnel.ts` | SECTION_VARIANTS, new config interfaces |
| `src/lib/validations/section-rules.ts` | Position rules engine |
| `src/lib/validations/api.ts` | Variant-specific Zod schemas |
| `src/lib/ai/funnel-generation/section-generator.ts` | AI section generation prompts |
| `src/components/funnel/animations/` | ScrollReveal, useCountUp hooks |
| `src/components/ds/HeroSection.tsx` | Hero renderer (3 variants) |
| `src/components/ds/StatsBar.tsx` | Stats bar renderer (3 variants) |
| `src/components/ds/FeatureGrid.tsx` | Feature grid renderer (3 variants) |
| `src/components/ds/SocialProofWall.tsx` | Social proof wall renderer (3 variants) |
| `src/components/funnel/section-editors/` | Config editors for each section type |

### MCP Tools

- `magnetlab_list_sections` — list sections for a funnel
- `magnetlab_create_section` — create with type, variant, config
- `magnetlab_update_section` — update variant, config, visibility
- `magnetlab_delete_section` — remove section

## AI Standards Learning Loop (Mar 2026)

Automated workflow for AI-to-developer feature handoff and coding standards improvement.

### How It Works

1. **Feature Handoff** — When a PR is opened from `early-users/*` to `main` with Claude co-authored commits, a Linear issue is auto-created in the "Experimental Feature Pipeline" project
2. **Standards Review** — When that PR is merged, Claude Sonnet analyzes the diff between AI code and developer-refined code, categorizes findings, creates a Linear issue, and opens a draft PR proposing coding standards updates

### Key Files

| File | Purpose |
|------|---------|
| `.github/workflows/feature-handoff.yml` | PR opened → Linear issue creation |
| `.github/workflows/standards-review.yml` | PR merged → diff analysis trigger |
| `.github/scripts/analyze-standards.ts` | Claude Sonnet analysis + Linear + draft PR |

### Linear Configuration

- **Project:** Experimental Feature Pipeline (`43e6d56e-b1dc-43bd-8631-d99070bb942b`)
- **Labels:** `ai-built`, `needs-dev-review`, `standards-review`, `magnetlab`

### GitHub Secrets

- `ANTHROPIC_API_KEY_STANDARDS` — Dedicated workspace key (spend-limited)
- `LINEAR_API_KEY` — For creating issues
