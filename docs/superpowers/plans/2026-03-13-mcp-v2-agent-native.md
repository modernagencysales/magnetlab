# MCP v2: Agent-Native Rearchitecture — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the MagnetLab MCP from 106 tools behind an execute gateway to 36 direct tools with a unified content model.

**Architecture:** MCP server registers 36 tools directly (no category browsers, no execute gateway). Backend adds a single `content` JSONB field to lead_magnets, archetype-specific Zod publish schemas, and new API routes for update_lead_magnet, create_post, and compound actions. MCP client continues calling HTTP routes.

**Tech Stack:** TypeScript, MCP SDK, Zod, vitest, Supabase (PostgreSQL + pgvector)

**Spec:** `docs/superpowers/specs/2026-03-13-mcp-v2-agent-native-rearchitecture.md`

**Scope:** Phases 1 only. Phase 2 (full route refactor to thin wrappers) and Phases 3-4 (chat UI, feedback intelligence) are separate follow-up plans.

**MCP Resources:** The spec defines MCP resources (workflow guides, quality guidelines, business context). These are deferred to a follow-up task — the current plan focuses on the 36 tools.

---

## Definitive Tool Mapping (36 tools)

Every tool in the spec, mapped to its API route (existing or new) and plan task.

| # | Spec Tool Name | API Route | Plan Task | Client Method |
|---|---------------|-----------|-----------|---------------|
| 1 | `list_lead_magnets` | GET `/lead-magnet` (exists) | Task 12 | `listLeadMagnets` |
| 2 | `get_lead_magnet` | GET `/lead-magnet/[id]` (exists) | Task 12 | `getLeadMagnet` |
| 3 | `create_lead_magnet` | POST `/lead-magnet` (exists) | Task 12 | `createLeadMagnet` |
| 4 | `update_lead_magnet` | PATCH `/lead-magnet/[id]` (**new**) | Task 5 | `updateLeadMagnetContent` |
| 5 | `delete_lead_magnet` | DELETE `/lead-magnet/[id]` (exists) | Task 12 | `deleteLeadMagnet` |
| 6 | `list_funnels` | GET `/funnel/all` (exists) | Task 12 | `listFunnels` |
| 7 | `get_funnel` | GET `/funnel/[id]` (exists) | Task 12 | `getFunnel` |
| 8 | `create_funnel` | POST `/funnel` (exists) | Task 12 | `createFunnel` |
| 9 | `update_funnel` | PUT `/funnel/[id]` (exists) | Task 12 | `updateFunnel` |
| 10 | `delete_funnel` | DELETE `/funnel/[id]` (exists) | Task 12 | `deleteFunnel` |
| 11 | `publish_funnel` | POST `/funnel/[id]/publish` (exists, **enrich errors** Task 5b) | Task 12 | `publishFunnel` |
| 12 | `unpublish_funnel` | POST `/funnel/[id]/publish` (exists) | Task 12 | `unpublishFunnel` |
| 13 | `search_knowledge` | GET `/content-pipeline/knowledge` (exists) | Task 12 | `searchKnowledge` |
| 14 | `browse_knowledge` | GET `/content-pipeline/knowledge` (exists, different params) | Task 12 | `browseKnowledge` |
| 15 | `get_knowledge_clusters` | GET `/content-pipeline/knowledge/clusters` (exists) | Task 12 | `getKnowledgeClusters` |
| 16 | `ask_knowledge` | POST `/content-pipeline/knowledge/ask` (exists) | Task 12 | `askKnowledge` |
| 17 | `submit_transcript` | POST `/content-pipeline/transcripts` (exists) | Task 12 | `submitTranscript` |
| 18 | `list_posts` | GET `/content-pipeline/posts` (exists) | Task 12 | `listPosts` |
| 19 | `get_post` | GET `/content-pipeline/posts/[id]` (exists) | Task 12 | `getPost` |
| 20 | `create_post` | POST `/content-pipeline/posts` (**new/modify**) | Task 6 | `createPost` |
| 21 | `update_post` | PATCH `/content-pipeline/posts/[id]` (exists) | Task 12 | `updatePost` |
| 22 | `delete_post` | DELETE `/content-pipeline/posts/[id]` (exists) | Task 12 | `deletePost` |
| 23 | `publish_post` | POST `/content-pipeline/posts/[id]/publish` (exists) | Task 12 | `publishPost` |
| 24 | `get_email_sequence` | GET `/email-sequence/[leadMagnetId]` (exists) | Task 12 | `getEmailSequence` |
| 25 | `save_email_sequence` | PUT `/email-sequence/[leadMagnetId]` (**modify semantics** Task 6b) | Task 12 | `saveEmailSequence` |
| 26 | `activate_email_sequence` | POST `/email-sequence/[leadMagnetId]/activate` (exists) | Task 12 | `activateEmailSequence` |
| 27 | `list_leads` | GET `/leads` (exists) | Task 12 | `listLeads` |
| 28 | `get_lead` | GET `/leads/[id]` (**new**) | Task 6c | `getLead` |
| 29 | `export_leads` | GET `/leads/export` (exists) | Task 12 | `exportLeads` |
| 30 | `list_archetypes` | Static (no API, served from MCP) | Task 13 | N/A (handler returns static data) |
| 31 | `get_archetype_schema` | Static (no API, served from MCP) | Task 13 | N/A (handler returns static data) |
| 32 | `get_business_context` | GET `/content-pipeline/business-context` (exists) | Task 12 | `getBusinessContext` |
| 33 | `launch_lead_magnet` | POST `/lead-magnet/launch` (**new**) | Task 7 | `launchLeadMagnet` |
| 34 | `schedule_content_week` | POST `/content-pipeline/posts/schedule-week` (**new**) | Task 10 | `scheduleContentWeek` |
| 35 | `get_performance_insights` | GET `/analytics/performance-insights` (**new**) | Task 8 | `getPerformanceInsights` |
| 36 | `get_recommendations` | GET `/analytics/recommendations` (**new**) | Task 8 | `getRecommendations` |

**Account tool (supplementary):**
| `list_teams` | GET `/teams` (check if exists) | Task 9 | `listTeams` |

**Note:** `list_archetypes` and `get_archetype_schema` are served from static data within the MCP handler — they don't call API routes. The archetype Zod schemas and guidelines are bundled into the MCP package from Task 3.

---

## Chunk 1: Foundation — Database + Archetype Schemas

### Task 1: Create Feature Branch

**Files:**
- None (git only)

- [ ] **Step 1: Create feat branch from main**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git fetch origin
git checkout main
git pull origin main
git checkout -b feat/mcp-v2-agent-native
```

- [ ] **Step 2: Verify clean state**

Run: `git status`
Expected: On branch `feat/mcp-v2-agent-native`, clean working tree

---

### Task 2: Database Migration — Add content + content_version

**Files:**
- Create: `supabase/migrations/2026MMDD000000_add_lead_magnet_content_field.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add unified content field for agent-native MCP v2
-- Replaces the 3-layer pipeline (extracted_content, generated_content, polished_content)
-- Everything optional on create/update; archetype Zod schema validates at publish time

ALTER TABLE lead_magnets
  ADD COLUMN IF NOT EXISTS content JSONB,
  ADD COLUMN IF NOT EXISTS content_version INTEGER NOT NULL DEFAULT 1;

-- Index for content field queries
CREATE INDEX IF NOT EXISTS idx_lead_magnets_content_version
  ON lead_magnets (id, content_version);

COMMENT ON COLUMN lead_magnets.content IS 'Unified content field (MCP v2). Shape defined by archetype Zod schema. Replaces extracted_content/generated_content/polished_content pipeline.';
COMMENT ON COLUMN lead_magnets.content_version IS 'Optimistic locking version. Incremented on each content update.';
```

- [ ] **Step 2: Push migration**

Run: `pnpm db:push`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add content + content_version columns to lead_magnets"
```

---

### Task 3: Archetype Zod Schemas + Quality Guidelines

**Files:**
- Create: `src/lib/schemas/archetypes/index.ts`
- Create: `src/lib/schemas/archetypes/shared.ts`
- Create: `src/lib/schemas/archetypes/single-breakdown.ts`
- Create: `src/lib/schemas/archetypes/single-system.ts`
- Create: `src/lib/schemas/archetypes/focused-toolkit.ts`
- Create: `src/lib/schemas/archetypes/single-calculator.ts`
- Create: `src/lib/schemas/archetypes/focused-directory.ts`
- Create: `src/lib/schemas/archetypes/mini-training.ts`
- Create: `src/lib/schemas/archetypes/one-story.ts`
- Create: `src/lib/schemas/archetypes/prompt.ts`
- Create: `src/lib/schemas/archetypes/assessment.ts`
- Create: `src/lib/schemas/archetypes/workflow.ts`
- Test: `src/__tests__/lib/schemas/archetypes.test.ts`

Each archetype file exports: `publishSchema` (Zod), `guidelines` (string), `description` (string).

- [ ] **Step 1: Write test for archetype schema registry**

```typescript
// src/__tests__/lib/schemas/archetypes.test.ts
import { describe, it, expect } from '@jest/globals'
import {
  getArchetypeSchema,
  listArchetypes,
  ARCHETYPES,
} from '@/lib/schemas/archetypes'

describe('Archetype schemas', () => {
  it('has a schema for every archetype', () => {
    for (const archetype of ARCHETYPES) {
      const schema = getArchetypeSchema(archetype)
      expect(schema).toBeDefined()
      expect(schema.publishSchema).toBeDefined()
      expect(schema.guidelines).toBeTruthy()
      expect(schema.description).toBeTruthy()
    }
  })

  it('listArchetypes returns all 10 archetypes', () => {
    const list = listArchetypes()
    expect(list).toHaveLength(10)
    expect(list[0]).toHaveProperty('archetype')
    expect(list[0]).toHaveProperty('description')
  })

  it('single-breakdown publish schema validates correct content', () => {
    const schema = getArchetypeSchema('single-breakdown')
    const validContent = {
      headline: 'The 5-Step System for Agency Leads',
      problem_statement: 'Most agencies struggle to generate consistent inbound leads.',
      call_to_action: 'Get the full breakdown free',
      sections: [
        { title: 'Step 1: Audit', body: 'Start by auditing your current pipeline. Look at where leads are dropping off and identify the biggest gaps.' },
        { title: 'Step 2: Build', body: 'Build a content engine that runs on autopilot. The key is consistency over volume — three posts per week beats ten random ones.' },
        { title: 'Step 3: Convert', body: 'Set up a conversion path from content to lead magnet to call. Every post should have a clear next step for the reader.' },
      ],
    }
    const result = schema.publishSchema.safeParse(validContent)
    expect(result.success).toBe(true)
  })

  it('single-breakdown rejects content with too few sections', () => {
    const schema = getArchetypeSchema('single-breakdown')
    const invalidContent = {
      headline: 'Short Guide',
      problem_statement: 'A problem statement here.',
      call_to_action: 'Get it',
      sections: [
        { title: 'Only one', body: 'Not enough sections to make a breakdown useful for the reader.' },
      ],
    }
    const result = schema.publishSchema.safeParse(invalidContent)
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/__tests__/lib/schemas/archetypes.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write shared schema base**

```typescript
// src/lib/schemas/archetypes/shared.ts
/** Shared schema primitives for all archetypes. */
import { z } from 'zod'

export const sectionSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(50),
  key_insight: z.string().optional(),
})

export const baseContentSchema = z.object({
  headline: z.string().min(10).max(200),
  subheadline: z.string().optional(),
  problem_statement: z.string().min(20),
  proof_points: z.array(z.string()).optional(),
  call_to_action: z.string().min(5),
})
```

- [ ] **Step 4: Write single-breakdown archetype** (reference implementation)

```typescript
// src/lib/schemas/archetypes/single-breakdown.ts
/** Single Breakdown archetype. Deconstructs one process into clear steps. */
import { z } from 'zod'
import { baseContentSchema, sectionSchema } from './shared.js'

export const publishSchema = baseContentSchema.extend({
  sections: z.array(sectionSchema).min(3),
})

export const description = 'Deconstruct one process, framework, or system into clear, actionable steps.'

export const guidelines = `## Writing a Single Breakdown

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
- Front-loading credentials instead of leading with value`
```

- [ ] **Step 5: Write remaining 9 archetype files**

Each follows the same pattern: `publishSchema`, `description`, `guidelines`. The archetypes differ in their section requirements:

| Archetype | Key Schema Differences |
|-----------|----------------------|
| `single-system` | sections.min(3), each section has `component_name` + `how_it_connects` |
| `focused-toolkit` | `tools: z.array(toolSchema).min(3)` where tool has name, description, use_case |
| `single-calculator` | `inputs: z.array(inputSchema).min(1)`, `formula_description`, `output_format` |
| `focused-directory` | `resources: z.array(resourceSchema).min(5)` with name, url, description, category |
| `mini-training` | `lessons: z.array(lessonSchema).min(2)` with title, objective, content, exercise |
| `one-story` | `story_hook`, `narrative: string.min(200)`, `lesson`, `takeaway` |
| `prompt` | `prompts: z.array(promptSchema).min(3)` with title, prompt_text, example_output, when_to_use |
| `assessment` | `questions: z.array(questionSchema).min(5)`, `scoring_rubric`, `result_ranges` |
| `workflow` | `steps: z.array(stepSchema).min(3)` with trigger, action, tool, output |

- [ ] **Step 6: Write the registry index**

```typescript
// src/lib/schemas/archetypes/index.ts
/** Archetype schema registry. Maps archetype names to publish schemas + guidelines. */
import { z } from 'zod'
import * as singleBreakdown from './single-breakdown.js'
import * as singleSystem from './single-system.js'
import * as focusedToolkit from './focused-toolkit.js'
import * as singleCalculator from './single-calculator.js'
import * as focusedDirectory from './focused-directory.js'
import * as miniTraining from './mini-training.js'
import * as oneStory from './one-story.js'
import * as prompt from './prompt.js'
import * as assessment from './assessment.js'
import * as workflow from './workflow.js'

export const ARCHETYPES = [
  'single-breakdown', 'single-system', 'focused-toolkit', 'single-calculator',
  'focused-directory', 'mini-training', 'one-story', 'prompt', 'assessment', 'workflow',
] as const

export type Archetype = (typeof ARCHETYPES)[number]

type ArchetypeDefinition = {
  publishSchema: z.ZodType
  description: string
  guidelines: string
}

const registry: Record<Archetype, ArchetypeDefinition> = {
  'single-breakdown': singleBreakdown,
  'single-system': singleSystem,
  'focused-toolkit': focusedToolkit,
  'single-calculator': singleCalculator,
  'focused-directory': focusedDirectory,
  'mini-training': miniTraining,
  'one-story': oneStory,
  prompt,
  assessment,
  workflow,
}

export function getArchetypeSchema(archetype: Archetype): ArchetypeDefinition {
  return registry[archetype]
}

export function listArchetypes(): Array<{ archetype: Archetype; description: string }> {
  return ARCHETYPES.map((a) => ({ archetype: a, description: registry[a].description }))
}
```

- [ ] **Step 7: Run tests**

Run: `pnpm test -- src/__tests__/lib/schemas/archetypes.test.ts`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/schemas/archetypes/ src/__tests__/lib/schemas/
git commit -m "feat: add archetype Zod schemas + quality guidelines for all 10 archetypes"
```

---

### Task 4: Content Normalization Function

**Files:**
- Create: `src/lib/schemas/archetypes/normalize-legacy.ts`
- Test: `src/__tests__/lib/schemas/normalize-legacy.test.ts`

This function transforms legacy `polished_content` (PolishedSection[]) or `extracted_content` (ExtractedContent) into the new unified `content` shape.

- [ ] **Step 1: Write tests for normalization**

Test cases: (a) polished_content array → content object, (b) extracted_content object → content object, (c) null inputs → null, (d) already-new content field → passthrough.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/lib/schemas/normalize-legacy.test.ts`

- [ ] **Step 3: Implement normalization function**

Read existing `PolishedContent` and `ExtractedContent` types from `src/lib/types/lead-magnet.ts` to understand shapes. Map them to the new `LeadMagnetContent` shape.

- [ ] **Step 4: Run tests**

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/archetypes/normalize-legacy.ts src/__tests__/lib/schemas/
git commit -m "feat: add content normalization function for legacy field migration"
```

---

## Chunk 2: API Routes

### Task 5: PATCH /lead-magnet/[id] — Deep Merge Update

**Files:**
- Modify: `src/app/api/lead-magnet/[id]/route.ts` (add/update PATCH handler)
- Modify: `src/server/services/lead-magnets.service.ts` (add updateLeadMagnetContent)
- Modify: `src/server/repositories/lead-magnets.repo.ts` (add content update query)
- Test: `src/__tests__/api/lead-magnet/update-content.test.ts`

The PATCH handler implements the deep-merge semantics from the spec: shallow merge at top level, replace arrays, explicit null deletes, content_version optimistic locking.

- [ ] **Step 1: Write test for content deep-merge update**

Test cases:
1. Update headline only — other content fields untouched
2. Replace sections array — full replacement, not append
3. Explicit null removes a field
4. Optimistic locking — version mismatch returns 409 Conflict
5. Successful update increments content_version

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Add content update to repository**

Add `updateContent(id, userId, contentPatch, expectedVersion?)` to `lead-magnets.repo.ts`. Uses `jsonb_strip_nulls()` for null removal and explicit version check.

- [ ] **Step 4: Add content update to service**

Add `updateLeadMagnetContent(scope, id, contentPatch, expectedVersion?)` to `lead-magnets.service.ts`. Reads current content, applies shallow merge, saves.

- [ ] **Step 5: Add PATCH handler to route**

The PATCH handler in `src/app/api/lead-magnet/[id]/route.ts`: auth → parse body → call service → respond. Returns updated lead magnet with new content_version.

- [ ] **Step 6: Run tests**

Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/lead-magnet/ src/server/services/ src/server/repositories/ src/__tests__/
git commit -m "feat: add PATCH /lead-magnet/[id] with deep-merge content updates + optimistic locking"
```

---

### Task 5b: Enrich publish_funnel Error Messages

**Files:**
- Modify: `src/app/api/funnel/[id]/publish/route.ts`
- Modify: `src/server/services/funnels.service.ts` (publish validation)

The spec requires: "Error messages name exactly what's missing and which tool fixes it."

- [ ] **Step 1: Read current publish validation logic**

Check what the publish endpoint currently validates and what errors it returns.

- [ ] **Step 2: Update publish validation to return actionable errors**

When publish fails, the error response should include:
```json
{
  "error": "Cannot publish: content.sections is missing (need at least 3). Use update_lead_magnet to add sections.",
  "missing_fields": ["content.sections"],
  "suggested_tool": "update_lead_magnet",
  "archetype_schema_hint": "Call get_archetype_schema('single-breakdown') to see required fields."
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/funnel/ src/server/services/
git commit -m "feat: enrich publish_funnel error messages with missing fields and fix hints"
```

---

### Task 6: POST /content-pipeline/posts — Agent-Authored Content

**Files:**
- Modify: `src/app/api/content-pipeline/posts/route.ts` (add POST handler for direct content)
- Test: `src/__tests__/api/content-pipeline/create-post.test.ts`

The current post creation routes assume backend AI authorship. This adds a POST handler that accepts agent-authored post content directly: `body` (post text), optional `pillar`, `content_type`, `title`.

- [ ] **Step 1: Write test**

- [ ] **Step 2: Run test to verify failure**

- [ ] **Step 3: Implement POST handler**

Read the existing posts service/repo pattern. Add a creation path that inserts a post with status `draft`, the provided body text, and optional metadata — no AI generation.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add src/app/api/content-pipeline/posts/ src/__tests__/
git commit -m "feat: add POST /content-pipeline/posts for agent-authored content"
```

---

### Task 6b: PUT /email-sequence/[leadMagnetId] — Full Replace Semantics

**Files:**
- Modify: `src/app/api/email-sequence/[leadMagnetId]/route.ts` (add/update PUT handler)
- Modify: `src/server/services/email-sequence.service.ts`
- Test: `src/__tests__/api/email-sequence/save.test.ts`

The `save_email_sequence` MCP tool sends the full sequence as one PUT. The current endpoint may use partial updates or POST semantics — update to accept a full replacement payload: `{ subject_lines: string[], emails: { subject, body, delay_days }[], from_name, reply_to }`. PUT replaces the entire sequence.

- [ ] **Step 1: Read current email-sequence route and service**

Check existing handler shape and update semantics.

- [ ] **Step 2: Write test for PUT full-replace**

Test cases:
1. PUT replaces all emails — old emails removed, new ones saved
2. PUT with empty array clears the sequence
3. Returns the saved sequence

- [ ] **Step 3: Run test to verify failure**

- [ ] **Step 4: Implement PUT handler**

If the route already has PUT, update it to full-replace semantics (delete existing emails for lead magnet, insert new ones). If only POST exists, add PUT.

- [ ] **Step 5: Run tests**

- [ ] **Step 6: Commit**

```bash
git add src/app/api/email-sequence/ src/server/services/ src/__tests__/
git commit -m "feat: add PUT /email-sequence/[leadMagnetId] with full-replace semantics"
```

---

### Task 6c: GET /leads/[id] — Single Lead Detail

**Files:**
- Create: `src/app/api/leads/[id]/route.ts`
- Modify: `src/server/services/leads.service.ts` (add getLeadById if missing)
- Test: `src/__tests__/api/leads/get-lead.test.ts`

The `get_lead` MCP tool needs a single-lead endpoint. The existing GET `/leads` returns a list.

- [ ] **Step 1: Check if single-lead route exists**

Search for `src/app/api/leads/[id]/route.ts`. If it exists, verify it returns full lead detail.

- [ ] **Step 2: Write test**

Test cases:
1. Valid lead ID → returns full lead with opt_in_data, scraped_data, analysis_results
2. Non-existent ID → returns 404
3. Lead belonging to different user → returns 404 (scoped by auth)

- [ ] **Step 3: Run test to verify failure**

- [ ] **Step 4: Implement route**

Auth → parse ID param → call service → respond. Service queries with DataScope scoping.

- [ ] **Step 5: Run tests**

- [ ] **Step 6: Commit**

```bash
git add src/app/api/leads/ src/server/services/ src/__tests__/
git commit -m "feat: add GET /leads/[id] for single lead detail"
```

---

### Task 7: POST /lead-magnet/launch — Compound Action

**Files:**
- Create: `src/app/api/lead-magnet/launch/route.ts`
- Create: `src/server/services/launch-lead-magnet.service.ts`
- Test: `src/__tests__/api/lead-magnet/launch.test.ts`

Atomic operation: create lead magnet → create funnel → publish funnel. All-or-nothing with rollback on failure. Validates content against archetype publish schema before starting.

- [ ] **Step 1: Write test**

Test cases:
1. Happy path: valid content + slug → returns lead_magnet_id, funnel_id, public_url
2. Invalid content → fails with Zod validation error naming missing fields
3. With email_sequence → creates and activates email sequence too

- [ ] **Step 2: Run test to verify failure**

- [ ] **Step 3: Implement launch service**

Orchestrates: validate content schema → createLeadMagnet → createFunnel → publishFunnel. On any failure, attempt cleanup (delete created resources).

- [ ] **Step 4: Implement route handler**

Thin wrapper: auth → parse body → call launch service → respond.

- [ ] **Step 5: Run tests**

- [ ] **Step 6: Commit**

```bash
git add src/app/api/lead-magnet/launch/ src/server/services/launch-lead-magnet.service.ts src/__tests__/
git commit -m "feat: add POST /lead-magnet/launch compound action"
```

---

### Task 8: GET /analytics/performance-insights + GET /analytics/recommendations (stubs)

**Files:**
- Create: `src/app/api/analytics/performance-insights/route.ts`
- Create: `src/app/api/analytics/recommendations/route.ts`
- Test: `src/__tests__/api/analytics/insights.test.ts`

Phase 1 stubs using existing analytics tables. `performance-insights` aggregates from `lead_magnet_analytics` and `funnel_leads`. `recommendations` crosses knowledge coverage with analytics.

- [ ] **Step 1: Write tests**

- [ ] **Step 2: Implement performance-insights route**

Query `lead_magnet_analytics` for top archetypes by conversion, top lead magnets by leads. Group by archetype. Return the response shape from the spec.

- [ ] **Step 3: Implement recommendations route (stub)**

For Phase 1: query `cp_knowledge_topics` for coverage, combine with performance data. Return basic suggestions. Mark response with `{ phase: 'stub', note: 'Full intelligence in Phase 4' }`.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analytics/ src/__tests__/
git commit -m "feat: add performance insights + recommendations API routes (Phase 1 stubs)"
```

---

### Task 9: GET /teams Route

**Files:**
- Check if `src/app/api/teams/route.ts` exists. If not, create it.
- Test: `src/__tests__/api/teams/list.test.ts`

Returns teams the current user belongs to, with IDs for use as `team_id` parameter.

- [ ] **Step 1: Check if teams route exists**

Search for existing teams API route. If it exists, verify it returns team IDs.

- [ ] **Step 2: Write test + implement if needed**

- [ ] **Step 3: Commit**

```bash
git add src/app/api/teams/ src/__tests__/
git commit -m "feat: add GET /teams route for MCP team discovery"
```

---

### Task 10: POST /content-pipeline/posts/schedule-week — Compound Action

**Files:**
- Create: `src/app/api/content-pipeline/posts/schedule-week/route.ts`
- Test: `src/__tests__/api/content-pipeline/schedule-week.test.ts`

Accepts array of posts with full content + optional scheduling preferences. Creates all posts and distributes them across the user's posting slots.

- [ ] **Step 1: Write test**

- [ ] **Step 2: Implement route**

Read existing posting slots for the user. Distribute posts across available slots for the upcoming week. Create each post with `scheduled` status.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add src/app/api/content-pipeline/posts/schedule-week/ src/__tests__/
git commit -m "feat: add POST /content-pipeline/posts/schedule-week compound action"
```

---

## Chunk 3: MCP Server Rewrite

### Task 11: Rewrite MCP Constants + Types

**Files:**
- Modify: `packages/mcp/src/constants.ts`

Update constants to match the v2 tool surface. Remove unused enums, add new ones.

- [ ] **Step 1: Update constants**

Keep: ARCHETYPES, FUNNEL_THEMES, BACKGROUND_STYLES, PIPELINE_POST_STATUS, KNOWLEDGE_CATEGORIES, KNOWLEDGE_TYPES, READINESS_GOALS, CONTENT_PILLARS, CONTENT_TYPES.
Remove: LEAD_MAGNET_STATUS (wizard stages like 'extracting', 'generating' are gone — simplify to draft/published/archived), EXTRACT_CONTENT_TYPES, SWIPE_FILE_POST_TYPES.
Add: LEAD_MAGNET_STATUS_V2 = ['draft', 'published', 'archived'].

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/constants.ts
git commit -m "feat(mcp): update constants for v2 tool surface"
```

---

### Task 12: Rewrite MCP Client

**Files:**
- Modify: `packages/mcp/src/client.ts`

Gut the client. Remove all AI generation methods. Add new methods matching the 36 tools. Keep the request/aiRequest infrastructure.

- [ ] **Step 1: Rewrite client methods**

Remove: `ideateLeadMagnets`, `extractContent`, `generateContent`, `writeLinkedInPosts`, `polishLeadMagnetContent`, `analyzeCompetitor`, `analyzeTranscript`, `importLeadMagnet`, `generateFunnelContent`, `generateEmailSequence`, `quickWritePost`, `writePostFromIdea`, `polishPost`, `extractWritingStyle`, `matchTemplate`, `generatePlan`, `approvePlan`, `triggerAutopilot`, `extractBusinessContext`, `generateFlowEmails`, all swipe file methods, all library methods, all qualification form methods, all email flow/broadcast/subscriber methods.

Keep (maps to spec tools): `listLeadMagnets`, `getLeadMagnet`, `createLeadMagnet`, `deleteLeadMagnet`, `listFunnels`, `getFunnel`, `createFunnel`, `updateFunnel`, `deleteFunnel`, `publishFunnel`, `unpublishFunnel`, `listLeads`, `exportLeads`, `searchKnowledge`, `getKnowledgeClusters`, `askKnowledge`, `submitTranscript`, `listPosts`, `getPost`, `updatePost`, `deletePost`, `getEmailSequence`, `activateEmailSequence`, `getBusinessContext`.

**Remove** (not in 36-tool spec): `listTranscripts`, `listPostingSlots`, `getJobStatus`, `getFunnelByTarget`, `updateEmailSequence` (replaced by `saveEmailSequence`).

Add: `updateLeadMagnetContent` (PATCH with deep merge), `createPost` (agent-authored), `publishPost`, `getLead`, `saveEmailSequence` (PUT full-replace), `browseKnowledge`, `launchLeadMagnet` (compound), `scheduleContentWeek` (compound), `getPerformanceInsights`, `getRecommendations`, `listTeams`.

**Note:** `listArchetypes` and `getArchetypeSchema` are served from static data within handlers — no client method needed.

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/client.ts
git commit -m "feat(mcp): rewrite client for 36 direct tools"
```

---

### Task 13: Rewrite MCP Tool Definitions

**Files:**
- Rewrite: `packages/mcp/src/tools/index.ts`
- Rewrite: `packages/mcp/src/tools/lead-magnets.ts`
- Rewrite: `packages/mcp/src/tools/funnels.ts`
- Rewrite: `packages/mcp/src/tools/knowledge.ts` (rename from content-pipeline, knowledge subset)
- Rewrite: `packages/mcp/src/tools/posts.ts` (new, content posts subset)
- Rewrite: `packages/mcp/src/tools/email.ts` (rename from email-sequences, simplified)
- Rewrite: `packages/mcp/src/tools/leads.ts`
- Create: `packages/mcp/src/tools/schema.ts` (archetype schema + context tools)
- Create: `packages/mcp/src/tools/compound.ts` (launch_lead_magnet, schedule_content_week)
- Create: `packages/mcp/src/tools/feedback.ts` (performance_insights, recommendations)
- Create: `packages/mcp/src/tools/account.ts` (list_teams)
- Delete: `packages/mcp/src/tools/category-tools.ts`
- Delete: `packages/mcp/src/tools/ideation.ts`
- Delete: `packages/mcp/src/tools/brand-kit.ts`
- Delete: `packages/mcp/src/tools/email-sequences.ts`
- Delete: `packages/mcp/src/tools/email-system.ts`
- Delete: `packages/mcp/src/tools/content-pipeline.ts`
- Delete: `packages/mcp/src/tools/swipe-file.ts`
- Delete: `packages/mcp/src/tools/libraries.ts`
- Delete: `packages/mcp/src/tools/qualification-forms.ts`
- Delete: `packages/mcp/src/tools/analytics.ts`

All 36 tools registered directly with full inputSchema. No execute gateway, no category tools.

Every tool includes an optional `team_id` parameter in its schema:
```typescript
team_id: { type: 'string', description: 'Team ID to scope this operation. Omit for primary team.' }
```

- [ ] **Step 1: Write tool definitions for each domain**

Each tool file exports a `Tool[]` array. The index aggregates all arrays into one flat list. No discovery categories, no category-to-key mapping.

- [ ] **Step 2: Write index.ts**

```typescript
// packages/mcp/src/tools/index.ts
import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { leadMagnetTools } from './lead-magnets.js'
import { funnelTools } from './funnels.js'
import { knowledgeTools } from './knowledge.js'
import { postTools } from './posts.js'
import { emailTools } from './email.js'
import { leadTools } from './leads.js'
import { schemaTools } from './schema.js'
import { compoundTools } from './compound.js'
import { feedbackTools } from './feedback.js'
import { accountTools } from './account.js'

export const tools: Tool[] = [
  ...leadMagnetTools,
  ...funnelTools,
  ...knowledgeTools,
  ...postTools,
  ...emailTools,
  ...leadTools,
  ...schemaTools,
  ...compoundTools,
  ...feedbackTools,
  ...accountTools,
]

export const toolsByName = new Map<string, Tool>(tools.map((t) => [t.name, t]))
```

- [ ] **Step 3: Delete old tool files**

Remove: category-tools.ts, ideation.ts, brand-kit.ts, email-sequences.ts, email-system.ts, content-pipeline.ts, swipe-file.ts, libraries.ts, qualification-forms.ts, analytics.ts.

- [ ] **Step 4: Commit**

```bash
git add packages/mcp/src/tools/
git commit -m "feat(mcp): rewrite tool definitions — 36 direct tools, no gateway"
```

---

### Task 14: Rewrite MCP Validation

**Files:**
- Rewrite: `packages/mcp/src/validation.ts`

New Zod schemas for all 36 tools. No passthrough — every tool has a schema.

- [ ] **Step 1: Write validation schemas for all 36 tools**

Group by domain. Each tool has a named schema in the `toolSchemas` record.

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/validation.ts
git commit -m "feat(mcp): rewrite validation schemas for 36 tools"
```

---

### Task 15: Rewrite MCP Handlers

**Files:**
- Rewrite: `packages/mcp/src/handlers/index.ts`
- Rewrite: `packages/mcp/src/handlers/lead-magnets.ts`
- Rewrite: `packages/mcp/src/handlers/funnels.ts`
- Create: `packages/mcp/src/handlers/knowledge.ts`
- Create: `packages/mcp/src/handlers/posts.ts`
- Create: `packages/mcp/src/handlers/email.ts`
- Rewrite: `packages/mcp/src/handlers/leads.ts`
- Create: `packages/mcp/src/handlers/schema.ts`
- Create: `packages/mcp/src/handlers/compound.ts`
- Create: `packages/mcp/src/handlers/feedback.ts`
- Create: `packages/mcp/src/handlers/account.ts`
- Delete: `packages/mcp/src/handlers/ideation.ts`
- Delete: `packages/mcp/src/handlers/brand-kit.ts`
- Delete: `packages/mcp/src/handlers/email-sequences.ts`
- Delete: `packages/mcp/src/handlers/email-system.ts`
- Delete: `packages/mcp/src/handlers/content-pipeline.ts`
- Delete: `packages/mcp/src/handlers/swipe-file.ts`
- Delete: `packages/mcp/src/handlers/libraries.ts`
- Delete: `packages/mcp/src/handlers/qualification-forms.ts`
- Delete: `packages/mcp/src/handlers/analytics.ts`
- Delete: `packages/mcp/src/handlers/signals.ts` (if exists)

The dispatcher (`index.ts`) routes by tool name to the correct handler. Each handler is a simple switch statement calling client methods.

- [ ] **Step 1: Rewrite dispatcher**

```typescript
// packages/mcp/src/handlers/index.ts
import { MagnetLabClient } from '../client.js'
import { validateToolArgs } from '../validation.js'
// ... handler imports

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
}

// Map tool name prefixes to handler functions
const handlers: Array<{ prefix: string; handler: (name: string, args: Record<string, unknown>, client: MagnetLabClient) => Promise<unknown> }> = [
  { prefix: 'list_lead_magnets', handler: handleLeadMagnetTools },
  // ... all 36 tools mapped to their handlers
]

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<ToolResult> {
  // validate → route → format response (same pattern, cleaner routing)
}
```

- [ ] **Step 2: Write each handler file**

Same switch pattern as before, but much fewer cases per file.

- [ ] **Step 3: Delete old handler files**

- [ ] **Step 4: Commit**

```bash
git add packages/mcp/src/handlers/
git commit -m "feat(mcp): rewrite handlers for 36 direct tools"
```

---

### Task 16: Rewrite MCP Server Entry Point

**Files:**
- Rewrite: `packages/mcp/src/index.ts`

Register all 36 tools directly. No category tools, no execute gateway, no tool_help, no guide tool. Clean and simple.

- [ ] **Step 1: Rewrite server**

```typescript
// packages/mcp/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { Command } from 'commander'
import { MagnetLabClient } from './client.js'
import { tools } from './tools/index.js'
import { handleToolCall } from './handlers/index.js'

const VERSION = '2.0.0'

export * from './constants.js'
export { MagnetLabClient } from './client.js'

async function startServer(apiKey: string, baseUrl: string | undefined) {
  const client = new MagnetLabClient(apiKey, { baseUrl })

  const server = new Server(
    { name: 'magnetlab', version: VERSION },
    { capabilities: { tools: {} } }
  )

  // Register all 36 tools directly — no indirection
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    return handleToolCall(name, args as Record<string, unknown> || {}, client)
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// ... CLI setup (same pattern)
```

- [ ] **Step 2: Update version in package.json to 2.0.0**

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/index.ts packages/mcp/package.json
git commit -m "feat(mcp): v2.0.0 — 36 direct tools, no gateway"
```

---

## Chunk 4: Tests + Verification

### Task 17: Rewrite MCP Tests + Deep-Merge & Per-Archetype Tests

**Files:**
- Rewrite: `packages/mcp/src/__tests__/tools.test.ts`
- Rewrite: `packages/mcp/src/__tests__/validation.test.ts`
- Rewrite: `packages/mcp/src/__tests__/client.test.ts`
- Rewrite: `packages/mcp/src/__tests__/handlers.test.ts`
- Add: `src/__tests__/lib/schemas/archetypes-all.test.ts` (per-archetype validation)
- Add: `src/__tests__/server/services/deep-merge.test.ts` (deep-merge unit tests)

- [ ] **Step 1: Rewrite tools.test.ts**

Verify: exactly 36 tools (+1 `list_teams` supplementary = 37), all unique names, all prefixed with `magnetlab_`, all have inputSchema, no category tools, no execute gateway, no tool_help.

- [ ] **Step 2: Rewrite validation.test.ts**

Test every tool schema: valid input passes, required fields enforced, enum values validated.

- [ ] **Step 3: Rewrite client.test.ts**

Test all new client methods: updateLeadMagnetContent, createPost, publishPost, getLead, saveEmailSequence, launchLeadMagnet, scheduleContentWeek, getPerformanceInsights, getRecommendations, listTeams, browseKnowledge.

- [ ] **Step 4: Rewrite handlers.test.ts**

Test routing for all 36 tools.

- [ ] **Step 5: Per-archetype publish schema validation tests**

Test every archetype (not just single-breakdown). For each of the 10 archetypes:
1. Valid content passes publishSchema.safeParse()
2. Missing required fields fails with descriptive error
3. Content below minimum thresholds (e.g., too few sections, short body text) fails

```typescript
// src/__tests__/lib/schemas/archetypes-all.test.ts
import { ARCHETYPES, getArchetypeSchema } from '@/lib/schemas/archetypes'

describe('All archetype publish schemas', () => {
  for (const archetype of ARCHETYPES) {
    describe(archetype, () => {
      it('rejects empty content', () => {
        const { publishSchema } = getArchetypeSchema(archetype)
        const result = publishSchema.safeParse({})
        expect(result.success).toBe(false)
      })
      // ... archetype-specific valid/invalid content tests
    })
  }
})
```

- [ ] **Step 6: Deep-merge unit tests**

Test the deep-merge logic from Task 5's service independently:
1. Shallow merge at top level — new keys added, existing keys updated
2. Array replacement — new array replaces old, not appended
3. Explicit null deletes — `{ key: null }` removes key from content
4. Nested object merge — only top-level is shallow; nested objects are replaced
5. Empty patch — returns original content unchanged
6. Optimistic locking — version mismatch throws ConflictError

```typescript
// src/__tests__/server/services/deep-merge.test.ts
import { applyContentPatch } from '@/server/services/lead-magnets.service'

describe('applyContentPatch (deep-merge)', () => {
  it('shallow-merges top-level scalars', () => { ... })
  it('replaces arrays entirely', () => { ... })
  it('removes keys set to null', () => { ... })
  it('returns original when patch is empty', () => { ... })
})
```

- [ ] **Step 7: Run full test suite**

Run: `cd packages/mcp && pnpm test` and `pnpm test`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add packages/mcp/src/__tests__/ src/__tests__/
git commit -m "test(mcp): rewrite test suite for v2 — 36 tools + per-archetype + deep-merge"
```

---

### Task 18: Build Verification + Typecheck

**Files:** None (verification only)

- [ ] **Step 1: Build MCP package**

Run: `cd packages/mcp && pnpm build`
Expected: Clean compilation, no errors

- [ ] **Step 2: Typecheck main app**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Run main app tests**

Run: `pnpm test`
Expected: All tests pass (including new API route tests from Tasks 5-10)

- [ ] **Step 4: Run MCP tests**

Run: `cd packages/mcp && pnpm test`
Expected: All tests pass

---

### Task 19: Update MCP Config + Documentation

**Files:**
- Modify: `.mcp.json` (if it references old tool names)
- Modify: `CLAUDE.md` (add MCP v2 section)

- [ ] **Step 1: Check .mcp.json**

Read `.mcp.json` to see if it needs updating for the new MCP server.

- [ ] **Step 2: Add MCP v2 section to CLAUDE.md**

Document the 36 tools, the agent-native philosophy, and the key API routes.

- [ ] **Step 3: Final commit**

```bash
git add .mcp.json CLAUDE.md
git commit -m "docs: update MCP config and CLAUDE.md for v2"
```

---

## Task Dependency Summary

```
Task 1 (branch)
  ↓
Task 2 (db migration)
  ↓
Task 3 (archetype schemas) ──→ Task 4 (normalization)
  ↓                                ↓
Task 5 (update API) ←─────────────┘
  ↓
  ├─ Task 5b (publish error enrichment) ─ depends on Task 3 schemas
  ├─ Task 6 (create_post) ─────────────── independent
  ├─ Task 6b (save_email_sequence PUT) ── independent
  ├─ Task 6c (get_lead) ─────────────── independent
  ├─ Task 7 (launch compound) ─────────── depends on Task 5 (update) + Task 3 (schemas)
  ├─ Task 8 (insights stubs) ──────────── independent
  ├─ Task 9 (teams) ───────────────────── independent
  └─ Task 10 (schedule_week) ──────────── depends on Task 6 (create_post)
  ↓ (all above complete)
Tasks 11-16 (MCP rewrite) — sequential, each builds on prior
  ↓
Tasks 17-18 (tests + verification)
  ↓
Task 19 (docs)
```

**Parallelizable tasks:** Tasks 5b, 6, 6b, 6c, 8, 9 are independent and can run in parallel. Task 7 needs Tasks 3+5. Task 10 needs Task 6.

**Sequential tasks:** Tasks 11 → 12 → 13 → 14 → 15 → 16 must be done in order (each depends on prior MCP changes).
