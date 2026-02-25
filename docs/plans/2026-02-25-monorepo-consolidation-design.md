# Monorepo Consolidation Design

**Date:** 2026-02-25
**Status:** Approved (design phase)
**Goal:** Consolidate 6 repos into 1 Turborepo monorepo with 3 deployable apps

---

## Problem

6 repos, 5 auth systems, 3 Trigger.dev projects, 489 API routes, 111 background tasks, 1 shared database with no ownership boundaries. Architecture is difficult to explain to a new developer and creates constant cross-origin, auth, and coordination overhead.

## Decision

Turborepo monorepo with gradual migration. No big bang — every phase ends with a working system.

---

## Target Architecture

```
modern-agency/
├── apps/
│   ├── web/                      ← Next.js (Vercel) — all UI
│   │   ├── app/(saas)/          ← magnetlab SaaS features
│   │   ├── app/(portal)/        ← client portal, bootcamp, GC
│   │   ├── app/(public)/        ← blueprint pages, marketing
│   │   ├── app/(admin)/         ← unified admin dashboard
│   │   └── api/                 ← BFF layer (auth + proxy to engine)
│   │
│   ├── engine/                   ← Next.js (Railway) — all backend
│   │   ├── app/api/             ← webhooks, leads, campaigns, DFY, etc.
│   │   ├── trigger/             ← ALL Trigger.dev tasks (1 project)
│   │   └── lib/integrations/    ← 32+ API clients
│   │
│   ├── pipeline/                 ← Express (Railway) — TEMPORARY
│   │   └── leadmagnet-backend as-is, frozen, migrating to engine/
│   │
│   └── docs/                     ← Docusaurus (Vercel) — playbook
│
├── packages/
│   ├── db/                       ← Supabase client, typed schema, migrations
│   ├── types/                    ← shared TypeScript interfaces
│   └── utils/                    ← shared validation, formatting, constants
│
├── turbo.json
└── CLAUDE.md                     ← single architecture doc
```

### The Elevator Pitch

> We have one repo with three deployable apps.
>
> **web/** is the product — everything users see. Next.js on Vercel.
> **engine/** is the brain — webhooks, jobs, integrations. Next.js on Railway.
> **docs/** is the operational playbook. Docusaurus on Vercel.
> **packages/** is shared code so types never drift.
>
> One Supabase database. Web/ owns user-facing tables. Engine/ owns operational tables. If you need to write to a table another app owns, you call its API.

---

## Auth Model

### Current State (5 systems)

| Repo | Auth | Identity |
|------|------|----------|
| magnetlab | NextAuth v5 + Google OAuth | user_id |
| gtm-system | Supabase SSR + CSRF | tenant_id |
| copy-of-gtm-os | x-admin-key, portal tokens, cookies | mixed |
| leadmagnet-admin | password cookie | none |
| leadmagnet-backend | ADMIN_API_KEY header | none |

### Target State (1 system, 3 patterns)

**NextAuth v5** in web/ handles all user authentication.

| Pattern | Used By | How |
|---------|---------|-----|
| Direct Supabase reads | web/ frontend | RLS with user_id from JWT |
| BFF → Engine | web/ mutations | Service token + user context |
| API keys | engine/ ↔ external | Webhook/service auth, no user session |

### Unified User Model

```sql
-- users: who they are
users (id, email, name, auth_provider, created_at)

-- organizations: workspace isolation
organizations (id, name, slug, plan, stripe_customer_id)
-- plan: free | pro | unlimited | managed | course

-- org_members: roles (array — users can have multiple)
org_members (user_id, org_id, roles[], permissions jsonb, created_at)
-- roles: owner | admin | member | client | student
```

- SaaS user signs up → personal org (plan: free/pro/unlimited)
- DFY client onboarded → invited with roles: ['client']
- Bootcamp student enrolled → invited with roles: ['student']
- A person can hold multiple roles: ['client', 'student']
- Route groups check roles: (saas) requires member+, (portal) requires client|student, (admin) requires admin

---

## Data Ownership

### Core Rule

> If web/ needs to change data that engine/ owns, it calls an engine/ API endpoint.
> If engine/ needs data that web/ owns, it reads from Supabase directly or receives it in the API payload.

### Web-Owned Tables (web/ writes, engine/ reads)

users, organizations, org_members, subscriptions, lead_magnets, funnel_pages, funnel_sections, brand_kits, email_sequences, posting_slots, user_integrations, qualification_questions, cp_call_transcripts, cp_knowledge_*, cp_content_ideas, cp_pipeline_posts, cp_posting_slots, cp_writing_styles

### Engine-Owned Tables (engine/ writes, web/ reads)

leads, events, reply_pipeline, blueprint_deliveries, cold_lead_pool, enrichment_runs, enrichment_lead_status, cold_email_campaigns, dm_contacts, dfy_engagements, dfy_deliverables, proposals, infra_provisions, infra_domains, webhook_events, tam_*, enrichment_recipes, prospects (legacy), posts (legacy)

### Shared (coordinated via API)

organizations/org_members (web writes, engine reads for tenant context), system_health/metrics (engine writes, web reads)

---

## Migration Roadmap

### Phase 0: Foundation (Week 1-2)

Set up monorepo skeleton. Copy each repo in as-is. Configure deploy targets (Vercel for web/ + docs/, Railway for engine/ + pipeline/). Old repos remain live — monorepo deploys to staging first.

**Done when:** all 4 apps run locally and deploy to staging.

### Phase 1: Absorb Small Repos (Week 3-5)

- Move leadmagnet-admin's 13 pages into web/(admin)/prospects/
- Move dwy-playbook into apps/docs/
- Point DNS, archive old repos (read-only)

**Done when:** leadmagnet-admin and dwy-playbook repos archived.

### Phase 2: Absorb copy-of-gtm-os (Week 5-10)

Rewrite React/Vite → Next.js App Router. This is UI-only — all business logic already calls gtm-system APIs.

- Blueprint public pages → web/(public)/blueprint/
- Bootcamp LMS → web/(portal)/bootcamp/ (94 components, biggest piece)
- GC portal → web/(portal)/gc/
- DFY client portal → web/(portal)/client/
- Admin dashboard → merge into web/(admin)/
- Affiliate → web/(admin)/affiliates/

**Auth migration:** Run both auth systems in parallel for 2-4 weeks. Send magic-link migration emails to existing users. Kill old auth after window.

**Done when:** copy-of-gtm-os archived, modernagencysales.com points to monorepo.

### Phase 3: Unify Engine (Week 8-14, overlaps Phase 2)

- Copy gtm-system into apps/engine/
- Migrate to use packages/db/ and packages/types/
- Consolidate 3 Trigger.dev projects into 1
- Migrate magnetlab's 29 Trigger.dev tasks to engine/trigger/content/
- Simplify CORS and CSRF (fewer cross-origin calls needed)

**Trigger.dev organization:**

```
trigger/
├── pipeline/        ← 9 tasks from leadmagnet-backend
├── delivery/        ← reply pipeline, blueprint delivery
├── content/         ← 29 tasks from magnetlab (autopilot, transcripts, posts)
├── cold-email/      ← recipe pipeline, batch enrichment
├── crm/             ← Attio sync, DM intelligence
├── provisioning/    ← infra setup
├── dfy/             ← onboarding, intake processing
└── automation/      ← stale leads, reconciliation, cleanup
```

**Done when:** gtm-system archived, single Trigger.dev project deployed.

### Phase 4: Migrate Pipeline (Week 14-24, gradual)

Move leadmagnet-backend Express routes into engine/ Next.js API routes. One endpoint at a time.

**Order:** health → prospect reads → admin reads → admin writes → intake → webhooks → cold email

**Pattern per endpoint:**
1. Create new route in engine/
2. Deploy, update callers to new URL
3. Monitor 1 week
4. Remove from pipeline/

Trigger.dev tasks migrate alongside their routes.

**Done when:** pipeline/ empty and removed. Three deployables remain.

### Phase 5: Auth Unification (Week 16-20, overlaps Phase 4)

- Implement organizations + org_members tables
- Migrate existing users to new model
- Create invite/magic-link flows
- Replace x-admin-key with role checks
- Replace portal tokens with authenticated sessions
- Implement service-to-service JWT (web/ ↔ engine/)

### Phase 6: Polish (Week 20-26)

- Consolidate env vars (~50 → ~25)
- Unify error handling and test infrastructure
- Remove deprecated gtm-system content pipeline tables
- Write final CLAUDE.md
- New dev onboarding doc

---

## Domain Routing (Final State)

| Domain | Target | Purpose |
|--------|--------|---------|
| magnetlab.app (or new name) | web/ on Vercel | The product |
| gtmconductor.com | engine/ on Railway | Backend API |
| modernagencysales.com | web/ on Vercel | Marketing + public pages |
| Custom funnel domains | web/ on Vercel | User funnels |
| playbook.keen.digital | docs/ on Vercel | Operational playbook |

## Cost Impact

| Before | After |
|--------|-------|
| 6 repos, 4 Vercel projects, 2 Railway services | 1 repo, 2 Vercel projects, 1-2 Railway services |
| 3 Trigger.dev projects | 1 Trigger.dev project |
| ~50 env vars (heavy duplication) | ~25 unique env vars |
| 5 CI/CD pipelines | 1 Turborepo pipeline with selective builds |

---

## Current Repo Inventory (for reference)

| Repo | Stack | Size | Routes | Trigger Tasks | Fate |
|------|-------|------|--------|---------------|------|
| magnetlab | Next.js 15, Vercel | 131k LOC | 218 | 29 | → apps/web/ |
| gtm-system | Next.js 16, Railway | 648 files | 250 | 73 | → apps/engine/ |
| copy-of-gtm-os | React/Vite, Vercel | 8k files | 0 (frontend) | 0 | → rewrite into web/ |
| leadmagnet-backend | Express, Railway | 21 services | 16 | 9 | → apps/pipeline/ (temp) → engine/ |
| leadmagnet-admin | Next.js 16, Vercel | 15 components | 5 | 0 | → web/(admin)/ |
| dwy-playbook | Docusaurus, Vercel | 83 pages | 0 | 0 | → apps/docs/ |
