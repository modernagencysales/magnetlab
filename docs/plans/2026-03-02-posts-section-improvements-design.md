# Posts Section Improvements Design

**Date:** 2026-03-02
**Status:** Approved

## Problem

The Posts section is too rigid around transcript → idea → post. Teams starting fresh or wanting to write on-the-fly hit dead ends. Additionally, ideas created before team system have `team_profile_id = NULL` and vanish when switching to team context.

## Changes

### 1. Ideas scoping bug fix
- API route (`/api/content-pipeline/ideas`): when `teamId` is set, include ideas where `team_profile_id` is in the team's active profiles OR `user_id` matches any team member (backward compat for pre-team ideas)
- Run backfill: set `team_profile_id` on orphaned ideas owned by team members

### 2. "Create Post" entry points (3 new)
- **Sidebar Create dropdown**: add "Post" option → opens Quick Write modal
- **Pipeline tab header**: add "+ New Post" button → opens Quick Write modal
- **Calendar tab**: click any empty date cell → opens Quick Write with date pre-filled

### 3. Quick Write modal upgrade
- Current: AI-only (type a thought → AI generates draft)
- New: two-tab modal — "AI Draft" (existing) + "Write Manually" (blank editor with textarea)
- Both create a `cp_pipeline_posts` row with `status: 'draft'`
- When opened from Calendar, pre-set `scheduled_time` to clicked date

### 4. Empty state overhaul
- Pipeline "No items" → "Write your first post" primary button + "or import transcripts" secondary
- Ideas "No ideas" → "Quick Write from scratch" button + "or upload transcripts" secondary
- Calendar "No posts" → "Click any date to create a post" instruction
- All empty states point to Quick Write as zero-dependency path

### 5. Quick Write FAB improvement
- Add text label "New Post" next to sparkles icon (not icon-only)
- Keep visible across all tabs

## Key Files

- `src/app/api/content-pipeline/ideas/route.ts` — scoping bug fix
- `src/components/content-pipeline/QuickWriteModal.tsx` — add manual write tab + scheduled date prop
- `src/components/content-pipeline/PipelineView.tsx` — empty state + header button
- `src/components/content-pipeline/IdeasTab.tsx` — empty state
- `src/components/content-pipeline/CalendarView.tsx` — click-to-create on dates
- `src/components/posts/PostsContent.tsx` — FAB label + Quick Write modal props
- `src/components/dashboard/DashboardNav.tsx` — add "Post" to Create dropdown
