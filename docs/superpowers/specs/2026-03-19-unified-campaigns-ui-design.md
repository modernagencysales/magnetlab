# Unified Campaigns UI — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Repo:** magnetlab

## Problem

The sidebar has three LinkedIn-related items (Automations, Signals, Post Campaigns) and the new Outreach Sequence Engine has no UI at all. Adding a fourth sidebar item makes it worse. "Automations" is deprecated (replaced by Post Campaigns). The navigation is confusing.

## Solution

Consolidate into one "Campaigns" sidebar entry that shows both outreach and post campaigns in a unified list. Add a minimal outreach campaign detail page. Remove deprecated "Automations" entry.

## Non-Goals

- Activity log UI (queryable via MCP, defer)
- Moving existing post campaign routes (keep `/post-campaigns/[id]` as-is)
- Post campaign creation from the campaigns page (created from post flow)
- Tab bar / complex filtering (simple dropdown filter for v1)

---

## Sidebar Changes

**Remove:**
- `Automations` (line 99 in `AppSidebar.tsx` — deprecated, post campaigns replaced it)
- `Post Campaigns` (line 102 — absorbed into unified Campaigns)

**Add:**
- `Campaigns` at the same position, icon: `Megaphone`

```typescript
{ href: '/campaigns', label: 'Campaigns', icon: Megaphone, activePrefix: '/campaigns' },
```

**Keep:**
- `Signals` (line 101) — unchanged

**Active state:** The sidebar highlights "Campaigns" when on `/campaigns` OR `/post-campaigns` (both prefixes). Update `isRouteActive` or add a second `activePrefix` check.

**Result:** Sidebar goes from 3 LinkedIn items to 2 (Campaigns, Signals).

---

## Pages

### 1. Campaigns List — `/(dashboard)/campaigns/page.tsx`

**Fetches from:** `GET /api/outreach-campaigns` + `GET /api/post-campaigns`

**Layout:**
- Page header: "Campaigns" with "New Outreach Campaign" button (top right)
- Filter dropdown: All | Outreach | Post Campaign
- Status filter: All | Draft | Active | Paused | Completed
- Table rows:

| Column | Content |
|--------|---------|
| Name | Campaign name |
| Type | Badge: "Outreach" (blue) or "Post" (purple) |
| Details | Preset name for outreach, keyword for post campaigns |
| Status | Badge: draft/active/paused/completed |
| Leads | Total lead count |
| Created | Relative date |

- Click row → navigates to detail:
  - Outreach: `/campaigns/[id]`
  - Post: `/post-campaigns/[id]` (existing page)

**Server component** — fetches both campaign lists, merges, sorts by created_at DESC.

### 2. New Outreach Campaign — `/(dashboard)/campaigns/new/page.tsx`

**Simple form:**
- Campaign name (text input)
- Preset (select: Warm Connect / Direct Connect / Nurture) — with one-line description for each
- LinkedIn account (select from connected Unipile accounts)
- Connection note (optional textarea)
- First message template (textarea, with `{{name}}` and `{{company}}` variable hints)
- Follow-up template (optional textarea)
- Follow-up delay (number, default 3 days)
- Withdraw delay (number, default 7 days)

**On submit:** `POST /api/outreach-campaigns` → redirect to `/campaigns/[id]`

Campaign is created in `draft` status. User adds leads and activates from the detail page.

### 3. Outreach Campaign Detail — `/(dashboard)/campaigns/[id]/page.tsx`

**Header:**
- Campaign name (editable inline)
- Preset badge (warm_connect / direct_connect / nurture)
- Status badge
- Action buttons: Activate (if draft/paused) | Pause (if active) | Delete

**Stats row (5 cards):**

| Card | Value | Source |
|------|-------|--------|
| Total | count all leads | stats.total |
| In Progress | pending + active | stats.pending + stats.active |
| Connected | count where connected_at set | progress.connected |
| Replied | count with replied status | stats.replied |
| Failed/Withdrawn | failed + withdrawn | stats.failed + stats.withdrawn |

**Lead management section:**
- "Add Leads" button → modal or inline form: paste LinkedIn URLs (one per line), optional name/company columns
- Lead table:

| Column | Content |
|--------|---------|
| Name | Lead name (or LinkedIn username) |
| Company | Company name |
| Status | Badge: pending/active/completed/replied/withdrawn/failed/skipped |
| Step | Current progress: viewed → connected → messaged → followed up |
| Error | Error message if failed |
| Actions | Skip button |

- Filter by status
- Pagination (50 per page)

**API calls:**
- `GET /api/outreach-campaigns/[id]` — campaign + stats + progress
- `GET /api/outreach-campaigns/[id]/leads?status=X` — lead list
- `POST /api/outreach-campaigns/[id]/activate`
- `POST /api/outreach-campaigns/[id]/pause`
- `POST /api/outreach-campaigns/[id]/leads` — bulk add
- `POST /api/outreach-campaigns/[id]/leads/[leadId]/skip`
- `DELETE /api/outreach-campaigns/[id]`

---

## File Structure

### New Files

```
src/app/(dashboard)/campaigns/page.tsx              — unified list (server component)
src/app/(dashboard)/campaigns/new/page.tsx           — new outreach campaign form
src/app/(dashboard)/campaigns/[id]/page.tsx          — outreach campaign detail

src/components/campaigns/CampaignsList.tsx           — list table with type badges + filters
src/components/campaigns/OutreachCampaignDetail.tsx  — detail view (stats + lead table)
src/components/campaigns/OutreachCampaignForm.tsx    — create/edit form
src/components/campaigns/AddLeadsModal.tsx           — bulk add leads modal
src/components/campaigns/LeadTable.tsx               — lead list with status + actions
```

### Modified Files

```
src/components/dashboard/AppSidebar.tsx              — remove Automations + Post Campaigns, add Campaigns
```

### Deleted Files

```
src/app/(dashboard)/automations/page.tsx             — deprecated page
```

---

## No Backend Changes

All API routes already exist from the Outreach Sequence Engine implementation. The frontend calls them directly. No new API routes, services, or repos needed.

---

## Component Patterns

Follow existing patterns from the codebase:
- Server components for page-level data fetching
- Client components (`"use client"`) for interactive elements (forms, modals, filters)
- shadcn/ui components from `@magnetlab/magnetui` (Table, Badge, Button, Select, Dialog, Input, Textarea)
- Tailwind for styling
- `fetch('/api/...')` via `src/frontend/api/` module (if one exists) or direct server-side Supabase calls in server components
