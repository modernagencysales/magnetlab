# Ankur Onboarding Packet

**Date:** 2026-02-26
**Developer:** Ankur (GitHub: `developeranku`, Email: ankur4736@gmail.com)
**Scope:** MagnetLab — UI Redesign + MCP Package Upgrade

---

## Welcome

You're joining the MagnetLab team to work on two projects:
1. **MagnetLab UI Redesign** — restructuring the app's navigation and creation flows
2. **MagnetLab MCP Package Upgrade** — fixing and enhancing the AI Brain integration in the MCP tools

Both projects are in the **magnetlab** repo. You won't need to touch the other 5 repos in the ecosystem (yet).

---

## The Product (60-Second Version)

**MagnetLab** (magnetlab.app) is a SaaS platform for B2B consultants and agency owners. Users:

1. **Feed their expertise** into the system — by connecting call recording tools (Grain, Fireflies, Fathom) or pasting transcripts. AI extracts knowledge and stores it in a searchable "AI Brain" with vector embeddings.

2. **Create lead magnets** — AI-generated free resources (checklists, frameworks, toolkits, etc.) built from their expertise. Each comes with a landing page + opt-in form + email follow-up sequence.

3. **Distribute content** — the system auto-generates LinkedIn posts from their knowledge base, schedules them via autopilot, and captures leads through published funnels.

The core value loop is: **Brain → Assets → Distribution** — your expertise feeds the AI, AI creates assets, assets generate leads.

**Revenue model:** Free / Pro / Unlimited tiers via Stripe.

**Tech stack:** Next.js 15, React 18, TypeScript 5.6, Tailwind + shadcn/ui, Supabase (PostgreSQL + pgvector), Claude AI (Anthropic SDK), Trigger.dev v4 for background jobs, Vercel hosting.

---

## Your Two Projects

### Project 1: MagnetLab UI Redesign

**Linear project:** [MagnetLab UI Redesign](https://linear.app/modern-agency-sales/project/magnetlab-ui-redesign-d0ec8ec9)

**The problem:** The sidebar has 11+ nav items and the 6-step creation wizard is where users abandon. The navigation is organized around output types (Lead Magnets, Pages, Posts, Email) instead of user intent. Knowledge/Brain — the actual moat — is buried as one item among many.

**The solution:** Reorganize around **Brain → Assets → Distribution**. Collapse 11 items to ~5. Replace the 6-step wizard with branching entry points based on intent (2-3 steps max each).

**Tickets in priority order:**

| # | Ticket | Title | Priority | Points | Status |
|---|--------|-------|----------|--------|--------|
| 1 | MOD-316 | Audit: Map feature overlap and duplication | Urgent | 1 | Backlog |
| 2 | MOD-317 | IA: Propose new navigation and page hierarchy | High | 1 | Backlog |
| 3 | MOD-318 | IA: Redesign creation flows to replace the wizard | High | 1 | Backlog |
| 4 | MOD-319 | Nav: Implement new sidebar navigation | Medium | 3 | Backlog |
| 5 | MOD-320 | Nav: Consolidate overlapping pages | Medium | 3 | Backlog |
| 6 | MOD-321 | Wizard: Build branching creation entry points | Medium | 5 | Backlog |
| 7 | MOD-322 | Wizard: Build lead magnet detail page as config hub | Medium | 5 | Backlog |
| 8 | MOD-323 | Dashboard: Redesign home dashboard | Low | 3 | Backlog |

**Already completed:** MOD-315 (Audit: Map all routes, pages, and navigation) — the full UI audit output is your starting point for MOD-316.

**Dependencies:** MOD-316 → MOD-317/318 → MOD-319/320 → MOD-321/322 → MOD-323. The first three tickets are design/planning docs (no code). Implementation starts at MOD-319.

---

### Project 2: MagnetLab MCP Package Upgrade

**Linear project:** [MagnetLab MCP](https://linear.app/modern-agency-sales/project/magnetlab-mcp-3548c9da)

**What is MCP?** `@magnetlab/mcp` is an npm package that lets Claude Code (and Claude Desktop) control MagnetLab's features via 99 tools. It translates AI tool calls into HTTP requests to magnetlab's API.

**The problem:** Several core MCP tools are broken or incomplete — search returns no results, topics return empty, content generation times out, and the AI Brain isn't wired into lead magnet/email/funnel creation.

**Tickets in priority order:**

| # | Ticket | Title | Priority | Points |
|---|--------|-------|----------|--------|
| 1 | MOD-242 | Fix search_knowledge indexing bug | Urgent | 1 |
| 2 | MOD-243 | Fix list_topics empty results | Urgent | 1 |
| 3 | MOD-244 | Populate quality_score and specificity fields | Urgent | 1 |
| 4 | MOD-245 | Fix email sequence AI generation timeout | Urgent | 1 |
| 5 | MOD-246 | Add filtering parameters to browse_knowledge | High | 2 |
| 6 | MOD-247 | Make funnel creation explicit with full config | High | 2 |
| 7 | MOD-248 | Add lead magnet content generation tool | High | 2 |
| 8 | MOD-249 | Clarify email sequence activation state machine | High | 2 |
| 9 | MOD-250 | Build the knowledge synthesis layer | Medium | 2 |
| 10 | MOD-251 | Wire brain into lead magnet creation | Medium | 2 |
| 11 | MOD-252 | Wire brain into email sequence generation | Medium | 2 |
| 12 | MOD-253 | Wire brain into funnel copy generation | Medium | 2 |
| 13 | MOD-254 | Build positions data model and computation pipeline | Low | 5 |
| 14 | MOD-255 | Build composite create_lead_magnet_from_brain tool | Low | 5 |

**MCP package location:** `packages/mcp/` within the magnetlab repo.

**Key files:**
- `packages/mcp/src/client.ts` — 150+ API methods
- `packages/mcp/src/tools/` — tool definitions by category
- `packages/mcp/src/handlers/` — request routing
- `.claude/.mcp.json` — local config (points to local build)

**After MCP changes:** `cd packages/mcp && npm run test && npm run build` (bump version in package.json, then `npm publish --access public`).

---

## What You Need to Get Started

### 1. Repository Access

You need access to the `modernagencysales` GitHub org. Tim will invite your GitHub username (`developeranku`).

Clone the main repo you'll work in:
```bash
git clone git@github.com:modernagencysales/magnetlab.git
cd magnetlab
```

### 2. Collaboration

Tim will set up a Slack workspace (or similar) and send you an invite at ankur4736@gmail.com.

### 3. Environment Setup

**Prerequisites:** Node.js 20+, npm

```bash
cp .env.example .env.local
# Tim will share the actual values securely
npm install
npm run dev    # http://localhost:3000
```

**Minimum env vars to run locally:**
```env
# Supabase (shared project qvawbxpijxlwdkolmjrs)
NEXT_PUBLIC_SUPABASE_URL=https://qvawbxpijxlwdkolmjrs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Tim will share>
SUPABASE_SERVICE_ROLE_KEY=<Tim will share>

# Auth
AUTH_SECRET=<generate with: openssl rand -base64 32>
AUTH_URL=http://localhost:3000

# AI (needed for MCP work)
ANTHROPIC_API_KEY=<Tim will share>
OPENAI_API_KEY=<Tim will share>

# Background jobs
TRIGGER_SECRET_KEY=<Tim will share>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Google OAuth, Stripe, and integration keys are NOT needed to run the app — you can navigate most UI without them. AI features need the Anthropic key. The MCP package needs both Anthropic + OpenAI keys.

### 4. Service Access

Tim will grant you access to:

| Service | Why You Need It | How |
|---------|----------------|-----|
| **GitHub** (modernagencysales org) | Clone repos, push code | Org invite |
| **Linear** (Modern Agency Sales workspace) | View/update tickets | Workspace invite |
| **Supabase** (project qvawbxpijxlwdkolmjrs) | Browse tables, debug queries | Project member invite |
| **Vercel** (magnetlab project) | Deploy, view logs | Team invite |
| **Trigger.dev** (magnetlab project) | Monitor background jobs | Team invite |

### 5. Key Documentation

Read these in order (all in `docs/plans/` within the magnetlab repo):

| Doc | What It Covers | Time |
|-----|---------------|------|
| This doc | Your scope and assignments | 10 min |
| `2026-02-25-ceo-system-overview.md` | Plain-English product overview | 10 min |
| `2026-02-25-ecosystem-current-state.md` | Full technical landscape (6 repos) | 20 min |
| `2026-02-25-new-dev-handbook.md` | Setup, flows, troubleshooting, glossary | 30 min |
| `magnetlab/CLAUDE.md` (repo root) | MagnetLab architecture deep-dive | 45 min |
| `2026-02-25-database-schema-reference.md` | DB tables by domain | Skim (reference) |

---

## Your First Week (Magnetlab-Focused)

### Day 1: Read and Understand

- Read docs above (the ones in the table)
- Focus on understanding the magnetlab architecture — you don't need to deeply understand the other 5 repos
- Run `npm run dev` and click through the app as a user: create a lead magnet, explore the Knowledge Brain, look at the sidebar nav
- Write down questions

### Day 2: Understand the Codebase

- Read `src/components/` — especially `wizard/`, `dashboard/`, `content-pipeline/`
- Read `src/app/(dashboard)/` — understand the current route structure
- Read `src/lib/ai/content-pipeline/` — these are the AI modules
- Run `npm run test` — get familiar with the test patterns
- Browse the Supabase dashboard: look at `lead_magnets`, `cp_knowledge_entries`, `funnel_pages` tables

### Day 3: Start on MCP Bugs (Quick Wins)

- Read `packages/mcp/src/` — understand the MCP package architecture
- Start with MOD-242 (search_knowledge broken) and MOD-243 (list_topics empty) — these are 1-point urgent fixes
- Run `cd packages/mcp && npm run test` to see the test suite

### Day 4-5: Continue MCP + Start UI Audit

- Finish remaining urgent MCP fixes (MOD-244, MOD-245)
- Begin MOD-316 (audit feature overlap) — this is a design analysis, not code
- Produce the overlap analysis doc that feeds into the IA redesign

---

## Commands Cheat Sheet

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run build            # Production build
npm run test             # Run Jest tests
npm run typecheck        # TypeScript check

# MCP Package
cd packages/mcp
npm run test             # 271 Vitest tests
npm run build            # Build package
npm publish --access public  # Publish to npm (after version bump)

# Deploy (manual — Tim will show you)
vercel --prod            # Deploy to Vercel

# Trigger.dev (separate deploy — Tim will show you)
TRIGGER_SECRET_KEY=<key> npx trigger.dev@4.3.3 deploy
```

---

## Communication & Process

- **Git workflow:** Feature branches, PRs for review. Branch naming follows Linear's suggestion (e.g., `tim/mod-316-audit-map-feature-overlap-and-duplication`)
- **Testing:** Every new feature MUST include tests. At minimum: schema validation, API route tests, utility function tests.
- **Code review:** After completing a feature, run tests + get review before merging
- **Deploy:** `vercel --prod` for frontend, Trigger.dev deploy separately for background jobs. Tim will walk you through the first deploy.

---

## Questions?

Collect questions as you onboard — they're valuable feedback on where the docs are weak. Bring them to your first sync with Tim.
