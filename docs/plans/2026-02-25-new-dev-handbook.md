# New Developer Handbook

**Date:** 2026-02-25
**Read after:** [Ecosystem Current State](./2026-02-25-ecosystem-current-state.md) and [Monorepo Consolidation Design](./2026-02-25-monorepo-consolidation-design.md)

This is the practical "how to work here" guide. The other two docs explain what exists and where we're going. This one explains how to get running, how things break, and what you need to know that isn't in the code.

---

## Table of Contents

1. [Local Dev Setup](#1-local-dev-setup)
2. [End-to-End Flow Walkthroughs](#2-end-to-end-flow-walkthroughs)
3. [What Breaks and How to Fix It](#3-what-breaks-and-how-to-fix-it)
4. [Domain Glossary](#4-domain-glossary)
5. [The MCP Package](#5-the-mcp-package)
6. [Decision Log](#6-decision-log)
7. [Day-to-Day Workflows](#7-day-to-day-workflows)

---

## 1. Local Dev Setup

### Prerequisites

- Node.js 20+ (all repos)
- npm (package manager for all repos)
- Supabase CLI (`brew install supabase/tap/supabase`)
- Vercel CLI (`npm i -g vercel`)
- Access to the shared Supabase project (`qvawbxpijxlwdkolmjrs`)

### Port Map

| Repo | Default Port | Framework |
|------|-------------|-----------|
| magnetlab | 3000 | Next.js |
| gtm-system | 3001 (use `-p 3001`) | Next.js |
| copy-of-gtm-os | 5173 | Vite |
| leadmagnet-backend | 3002 (use `PORT=3002`) | Express |
| leadmagnet-admin | 3003 (use `-p 3003`) | Next.js |
| dwy-playbook | 3004 (use `-p 3004`) | Docusaurus |

Four repos default to port 3000. You'll need to specify different ports when running multiple simultaneously.

### Getting Each Repo Running

**magnetlab** (start here — the main product):
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
cp .env.example .env.local    # Then fill in values (see below)
npm install
npm run dev                    # http://localhost:3000
```

**gtm-system** (the backend):
```bash
cd "/Users/timlife/Documents/claude code/gtm-system"
# Create .env.local with values (no .env.example — see env var list below)
npm install
npm run dev -- -p 3001         # http://localhost:3001
```

**copy-of-gtm-os** (the multi-product frontend):
```bash
cd "/Users/timlife/Documents/claude code/copy-of-gtm-os"
cp .env.example .env           # Then fill in values
npm install
npm run dev                    # http://localhost:5173
```

**leadmagnet-backend** (the pipeline):
```bash
cd "/Users/timlife/linkedin-leadmagnet-backend"
cp .env.example .env           # Then fill in values
npm install
PORT=3002 npm run dev          # http://localhost:3002
```

**leadmagnet-admin** (pipeline admin):
```bash
cd "/Users/timlife/linkedin-leadmagnet-admin"
cp .env.example .env.local     # Then fill in values
npm install
npm run dev -- -p 3003         # http://localhost:3003
```

**dwy-playbook** (docs):
```bash
cd "/Users/timlife/Documents/claude code/dwy-playbook"
npm install
npm run start -- -p 3004       # http://localhost:3004
```

### Essential Environment Variables

Every repo needs Supabase credentials. These are the same across all repos:

```env
# Supabase (shared project qvawbxpijxlwdkolmjrs)
NEXT_PUBLIC_SUPABASE_URL=https://qvawbxpijxlwdkolmjrs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ask for this>
SUPABASE_SERVICE_ROLE_KEY=<ask for this>
```

Note: copy-of-gtm-os and leadmagnet-backend use slightly different variable names:
- copy-of-gtm-os: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- leadmagnet-backend: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

Same values, different names. This is one of the things the consolidation will fix.

**Minimum env vars to run each repo locally:**

| Repo | Minimum Required |
|------|-----------------|
| magnetlab | Supabase + `NEXTAUTH_SECRET` + `NEXTAUTH_URL=http://localhost:3000` |
| gtm-system | Supabase + `TRIGGER_SECRET_KEY` |
| copy-of-gtm-os | Supabase (VITE_ prefixed) |
| leadmagnet-backend | Supabase + `ANTHROPIC_API_KEY` + `ADMIN_API_KEY` |
| leadmagnet-admin | Supabase + `ADMIN_PASSWORD` + `RAILWAY_URL` |
| dwy-playbook | Nothing — static site |

AI features (Claude, OpenAI) require their respective API keys. Stripe features require Stripe keys. But you can run the apps and navigate most UI without these.

### Supabase CLI Access

The Supabase access token is stored in the macOS Keychain:
```bash
security find-generic-password -s "Supabase CLI" -w | sed 's/go-keyring-base64://' | base64 -D
```

To query the database schema directly:
```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w | sed 's/go-keyring-base64://' | base64 -D)
curl -s -X POST "https://api.supabase.com/v1/projects/qvawbxpijxlwdkolmjrs/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name FROM information_schema.columns WHERE table_name = '\''leads'\'' ORDER BY ordinal_position"}'
```

### Deploy Commands

**Frontend (Vercel):**
```bash
# All Vercel repos — manual deploy (private org, no auto-deploy)
vercel --prod
```

**Backend (Railway):**
- gtm-system: auto-deploys on git push
- leadmagnet-backend: auto-deploys on git push

**Trigger.dev (separate from app deploys — always manual):**
```bash
# magnetlab
cd "/Users/timlife/Documents/claude code/magnetlab"
TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy

# gtm-system
cd "/Users/timlife/Documents/claude code/gtm-system"
TRIGGER_SECRET_KEY=tr_prod_Fxgn6CdrH6v2NSMVhSJL npx trigger.dev@4.3.3 deploy

# leadmagnet-backend
cd "/Users/timlife/linkedin-leadmagnet-backend"
TRIGGER_SECRET_KEY=tr_prod_Ep09hT1RE1QgjuCP9hXm npx trigger.dev@4.3.3 deploy
```

**CRITICAL:** Never add Trigger.dev deploy to Railway's buildCommand. It needs `TRIGGER_ACCESS_TOKEN` (a PAT), not `TRIGGER_SECRET_KEY`. Without the PAT, the entire build fails silently — no container produced, service goes down.

---

## 2. End-to-End Flow Walkthroughs

### Flow A: Lead Submits Form → Blueprint Generated → Delivered

This is the core revenue flow. It touches 4 repos.

```
1. Prospect fills out form on modernagencysales.com
   └─ copy-of-gtm-os: Blueprint opt-in form component
   └─ Submits LinkedIn URL + email to leadmagnet-backend

2. leadmagnet-backend: POST /api/intake
   └─ Validates LinkedIn URL
   └─ Creates prospect record in Supabase (status: pending_scrape)
   └─ Triggers scrapeProspectTask via Trigger.dev

3. leadmagnet-backend: scrapeProspectTask (Trigger.dev)
   └─ Calls Apify to scrape LinkedIn profile
   └─ Calls Apify to scrape recent posts
   └─ Updates prospect with scraped data
   └─ Triggers enrichProspectTask

4. leadmagnet-backend: enrichProspectTask (Trigger.dev)
   └─ Step 1: Company research (Tavily)
   └─ Step 2: Knowledge base lookup
   └─ Step 3: Authority scores (Claude AI)
   └─ Step 4: Strategic analysis (Claude AI)
   └─ Step 5: Profile rewrite (Claude AI)
   └─ Updates prospect with enrichment data
   └─ Triggers generatePostsTask

5. leadmagnet-backend: generatePostsTask (Trigger.dev)
   └─ Loads 7 post templates from Supabase
   └─ Generates personalized posts via Claude AI
   └─ Writes posts to Supabase posts table

6. leadmagnet-backend: sendNotificationTask (Trigger.dev)
   └─ Sends report email to prospect via Resend
   └─ Email contains link to Blueprint page

7. Prospect clicks link → copy-of-gtm-os: /blueprint/:slug
   └─ Reads prospect + posts from Supabase
   └─ Renders analysis page with generated posts
   └─ Shows offer CTA
```

**Where to look when this breaks:**
- Form submission fails → check copy-of-gtm-os service layer + leadmagnet-backend /api/intake route
- Scraping fails → check Apify dashboard + leadmagnet-backend Trigger.dev logs
- Enrichment fails → check Claude API usage + prospect `error_log` column
- Posts not showing → check `posts` table for the prospect ID
- Email not sent → check Resend dashboard + Trigger.dev task logs
- Blueprint page blank → check copy-of-gtm-os Supabase query + CSP headers

### Flow B: SaaS User Creates Lead Magnet → Funnel Published → Lead Captured

This is the SaaS product flow. Entirely within magnetlab.

```
1. User logs in via Google OAuth (NextAuth)
   └─ magnetlab: middleware.ts checks session

2. User starts lead magnet wizard (/create)
   └─ magnetlab: 6-step wizard components
   └─ Each step autosaves to Supabase lead_magnets table

3. User generates content (AI step)
   └─ magnetlab: POST /api/lead-magnet/generate
   └─ Claude AI generates lead magnet content
   └─ Content stored in lead_magnets.content JSONB

4. User builds funnel page (/magnets/:id/funnel)
   └─ magnetlab: drag-drop funnel builder
   └─ Sections stored in funnel_page_sections table
   └─ Themes applied from brand_kits table

5. User publishes funnel
   └─ magnetlab: POST /api/funnel/publish
   └─ Generates public URL (or custom domain)
   └─ Page served via /p/[username]/[slug] route

6. Visitor lands on funnel page, submits opt-in form
   └─ magnetlab: POST /api/public/lead
   └─ Creates funnel_leads record
   └─ Fires webhook to gtm-system (if configured)
   └─ Triggers email sequence (if configured)
```

### Flow C: Cold Email Reply → AI Classification → Blueprint Delivery

This is the outbound sales automation. Spans gtm-system and leadmagnet-backend.

```
1. PlusVibe receives a reply to a cold email
   └─ PlusVibe webhook → gtm-system: POST /api/webhooks/plusvibe

2. gtm-system: webhook handler
   └─ Validates payload (flat structure, not nested)
   └─ Checks keyword match against expanded keyword list
   └─ If keyword match → triggers AI classifier

3. gtm-system: reply-classifier.ts (Claude AI)
   └─ Classifies reply as: positive, negative, objection, unclear
   └─ Defaults to "unclear" on failure (safety measure)
   └─ If positive → creates reply_pipeline record

4. gtm-system: process-reply-pipeline (Trigger.dev)
   └─ Calls leadmagnet-backend /api/intake to generate Blueprint
   └─ Polls for ~20 minutes waiting for generation
   └─ Once ready, delivers via:
     a. PlusVibe reply-in-thread (email)
     b. HeyReach DM (LinkedIn, if source is heyreach)

5. Delivery tracked in blueprint_deliveries table
```

**Where to look when this breaks:**
- No webhook received → check PlusVibe campaign settings
- Classification wrong → check reply-classifier.ts prompts
- Pipeline stuck → check Trigger.dev dashboard for stuck runs (QUEUED, version: N/A)
- Delivery fails → check PlusVibe unibox API (must use /api/v1/ prefix) or HeyReach AddLeadsToCampaign endpoint

### Flow D: Transcript → Knowledge → Post Generated

This is the content pipeline. Mostly within magnetlab.

```
1. Meeting recorded on Grain/Fireflies/Fathom
   └─ Webhook fires to magnetlab: POST /api/webhooks/grain/ (or /fireflies/, /fathom/)
   └─ Auth via ?secret= URL parameter

2. magnetlab: process-transcript (Trigger.dev)
   └─ Cleans and chunks transcript
   └─ Extracts knowledge entries via Claude AI
   └─ Generates embeddings via OpenAI (text-embedding-3-small)
   └─ Stores in cp_knowledge_entries with pgvector

3. User views Knowledge Brain (/knowledge)
   └─ Semantic search via pgvector similarity
   └─ Auto-discovered topics, quality scores, gap analysis

4. Nightly autopilot: nightly-autopilot-batch (Trigger.dev, 2 AM UTC)
   └─ Scores content ideas
   └─ Selects best ideas matching posting slots
   └─ Triggers run-autopilot for each selected idea

5. run-autopilot (Trigger.dev)
   └─ Builds content brief from knowledge base (searchKnowledge + buildContentBrief)
   └─ Generates post via Claude AI
   └─ Polishes and formats
   └─ Queues for scheduled publishing
```

---

## 3. What Breaks and How to Fix It

### Trigger.dev Tasks Stuck at QUEUED (version: N/A)

**Symptoms:** Tasks fire but never execute. Dashboard shows QUEUED status with `version: N/A`.

**Cause:** A Trigger.dev deploy had a build error, causing tasks to be silently excluded from the bundle. The platform accepts the deploy but has no worker for the missing tasks.

**Fix:**
1. Check Trigger.dev deploy logs — look for "detected tasks" count. If it's lower than expected, you have a partial deploy.
2. Fix the build error (usually a TypeScript issue in a task file).
3. Redeploy: `TRIGGER_SECRET_KEY=<key> npx trigger.dev@4.3.3 deploy`
4. Verify all tasks appear in the dashboard.
5. Cancel stuck runs via SDK:
```typescript
import { runs } from "@trigger.dev/sdk/v3";
await runs.cancel(runId);
```
6. Re-trigger the original action (re-submit webhook, re-queue leads, etc.)

**Prevention:** Always check the "detected tasks" count in deploy output before considering a deploy successful.

### Silent "Failed to Fetch" in Browser (CORS/CSP)

**Symptoms:** API call works with curl but fails in browser. No CORS error in console. Just "Failed to fetch."

**Cause:** CSP `connect-src` directive in `vercel.json` doesn't include the target API domain. This is NOT a CORS error — it's the browser enforcing Content Security Policy before the request even leaves.

**Fix:**
1. Check copy-of-gtm-os `vercel.json` → Content-Security-Policy → `connect-src`. Is the target domain listed?
2. Add the domain. Redeploy.

**Also check:** If you DO see CORS errors (different from "Failed to fetch"), the issue is on the API server side — check gtm-system `src/middleware.ts` CORS_ALLOWED_ORIGINS.

**The full checklist for any new cross-origin call:**
1. CORS on API server: gtm-system `src/middleware.ts` → add domain to `CORS_ALLOWED_ORIGINS` + add CORS headers + handle OPTIONS preflight
2. CSP on calling frontend: copy-of-gtm-os `vercel.json` → add domain to `connect-src`
3. Both must be deployed. Both must be in sync.

### CSRF "Invalid CSRF token" on New API Routes

**Symptoms:** New POST/PUT/PATCH/DELETE route in gtm-system returns 403 with "Invalid CSRF token".

**Cause:** gtm-system's CSRF middleware validates all mutation requests by default. Server-to-server routes (webhooks, Trigger.dev, external services) don't have CSRF tokens.

**Fix:** Add the route to the skip list in `src/middleware.ts` → `validateCsrf()`:
```typescript
if (request.nextUrl.pathname.startsWith('/api/your-new-route')) return true;
```

**Prevention:** Any route that uses its own auth (API key, service key, webhook signature) should be in the CSRF skip list. Only browser-initiated routes with session cookies need CSRF protection.

### Supabase Query Returns Empty / 400 Error

**Symptoms:** A `.select()` call returns no data or a 400 error, but the data exists in the database.

**Cause:** PostgREST returns 400 if ANY column in an explicit `select()` list doesn't exist. If a TypeScript interface says a column exists but the database doesn't have it, the entire query fails.

**Fix:**
1. Check the actual database columns:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'your_table' ORDER BY ordinal_position;
```
2. Remove any columns from the `select()` that don't exist in the database.
3. Never trust TypeScript interfaces for column names — always verify against the actual schema.

**Prevention:** The `packages/db` shared package (in the consolidation plan) will be the single source of truth for table schemas, eliminating this class of bug.

### Apify Scraper Returns No Data

**Symptoms:** LinkedIn profile scraping fails or returns partial data.

**Cause:** LinkedIn changes their page structure periodically, breaking Apify scrapers.

**Fix:**
1. Check Apify dashboard for the scraper run — look for errors.
2. Check if the LinkedIn URL is valid and the profile is public.
3. If the scraper itself is broken, check Apify marketplace for an updated version.
4. The prospect's `error_log` column usually contains the specific failure.

### PlusVibe Reply Delivery Fails

**Symptoms:** Blueprint is generated but never delivered via email reply.

**Likely causes (in order):**
1. Unibox endpoint missing `/api/v1/` prefix — returns 200 with empty data instead of 404
2. Reply-in-thread requires the original email thread ID — check `reply_pipeline` record for thread context
3. PlusVibe campaign sends from a different email address than the reply — delivery must be reply-in-thread, not campaign enrollment

### HeyReach Delivery Fails

**Symptoms:** Blueprint not delivered via LinkedIn DM.

**Fix:** The correct endpoint is `AddLeadsToCampaign`, NOT `AddLeadsToListV2` (which returns 404). Check that:
1. HEYREACH_DELIVERY_CAMPAIGN_ID is set correctly (currently: 319745)
2. The lead has a LinkedIn profile URL
3. Source is 'heyreach' (PlusVibe leads are email-only, never DM)

### Railway Deploy Produces No Container

**Symptoms:** Git push succeeds but no new deployment appears. Service may go down.

**Cause:** Build failed silently. Most common cause: Trigger.dev deploy was accidentally added to buildCommand.

**Fix:**
1. Check Railway build logs.
2. Ensure buildCommand is `npm install && npm run build` — nothing else.
3. Deploy Trigger.dev separately from local CLI.

---

## 4. Domain Glossary

Terms you'll encounter in the code and conversations that may not be obvious:

| Term | Meaning |
|------|---------|
| **Blueprint** | A personalized LinkedIn authority analysis generated for a prospect. Includes scraped profile data, AI-generated authority scores, strategic analysis, and sample posts. The core deliverable of the outbound pipeline. |
| **TAM** | Total Addressable Market. A pipeline that finds and qualifies potential customers at scale using Discolike + Bright Data + Gemini. |
| **ICP** | Ideal Customer Profile. The description of who a perfect customer is. Used to score leads and target outreach. |
| **Enrichment** | The process of taking a lead with minimal info (name + LinkedIn URL) and adding data: company info, email, authority scores, strategic analysis. Multiple steps, multiple providers. |
| **Waterfall** | An enrichment pattern where you try Provider A first, and if they don't have the data, try Provider B, then C, etc. Used for email finding (6 providers). |
| **Cold email** | Unsolicited outreach email to prospects who haven't opted in. Managed via PlusVibe. Subject to deliverability, warmup, and compliance requirements. |
| **Warmup** | The process of gradually increasing email sending volume on a new domain/mailbox so email providers don't mark it as spam. Takes 2-4 weeks. |
| **DFY** | Done-For-You. A managed service where we do the work for the client (as opposed to SaaS self-serve). Includes onboarding, intake, deliverable creation, and review cycles. |
| **GC** | Growth Collective. A membership community/portal for agency owners. |
| **Lead magnet** | A free resource offered in exchange for contact info. In our system: an AI-generated content piece (PDF, interactive page, etc.) delivered via a funnel. |
| **Funnel** | A landing page designed to capture leads. Has an opt-in form, content sections, and a thank-you/delivery page. |
| **Autopilot** | The automated content pipeline: system selects the best content ideas, generates posts using AI + knowledge base, and queues them for publishing. Runs nightly at 2 AM UTC. |
| **AI Brain** | The knowledge base with pgvector embeddings. Stores extracted insights from call transcripts, supports semantic search, auto-discovers topics. |
| **Reply pipeline** | The automated flow when a cold email prospect replies positively: AI classifies the reply → generates a Blueprint → delivers via email reply-in-thread and/or LinkedIn DM. |
| **Tenant** | An organization in the multi-tenant gtm-system. Currently only one real tenant exists (ID: `7a3474f9-dd56-4ce0-a8b2-0372452ba90e`), but the architecture supports multiple. |
| **Prospect** | A person going through the Blueprint pipeline. Has a LinkedIn URL, scraped data, enrichment data, and generated posts. Lives in the `prospects` table. |
| **Lead** | A person who opted in via a funnel or was ingested via webhook. Lives in the `leads` table. Different from prospect — leads come through magnetlab funnels, prospects come through the Blueprint pipeline. |
| **Posting slot** | A scheduled time when the autopilot can publish a post. Configured per user (e.g., Mon/Wed/Fri at 9 AM). |
| **Swipe file** | A collection of example posts/content for inspiration. Community-shared. |
| **Recipe** | A configurable multi-step enrichment flow. Each step has a type (scrape, AI, API call) and config. Currently: `b2b-agency` (3 steps) and `filmmaker` (4 steps, uses Gemini). |
| **DM Intelligence** | A feature in gtm-system that scores LinkedIn DM contacts, syncs with Attio CRM, and tracks engagement. |
| **Intro offer** | A $2,500 one-time DFY engagement. Entry point to managed services. Has its own checkout, onboarding, and delivery flow. |
| **DMARC** | Domain-based Message Authentication. DNS records that verify email sender identity. Set up via Zapmail during infrastructure provisioning. |
| **Provisioning** | The process of setting up email infrastructure for a client: buy domains → configure DNS → create mailboxes → set up DMARC → connect to sending platforms. |

---

## 5. The MCP Package

`@magnetlab/mcp` is an npm package that lets Claude Code (and Claude Desktop) control magnetlab's features through 99 tools. It's a real production package, published on npm.

**What it does:** Translates Claude's tool calls into HTTP requests to magnetlab's API. When you're in Claude Code and say "create a lead magnet called Sales Playbook," Claude uses this MCP server to call the magnetlab API.

**Architecture:**
```
Claude Code ←stdio→ MCP Server ←HTTP→ magnetlab.app/api
```

**12 tool categories (99 tools total):**

| Category | Tools | Examples |
|----------|-------|---------|
| Lead Magnets | 7 | Create, list, ideate, analyze competitors |
| Ideation | 6 | Generate ideas, extract content, write posts |
| Funnels | 9 | Build pages, customize, publish |
| Leads | 2 | List, export CSV |
| Analytics | 1 | Funnel performance metrics |
| Brand Kit | 3 | Pain points, tools, tone |
| Email Sequences | 4 | Generate, edit, activate drip campaigns |
| Email System | 9 | Flows, broadcasts, subscribers |
| Content Pipeline | 34 | Knowledge brain, autopilot, styles, templates |
| Swipe File | 3 | Browse, save inspiration |
| Libraries | 7 | Organize into collections |
| Qualification Forms | 5 | Survey questions for lead scoring |

**Key files:**
- `packages/mcp/src/client.ts` — 150+ API methods
- `packages/mcp/src/tools/` — tool definitions by category
- `packages/mcp/src/handlers/` — request routing
- `.claude/.mcp.json` — local config (points to local build for instant iteration)

**After any changes:**
```bash
cd packages/mcp
npm run test          # 271 tests
npm run build
# Bump version in package.json
npm publish --access public
```

Currently version 0.4.5. The local Claude Code setup uses the LOCAL build (`packages/mcp/dist/index.js serve`) instead of the npm package, so changes are instant after `npm run build`.

---

## 6. Decision Log

Why things are the way they are. Some decisions were intentional. Some were accidents of timing. Knowing which is which prevents you from "fixing" something that was deliberate or preserving something that was just expedient.

### Why Express for leadmagnet-backend?

**Accident of timing.** It was the first thing built, before the rest of the ecosystem existed. The Blueprint pipeline was a standalone Express API. Later, gtm-system was built with Next.js, but by then the pipeline was battle-tested and rewriting it wasn't worth the risk. The consolidation plan addresses this (Phase 4: gradual migration).

### Why Vite/React for copy-of-gtm-os?

**Accident of timing.** It started as a simple React SPA for Blueprint public pages. Features kept getting added (bootcamp, GC portal, admin) without migrating to Next.js. The consolidation plan addresses this (Phase 2: rewrite into Next.js).

### Why 3 Trigger.dev projects?

**Partly intentional, partly accident.** magnetlab and leadmagnet-backend originally shared one Trigger.dev project, which caused task name conflicts. They were separated in Feb 2026. gtm-system always had its own project because it was on a different repo. The consolidation plan merges all three.

### Why Next.js 15 for magnetlab and 16 for gtm-system?

**Timing.** magnetlab was built earlier. gtm-system was built or upgraded later when Next.js 16 was available. Both work fine. The consolidation should standardize on one version.

### Why shared Supabase with no ownership boundaries?

**Expedience.** One database was simpler than managing multiple. It worked when there was one developer. It doesn't scale to a team. The consolidation plan introduces formal ownership boundaries.

### Why so many auth systems?

**Organic growth.** Each product had different requirements at the time it was built. magnetlab needed Google OAuth for SaaS users. gtm-system needed server-side sessions for the admin dashboard. copy-of-gtm-os needed lightweight auth for clients who don't have accounts. leadmagnet-admin just needed a password gate. None of these decisions were wrong individually — but collectively they created a mess. The consolidation plan unifies all auth under NextAuth with roles.

### Why manual Vercel deploys?

**Cost constraint.** Auto-deploy requires Vercel Pro for private org repos. After moving repos from the personal `kimprobably` account to the `modernagencysales` org, auto-deploy stopped working. Manual `vercel --prod` is the workaround.

### Why does gtm-system have CSRF protection?

**Intentional.** gtm-system has a browser-facing admin dashboard with Supabase SSR sessions. CSRF protection prevents cross-site request forgery on those authenticated endpoints. The problem is that it also covers server-to-server routes by default, requiring an ever-growing skip list. The consolidation fixes this by separating the admin UI (into web/) from the API (engine/), so engine/ can use API key auth only and skip CSRF entirely.

### Why is the content pipeline in magnetlab, not gtm-system?

**Intentional migration (Feb 2026).** Content pipeline was originally in gtm-system. It was moved to magnetlab because content creation is a SaaS user feature, not an operational/orchestration concern. The `cp_` table prefix was introduced during this migration to avoid naming collisions with the old gtm-system tables (which are deprecated but not yet removed).

### Why pgvector for the knowledge base?

**Intentional.** Semantic search over extracted knowledge requires vector similarity. pgvector runs inside Supabase (no separate vector database needed). OpenAI text-embedding-3-small generates 1536-dimensional embeddings. The alternative was Pinecone or Weaviate, but keeping it in Supabase reduces infrastructure complexity.

---

## 7. Day-to-Day Workflows

### Making a Change

1. **Identify which repo(s) the change touches.** Use the "Where Features Go" table in the root CLAUDE.md.
2. **Read the repo-specific CLAUDE.md** before writing code.
3. **Make the change, write tests.**
4. **For magnetlab:** `npm run test` (Jest), `npm run build` to verify.
5. **For gtm-system:** `npm test` (Vitest), `npm run build` to verify.
6. **Deploy:**
   - Vercel repos: `vercel --prod`
   - Railway repos: `git push` (auto-deploys)
   - If you changed Trigger.dev tasks: deploy those separately (see commands above)

### Making a Cross-Repo Change

This is the painful part of the current architecture. Example: adding a new webhook from magnetlab to gtm-system.

1. **gtm-system:** Create the webhook route in `/api/webhooks/your-endpoint`
2. **gtm-system:** Add to CSRF skip list in `src/middleware.ts`
3. **gtm-system:** Add CORS headers if called from browser (not needed for server-to-server)
4. **gtm-system:** `git push` (auto-deploys to Railway)
5. **gtm-system:** Deploy Trigger.dev if you added tasks
6. **magnetlab:** Add the webhook call in the relevant service
7. **magnetlab:** Add `GTM_SYSTEM_WEBHOOK_URL` to env if not already there
8. **magnetlab:** `vercel --prod`
9. **Test the full flow end-to-end**

### Monitoring Production

- **Trigger.dev dashboard** — check for stuck/failed tasks
- **Railway logs** — gtm-system and leadmagnet-backend runtime logs
- **Vercel logs** — magnetlab and copy-of-gtm-os function logs
- **Supabase dashboard** — database queries, auth logs, edge function logs
- **Resend dashboard** — email delivery status
- **PlusVibe dashboard** — cold email campaign metrics
- **HeyReach dashboard** — LinkedIn outreach metrics

### When Something is Broken in Production

1. **Check Trigger.dev first** — most production issues are stuck/failed background tasks
2. **Check the relevant table** — look at `status`, `error_log`, `processing_step` columns
3. **Check Railway/Vercel logs** — filter by the relevant API route
4. **Check if it's a cross-origin issue** — if browser but not curl, check CSP
5. **Check if a deploy happened recently** — partial Trigger.dev deploys are the #1 cause of mysterious production issues

### Testing Conventions

| Repo | Framework | Run Tests | Watch Mode |
|------|-----------|-----------|------------|
| magnetlab | Jest + RTL | `npm run test` | `npm run test -- --watch` |
| gtm-system | Vitest | `npm test` | `npm test` (watch by default) |
| copy-of-gtm-os | Vitest + Playwright | `npm run test` | `npm run test:unit` |
| leadmagnet-backend | Vitest + Supertest | `npm test` | `npm run test:watch` |
| leadmagnet-admin | Jest | `npm test` | `npm run test:watch` |

Every new feature must include tests before it's considered complete. At minimum: schema validation tests, API route tests, and utility function tests.

### Code Review Checklist

After completing any feature:
1. Run tests
2. Check for hardcoded tenant IDs (should use context/config)
3. Check for hardcoded API keys (should use env vars)
4. Check for `select('*')` (should use explicit column lists)
5. If touching API routes in gtm-system: is it in the CSRF skip list?
6. If adding cross-origin calls: are CORS and CSP both updated?
7. If adding Trigger.dev tasks: will the deploy include them?
