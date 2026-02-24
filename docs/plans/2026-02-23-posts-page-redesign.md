# /Posts Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure /posts from a confusing 5-tab layout into a kanban-first content pipeline with optimistic UI, inline template picker, and clear workflow progression.

**Architecture:** Purely frontend reorganization — no data model changes, no new API routes, no migrations. Restructure tabs (Pipeline, Calendar, Ideas, Library, Autopilot), promote KanbanBoard as default view with hero stats, merge Templates+Inspiration into Library with actionable buttons, add inline template picker to post editor, and make all interactions optimistic with silent background refetches.

**Tech Stack:** Next.js 15 (App Router), React 18.3, TypeScript, Tailwind CSS, shadcn/ui, existing content pipeline API routes.

**Design doc:** `docs/plans/2026-02-23-posts-page-redesign-design.md`

---

## Phase 1: Tab Restructure + Pipeline Hero

### Task 1: Restructure PostsContent tabs

**Files:**
- Modify: `src/components/posts/PostsContent.tsx`

**Context:** Currently has 5 tabs defined at lines 41-47: Ideas, Drafts, Schedule, Templates, Inspiration. We need to change to: Pipeline (default), Calendar, Ideas, Library, Autopilot. Remove Drafts tab entirely, split Schedule into Pipeline + Calendar, merge Templates + Inspiration into Library.

**Step 1: Update tab definitions and imports**

Replace the tab array and dynamic imports:

```typescript
// Remove these imports:
const PostsTab = dynamic(...)  // Drafts — being removed
const PipelineTab = dynamic(...)  // Schedule — being replaced

// Add these imports:
const KanbanBoard = dynamic(
  () => import('@/components/content-pipeline/KanbanBoard').then((m) => ({ default: m.KanbanBoard })),
  { ssr: false }
);
const CalendarView = dynamic(
  () => import('@/components/content-pipeline/CalendarView').then((m) => ({ default: m.CalendarView })),
  { ssr: false }
);
const LibraryTab = dynamic(
  () => import('@/components/content-pipeline/LibraryTab').then((m) => ({ default: m.LibraryTab })),
  { ssr: false }
);

// Keep: IdeasTab, AutopilotTab, QuickWriteModal

// Update Tab type and TABS array:
type Tab = 'pipeline' | 'calendar' | 'ideas' | 'library' | 'autopilot';

const TABS: { id: Tab; label: string; icon: typeof Lightbulb }[] = [
  { id: 'pipeline', label: 'Pipeline', icon: LayoutGrid },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'autopilot', label: 'Autopilot', icon: Sparkles },
];
```

Import `Calendar` from lucide-react (add to existing import line).

**Step 2: Update tab content rendering**

Replace the Suspense content block (lines 122-133):

```tsx
<Suspense fallback={<TabLoader />}>
  {activeTab === 'pipeline' && (
    <PipelineView profileId={selectedProfileId} />
  )}
  {activeTab === 'calendar' && <CalendarView />}
  {activeTab === 'ideas' && <IdeasTab profileId={selectedProfileId} />}
  {activeTab === 'library' && <LibraryTab profileId={selectedProfileId} />}
  {activeTab === 'autopilot' && <AutopilotTab profileId={selectedProfileId} />}
</Suspense>
```

Note: `PipelineView` is a new wrapper component (Task 2) that combines hero + kanban.

**Step 3: Update default tab**

Change the default from `'ideas'` to `'pipeline'` in the useState initializer (line 62-64):

```typescript
const [activeTab, setActiveTab] = useState<Tab>(
  tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'pipeline'
);
```

**Step 4: Update QuickWriteModal onPostCreated**

Change `handleTabChange('drafts')` to `handleTabChange('pipeline')` in the onPostCreated callback (currently around line 146).

**Step 5: Verify build compiles**

Run: `npm run build 2>&1 | grep -E "(Error|✓ Compiled)" | head -5`

This will fail until we create PipelineView, LibraryTab, and CalendarView standalone — that's expected. Proceed to Tasks 2-4.

**Step 6: Commit**

```bash
git add src/components/posts/PostsContent.tsx
git commit -m "refactor: restructure /posts tabs to Pipeline, Calendar, Ideas, Library, Autopilot"
```

---

### Task 2: Create PipelineView (Hero + Kanban wrapper)

**Files:**
- Create: `src/components/content-pipeline/PipelineView.tsx`

**Context:** This wraps the existing KanbanBoard with a hero stats section above it. The hero shows 3 stat cards derived from the kanban's data. No new API calls — stats are computed from the same data the kanban fetches.

**Step 1: Create PipelineView component**

```tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Lightbulb, PenLine, CalendarCheck } from 'lucide-react';
import { KanbanBoard } from './KanbanBoard';

interface PipelineViewProps {
  profileId?: string | null;
}

interface PipelineStats {
  readyCount: number;
  writingCount: number;
  reviewingCount: number;
  scheduledThisWeek: number;
}

export function PipelineView({ profileId }: PipelineViewProps) {
  const [stats, setStats] = useState<PipelineStats>({
    readyCount: 0,
    writingCount: 0,
    reviewingCount: 0,
    scheduledThisWeek: 0,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (profileId) params.append('team_profile_id', profileId);

      const [ideasRes, postsRes] = await Promise.all([
        fetch(`/api/content-pipeline/ideas?status=extracted&limit=200${profileId ? `&team_profile_id=${profileId}` : ''}`),
        fetch(`/api/content-pipeline/posts?limit=200${profileId ? `&team_profile_id=${profileId}` : ''}`),
      ]);
      const [ideasData, postsData] = await Promise.all([
        ideasRes.json(),
        postsRes.json(),
      ]);

      const ideas = ideasData.ideas || [];
      const posts = postsData.posts || [];
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));

      setStats({
        readyCount: ideas.length,
        writingCount: posts.filter((p: { status: string }) =>
          p.status === 'draft' || p.status === 'reviewing'
        ).length,
        reviewingCount: posts.filter((p: { status: string }) =>
          p.status === 'reviewing'
        ).length,
        scheduledThisWeek: posts.filter((p: { status: string; scheduled_time?: string | null }) =>
          p.status === 'scheduled' && p.scheduled_time &&
          new Date(p.scheduled_time) <= weekEnd
        ).length,
      });
    } catch {
      // Silent failure — stats are supplementary
    }
  }, [profileId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div>
      {/* Hero Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            <p className="text-sm">Ready to Write</p>
          </div>
          <p className="mt-1 text-2xl font-semibold">{stats.readyCount}</p>
          <p className="text-xs text-muted-foreground">ideas</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <PenLine className="h-4 w-4" />
            <p className="text-sm">In Progress</p>
          </div>
          <p className="mt-1 text-2xl font-semibold">{stats.writingCount}</p>
          <p className="text-xs text-muted-foreground">
            {stats.reviewingCount > 0 ? `${stats.reviewingCount} need review` : 'posts'}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarCheck className="h-4 w-4" />
            <p className="text-sm">Scheduled</p>
          </div>
          <p className="mt-1 text-2xl font-semibold">{stats.scheduledThisWeek}</p>
          <p className="text-xs text-muted-foreground">this week</p>
        </div>
      </div>

      {/* Kanban Board */}
      <KanbanBoard key={refreshKey} onRefresh={handleRefresh} />
    </div>
  );
}
```

**Step 2: Verify it renders**

Run: `npm run build 2>&1 | grep -E "(Error|✓ Compiled)" | head -5`

**Step 3: Commit**

```bash
git add src/components/content-pipeline/PipelineView.tsx
git commit -m "feat: create PipelineView with hero stats + kanban board"
```

---

### Task 3: Rename Kanban columns

**Files:**
- Modify: `src/components/content-pipeline/KanbanBoard.tsx`

**Context:** The kanban has 4 columns with IDs `'ideas' | 'written' | 'review' | 'scheduled'`. We rename the display labels only — column IDs stay the same to avoid breaking drag-and-drop logic.

**Step 1: Find the column labels**

Look for the COLUMNS or COLUMN_STYLES config object. It should be around lines 335-345. Update the display labels:

- `ideas` label: `'Ideas'` → `'Ready'`
- `written` label: `'Written'` → `'Writing'`
- `review` label: `'Review'` → `'Approved'`
- `scheduled` label: `'Scheduled'` → `'Live'`

Also update the column header colors if they exist in COLUMN_STYLES.

**Step 2: Update bulk action button labels**

Find the bulk action rendering (around lines 449-470). Update the primary action text for each column:
- Ready column: "Write Posts" (keep as-is)
- Writing column: "Approve" (keep as-is)
- Approved column: "Schedule" (keep as-is)
- Live column: "Move to Approved" (keep as-is)

**Step 3: Sort Ready column by composite_score**

In `getColumnItems` (line 71-90), sort the ideas column by composite_score descending:

```typescript
case 'ideas':
  return ideas
    .slice()
    .sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0))
    .map((idea) => ({ type: 'idea' as const, data: idea }));
```

**Step 4: Add score badge to idea cards**

Find where idea cards render in the kanban (search for `type === 'idea'` in the card rendering). Add a score badge:

```tsx
{item.type === 'idea' && item.data.composite_score != null && (
  <span className={cn(
    'rounded-full px-1.5 py-0.5 text-xs font-semibold',
    item.data.composite_score >= 7 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
    item.data.composite_score >= 4 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
  )}>
    {item.data.composite_score.toFixed(1)}
  </span>
)}
```

**Step 5: Verify build**

Run: `npm run build 2>&1 | grep -E "(Error|✓ Compiled)" | head -5`

**Step 6: Commit**

```bash
git add src/components/content-pipeline/KanbanBoard.tsx
git commit -m "refactor: rename kanban columns Ready/Writing/Approved/Live, sort by score"
```

---

## Phase 2: Ideas Tab Improvements

### Task 4: Add score badge + default sort to IdeasTab

**Files:**
- Modify: `src/components/content-pipeline/IdeasTab.tsx`

**Context:** Ideas grid currently shows all ideas with no priority signal. We add a visible score badge, default sort by composite_score, and a sort dropdown.

**Step 1: Add sort state**

After the existing filter states (around line 52), add:

```typescript
const [sortBy, setSortBy] = useState<'score' | 'newest' | 'type'>('score');
```

**Step 2: Sort filtered ideas**

Replace the `filteredIdeas` logic (line 117-122) to include sorting:

```typescript
const filteredIdeas = (searchQuery
  ? ideas.filter((idea) =>
      idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.core_insight?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  : ideas
).slice().sort((a, b) => {
  switch (sortBy) {
    case 'score':
      return (b.composite_score ?? 0) - (a.composite_score ?? 0);
    case 'newest':
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    case 'type':
      return (a.content_type ?? '').localeCompare(b.content_type ?? '');
    default:
      return 0;
  }
});
```

**Step 3: Add sort dropdown to filter bar**

Add a sort selector next to the Filters button (after line 157):

```tsx
<div className="relative">
  <select
    value={sortBy}
    onChange={(e) => setSortBy(e.target.value as 'score' | 'newest' | 'type')}
    className="appearance-none rounded-lg border bg-background px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
  >
    <option value="score">Highest Score</option>
    <option value="newest">Newest</option>
    <option value="type">Content Type</option>
  </select>
  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
</div>
```

**Step 4: Add score badge to idea cards**

In the idea card rendering (around line 213-221, the badges area), add a score badge after pillar/status badges:

```tsx
{idea.composite_score != null && (
  <span className={cn(
    'rounded-full px-2 py-0.5 text-xs font-semibold',
    idea.composite_score >= 7 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
    idea.composite_score >= 4 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
  )}>
    {idea.composite_score.toFixed(1)}
  </span>
)}
```

**Step 5: Verify build**

Run: `npm run build 2>&1 | grep -E "(Error|✓ Compiled)" | head -5`

**Step 6: Commit**

```bash
git add src/components/content-pipeline/IdeasTab.tsx
git commit -m "feat: add score badges + default sort by composite_score to Ideas tab"
```

---

### Task 5: Add "Write Post" button to IdeaDetailModal

**Files:**
- Modify: `src/components/content-pipeline/IdeaDetailModal.tsx`

**Context:** The IdeaDetailModal currently shows full idea context but the "Write Post" button is only available if status is `extracted` or `selected` (lines 125-133). It's present but users report it's hard to find. Verify it exists and ensure it's prominent.

**Step 1: Make the Write Post button more prominent**

The button already exists at lines 125-133. Make it full-width and primary-colored instead of small:

```tsx
{(idea.status === 'extracted' || idea.status === 'selected') && (
  <button
    onClick={() => onWritePost(idea.id)}
    disabled={writing}
    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
  >
    {writing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
    {writing ? 'Writing...' : 'Write Post from This Idea'}
  </button>
)}
```

Import `Sparkles` from lucide-react if not already imported.

Move this button to be the FIRST action in the footer (before Archive and Close), making it the most prominent CTA.

**Step 2: Verify build**

Run: `npm run build 2>&1 | grep -E "(Error|✓ Compiled)" | head -5`

**Step 3: Commit**

```bash
git add src/components/content-pipeline/IdeaDetailModal.tsx
git commit -m "feat: make Write Post button prominent in idea detail modal"
```

---

## Phase 3: Library Tab (Templates + Inspiration)

### Task 6: Create LibraryTab component

**Files:**
- Create: `src/components/content-pipeline/LibraryTab.tsx`

**Context:** Merges the existing TemplatesTab and SwipeFileContent (Inspiration) into a single tab with two sub-sections toggled by pills. Adds "Use This" and "Write Like This" action buttons.

**Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const TemplatesTab = dynamic(
  () => import('@/components/content-pipeline/TemplatesTab').then((m) => ({ default: m.TemplatesTab })),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
);
const SwipeFileContent = dynamic(
  () => import('@/components/swipe-file/SwipeFileContent').then((m) => ({ default: m.SwipeFileContent })),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
);

type LibrarySection = 'templates' | 'inspiration';

interface LibraryTabProps {
  profileId?: string | null;
}

export function LibraryTab({ profileId: _profileId }: LibraryTabProps) {
  const [section, setSection] = useState<LibrarySection>('templates');

  return (
    <div>
      {/* Section pills */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setSection('templates')}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            section === 'templates'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary hover:bg-secondary/80'
          )}
        >
          Templates
        </button>
        <button
          onClick={() => setSection('inspiration')}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            section === 'inspiration'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary hover:bg-secondary/80'
          )}
        >
          Inspiration
        </button>
      </div>

      {/* Section content */}
      {section === 'templates' && <TemplatesTab />}
      {section === 'inspiration' && <SwipeFileContent />}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | grep -E "(Error|✓ Compiled)" | head -5`

**Step 3: Commit**

```bash
git add src/components/content-pipeline/LibraryTab.tsx
git commit -m "feat: create LibraryTab merging Templates + Inspiration"
```

---

### Task 7: Add "Use This" buttons to TemplatesTab

**Files:**
- Modify: `src/components/content-pipeline/TemplatesTab.tsx`

**Context:** Template cards currently only have edit/delete. We add a "Use This" button that copies the template structure to clipboard with a toast notification. Full inline-picker integration in the post editor comes in Task 9.

**Step 1: Read TemplatesTab fully to find the template card rendering**

Find where each template card renders its action buttons. Add a "Use This" button:

```tsx
<button
  onClick={async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(template.structure);
    // Show a brief "Copied!" state
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
  }}
  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
>
  {copiedId === template.id ? (
    <><Check className="h-3 w-3" /> Copied</>
  ) : (
    'Use This'
  )}
</button>
```

Add `copiedId` state: `const [copiedId, setCopiedId] = useState<string | null>(null);`

Import `Check` from lucide-react.

**Step 2: Verify build**

Run: `npm run build 2>&1 | grep -E "(Error|✓ Compiled)" | head -5`

**Step 3: Commit**

```bash
git add src/components/content-pipeline/TemplatesTab.tsx
git commit -m "feat: add Use This button to template cards"
```

---

## Phase 4: Inline Template Picker in Post Editor

### Task 8: Add template picker to PostDetailModal

**Files:**
- Modify: `src/components/content-pipeline/PostDetailModal.tsx`

**Context:** PostDetailModal already has a toolbar with Edit, Polish, Copy, Schedule, Publish buttons (lines 623-664). We add a "Templates" icon button that opens a compact overlay showing the user's templates. Clicking a template inserts its structure into the editor.

**Step 1: Add template picker state and fetch**

After existing state declarations (around line 51), add:

```typescript
const [showTemplatePicker, setShowTemplatePicker] = useState(false);
const [templates, setTemplates] = useState<{ id: string; name: string; structure: string; category: string | null }[]>([]);
const [templatesLoading, setTemplatesLoading] = useState(false);
```

Add a fetch function:

```typescript
const fetchTemplates = useCallback(async () => {
  if (templates.length > 0) return; // Already loaded
  setTemplatesLoading(true);
  try {
    const res = await fetch('/api/content-pipeline/templates?scope=mine');
    const data = await res.json();
    setTemplates(data.templates || []);
  } catch {
    // Silent failure
  } finally {
    setTemplatesLoading(false);
  }
}, [templates.length]);
```

**Step 2: Add template button to toolbar**

In the toolbar (around lines 623-664), add a Templates button before the Edit button:

```tsx
<button
  onClick={() => {
    fetchTemplates();
    setShowTemplatePicker(!showTemplatePicker);
  }}
  className={cn(
    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
    showTemplatePicker
      ? "bg-primary text-primary-foreground"
      : "border border-border hover:bg-muted"
  )}
  title="Insert template"
>
  <FileText className="h-4 w-4" />
  Templates
</button>
```

Import `FileText` from lucide-react if not already.

**Step 3: Add template picker overlay**

Below the toolbar div, add the template picker overlay:

```tsx
{showTemplatePicker && (
  <div className="rounded-lg border bg-card p-3 space-y-2 max-h-48 overflow-y-auto">
    {templatesLoading ? (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    ) : templates.length === 0 ? (
      <p className="text-xs text-muted-foreground py-2 text-center">
        No templates yet. Create some in the Library tab.
      </p>
    ) : (
      templates.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            setEditContent(t.structure);
            setEditing(true);
            setShowTemplatePicker(false);
          }}
          className="w-full text-left rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <span className="font-medium">{t.name}</span>
          {t.category && (
            <span className="ml-2 text-xs text-muted-foreground">{t.category}</span>
          )}
        </button>
      ))
    )}
  </div>
)}
```

**Step 4: Verify build**

Run: `npm run build 2>&1 | grep -E "(Error|✓ Compiled)" | head -5`

**Step 5: Commit**

```bash
git add src/components/content-pipeline/PostDetailModal.tsx
git commit -m "feat: add inline template picker to post detail modal"
```

---

## Phase 5: Calendar + Autopilot Standalone

### Task 9: Make CalendarView a standalone tab

**Files:**
- Modify: `src/components/posts/PostsContent.tsx` (already done in Task 1 — CalendarView imported and rendered)

**Context:** CalendarView is already imported as a standalone component. Verify it works standalone without PipelineTab wrapping it. If CalendarView expects props from PipelineTab, we may need to pass them directly.

**Step 1: Read CalendarView to check props**

Check what props CalendarView expects. If it expects `onRefresh` or similar from PipelineTab, wire those up. Most likely it fetches its own data.

**Step 2: Verify calendar renders standalone**

Run: `npm run build 2>&1 | grep -E "(Error|✓ Compiled)" | head -5`

If CalendarView needs any wrapper state, create a minimal wrapper inline in PostsContent.

**Step 3: Commit if any changes needed**

```bash
git add src/components/posts/PostsContent.tsx
git commit -m "fix: wire CalendarView as standalone tab"
```

---

### Task 10: Add buffer alert badge to Autopilot tab label

**Files:**
- Modify: `src/components/posts/PostsContent.tsx`

**Context:** AutopilotTab is already a standalone component with its own data fetching. We just need to show a yellow dot on the tab label when buffer is low. Since we don't want to add a fetch just for the tab badge, we'll add a simple buffer count fetch to PostsContent.

**Step 1: Add buffer count state**

```typescript
const [bufferLow, setBufferLow] = useState(false);

useEffect(() => {
  fetch('/api/content-pipeline/schedule/buffer')
    .then((r) => r.json())
    .then((data) => {
      const count = data.posts?.length ?? 0;
      setBufferLow(count < 3);
    })
    .catch(() => {});
}, []);
```

**Step 2: Add dot to Autopilot tab label**

In the tab rendering (around line 105-118), add a conditional dot after the Autopilot label:

```tsx
{tab.label}
{tab.id === 'autopilot' && bufferLow && (
  <span className="ml-1 h-2 w-2 rounded-full bg-yellow-500" />
)}
```

**Step 3: Verify build**

Run: `npm run build 2>&1 | grep -E "(Error|✓ Compiled)" | head -5`

**Step 4: Commit**

```bash
git add src/components/posts/PostsContent.tsx
git commit -m "feat: add low-buffer warning dot to Autopilot tab"
```

---

## Phase 6: Optimistic UI Hardening

### Task 11: Add optimistic drag-and-drop to KanbanBoard

**Files:**
- Modify: `src/components/content-pipeline/KanbanBoard.tsx`

**Context:** The kanban board already has drag-and-drop. Check if it currently does a full refetch after drag or if it updates locally. If it refetches, make it optimistic: move the card instantly, fire API in background, revert on failure.

**Step 1: Read the drag handler**

Find the `handleDrop` or `onDragEnd` handler. Check if it calls `fetchData()` after the API call.

**Step 2: Make it optimistic**

If the drag handler does `fetchData()` after success, change it to:
1. Move the card in local state immediately (update ideas/posts arrays)
2. Fire the API call in background
3. On failure: revert the local state change and show a toast/revert

Pattern:
```typescript
// Optimistic: update local state immediately
setPosts((prev) => prev.map((p) =>
  p.id === postId ? { ...p, status: newStatus } : p
));

// Fire API in background
fetch(`/api/content-pipeline/posts/${postId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: newStatus }),
}).then((res) => {
  if (!res.ok) {
    // Revert on failure
    setPosts((prev) => prev.map((p) =>
      p.id === postId ? { ...p, status: oldStatus } : p
    ));
  }
}).catch(() => {
  // Revert on failure
  setPosts((prev) => prev.map((p) =>
    p.id === postId ? { ...p, status: oldStatus } : p
  ));
});
```

**Step 3: Make fetchData silent after initial load**

Add `silent` parameter to `fetchData`:

```typescript
const fetchData = useCallback(async (silent = false) => {
  if (!silent) setLoading(true); // Only show loader on initial fetch
  // ... rest of fetch logic
}, []);
```

Change the `useEffect` initial call to `fetchData(false)` and any refetch calls (e.g., after bulk actions) to `fetchData(true)`.

**Step 4: Verify build**

Run: `npm run build 2>&1 | grep -E "(Error|✓ Compiled)" | head -5`

**Step 5: Commit**

```bash
git add src/components/content-pipeline/KanbanBoard.tsx
git commit -m "feat: optimistic drag-and-drop + silent refetches in kanban"
```

---

### Task 12: Add optimistic bulk actions to KanbanBoard

**Files:**
- Modify: `src/components/content-pipeline/KanbanBoard.tsx`

**Context:** Bulk actions (Write Posts, Approve, Schedule) currently wait for API response before updating UI. Make them optimistic.

**Step 1: Read bulk action handlers**

Find `handleBulkPrimary` (around lines 221-268). For each column action:

- **Ideas → Write Posts**: Currently removes ideas from local state optimistically (already done per audit). Verify.
- **Written → Approve**: Update selected posts' status to 'approved' instantly.
- **Review → Schedule**: Update selected posts' status to 'scheduled' instantly.
- **Scheduled → Move to Approved**: Update selected posts' status to 'approved' instantly.

**Step 2: Apply optimistic pattern to each action**

For the approve/schedule/move-back actions, apply the same pattern: update local state immediately, fire API in background, revert on failure.

**Step 3: Clear selection after optimistic update**

After updating local state, clear `selectedIds` immediately so the selection bar disappears:

```typescript
setSelectedIds(new Set());
```

**Step 4: Verify build**

Run: `npm run build 2>&1 | grep -E "(Error|✓ Compiled)" | head -5`

**Step 5: Commit**

```bash
git add src/components/content-pipeline/KanbanBoard.tsx
git commit -m "feat: optimistic bulk actions in kanban board"
```

---

## Phase 7: Final Polish + Cleanup

### Task 13: Remove dead imports and PipelineTab usage

**Files:**
- Modify: `src/components/posts/PostsContent.tsx`

**Context:** After the restructure, PipelineTab.tsx is no longer used from PostsContent (it was replaced by PipelineView + standalone CalendarView). Clean up any remaining dead imports.

**Step 1: Remove unused imports**

Remove the `PipelineTab` dynamic import if it still exists. Remove the `PostsTab` dynamic import (Drafts tab removed).

**Step 2: Verify no other files import PipelineTab**

Search for imports of PipelineTab across the codebase. If nothing else uses it, it can be left as-is (don't delete files that might be used elsewhere).

**Step 3: Final build verification**

Run: `npm run build 2>&1 | tail -5`

Expected: `✓ Compiled successfully` with no errors.

**Step 4: Commit**

```bash
git add src/components/posts/PostsContent.tsx
git commit -m "chore: remove dead imports after /posts restructure"
```

---

### Task 14: Full integration test

**Step 1: Run the full test suite**

Run: `npm run test 2>&1 | tail -20`

Fix any failures caused by the restructure (likely test files referencing old tab names or PostsTab imports).

**Step 2: Run build**

Run: `npm run build 2>&1 | tail -10`

**Step 3: Deploy to Vercel**

Run: `vercel --prod`

Wait for successful deployment.

**Step 4: Final commit if any test fixes needed**

```bash
git add -A
git commit -m "fix: resolve test failures from /posts restructure"
```

---

## Summary

| Phase | Tasks | What Changes |
|-------|-------|--------------|
| **1. Tab Restructure** | Tasks 1-3 | New tab layout, PipelineView, kanban column rename |
| **2. Ideas Improvements** | Tasks 4-5 | Score badges, sort, prominent Write Post in modal |
| **3. Library Tab** | Tasks 6-7 | Merged Templates+Inspiration, Use This buttons |
| **4. Template Picker** | Task 8 | Inline template picker in post editor |
| **5. Calendar + Autopilot** | Tasks 9-10 | Standalone tabs, buffer alert badge |
| **6. Optimistic UI** | Tasks 11-12 | Optimistic drag-drop + bulk actions |
| **7. Cleanup** | Tasks 13-14 | Dead imports, tests, deploy |
