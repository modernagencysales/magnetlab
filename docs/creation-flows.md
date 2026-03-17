# MagnetLab Creation Flows — Intent-Based Design

> Phase 2 — Information Architecture | No code changes
> Extends: `/docs/wizard-redesign.md`, `/docs/information-architecture.md`

---

## Context: Why Replace the Wizard

The 6-step wizard (Context → Ideation → Extraction → Content → Post → Publish) forces every user through the same linear path regardless of their starting point. Problems:

1. **Wrong starting points** — A user with a transcript wants to process it first. A user with an idea wants to jump to creation. A user who just wants a post doesn't need a lead magnet at all. The wizard doesn't accommodate any of these.
2. **Post bundled into creation** — Step 5 (LinkedIn post) is distribution, not creation. Forcing it into the lead magnet flow conflates two jobs.
3. **6 potential drop-off points** — Each step is a gate. Evidence: multiple "Untitled Draft" entries at various stages in `extraction_sessions`.
4. **Drafts as a concept** — The wizard creates a draft in `extraction_sessions` the moment auto-save fires (2s debounce). Users who abandon at Step 1 leave ghost drafts. The DraftPicker shows "Untitled Draft" entries that represent 10 seconds of typing, not meaningful work.

The replacement: **3 intent-based flows, each 1-3 active steps, no drafts.**

---

## The Three Flows

```
                    ┌─────────────────────────────┐
                    │    What do you want to do?   │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌────────────┐   ┌──────────────┐   ┌──────────┐
     │  INGEST    │   │   CREATE     │   │  WRITE   │
     │ transcript │   │ lead magnet  │   │  a post  │
     └─────┬──────┘   └──────┬───────┘   └────┬─────┘
           │                 │                 │
     1. Upload         1. Pick/describe   1. Open writer
     2. AI processes      topic           2. Write/generate
        (background)   2. Confirm +       3. → Pipeline
     3. → Brain           select type
                       3. → Workspace
```

Each flow is independent. None requires the others. But they connect:
- Ingestion feeds Brain → Brain ideas seed Creation
- Creation produces assets → Assets seed Post writing
- Post writing distributes assets → Distribution grows Audience

---

## Flow A: "I have a transcript/call to process" (Ingestion)

**Who uses this:** Users who just had a sales call, podcast interview, or client meeting and want to extract knowledge from it.

**Where it starts:** Brain > Transcripts tab, or "Add Transcript" quick action on Home dashboard.

**Not a lead magnet flow.** This feeds the Brain. Lead magnet creation is a separate downstream decision.

### Steps

| Step | What happens | User provides | Auto-generated | Time |
|------|-------------|---------------|----------------|------|
| **1. Upload** | User pastes text, uploads file, or transcript arrives via webhook (Grain/Fireflies/Fathom) | Transcript text or file | Nothing yet | Instant |
| **2. Process** | `process-transcript` Trigger.dev task runs in background. User can navigate away. | Nothing — this is a background job | Knowledge entries (8 types), content ideas, topic normalization, embeddings, quality scores | ~20-30s |
| **3. Review** *(optional)* | Brain > Knowledge shows new entries. Brain > Ideas shows extracted ideas. User can edit, delete, or act on them. | Optional edits | Pre-classified, pre-scored | User's pace |

**Active steps: 1.** Upload is the only active step. Processing is background. Review is optional.

**Where the user lands:** Brain > Transcripts (with processing status indicator on the new transcript). When processing completes, the transcript row shows "X knowledge entries, Y ideas extracted."

**How this connects to creation:**
- Brain > Ideas shows extracted ideas with actions: "Create Lead Magnet" and "Write Post"
- Clicking "Create Lead Magnet" → opens Flow B (Creation) with the idea's data pre-filled
- Clicking "Write Post" → opens Flow C (Post) with the idea's topic pre-filled

**Maps to existing wizard steps:**
- Replaces: Nothing directly — the wizard doesn't have a transcript ingestion step. Currently, transcripts are uploaded at `/knowledge?tab=transcripts` (no connection to the wizard).
- What's new: The explicit bridge from "transcript processed" → "here are lead magnet ideas" → "create one" makes the Brain → Asset connection visible for the first time.

**Webhook path (zero active steps):**
For users with Grain/Fireflies/Fathom connected, transcripts arrive automatically via webhook. The flow is:
1. Call ends → transcript webhook fires → processing starts automatically
2. User sees notification in Brain: "New transcript processed — 8 knowledge entries, 3 ideas"
3. User reviews at their leisure

---

## Flow B: "I want to create a lead magnet" (Creation)

**Who uses this:** Users who want to build a new lead magnet — either from scratch, from an AI suggestion, or from a Brain idea.

**Where it starts:** "Create New > Lead Magnet" dropdown, or Lead Magnets list page "+ New" button, or "Create Lead Magnet" action on a Brain idea.

**This is the wizard replacement.** Full details in `/docs/wizard-redesign.md`. Summarized here with step specs.

### Three Paths, Same Outcome

All paths end the same way: a `lead_magnets` record exists with `{ title, archetype, status: 'draft' }` and the user is on the workspace.

#### Path B1: "I know what I want" (2 steps)

| Step | What happens | User provides | Auto-generated | Time |
|------|-------------|---------------|----------------|------|
| **1. Dialog** | Creation dialog opens on `/magnets`. User fills in title and selects archetype from dropdown (10 options). | Title (text), Archetype (select) | Nothing | ~15s |
| **2. Create** | `POST /api/lead-magnet { title, archetype }` → record created → navigate to `/magnets/[id]` | Click "Create" | Lead magnet record with `status: 'draft'` | Instant |

**Where the user lands:** Workspace at `/magnets/[id]` with "What's Next?" banner suggesting: "Create your content → Content tab."

#### Path B2: "Generate ideas for me" (3 steps)

| Step | What happens | User provides | Auto-generated | Time |
|------|-------------|---------------|----------------|------|
| **1. Prompt** | Creation dialog with "Generate Ideas" as primary CTA (first-time users) or secondary option (returning users). User enters one sentence describing the problem they solve. | Problem statement (1 field). If no brand kit: also business description, type, top 3 pains (3 fields → saves to `brand_kits`). | Nothing yet | ~30s |
| **2. Pick concept** | Full-page ideation overlay shows 10 concept cards with viral check scores, recommendation badges, delivery format, creation time estimate. Non-blocking: user can close and come back. | Selects one concept card | 10 AI-generated concepts, recommendations (Ship This Week, Highest Engagement, Authority Builder), bundle suggestions | ~30s generation + user's pace to choose |
| **3. Create** | "Create from This Idea" → `POST /api/lead-magnet { title, archetype, concept }` → navigate to workspace | Click button | Lead magnet record with concept pre-filled | Instant |

**Where the user lands:** Workspace at `/magnets/[id]` with concept data already populated on Overview tab.

**First-time user variant:** If no brand kit exists, Step 1 includes 3 quick setup fields (business description, business type, top 3 pains). These save to `brand_kits` on submit — not per-magnet, globally. This is 3 fields vs the wizard's 10. See wizard-redesign.md §Flow 4 for details.

**Non-blocking generation:** If ideation takes 30s, the user can close the dialog. When they return (re-open dialog or visit `/magnets`), previously generated ideas appear. Existing behavior via `brand_kits.saved_ideation_result`.

#### Path B3: "Create from Brain idea" (2 steps)

| Step | What happens | User provides | Auto-generated | Time |
|------|-------------|---------------|----------------|------|
| **1. Pre-filled dialog** | User clicks "Create Lead Magnet" on an idea card in Brain > Ideas. Creation dialog opens with title, archetype, and pain point pre-filled from the idea's `cp_content_ideas` data. | Review and optionally edit pre-filled fields | Pre-filled from idea data | ~5s |
| **2. Create** | Confirm → `POST /api/lead-magnet { title, archetype, concept }` → navigate to workspace | Click "Create" | Lead magnet record | Instant |

**Where the user lands:** Workspace at `/magnets/[id]`.

### After Creation: The Workspace (Not a Flow)

The workspace (`/magnets/[id]`) is NOT part of the creation flow. It's the asset's home. The user configures it over time, in any order:

| Workspace Tab | What it does | Optional? | Maps to Wizard Step |
|---------------|-------------|-----------|---------------------|
| **Content** | Extract expertise (Q&A with KB pre-fill), write manually, or import | Yes — a lead magnet can exist without content | Steps 3 + 4 (Extraction + Content) |
| **Posts** | Generate promotional posts, send to Content pipeline | Yes — completely independent of creation | Step 5 (Post) — now decoupled |
| **Funnel** | Build landing page, configure integrations | Yes — can build before content exists | Not in wizard (was separate) |
| **Leads** | View funnel opt-in leads | Passive — no action needed | Not in wizard |
| **Analytics** | View performance metrics | Passive — no action needed | Not in wizard |

**Key principle: each tab is an independent action, not a sequential step.** The "What's Next?" banner suggests an order (Content → Posts → Funnel) but never blocks.

### Maps to Existing Wizard Steps

| Wizard Step | Disposition | Where it goes |
|-------------|-------------|---------------|
| Step 1: Context (10 fields) | **Eliminated per-magnet.** Brand kit auto-populates. First-time setup is 3 fields in creation dialog (Path B2 Step 1). Full brand kit editing in Settings > Branding. | Settings + Creation dialog |
| Step 2: Ideation (10 concept cards) | **Kept as full-page experience** in Path B2 Step 2. Same AI, same cards, same quality. Just not gated behind Step 1's 10 fields. | Creation Flow Path B2 |
| Step 3: Extraction (Q&A chat) | **Moved to Workspace > Content tab.** Available anytime, resumable, with Knowledge Base pre-fill. Not a creation gate. | Workspace |
| Step 4: Content (section editor) | **Moved to Workspace > Content tab.** Same editor, now persistent and re-editable with Regenerate. | Workspace |
| Step 5: Post (variation picker) | **Moved to Workspace > Posts tab.** Now fully decoupled from creation. Generate, view all variations, send to Content pipeline. | Workspace (separate job) |
| Step 6: Publish (save) | **Eliminated.** Record exists from Step 2 of creation flow. Auto-saves per-field. Publishing is per-funnel action. | Automatic |

**Net reduction: 6 wizard steps → 2-3 creation steps + independent workspace actions.**

---

## Flow C: "I want to write a post" (Post Writing)

**Who uses this:** Users who want to publish LinkedIn content — either standalone thought leadership, a lead magnet promotion, or a post from a Brain idea.

**Where it starts:** "Create New > Post" dropdown, Content page FAB, or action buttons in Brain > Ideas or Lead Magnets workspace > Posts tab.

**This is NOT part of lead magnet creation.** Post writing is distribution, not creation. The wizard bundled them; the new design separates them.

### Three Paths

#### Path C1: Quick write — standalone post (1-2 steps)

| Step | What happens | User provides | Auto-generated | Time |
|------|-------------|---------------|----------------|------|
| **1. Write** | QuickWriteModal opens. User writes manually or clicks "AI Draft" with a topic/prompt. | Post text (manual) OR topic prompt (AI) | If AI: full post draft using voice profile + knowledge base context | Manual: user's pace. AI: ~10s |
| **2. Save** | Post saves to `cp_pipeline_posts` with `status: 'draft'`. Modal closes. | Click "Save" or "Save & Schedule" | Pipeline record | Instant |

**Where the user lands:** Content > Pipeline with the new post visible in the draft column.

**Maps to:** Current QuickWriteModal at `/posts?quick_write=1`. Unchanged functionality, new location in Content section.

#### Path C2: Generate posts for a lead magnet (2-3 steps)

| Step | What happens | User provides | Auto-generated | Time |
|------|-------------|---------------|----------------|------|
| **1. Navigate** | User opens Lead Magnets > [magnet] > Posts tab | Navigation | N/A | ~3s |
| **2. Generate** | Clicks "Generate Posts" → `POST /api/lead-magnet/write-post` triggers Trigger.dev task. Non-blocking — user can switch tabs. | Click button (requires Content tab to have content) | 3 post variations with hook types, quality evaluations, DM template | ~15s |
| **3. Send to pipeline** | Reviews variations, clicks "Send to Content Pipeline" on chosen post | Selects variation, clicks button | `cp_pipeline_posts` record with `content_type: 'lead_magnet'`, `lead_magnet_id` | Instant |

**Where the user lands:** Post appears in Content > Pipeline, linked to the lead magnet.

**Maps to:** Wizard Step 5, but now:
- It's an optional action on an existing asset, not a mandatory creation step
- All 3 variations are visible (not just the selected one)
- "Send to Content Pipeline" bridges the previously disconnected data models
- "Regenerate" is available (the wizard was one-shot)

#### Path C3: Write from a Brain idea (2 steps)

| Step | What happens | User provides | Auto-generated | Time |
|------|-------------|---------------|----------------|------|
| **1. Trigger** | User clicks "Write Post" on an idea card in Brain > Ideas | Click button | N/A | Instant |
| **2. Generate + review** | `write-post-from-idea` Trigger.dev task generates post. Opens in Content > Pipeline as draft for review/edit. | Optional edits | Full post draft from idea + knowledge context + voice profile | ~10s |

**Where the user lands:** Content > Pipeline with the new draft post open for editing.

**Maps to:** Current `/posts?tab=ideas` → Write button. Same functionality, now framed as an explicit flow rather than a tab action.

---

## Flow Summary

| Flow | Entry Points | Active Steps | Creates | User Lands At |
|------|-------------|-------------|---------|---------------|
| **A: Ingest** | Brain > Transcripts, webhook auto-push | 1 (upload) | Knowledge entries + Ideas | Brain > Transcripts |
| **B: Create** | Create New dropdown, Lead Magnets page, Brain idea action | 2-3 | Lead magnet record (`draft`) | Workspace `/magnets/[id]` |
| **C: Write** | Create New dropdown, Content page, Brain idea action, Workspace Posts tab | 1-2 | Pipeline post (`draft`) | Content > Pipeline |

**Compare to wizard: 6 sequential steps, 3 blocking AI waits, 1 flow for all intents.**

---

## How Flows Connect (The Virtuous Cycle)

```
         ┌──────────────────────────────────────────────┐
         │                                              │
         ▼                                              │
    ┌─────────┐    ideas    ┌──────────────┐  "Send to  │
    │  BRAIN  │ ──────────► │ LEAD MAGNETS │  Pipeline" │
    │         │  "Create    │  (workspace) │ ──────────►│
    │ Transcr.│   from      │              │            │
    │ Knowl.  │   idea"     │ Content tab  │  ┌────────┐│
    │ Ideas   │             │ Posts tab ───┼─►│CONTENT ││
    └─────────┘             │ Funnel tab   │  │Pipeline││
         ▲                  └──────────────┘  │Calendar││
         │                                    └───┬────┘│
         │              ideas                     │     │
         └────────────────────────────────────────┘     │
                    "Write                              │
                     Post"          publishes to        │
                                    LinkedIn ──────────►│
                                                        │
                                              ┌─────────┤
                                              │AUDIENCE │
                                              │ Leads   │
                                              │ Signals │
                                              └─────────┘
```

The Brain is the hub. Everything flows from it and feeds back into it (new transcripts from calls with leads → more knowledge → better content).

---

## What Happens to Existing Drafts (Migration Plan)

### Current State

The `extraction_sessions` table stores wizard drafts with a `wizard_state` JSONB column containing the full `WizardState` snapshot. Drafts auto-save every 2 seconds. They never expire (wizard sets `expires_at = null`).

Draft data includes:
- `brandKit` — business context (also in `brand_kits` table)
- `ideationResult` — 10 AI-generated concepts with recommendations and bundle suggestions
- `selectedConceptIndex` — which concept the user picked
- `extractionAnswers` — raw Q&A answers from extraction step
- `chatMessages` — full chat history from extraction
- `extractedContent` — structured content output from AI
- `interactiveConfig` — calculator/assessment/prompt config (for interactive archetypes)
- `postResult` — 3 post variations + DM template + CTA word
- `selectedPostIndex` — which post variation was chosen

### Migration Rules

**Principle: promote meaningful work to `lead_magnets`, discard ephemeral state.**

| Draft State | Has Concept? | Has Content? | Migration Action |
|-------------|-------------|-------------|-----------------|
| Step 1 only (business context, no concept) | No | No | **Discard.** Business context is brand kit data — already saved to `brand_kits` by the wizard's `POST /api/brand-kit` call. Nothing unique here. |
| Step 2 (concept selected, no extraction) | Yes | No | **Promote.** Create `lead_magnets` record: `{ title: concept.title, archetype: concept.archetype, concept: selectedConcept, status: 'draft' }` |
| Step 3 (extraction answers, no final content) | Yes | Partial | **Promote with answers.** Create `lead_magnets` record with concept data + `extraction_answers` JSONB (the new column from wizard-redesign.md). User can resume extraction on the Content tab. |
| Step 3-4 (extracted content exists) | Yes | Yes | **Promote with content.** Create `lead_magnets` record with concept + `extracted_content` + `interactive_config` (if applicable) + `extraction_answers`. |
| Step 5 (posts generated) | Yes | Yes | **Promote with content + posts.** Create `lead_magnets` record with concept + content + `post_variations` + `dm_template` + `cta_word`. Also create `cp_pipeline_posts` records for each variation (bridging to the content pipeline). |

### What Data Is Deliberately NOT Migrated

| Data | Why it's discarded |
|------|-------------------|
| Rejected concepts (non-selected from ideation) | Ephemeral AI suggestions. Stale after days. User can re-ideate from the workspace. |
| Ideation recommendations (Ship This Week, etc.) | Time-sensitive analysis. Meaningless weeks later. |
| Bundle suggestions | Speculative AI output. Not actionable without the full concept set. |
| Chat messages (extraction Q&A history) | The structured output (`extractedContent`) is what matters. The chat turns are intermediate state. |
| Pending job metadata | Ephemeral. Jobs have either completed or timed out. |

### Migration Script Pseudocode

```
FOR each extraction_session WHERE wizard_state IS NOT NULL:
  state = JSON.parse(wizard_state)

  -- Skip Step 1 only drafts (no concept)
  IF state.selectedConceptIndex IS NULL AND state.customConcept IS NULL:
    DELETE extraction_session
    CONTINUE

  -- Get the selected concept
  concept = state.isCustomIdea
    ? state.customConcept
    : state.ideationResult.concepts[state.selectedConceptIndex]

  -- Create lead_magnets record
  INSERT INTO lead_magnets (
    user_id, team_id, title, archetype, concept,
    extracted_content, interactive_config,
    extraction_answers, post_variations,
    dm_template, cta_word, status
  ) VALUES (
    session.user_id, session.team_id,
    concept.title, concept.archetype, concept,
    state.extractedContent,     -- NULL if step < 4
    state.interactiveConfig,    -- NULL if not interactive
    state.extractionAnswers,    -- NULL if step < 3
    state.postResult?.variations,  -- NULL if step < 5
    state.postResult?.dmTemplate,
    state.postResult?.ctaWord,
    'draft'
  )

  -- Bridge posts to content pipeline (if step 5 completed)
  IF state.postResult IS NOT NULL:
    FOR each variation IN state.postResult.variations:
      INSERT INTO cp_pipeline_posts (
        user_id, team_id, draft_content, content_type,
        lead_magnet_id, status
      ) VALUES (
        session.user_id, session.team_id,
        variation.post, 'lead_magnet',
        new_lead_magnet_id, 'draft'
      )

  DELETE extraction_session
```

### Post-Migration Cleanup

1. Drop `extraction_sessions` table (after verifying all meaningful data migrated)
2. Remove `/api/wizard-draft` routes (GET, PUT, DELETE)
3. Remove `DraftPicker` component
4. Remove `useWizardAutoSave` hook
5. Remove `WizardContainer`, `WizardProgress`, `GeneratingScreen` (per wizard-redesign.md)
6. Redirect `/create` → `/magnets?create=1`

### What Users See After Migration

Before: DraftPicker shows "Untitled Draft — Step 2 — 3 days ago"

After: Lead Magnets list shows "Agency ROI Calculator — Draft — 3 days ago" as a real record. User clicks it → opens workspace → can resume from wherever they left off (Content tab shows extracted content if it exists, or shows empty state with "Extract from expertise" if it doesn't).

**No more ghost drafts.** Every record on the Lead Magnets list represents real, meaningful work with a title and archetype.

---

## "Create New" Dropdown (Updated)

The dropdown in the sidebar reflects the three intent-based flows:

| Item | Action | Flow |
|------|--------|------|
| **Lead Magnet** | Opens creation dialog on `/magnets` | Flow B |
| **Post** | Opens QuickWriteModal on `/content` | Flow C |
| **Quick Landing Page** | Opens `/create/page-quick` (simplified funnel-only flow) | Separate path |
| **Library** | Opens library creation in Lead Magnets section | Variant of Flow B |

"External Resource" drops from the dropdown (niche, accessible from Lead Magnets list). "Landing Page" becomes "Quick Landing Page" — the full lead magnet creation is the primary path.

---

## Comparing Wizard vs New Flows

| Dimension | Wizard (Current) | Intent-Based Flows (New) |
|-----------|------------------|--------------------------|
| Entry points | 1 (the wizard at `/create`) | 3 (Ingest, Create, Write) + contextual actions from Brain |
| Steps to first asset | 6 (all required) | 2-3 (only what's needed) |
| Can start from a transcript? | No (transcript upload is separate, unconnected) | Yes (Flow A → Brain idea → Flow B) |
| Can create without content? | No (Extraction is Step 3, required) | Yes (create with just title + archetype) |
| Can build funnel before content? | No (Funnel is post-wizard, separate page) | Yes (Funnel tab works immediately) |
| Post writing required? | Yes (Step 5 is mandatory) | No (Posts tab is optional, separate job) |
| AI wait handling | Blocking spinner, can't navigate | Background jobs, can switch tabs/pages |
| Draft management | Separate `extraction_sessions` table, DraftPicker | No drafts — just `lead_magnets` records with `status: 'draft'` |
| Abandoned work | "Untitled Draft" entries in DraftPicker | Lead magnet records on the list page (visible, resumable, deletable) |
| Knowledge base connection | Silent (KB data injected into ideation prompt, not shown to user) | Explicit (KB pre-fills extraction answers, ideas bridge to creation) |
| Post → Content Pipeline | Disconnected (`lead_magnets.post_variations` not in pipeline) | Bridged ("Send to Content Pipeline" creates `cp_pipeline_posts`) |

---

## Edge Cases

### User with no Brain data (first-time)
Flow B Path B2 handles this: the creation dialog's "Generate Ideas" path includes 3-field brand kit setup. Ideas are generated from the minimal context. After first use, prompt to "Add a transcript for better results next time."

### User wants to create a lead magnet AND a post in one sitting
Create the lead magnet (Flow B). On the workspace, go to Content tab → extract/write content. Then go to Posts tab → generate posts → send to pipeline. This is 2 workspace actions after creation, done at the user's pace, in the same sitting or across multiple sessions. Same outcome as the wizard, but each step is optional and non-blocking.

### User abandons partway through creation dialog
If the user closes the dialog before clicking "Create" — nothing is saved. No ghost draft. The dialog is stateless. If they opened the full-page ideation and generated concepts, those are cached in `brand_kits.saved_ideation_result` (existing behavior) and appear next time they open the dialog.

### User has a partially extracted lead magnet
If Content tab has extraction answers but no final content (user stopped answering questions): answers are persisted in `lead_magnets.extraction_answers` (new JSONB column). When the user returns to the Content tab, the Q&A resumes from where they left off. No separate draft system needed.

### Existing lead magnets created by the old wizard
The workspace Content and Posts tabs detect existing data: if `extracted_content` exists → show editor (State C). If `post_variations` exist → show variation cards. Backward compatible — see wizard-redesign.md §Backward Compatibility.

---

## Files That Change

| Category | Files | Change Type |
|----------|-------|-------------|
| **New components** | `BrainContent.tsx`, `CreationDialog.tsx`, `IdeationOverlay.tsx`, `ContentExtractor.tsx`, `ContentEditor.tsx`, `PostManager.tsx`, `WhatsNextBanner.tsx` | Create |
| **Refactored from wizard** | `ExtractionStep.tsx` → `ContentExtractor.tsx`, `ContentStep.tsx` → `ContentEditor.tsx`, `PostStep.tsx` → `PostManager.tsx`, `IdeationStep.tsx` → `IdeationOverlay.tsx` | Refactor |
| **Removed** | `WizardContainer.tsx`, `WizardProgress.tsx`, `GeneratingScreen.tsx`, `PublishStep.tsx`, `DraftPicker.tsx`, `ContextStep.tsx`, `CustomIdeaStep.tsx`, `useWizardAutoSave.ts` | Delete |
| **Route changes** | `/create` → redirect to `/magnets?create=1`, `/brain` new route, `/content` new route, `/audience` new route | Modify |
| **API changes** | `/api/wizard-draft` → removed. No new API routes needed — existing routes support all flows. | Delete |
| **Migration** | Add `extraction_answers` JSONB column to `lead_magnets`. Migration script for `extraction_sessions` → `lead_magnets`. Drop `extraction_sessions` table. | Migration |

---

## Verification Plan

1. **Transcript → Lead Magnet flow**: Upload transcript → verify knowledge entries appear in Brain → verify ideas appear → click "Create Lead Magnet" on idea → verify creation dialog pre-fills → create → verify workspace
2. **"I know what I want" flow**: Open creation dialog → enter title + select archetype → create → verify workspace with empty Content tab
3. **"Generate ideas" flow**: Open creation dialog → enter problem → generate ideas → verify full-page overlay with 10 concepts → pick one → create → verify workspace with concept populated
4. **"Write a post" flow**: Open QuickWriteModal → write or AI-generate → verify post appears in Content > Pipeline
5. **Lead magnet → post flow**: Open workspace > Posts tab → generate posts → verify all variations visible → click "Send to Content Pipeline" → verify post appears in Content > Pipeline with `lead_magnet_id`
6. **Draft migration**: Run migration script against test data → verify all Step 2+ drafts become `lead_magnets` records → verify Step 1 only drafts are discarded → verify `cp_pipeline_posts` records created for Step 5 drafts
7. **No ghost drafts**: Create → close dialog before finishing → verify no record created. Create → finish → verify record exists on list page as "Draft."
8. **Resume partial work**: Create lead magnet → answer 3 of 5 extraction questions → close browser → return → verify answers persisted, Q&A resumes from question 4
9. **Backward compat**: Load existing wizard-created lead magnets → verify Content tab shows extracted content, Posts tab shows variations, all workspace tabs work
