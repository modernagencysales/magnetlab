# DFY Content Queue

**Date:** 2026-03-17
**Status:** Draft
**Repo:** magnetlab

## Problem

The DFY pipeline's content track reaches `editing` stage when AI-generated posts are ready for human polish. Currently, the operator must log into each client's magnetlab account individually to edit their posts. With 5-10+ DFY clients, this is slow and context-switching-heavy. There is no cross-account view of content needing attention.

## Goal

A new magnetlab dashboard page that lets an operator edit content across all teams they belong to — DFY clients, agency clients, or their own team — in one fast, focused interface. The feature is team-membership-driven, not DFY-specific. The DFY pipeline integration is a side effect that fires when applicable, not a gating condition.

## Design Principles

**Team-membership-driven, not role-driven.** The content queue shows draft posts across all teams the user belongs to. It doesn't care *why* the user has access — DFY operator, agency owner, team reviewer. The page works the same for all. DFY callback on batch submit fires only when an active DFY engagement exists for that team's owner.

**Agent-ready by default.** Every API endpoint in the content queue must be callable by both a human editor (via the UI) and an AI agent (via MCP or direct API). No endpoint should require browser-specific context (cookies, CSRF) for its core operation — session auth for the UI, API key auth for agents. This means an AI proofreading agent can use the same `GET /api/content-queue` → `PATCH /api/content-queue/posts/[id]` → `POST /api/content-queue/submit` flow as a human editor. The content queue endpoints should be added to the MCP tool registry as part of this feature.

## Dependency

Team-to-team access (adding an entire team as members of another team) is being built separately (teams v3 redesign). This feature assumes that mechanism exists — operators' teams get added to client teams, giving every team member cross-team access.

## Page Structure

### Route

`/(dashboard)/content-queue`

### Two States

**Queue view (landing):**

- Vertical list of client cards, one per team with draft posts
- Each card: client avatar/initials, name, company, post count, edited count, progress bar
- "Edit" button on cards with unedited posts, "Submit for Review" on fully-edited cards
- Header: total stats ("4 clients · 23 posts · 9 remaining")
- Sorted: teams with most unedited posts first

**Editing view (after clicking Edit):**

- Full-width layout — sidebar nav collapses
- Three-column layout:
  - **Left (200px):** Post navigation list — numbered posts with status dots (green = edited, amber = in progress, grey = unedited). Click to jump.
  - **Center (flex):** LinkedIn-rendered post preview with inline TipTap editing. Dashed border indicates editable area. Image upload drop zone below post text. Feed Preview toggle shows hook + image as it appears in the LinkedIn feed (truncated at ~3 lines with "...see more").
  - **Right (260px, collapsible):** Context panel. Writing style notes always visible (2-4 bullet points). Collapsible accordions for: Content Brief (from `cp_content_ideas`), ICP & Audience (from intake data or team profile), All Posts Overview (titles of other posts in batch for variety checking).
- Top bar: client name, "Post 3 of 8" with prev/next arrows, content type + topic label, "Mark Edited" button, "Back to Queue" button
- When all posts edited: "Submit Batch for Review" appears in top bar

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑/↓` or `J/K` | Previous/next post (when not in text editor) |
| `⌘+Enter` | Mark edited + advance to next unedited |
| `P` | Toggle feed preview mode |
| `Esc` | Back to queue view |

### Feed Preview Mode

Toggle that collapses the post to show exactly what appears in the LinkedIn feed:

- First ~3 lines of text (the hook)
- "...see more" truncation indicator
- Full-width image below (if attached)
- LinkedIn engagement bar (Like, Comment, Repost, Send)

Click anywhere or press `P` to return to full edit mode. Purpose: let the editor assess first impressions — is the hook strong? Does the image work with the text?

### Image Support

- Drag-and-drop or click-to-upload zone below post text
- Reuses existing magnetlab image upload infrastructure
- Recommended dimensions shown (1200×1200)
- Image displays in both full edit mode and feed preview mode

## Data Model

### Schema Change

One new column on `cp_pipeline_posts`:

```sql
ALTER TABLE cp_pipeline_posts ADD COLUMN edited_at timestamptz;
```

- `null` = not yet edited by an operator (or not in a queue workflow)
- Timestamp = when the operator marked it edited
- Reset to `null` if client requests revisions (`content_stage` returns to `'revising'`)
- Gives chronological ordering for free

### No New Tables

All data already exists:

- `cp_pipeline_posts` — posts with `team_profile_id`, `status`, `draft_content`, `final_content`
- `cp_writing_styles` — team-scoped writing style notes
- `cp_content_ideas` — linked via `idea_id` on posts, provides content brief

### Cross-Team Query

The content queue needs posts across multiple teams:

1. Resolve all team IDs via `getMergedMemberships(userId)` (existing function)
2. Get active `team_profile_id` values for those teams
3. Query `cp_pipeline_posts` where `team_profile_id IN (...)` AND `status = 'draft'`
4. Group by team for the client-card UI

### What Shows in the Queue

All `draft` status posts across teams the user belongs to. The `edited_at` field tracks the operator's progress. Posts that aren't drafts (already scheduled, published, etc.) don't appear.

## API Design

### `GET /api/content-queue`

List queue items grouped by team.

- **Auth:** Regular session (operator is logged in to their own account)
- **Query:** Resolves all team memberships, fetches draft posts across those teams
- **Response:**

```typescript
{
  teams: Array<{
    team_id: string;
    team_name: string;
    profile_name: string;
    profile_company: string;
    posts: Array<{
      id: string;
      draft_content: string;
      idea_id: string | null;
      idea_title: string | null;       // joined from cp_content_ideas.title
      idea_content_type: string | null; // joined from cp_content_ideas.content_type
      edited_at: string | null;
      created_at: string;
    }>;
    edited_count: number;
    total_count: number;
  }>;
  summary: {
    total_teams: number;
    total_posts: number;
    remaining: number;
  };
}
```

- **Sorting:** Teams with most unedited posts first

### `PATCH /api/content-queue/posts/[id]`

Update a post in the queue.

- **Auth:** Regular session + validates operator has team membership for the post's team
- **Body:** `{ draft_content?: string, mark_edited?: boolean, image_url?: string }`
- **Behavior:**
  - Updates post via existing `updatePost()` service logic
  - If `mark_edited: true`, sets `edited_at = now()`
  - Edit history captured automatically via existing `captureAndClassifyEdit()`
- **Response:** Updated post object

### `POST /api/content-queue/submit`

Submit a client's batch for review.

- **Auth:** Regular session + validates operator has team membership
- **Body:** `{ team_id: string }`
- **Validation:** All draft posts for that team must have `edited_at IS NOT NULL`. Returns 400 with unedited count if validation fails.
- **DFY integration:** Looks up active DFY engagement where `magnetlab_user_id` matches the team owner's user ID. If found, fires **awaited** (not fire-and-forget) callback to gtm-api. If not found, skips callback — batch is still marked as reviewed locally.
- **Response:** `{ success: boolean, dfy_callback_sent: boolean, error?: string }`

## Pipeline Integration

### Submit for Review Flow

When operator clicks "Submit for Review":

1. **Magnetlab** validates all posts have `edited_at IS NOT NULL`
2. **Magnetlab** calls gtm-api: `POST /api/dfy/callbacks/automation-complete` with:
   - `magnetlab_user_id` (team owner's user ID)
   - `automation_type: 'content_editing'`
   - `status: 'completed'`
   - `result: { posts_edited: 7 }`
3. **gtm-api** receives callback:
   - Finds engagement by `magnetlab_user_id` WHERE `content_stage = 'editing'`
   - Sets `content_stage = 'review'`
   - Updates "Edit Content" Linear issue to "In Review"
   - Logs client-visible activity: "Content editing complete — 7 posts ready for review"
   - Triggers client notification email via Resend

### Why Awaited, Not Fire-and-Forget

The existing DFY callbacks (from background automation tasks) are fire-and-forget because the daily health check acts as a safety net. The content queue submit is operator-initiated — the operator is watching the screen. If the callback fails silently, the engagement gets stuck, the client is never notified, and nobody catches it. The submit endpoint awaits the response and surfaces success/failure to the operator with a retry option.

### Revision Flow

If the client requests revisions (`content_stage → 'revising'`):

1. gtm-api updates engagement `content_stage = 'revising'`
2. gtm-api calls magnetlab `POST /api/external/reset-edited-posts` with `{ userId: magnetlab_user_id }` (new endpoint, uses existing external API auth pattern — Bearer token + timing-safe comparison)
3. Magnetlab resets `edited_at = null` on all draft posts for that user's team
4. Posts reappear as unedited in the content queue

The `/api/external/reset-edited-posts` endpoint is in scope for this spec. It follows the existing external API pattern (`src/lib/middleware/external-auth.ts`) — no new auth mechanism needed.

### Engagement Lookup

The callback identifies engagements by `magnetlab_user_id`, not `engagement_id`. This avoids coupling magnetlab to DFY concepts. Constraint: one active DFY engagement per magnetlab user (true today, will remain true — a client has one engagement at a time).

## Frontend Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/app/(dashboard)/content-queue/page.tsx` | Server component, auth check, render ContentQueuePage |
| `src/components/content-queue/ContentQueuePage.tsx` | Client component, top-level: queue view vs editing view |
| `src/components/content-queue/QueueView.tsx` | Client card list (landing state) |
| `src/components/content-queue/ClientCard.tsx` | Single client row: avatar, name, progress, edit/submit button |
| `src/components/content-queue/EditingView.tsx` | Three-column editing layout + keyboard shortcuts |
| `src/components/content-queue/PostList.tsx` | Left column: post navigation with status dots |
| `src/components/content-queue/PostEditor.tsx` | Center: LinkedIn preview + inline TipTap editing + image upload |
| `src/components/content-queue/FeedPreview.tsx` | Center: collapsed hook + image LinkedIn feed preview |
| `src/components/content-queue/ContextPanel.tsx` | Right: writing style + collapsible brief/ICP/overview |
| `src/frontend/api/content-queue.ts` | API client module (getQueue, updatePost, submitBatch) |
| `src/frontend/hooks/api/useContentQueue.ts` | SWR hook for queue data |
| `src/app/api/content-queue/route.ts` | GET handler (list queue) |
| `src/app/api/content-queue/posts/[id]/route.ts` | PATCH handler (update post) |
| `src/app/api/content-queue/submit/route.ts` | POST handler (submit batch) |
| `src/server/services/content-queue.service.ts` | Business logic: cross-team queries, batch validation, callback |
| `src/server/repositories/content-queue.repo.ts` | Cross-team post queries |
| `src/app/api/external/reset-edited-posts/route.ts` | External API: reset edited_at for revision flow |

### State Management

- SWR via `useContentQueue()` hook — no Zustand store needed
- Editing view tracks locally: current post index, edit/preview mode toggle
- Optimistic mutation on "Mark Edited" — update SWR cache immediately, rollback on error
- Auto-advance to next unedited post after marking current as edited

### Reused Components

- `InlineContentEditor.tsx` (TipTap) — existing post editor, reused in PostEditor.tsx
- Image upload infrastructure — existing, reused for drop zone

## SaaS Applicability

The content queue works for three user types with zero conditional logic:

| User Type | What They See | Submit Behavior |
|-----------|---------------|-----------------|
| DFY operator | All DFY client teams' draft posts | Fires callback to gtm-api |
| Agency owner | All managed client teams' draft posts | No callback (no DFY engagement), batch marked locally |
| Solo user / team reviewer | Own team's draft posts | No callback, batch marked locally |

The distinction is automatic: submit checks for a DFY engagement by `magnetlab_user_id`. Present → fire callback. Absent → skip. No feature flags, no role checks.

## Testing

| Layer | What | Tests |
|-------|------|-------|
| Schema | Zod schemas for queue list response, post update body, batch submit body | 3 test files |
| API routes | Auth (401), cross-team validation (403), happy path (200), error cases (400/500) | 3 route test files |
| Service | Cross-team query logic, batch validation (unedited posts block submit), callback firing vs skipping, DFY engagement lookup | 1 service test file |
| Repo | Multi-team post query correctness, `edited_at` updates, team membership scoping | 1 repo test file |
| Components | QueueView renders client cards with correct counts, EditingView keyboard navigation, FeedPreview toggle, PostList status dots | 3 component test files |

**Security focus:** The cross-team query must never leak posts from teams the user doesn't belong to. Test: user A belongs to teams 1 and 2 but not team 3 — query returns posts from 1 and 2 only. This is the critical boundary.

## Coordination Notes

- **Callback type:** The `DfyCallbackPayload` type in `@mas/types` currently allows `automation_type: 'lead_magnet_generation' | 'content_calendar'`. This spec adds `'content_editing'`. The DFY pipeline hardening spec is rewriting the callback contract — coordinate the type update there.
- **Linear bidirectional sync:** The hardening spec also allows `content_stage = 'review'` to be set via Linear issue drag (bidirectional sync). The content queue fires a direct callback instead. Both paths to the same state change are valid — the engagement update must be idempotent (setting `content_stage = 'review'` when already `'review'` is a no-op).

## Not In Scope

- Moving client review/approval into magnetlab (future — currently in gtm-os portal)
- AI-assisted editing suggestions within the queue (future enhancement)
- Post scheduling from the content queue (posts remain as drafts; scheduling happens after client approval)
- Content queue for non-draft statuses (reviewing, scheduled, etc.)
- Notifications within magnetlab when new content arrives in the queue
- Analytics on editing speed/throughput per operator
