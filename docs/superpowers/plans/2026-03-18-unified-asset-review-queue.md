# Unified Asset Review Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the content queue to show lead magnets + funnels alongside posts, with per-asset review tracking and two-group submission (posts, assets).

**Architecture:** Extend existing content queue API, service, and repo to fetch lead magnets + funnel pages per team. Add `reviewed_at` columns to `lead_magnets` and `funnel_pages`. New `AssetPicker` component as intermediate view between queue and post editor. Two new review endpoints + extended submit. Reuse existing lead magnet editor and funnel builder via navigation.

**Tech Stack:** Next.js 15, Supabase, SWR, Zod, Jest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-18-unified-asset-review-queue-design.md`

**IMPORTANT:** The `cp_pipeline_posts` table does NOT have an `image_urls` column. Never include it in any select() query. See memory: `feedback_image_urls_gotcha.md`.

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260319000000_add_reviewed_at.sql` | Add `reviewed_at` to `lead_magnets` and `funnel_pages` |
| `src/app/api/content-queue/lead-magnets/[id]/review/route.ts` | PATCH handler for lead magnet review |
| `src/app/api/content-queue/funnels/[id]/review/route.ts` | PATCH handler for funnel review |
| `src/app/api/external/reset-reviewed-assets/route.ts` | External API for revision flow |
| `src/components/content-queue/AssetPicker.tsx` | Per-client asset review view |
| `src/__tests__/api/content-queue/review-lead-magnet.test.ts` | Lead magnet review route tests |
| `src/__tests__/api/content-queue/review-funnel.test.ts` | Funnel review route tests |
| `src/__tests__/components/content-queue/AssetPicker.test.tsx` | AssetPicker component tests |

### Modified Files

| File | Change |
|------|--------|
| `src/server/repositories/content-queue.repo.ts` | Add lead magnet + funnel query functions, review write functions |
| `src/server/services/content-queue.service.ts` | Add lead magnet/funnel to getQueue, review methods, extended submit |
| `src/lib/validations/content-queue.ts` | Add review schema, extend submit schema with `submit_type` |
| `src/frontend/api/content-queue.ts` | Add review API calls, extended types |
| `src/frontend/hooks/api/useContentQueue.ts` | Extended return types |
| `src/components/content-queue/ContentQueuePage.tsx` | Add asset picker state, review handlers |
| `src/components/content-queue/ClientCard.tsx` | Show lead magnet + funnel progress |
| `src/components/content-queue/QueueView.tsx` | Pass new data to client cards |
| `src/app/api/content-queue/route.ts` | No change (service handles extended response) |
| `src/app/api/content-queue/submit/route.ts` | No change (service handles submit_type) |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260319000000_add_reviewed_at.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add reviewed_at to lead_magnets and funnel_pages
-- Tracks when an operator marked the asset as reviewed in the content queue.
-- NULL = not reviewed. Timestamp = when marked reviewed.
-- Reset to NULL when client requests revisions.

ALTER TABLE lead_magnets ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

COMMENT ON COLUMN lead_magnets.reviewed_at IS 'When an operator marked this lead magnet as reviewed in the content queue. NULL = not reviewed.';
COMMENT ON COLUMN funnel_pages.reviewed_at IS 'When an operator marked this funnel as reviewed in the content queue. NULL = not reviewed.';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260319000000_add_reviewed_at.sql
git commit -m "feat(db): add reviewed_at column to lead_magnets and funnel_pages"
```

---

## Task 2: Zod Schema Extensions

**Files:**
- Modify: `src/lib/validations/content-queue.ts`

- [ ] **Step 1: Read the current file**

Read `src/lib/validations/content-queue.ts` to see the existing schemas.

- [ ] **Step 2: Add review schema and extend submit schema**

Add these schemas after the existing ones:

```typescript
// ─── Review Asset Schema ──────────────────────────────────────────────────

export const ReviewAssetSchema = z.object({
  reviewed: z.boolean(),
});

export type ReviewAssetInput = z.infer<typeof ReviewAssetSchema>;

// ─── Extended Submit Schema ───────────────────────────────────────────────

export const ContentQueueSubmitSchemaV2 = z.object({
  team_id: z.string().min(1, 'team_id is required'),
  submit_type: z.enum(['posts', 'assets']).default('posts'),
});

export type ContentQueueSubmitInputV2 = z.infer<typeof ContentQueueSubmitSchemaV2>;
```

- [ ] **Step 3: Run existing tests to ensure nothing broke**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern="content-queue.test" --no-coverage`
Expected: All existing tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validations/content-queue.ts
git commit -m "feat: add review and extended submit Zod schemas"
```

---

## Task 3: Repository — Lead Magnet + Funnel Queries

**Files:**
- Modify: `src/server/repositories/content-queue.repo.ts`

- [ ] **Step 1: Read the current repo file**

Read `src/server/repositories/content-queue.repo.ts` to understand the existing patterns.

- [ ] **Step 2: Add lead magnet and funnel query functions**

Add these after the existing functions. Follow the same patterns (admin client, error handling, column constants):

```typescript
// ─── Lead Magnet Column Constants ─────────────────────────────────────────

const LM_COLUMNS = 'id, title, archetype, status, reviewed_at, created_at, team_id';

// ─── Lead Magnet Types ────────────────────────────────────────────────────

export interface QueueLeadMagnet {
  id: string;
  title: string;
  archetype: string;
  status: string;
  reviewed_at: string | null;
  created_at: string;
  team_id: string;
}

export interface QueueFunnel {
  id: string;
  slug: string;
  is_published: boolean;
  reviewed_at: string | null;
  lead_magnet_id: string;
}

// ─── Lead Magnet Reads ────────────────────────────────────────────────────

/**
 * Fetch all lead magnets for the given team IDs.
 * Returns non-archived lead magnets for the content queue.
 */
export async function findLeadMagnetsByTeamIds(teamIds: string[]): Promise<QueueLeadMagnet[]> {
  if (teamIds.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('lead_magnets')
    .select(LM_COLUMNS)
    .in('team_id', teamIds)
    .in('status', ['draft', 'published'])
    .order('created_at', { ascending: true });

  if (error) throw new Error(`content-queue.findLeadMagnetsByTeamIds: ${error.message}`);
  return (data ?? []) as QueueLeadMagnet[];
}

/**
 * Fetch funnel pages for the given lead magnet IDs.
 * Only fetches funnels with target_type = 'lead_magnet' (not library or external).
 */
export async function findFunnelsByLeadMagnetIds(lmIds: string[]): Promise<QueueFunnel[]> {
  if (lmIds.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('id, slug, is_published, reviewed_at, lead_magnet_id')
    .in('lead_magnet_id', lmIds)
    .eq('target_type', 'lead_magnet');

  if (error) throw new Error(`content-queue.findFunnelsByLeadMagnetIds: ${error.message}`);
  return (data ?? []) as QueueFunnel[];
}

// ─── Lead Magnet / Funnel Writes ──────────────────────────────────────────

/**
 * Set reviewed_at on a lead magnet.
 */
export async function markLeadMagnetReviewed(lmId: string, reviewed: boolean): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('lead_magnets')
    .update({ reviewed_at: reviewed ? new Date().toISOString() : null })
    .eq('id', lmId);

  if (error) throw new Error(`content-queue.markLeadMagnetReviewed: ${error.message}`);
}

/**
 * Set reviewed_at on a funnel page.
 */
export async function markFunnelReviewed(funnelId: string, reviewed: boolean): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('funnel_pages')
    .update({ reviewed_at: reviewed ? new Date().toISOString() : null })
    .eq('id', funnelId);

  if (error) throw new Error(`content-queue.markFunnelReviewed: ${error.message}`);
}

/**
 * Reset reviewed_at for all lead magnets + funnels belonging to given team IDs.
 * Used when client requests revisions on assets.
 */
export async function resetReviewedForTeams(teamIds: string[]): Promise<number> {
  if (teamIds.length === 0) return 0;

  const supabase = createSupabaseAdminClient();
  let count = 0;

  const { data: lmData, error: lmErr } = await supabase
    .from('lead_magnets')
    .update({ reviewed_at: null })
    .in('team_id', teamIds)
    .not('reviewed_at', 'is', null)
    .select('id');

  if (lmErr) throw new Error(`content-queue.resetReviewedForTeams (lm): ${lmErr.message}`);
  count += lmData?.length ?? 0;

  // Get LM IDs to reset their funnels
  const { data: lms } = await supabase
    .from('lead_magnets')
    .select('id')
    .in('team_id', teamIds);

  const lmIds = (lms ?? []).map((lm) => lm.id);
  if (lmIds.length > 0) {
    const { data: funnelData, error: funnelErr } = await supabase
      .from('funnel_pages')
      .update({ reviewed_at: null })
      .in('lead_magnet_id', lmIds)
      .eq('target_type', 'lead_magnet')
      .not('reviewed_at', 'is', null)
      .select('id');

    if (funnelErr) throw new Error(`content-queue.resetReviewedForTeams (funnel): ${funnelErr.message}`);
    count += funnelData?.length ?? 0;
  }

  return count;
}

/**
 * Find a lead magnet by ID, verifying it belongs to one of the given team IDs.
 */
export async function findLeadMagnetByIdForTeams(
  lmId: string,
  teamIds: string[]
): Promise<QueueLeadMagnet | null> {
  if (teamIds.length === 0) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('lead_magnets')
    .select(LM_COLUMNS)
    .eq('id', lmId)
    .in('team_id', teamIds)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`content-queue.findLeadMagnetByIdForTeams: ${error.message}`);
  }
  return (data as QueueLeadMagnet) ?? null;
}

/**
 * Find a funnel by ID, verifying its lead magnet belongs to one of the given team IDs.
 */
export async function findFunnelByIdForTeams(
  funnelId: string,
  teamIds: string[]
): Promise<QueueFunnel | null> {
  if (teamIds.length === 0) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('id, slug, is_published, reviewed_at, lead_magnet_id, lead_magnets!inner(team_id)')
    .eq('id', funnelId)
    .eq('target_type', 'lead_magnet')
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`content-queue.findFunnelByIdForTeams: ${error.message}`);
  }
  if (!data) return null;

  // Verify team access via the joined lead_magnets.team_id
  const lmTeamId = (data.lead_magnets as unknown as { team_id: string })?.team_id;
  if (!teamIds.includes(lmTeamId)) return null;

  return {
    id: data.id,
    slug: data.slug,
    is_published: data.is_published,
    reviewed_at: data.reviewed_at,
    lead_magnet_id: data.lead_magnet_id,
  } as QueueFunnel;
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/repositories/content-queue.repo.ts
git commit -m "feat: add lead magnet + funnel queries to content queue repo"
```

---

## Task 4: Service — Extended getQueue + Review Methods

**Files:**
- Modify: `src/server/services/content-queue.service.ts`

- [ ] **Step 1: Read the current service file**

Read `src/server/services/content-queue.service.ts` to understand the existing `getQueue`, `submitBatch` functions.

- [ ] **Step 2: Add types for lead magnets and funnels in the response**

Add to the existing `QueueTeam` interface:

```typescript
// Add these fields to the QueueTeam interface:
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
```

Extend the `QueueListResult.summary` to add `total_lead_magnets` and `total_funnels`.

- [ ] **Step 3: Extend getQueue to fetch lead magnets + funnels**

In the `getQueue` function, after fetching posts, add:

```typescript
// Fetch lead magnets for these teams
const leadMagnets = await queueRepo.findLeadMagnetsByTeamIds(teamIds);

// Fetch funnels for these lead magnets
const lmIds = leadMagnets.map((lm) => lm.id);
const funnels = await queueRepo.findFunnelsByLeadMagnetIds(lmIds);

// Build funnel lookup: lead_magnet_id → funnels[]
const funnelsByLmId = new Map<string, typeof funnels>();
for (const f of funnels) {
  const existing = funnelsByLmId.get(f.lead_magnet_id) ?? [];
  existing.push(f);
  funnelsByLmId.set(f.lead_magnet_id, existing);
}
```

Then when building each team in the `teamPostsMap`, also add the team's lead magnets + funnels:

```typescript
// After creating the team object, before pushing posts:
const teamLMs = leadMagnets.filter((lm) => lm.team_id === profile.team_id);
// ... map to response shape with funnels array
```

Also ensure teams WITH lead magnets but WITHOUT posts still appear in the queue (currently teams only appear if they have posts).

- [ ] **Step 4: Add review methods**

```typescript
/**
 * Mark a lead magnet as reviewed. Validates team membership.
 */
export async function reviewLeadMagnet(
  userId: string,
  lmId: string,
  reviewed: boolean
): Promise<void> {
  const userTeams = await teamRepo.getUserTeams(userId);
  const teamIds = userTeams.map((e) => e.team.id);

  const lm = await queueRepo.findLeadMagnetByIdForTeams(lmId, teamIds);
  if (!lm) {
    throw Object.assign(new Error('Lead magnet not found or not accessible'), { statusCode: 403 });
  }

  await queueRepo.markLeadMagnetReviewed(lmId, reviewed);
}

/**
 * Mark a funnel as reviewed. Validates team membership.
 */
export async function reviewFunnel(
  userId: string,
  funnelId: string,
  reviewed: boolean
): Promise<void> {
  const userTeams = await teamRepo.getUserTeams(userId);
  const teamIds = userTeams.map((e) => e.team.id);

  const funnel = await queueRepo.findFunnelByIdForTeams(funnelId, teamIds);
  if (!funnel) {
    throw Object.assign(new Error('Funnel not found or not accessible'), { statusCode: 403 });
  }

  await queueRepo.markFunnelReviewed(funnelId, reviewed);
}
```

- [ ] **Step 5: Extend submitBatch with submit_type**

Modify `submitBatch` to accept `submitType: 'posts' | 'assets'`. When `submitType === 'assets'`:

1. Get team's lead magnet IDs
2. Validate all lead magnets have `reviewed_at IS NOT NULL`
3. Validate all funnels for those lead magnets have `reviewed_at IS NOT NULL` (funnels that exist — lead magnets with no funnels only need LM review)
4. Fire DFY callback with `automation_type: 'asset_review'`

Keep the existing posts logic as the default when `submitType === 'posts'` or omitted.

- [ ] **Step 6: Add resetReviewedAssets method**

```typescript
export async function resetReviewedAssets(userId: string): Promise<{ reset_count: number }> {
  const supabase = createSupabaseAdminClient();
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', userId);

  if (!teams?.length) return { reset_count: 0 };

  const teamIds = teams.map((t) => t.id);
  const count = await queueRepo.resetReviewedForTeams(teamIds);

  logInfo('content-queue', 'Reset reviewed assets for revision flow', { userId, resetCount: count });
  return { reset_count: count };
}
```

- [ ] **Step 7: Verify typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/server/services/content-queue.service.ts
git commit -m "feat: extend content queue service with lead magnet + funnel support"
```

---

## Task 5: API Routes — Review Endpoints + Extended Submit

**Files:**
- Create: `src/app/api/content-queue/lead-magnets/[id]/review/route.ts`
- Create: `src/app/api/content-queue/funnels/[id]/review/route.ts`
- Create: `src/app/api/external/reset-reviewed-assets/route.ts`
- Modify: `src/app/api/content-queue/submit/route.ts`
- Create: `src/__tests__/api/content-queue/review-lead-magnet.test.ts`
- Create: `src/__tests__/api/content-queue/review-funnel.test.ts`

- [ ] **Step 1: Write lead magnet review test**

Follow the pattern from `src/__tests__/api/content-queue/update-post.test.ts`. Test: 401 without auth, 400 for invalid body, 200 on success, 403 when not accessible.

- [ ] **Step 2: Write lead magnet review route**

```typescript
/**
 * Content Queue — Lead Magnet Review Route.
 * PATCH /api/content-queue/lead-magnets/[id]/review
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { ReviewAssetSchema } from '@/lib/validations/content-queue';
import { formatZodError } from '@/lib/validations/api';
import * as contentQueueService from '@/server/services/content-queue.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const rawBody = await request.json();
    const parsed = ReviewAssetSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    await contentQueueService.reviewLeadMagnet(session.user.id, id, parsed.data.reviewed);
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = contentQueueService.getStatusCode(error);
    logError('content-queue/review-lm', error);
    return NextResponse.json(
      { error: status < 500 ? (error as Error).message : 'Internal server error' },
      { status }
    );
  }
}
```

- [ ] **Step 3: Write funnel review route (same pattern)**

Copy the lead magnet pattern, call `contentQueueService.reviewFunnel` instead.

- [ ] **Step 4: Write funnel review test**

Same pattern as lead magnet review test.

- [ ] **Step 5: Modify submit route to use extended schema**

In `src/app/api/content-queue/submit/route.ts`, change `ContentQueueSubmitSchema` to `ContentQueueSubmitSchemaV2` and pass `parsed.data.submit_type` to `submitBatch`.

- [ ] **Step 6: Write reset-reviewed-assets external route**

Follow the exact pattern from `src/app/api/external/reset-edited-posts/route.ts`. Use `authenticateExternalRequest` from `@/lib/api/external-auth`. Call `contentQueueService.resetReviewedAssets`.

- [ ] **Step 7: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern="content-queue" --no-coverage`
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/content-queue/lead-magnets/ src/app/api/content-queue/funnels/ src/app/api/external/reset-reviewed-assets/ src/app/api/content-queue/submit/ src/__tests__/api/content-queue/review-lead-magnet.test.ts src/__tests__/api/content-queue/review-funnel.test.ts
git commit -m "feat: add lead magnet + funnel review routes and extended submit"
```

---

## Task 6: Frontend API Client + Hook Extensions

**Files:**
- Modify: `src/frontend/api/content-queue.ts`
- Modify: `src/frontend/hooks/api/useContentQueue.ts`

- [ ] **Step 1: Add types and API functions to content-queue.ts**

Add to the existing file:

```typescript
// ─── Lead Magnet + Funnel Types ───────────────────────────────────────────

export interface QueueFunnel {
  id: string;
  slug: string;
  is_published: boolean;
  reviewed_at: string | null;
}

export interface QueueLeadMagnet {
  id: string;
  title: string;
  archetype: string;
  status: string;
  reviewed_at: string | null;
  created_at: string;
  funnels: QueueFunnel[];
}
```

Add `lead_magnets: QueueLeadMagnet[]` and count fields to `QueueTeam`.
Add `total_lead_magnets` and `total_funnels` to the summary in `QueueListResult`.

Add API functions:

```typescript
export async function reviewLeadMagnet(lmId: string, reviewed: boolean): Promise<void> {
  return apiClient.patch<void>(`/content-queue/lead-magnets/${lmId}/review`, { reviewed });
}

export async function reviewFunnel(funnelId: string, reviewed: boolean): Promise<void> {
  return apiClient.patch<void>(`/content-queue/funnels/${funnelId}/review`, { reviewed });
}
```

Update `submitBatch` to accept optional `submitType`:

```typescript
export async function submitBatch(teamId: string, submitType: 'posts' | 'assets' = 'posts'): Promise<SubmitResult> {
  return apiClient.post<SubmitResult>('/content-queue/submit', { team_id: teamId, submit_type: submitType });
}
```

- [ ] **Step 2: Update useContentQueue hook types**

The hook's return types are derived from the API types — just ensure the extended `QueueTeam` flows through correctly.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/api/content-queue.ts src/frontend/hooks/api/useContentQueue.ts
git commit -m "feat: add lead magnet + funnel review to frontend API client"
```

---

## Task 7: ClientCard + QueueView — Show Asset Progress

**Files:**
- Modify: `src/components/content-queue/ClientCard.tsx`
- Modify: `src/components/content-queue/QueueView.tsx`

- [ ] **Step 1: Read current ClientCard and QueueView**

Read both files to understand the current structure.

- [ ] **Step 2: Extend ClientCard to show lead magnet + funnel progress**

Below the posts progress line, add:

- Lead magnet line: count + reviewed count (or "needs review" / "✓" if just 1)
- Funnel line: count + reviewed count

Show two submit buttons when each group is complete:
- "Submit Posts" when all posts have `edited_at`
- "Submit Assets" when all lead magnets + funnels have `reviewed_at`

Clients with no lead magnets skip those lines.

- [ ] **Step 3: Update QueueView summary stats**

Add lead magnet + funnel totals to the header stats line.

- [ ] **Step 4: Update QueueView test**

Update `src/__tests__/components/content-queue/QueueView.test.tsx` mock data to include `lead_magnets` array and count fields. Add test that "Submit Assets" button appears when all assets reviewed.

- [ ] **Step 5: Commit**

```bash
git add src/components/content-queue/ClientCard.tsx src/components/content-queue/QueueView.tsx src/__tests__/components/content-queue/QueueView.test.tsx
git commit -m "feat: show lead magnet + funnel progress in client cards"
```

---

## Task 8: AssetPicker Component

**Files:**
- Create: `src/components/content-queue/AssetPicker.tsx`
- Create: `src/__tests__/components/content-queue/AssetPicker.test.tsx`

- [ ] **Step 1: Write AssetPicker test**

```typescript
/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
// ... mock lucide-react icons

import { AssetPicker } from '@/components/content-queue/AssetPicker';

// Mock team data with posts + lead magnets + funnels

describe('AssetPicker', () => {
  it('renders posts section with count', () => { ... });
  it('renders lead magnets section', () => { ... });
  it('renders funnel for each lead magnet', () => { ... });
  it('calls onEditPosts when Edit Posts clicked', () => { ... });
  it('shows disabled Submit Posts when posts not all edited', () => { ... });
  it('shows disabled Submit Assets when assets not all reviewed', () => { ... });
  it('calls onSubmitPosts when all posts edited and button clicked', () => { ... });
  it('shows Mark Reviewed button for each lead magnet', () => { ... });
});
```

- [ ] **Step 2: Write AssetPicker component**

Props:
```typescript
interface AssetPickerProps {
  team: QueueTeam;
  onEditPosts: () => void;
  onBack: () => void;
  onReviewLeadMagnet: (lmId: string, reviewed: boolean) => Promise<void>;
  onReviewFunnel: (funnelId: string, reviewed: boolean) => Promise<void>;
  onSubmitPosts: () => Promise<void>;
  onSubmitAssets: () => Promise<void>;
}
```

Three sections:
1. **Posts** — count, progress bar, "Edit Posts →" button
2. **Lead Magnets** — list of LMs with title, archetype badge, "Mark Reviewed" toggle, "Review in Editor →" link (opens `/magnets/[id]` via `window.open` or `router.push`)
3. **Funnels** — listed under their lead magnet, "Mark Reviewed" toggle, "Review Funnel →" link (opens `/magnets/[lmId]?tab=funnel`)

Bottom: two submit buttons (disabled until each group is fully reviewed).

For "Review in Editor" links: set `ml-team-context` cookie to the team ID before navigation. Use `document.cookie = \`ml-team-context=${team.team_id}; path=/\`` then `router.push()`.

- [ ] **Step 3: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern="AssetPicker" --no-coverage`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/content-queue/AssetPicker.tsx src/__tests__/components/content-queue/AssetPicker.test.tsx
git commit -m "feat: add AssetPicker component for per-client asset review"
```

---

## Task 9: ContentQueuePage — Wire Up Asset Picker

**Files:**
- Modify: `src/components/content-queue/ContentQueuePage.tsx`

- [ ] **Step 1: Read current ContentQueuePage**

Read the file to understand the existing state management (queue view vs editing view).

- [ ] **Step 2: Add asset picker state**

Add a third state: `editingMode: null | 'picker' | 'posts'`.

Current flow: `editingTeamId = null` → queue view, `editingTeamId` set → post editor.

New flow:
- `editingTeamId = null` → queue view
- `editingTeamId` set, `editingMode = 'picker'` → AssetPicker
- `editingTeamId` set, `editingMode = 'posts'` → EditingView (post editor)

When clicking "Review" on a client card → set `editingTeamId` + `editingMode = 'picker'`.
When clicking "Edit Posts" in AssetPicker → set `editingMode = 'posts'`.
When clicking "Back" in AssetPicker → reset to queue view.
When clicking "Back" in EditingView → go back to AssetPicker (not queue).

- [ ] **Step 3: Add review handlers**

```typescript
const handleReviewLeadMagnet = useCallback(async (lmId: string, reviewed: boolean) => {
  await reviewLeadMagnet(lmId, reviewed);
  await refetch();
}, [refetch]);

const handleReviewFunnel = useCallback(async (funnelId: string, reviewed: boolean) => {
  await reviewFunnel(funnelId, reviewed);
  await refetch();
}, [refetch]);

const handleSubmitAssets = useCallback(async (teamId: string) => {
  const result = await submitBatch(teamId, 'assets');
  if (result.success) {
    toast.success('Assets submitted for review');
    await refetch();
  }
  return result;
}, [refetch]);
```

- [ ] **Step 4: Render AssetPicker when in picker mode**

```typescript
if (editingTeam && editingMode === 'picker') {
  return (
    <AssetPicker
      team={editingTeam}
      onEditPosts={() => setEditingMode('posts')}
      onBack={handleBack}
      onReviewLeadMagnet={handleReviewLeadMagnet}
      onReviewFunnel={handleReviewFunnel}
      onSubmitPosts={() => handleSubmit(editingTeamId!)}
      onSubmitAssets={() => handleSubmitAssets(editingTeamId!)}
    />
  );
}
```

- [ ] **Step 5: Update handleEdit to go to picker instead of directly to posts**

Change `handleEdit` to set `editingMode = 'picker'` instead of going directly to the post editor.

- [ ] **Step 6: Commit**

```bash
git add src/components/content-queue/ContentQueuePage.tsx
git commit -m "feat: wire AssetPicker into content queue page flow"
```

---

## Task 10: MCP Tools

**Files:**
- Modify: `packages/mcp/src/tools/content-queue.ts`
- Modify: `packages/mcp/src/handlers/content-queue.ts`
- Modify: `packages/mcp/src/client.ts`
- Modify: `packages/mcp/src/validation.ts`
- Modify: `packages/mcp/src/tools/index.ts`
- Modify: `packages/mcp/src/handlers/index.ts`

- [ ] **Step 1: Add 3 new MCP tools**

Add to the content queue tools file:
- `magnetlab_review_lead_magnet` — `{ lead_magnet_id: string, reviewed: boolean }`
- `magnetlab_review_funnel` — `{ funnel_id: string, reviewed: boolean }`
- `magnetlab_submit_asset_review` — `{ team_id: string }`

- [ ] **Step 2: Add client methods**

Add to `packages/mcp/src/client.ts`:
- `reviewLeadMagnet(lmId, reviewed)` — PATCH `/content-queue/lead-magnets/{id}/review`
- `reviewFunnel(funnelId, reviewed)` — PATCH `/content-queue/funnels/{id}/review`
- `submitAssetReview(teamId)` — POST `/content-queue/submit` with `submit_type: 'assets'`

- [ ] **Step 3: Add handler wiring + validation schemas**

Wire tools to client methods. Add Zod schemas for the 3 new tools.

- [ ] **Step 4: Update tool count in tests**

Update count assertions from 43 (or current) to +3.

- [ ] **Step 5: Build + test MCP package**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm --filter @magnetlab/mcp build && pnpm --filter @magnetlab/mcp test`

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/
git commit -m "feat: add lead magnet + funnel review MCP tools"
```

---

## Task 11: Typecheck + Full Test Run + Documentation

- [ ] **Step 1: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors.

- [ ] **Step 2: Run full content queue tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern="content-queue|AssetPicker" --no-coverage`
Expected: All tests pass.

- [ ] **Step 3: Update CLAUDE.md**

Add to Feature Documentation table:
```markdown
| Unified Asset Review Queue | [docs/superpowers/specs/2026-03-18-unified-asset-review-queue-design.md](docs/superpowers/specs/2026-03-18-unified-asset-review-queue-design.md) |
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add unified asset review queue to CLAUDE.md"
```
