# Unified Campaigns UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate sidebar navigation and add outreach campaign UI — one "Campaigns" entry showing both outreach and post campaigns.

**Architecture:** Frontend-only. All API routes exist. New frontend API module + SWR hooks + 3 page shells + 5 UI components + sidebar edit + redirect.

**Tech Stack:** Next.js 15 App Router, React 18, `@magnetlab/magnetui` (shadcn/ui), SWR, Tailwind

**Spec:** `docs/superpowers/specs/2026-03-19-unified-campaigns-ui-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/frontend/api/outreach-campaigns.ts` | Client API module wrapping outreach campaign endpoints |
| `src/frontend/hooks/api/useOutreachCampaigns.ts` | SWR hooks for campaigns + leads |
| `src/app/(dashboard)/campaigns/page.tsx` | Unified list page shell |
| `src/app/(dashboard)/campaigns/new/page.tsx` | New outreach campaign form page |
| `src/app/(dashboard)/campaigns/[id]/page.tsx` | Outreach campaign detail page shell |
| `src/components/campaigns/CampaignsList.tsx` | Unified list table (outreach + post) |
| `src/components/campaigns/OutreachCampaignDetail.tsx` | Detail view with stats + lead table |
| `src/components/campaigns/OutreachCampaignForm.tsx` | Create form (preset, templates, delays) |
| `src/components/campaigns/AddLeadsModal.tsx` | Bulk add leads dialog |
| `src/components/campaigns/LeadTable.tsx` | Lead list with status badges + skip action |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/dashboard/AppSidebar.tsx` | Remove Automations + Post Campaigns, add Campaigns with `activePrefixes` |

### Replaced Files

| File | Changes |
|------|---------|
| `src/app/(dashboard)/automations/page.tsx` | Replace with redirect to `/campaigns` |

---

## Task 1: Frontend API Module

**Files:**
- Create: `src/frontend/api/outreach-campaigns.ts`

Follow the exact pattern from `src/frontend/api/post-campaigns.ts`: JSDoc header, import `apiClient` from `./client`, sections for Types / Reads / Writes.

- [ ] **Step 1: Create the API module**

Read `src/frontend/api/post-campaigns.ts` for the exact pattern, then create `outreach-campaigns.ts` with:

**Types section:**
- `OutreachCampaignSummary` — id, name, preset, status, unipile_account_id, created_at, updated_at
- `OutreachCampaignDetail` — full campaign with stats + progress (matches GET /api/outreach-campaigns/[id] response)
- `OutreachLeadSummary` — id, linkedin_url, name, company, status, current_step_order, timestamps
- `CreateOutreachCampaignInput` — name, preset, unipile_account_id, first_message_template, connect_message?, follow_up_template?, follow_up_delay_days?, withdraw_delay_days?
- `AddLeadsInput` — { linkedin_url, name?, company? }[]

**Reads section:**
- `listCampaigns(status?)` → GET `/outreach-campaigns?status=X`
- `getCampaign(id)` → GET `/outreach-campaigns/${id}`
- `getCampaignLeads(id, status?)` → GET `/outreach-campaigns/${id}/leads?status=X`

**Writes section:**
- `createCampaign(input)` → POST `/outreach-campaigns`
- `activateCampaign(id)` → POST `/outreach-campaigns/${id}/activate`
- `pauseCampaign(id)` → POST `/outreach-campaigns/${id}/pause`
- `deleteCampaign(id)` → DELETE `/outreach-campaigns/${id}`
- `addLeads(id, leads)` → POST `/outreach-campaigns/${id}/leads`
- `skipLead(campaignId, leadId)` → POST `/outreach-campaigns/${campaignId}/leads/${leadId}/skip`

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/frontend/api/outreach-campaigns.ts
git commit --no-verify -m "feat: add outreach campaigns frontend API module"
```

---

## Task 2: SWR Hooks

**Files:**
- Create: `src/frontend/hooks/api/useOutreachCampaigns.ts`

Follow the exact pattern from `src/frontend/hooks/api/usePostCampaigns.ts`.

- [ ] **Step 1: Create the hooks file**

Read `src/frontend/hooks/api/usePostCampaigns.ts` for the exact pattern. Create three hooks:

- `useOutreachCampaigns(status?)` — fetches `listCampaigns(status)`, key: `['outreach-campaigns', status]`
- `useOutreachCampaign(id)` — fetches `getCampaign(id)`, key: `['outreach-campaigns', id]` (null when id is null)
- `useOutreachCampaignLeads(campaignId, status?)` — fetches `getCampaignLeads(id, status)`, key: `['outreach-campaign-leads', campaignId, status]`

Each returns typed result interface with `data`, `error`, `isLoading`, `mutate`.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/frontend/hooks/api/useOutreachCampaigns.ts
git commit --no-verify -m "feat: add outreach campaigns SWR hooks"
```

---

## Task 3: Sidebar Update

**Files:**
- Modify: `src/components/dashboard/AppSidebar.tsx`

- [ ] **Step 1: Read the sidebar file**

Read `src/components/dashboard/AppSidebar.tsx` to find exact line numbers for the `NavItem` interface and `mainNav` array.

- [ ] **Step 2: Extend NavItem with activePrefixes**

Add `activePrefixes?: string[]` to the `NavItem` interface.

- [ ] **Step 3: Update isRouteActive to check activePrefixes**

```typescript
function isRouteActive(pathname: string, href: string, activePrefix?: string, activePrefixes?: string[]) {
  if (activePrefixes) {
    return activePrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
  }
  const matchPath = activePrefix || href;
  return href === '/'
    ? pathname === '/'
    : pathname === matchPath || pathname.startsWith(matchPath + '/');
}
```

Update the call site in the render to pass `item.activePrefixes`.

- [ ] **Step 4: Update mainNav array**

Remove the Automations and Post Campaigns entries. Add Campaigns:

```typescript
// Replace lines 99 (automations) and 102 (post-campaigns) with:
{ href: '/campaigns', label: 'Campaigns', icon: Megaphone, activePrefixes: ['/campaigns', '/post-campaigns'] },
```

Keep Signals at its current position.

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/AppSidebar.tsx
git commit --no-verify -m "feat: consolidate sidebar — Campaigns replaces Automations + Post Campaigns"
```

---

## Task 4: Automations Redirect

**Files:**
- Modify: `src/app/(dashboard)/automations/page.tsx`

- [ ] **Step 1: Replace with redirect**

Read the existing file, then replace its entire content with:

```typescript
import { redirect } from 'next/navigation';

export default function AutomationsPage() {
  redirect('/campaigns');
}
```

Remove the `metadata` export (redirect pages don't need it).

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/automations/page.tsx
git commit --no-verify -m "feat: redirect /automations to /campaigns"
```

---

## Task 5: Campaigns List Page + Component

**Files:**
- Create: `src/app/(dashboard)/campaigns/page.tsx`
- Create: `src/components/campaigns/CampaignsList.tsx`

- [ ] **Step 1: Create the page shell**

Follow the exact pattern from `src/app/(dashboard)/post-campaigns/page.tsx` (read it first):

```typescript
'use client';

/** Unified campaigns list — outreach + post campaigns. */

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button, PageContainer, PageTitle } from '@magnetlab/magnetui';
import { CampaignsList } from '@/components/campaigns/CampaignsList';

export default function CampaignsPage() {
  return (
    <PageContainer maxWidth="xl">
      <PageTitle
        title="Campaigns"
        description="Outreach sequences and post campaigns"
        actions={
          <Button asChild>
            <Link href="/campaigns/new">
              <Plus className="mr-2 h-4 w-4" />
              New Outreach Campaign
            </Link>
          </Button>
        }
      />
      <CampaignsList />
    </PageContainer>
  );
}
```

- [ ] **Step 2: Create the CampaignsList component**

Read `src/frontend/api/post-campaigns.ts` to understand the post campaigns list shape. Create `src/components/campaigns/CampaignsList.tsx`:

- `'use client'` with JSDoc
- Import `useOutreachCampaigns` from hooks, import `useCampaigns` from post campaigns hooks (or use the post campaigns API directly)
- Also import post campaigns via `* as postCampaignsApi from '@/frontend/api/post-campaigns'`
- State: `typeFilter: 'all' | 'outreach' | 'post'`, `statusFilter: string`
- Fetch both lists, merge into unified array with `type` field, sort by created_at DESC
- Render: filter dropdowns (type, status) + table with columns: Name, Type (badge), Details, Status (badge), Leads, Created
- Row click: outreach → `/campaigns/${id}`, post → `/post-campaigns/${id}`
- Loading state, empty state
- Use `Table`, `TableHeader`, `TableRow`, `TableCell`, `Badge`, `Select` from `@magnetlab/magnetui`

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/campaigns/page.tsx src/components/campaigns/CampaignsList.tsx
git commit --no-verify -m "feat: unified campaigns list page with type/status filters"
```

---

## Task 6: Outreach Campaign Form + New Page

**Files:**
- Create: `src/app/(dashboard)/campaigns/new/page.tsx`
- Create: `src/components/campaigns/OutreachCampaignForm.tsx`

- [ ] **Step 1: Create the form component**

Read `src/app/(dashboard)/post-campaigns/new/page.tsx` for the pattern. Create `OutreachCampaignForm.tsx`:

- `'use client'` with JSDoc
- Props: `onSubmit: (campaignId: string) => void`
- Form fields: name (Input), preset (Select with 3 options + descriptions), unipile_account_id (Input — text for now, select later), connect_message (Textarea, optional), first_message_template (Textarea, required, hint about {{name}} {{company}}), follow_up_template (Textarea, optional), follow_up_delay_days (Input number, default 3), withdraw_delay_days (Input number, default 7)
- Submit calls `outreachCampaignsApi.createCampaign(input)`
- Error state with inline message
- Uses `Card`, `CardContent`, `CardHeader`, `Label`, `Input`, `Textarea`, `Select`, `Button` from `@magnetlab/magnetui`

Preset descriptions:
- Warm Connect: "View profile → wait 1 day → connect → message on accept"
- Direct Connect: "View profile → connect immediately → message on accept"
- Nurture: "View profile → wait 3 days → connect → message on accept"

- [ ] **Step 2: Create the page shell**

```typescript
'use client';

/** Create a new outreach campaign. */

import { useRouter } from 'next/navigation';
import { PageContainer, PageTitle } from '@magnetlab/magnetui';
import { OutreachCampaignForm } from '@/components/campaigns/OutreachCampaignForm';

export default function NewOutreachCampaignPage() {
  const router = useRouter();
  return (
    <PageContainer maxWidth="lg">
      <PageTitle title="New Outreach Campaign" />
      <OutreachCampaignForm onSubmit={(id) => router.push(`/campaigns/${id}`)} />
    </PageContainer>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/campaigns/new/page.tsx src/components/campaigns/OutreachCampaignForm.tsx
git commit --no-verify -m "feat: new outreach campaign form with preset selection"
```

---

## Task 7: Lead Table + Add Leads Modal

**Files:**
- Create: `src/components/campaigns/LeadTable.tsx`
- Create: `src/components/campaigns/AddLeadsModal.tsx`

- [ ] **Step 1: Create LeadTable component**

- `'use client'` with JSDoc
- Props: `campaignId: string`, `leads: OutreachLeadSummary[]`, `onSkip: (leadId: string) => void`, `onStatusFilter: (status: string) => void`, `statusFilter: string`
- Columns: Name, Company, Status (badge with color), Step (derived from timestamps: pending → viewed → connected → messaged → followed up), Error (if failed), Actions (Skip button)
- Status badge colors: pending=gray, active=blue, completed=green, replied=emerald, withdrawn=orange, failed=red, skipped=slate
- Step derivation: check timestamps in order (follow_up_sent_at → messaged_at → connected_at → connect_sent_at → viewed_at) to show most advanced step reached
- Empty state when no leads
- Uses `Table`, `Badge`, `Button`, `Select` from `@magnetlab/magnetui`

- [ ] **Step 2: Create AddLeadsModal component**

- `'use client'` with JSDoc
- Props: `campaignId: string`, `open: boolean`, `onOpenChange: (open: boolean) => void`, `onAdded: () => void`
- A `Textarea` for pasting LinkedIn URLs (one per line)
- Optional name/company fields per line (format: `url, name, company`)
- Parse on submit, call `outreachCampaignsApi.addLeads(campaignId, parsed)`
- Show result: "Added X leads (Y duplicates skipped)"
- Uses `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `Textarea`, `Button` from `@magnetlab/magnetui`

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/campaigns/LeadTable.tsx src/components/campaigns/AddLeadsModal.tsx
git commit --no-verify -m "feat: lead table with status badges + bulk add leads modal"
```

---

## Task 8: Outreach Campaign Detail Page

**Files:**
- Create: `src/app/(dashboard)/campaigns/[id]/page.tsx`
- Create: `src/components/campaigns/OutreachCampaignDetail.tsx`

- [ ] **Step 1: Create the detail component**

Read `src/app/(dashboard)/post-campaigns/[id]/page.tsx` for the page shell pattern. Create `OutreachCampaignDetail.tsx`:

- `'use client'` with JSDoc
- Props: `campaignId: string`
- Uses `useOutreachCampaign(campaignId)` and `useOutreachCampaignLeads(campaignId, statusFilter)`
- Layout sections:
  - **Header:** campaign name, preset badge, status badge, action buttons (Activate/Pause/Delete)
  - **Stats row:** 5 cards — Total, In Progress (pending+active), Connected, Replied, Failed/Withdrawn
  - **Lead section:** Add Leads button + `<LeadTable>` + `<AddLeadsModal>`
- Action handlers call API module + mutate SWR cache
- Delete confirmation via `confirm()` then redirect to `/campaigns`
- Loading state, not-found state
- Uses `Card`, `CardContent`, `Badge`, `Button`, `Skeleton` from `@magnetlab/magnetui`

- [ ] **Step 2: Create the page shell**

Follow the post-campaigns detail page pattern exactly:

```typescript
'use client';

/** Outreach campaign detail page. */

import { use } from 'react';
import { PageContainer } from '@magnetlab/magnetui';
import { OutreachCampaignDetail } from '@/components/campaigns/OutreachCampaignDetail';

export default function OutreachCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PageContainer maxWidth="xl">
      <OutreachCampaignDetail campaignId={id} />
    </PageContainer>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/campaigns/[id]/page.tsx src/components/campaigns/OutreachCampaignDetail.tsx
git commit --no-verify -m "feat: outreach campaign detail page with stats + lead management"
```

---

## Task 9: Verify + Push

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds (all pages compile)

- [ ] **Step 3: Visual verification**

Run: `pnpm dev` and manually check:
- `/campaigns` shows the unified list
- `/campaigns/new` shows the form
- Sidebar shows "Campaigns" instead of "Automations" + "Post Campaigns"
- `/automations` redirects to `/campaigns`
- `/post-campaigns/[id]` still works (existing page)

- [ ] **Step 4: Push branch**

```bash
git push origin feature/unified-campaigns-ui
```
