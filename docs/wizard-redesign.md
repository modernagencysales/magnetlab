# MagnetLab Lead Magnet Creation Redesign — UX Architecture Spec

> Generated: 2026-03-04 | Phase 1 Analysis & Design (no code changes)
> Companion docs: `/docs/ui-audit.md`, `/docs/feature-overlap-audit.md`

---

## Context: Why This Redesign

Users find the 6-step wizard **convoluted, rigid, and overwhelming**:

1. **Forced linearity** — 6 steps must happen in exact order. Can't skip ahead, can't come back later, can't work on the funnel while content generates.
2. **Front-loaded overwhelm** — Step 1 asks for 10+ business context fields before anything happens. New users stare at a wall of inputs.
3. **Long waits with no escape** — Three AI background jobs (ideation ~30s, extraction ~20s, post writing ~15s) create dead time where users can't do anything else.
4. **Too many outputs at once** — The wizard produces content + 3 post variations + DM template + CTA word all in one session. It's a firehose.
5. **Disconnected from the rest of the app** — Wizard posts save to `lead_magnets` table (invisible to content pipeline at `/posts`). Funnel building is a separate task after the wizard. Knowledge base insights aren't surfaced to the user.
6. **No iteration** — Once saved, MagnetDetail's Content and Post tabs are read-only. Can't regenerate, can't re-extract.

**The broader flow the app should embody**: Knowledge → Content → Distribution. The current wizard tries to do all three in one sitting.

---

## Design Principles

| Principle | What it means in practice |
|-----------|--------------------------|
| **Create first, fill in later** | A lead magnet record exists the moment you name it. Everything else is optional enhancement. |
| **Each piece is independently valuable** | A landing page without content is still useful. Content without a post is fine. A post without a funnel works. |
| **Show one thing at a time** | Never show 6 steps ahead. Show the current task with a gentle hint about what's next. |
| **AI fills the gaps, not the user** | If the Knowledge Base knows your pain points, don't ask the user to type them again. |
| **Background work = freedom** | When AI is generating, the user can work on other tabs, not stare at a spinner. |
| **Depth on demand** | Simple path for "just give me a landing page." Deep path for "I want to craft every detail." |

---

## The Redesign: From Wizard to Workspace

### The Fundamental Shift

**Current**: Wizard (6 sequential steps) → produces lead magnet record at Step 6 → user goes to MagnetDetail to build funnel separately.

**Proposed**: Lightweight creation dialog on `/magnets` → produces lead magnet record immediately → user lands on enhanced MagnetDetail (the "Workspace") → fills in Content, Posts, Funnel in any order, at any time → contextual "What's Next?" guidance helps new users without restricting anyone.

### How the Wizard Steps Map to the Workspace

| Wizard Step | Becomes | Where it lives |
|-------------|---------|---------------|
| Step 1: ContextStep (10 fields) | **Gone per-magnet.** Brand Kit auto-populates. First-time setup is 3 fields in creation dialog, then Settings > Branding for depth. | Creation dialog + Settings |
| Step 2: IdeationStep (10 concepts) | **Full-page ideation experience** triggered from creation dialog. First-time users default here. | `/magnets` page overlay |
| Step 3: ExtractionStep (Q&A) | **Content tab > "Extract from Expertise"** — chat Q&A, available anytime, with Knowledge Base pre-fill. | Workspace Content tab |
| Step 4: ContentStep (review/edit) | **Content tab > Review & Edit** — inline editing, re-editable, with Regenerate. | Workspace Content tab |
| Step 5: PostStep (pick a post) | **Posts tab** — generate, view all variations, edit, "Send to Content Pipeline". | Workspace Posts tab |
| Step 6: PublishStep (save) | **Gone.** Saving is automatic per-section. Publishing is per-funnel (existing). | Workspace Funnel tab |

---

## Flow 1: Creating a New Lead Magnet

The "Create New → Lead Magnet" button opens a dialog on `/magnets`. The dialog adapts based on user state:

### First-Time User (no lead magnets, no/sparse brand kit)

"Generate Ideas" is the **primary path** — this preserves the wizard's best feature (the AI ideation "magic moment") while removing the 10-field form.

```
┌──────────────────────────────────────────────────┐
│  Create Your First Lead Magnet              [X]  │
│                                                  │
│  What problem do you want to solve for           │
│  your audience?                                  │
│                                                  │
│  [____________________________________________]  │
│  e.g., "Clients don't know their ROI"            │
│                                                  │
│  ⚙️ Advanced: add transcript or competitor       │
│     analysis for better results                  │
│                                                  │
│  [✨ Generate Lead Magnet Ideas]                 │
│                                                  │
│  ─── or ───                                      │
│                                                  │
│  "I already know what I want to create"          │
│  Title: [____________________________]           │
│  Type:  [Checklist ▾]  ← required (10 options)  │
│  [Create]                                        │
│                                                  │
└──────────────────────────────────────────────────┘
```

If no brand kit exists, the "Generate Ideas" path first shows **3 quick setup fields** (saves to `brand_kits`):
- "Describe your business in one sentence" (text)
- "What type of business?" (dropdown)
- "Top 3 pain points your clients have" (tag input)

This is 3 fields vs the wizard's 10. Fewer fields = weaker first ideation, but less friction = more users complete it. After first use, show: "Want better results next time? Add more detail →" link to Settings > Branding.

### Returning User (has brand kit, possibly has knowledge base)

```
┌──────────────────────────────────────────────────┐
│  New Lead Magnet                            [X]  │
│                                                  │
│  ┌─ This Week's Suggestions ─────────────────┐  │
│  │  📊 "Agency ROI Calculator"               │  │
│  │     Assessment · clients can't measure... │  │
│  │  📋 "Client Onboarding Checklist"         │  │
│  │     Checklist · new clients get lost...   │  │
│  │  💡 "5 Mistakes Framework"                │  │
│  │     Framework · common pitfalls that...   │  │
│  │  → See all suggestions                    │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ─── or ───                                      │
│                                                  │
│  Title: [____________________________]           │
│  Type:  [Checklist ▾]                            │
│  [Create]                                        │
│                                                  │
│  [Generate more ideas...]                        │
│                                                  │
└──────────────────────────────────────────────────┘
```

Suggestions come from `cp_content_ideas` where `content_type = 'lead_magnet'` (populated by Monday 8 AM cron `suggest-lead-magnet-topics`). Clicking one auto-fills title + archetype + pain point.

### Ideation: Full-Page Experience

When "Generate Ideas" runs, results display as a **full-page overlay** (not crammed in the dialog). The current wizard shows 10 concept cards with viral check scores, recommendation badges ("Ship This Week", "Highest Engagement", "Authority Builder"), delivery format, and creation time estimate. This experience needs room.

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back                    Choose Your Lead Magnet Concept   │
│                                                              │
│  ┌─ 🚀 Ship This Week ────────────────┐  ┌─ 📈 Highest ─┐ │
│  │  Client ROI Calculator              │  │  5 Mistakes   │ │
│  │  Assessment · 1-2 hours             │  │  Framework    │ │
│  │  "Clients can't measure the value   │  │  Guide · ...  │ │
│  │   of your service..."               │  │               │ │
│  │  ✅✅✅✅✅ Viral check: 5/5        │  │  ✅✅✅✅☐   │ │
│  │  [Create from This Idea]            │  │  [Create]     │ │
│  └─────────────────────────────────────┘  └───────────────┘ │
│                                                              │
│  ┌─ 🏆 Authority Builder ─────────────┐  ┌─ Concept 4 ──┐ │
│  │  Onboarding Blueprint               │  │  ...          │ │
│  │  ...                                │  │               │ │
│  └─────────────────────────────────────┘  └───────────────┘ │
│                                                              │
│  + 6 more concepts below                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

"Create from This Idea" → `POST /api/lead-magnet` with `{ title, archetype, concept }` → navigates to `/magnets/[id]` workspace.

**Non-blocking**: If the user closes the dialog during generation, ideation continues in background. Results save to `brand_kits.saved_ideation_result` (already happens). When they re-open the creation dialog, "Use Previously Generated Ideas" appears (existing behavior).

### On Create

`POST /api/lead-magnet` with `{ title, archetype }` (both required by schema) → creates record with `status: 'draft'` → navigates to `/magnets/[id]`.

**No schema changes needed.** The `createLeadMagnetSchema` already makes everything except `title` and `archetype` optional. `concept`, `extractedContent`, `postVariations` etc. are all nullable/optional.

---

## Flow 2: The Lead Magnet Workspace (`/magnets/[id]`)

After creation, the user lands on the enhanced MagnetDetail page.

### Workspace Layout

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Lead Magnets                                  │
│                                                          │
│  Agency ROI Calculator                                   │
│  Assessment  •  Draft                                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ ℹ️ Next: Create your content → Content tab       [X]│    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────┬─────────┬───────┬───────┬───────────┐       │
│  │Content •│ Posts   │Funnel ✓│Leads │ Analytics │       │
│  └────────┴─────────┴───────┴───────┴───────────┘       │
│                                                          │
│  [Current tab content]                                   │
│                                                          │
└──────────────────────────────────────────────────────────┘

Tab status indicators:
  • = in progress (has partial data)
  ✓ = complete (content extracted / funnel published / posts generated)
  (blank) = not started
```

### "What's Next?" Banner (Guided Mode v1)

A single-line contextual banner at the top of the workspace. Updates based on tab completion:

| State | Banner text |
|-------|-------------|
| No content, no posts, no funnel | "Next: Create your content → Go to Content tab" |
| Has content, no posts | "Next: Generate promotional posts → Go to Posts tab" |
| Has content + posts, no funnel | "Next: Build your landing page → Go to Funnel tab" |
| Everything done | Banner hidden |
| User dismissed with [X] | Hidden for this lead magnet (stored in localStorage) |

This replaces a full sidebar guide. ~30 lines of logic, works on mobile, zero screen real estate issues. If user feedback later says more guidance is needed, upgrade to a sidebar coach.

### Content Tab (NEW — replaces wizard Steps 3+4)

Three progressive states:

**State A: Empty (no extracted content)**

```
┌──────────────────────────────────────────┐
│  Content                                 │
│                                          │
│  Your lead magnet doesn't have content   │
│  yet. Choose how to add it:              │
│                                          │
│  [🧠 Extract from your expertise]       │
│    Answer a few questions and AI will    │
│    structure your knowledge into content │
│                                          │
│  [✍️  Write it yourself]                │
│    Start with a blank editor             │
│                                          │
│  [📄 Import existing content]            │
│    Paste or upload content you've        │
│    already written                       │
│                                          │
└──────────────────────────────────────────┘
```

If the lead magnet has no archetype (shouldn't happen since it's required, but as safety), "Extract from expertise" asks for archetype first before showing questions.

**State B: Extraction in progress (Q&A flow)**

Same chat-like interface as the current `ExtractionStep`, but NOT a blocking wizard step. The user can:
- Switch to the Funnel tab while answering questions
- Come back tomorrow — answers persist via `extraction_answers` JSONB column on `lead_magnets`
- See knowledge base suggestions alongside each question

**Knowledge base pre-fill** (key new integration):

```
┌──────────────────────────────────────────┐
│  Q: Walk through your process step by    │
│     step.                                │
│                                          │
│  💡 From your Knowledge Base:            │
│  ┌────────────────────────────────────┐  │
│  │ "First we do a 30-minute audit     │  │
│  │  call, then we map their current   │  │
│  │  funnel and identify the 3 biggest │  │
│  │  leaks..."                         │  │
│  │  [Use this answer →]               │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [Your answer: ________________________] │
│  [_____________________________________] │
│                                          │
│  [← Previous]  [Next →]  [Generate ▶]  │
│                                          │
└──────────────────────────────────────────┘
```

Implementation: For each extraction question, call `searchKnowledgeV2()` with the question text + concept title as search query. Show top 2-3 matching `cp_knowledge_entries` as collapsible suggestion cards. "Use this answer" copies the text into the answer field. User can edit after copying.

**State C: Content ready (editable)**

Same as current `ContentStep` / `InteractiveContentStep`:
- Section-by-section editor
- Can add/remove/reorder sections and items
- **"Regenerate" button** — re-runs extraction with current answers (new capability)
- **Interactive archetypes** (calculator, assessment, prompt): Show the interactive builder inline within this tab, same components (`CalculatorEditor`, `AssessmentEditor`, `GPTEditor`), just embedded in workspace instead of wizard

Auto-save: Content edits save to `lead_magnets.extracted_content` via debounced `PUT /api/lead-magnet/[id]` (same as current inline editing in the wizard's ContentStep, just persisting to DB instead of wizard state).

### Posts Tab (ENHANCED — replaces wizard Step 5, now writable)

Currently read-only. Redesigned as a full post management surface:

**State A: No posts yet**

```
┌──────────────────────────────────────────┐
│  Promotional Posts                       │
│                                          │
│  Generate LinkedIn posts to promote      │
│  this lead magnet.                       │
│                                          │
│  [✨ Generate Posts]                     │
│    ↳ Requires content (Content tab)      │
│                                          │
│  [✍️ Write manually]                    │
│    ↳ Opens QuickWriteModal               │
│                                          │
└──────────────────────────────────────────┘
```

"Generate Posts" calls existing `POST /api/lead-magnet/write-post` → triggers `write-posts` Trigger.dev task → background job polling via `useBackgroundJob`. **Non-blocking**: user can switch tabs while posts generate.

**State B: Posts generated**

Shows ALL variations (not just the selected one like the current wizard). Each card has:
- Post text with hook type label
- Quality evaluation badges (hook strength, credibility, AI-cliche check — existing)
- **"Send to Content Pipeline"** button — the key bridge fix
- **"Copy"** button (existing)
- **"Regenerate All"** button — re-runs post generation with current content

DM template also shown here (moved from wizard's PublishStep / MagnetDetail Overview).

**"Send to Content Pipeline" bridge** (critical architectural fix):

```
POST /api/content-pipeline/posts
{
  draft_content: variation.post,
  content_type: 'lead_magnet',
  lead_magnet_id: magnet.id,
  status: 'draft',
  user_id,
  team_id
}
```

This creates a `cp_pipeline_posts` row. The post then appears in `/posts` (Pipeline tab) ready for scheduling/publishing. **No schema changes needed** — `cp_pipeline_posts` already has `lead_magnet_id` column (added in migration `20260213000000`).

### Funnel Tab (UNCHANGED)

Already fully functional as a standalone `FunnelBuilder` with 8 sub-tabs (optin, thankyou, questions, theme, sections, content, email, integrations). No changes needed.

**Critical**: Can be used immediately after creation — even before content exists. AI-generated teaser copy is already handled by `generateOptinContent()` in the funnel creation route.

### Overview Tab (SIMPLIFIED)

Streamlined from current layout:
- Title (editable inline)
- Pain point / description (editable)
- Archetype badge
- Quick stats (views, leads, conversion rate)
- Status (draft / published)
- "Create Funnel" CTA if no funnel exists (existing)

DM template moves to Posts tab. Concept details become expandable/collapsible.

### Leads Tab (UNCHANGED)

Shows `funnel_leads` for this lead magnet. Already works.

### Analytics Tab (NEEDS IMPLEMENTATION)

Currently a stub ("coming soon"). Not part of this redesign, but flagged.

---

## Data Flow Changes

### 1. Record Creation Moved to Start

**Existing behavior, no changes needed.** `POST /api/lead-magnet` already supports `{ title, archetype }` with everything else optional. Status defaults to `'draft'`.

### 2. Extraction Answer Persistence (NEW — requires migration)

Add `extraction_answers` JSONB column to `lead_magnets` table:
```sql
ALTER TABLE lead_magnets
  ADD COLUMN IF NOT EXISTS extraction_answers JSONB DEFAULT NULL;
```
Shape: `Record<string, string>` (question_id → answer text). Replaces the wizard draft system for in-progress extraction state.

### 3. Posts → Content Pipeline Bridge (NEW — no migration)

When user clicks "Send to Content Pipeline":
```
lead_magnets.post_variations[i]
  → POST /api/content-pipeline/posts {
      draft_content: variation.post,
      content_type: 'lead_magnet',
      lead_magnet_id: magnet.id,
      status: 'draft',
      user_id, team_id
    }
```
Uses existing route and existing `lead_magnet_id` column.

### 4. AI Topic Suggestions → Creation Dialog (NEW — no migration)

Query `cp_content_ideas` where `content_type = 'lead_magnet'` and `status = 'extracted'` on `/magnets` page load. Surface as suggestion cards in the creation dialog and optionally as a banner on the list page.

### 5. Knowledge Pre-fill → Extraction (NEW — no migration)

During extraction Q&A, for each question, call `searchKnowledgeV2()` from `knowledge-brain.ts` with (question text + concept title) as search query. Display top 2-3 matching entries as suggestion cards.

---

## Existing Components to Reuse

| New Surface | Existing Component/API | Changes Needed |
|-------------|----------------------|----------------|
| Creation dialog | `POST /api/lead-magnet` | No backend changes. New dialog component. |
| Full-page ideation | `IdeationStep.tsx` (concept cards) + `POST /api/lead-magnet/ideate` | Extract card components out of wizard. Backend unchanged. |
| Content tab Q&A | `ExtractionStep.tsx` (chat interface) | Refactor out of wizard into standalone `ContentExtractor`. Add KB pre-fill. |
| Content tab editor | `ContentStep.tsx` / `InteractiveContentStep.tsx` | Refactor out of wizard. Add "Regenerate" button. |
| Posts tab | `PostStep.tsx` (variation cards) + `POST /api/lead-magnet/write-post` | Make writable. Add "Send to Pipeline" + "Regenerate". |
| Funnel tab | `FunnelBuilder.tsx` | No changes (already standalone). |
| Knowledge pre-fill | `searchKnowledgeV2()` in `knowledge-brain.ts` | New integration point. |
| Background job polling | `useBackgroundJob` hook | Reuse as-is. |
| Brand kit loading | `GET /api/brand-kit` | No changes. |
| Quick Landing Page | `POST /api/landing-page/quick-create` | Kept as separate path in "Create New" dropdown. |

---

## Component Disposition

| Current Component | What Happens |
|-------------------|-------------|
| `WizardContainer.tsx` | **Refactored** — state management extracted into per-tab hooks. Background job polling reused. |
| `WizardProgress.tsx` | **Removed** — replaced by tab status indicators + "What's Next?" banner |
| `GeneratingScreen.tsx` | **Removed** — replaced by inline progress indicators within each tab |
| `PublishStep.tsx` | **Removed** — saving is automatic, publishing is per-funnel |
| `DraftPicker.tsx` | **Removed** — incomplete lead magnets are `status: 'draft'` records on the list page |
| `useWizardAutoSave` hook | **Removed** — each tab auto-saves via API calls |
| `ExtractionStep.tsx` | **Refactored** → standalone `ContentExtractor` component |
| `ContentStep.tsx` | **Refactored** → standalone `ContentEditor` component |
| `InteractiveContentStep.tsx` | **Refactored** → inline within Content tab when archetype is interactive |
| `PostStep.tsx` | **Refactored** → enhanced `PostManager` with write capabilities |
| `ContextStep.tsx` | **Removed** — 3-field setup in creation dialog; full brand kit in Settings |
| `IdeationStep.tsx` | **Refactored** → concept cards extracted for full-page ideation overlay |
| `CustomIdeaStep.tsx` | **Removed** — manual entry is the "type your own title" path in the creation dialog |
| `/create` route | **Redirects** to `/magnets?create=1` (auto-opens dialog) |

---

## Migration Path

### Phase 0: Flexible Wizard (optional quick win)

If dev time is constrained, a minimal change to the existing wizard buys 80% of the value:
- Change `WizardProgress` from linear bar to sidebar nav (like Settings page)
- Allow clicking any step at any time (remove step validation guards)
- Allow "Save" at any step (move `POST /api/lead-magnet` call from Step 6 to a persistent "Save" button)
- AI jobs run in background; user can navigate other steps while waiting

This solves the #1 pain (forced linearity) without rebuilding anything. Can ship in days, not weeks.

### Phase A: Build the workspace (non-breaking, additive)

1. Add `extraction_answers` column to `lead_magnets` (migration)
2. Build writable Content tab (refactor `ExtractionStep` + `ContentStep` into standalone components)
3. Build writable Posts tab (refactor `PostStep`, add "Send to Pipeline", "Regenerate")
4. Add knowledge pre-fill to extraction Q&A
5. Build "What's Next?" banner component
6. Build creation dialog on `/magnets`
7. Build full-page ideation overlay (refactor `IdeationStep` cards)
8. Surface AI topic suggestions on `/magnets` list

### Phase B: Transition (swap creation entry point)

9. "Create New → Lead Magnet" in sidebar dropdown opens dialog instead of navigating to `/create`
10. `/create` redirects to `/magnets?create=1`
11. Existing wizard drafts (`extraction_sessions`) converted to `lead_magnets` stubs

### Phase C: Clean up

12. Remove wizard components (`ContextStep`, `CustomIdeaStep`, `PublishStep`, `DraftPicker`, `WizardProgress`, `GeneratingScreen`)
13. Remove `/create` route entirely
14. Drop `extraction_sessions` table (wizard drafts)

---

## Impact on Navigation

This redesign reinforces the nav simplification from `/docs/feature-overlap-audit.md`:

- **"Pages" nav item removed** — funnels accessed via Lead Magnet workspace's Funnel tab
- **Knowledge + Posts merged into "Content"** — content pipeline is the daily operations hub
- **Lead magnet creation starts from the Lead Magnets page**, not a separate `/create` route

Simplified nav:
```
1. Home
2. Lead Magnets  ← creation + workspace lives here
3. Content       ← daily content ops (pipeline, calendar, knowledge, autopilot)
4. Audience      ← all people (leads, signals, subscribers)
5. Email         ← campaigns only (flows + broadcasts)
6. Team          ← team management + command center
```

---

## Key Technical Details for Implementation

### Archetype Selection

The `createLeadMagnetSchema` requires both `title` (string, 1-200 chars) and `archetype` (enum). The 10 archetypes should be presented as a dropdown with plain-language labels:

| Archetype Value | User-Facing Label |
|----------------|-------------------|
| `focused-toolkit` | Toolkit / Resource Kit |
| `single-breakdown` | Case Study Breakdown |
| `single-calculator` | Calculator / ROI Tool |
| `assessment` | Assessment / Quiz |
| `checklist-playbook` | Checklist / Playbook |
| `prompt` | AI Prompt Pack |
| `workflow` | Workflow Template |
| `swipe-file` | Swipe File |
| `framework` | Framework / Model |
| `mini-course` | Mini Course |

### Background Job Handling in Workspace

The existing `useBackgroundJob` hook polls for Trigger.dev task completion. In the workspace, it runs per-tab:
- Content tab: polls for extraction job completion
- Posts tab: polls for post-writing job completion
- Both show inline progress (not full-screen `GeneratingScreen`)
- User can switch tabs freely during polling — the hook continues in background

### Auto-Save Strategy

| Tab | What auto-saves | API call | Trigger |
|-----|-----------------|----------|---------|
| Content (Q&A) | `extraction_answers` | `PUT /api/lead-magnet/[id]` | Debounced 2s after answer change |
| Content (editor) | `extracted_content` | `PUT /api/lead-magnet/[id]` | Debounced 2s after edit |
| Posts | Nothing auto-saves — posts save on explicit "Generate" or "Send to Pipeline" | Various | User action |
| Overview | `title`, `concept.painSolved` | `PUT /api/lead-magnet/[id]` | On blur |

### External API Compatibility

The `/api/external/` routes (used by gtm-system DFY pipeline and MCP tools) are **unaffected**. They create and modify `lead_magnets` records directly via server-side API calls, independent of the UI. The workspace redesign is purely a frontend change.

### Backward Compatibility

Existing lead magnets created via the wizard have `extracted_content`, `post_variations`, `concept`, etc. already populated. The new Content and Posts tabs must detect this existing data and render it in State C (editable) rather than State A (empty). Check: `if (leadMagnet.extracted_content) → show editor` else `→ show creation options`.

---

## Verification Plan

After implementation, validate:

1. **New user flow**: Create account → "Generate Ideas" is default → 3-field setup → ideation → pick concept → workspace → verify brand kit saved
2. **Returning user flow**: With populated KB → verify suggestions appear on `/magnets` → verify creation dialog shows them → verify knowledge pre-fill works in extraction Q&A
3. **Non-linear flow**: Create lead magnet → build funnel first → add content later → generate posts → verify all tabs work independently at all times
4. **Tab-switching during AI**: Start extraction → switch to Funnel tab → come back → verify answers persisted and AI result appeared
5. **"Send to Pipeline" bridge**: Generate posts → click "Send to Content Pipeline" → verify post appears in `/posts` Pipeline tab with correct `lead_magnet_id`
6. **Backward compat**: Load existing wizard-created lead magnets → verify Content tab shows extractedContent, Posts tab shows postVariations, all tabs render correctly
7. **Mobile**: Verify tab navigation, "What's Next?" banner, Content tab Q&A flow, and creation dialog work on mobile viewport
8. **Existing tests**: `npm run test` — all 225+ tests should pass (additive changes, no core logic modifications)
