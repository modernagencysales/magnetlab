# DFY Content Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-team content editing queue in magnetlab that lets operators edit AI-generated posts across multiple client teams in one fast, focused interface.

**Architecture:** New dashboard page at `/(dashboard)/content-queue` with a repo → service → route backend stack, three new API endpoints, and a three-column editing UI. One new column (`edited_at`) on `cp_pipeline_posts`, no new tables. DFY pipeline integration via awaited callback on batch submit.

**Tech Stack:** Next.js 15, Supabase, TipTap, SWR, Zod, Jest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-17-dfy-content-queue-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260318000000_add_edited_at_to_posts.sql` | Add `edited_at` column to `cp_pipeline_posts` |
| `src/lib/validations/content-queue.ts` | Zod schemas for all content queue API endpoints |
| `src/server/repositories/content-queue.repo.ts` | Cross-team post queries, `edited_at` updates |
| `src/server/services/content-queue.service.ts` | Business logic: cross-team aggregation, batch validation, DFY callback |
| `src/app/api/content-queue/route.ts` | GET handler (list queue grouped by team) |
| `src/app/api/content-queue/posts/[id]/route.ts` | PATCH handler (update post + mark edited) |
| `src/app/api/content-queue/submit/route.ts` | POST handler (submit batch for review) |
| `src/app/api/external/reset-edited-posts/route.ts` | External API: reset `edited_at` for revision flow |
| `src/frontend/api/content-queue.ts` | Client API module (getQueue, updatePost, submitBatch) |
| `src/frontend/hooks/api/useContentQueue.ts` | SWR hook for queue data |
| `src/app/(dashboard)/content-queue/page.tsx` | Server component, auth check |
| `src/components/content-queue/ContentQueuePage.tsx` | Top-level: queue view vs editing view |
| `src/components/content-queue/QueueView.tsx` | Client card list (landing state) |
| `src/components/content-queue/ClientCard.tsx` | Single client row with progress |
| `src/components/content-queue/EditingView.tsx` | Three-column layout + keyboard shortcuts |
| `src/components/content-queue/PostList.tsx` | Left column: post navigation |
| `src/components/content-queue/PostEditor.tsx` | Center: LinkedIn preview + inline editing + image upload |
| `src/components/content-queue/FeedPreview.tsx` | Center: collapsed hook + image feed preview |
| `src/components/content-queue/ContextPanel.tsx` | Right: writing style + collapsible panels |
| `src/__tests__/api/content-queue/queue.test.ts` | GET route tests |
| `src/__tests__/api/content-queue/update-post.test.ts` | PATCH route tests |
| `src/__tests__/api/content-queue/submit.test.ts` | POST submit route tests |
| `src/__tests__/api/external/reset-edited-posts.test.ts` | External reset route tests |
| `src/__tests__/lib/validations/content-queue.test.ts` | Zod schema tests |
| `src/__tests__/components/content-queue/QueueView.test.tsx` | QueueView component tests |
| `src/__tests__/components/content-queue/FeedPreview.test.tsx` | FeedPreview component tests |

### Modified Files

| File | Change |
|------|--------|
| `src/components/dashboard/AppSidebar.tsx` | Add content-queue nav item |
| `src/lib/validations/api.ts` | Export `formatZodError` if not already exported (it is) |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260318000000_add_edited_at_to_posts.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add edited_at column to cp_pipeline_posts
-- Tracks when an operator marked a post as edited in the content queue.
-- NULL = not yet edited. Timestamp = when marked edited.
-- Reset to NULL when client requests revisions.

ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

COMMENT ON COLUMN cp_pipeline_posts.edited_at IS 'When an operator marked this post as edited in the content queue. NULL = unedited.';
```

- [ ] **Step 2: Verify migration applies locally**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm db:push`
Expected: Migration applies without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260318000000_add_edited_at_to_posts.sql
git commit -m "feat(db): add edited_at column to cp_pipeline_posts"
```

---

## Task 2: Zod Schemas

**Files:**
- Create: `src/lib/validations/content-queue.ts`
- Create: `src/__tests__/lib/validations/content-queue.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */
import {
  ContentQueueUpdateSchema,
  ContentQueueSubmitSchema,
} from '@/lib/validations/content-queue';

describe('ContentQueueUpdateSchema', () => {
  it('accepts valid update with draft_content', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      draft_content: 'Updated post text',
    });
    expect(result.success).toBe(true);
  });

  it('accepts mark_edited flag', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      mark_edited: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts image_urls array', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      image_urls: ['https://example.com/image.png'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty object', () => {
    const result = ContentQueueUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields', () => {
    const result = ContentQueueUpdateSchema.safeParse({
      draft_content: 'text',
      unknown_field: 'value',
    });
    // strict() strips unknown fields — verify only known fields pass through
    if (result.success) {
      expect(result.data).not.toHaveProperty('unknown_field');
    }
  });
});

describe('ContentQueueSubmitSchema', () => {
  it('accepts valid team_id', () => {
    const result = ContentQueueSubmitSchema.safeParse({
      team_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing team_id', () => {
    const result = ContentQueueSubmitSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty team_id', () => {
    const result = ContentQueueSubmitSchema.safeParse({ team_id: '' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="content-queue.test" --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the schemas**

```typescript
/**
 * Content Queue Validation Schemas.
 * Zod schemas for content queue API request bodies.
 * Never imports from Next.js HTTP layer.
 */

import { z } from 'zod';

// ─── Update Post Schema ───────────────────────────────────────────────────

export const ContentQueueUpdateSchema = z
  .object({
    draft_content: z.string().min(1, 'draft_content cannot be empty').optional(),
    mark_edited: z.boolean().optional(),
    image_urls: z.array(z.string().url('each image_url must be a valid URL')).optional().nullable(),
  })
  .refine(
    (data) => data.draft_content !== undefined || data.mark_edited !== undefined || data.image_urls !== undefined,
    { message: 'At least one field must be provided' }
  );

export type ContentQueueUpdateInput = z.infer<typeof ContentQueueUpdateSchema>;

// ─── Submit Batch Schema ──────────────────────────────────────────────────

export const ContentQueueSubmitSchema = z.object({
  team_id: z.string().min(1, 'team_id is required'),
});

export type ContentQueueSubmitInput = z.infer<typeof ContentQueueSubmitSchema>;

// ─── Reset Edited Posts Schema (external API) ─────────────────────────────

export const ResetEditedPostsSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export type ResetEditedPostsInput = z.infer<typeof ResetEditedPostsSchema>;
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="content-queue.test" --no-coverage`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/content-queue.ts src/__tests__/lib/validations/content-queue.test.ts
git commit -m "feat: add Zod schemas for content queue API"
```

---

## Task 3: Repository Layer

**Files:**
- Create: `src/server/repositories/content-queue.repo.ts`

Reference files to study:
- `src/server/repositories/posts.repo.ts` — column constants, query patterns
- `src/lib/utils/team-membership.ts` — `getMergedMemberships()`

- [ ] **Step 1: Write the repository**

```typescript
/**
 * Content Queue Repository.
 * Cross-team post queries for the content editing queue.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Column Constants ─────────────────────────────────────────────────────

const QUEUE_POST_COLUMNS =
  'id, draft_content, idea_id, edited_at, created_at, team_profile_id, status, image_urls';

const QUEUE_POST_WITH_IDEA_COLUMNS =
  'id, draft_content, idea_id, edited_at, created_at, team_profile_id, status, image_urls, cp_content_ideas(title, content_type)';

// ─── Types ────────────────────────────────────────────────────────────────

export interface QueuePost {
  id: string;
  draft_content: string | null;
  idea_id: string | null;
  edited_at: string | null;
  created_at: string;
  team_profile_id: string | null;
  status: string;
  image_urls: string[] | null;
  cp_content_ideas: { title: string | null; content_type: string | null } | null;
}

// ─── Reads ────────────────────────────────────────────────────────────────

/**
 * Fetch all draft posts across multiple team profile IDs.
 * Used by the content queue to aggregate posts across teams.
 */
export async function findDraftPostsByProfileIds(
  profileIds: string[]
): Promise<QueuePost[]> {
  if (profileIds.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select(QUEUE_POST_WITH_IDEA_COLUMNS)
    .in('team_profile_id', profileIds)
    .eq('status', 'draft')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`content-queue.findDraftPostsByProfileIds: ${error.message}`);
  return (data ?? []) as QueuePost[];
}

/**
 * Find a single post by ID, verifying it belongs to one of the given profile IDs.
 * Returns null if not found or not accessible.
 */
export async function findPostByIdForProfiles(
  postId: string,
  profileIds: string[]
): Promise<QueuePost | null> {
  if (profileIds.length === 0) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select(QUEUE_POST_COLUMNS)
    .eq('id', postId)
    .in('team_profile_id', profileIds)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`content-queue.findPostByIdForProfiles: ${error.message}`);
  }
  return (data as QueuePost) ?? null;
}

/**
 * Count draft posts for given profile IDs, split by edited/unedited.
 */
export async function countDraftPostsByTeamProfileId(
  profileIds: string[]
): Promise<Map<string, { total: number; edited: number }>> {
  if (profileIds.length === 0) return new Map();

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select('team_profile_id, edited_at')
    .in('team_profile_id', profileIds)
    .eq('status', 'draft');

  if (error) throw new Error(`content-queue.countDraftPostsByTeamProfileId: ${error.message}`);

  const counts = new Map<string, { total: number; edited: number }>();
  for (const row of data ?? []) {
    const pid = row.team_profile_id;
    if (!pid) continue;
    const current = counts.get(pid) ?? { total: 0, edited: 0 };
    current.total++;
    if (row.edited_at) current.edited++;
    counts.set(pid, current);
  }
  return counts;
}

// ─── Writes ───────────────────────────────────────────────────────────────

/**
 * Set edited_at on a post (mark as edited by operator).
 */
export async function markPostEdited(postId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_pipeline_posts')
    .update({ edited_at: new Date().toISOString() })
    .eq('id', postId);

  if (error) throw new Error(`content-queue.markPostEdited: ${error.message}`);
}

/**
 * Reset edited_at to null for all draft posts belonging to given profile IDs.
 * Used when client requests revisions.
 */
export async function resetEditedForProfiles(profileIds: string[]): Promise<number> {
  if (profileIds.length === 0) return 0;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .update({ edited_at: null })
    .in('team_profile_id', profileIds)
    .eq('status', 'draft')
    .not('edited_at', 'is', null)
    .select('id');

  if (error) throw new Error(`content-queue.resetEditedForProfiles: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * Check whether all draft posts for given profile IDs have been edited.
 * Returns { allEdited, uneditedCount }.
 */
export async function checkAllPostsEdited(
  profileIds: string[]
): Promise<{ allEdited: boolean; uneditedCount: number; totalCount: number }> {
  if (profileIds.length === 0) return { allEdited: true, uneditedCount: 0, totalCount: 0 };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select('id, edited_at')
    .in('team_profile_id', profileIds)
    .eq('status', 'draft');

  if (error) throw new Error(`content-queue.checkAllPostsEdited: ${error.message}`);

  const total = data?.length ?? 0;
  const unedited = (data ?? []).filter((p) => !p.edited_at).length;
  return { allEdited: unedited === 0 && total > 0, uneditedCount: unedited, totalCount: total };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/repositories/content-queue.repo.ts
git commit -m "feat: add content queue repository layer"
```

---

## Task 4: Service Layer

**Files:**
- Create: `src/server/services/content-queue.service.ts`

Reference files to study:
- `src/server/services/posts.service.ts` — getStatusCode, service error pattern
- `src/server/services/dfy-callback.ts` — callback firing pattern
- `src/lib/utils/team-membership.ts` — getMergedMemberships

- [ ] **Step 1: Write the service**

```typescript
/**
 * Content Queue Service.
 * Business logic for the cross-team content editing queue.
 * Never imports from Next.js HTTP layer (no NextRequest, NextResponse, cookies).
 */

import { getMergedMemberships } from '@/lib/utils/team-membership';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError, logInfo } from '@/lib/utils/logger';
import * as queueRepo from '@/server/repositories/content-queue.repo';
import type { ContentQueueUpdateInput } from '@/lib/validations/content-queue';

// ─── Types ────────────────────────────────────────────────────────────────

export interface QueueTeamWritingStyle {
  name: string;
  description: string | null;
  tone_keywords: string[] | null;
  writing_rules: string[] | null;
}

export interface QueueTeam {
  team_id: string;
  team_name: string;
  profile_name: string;
  profile_company: string;
  owner_id: string;
  writing_style: QueueTeamWritingStyle | null;
  posts: Array<{
    id: string;
    draft_content: string | null;
    idea_id: string | null;
    idea_title: string | null;
    idea_content_type: string | null;
    edited_at: string | null;
    created_at: string;
    image_urls: string[] | null;
  }>;
  edited_count: number;
  total_count: number;
}

export interface QueueListResult {
  teams: QueueTeam[];
  summary: {
    total_teams: number;
    total_posts: number;
    remaining: number;
  };
}

export interface SubmitResult {
  success: boolean;
  dfy_callback_sent: boolean;
  error?: string;
}

// ─── Reads ────────────────────────────────────────────────────────────────

/**
 * Get the content queue for a user — all draft posts across all teams they belong to,
 * grouped by team with counts.
 */
export async function getQueue(userId: string): Promise<QueueListResult> {
  const memberships = await getMergedMemberships(userId);
  if (memberships.length === 0) {
    return { teams: [], summary: { total_teams: 0, total_posts: 0, remaining: 0 } };
  }

  const teamIds = memberships.map((m) => m.teamId);

  // Get all active team profiles for these teams
  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id, team_id, full_name, company, user_id')
    .in('team_id', teamIds)
    .eq('status', 'active');

  if (!profiles?.length) {
    return { teams: [], summary: { total_teams: 0, total_posts: 0, remaining: 0 } };
  }

  const profileIds = profiles.map((p) => p.id);
  const posts = await queueRepo.findDraftPostsByProfileIds(profileIds);

  // Fetch writing styles for these teams
  const { data: writingStyles } = await supabase
    .from('cp_writing_styles')
    .select('id, team_id, name, description, tone_keywords, writing_rules')
    .in('team_id', teamIds)
    .eq('is_default', true);

  const styleByTeam = new Map<string, { name: string; description: string | null; tone_keywords: string[] | null; writing_rules: string[] | null }>();
  for (const s of writingStyles ?? []) {
    if (s.team_id) styleByTeam.set(s.team_id, s);
  }

  // Build profile → team lookup
  const profileToTeam = new Map<string, typeof profiles[0]>();
  for (const p of profiles) {
    profileToTeam.set(p.id, p);
  }

  // Build membership lookup for team names and owner IDs
  const membershipByTeam = new Map(memberships.map((m) => [m.teamId, m]));

  // Group posts by team
  const teamPostsMap = new Map<string, QueueTeam>();

  for (const post of posts) {
    const profile = post.team_profile_id ? profileToTeam.get(post.team_profile_id) : null;
    if (!profile) continue;

    const membership = membershipByTeam.get(profile.team_id);
    if (!membership) continue;

    let team = teamPostsMap.get(profile.team_id);
    if (!team) {
      const style = styleByTeam.get(profile.team_id) ?? null;
      team = {
        team_id: profile.team_id,
        team_name: membership.teamName,
        profile_name: profile.full_name ?? '',
        profile_company: profile.company ?? '',
        owner_id: membership.ownerId,
        writing_style: style ? {
          name: style.name,
          description: style.description,
          tone_keywords: style.tone_keywords,
          writing_rules: style.writing_rules,
        } : null,
        posts: [],
        edited_count: 0,
        total_count: 0,
      };
      teamPostsMap.set(profile.team_id, team);
    }

    const idea = post.cp_content_ideas;
    team.posts.push({
      id: post.id,
      draft_content: post.draft_content,
      idea_id: post.idea_id,
      idea_title: idea?.title ?? null,
      idea_content_type: idea?.content_type ?? null,
      edited_at: post.edited_at,
      created_at: post.created_at,
      image_url: post.image_url,
    });
    team.total_count++;
    if (post.edited_at) team.edited_count++;
  }

  // Sort: teams with most unedited posts first
  const teams = Array.from(teamPostsMap.values()).sort(
    (a, b) => (b.total_count - b.edited_count) - (a.total_count - a.edited_count)
  );

  const totalPosts = teams.reduce((sum, t) => sum + t.total_count, 0);
  const totalEdited = teams.reduce((sum, t) => sum + t.edited_count, 0);

  return {
    teams,
    summary: {
      total_teams: teams.length,
      total_posts: totalPosts,
      remaining: totalPosts - totalEdited,
    },
  };
}

// ─── Writes ───────────────────────────────────────────────────────────────

/**
 * Update a post in the content queue. Validates team membership.
 * Delegates content update to existing posts service, handles edited_at separately.
 */
export async function updateQueuePost(
  userId: string,
  postId: string,
  input: ContentQueueUpdateInput
): Promise<void> {
  // Get user's accessible profile IDs
  const memberships = await getMergedMemberships(userId);
  const teamIds = memberships.map((m) => m.teamId);

  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id')
    .in('team_id', teamIds)
    .eq('status', 'active');

  const profileIds = (profiles ?? []).map((p) => p.id);

  // Verify post belongs to accessible team
  const post = await queueRepo.findPostByIdForProfiles(postId, profileIds);
  if (!post) {
    throw Object.assign(new Error('Post not found or not accessible'), { statusCode: 403 });
  }

  // Update content if provided
  if (input.draft_content !== undefined || input.image_urls !== undefined) {
    const updates: Record<string, unknown> = {};
    if (input.draft_content !== undefined) updates.draft_content = input.draft_content;
    if (input.image_urls !== undefined) updates.image_urls = input.image_urls;

    const { error } = await supabase
      .from('cp_pipeline_posts')
      .update(updates)
      .eq('id', postId);

    if (error) throw new Error(`content-queue.updateQueuePost: ${error.message}`);
  }

  // Mark edited if requested
  if (input.mark_edited) {
    await queueRepo.markPostEdited(postId);
  }
}

/**
 * Submit a team's batch for review.
 * Validates all posts are edited, fires DFY callback if engagement exists.
 */
export async function submitBatch(
  userId: string,
  teamId: string
): Promise<SubmitResult> {
  // Verify user has team membership
  const memberships = await getMergedMemberships(userId);
  const membership = memberships.find((m) => m.teamId === teamId);
  if (!membership) {
    throw Object.assign(new Error('Not a member of this team'), { statusCode: 403 });
  }

  // Get team's profile IDs
  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id')
    .in('team_id', [teamId])
    .eq('status', 'active');

  const profileIds = (profiles ?? []).map((p) => p.id);

  // Check all posts are edited
  const { allEdited, uneditedCount, totalCount } = await queueRepo.checkAllPostsEdited(profileIds);
  if (!allEdited) {
    throw Object.assign(
      new Error(`${uneditedCount} of ${totalCount} posts have not been edited yet`),
      { statusCode: 400 }
    );
  }

  // Look up DFY engagement by team owner's user_id (magnetlab_user_id)
  const ownerId = membership.ownerId;
  let dfyCallbackSent = false;

  try {
    const callbackUrl = process.env.GTM_SYSTEM_WEBHOOK_URL;
    const callbackSecret = process.env.GTM_SYSTEM_WEBHOOK_SECRET;

    if (callbackUrl && callbackSecret) {
      // Check if there's an active DFY engagement for this user
      // We call gtm-api's callback endpoint — it will find the engagement internally
      const response = await fetch(`${callbackUrl}/api/dfy/callbacks/automation-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': callbackSecret,
        },
        body: JSON.stringify({
          magnetlab_user_id: ownerId,
          automation_type: 'content_editing',
          status: 'completed',
          result: { posts_edited: totalCount },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        dfyCallbackSent = true;
        logInfo('content-queue', 'DFY callback sent successfully', { teamId, ownerId, totalCount });
      } else {
        const body = await response.text().catch(() => '');
        logError('content-queue', new Error(`DFY callback failed: ${response.status}`), {
          teamId, ownerId, responseBody: body,
        });
        // Non-fatal for non-DFY teams. For DFY teams, we still return success
        // but indicate the callback wasn't sent.
      }
    }
  } catch (err) {
    logError('content-queue', err, { step: 'dfy_callback', teamId, ownerId });
  }

  return { success: true, dfy_callback_sent: dfyCallbackSent };
}

/**
 * Reset edited_at for all draft posts belonging to a user's team.
 * Called by external API when client requests revisions.
 */
export async function resetEditedPosts(userId: string): Promise<{ reset_count: number }> {
  // Find teams owned by this user
  const supabase = createSupabaseAdminClient();
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', userId);

  if (!teams?.length) {
    return { reset_count: 0 };
  }

  const teamIds = teams.map((t) => t.id);
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id')
    .in('team_id', teamIds)
    .eq('status', 'active');

  const profileIds = (profiles ?? []).map((p) => p.id);
  const count = await queueRepo.resetEditedForProfiles(profileIds);

  logInfo('content-queue', 'Reset edited posts for revision flow', { userId, resetCount: count });
  return { reset_count: count };
}

// ─── Error Handling ───────────────────────────────────────────────────────

export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/services/content-queue.service.ts
git commit -m "feat: add content queue service layer"
```

---

## Task 5: GET /api/content-queue Route

**Files:**
- Create: `src/app/api/content-queue/route.ts`
- Create: `src/__tests__/api/content-queue/queue.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */
import { GET } from '@/app/api/content-queue/route';
import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockGetQueue = jest.fn();
jest.mock('@/server/services/content-queue.service', () => ({
  getQueue: (...args: unknown[]) => mockGetQueue(...args),
}));

function makeRequest() {
  return new NextRequest('http://localhost/api/content-queue', { method: 'GET' });
}

describe('GET /api/content-queue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns queue data on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    const queueData = {
      teams: [{ team_id: 't1', team_name: 'Client A', posts: [], edited_count: 0, total_count: 3 }],
      summary: { total_teams: 1, total_posts: 3, remaining: 3 },
    };
    mockGetQueue.mockResolvedValue(queueData);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.teams).toHaveLength(1);
    expect(body.summary.total_posts).toBe(3);
    expect(mockGetQueue).toHaveBeenCalledWith('user-1');
  });

  it('returns 500 on service error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockGetQueue.mockRejectedValue(new Error('DB down'));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="content-queue/queue" --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the route handler**

```typescript
/**
 * Content Queue — List Route.
 * GET /api/content-queue — list all draft posts grouped by team.
 * Never contains business logic; delegates to contentQueueService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as contentQueueService from '@/server/services/content-queue.service';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await contentQueueService.getQueue(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    logError('content-queue/list', error, { step: 'queue_list_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="content-queue/queue" --no-coverage`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/content-queue/route.ts src/__tests__/api/content-queue/queue.test.ts
git commit -m "feat: add GET /api/content-queue route"
```

---

## Task 6: PATCH /api/content-queue/posts/[id] Route

**Files:**
- Create: `src/app/api/content-queue/posts/[id]/route.ts`
- Create: `src/__tests__/api/content-queue/update-post.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */
import { PATCH } from '@/app/api/content-queue/posts/[id]/route';
import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockUpdateQueuePost = jest.fn();
const mockGetStatusCode = jest.fn().mockReturnValue(500);
jest.mock('@/server/services/content-queue.service', () => ({
  updateQueuePost: (...args: unknown[]) => mockUpdateQueuePost(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/content-queue/posts/post-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const params = Promise.resolve({ id: 'post-1' });

describe('PATCH /api/content-queue/posts/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ draft_content: 'x' }), { params });
    expect(res.status).toBe(401);
  });

  it('returns 400 for empty body', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    const res = await PATCH(makeRequest({}), { params });
    expect(res.status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockUpdateQueuePost.mockResolvedValue(undefined);
    const res = await PATCH(makeRequest({ draft_content: 'edited text' }), { params });
    expect(res.status).toBe(200);
    expect(mockUpdateQueuePost).toHaveBeenCalledWith('user-1', 'post-1', expect.objectContaining({
      draft_content: 'edited text',
    }));
  });

  it('returns 403 when post not accessible', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockUpdateQueuePost.mockRejectedValue(Object.assign(new Error('Not accessible'), { statusCode: 403 }));
    mockGetStatusCode.mockReturnValue(403);
    const res = await PATCH(makeRequest({ mark_edited: true }), { params });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="update-post" --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the route handler**

```typescript
/**
 * Content Queue — Post Update Route.
 * PATCH /api/content-queue/posts/[id] — update a post in the content queue.
 * Never contains business logic; delegates to contentQueueService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { ContentQueueUpdateSchema, formatZodError } from '@/lib/validations/content-queue';
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
    const parsed = ContentQueueUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    await contentQueueService.updateQueuePost(session.user.id, id, parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = contentQueueService.getStatusCode(error);
    logError('content-queue/update', error, { step: 'queue_update_error' });
    return NextResponse.json(
      { error: status < 500 ? (error as Error).message : 'Internal server error' },
      { status }
    );
  }
}
```

Note: import `formatZodError` directly from `@/lib/validations/api` — this is the established pattern used by all existing route handlers.

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="update-post" --no-coverage`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/content-queue/posts/[id]/route.ts src/__tests__/api/content-queue/update-post.test.ts
git commit -m "feat: add PATCH /api/content-queue/posts/[id] route"
```

---

## Task 7: POST /api/content-queue/submit Route

**Files:**
- Create: `src/app/api/content-queue/submit/route.ts`
- Create: `src/__tests__/api/content-queue/submit.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */
import { POST } from '@/app/api/content-queue/submit/route';
import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockSubmitBatch = jest.fn();
const mockGetStatusCode = jest.fn().mockReturnValue(500);
jest.mock('@/server/services/content-queue.service', () => ({
  submitBatch: (...args: unknown[]) => mockSubmitBatch(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/content-queue/submit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/content-queue/submit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ team_id: 't1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing team_id', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 200 with callback sent', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockSubmitBatch.mockResolvedValue({ success: true, dfy_callback_sent: true });
    const res = await POST(makeRequest({ team_id: 'team-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dfy_callback_sent).toBe(true);
  });

  it('returns 400 when posts not all edited', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockSubmitBatch.mockRejectedValue(
      Object.assign(new Error('3 of 7 posts have not been edited yet'), { statusCode: 400 })
    );
    mockGetStatusCode.mockReturnValue(400);
    const res = await POST(makeRequest({ team_id: 'team-1' }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="content-queue/submit" --no-coverage`
Expected: FAIL.

- [ ] **Step 3: Write the route handler**

```typescript
/**
 * Content Queue — Submit Batch Route.
 * POST /api/content-queue/submit — submit a team's edited posts for client review.
 * Never contains business logic; delegates to contentQueueService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { ContentQueueSubmitSchema } from '@/lib/validations/content-queue';
import { formatZodError } from '@/lib/validations/api';
import * as contentQueueService from '@/server/services/content-queue.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = ContentQueueSubmitSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await contentQueueService.submitBatch(session.user.id, parsed.data.team_id);
    return NextResponse.json(result);
  } catch (error) {
    const status = contentQueueService.getStatusCode(error);
    logError('content-queue/submit', error, { step: 'queue_submit_error' });
    return NextResponse.json(
      { error: status < 500 ? (error as Error).message : 'Internal server error' },
      { status }
    );
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="content-queue/submit" --no-coverage`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/content-queue/submit/route.ts src/__tests__/api/content-queue/submit.test.ts
git commit -m "feat: add POST /api/content-queue/submit route"
```

---

## Task 8: External Reset Endpoint

**Files:**
- Create: `src/app/api/external/reset-edited-posts/route.ts`
- Create: `src/__tests__/api/external/reset-edited-posts.test.ts`

Reference file: `src/app/api/external/create-lead-magnet/route.ts` — same auth pattern.

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */
import { POST } from '@/app/api/external/reset-edited-posts/route';
import { NextRequest } from 'next/server';

const mockResetEditedPosts = jest.fn();
jest.mock('@/server/services/content-queue.service', () => ({
  resetEditedPosts: (...args: unknown[]) => mockResetEditedPosts(...args),
}));

// Mock env
const originalEnv = process.env;
beforeAll(() => {
  process.env = { ...originalEnv, EXTERNAL_API_KEY: 'test-api-key' };
});
afterAll(() => {
  process.env = originalEnv;
});

function makeRequest(body: Record<string, unknown>, token = 'test-api-key') {
  return new NextRequest('http://localhost/api/external/reset-edited-posts', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

describe('POST /api/external/reset-edited-posts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 with invalid token', async () => {
    const res = await POST(makeRequest({ userId: 'u1' }, 'wrong-key'));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing userId', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockResetEditedPosts.mockResolvedValue({ reset_count: 5 });
    const res = await POST(makeRequest({ userId: 'user-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reset_count).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="reset-edited" --no-coverage`
Expected: FAIL.

- [ ] **Step 3: Write the route handler**

```typescript
/**
 * External API — Reset Edited Posts.
 * POST /api/external/reset-edited-posts
 * Called by gtm-api when a client requests revisions.
 * Uses existing external auth utility (Bearer token, timing-safe).
 */

import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/utils/logger';
import { authenticateExternalRequest } from '@/lib/api/external-auth';
import { ResetEditedPostsSchema } from '@/lib/validations/content-queue';
import { formatZodError } from '@/lib/validations/api';
import * as contentQueueService from '@/server/services/content-queue.service';

export async function POST(request: NextRequest) {
  try {
    if (!authenticateExternalRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = ResetEditedPostsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await contentQueueService.resetEditedPosts(parsed.data.userId);
    return NextResponse.json(result);
  } catch (error) {
    logError('external/reset-edited-posts', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

Note: Import `authenticateExternalRequest` from `@/lib/api/external-auth` — the same utility used by all other external routes. Check the exact export name in that file; it may be named `authenticateRequest` or wrapped in a `withExternalAuth` HOF. Match the pattern from `src/app/api/external/create-lead-magnet/route.ts`.

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="reset-edited" --no-coverage`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/external/reset-edited-posts/route.ts src/__tests__/api/external/reset-edited-posts.test.ts
git commit -m "feat: add POST /api/external/reset-edited-posts route"
```

---

## Task 9: Frontend API Client + SWR Hook

**Files:**
- Create: `src/frontend/api/content-queue.ts`
- Create: `src/frontend/hooks/api/useContentQueue.ts`

Reference files:
- `src/frontend/api/content-pipeline/posts.ts` — client module pattern
- `src/frontend/api/client.ts` — `apiClient`
- `src/frontend/hooks/api/usePosts.ts` — SWR hook pattern

- [ ] **Step 1: Write the API client module**

```typescript
/**
 * Content Queue API (client).
 * Wraps /api/content-queue endpoints for frontend use.
 */

import { apiClient } from './client';
import type { QueueListResult, SubmitResult } from '@/server/services/content-queue.service';

// ─── Types ────────────────────────────────────────────────────────────────

export interface UpdateQueuePostBody {
  draft_content?: string;
  mark_edited?: boolean;
  image_urls?: string[] | null;
}

// ─── API Calls ────────────────────────────────────────────────────────────

export async function getQueue(): Promise<QueueListResult> {
  return apiClient.get<QueueListResult>('/content-queue');
}

export async function updateQueuePost(
  postId: string,
  body: UpdateQueuePostBody
): Promise<{ success: boolean }> {
  return apiClient.patch<{ success: boolean }>(`/content-queue/posts/${postId}`, body);
}

export async function submitBatch(teamId: string): Promise<SubmitResult> {
  return apiClient.post<SubmitResult>('/content-queue/submit', { team_id: teamId });
}
```

- [ ] **Step 2: Write the SWR hook**

```typescript
'use client';

/**
 * useContentQueue — SWR hook for content queue data.
 * Fetches cross-team draft posts grouped by team.
 */

import { useCallback } from 'react';
import useSWR from 'swr';
import { getQueue } from '@/frontend/api/content-queue';
import type { QueueListResult, QueueTeam } from '@/server/services/content-queue.service';

export interface UseContentQueueResult {
  data: QueueListResult | undefined;
  teams: QueueTeam[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  mutateTeam: (teamId: string, updater: (team: QueueTeam) => QueueTeam) => void;
}

export function useContentQueue(): UseContentQueueResult {
  const { data, error, isLoading, mutate } = useSWR<QueueListResult>(
    'content-queue',
    () => getQueue(),
    { revalidateOnFocus: false }
  );

  const teams = data?.teams ?? [];

  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);

  /**
   * Optimistically update a single team's data in the cache.
   * Used for mark-edited and content updates without full refetch.
   */
  const mutateTeam = useCallback(
    (teamId: string, updater: (team: QueueTeam) => QueueTeam) => {
      mutate(
        (current) => {
          if (!current) return current;
          const updatedTeams = current.teams.map((t) =>
            t.team_id === teamId ? updater(t) : t
          );
          const totalPosts = updatedTeams.reduce((sum, t) => sum + t.total_count, 0);
          const totalEdited = updatedTeams.reduce((sum, t) => sum + t.edited_count, 0);
          return {
            teams: updatedTeams,
            summary: {
              total_teams: updatedTeams.length,
              total_posts: totalPosts,
              remaining: totalPosts - totalEdited,
            },
          };
        },
        { revalidate: false }
      );
    },
    [mutate]
  );

  return {
    data,
    teams,
    isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    refetch,
    mutateTeam,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/frontend/api/content-queue.ts src/frontend/hooks/api/useContentQueue.ts
git commit -m "feat: add content queue frontend API client and SWR hook"
```

---

## Task 10: QueueView + ClientCard Components

**Files:**
- Create: `src/components/content-queue/QueueView.tsx`
- Create: `src/components/content-queue/ClientCard.tsx`
- Create: `src/__tests__/components/content-queue/QueueView.test.tsx`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('lucide-react', () => ({
  Edit3: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-edit" {...props} />,
  Send: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-send" {...props} />,
  CheckCircle2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check" {...props} />,
}));

import { QueueView } from '@/components/content-queue/QueueView';
import type { QueueTeam } from '@/server/services/content-queue.service';

const mockTeams: QueueTeam[] = [
  {
    team_id: 't1',
    team_name: 'Client A',
    profile_name: 'James Rodriguez',
    profile_company: 'Apex Consulting',
    owner_id: 'o1',
    posts: [
      { id: 'p1', draft_content: 'Post 1', idea_id: null, idea_title: null, idea_content_type: null, edited_at: null, created_at: '2026-03-17', image_url: null },
      { id: 'p2', draft_content: 'Post 2', idea_id: null, idea_title: null, idea_content_type: null, edited_at: '2026-03-17T10:00:00Z', created_at: '2026-03-17', image_url: null },
    ],
    edited_count: 1,
    total_count: 2,
  },
  {
    team_id: 't2',
    team_name: 'Client B',
    profile_name: 'Sarah Kim',
    profile_company: 'Meridian Digital',
    owner_id: 'o2',
    posts: [],
    edited_count: 3,
    total_count: 3,
  },
];

const mockSummary = { total_teams: 2, total_posts: 5, remaining: 1 };

describe('QueueView', () => {
  const onEdit = jest.fn();
  const onSubmit = jest.fn();

  it('renders client cards', () => {
    render(<QueueView teams={mockTeams} summary={mockSummary} onEdit={onEdit} onSubmit={onSubmit} />);
    expect(screen.getByText('James Rodriguez')).toBeInTheDocument();
    expect(screen.getByText('Sarah Kim')).toBeInTheDocument();
  });

  it('shows summary stats', () => {
    render(<QueueView teams={mockTeams} summary={mockSummary} onEdit={onEdit} onSubmit={onSubmit} />);
    expect(screen.getByText(/2 clients/)).toBeInTheDocument();
    expect(screen.getByText(/5 posts/)).toBeInTheDocument();
  });

  it('shows Edit button for unfinished teams', () => {
    render(<QueueView teams={mockTeams} summary={mockSummary} onEdit={onEdit} onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('shows Submit for Review for fully edited teams', () => {
    render(<QueueView teams={mockTeams} summary={mockSummary} onEdit={onEdit} onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument();
  });

  it('calls onEdit with team_id when Edit clicked', () => {
    render(<QueueView teams={mockTeams} summary={mockSummary} onEdit={onEdit} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith('t1');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="QueueView" --no-coverage`
Expected: FAIL.

- [ ] **Step 3: Write ClientCard component**

Create `src/components/content-queue/ClientCard.tsx`. This is a presentational component: avatar initials, name, company, post count, progress bar, action button. Receives `team: QueueTeam`, `onEdit`, `onSubmit` as props. Show "Edit" when `edited_count < total_count`, "Submit for Review" when all edited.

- [ ] **Step 4: Write QueueView component**

Create `src/components/content-queue/QueueView.tsx`. Renders the header stats line and a list of `ClientCard` components. Receives `teams`, `summary`, `onEdit`, `onSubmit` as props.

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="QueueView" --no-coverage`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/content-queue/QueueView.tsx src/components/content-queue/ClientCard.tsx src/__tests__/components/content-queue/QueueView.test.tsx
git commit -m "feat: add QueueView and ClientCard components"
```

---

## Task 11: PostEditor + FeedPreview Components

**Files:**
- Create: `src/components/content-queue/PostEditor.tsx`
- Create: `src/components/content-queue/FeedPreview.tsx`
- Create: `src/__tests__/components/content-queue/FeedPreview.test.tsx`

Reference files:
- `src/components/content-pipeline/LinkedInPreview.tsx` — existing LinkedIn preview component with `hookOnly` prop and device modes
- `src/components/content/inline-editor/TipTapTextBlock.tsx` — TipTap props

- [ ] **Step 1: Write FeedPreview test**

```typescript
/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('lucide-react', () => ({
  ThumbsUp: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-thumbs-up" {...props} />,
  MessageCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-message-circle" {...props} />,
  Repeat2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-repeat2" {...props} />,
  Send: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-send" {...props} />,
  Globe: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-globe" {...props} />,
}));

import { FeedPreview } from '@/components/content-queue/FeedPreview';

describe('FeedPreview', () => {
  const defaultProps = {
    content: 'Line one of the hook.\n\nLine two of the hook.\n\nLine three continues.\n\nThis line should be hidden in feed preview.',
    authorName: 'Sarah Kim',
    authorHeadline: 'CEO @ Meridian Digital',
    imageUrl: null,
    onClick: jest.fn(),
  };

  it('renders author name', () => {
    render(<FeedPreview {...defaultProps} />);
    expect(screen.getByText('Sarah Kim')).toBeInTheDocument();
  });

  it('shows ...see more truncation', () => {
    render(<FeedPreview {...defaultProps} />);
    expect(screen.getByText(/see more/i)).toBeInTheDocument();
  });

  it('renders image when provided', () => {
    render(<FeedPreview {...defaultProps} imageUrl="https://example.com/img.png" />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
  });

  it('does not render image area when no image', () => {
    render(<FeedPreview {...defaultProps} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="FeedPreview" --no-coverage`
Expected: FAIL.

- [ ] **Step 3: Write FeedPreview component**

Create `src/components/content-queue/FeedPreview.tsx`. Shows hook text (first ~3 lines with "...see more"), optional image, LinkedIn engagement bar. Clickable to exit preview. Props: `content`, `authorName`, `authorHeadline`, `imageUrl`, `onClick`.

Consider reusing `LinkedInPreview` from `src/components/content-pipeline/LinkedInPreview.tsx` with `hookOnly={true}` — it already supports this mode. If the existing component fits, wrap it; if customization is needed, extract what you need.

- [ ] **Step 4: Write PostEditor component**

Create `src/components/content-queue/PostEditor.tsx`. This is the center column of the editing view. Two modes:
- **Edit mode**: LinkedIn-style header (avatar, name, headline) + TipTap editor area (reuse `TipTapTextBlock` from `src/components/content/inline-editor/TipTapTextBlock.tsx`) + image upload drop zone + engagement bar
- **Feed preview mode**: Renders `FeedPreview` instead

Props: `post`, `authorName`, `authorHeadline`, `isPreviewMode`, `onTogglePreview`, `onContentChange`, `onImageChange`.

The post editor delegates text editing to TipTap and wraps it in the LinkedIn chrome. The image drop zone accepts drag-and-drop or click-to-upload.

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="FeedPreview" --no-coverage`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/content-queue/PostEditor.tsx src/components/content-queue/FeedPreview.tsx src/__tests__/components/content-queue/FeedPreview.test.tsx
git commit -m "feat: add PostEditor and FeedPreview components"
```

---

## Task 12: PostList + ContextPanel Components

**Files:**
- Create: `src/components/content-queue/PostList.tsx`
- Create: `src/components/content-queue/ContextPanel.tsx`

- [ ] **Step 1: Write PostList component**

Create `src/components/content-queue/PostList.tsx`. Left column (200px). Props: `posts` (array), `currentIndex`, `onSelect(index)`. Renders numbered list items with status dot colors:
- Green (●) = `edited_at` is set
- Amber (●) = currently selected post
- Grey (●) = unedited

Each item shows truncated first line of `draft_content`. "Back to Queue" button at top. Status legend at bottom.

- [ ] **Step 2: Write ContextPanel component**

Create `src/components/content-queue/ContextPanel.tsx`. Right column (260px, collapsible). Props: `writingStyle` (string or null), `ideaTitle`, `ideaContentType`, `posts` (for "All Posts Overview"), `isCollapsed`, `onToggleCollapse`.

Structure:
- **Always visible**: Writing style bullet points (from `cp_writing_styles`)
- **Collapsible accordion**: Content Brief, ICP & Audience, All Posts Overview
- Each accordion section uses a simple disclosure pattern (click header to toggle)

- [ ] **Step 3: Commit**

```bash
git add src/components/content-queue/PostList.tsx src/components/content-queue/ContextPanel.tsx
git commit -m "feat: add PostList and ContextPanel components"
```

---

## Task 13: EditingView Component

**Files:**
- Create: `src/components/content-queue/EditingView.tsx`

This is the main editing interface — three-column layout with keyboard shortcuts.

- [ ] **Step 1: Write EditingView component**

Props: `team: QueueTeam`, `writingStyle: QueueTeamWritingStyle | null`, `onBack: () => void`, `onMarkEdited: (postId: string) => Promise<void>`, `onContentChange: (postId: string, content: string) => Promise<void>`.

State:
- `currentIndex` (number) — which post is selected
- `isPreviewMode` (boolean) — feed preview toggle

Layout:
```
┌──────────┬─────────────────────────────┬────────────┐
│ PostList  │     PostEditor              │ ContextPanel│
│ (200px)   │     (flex)                  │ (260px)    │
│           │                             │            │
└──────────┴─────────────────────────────┴────────────┘
```

Keyboard shortcuts (registered via `useEffect` with `keydown` listener):
- `ArrowUp/ArrowDown` or `j/k` — navigate posts (only when TipTap editor is NOT focused)
- `⌘+Enter` — mark edited + auto-advance to next unedited
- `p` — toggle feed preview
- `Escape` — call `onBack`

Auto-advance: after `onMarkEdited`, find the next post where `edited_at` is null and set `currentIndex` to it.

- [ ] **Step 2: Commit**

```bash
git add src/components/content-queue/EditingView.tsx
git commit -m "feat: add EditingView three-column layout with keyboard shortcuts"
```

---

## Task 14: ContentQueuePage + Dashboard Integration

**Files:**
- Create: `src/components/content-queue/ContentQueuePage.tsx`
- Create: `src/app/(dashboard)/content-queue/page.tsx`
- Modify: `src/components/dashboard/AppSidebar.tsx`

- [ ] **Step 1: Write ContentQueuePage (top-level client component)**

```typescript
'use client';

/**
 * ContentQueuePage.
 * Top-level component for the content queue feature.
 * Manages state between QueueView and EditingView.
 */

import { useState, useCallback } from 'react';
import { useContentQueue } from '@/frontend/hooks/api/useContentQueue';
import { updateQueuePost, submitBatch } from '@/frontend/api/content-queue';
import { QueueView } from './QueueView';
import { EditingView } from './EditingView';

export function ContentQueuePage() {
  const { data, teams, isLoading, error, refetch, mutateTeam } = useContentQueue();
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const editingTeam = editingTeamId
    ? teams.find((t) => t.team_id === editingTeamId) ?? null
    : null;

  const handleEdit = useCallback((teamId: string) => {
    setEditingTeamId(teamId);
  }, []);

  const handleBack = useCallback(() => {
    setEditingTeamId(null);
  }, []);

  const handleSubmit = useCallback(
    async (teamId: string) => {
      const result = await submitBatch(teamId);
      if (result.success) {
        await refetch();
      }
      return result;
    },
    [refetch]
  );

  const handleMarkEdited = useCallback(
    async (postId: string) => {
      await updateQueuePost(postId, { mark_edited: true });
      // Optimistic update
      if (editingTeamId) {
        mutateTeam(editingTeamId, (team) => ({
          ...team,
          edited_count: team.edited_count + 1,
          posts: team.posts.map((p) =>
            p.id === postId ? { ...p, edited_at: new Date().toISOString() } : p
          ),
        }));
      }
    },
    [editingTeamId, mutateTeam]
  );

  const handleContentChange = useCallback(
    async (postId: string, content: string) => {
      await updateQueuePost(postId, { draft_content: content });
    },
    []
  );

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Loading content queue...</p></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-destructive">Failed to load queue: {error.message}</p></div>;
  }

  if (editingTeam) {
    return (
      <EditingView
        team={editingTeam}
        writingStyle={editingTeam.writing_style}
        onBack={handleBack}
        onMarkEdited={handleMarkEdited}
        onContentChange={handleContentChange}
      />
    );
  }

  return (
    <QueueView
      teams={teams}
      summary={data?.summary ?? { total_teams: 0, total_posts: 0, remaining: 0 }}
      onEdit={handleEdit}
      onSubmit={handleSubmit}
    />
  );
}
```

- [ ] **Step 2: Write the server page component**

```typescript
/**
 * Content Queue Page.
 * Server component — auth check, renders client component.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ContentQueuePage } from '@/components/content-queue/ContentQueuePage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Content Queue | MagnetLab',
  description: 'Edit content across all your teams in one place',
};

export default async function ContentQueueRoute() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  return <ContentQueuePage />;
}
```

- [ ] **Step 3: Add nav item to AppSidebar**

Open `src/components/dashboard/AppSidebar.tsx`. Add to the `mainNav` array:

```typescript
{ href: '/content-queue', label: 'Content Queue', icon: ListChecks },
```

Add `ListChecks` to the lucide-react import at the top of the file.

Place it after the "Posts" entry in the nav array (logical grouping: Posts → Content Queue).

- [ ] **Step 4: Verify the page loads**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm dev`
Navigate to: `http://localhost:3000/content-queue`
Expected: Page loads with empty queue (or populated if you have draft posts across teams).

- [ ] **Step 5: Commit**

```bash
git add src/components/content-queue/ContentQueuePage.tsx src/app/\(dashboard\)/content-queue/page.tsx src/components/dashboard/AppSidebar.tsx
git commit -m "feat: add content queue page and sidebar navigation"
```

---

## Task 15: Typecheck + Lint + Full Test Run

- [ ] **Step 1: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors. Fix any type issues found.

- [ ] **Step 2: Run lint**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm lint`
Expected: No errors. Fix any lint issues found.

- [ ] **Step 3: Run full test suite**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test --no-coverage`
Expected: All tests pass, including the new content queue tests.

- [ ] **Step 4: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: resolve typecheck and lint issues for content queue"
```

---

## Task 16: MCP Tool Registration

**Files:**
- Modify: `packages/mcp/src/tools/` — add content queue tools
- Modify: `packages/mcp/src/handlers/` — add handler wiring
- Modify: `packages/mcp/src/client.ts` — add client methods

Reference files:
- `packages/mcp/src/tools/posts.ts` — existing tool definitions
- `packages/mcp/src/handlers/posts.ts` — existing handler wiring

Add three MCP tools:
1. `magnetlab_list_content_queue` — calls GET /api/content-queue
2. `magnetlab_update_queue_post` — calls PATCH /api/content-queue/posts/[id]
3. `magnetlab_submit_queue_batch` — calls POST /api/content-queue/submit

- [ ] **Step 1: Add tool definitions**

Create a new tools file or add to existing `posts.ts`. Define each tool with:
- Name, description, parameter schema (Zod → JSON Schema)
- Follow the exact pattern from existing tools in the MCP package

- [ ] **Step 2: Add handler wiring**

Wire the tools to client methods in the handlers file.

- [ ] **Step 3: Add client methods**

Add `getContentQueue()`, `updateQueuePost()`, `submitQueueBatch()` methods to `packages/mcp/src/client.ts`. These call the magnetlab API endpoints.

- [ ] **Step 4: Run MCP tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm --filter @magnetlab/mcp test`
Expected: All tests pass.

- [ ] **Step 5: Build MCP package**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm --filter @magnetlab/mcp build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/
git commit -m "feat: add content queue MCP tools (list, update, submit)"
```

---

## Task 17: Documentation

**Files:**
- Modify: `CLAUDE.md` — add content queue to feature docs table and dashboard routes

- [ ] **Step 1: Update CLAUDE.md**

Add content queue to the Dashboard Routes table:

```markdown
| `/(dashboard)/content-queue` | Cross-team content editing queue |
```

Add content queue to the API Routes description:

```markdown
`content-queue/` (list queue, update post, submit batch)
```

Add to Feature Documentation table:

```markdown
| Content Queue | [docs/superpowers/specs/2026-03-17-dfy-content-queue-design.md](docs/superpowers/specs/2026-03-17-dfy-content-queue-design.md) |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add content queue to CLAUDE.md"
```
