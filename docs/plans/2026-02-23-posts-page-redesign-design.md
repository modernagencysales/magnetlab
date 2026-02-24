# /Posts Page Redesign — Design Document

**Goal:** Restructure the /posts page from a confusing 5-tab layout into a kanban-first content pipeline that makes it fast to pick ideas, edit drafts, and schedule content.

**Approach:** Kanban-first with inline template picker. No data model changes, no new APIs, no migrations — purely frontend reorganization + wiring.

---

## New Tab Structure

```
/posts
├─ Pipeline (DEFAULT) — Kanban board + hero stats
├─ Calendar — Week/month scheduling view
├─ Ideas — Searchable grid, sorted by score
├─ Library — Templates + Inspiration combined, with "Use This" actions
└─ Autopilot — Schedule slots, buffer status, run button
```

**Removed:** "Drafts" tab (replaced by Kanban), "Schedule" tab (split into Pipeline + Calendar)

**Merged:** "Templates" + "Inspiration" → "Library"

---

## Pipeline Tab (Default Landing)

### Hero Section

3 stat cards above the kanban:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  12 Ready       │  │  3 Writing      │  │  5 Scheduled    │
│  ideas to write │  │  1 needs review │  │  this week      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

Clicking a stat card scrolls to / highlights that Kanban column. Stats derived from local state (not refetched).

### Kanban Board

Existing KanbanBoard component promoted to full width. Columns renamed:

| Old Name | New Name | Contents |
|----------|----------|----------|
| Ideas | **Ready** | Extracted ideas, sorted by composite_score |
| Written | **Writing** | Drafts + reviewing posts |
| Review | **Approved** | Passed review, ready to schedule |
| Scheduled | **Live** | Scheduled + published, with time badges |

Profile switcher stays in header, filters the entire board. Quick Write FAB stays bottom-right.

---

## Optimistic UI + Background Tasks (Design Constraint)

**Rule: Every user action updates the UI instantly. API calls happen in the background. Refetches are always silent.**

| Action | Optimistic behavior | On failure |
|--------|-------------------|------------|
| Drag card between columns | Card moves instantly, status PATCH fires in background | Card snaps back + toast error |
| Write Post from idea | Card shows "Writing..." badge, moves to Writing column. API generates in background | Card reverts + toast |
| Polish / Approve / Schedule | Status badge updates instantly, API in background | Revert + toast |
| Delete | Card disappears instantly | Card reappears + toast |
| Bulk actions | All selected cards update instantly, APIs fire in parallel | Failed cards revert |
| Hero stats | Derived from local state, update as cards move | N/A |

**Implementation pattern:** `fetchPosts`/`fetchIdeas` use `silent = true` after initial load. Full-page spinner only on first mount.

Applies to ALL tabs — Pipeline, Calendar, Ideas, Library, Autopilot.

---

## Ideas Tab

- **Default sort:** composite_score descending (highest priority first)
- **Score badge** visible on every card (colored pill: green 7+, yellow 4-7, gray <4)
- **Simplified card:** Title, content type pill, score badge, pillar badge, "Write Post" button
- **Click card** → IdeaDetailModal (full context, hook, key points, source quote)
- **"Write Post" in modal too** — currently missing, needs to be added
- **Sort dropdown:** Score (default), Newest, Content Type
- **Optimistic:** "Write Post" instantly moves idea to Pipeline's Writing column

---

## Library Tab (Templates + Inspiration)

Two sub-sections toggled by pills: `[Templates]  [Inspiration]`

### Templates Section

Same browse/search as today, plus:

- **"Use This" button** on each template card → opens QuickWriteModal with template structure pre-populated as `[PLACEHOLDER]` markers
- **Inline picker in PostDetailModal** → small "Templates" icon button in toolbar → compact card grid overlay → clicking template inserts structure at cursor

### Inspiration Section

Same swipe file browse, plus:

- **"Use Hook" button** → copies opening line to clipboard + toast
- **"Write Like This" button** → opens QuickWriteModal with pre-filled prompt referencing the post's structure/tone

No data model changes.

---

## Calendar Tab

Existing CalendarView promoted to standalone tab. One addition:

- **Click empty date slot** → opens QuickWriteModal with `scheduled_time` pre-set to that date

---

## Autopilot Tab

Existing AutopilotTab + PipelineTab buffer section promoted to standalone tab:

1. **Buffer status bar** — "4 posts in buffer" with visual fill
2. **Schedule slots** — existing posting slots CRUD
3. **"Run Autopilot" button** — triggers autopilot batch task
4. **Low buffer alert** — yellow banner if buffer < 3: "Buffer running low"
5. **Tab badge** — yellow dot on Autopilot tab label when buffer is low

---

## What's NOT Changing

- Data model (cp_content_ideas, cp_pipeline_posts, cp_post_templates, cp_posting_slots)
- API routes
- Database migrations
- PostDetailModal (existing post editor)
- KanbanBoard core logic (drag-and-drop, bulk select, detail pane)
- QuickWriteModal
- Profile switcher
- Authentication / RLS
