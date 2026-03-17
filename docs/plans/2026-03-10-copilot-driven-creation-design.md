# Copilot-Driven Lead Magnet Creation

> Design doc — 2026-03-10

## Problem

The 6-step wizard forces ideation, creation, and distribution into one rigid linear flow. Users with partial context (vague idea, existing content, Brain knowledge) get stuck between "full AI" and "fully manual." The copilot exists but can't drive creation. People see 6 steps and disengage.

The worst-case outcome is low-quality lead magnets. The extraction questions are where quality comes from — they must stay rigorous, but adapt to what's already known.

## Solution: Three Decoupled Activities + Copilot-Driven Creation

### Mental Model

| Activity | Where | How |
|----------|-------|-----|
| **Ideation** | Existing idea bank (`cp_content_ideas`) | Browse, import, swipe, AI-generate ideas anytime. Lead magnets are a content subtype. |
| **Creation** | Copilot-driven + full-screen review panel | Pick an idea or describe intent → copilot drives extraction → content review panel → approve → saved |
| **Distribution** | Decoupled, from library or copilot | Generate posts, set up funnel — on your own schedule, not forced during creation |

---

## 1. Idea Bank (Extend `cp_content_ideas`)

Add `lead_magnet` as a content type in the existing idea bank alongside posts and newsletters.

### Sources
- **AI-generated** — Brain-informed suggestions (semantic search for under-explored topics with rich knowledge backing)
- **Manual** — user types in their own idea
- **Swiped** — save from swipe file, competitor content, external inspiration
- **Imported** — paste URL, transcript snippet, or content → AI extracts the lead magnet angle
- **From signals** — signal engine surfaces topics their ICP is engaging with

### Idea Shape
- Title, description, suggested archetype, target audience
- Optional: linked knowledge entries (Brain content that backs it up)
- Status: `new` | `in_progress` | `used`
- Content type: `post` | `newsletter` | `lead_magnet` | etc.

### Actions
- "Create lead magnet from this" → opens copilot with context pre-loaded
- "Write post from this" → existing flow

---

## 2. Copilot-Driven Creation (Core Change)

### Entry Points

All roads lead to the copilot:

1. **From idea bank** — "Create lead magnet" action on an idea → copilot opens with idea context
2. **Direct chat** — "create a lead magnet about X for Y audience"
3. **Paste content** — "turn this transcript/doc into a lead magnet"
4. **Remix** — "make a version of [existing LM] for a different audience"

### The Adaptive Flow

```
User intent arrives (idea, paste, or description)
  │
  ├─ Copilot gathers context automatically:
  │   ├─ Brand kit + voice profile
  │   ├─ Brain knowledge (semantic search on topic)
  │   ├─ Past lead magnets (style reference)
  │   └─ Any pasted/imported content
  │
  ├─ Evaluates: "What do I already know vs. what gaps remain?"
  │
  ├─ Generates gap-filling questions using existing extraction prompt
  │   ├─ Could be 8 questions if starting from scratch
  │   ├─ Could be 2 if Brain has rich transcript content on the topic
  │   └─ Could be 0 if pasted a full doc + Brain has context
  │
  ├─ User answers questions in copilot chat
  │
  ├─ Runs extraction + content generation
  │   (uses existing quality prompts — same pipeline, not new AI)
  │
  ├─ Opens FULL-SCREEN content review panel
  │   ├─ Structured editor: sections, headings, body text
  │   ├─ Edit, rearrange, delete sections
  │   ├─ Archetype-specific layout
  │   └─ Approve / request changes
  │
  ├─ On approve → lead magnet saved as draft
  │
  └─ Offers next steps (not forced):
      ├─ "Want me to generate LinkedIn posts?"
      ├─ "Want to set up the funnel page?"
      └─ "Done for now — find it in your library"
```

### Quality Guardrails

- **Brain knowledge is auto-injected** — copilot always searches `cp_knowledge_entries` via semantic search before generating content. This is the anti-fluff mechanism. Real insights from real transcripts.
- **Existing extraction prompt drives questions** — the prompt that generates rigorous questions stays intact. It receives a "here's what I already know" preamble with Brain entries, brand kit, and any pasted content, so it only asks what's genuinely missing.
- **Existing content generation prompts** — same `content-extractor`, `post-writer`, `post-polish` modules. Quality doesn't change.
- **Voice profile applied** — same as current wizard, writing style matched to user's voice.

### New Copilot Actions

Extend `src/lib/actions/lead-magnets.ts`:

| Action | Purpose |
|--------|---------|
| `start_lead_magnet_creation` | Gathers context (Brain, brand kit), evaluates gaps, generates extraction questions |
| `submit_extraction_answers` | Processes answers + all context, runs content generation |
| `open_content_review` | Signals frontend to open full-screen review panel with generated content |
| `save_lead_magnet` | Saves approved content to `lead_magnets` table (confirmation required) |
| `generate_lead_magnet_posts` | Runs post-writer on an existing lead magnet (distribution step) |
| `remix_lead_magnet` | Clones and adapts an existing lead magnet for new angle/audience |

### Full-Screen Content Review Panel

The copilot sidebar (400px) is too narrow for content editing. When content is ready for review:

- Copilot sends a `open_review_panel` event
- A full-screen modal/overlay opens with the structured content editor
- User edits sections, rearranges, approves or requests changes
- On approve, control returns to copilot chat
- On "request changes," user describes what to change in chat, copilot regenerates

This is the one new UI pattern — everything else builds on existing copilot infrastructure.

---

## 3. Distribution (Decoupled)

Posts and funnels become actions on existing lead magnets, not wizard steps.

| Action | How |
|--------|-----|
| **Generate posts** | From library: button. From copilot: "write posts for my cold email checklist." Post preview as rich cards in chat. |
| **Set up funnel** | From library: existing funnel builder at `/library/[id]/funnel`. From copilot: "set up a funnel for this lead magnet." |
| **Publish** | Existing flows — no change needed |

A lead magnet can exist in `draft` status without posts or a funnel. Create the asset first, distribute when ready.

---

## 4. Wizard Sunset (Gradual)

- **Keep existing wizard** at `/dashboard/create` — no changes
- **Add entry point** — "Create with AI Assistant" button/link that opens the copilot with creation intent
- **Track adoption** — PostHog events on both paths
- **Remove wizard** once copilot creation proves out in usage data

---

## What Changes vs. What Stays

| Component | Status |
|-----------|--------|
| Extraction prompts | **Keep** — quality backbone |
| Content generation prompts | **Keep** — same pipeline |
| Post-writer prompts | **Keep** — used in distribution step |
| Copilot sidebar + infrastructure | **Keep + extend** — new actions, full-screen panel |
| `cp_content_ideas` | **Extend** — add `lead_magnet` content type |
| Wizard (`/dashboard/create`) | **Keep temporarily** — sunset after copilot proves out |
| Copilot lead magnet actions | **Rewrite** — from stub CRUD to full creation pipeline |
| Brain semantic search | **Keep** — auto-injected into creation flow |
| Funnel builder | **Keep as-is** — decoupled, accessed from library |
| Brand kit loading | **Keep** — copilot reads it automatically |
| Voice profile | **Keep** — applied during generation |

## Key Files (Existing)

| File | Relevance |
|------|-----------|
| `src/lib/actions/lead-magnets.ts` | Rewrite — new copilot actions |
| `src/lib/ai/copilot/system-prompt.ts` | Extend — add lead magnet creation context |
| `src/components/copilot/CopilotProvider.tsx` | Extend — handle `open_review_panel` event |
| `src/components/copilot/CopilotSidebar.tsx` | Minor — trigger full-screen panel |
| `src/lib/ai/content-pipeline/content-extractor.ts` | Reuse — content generation |
| `src/lib/ai/content-pipeline/embeddings.ts` | Reuse — Brain semantic search |
| `src/components/wizard/steps/ExtractionStep.tsx` | Reference — extraction question prompt |
| `src/components/wizard/steps/ContentStep.tsx` | Reference — content review UI patterns |
| `src/app/api/copilot/chat/route.ts` | Extend — handle new actions in agent loop |

## New Files (Anticipated)

| File | Purpose |
|------|---------|
| `src/components/copilot/ContentReviewPanel.tsx` | Full-screen content review modal |
| `src/lib/ai/copilot/lead-magnet-creation.ts` | Orchestration: context gathering, gap analysis, question generation |

## Risks

- **Quality regression** — mitigated by reusing existing prompts and auto-injecting Brain knowledge
- **Copilot conversation too long** — extraction Q&A could make conversations unwieldy. Mitigate with clear section breaks and the full-screen panel transition.
- **Users confused by two creation paths** — mitigate with clear messaging, track both paths, sunset wizard when ready
