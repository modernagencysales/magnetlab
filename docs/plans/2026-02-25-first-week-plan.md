# New Developer First Week Plan

**Date:** 2026-02-25
**Purpose:** Structured ramp-up with starter tasks that teach the codebase by doing

---

## Day 1: Read and Understand

**Goal:** Build the mental model. No code.

### Morning
1. Read `ecosystem-current-state.md` (~20 min)
2. Read `monorepo-consolidation-design.md` (~15 min)
3. Read `new-dev-handbook.md` (~30 min)
4. Skim `database-schema-reference.md` — don't memorize, just know it exists (~15 min)

### Afternoon
5. Read magnetlab's `CLAUDE.md` — this is the biggest codebase, understand it thoroughly (~45 min)
6. Read gtm-system's `CLAUDE.md` — focus on middleware, webhook patterns, Trigger.dev tasks (~30 min)
7. Skim the other 4 repo CLAUDE.md files (~20 min)
8. Write down every question you have. Bring them to the Day 2 sync.

**Deliverable:** A list of questions and anything that confused you. This feedback is valuable — it tells us where the docs are weak.

---

## Day 2: Run Everything Locally

**Goal:** Every app boots on your machine.

### Morning
1. Clone all 6 repos
2. Set up env vars (use the access checklist + shared vault)
3. Get magnetlab running on port 3000
4. Get gtm-system running on port 3001
5. Get copy-of-gtm-os running on port 5173

### Afternoon
6. Get leadmagnet-backend running on port 3002
7. Get leadmagnet-admin running on port 3003
8. Get dwy-playbook running on port 3004
9. Run the test suite for magnetlab (`npm run test`) and gtm-system (`npm test`)
10. Open the Supabase dashboard, browse the `leads`, `prospects`, and `users` tables

**Deliverable:** All 6 apps running. Screenshot as proof. Note any setup issues — we should fix them.

---

## Day 3: Trace the Data

**Goal:** Follow a lead through the system end-to-end. This is the single best way to understand how things connect.

### Exercise 1: Blueprint Pipeline (60-90 min)

1. Open the `prospects` table in Supabase. Pick a prospect with status `complete` and note its `id`
2. Look at the `posts` table — filter by that `prospect_id`. See the generated posts.
3. Open copy-of-gtm-os locally. Navigate to `/blueprint/{prospect-slug}`. See how the frontend renders the data.
4. In leadmagnet-backend, read `src/routes/intake.ts` — this is where the pipeline starts
5. Read `src/trigger/scrape-prospect.ts` → `enrich-prospect.ts` → `generate-posts.ts` — follow the 6-step pipeline
6. Read `src/services/enrichment/` — the 5-step AI enrichment with Tavily research

### Exercise 2: Lead Capture (30-45 min)

1. Open magnetlab locally. Create a test lead magnet (use the wizard at `/create`)
2. Publish a funnel page
3. Open the funnel's public URL. Submit the opt-in form with a test email
4. Check the `funnel_leads` table in Supabase — your submission should be there
5. Read `src/app/api/public/lead/route.ts` — see how leads are captured, webhooks fired, email sequences triggered

### Exercise 3: Content Pipeline (30-45 min)

1. Open the `cp_call_transcripts` table. Pick one.
2. Find its `cp_knowledge_entries` (filter by `transcript_id`)
3. Read `src/trigger/process-transcript.ts` — see how transcripts become knowledge
4. Read `src/lib/ai/content-pipeline/knowledge-extractor.ts` — see the AI extraction
5. Read `src/lib/services/knowledge-brain.ts` — see semantic search via pgvector

**Deliverable:** You should be able to explain the Blueprint pipeline, lead capture flow, and content pipeline to someone else. If you can't, identify which parts are unclear.

---

## Day 4: First Code Changes

**Goal:** Make small, safe changes that teach you the patterns.

### Starter Task 1: Add a missing test (magnetlab)

**What:** Pick any API route in `src/app/api/` that doesn't have a corresponding test in `src/__tests__/api/`. Write a basic test.

**Why this teaches you:**
- How API routes are structured (getServerSession, Zod validation, Supabase queries)
- How tests are set up (mocks, auth, Supabase chain mocking)
- The test conventions (`jest-environment node`, `@/` imports)

**Files to reference:** `src/__tests__/api/lead-magnet/create.test.ts` for the pattern.

**Scope:** 1-2 test cases. Don't overthink it.

### Starter Task 2: Fix a TypeScript strict warning (gtm-system)

**What:** Run `npm run build` in gtm-system. Pick any type error or warning and fix it.

**Why this teaches you:**
- The gtm-system codebase structure
- How integrations are typed
- The build pipeline

**Scope:** 1 fix. Commit it.

### Starter Task 3: Add a column to the schema reference (docs)

**What:** Pick any table from `SCHEMA_DUMP.txt` that isn't well-documented in the schema reference. Add it or improve its description.

**Why this teaches you:**
- The database schema
- How to verify columns against reality
- The documentation workflow

**Deliverable:** 2-3 small commits. Each one should pass tests.

---

## Day 5: Understand the Migration

**Goal:** Form your own opinion on the consolidation plan.

### Morning

1. Re-read `monorepo-consolidation-design.md` with fresh eyes (you now understand the codebase)
2. For each phase, ask: "What would I do differently?"
3. Look at the shared database — which tables would be hardest to untangle?
4. Look at the auth systems — which migration path seems safest?
5. Check the Trigger.dev dashboards for all 3 projects — see the task volume and failure patterns

### Afternoon

6. Write up your assessment:
   - What do you agree with in the consolidation plan?
   - What would you change?
   - What risks do you see that aren't addressed?
   - What would you prioritize first?
   - What questions do you have?

**Deliverable:** A 1-2 page written assessment. This isn't a test — it's your input on the architecture. Disagreements with the plan are valuable.

---

## After Week 1

You should now be able to:
- [ ] Run all 6 apps locally
- [ ] Explain how a lead flows through the Blueprint pipeline
- [ ] Explain how a SaaS user creates and publishes a funnel
- [ ] Explain how the content pipeline turns transcripts into posts
- [ ] Make small changes and commit them
- [ ] Navigate the Supabase dashboard and find relevant data
- [ ] Have an informed opinion on the consolidation plan

### Suggested Second Week Tasks (increasing complexity)

1. **Move one leadmagnet-admin page into magnetlab** — pick the simplest page (e.g., the docs page). This is a micro version of Phase 1 in the consolidation plan.

2. **Add a new webhook endpoint to gtm-system** — this will force you to deal with the CSRF skip list, CORS configuration, and Trigger.dev task creation. All three major gotchas in one task.

3. **Fix a Trigger.dev task failure** — check the dashboards for any recently failed tasks. Diagnose the root cause and fix it. This teaches the most about how the system actually works in production.

4. **Improve RLS policies** — the tenant isolation audit identified permissive policies on bootcamp and blueprint tables. Tighten one table's policies. This teaches the Supabase security model.

5. **Set up the Turborepo skeleton** (Phase 0 of consolidation) — if you're feeling ambitious and have formed your opinion on the plan, start the monorepo setup as a proof of concept.
