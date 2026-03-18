# Unified Asset Review Queue

**Date:** 2026-03-18
**Status:** Draft
**Repo:** magnetlab

## Problem

The content queue currently only shows posts. DFY clients also receive AI-generated lead magnets and funnels that need human review before delivery. Operators must log into each client's magnetlab account to review these assets individually. There is no cross-team view of lead magnets and funnels needing attention.

## Goal

Extend the content queue to show all DFY asset types — posts, lead magnets, and funnels — in one unified review interface. Operators see all assets needing review per client, edit them using magnetlab's existing editors, mark them reviewed, and submit in two groups: posts (batch) and assets (lead magnets + funnels paired).

## Design Principles

**Reuse existing editors.** The content queue does not build new editing UIs for lead magnets or funnels. It provides a cross-team queue and navigation to magnetlab's existing lead magnet editor and funnel builder. Those editors already support full creative review (copy, branding, sections, qualification questions).

**Agent-ready by default.** All new endpoints are callable by both human operators (via UI) and AI agents (via MCP/API). Agents can edit assets via existing MCP tools (`magnetlab_update_lead_magnet`, `magnetlab_restyle_funnel`) then mark them reviewed via new review endpoints.

**Scale to N assets per client.** Clients on retainer may receive new lead magnets periodically. The queue handles any number of lead magnets + funnels per client, not just one of each.

## Page Structure

### Queue View (landing)

Same as current content queue, but each client card shows progress across three asset groups:

- **Posts:** "15 posts · 3 edited" with progress bar
- **Lead Magnets:** "2 lead magnets · 1 reviewed" or "Lead Magnet ✓"
- **Funnels:** "2 funnels · 1 reviewed" or "Funnel ✓"

Two submit buttons appear when groups are complete:
- "Submit Posts" — when all posts have `edited_at` set
- "Submit Assets" — when all lead magnets and funnels have `reviewed_at` set

Clients with no lead magnets or funnels just show posts (graceful degradation).

### Asset Picker (per-client review view)

Clicking "Review" on a client card opens the asset picker — an intermediate view showing all three asset sections:

**Posts section:** Post count, edited count, progress bar, "Edit Posts →" button. Opens the existing 3-column post editor.

**Lead Magnets section:** List of lead magnets with title, archetype badge, creation date, review status. Each has:
- "needs review" or "✓ reviewed" badge
- "Open Editor →" button — navigates to `/magnets/[id]` with team context cookie set
- "Mark Reviewed" button — sets `reviewed_at` after the operator has edited in the existing editor

**Funnels section:** List of funnels paired with their lead magnets. Each has:
- Title, published URL, review status badge
- "Open Builder →" button — navigates to `/magnets/[id]/funnel` with team context cookie set
- "Mark Reviewed" button

**Submit actions** at the bottom:
- "Submit Posts" (disabled until all posts edited)
- "Submit Assets" (disabled until all lead magnets + funnels reviewed)

### Navigation Flow

```
Queue View
  → click "Review" → Asset Picker (per client)
    → "Edit Posts →" → EditingView (existing 3-column post editor)
    → "Review Lead Magnet →" → /magnets/[id] (existing editor, team context set)
    → "Review Funnel →" → /magnets/[id]?tab=funnel (same page, funnel tab, team context set)
    → Back from any editor → Asset Picker
    → "Mark Reviewed" on each asset
    → Submit Posts / Submit Assets
```

Note: The lead magnet editor and funnel builder are the same page (`/magnets/[id]`) with a tab selector. "Review Lead Magnet" opens the content tab; "Review Funnel" opens the funnel tab. Both buttons navigate to the same page — this is intentional, as the operator may want to jump directly to the funnel without scrolling through content first.

### Team Context Switching

When the operator clicks "Open Editor" or "Open Builder", the frontend sets the `ml-team-context` cookie to the client's team ID before navigating. This ensures the existing editors load scoped to the correct client team. The content queue already knows the team ID — it just sets the cookie before `router.push()`.

## Data Model

### Schema Changes

Two new columns on existing tables:

```sql
ALTER TABLE lead_magnets ADD COLUMN reviewed_at timestamptz;
ALTER TABLE funnel_pages ADD COLUMN reviewed_at timestamptz;
```

- `null` = not yet reviewed by an operator
- Timestamp = when the operator marked it reviewed
- Reset to `null` if client requests revisions (same pattern as `edited_at` on posts)

### No New Tables

All data already exists:
- `lead_magnets` — has `team_id`, `title`, `archetype`, `status`, `created_at`
- `funnel_pages` — has `lead_magnet_id`, `slug`, `is_published`, `custom_domain`, `team_id`, `target_type`

Note: `funnel_pages` has NO `published_url` column — the URL is computed from `slug` + `is_published` + the user's username. The API response should compute this or return the constituent fields.

Note: A lead magnet can have multiple funnel pages (the UNIQUE constraint on `lead_magnet_id` was dropped). The response uses an array `funnels: Array<...>` not a single object.

### Cross-Team Query

Extend the existing content queue query to also fetch:
1. `lead_magnets` where `team_id IN (accessible team IDs)` and `status IN ('draft', 'published')` — include all non-archived lead magnets
2. `funnel_pages` where `lead_magnet_id` matches and `target_type = 'lead_magnet'` — only funnel pages created for lead magnets, not library or external resource funnels
3. If a lead magnet has no funnel pages, it still appears in the queue (funnel is optional — operator can create one later)

Group by team, same as posts.

## API Design

### `GET /api/content-queue` (extended response)

Add `lead_magnets` array to each team in the response:

```typescript
{
  teams: Array<{
    // ...existing post fields...
    lead_magnets: Array<{
      id: string;
      title: string;
      archetype: string;
      status: string;
      reviewed_at: string | null;
      created_at: string;
      funnels: Array<{
        id: string;
        slug: string;
        is_published: boolean;
        reviewed_at: string | null;
      }>;
    }>;
    lm_reviewed_count: number;
    lm_total_count: number;
    funnel_reviewed_count: number;
    funnel_total_count: number;
  }>;
  summary: {
    total_teams: number;
    total_posts: number;
    total_lead_magnets: number;
    total_funnels: number;
    remaining: number;
  };
}
```

Each lead magnet carries its funnels as an array (a lead magnet can have multiple funnel pages). Lead magnets with no funnels have an empty array.

### `PATCH /api/content-queue/lead-magnets/[id]/review`

Mark a lead magnet as reviewed.

- **Auth:** Regular session + validates operator has team membership for the lead magnet's team
- **Body:** `{ reviewed: true }` (or `{ reviewed: false }` to unmark)
- **Behavior:** Sets `reviewed_at = now()` (or null if unmarking)
- **Response:** `{ success: true }`

### `PATCH /api/content-queue/funnels/[id]/review`

Mark a funnel as reviewed. Same pattern as lead magnet review.

### `POST /api/content-queue/submit` (extended)

Add `submit_type` to distinguish post submission from asset submission:

- **Body:** `{ team_id: string, submit_type: 'posts' | 'assets' }`
- **Posts submission** (`submit_type: 'posts'`): existing behavior — validates all posts edited, fires DFY callback with `automation_type: 'content_editing'`
- **Assets submission** (`submit_type: 'assets'`): validates all lead magnets have `reviewed_at IS NOT NULL` AND all existing funnels (for those lead magnets) have `reviewed_at IS NOT NULL`. Lead magnets with no funnels only require the lead magnet review. Fires DFY callback with `automation_type: 'asset_review'`

### `POST /api/external/reset-reviewed-assets` (new)

Called by gtm-api when a client requests revisions on assets. Resets `reviewed_at = null` on lead magnets + funnels for the given user's team. Same auth pattern as `reset-edited-posts`.

- **Auth:** External API Bearer token
- **Body:** `{ userId: string }`
- **Response:** `{ reset_count: number }`

### MCP Tools (3 new)

- `magnetlab_review_lead_magnet` — `{ lead_magnet_id, reviewed: boolean }`
- `magnetlab_review_funnel` — `{ funnel_id, reviewed: boolean }`
- `magnetlab_submit_asset_review` — `{ team_id }` (calls submit with `submit_type: 'assets'`)

## Frontend Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/components/content-queue/AssetPicker.tsx` | Per-client asset review view (posts + lead magnets + funnels sections) |
| `src/app/api/content-queue/lead-magnets/[id]/review/route.ts` | PATCH handler for lead magnet review |
| `src/app/api/content-queue/funnels/[id]/review/route.ts` | PATCH handler for funnel review |
| `src/app/api/external/reset-reviewed-assets/route.ts` | External API for revision flow |

### Modified Files

| File | Change |
|------|--------|
| `src/components/content-queue/ContentQueuePage.tsx` | Add asset picker state between queue and post editor |
| `src/components/content-queue/ClientCard.tsx` | Show lead magnet + funnel progress |
| `src/components/content-queue/QueueView.tsx` | Pass lead magnet/funnel data to client cards |
| `src/frontend/api/content-queue.ts` | Add review + submit types |
| `src/frontend/hooks/api/useContentQueue.ts` | Extended types |
| `src/server/services/content-queue.service.ts` | Add lead magnet/funnel queries, review methods |
| `src/server/repositories/content-queue.repo.ts` | Add lead magnet/funnel query functions |
| `src/lib/validations/content-queue.ts` | Add review + extended submit schemas |

### State Management

`ContentQueuePage` manages three states:
1. **Queue view** — `editingTeamId = null`
2. **Asset picker** — `editingTeamId` is set, `editingMode = null`
3. **Post editor** — `editingTeamId` is set, `editingMode = 'posts'`

Lead magnet and funnel editing don't need a state — they navigate to existing pages via `router.push()`.

### Edit Capture

Lead magnets and funnels edited in existing editors already trigger `captureAndClassifyEdit` through their existing update paths. No additional edit capture wiring needed.

## Pipeline Integration

### Submit Assets Flow

When operator clicks "Submit Assets":

1. Validate all lead magnets + funnels for the team have `reviewed_at IS NOT NULL`
2. Fire awaited callback to gtm-api: `POST /api/dfy/callbacks/automation-complete` with `automation_type: 'asset_review'`, `status: 'completed'`, `result: { lead_magnets_reviewed: N, funnels_reviewed: N }`
3. gtm-api updates engagement (separate from content_stage — asset review may track differently)
4. Surface success/failure to operator

### Revision Flow

Same pattern as posts: gtm-api calls `POST /api/external/reset-reviewed-assets` with `{ userId }`. Magnetlab resets `reviewed_at = null` on all lead magnets + funnels for that user's team.

## Coordination Notes

- **DFY callback type:** `automation_type: 'asset_review'` needs to be added to `DfyCallbackPayload` in `@mas/types`, alongside `'content_editing'` from the content queue spec.
- **Submit backward compatibility:** The existing `POST /api/content-queue/submit` currently accepts `{ team_id }` without `submit_type`. Default `submit_type` to `'posts'` for backward compatibility — existing callers (including the MCP tool) don't break.

## Testing

| Layer | What | Tests |
|-------|------|-------|
| Schema | Zod schemas for review body, extended submit body | 2 test files |
| API routes | Lead magnet review (auth, team validation, happy path), funnel review, extended submit | 3 route test files |
| Component | AssetPicker renders sections, disabled submit buttons, reviewed badges | 1 component test |
| Extended GET | Queue response includes lead magnets + funnels with counts | Update existing test |

## Not In Scope

- New editing UIs for lead magnets or funnels (existing editors reused)
- Thumbnail/preview images in the asset picker cards
- Automatic review detection (e.g., "mark reviewed if operator spent time in editor")
- Edit capture changes for funnels (visual edits don't feed voice/style learning)
- Funnel analytics or performance data in the queue
