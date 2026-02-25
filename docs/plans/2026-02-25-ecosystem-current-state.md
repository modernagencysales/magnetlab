# Ecosystem Current State — New Developer Guide

**Date:** 2026-02-25
**Purpose:** Honest assessment of where we are today across all production systems
**Context:** Read this before the [monorepo consolidation design](./2026-02-25-monorepo-consolidation-design.md)

---

## The Business

We sell GTM (go-to-market) systems for B2B agencies. The product line is converging from three separate offerings into one platform:

- **SaaS product** (magnetlab) — self-serve AI-powered lead magnets, funnels, content pipeline
- **Managed service** — done-for-you cold email, LinkedIn outreach, blueprint generation on top of the same tooling
- **Coaching/course** — bootcamp with curriculum, SOPs, AI tools

All three share the same backend infrastructure and database.

---

## The 6 Repos

### 1. magnetlab — The SaaS Product

| | |
|---|---|
| **Path** | `/Users/timlife/Documents/claude code/magnetlab` |
| **Stack** | Next.js 15, React 18, TypeScript 5.6, Tailwind + shadcn/ui |
| **Database** | Supabase (shared) |
| **Auth** | NextAuth v5 beta + Google OAuth |
| **AI** | Claude (Anthropic SDK) + OpenAI (embeddings only) |
| **Jobs** | Trigger.dev v4 (29 tasks) |
| **Payments** | Stripe (free/pro/unlimited plans) |
| **Deploy** | Vercel |
| **Size** | ~131k LOC, 218 API routes, 26 component modules |

**What it does:**
- 6-step lead magnet creation wizard with AI content generation
- Drag-and-drop funnel page builder with themes and custom domains
- Full content pipeline: transcript ingestion (Grain, Fireflies, Fathom) → AI knowledge extraction → idea generation → post writing → autopilot scheduling
- AI Brain with pgvector semantic search over extracted knowledge
- Email sequence builder (drip campaigns)
- Lead capture, qualification, analytics
- Swipe file (community content library)
- LinkedIn post scheduling and engagement tracking
- Brand kit extraction and application across funnels
- Stripe billing with usage tracking

**Strengths:**
- Most mature and well-organized codebase
- Clean component architecture (26 feature modules)
- Sophisticated AI pipeline (8 AI modules for content)
- pgvector embeddings for semantic search — genuinely powerful
- Good test coverage (438 test files)
- The content pipeline (cp_ tables) is well-designed with clear ownership

**Weaknesses:**
- NextAuth v5 is still in beta — occasional breaking changes on upgrade
- 218 API routes is a lot for one Next.js app — some cold start latency on Vercel
- Some feature modules are thin wrappers that could be consolidated
- Trigger.dev tasks should live in the backend (engine/) not the frontend app
- Direct Supabase writes for business logic that should go through an API layer

**Key files:**
- `src/middleware.ts` — auth + custom domain routing
- `src/lib/ai/content-pipeline/` — the 8 AI modules
- `src/trigger/` — 29 background tasks
- `src/app/api/` — 218 route handlers

---

### 2. gtm-system — The Backend Orchestrator

| | |
|---|---|
| **Path** | `/Users/timlife/Documents/claude code/gtm-system` |
| **Stack** | Next.js 16, React 19, TypeScript 5, Zod 4 |
| **Database** | Supabase (shared, multi-tenant with RLS) |
| **Auth** | Supabase SSR + CSRF double-submit cookie |
| **AI** | Claude + OpenAI + Gemini |
| **Jobs** | Trigger.dev v4 (73 tasks) |
| **Deploy** | Railway (gtmconductor.com) |
| **Size** | ~648 TS files, 250 API routes, 32 integration clients |

**What it does:**
- Central webhook hub — ingests from 27 external services (Clay, HeyReach, PlusVibe, Cal.com, Stripe, Attio, Unipile, etc.)
- Cold email campaign management (upload leads, enrich, push to PlusVibe/HeyReach)
- Reply pipeline: AI classification → Blueprint generation → multi-channel delivery
- DFY engagement system (client onboarding, intake processing, deliverable tracking, Linear project creation)
- Proposal generation (AI-powered)
- Infrastructure provisioning (Zapmail domain buying, mailbox setup, DMARC)
- TAM (Total Addressable Market) analysis pipeline
- DM Intelligence (lead scoring, Attio CRM bidirectional sync)
- Enrichment recipe system (configurable multi-step enrichment flows)
- Financial reconciliation and analytics dashboards
- Email automation flows

**Strengths:**
- Handles enormous integration complexity well — 32 API clients all follow a BaseApiClient pattern
- Trigger.dev task organization is logical (73 tasks across clear domains)
- CSRF protection is solid (double-submit cookie with timing-safe comparison)
- Webhook verification is consistent (HMAC where supported)
- Good test coverage (103 test files + 51 Playwright E2E tests)

**Weaknesses:**
- CSRF skip list is a constant gotcha — every new POST route silently fails until added
- CORS configuration is sprawling — 9 separate header sets for different route prefixes
- The middleware.ts is doing too much (CSRF + CORS + auth + session + redirects)
- Has a deprecated content pipeline (non-cp_ tables) that should be removed but isn't
- Some integration clients have stale code for APIs that changed (PlusVibe, HeyReach)
- Railway cold starts can be slow for the first request after idle

**Known landmines:**
- `src/middleware.ts` line ~50: CSRF validation. **Any new `/api/*` POST route will return "Invalid CSRF token" unless added to the skip list.** This has caused bugs at least 3 times.
- PlusVibe unibox endpoints MUST use `/api/v1/` prefix — without it, API returns 200 with empty data (not 404)
- Attio filter syntax uses `{"$contains": value}` (with $ prefix) — `{contains: value}` is silently rejected
- Enrichment lead status table has `created_at` only (no `updated_at`) — order by `created_at`
- HeyReach `AddLeadsToListV2` returns 404 — correct endpoint is `AddLeadsToCampaign`

**Key files:**
- `src/middleware.ts` — CORS + CSRF + auth (read this first)
- `src/lib/integrations/` — 32 API clients
- `src/trigger/` — 73 background tasks
- `src/lib/leads/` — core lead ingest and dedup logic

---

### 3. copy-of-gtm-os — The Multi-Product Frontend

| | |
|---|---|
| **Path** | `/Users/timlife/Documents/claude code/copy-of-gtm-os` |
| **Stack** | React 18, Vite 5, React Router v6, TanStack Query |
| **Database** | Supabase (direct reads) + Airtable (legacy) |
| **Auth** | Mixed (x-admin-key, portal tokens, Supabase, cookies) |
| **Deploy** | Vercel (manual: `vercel --prod`) |
| **Size** | ~8k files, 254 components, 40+ routes |

**What it does:**
Hosts 4 distinct products in one React SPA:
1. **Public Blueprint pages** — prospect-facing analysis/offer pages
2. **Bootcamp LMS** — student curriculum, progress tracking, AI tools, surveys
3. **Growth Collective portal** — member dashboard, ICP builder, campaigns
4. **Admin dashboard** — prospect management, proposals, DFY engagements, affiliates

Also hosts the DFY client portal (intake wizard, deliverable tracking).

**Strengths:**
- Clean service layer pattern — components never call DB directly
- Lazy-loaded route groups for code splitting
- TanStack Query for server state management
- MSW (Mock Service Worker) for testing without real backends
- Centralized API config (`lib/api-config.ts`)

**Weaknesses:**
- 4 products in 1 SPA is confusing — hard to know which code serves which audience
- React/Vite while everything else is Next.js — odd one out in the ecosystem
- Auth is the messiest here — admin uses x-admin-key, clients use portal tokens, students use Supabase, some pages use password cookies
- Airtable dependency is legacy and should be removed but some data still lives there
- CSP header in vercel.json must be manually updated when adding new API domains — caused a multi-hour debugging session (Feb 17 2026: "Failed to fetch" with no error)
- Manual Vercel deploys (`vercel --prod`) because private org repos need Vercel Pro

**Known landmines:**
- `vercel.json` Content-Security-Policy `connect-src` — if you add a new API domain and forget to add it here, browser silently blocks the fetch. curl works fine. No CORS error shown. Very hard to debug.
- The admin dashboard has overlapping functionality with leadmagnet-admin — some features exist in both
- Bootcamp is the largest section (94 components) and the most fragile — student progress tracking has edge cases

**Key files:**
- `App.tsx` — main router (all 40+ routes defined here)
- `lib/api-config.ts` — centralized API URLs
- `services/` — 22 service files for all external calls
- `vercel.json` — CSP headers (critical for cross-origin)

---

### 4. leadmagnet-backend — The Blueprint Pipeline

| | |
|---|---|
| **Path** | `/Users/timlife/linkedin-leadmagnet-backend` |
| **Stack** | Express 4, TypeScript 5.6, ESM modules |
| **Database** | Supabase (shared) |
| **AI** | Claude (primary), Gemini (fallback) |
| **Jobs** | Trigger.dev v3 (9 tasks) |
| **Deploy** | Railway (auto-deploy via Nixpacks) |
| **Size** | 21 services, 16 endpoints, 154 test files |

**What it does:**
The core Blueprint generation pipeline:
1. **Intake** — accept LinkedIn URL, validate, create prospect record
2. **Scrape profile** — Apify for LinkedIn data
3. **Scrape posts** — extract recent posts, clean to text
4. **Enrich** — 5-step AI loop (company research via Tavily → knowledge base → authority scores → strategic analysis → profile rewrite)
5. **Generate posts** — personalized posts from 7 templates
6. **Notify** — email report via Resend

Also handles cold email enrichment (6-provider waterfall: LeadMagic → Prospeo → BlitzAPI → ZeroBounce → Enrow → FindyMail).

**Strengths:**
- Battle-tested pipeline — the enrichment steps have been refined over months
- Excellent test coverage (154 test files)
- Clean separation: routes → services → tasks
- Email enrichment waterfall is robust (tries 6 providers sequentially)
- Prompt versioning system for AI prompts
- Dead-letter queue for failed events

**Weaknesses:**
- Express while everything else is Next.js — the only non-Next.js backend
- Trigger.dev v3 while others are on v4 (upgrade needed)
- Some Supabase client initialization is lazy to avoid build errors — a sign of fragile startup
- The pipeline is brittle to LinkedIn changes — Apify scrapers break periodically
- No admin UI of its own — depends entirely on leadmagnet-admin

**Known landmines:**
- Feb 2026 incident: Trigger.dev deploy was accidentally added to Railway buildCommand. Without TRIGGER_ACCESS_TOKEN (PAT), builds fail silently and NO container is produced. Never add trigger deploy to buildCommand.
- If a Trigger.dev deploy has a build error, queued runs get stuck at QUEUED with `version: N/A`. Must cancel via SDK and re-trigger.
- Prospect enrichment step 3 (authority scores) is the most likely to fail — Claude sometimes returns malformed JSON
- The `prospects` table has 60+ columns — it grew organically and has no clear schema documentation

**Key files:**
- `src/routes/intake.ts` — main pipeline entry point
- `src/services/enrichment/` — 5-step AI enrichment
- `src/services/enrichment/waterfall.ts` — email provider waterfall
- `src/trigger/` — 9 background tasks

---

### 5. leadmagnet-admin — The Blueprint Admin Dashboard

| | |
|---|---|
| **Path** | `/Users/timlife/linkedin-leadmagnet-admin` |
| **Stack** | Next.js 16, React 19, Tailwind 4 |
| **Auth** | Simple password cookie (7-day expiry) |
| **Deploy** | Vercel (manual) |
| **Size** | 13 pages, 15 components, 3 test files |

**What it does:**
Admin UI for managing the Blueprint pipeline. Submit LinkedIn URLs, view prospect status, edit AI prompts, retry failed enrichments, regenerate posts.

**Strengths:**
- Small and focused — does one thing well
- Clean UI for pipeline monitoring

**Weaknesses:**
- Password auth is the weakest auth in the ecosystem — single shared password
- Overlapping admin functionality with copy-of-gtm-os admin section
- Only 3 test files
- Proxies calls through its own API to leadmagnet-backend — adds an unnecessary hop

**This repo is the easiest consolidation target.** Its 13 pages can be absorbed into the unified admin dashboard with minimal effort.

---

### 6. dwy-playbook — The Operational Playbook

| | |
|---|---|
| **Path** | `/Users/timlife/Documents/claude code/dwy-playbook` |
| **Stack** | Docusaurus 3.9.2, React 19 |
| **Deploy** | Vercel |
| **Size** | 83 markdown pages |

**What it does:**
Living documentation site with weekly bootcamp curriculum, SOPs for 7 modules (positioning, lead magnets, TAM, LinkedIn outreach, cold email, LinkedIn ads, operating system), and DFY fulfillment procedures.

One interactive feature: `/submit-learning` form that calls gtm-system API, which uses Claude to auto-format the learning and commit it to GitHub.

**Strengths:**
- Clean Docusaurus setup
- AI-powered learning capture is genuinely useful
- SOPs are comprehensive and well-organized

**Weaknesses:**
- Isolated from the product — SOPs could enrich the AI brain if integrated
- Static content that could be dynamic (personalized to student progress)

**Lowest priority for consolidation** but highest leverage if integrated into the product (playbook content feeding the AI brain, SOPs delivered contextually during DFY work).

---

## How They Connect

```
                    ┌──────────────────┐
                    │   SUPABASE       │
                    │   (shared DB)    │
                    │   qvawbxpijx...  │
                    └──┬───┬───┬───┬──┘
                       │   │   │   │
          ┌────────────┘   │   │   └────────────────┐
          │                │   │                     │
   ┌──────▼──────┐  ┌─────▼───▼──────┐   ┌─────────▼─────────┐
   │  magnetlab   │  │   gtm-system   │   │ leadmagnet-backend │
   │  (Vercel)    │  │   (Railway)    │   │ (Railway)          │
   │              │  │                │   │                    │
   │  SaaS UI     │──▶  webhooks     │──▶│  scrape/enrich/    │
   │  funnels     │  │  orchestrate   │   │  generate pipeline │
   │  content     │  │  cold email    │   │                    │
   │  AI brain    │  │  DFY delivery  │   └────────────────────┘
   └──────────────┘  │  proposals     │
                     │  provisioning  │
                     └───────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───────┐ ┌───▼──────┐ ┌────▼─────────┐
     │ copy-of-gtm-os │ │ lm-admin │ │ dwy-playbook │
     │ (Vercel)       │ │ (Vercel) │ │ (Vercel)     │
     │                │ │          │ │              │
     │ Blueprint pgs  │ │ Pipeline │ │ SOPs &       │
     │ Bootcamp LMS   │ │ admin UI │ │ curriculum   │
     │ GC portal      │ │          │ │              │
     │ Admin dash     │ │          │ │              │
     └────────────────┘ └──────────┘ └──────────────┘
```

**Data flow:**
- Forms/webhooks → gtm-system (ingests, classifies, routes)
- gtm-system → leadmagnet-backend (triggers scrape/enrich/generate for Blueprint)
- leadmagnet-backend → Supabase (writes prospects, posts)
- copy-of-gtm-os → Supabase (reads prospects for Blueprint pages)
- magnetlab → Supabase (reads/writes SaaS data, fires webhooks to gtm-system)
- leadmagnet-admin → leadmagnet-backend (admin API calls for pipeline management)
- dwy-playbook → gtm-system (learning submission only)

---

## Shared Database: The Double-Edged Sword

All 6 repos share Supabase project `qvawbxpijxlwdkolmjrs`. This is both the biggest strength (no data sync needed) and the biggest risk (no ownership boundaries).

**Table ownership is implicit, not enforced:**
- magnetlab writes `lead_magnets`, `funnel_pages`, `cp_*` tables
- gtm-system writes `leads`, `events`, `dfy_*`, `cold_email_*`, `dm_contacts`
- leadmagnet-backend writes `prospects`, `posts`, `enrichment_*`
- copy-of-gtm-os reads from all of the above
- Nothing stops any repo from writing to any table

**Migration gotcha (Feb 2026):** Migrations exist across multiple repos. magnetlab has 78 migrations, gtm-system has 91. They all target the same database. There is no single source of truth for the full schema. If two repos create conflicting migrations, it only surfaces at deploy time.

**The `select('*')` incident (Feb 2026):** PostgREST returns 400 if ANY column in an explicit `select()` doesn't exist. TypeScript interfaces had drifted from actual DB schema across repos. Multiple queries silently broke on Vercel while working locally (different Supabase client versions).

---

## Cross-Origin Architecture: The Hardest Part

Three production domains talk to each other:
- `magnetlab.app` (Vercel) → needs to call `gtmconductor.com` (Railway)
- `modernagencysales.com` (Vercel) → needs to call `gtmconductor.com` (Railway)
- `copy-of-gtm-os.vercel.app` (Vercel preview) → needs to call `gtmconductor.com`

**Two things must be updated for every cross-origin call:**

1. **CORS on gtm-system** (`src/middleware.ts`) — `CORS_ALLOWED_ORIGINS` array + response headers + OPTIONS preflight
2. **CSP on the calling frontend** (`vercel.json`) — `Content-Security-Policy` → `connect-src` must include the API domain

Missing either one causes silent failures. CORS errors show in console. CSP violations do not — the browser just says "Failed to fetch" with no additional context. This has caused multiple multi-hour debugging sessions.

---

## Auth: The Current Mess

| System | Where | How | Weakness |
|--------|-------|-----|----------|
| NextAuth v5 + Google OAuth | magnetlab | JWT session cookie | Beta software, no email/password option |
| Supabase SSR + CSRF | gtm-system | Session cookie + CSRF token | CSRF skip list is a constant gotcha |
| x-admin-key header | copy-of-gtm-os admin | Static API key in env var | Single key, no user identity, no audit trail |
| x-client-portal-token | copy-of-gtm-os client portal | Token per client | No session management, no expiry |
| Password cookie | leadmagnet-admin | Shared password, 7-day cookie | Weakest auth, single shared password |
| ADMIN_API_KEY header | leadmagnet-backend | Static key | Same key used for all admin operations |

There is no unified user identity. A person who is both a SaaS user and a bootcamp student has two completely separate identities with no link between them.

---

## Trigger.dev: Three Separate Worlds

| Project | Repo | Tasks | Key |
|---------|------|-------|-----|
| `proj_jdjofdqazqwitpinxady` | magnetlab | 29 | `tr_prod_DB3vrdcduJYcXF19rrEB` |
| `proj_yymkdpugnlvvgbslvnno` | gtm-system | 73 | `tr_prod_Fxgn6CdrH6v2NSMVhSJL` |
| `proj_lueymlvtfuvbroyvxzjw` | leadmagnet-backend | 9 | `tr_prod_Ep09hT1RE1QgjuCP9hXm` |

111 total tasks across 3 projects. Each requires a separate deploy command from local CLI (`npx trigger.dev@4.3.3 deploy`). If you forget to deploy one after a change, tasks silently run old code or get stuck at QUEUED.

**The biggest Trigger.dev gotcha:** Never add the deploy command to Railway's buildCommand. It needs `TRIGGER_ACCESS_TOKEN` (a PAT), not `TRIGGER_SECRET_KEY`. Without it, the entire build fails silently — no container produced, all deploys broken.

---

## Deploy Processes

| Repo | Method | Automatic? |
|------|--------|-----------|
| magnetlab | `vercel --prod` | No — manual (private org needs Vercel Pro) |
| gtm-system | git push → Railway auto-deploy | Yes |
| copy-of-gtm-os | `vercel --prod` | No — manual |
| leadmagnet-backend | git push → Railway auto-deploy | Yes |
| leadmagnet-admin | `vercel --prod` | No — manual |
| dwy-playbook | `vercel --prod` | No — manual |

Plus 3 separate Trigger.dev deploys from local CLI.

**Total deploy steps for a cross-cutting change:** up to 9 commands across 6 repos.

---

## External Service Inventory

| Service | Used By | Purpose |
|---------|---------|---------|
| **Supabase** | all 6 repos | PostgreSQL database + auth + edge functions |
| **Stripe** | magnetlab, gtm-system, copy-of-gtm-os | Billing (3 separate integrations) |
| **Claude (Anthropic)** | magnetlab, gtm-system, leadmagnet-backend | AI content/classification/generation |
| **OpenAI** | magnetlab, gtm-system | Embeddings (magnetlab), various (gtm) |
| **Google Gemini** | gtm-system, leadmagnet-backend | AI fallback, TAM analysis |
| **Trigger.dev** | magnetlab, gtm-system, leadmagnet-backend | Background jobs (3 projects) |
| **Resend** | magnetlab, leadmagnet-backend | Transactional email |
| **PlusVibe** | gtm-system | Cold email campaigns |
| **HeyReach** | gtm-system | LinkedIn outreach campaigns |
| **Attio** | gtm-system | CRM (bidirectional sync) |
| **Apify** | magnetlab, leadmagnet-backend | LinkedIn scraping |
| **Bright Data** | gtm-system, leadmagnet-backend | Web scraping, SERP |
| **Zapmail** | gtm-system | Email infrastructure provisioning |
| **Unipile** | magnetlab | LinkedIn API (replacing LeadShark) |
| **Tavily** | leadmagnet-backend | Company research |
| **Cal.com** | gtm-system | Meeting booking webhooks |
| **Linear** | gtm-system | Project management (DFY) |
| **Loops** | magnetlab | Marketing email automation |
| **Svix** | magnetlab | User-configured webhook routing |
| **Sentry** | leadmagnet-backend | Error monitoring |
| **PostHog** | magnetlab | Product analytics |
| **Discolike** | gtm-system | TAM company qualification |
| **Serper** | gtm-system | Google search API |

23+ external services. API keys scattered across Railway env vars, Vercel env vars, and Trigger.dev env vars. Many are duplicated across repos.

---

## Overall Strengths

1. **Powerful AI integration** — Claude is deeply embedded for content generation, reply classification, proposal writing, knowledge extraction, enrichment. This is genuine AI-native functionality, not a wrapper.
2. **Battle-tested pipelines** — the Blueprint enrichment pipeline and cold email waterfall have processed thousands of leads. The edge cases are handled.
3. **Comprehensive webhook infrastructure** — 27 webhook integrations means the system can react to almost any external event.
4. **Content pipeline is sophisticated** — transcript → knowledge → ideas → posts → scheduling with semantic search. Few competing products have this depth.
5. **Good test coverage where it matters** — leadmagnet-backend (154 tests) and magnetlab (438 tests) are well-tested.
6. **Working in production** — despite the complexity, all systems are live and serving real customers.

## Overall Weaknesses

1. **Architecture is hard to explain** — 6 repos, 5 auth systems, 3 Trigger.dev projects, 489 API routes. New developer onboarding is a significant time investment.
2. **No single source of truth for the database schema** — migrations split across repos, TypeScript interfaces drift from reality, `select('*')` vs explicit selects is inconsistent.
3. **Cross-origin configuration is fragile** — CORS + CSP must be kept in sync manually. Silent failures waste hours.
4. **Auth is fractured** — 5 different auth systems with no unified user identity. A person can be a customer in one system and invisible in another.
5. **Deploy process is manual and error-prone** — up to 9 commands for a cross-cutting change. Forgetting one Trigger.dev deploy causes silent failures.
6. **Framework inconsistency** — Next.js 15, Next.js 16, React/Vite, Express, Docusaurus. Different patterns, different conventions, different mental models.
7. **Deprecated code that hasn't been removed** — gtm-system still has the old content pipeline tables and code despite migration to magnetlab's cp_ tables.
8. **Single shared Supabase with no ownership boundaries** — any repo can read/write any table. Schema changes in one repo can break another.
9. **Env var sprawl** — ~50 env vars across repos with significant duplication. Easy to have stale values in one repo.
10. **Bus factor** — the entire system was built by one person. No documentation exists beyond CLAUDE.md files (which are written for AI, not humans).

---

## What's Actively Being Used vs. Legacy

### Active and Critical
- magnetlab: lead magnet wizard, funnel builder, content pipeline, AI brain
- gtm-system: webhook ingestion, cold email, reply pipeline, DFY delivery, infrastructure provisioning
- leadmagnet-backend: Blueprint scrape/enrich/generate pipeline
- copy-of-gtm-os: Blueprint public pages, bootcamp LMS, admin dashboard

### Active but Low Traffic
- copy-of-gtm-os: GC portal, affiliate program
- dwy-playbook: SOPs (used manually, not integrated into product)
- leadmagnet-admin: pipeline monitoring (mostly replaced by copy-of-gtm-os admin)

### Deprecated / Should Be Removed
- gtm-system content pipeline tables (non-cp_ prefix) — replaced by magnetlab's cp_ tables
- copy-of-gtm-os Airtable integration — legacy data source
- Various unused webhook endpoints in gtm-system from integrations that were tried and abandoned

---

## Where to Start

If you're the new dev, here's the recommended reading order:

1. **This document** — you're here
2. **[Monorepo consolidation design](./2026-02-25-monorepo-consolidation-design.md)** — where we're headed
3. **magnetlab's CLAUDE.md** — the biggest and most important codebase
4. **gtm-system's CLAUDE.md** — the most complex integration surface
5. **Run each app locally** — magnetlab and gtm-system first, others as needed
6. **Follow a lead through the system** — submit a LinkedIn URL through the intake form and trace it through leadmagnet-backend → Supabase → copy-of-gtm-os Blueprint page. This one flow touches 4 repos.

The consolidation design doc has the long-term plan. Your job is to own it, challenge it, and execute it.
