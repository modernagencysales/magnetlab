# MCP v2: Agent-Native Rearchitecture

**Date:** 2026-03-13
**Status:** Draft
**Scope:** `packages/mcp/` rearchitecture + service layer extraction + data model changes

---

## Problem

The current MCP (v0.4.4) was built for a browser-first world where the backend does all AI work. It has 123 tools behind a 3-layer indirection pattern (category browser → tool_help → magnetlab_execute), a 3-stage content pipeline (extract → generate → polish), and undiscoverable parameter formats. Every action requires 3 tool calls minimum. An agent using it end-to-end needed 35+ calls to create and publish one lead magnet.

The world has shifted. Users live in terminals with AI agents. The agent IS the AI — it doesn't need the backend to generate content, ideate, or polish. It needs the backend to **store, retrieve, render, and publish**.

## Core Insight

The MCP should be a **thin CRUD layer + compound actions + feedback loop** over a polished data model. The backend's job is:

1. **Data persistence + auth** — CRUD over Supabase, API key auth, team scoping
2. **Rendering + publishing** — Agent writes content, backend renders beautiful landing pages
3. **Embeddings + semantic search** — Vector operations on write, RAG queries on read
4. **Performance intelligence** — Analytics aggregation, per-user recommendations

The backend stops doing: content generation, ideation, polishing, content planning. The agent handles all creative work.

**Exception: Backend AI that stays.** Two operations require backend AI because they depend on infrastructure the agent can't replicate:

1. **`ask_knowledge`** — RAG synthesis over the pgvector store. The agent can't do its own semantic search over embeddings. The backend retrieves relevant entries, assembles context, and synthesizes an answer.
2. **`submit_transcript`** — Chunking, entity extraction, and embedding generation. This is write-path AI, not creative AI.

These are **infrastructure AI** (operating on internal data structures), not **creative AI** (generating user-facing content). The distinction: if it needs access to the vector store or internal data pipeline, the backend does it. If it's writing words a human will read, the agent does it.

## Design Principles

1. **Direct tools, not indirection.** Every tool is a first-class MCP tool with full parameter schemas. No execute gateway, no category browsers, no tool_help.
2. **CRUD over orchestration.** Let the agent be the brain. The MCP stores and serves data.
3. **Pieces, not pipeline.** A lead magnet is a bag of content pieces filled in any order. The only gate is publish validation.
4. **Quality through guidelines, not gates.** The backend validates structure (required fields). The agent enforces quality (good writing) via guidelines returned with schemas.
5. **One API, two shells.** The MCP and the chat UI call the same service layer. Terminal and browser are two presentations of the same interface.
6. **Feedback creates the moat.** Performance data flows back to the agent. More usage = better recommendations = better content = more leads.

---

## Data Model

### The Single Content Field

Current lead magnets have separate `concept`, `extracted_content`, `generated_content`, `polished_content` fields — artifacts of the wizard pipeline. The new model has one `content` field: a structured JSON object whose shape is defined by the archetype.

```typescript
// Everything optional on create/update — filled incrementally
// Archetype publish schema defines what's required for publish
type LeadMagnetContent = {
  headline?: string
  subheadline?: string
  problem_statement?: string
  proof_points?: string[]
  call_to_action?: string
  sections?: Array<{
    title: string
    body: string            // Markdown
    key_insight?: string
  }>
  // Archetype-specific extensions:
  // assessment: questions[], scoring_rubric
  // toolkit: tools[], use_cases[]
  // calculator: inputs[], formula, output_format
  // etc.
}
```

### Two-Layer Schema Per Archetype

Each archetype defines:

1. **Structural schema** (Zod, server-enforced at publish time) — "A single-breakdown needs a headline, problem statement, and at least 3 sections with titles and bodies."
2. **Quality guidelines** (text, agent-enforced) — "Each section should include a specific example or proof point. The headline should name the reader's pain, not describe the product. Proof points should be quantified where possible."

Both are returned by `get_archetype_schema(archetype)` so the agent has everything it needs in one call.

### Content Lifecycle

```
create (shell) → update (add pieces) → update (add more) → publish (validate + go live)
                                                              ↓
                                                     Missing fields?
                                                     → Error names exactly what's missing
                                                     → Agent fixes and retries
```

No wizard steps. No forced order. The agent (or chat UI) fills in pieces conversationally. The structured editor in the UI becomes an optional form view of the same content object.

### Reference Archetype Schema: `single-breakdown`

This is the fully specified example. All other archetypes follow the same two-layer pattern.

```typescript
// Structural schema (Zod, enforced at publish time)
const singleBreakdownPublishSchema = z.object({
  headline: z.string().min(10).max(200),
  subheadline: z.string().optional(),
  problem_statement: z.string().min(20),
  proof_points: z.array(z.string()).min(1).optional(),
  call_to_action: z.string().min(5),
  sections: z.array(z.object({
    title: z.string().min(3),
    body: z.string().min(50),       // Minimum substance per section
    key_insight: z.string().optional(),
  })).min(3),                        // At least 3 sections for a breakdown
})

// Quality guidelines (text, returned alongside schema)
const singleBreakdownGuidelines = `
## Writing a Single Breakdown

A single-breakdown deconstructs one process, framework, or system into
clear, actionable steps that the reader can follow.

### Structure
- **Headline**: Name the reader's pain or desired outcome, not your product.
  Good: "The 5-Step System That Generates 20+ Inbound Leads Per Week"
  Bad: "My Amazing Lead Generation Framework"
- **Problem statement**: 2-3 sentences. Make the reader feel understood.
- **Sections**: Each section is one step/component. Build sequentially.
  - Title: Action-oriented ("Step 1: Audit Your Current Pipeline")
  - Body: Explain what, why, and how. Include a specific example.
  - Key insight: The non-obvious "aha" moment. What would they miss on their own?
- **Proof points**: Quantified where possible. "Used by 500 agencies" > "Trusted by many"
- **Call to action**: Clear next step. What do they do after reading this?

### Common Mistakes
- Sections that describe but don't instruct (telling not showing)
- Generic advice without specific examples from the user's real experience
- Skipping the "why" — readers need to understand why each step matters
- Front-loading credentials instead of leading with value
`
```

### Update Semantics (Deep Merge)

`update_lead_magnet` performs a **shallow merge at the top level, replace at the array level**:

```typescript
// Rules:
// 1. Top-level scalar fields: replace
//    update({ content: { headline: "new" } }) → headline replaced, other fields untouched
//
// 2. Arrays: replace entire array (not append/merge by index)
//    update({ content: { sections: [...] } }) → sections fully replaced
//    To add a section: read current sections, append, send full array
//
// 3. Explicit null: deletes the field
//    update({ content: { subheadline: null } }) → subheadline removed
//
// 4. Omitted fields: untouched
//    update({ content: { headline: "new" } }) → sections, proof_points etc. unchanged
//
// 5. content_version: optimistic locking
//    update({ id, content_version: 3, content: {...} })
//    → succeeds if current version is 3, fails with conflict if it has advanced
//    → agent re-reads and retries on conflict
```

This is the simplest merge model that's still useful. Agents that want to append a section do `get → modify in memory → update with full sections array`. No ambiguous merge heuristics.

### Migration

- Add `content` JSONB column to `lead_magnets` table (nullable)
- Add `content_version` integer column (default 1) for optimistic locking
- Create a normalization function (not raw COALESCE) that reads the best available legacy field and transforms it to match the new content schema shape. Legacy `polished_content` (block-based rendering format) and `extracted_content` (raw extraction output) have different shapes — the function normalizes both.
- Service layer reads: `content ?? normalizeLegacy(polished_content, generated_content, extracted_content)`
- New lead magnets write to `content` only
- Legacy fields preserved for existing data; backfill migration runs later
- Existing API routes continue working during transition

---

## Tool Surface — 36 Direct Tools

Every tool is registered directly with the MCP server. Full parameter schemas in the MCP protocol — agents see them natively. All tools accept an optional `team_id` parameter to scope the operation. If omitted, the user's primary team is used. No implicit session state.

### CRUD Layer (29 tools)

#### Lead Magnets (5)

| Tool | Method | Description |
|------|--------|-------------|
| `list_lead_magnets` | GET | Filter by status, paginate. Returns title, archetype, status, dates. |
| `get_lead_magnet` | GET | Full object including content, funnel info, stats summary. |
| `create_lead_magnet` | POST | Title + archetype required. Content optional — can be empty shell. |
| `update_lead_magnet` | PATCH | Deep-merge on any field. See Update Semantics above. Supports `content_version` for optimistic locking. |
| `delete_lead_magnet` | DELETE | Cascade deletes associated funnel + leads. |

`update_lead_magnet` is the key missing tool. It accepts partial content updates and deep-merges them into the existing content object. This lets the agent add one section at a time, swap a headline, inject proof points — all without regenerating anything.

#### Funnels (7)

| Tool | Method | Description |
|------|--------|-------------|
| `list_funnels` | GET | All funnels with publish status and target info. |
| `get_funnel` | GET | Full config: copy, theme, qualification, publish status. |
| `create_funnel` | POST | Link to lead magnet + slug. Theme, copy, colors optional with good defaults. |
| `update_funnel` | PATCH | Partial update any field. |
| `delete_funnel` | DELETE | Cascade deletes associated leads, page views, qualification data. |
| `publish_funnel` | POST | Validates requirements (content completeness, username set). Returns live URL. Error messages name exactly what's missing and which tool fixes it. |
| `unpublish_funnel` | POST | Takes the page offline. |

#### Knowledge Base (5)

| Tool | Method | Description |
|------|--------|-------------|
| `search_knowledge` | GET | Semantic search over AI Brain. Returns entries with relevance scores. |
| `browse_knowledge` | GET | Browse by topic, category, type. Structured exploration. |
| `get_knowledge_clusters` | GET | Topic clusters with depth/coverage stats. Quick overview of expertise areas. |
| `ask_knowledge` | POST | RAG query. Backend AI: semantic search + context assembly + synthesized answer with sources. |
| `submit_transcript` | POST | Add new expertise. Backend AI: chunking, entity extraction, embedding generation. |

#### Content Posts (6)

| Tool | Method | Description |
|------|--------|-------------|
| `list_posts` | GET | Filter by status, date range. For LinkedIn content pipeline. |
| `get_post` | GET | Full post with metadata, schedule info. |
| `create_post` | POST | Agent writes the post content directly. Accepts `body` (the post text), optional `pillar`, `content_type`. Status defaults to draft. |
| `update_post` | PATCH | Edit content, status, scheduled_time. |
| `delete_post` | DELETE | Remove a post. |
| `publish_post` | POST | Push to LinkedIn via connected integration. Validates integration exists. |

**Note:** `create_post` requires a new API route (or modification of existing route) that accepts agent-authored content without AI generation context. The current `quick_write` and `write_post_from_idea` routes assume backend AI authorship.

#### Email Nurture (3)

| Tool | Method | Description |
|------|--------|-------------|
| `get_email_sequence` | GET | Get the email sequence for a lead magnet. |
| `save_email_sequence` | PUT | Agent writes the full sequence (subject, body, delay per email). Replaces existing. |
| `activate_email_sequence` | POST | Turn it on. Validates ESP integration exists. On failure, error message names the missing integration. |

**Deliberately excluded from v2:** The current MCP has 15 email tools (7 flows, 5 broadcasts, 3 subscribers). Flows, broadcasts, and subscriber management are dropped because they are infrastructure-level operations better suited to the web UI than agent workflows. If agent demand emerges, add `list_subscribers` and `send_broadcast` in a future release.

#### Leads (3)

| Tool | Method | Description |
|------|--------|-------------|
| `list_leads` | GET | Filter by funnel, lead magnet, qualified status, search. Paginated. |
| `get_lead` | GET | Full lead details including qualification responses. |
| `export_leads` | GET | CSV export filtered by funnel, lead magnet, or qualification status. |

### Schema + Context Layer (3 tools)

| Tool | Method | Description |
|------|--------|-------------|
| `list_archetypes` | GET | All available archetypes with one-line descriptions and key characteristics. |
| `get_archetype_schema` | GET | Returns: (1) JSON schema with required/optional fields, (2) quality guidelines for writing, (3) example content. Everything the agent needs to write good content for this archetype. |
| `get_business_context` | GET | User's brand info, audience, tone, key differentiators. Context for personalized writing. |

### Compound Actions (2 tools)

| Tool | Method | Description |
|------|--------|-------------|
| `launch_lead_magnet` | POST | Atomic: create lead magnet + create funnel + publish. Accepts full content + funnel config. Returns live URL. One call to go from zero to published. |
| `schedule_content_week` | POST | Accepts array of posts with full content + scheduling preferences. Creates all posts and schedules them across the user's posting slots. Returns the week's calendar. |

#### `launch_lead_magnet` Parameters

```typescript
{
  // Lead magnet
  title: string            // required
  archetype: Archetype     // required
  content: object          // required — must pass publish validation

  // Funnel
  slug: string             // required
  optin_headline?: string
  optin_subline?: string
  theme?: 'light' | 'dark'
  primary_color?: string

  // Options
  email_sequence?: Array<{ subject: string; body: string; delay_days: number }>
}
```

Returns: `{ lead_magnet_id, funnel_id, public_url, email_sequence_id? }`

#### `schedule_content_week` Parameters

```typescript
{
  posts: Array<{
    body: string              // required — full post text
    pillar?: ContentPillar
    content_type?: ContentType
    preferred_day?: number    // 0=Sun, 1=Mon, ... 6=Sat. Optional — auto-assigned if omitted.
  }>
}
```

Returns: `{ posts: Array<{ id, body, scheduled_time, status }>, slots_used: number }`

### Feedback Loop (2 tools)

These tools return **stub data in Phase 1** — basic aggregations from existing analytics tables. Full intelligence (headline pattern analysis, estimated conversions, ML-powered recommendations) is built in Phase 4.

| Tool | Method | Description |
|------|--------|-------------|
| `get_performance_insights` | GET | Aggregated analytics: top archetypes by conversion, top lead magnets, lead quality by source. What's working for THIS user. |
| `get_recommendations` | GET | What to build next. Crosses knowledge coverage with performance data. "You have deep expertise in X, toolkits convert 22% for you, recommend building a toolkit about X." |

#### `get_performance_insights` Response Shape

```typescript
{
  top_archetypes: Array<{ archetype: string; avg_conversion: number; count: number }>
  top_lead_magnets: Array<{ id: string; title: string; conversion: number; leads: number }>
  headline_patterns: Record<string, { avg_conversion: number; examples: string[] }>
  lead_quality: {
    qualified_rate: number
    top_sources: string[]
    avg_time_to_qualify: string
  }
  period: string  // e.g., "last_90_days"
}
```

#### `get_recommendations` Response Shape

```typescript
{
  suggested_lead_magnets: Array<{
    topic: string
    archetype: Archetype
    reason: string          // Natural language explanation grounded in data
    knowledge_coverage: number  // 0-1, how much expertise exists
    estimated_conversion: number  // Based on similar archetypes
  }>
  content_gaps: Array<{
    topic: string
    entry_count: number
    suggestion: string  // e.g., "Submit more transcripts about X"
  }>
  quick_wins: Array<{
    action: string      // e.g., "Add proof points to Agency Playbook"
    expected_impact: string
    tool_call: string   // The exact tool call to take this action
  }>
}
```

### Account (1 tool)

| Tool | Method | Description |
|------|--------|-------------|
| `list_teams` | GET | Available teams/workspaces for this user. Returns team IDs for use in the `team_id` parameter. |

**No `switch_team` tool.** Implicit session state (where `switch_team` changes the scope of all subsequent calls) is fragile in MCP — tool calls can be reordered, parallelized, or retried. Instead, every tool accepts an optional `team_id` parameter. If omitted, the user's primary team is used. The agent calls `list_teams` once to discover available teams, then passes `team_id` explicitly when needed.

---

## What's Removed (92 tools)

| Category | Count | Reason |
|----------|-------|--------|
| Category browsers | 12 | MCP protocol handles tool discovery natively |
| `magnetlab_execute` gateway | 1 | Tools are direct — no indirection needed |
| `magnetlab_tool_help` | 1 | MCP protocol provides parameter schemas |
| `magnetlab_guide` | 1 | Becomes an MCP resource/prompt, not a tool |
| `extract_content` | 1 | Agent writes content directly |
| `generate_content` | 1 | Agent writes content directly |
| `polish_lead_magnet` | 1 | Agent edits content via `update_lead_magnet` |
| `ideate_lead_magnets` | 1 | Agent ideates using knowledge base + `get_recommendations` |
| `write_post_from_idea` | 1 | Agent writes posts via `create_post` |
| `quick_write` | 1 | Agent writes posts via `create_post` |
| `polish_post` | 1 | Agent edits via `update_post` |
| `generate_funnel_content` | 1 | Agent writes funnel copy via `create_funnel`/`update_funnel` |
| `generate_email_sequence` | 1 | Agent writes emails via `save_email_sequence` |
| Libraries CRUD | 7 | Low usage, add back if needed |
| Swipe file tools | 3 | Low usage, add back if needed |
| Qualification form tools | 5 | Low usage, add back if needed |
| Brand kit tools | 3 | `get_business_context` covers the agent's need |
| Autopilot/buffer/planner | 11 | Simplified to `schedule_content_week` |
| Writing styles/templates | 6 | Agent has its own style capabilities |
| Remaining content pipeline tools | ~20 | Covered by streamlined posts CRUD + knowledge tools |
| Duplicate analytics tools | 3 | Consolidated into `get_performance_insights` |

---

## MCP Resources (Not Tools)

These are loaded into agent context on demand via the MCP resources protocol, not as tool calls:

- **Workflow guides** — Step-by-step recipes for common tasks (create lead magnet, plan content week). Currently `magnetlab_guide` tool output.
- **Quality guidelines** — Also returned inline by `get_archetype_schema`, but available as a standalone resource for agents that want to load all guidelines at once.
- **Business context summary** — Cached version of `get_business_context` for agents that want it in system prompt.

---

## Unified API Architecture

The MCP and the chat UI share the same service layer. No divergence.

```
┌─────────────┐     ┌─────────────┐
│  Terminal    │     │  Browser    │
│  (CC + MCP) │     │  (Chat UI)  │
└──────┬──────┘     └──────┬──────┘
       │                   │
       │  MCP protocol     │  Server Actions / API routes
       │                   │
       ▼                   ▼
┌─────────────────────────────────┐
│         Service Layer           │
│  36 operations, Zod-validated   │
│  Pure functions: no HTTP, no    │
│  cookies, no NextRequest        │
│                                 │
│  Input: typed params + auth ctx │
│  Output: typed results          │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│   Supabase + pgvector + Stripe  │
└─────────────────────────────────┘
```

### Service Layer Contract

Each operation is a pure async function:

```typescript
// Example: createLeadMagnet service
async function createLeadMagnet(
  scope: AuthScope,       // { userId, teamId }
  input: CreateLeadMagnetInput  // Zod-validated
): Promise<{ leadMagnet: LeadMagnet }>

// Example: launchLeadMagnet compound action
async function launchLeadMagnet(
  scope: AuthScope,
  input: LaunchLeadMagnetInput
): Promise<{ leadMagnetId: string; funnelId: string; publicUrl: string }>
```

The MCP server wraps these: parse MCP args → validate with Zod → call service → format response.
The API routes wrap them too: parse request → session auth → call service → JSON response.
The chat UI calls them via server actions: session auth → call service → return to client.

### MCP Topology Decision

The MCP server (`packages/mcp/`) **continues to call HTTP API routes**, not import service functions directly. Reasons:

1. The MCP runs as a standalone stdio process (spawned by Claude Code, Cursor, etc.). Importing Next.js service functions would require running inside the Next.js process or duplicating all Supabase credentials and connection logic.
2. The HTTP path is already working and tested. The MCP client (`MagnetLabClient`) handles auth, timeouts, and error formatting.
3. The "same service function" guarantee is maintained at the service layer — both the MCP (via HTTP) and the chat UI (via server actions) call the same service code. The MCP just goes through one more hop.

The API routes become thin wrappers: auth → Zod validate → call service → respond. The MCP client calls those routes. This is the lowest-risk path that still achieves the unified service layer goal.

### Refactoring Existing Routes

Current API routes contain business logic inline. The refactor:

1. Extract business logic from route handlers into `src/lib/services/` functions
2. Route handlers become thin wrappers: auth check → parse body → call service → respond
3. MCP handlers call the same service functions
4. Service functions are the single source of truth

This is incremental — refactor one domain at a time (lead magnets first, then funnels, etc.).

---

## Chat UI Vision

Attio-style homepage. Chat is the primary interface. Sidebar has reference views.

```
┌──────────────────────────────────────────────────┐
│  MagnetLab                            ⚙️  👤     │
├─────────┬────────────────────────────────────────┤
│         │                                        │
│  Home   │  Good morning, Tim.                    │
│         │                                        │
│  Lead   │  Recent: "Agency cold email guide"     │
│  Magnets│                                        │
│         │  ┌────────────────────────────────┐    │
│  Funnels│  │ Ask anything...          Auto ↑│    │
│         │  └────────────────────────────────┘    │
│  Content│                                        │
│         │  [Launch a lead magnet]                 │
│  Leads  │  [Plan this week's content]            │
│         │  [Check funnel performance]             │
│  Email  │                                        │
│         │  ── Performance ──────────────────     │
│  Know-  │  3 active funnels, 847 leads MTD       │
│  ledge  │  Best: "Agency Playbook" (22% CVR)     │
│         │  Rec: Create a toolkit for your         │
│  Settings│     podcast production workflow        │
│         │                                        │
└─────────┴────────────────────────────────────────┘
```

The chat AI has the same 36 operations. User says "launch a lead magnet about my podcast workflow" → AI searches knowledge → writes content → calls `launch_lead_magnet` → returns URL.

Sidebar views (Lead Magnets, Funnels, etc.) are table/card views for browsing and inline editing. Not the primary creation interface anymore.

The wizard is replaced by: (a) chat-driven creation, or (b) an optional structured editor (form view of the content object) for users who prefer clicking over chatting.

---

## Migration Path

### Phase 1: New MCP + Data Model (this feat branch)

- Add `content` JSONB column + `content_version` integer to `lead_magnets` table
- Define archetype Zod schemas (structural + publish requirements) for all 10 archetypes
- Write quality guidelines per archetype
- Build content normalization function for legacy field migration (not raw COALESCE — handles shape differences between polished_content and extracted_content)
- Rewrite `packages/mcp/` with 36 direct tools
- Extract service layer for lead magnets, funnels, knowledge, posts, email sequences, leads
- MCP server registers tools directly (no gateway pattern)
- Add `update_lead_magnet` with deep-merge semantics + optimistic locking
- Add `create_post` API route for agent-authored content (no AI generation context)
- Add compound actions: `launch_lead_magnet`, `schedule_content_week`
- Add feedback tools: `get_performance_insights`, `get_recommendations` (stub implementations using existing analytics tables — full intelligence in Phase 4)
- Add `list_teams` with `team_id` parameter on all tools
- Add leads tools: `list_leads`, `get_lead`, `export_leads`

### Phase 2: API Route Refactor

- Refactor remaining API routes to thin wrappers over service layer
- Both MCP and routes call same services
- Remove redundant AI generation routes from MCP path (keep for wizard UI during transition)

### Phase 3: Chat UI

- Attio-style chat homepage
- Chat AI wired to same service layer
- Sidebar reference views
- Wizard replaced by chat-driven + optional structured editor

### Phase 4: Feedback Loop Intelligence

- `get_performance_insights` aggregation queries
- `get_recommendations` ML/analytics engine
- Quality guidelines refined based on conversion data
- A/B testing integration with recommendation engine

Phases 1-2 are this feat branch. Phases 3-4 are follow-up work on the same foundation.

---

## Success Criteria

1. An agent can create and publish a lead magnet with a live URL in **3 tool calls or fewer** (using `launch_lead_magnet`, or create + create_funnel + publish)
2. An agent can incrementally edit any part of a lead magnet's content without regenerating anything
3. Total MCP tool count is **under 40** (target: 36)
4. Every tool is directly callable — **zero indirection** (no gateway, no category browsers)
5. Error messages on publish failure name the exact missing field and the tool call to fix it
6. The same service function powers both MCP and API route for every operation
7. No implicit session state — team scoping via explicit `team_id` parameter
8. `get_performance_insights` returns basic per-user analytics (Phase 1 stubs, full intelligence Phase 4)
9. `get_recommendations` suggests lead magnets grounded in knowledge coverage + performance data (Phase 4)
