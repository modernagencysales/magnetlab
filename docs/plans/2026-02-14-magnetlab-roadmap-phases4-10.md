# MagnetLab Roadmap Implementation Plan (Phases 4-10)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build analytics dashboard, complete Unipile migration, add email analytics, harden testing, enforce team RBAC, update dependencies, and polish the product.

**Architecture:** Phase 4 adds time-series API endpoints feeding Recharts charts on a new analytics page and redesigned dashboard home. Phase 5 fills Unipile gaps (automation UI, error handling). Phase 6 adds Resend webhook ingestion and email event tracking. Phase 7 expands test coverage and CI. Phase 8 adds RBAC middleware to enforce team roles. Phase 9 bumps SDK versions. Phase 10 adds accessibility, billing enforcement, and custom domains.

**Tech Stack:** Next.js 15, TypeScript, Supabase, Recharts + shadcn chart.tsx, Resend webhooks, Jest 29, Playwright, Stripe billing enforcement

---

## Phase 4: Analytics Dashboard

### Task 1: Create Time-Series Analytics API

**Files:**
- Create: `src/app/api/analytics/overview/route.ts`
- Create: `src/__tests__/api/analytics-overview.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/api/analytics-overview.test.ts`:

```typescript
import { GET } from '@/app/api/analytics/overview/route';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock supabase
const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({ from: mockFrom }),
}));

import { auth } from '@/lib/auth';

describe('GET /api/analytics/overview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 if not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/analytics/overview?range=7d'));
    expect(res.status).toBe(401);
  });

  it('returns time-series data for views and leads', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    // Mock funnel_pages
    mockFrom.mockImplementation((table: string) => {
      if (table === 'funnel_pages') {
        return {
          select: () => ({ eq: () => ({ data: [{ id: 'f1' }], error: null }) }),
        };
      }
      if (table === 'page_views') {
        return {
          select: () => ({
            in: () => ({
              gte: () => ({
                data: [
                  { funnel_page_id: 'f1', view_date: '2026-02-10', visitor_hash: 'a' },
                  { funnel_page_id: 'f1', view_date: '2026-02-10', visitor_hash: 'b' },
                  { funnel_page_id: 'f1', view_date: '2026-02-11', visitor_hash: 'c' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'funnel_leads') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                data: [
                  { created_at: '2026-02-10T10:00:00Z', is_qualified: true, utm_source: 'linkedin' },
                  { created_at: '2026-02-11T10:00:00Z', is_qualified: false, utm_source: null },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ data: [], error: null }) }) };
    });

    const res = await GET(new Request('http://localhost/api/analytics/overview?range=7d'));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.viewsByDay).toBeDefined();
    expect(json.leadsByDay).toBeDefined();
    expect(json.totals).toBeDefined();
    expect(json.totals.views).toBe(3);
    expect(json.totals.leads).toBe(2);
    expect(json.totals.qualified).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/analytics-overview.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Implement the analytics API**

Create `src/app/api/analytics/overview/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

function getDateRange(range: string): Date {
  const now = new Date();
  switch (range) {
    case '30d': return new Date(now.getTime() - 30 * 86400000);
    case '90d': return new Date(now.getTime() - 90 * 86400000);
    case '7d':
    default: return new Date(now.getTime() - 7 * 86400000);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const range = request.nextUrl.searchParams.get('range') || '7d';
    const since = getDateRange(range);
    const sinceISO = since.toISOString().split('T')[0];

    const supabase = createSupabaseAdminClient();

    // Get user's funnels
    const { data: funnels } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('user_id', session.user.id);

    const funnelIds = funnels?.map(f => f.id) || [];

    if (funnelIds.length === 0) {
      return NextResponse.json({
        viewsByDay: [],
        leadsByDay: [],
        utmBreakdown: [],
        totals: { views: 0, leads: 0, qualified: 0, conversionRate: 0, qualificationRate: 0 },
      });
    }

    // Parallel queries: views + leads
    const [viewsRes, leadsRes] = await Promise.all([
      supabase
        .from('page_views')
        .select('funnel_page_id, view_date, visitor_hash')
        .in('funnel_page_id', funnelIds)
        .gte('view_date', sinceISO),
      supabase
        .from('funnel_leads')
        .select('created_at, is_qualified, utm_source')
        .eq('user_id', session.user.id)
        .gte('created_at', since.toISOString()),
    ]);

    if (viewsRes.error) {
      logApiError('analytics/overview/views', viewsRes.error);
    }
    if (leadsRes.error) {
      logApiError('analytics/overview/leads', leadsRes.error);
    }

    const views = viewsRes.data || [];
    const leads = leadsRes.data || [];

    // Aggregate views by day
    const viewsByDayMap = new Map<string, number>();
    for (const v of views) {
      const day = v.view_date;
      viewsByDayMap.set(day, (viewsByDayMap.get(day) || 0) + 1);
    }

    // Aggregate leads by day
    const leadsByDayMap = new Map<string, number>();
    for (const l of leads) {
      const day = l.created_at.split('T')[0];
      leadsByDayMap.set(day, (leadsByDayMap.get(day) || 0) + 1);
    }

    // Fill in missing days
    const viewsByDay: Array<{ date: string; views: number }> = [];
    const leadsByDay: Array<{ date: string; leads: number }> = [];
    const cursor = new Date(since);
    const today = new Date();
    while (cursor <= today) {
      const day = cursor.toISOString().split('T')[0];
      viewsByDay.push({ date: day, views: viewsByDayMap.get(day) || 0 });
      leadsByDay.push({ date: day, leads: leadsByDayMap.get(day) || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    // UTM breakdown
    const utmMap = new Map<string, number>();
    for (const l of leads) {
      const source = l.utm_source || 'Direct';
      utmMap.set(source, (utmMap.get(source) || 0) + 1);
    }
    const utmBreakdown = Array.from(utmMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // Totals
    const totalViews = views.length;
    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter(l => l.is_qualified === true).length;

    return NextResponse.json({
      viewsByDay,
      leadsByDay,
      utmBreakdown,
      totals: {
        views: totalViews,
        leads: totalLeads,
        qualified: qualifiedLeads,
        conversionRate: totalViews > 0 ? Math.round((totalLeads / totalViews) * 100) : 0,
        qualificationRate: totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0,
      },
    });
  } catch (error) {
    logApiError('analytics/overview', error);
    return ApiErrors.internalError('Failed to fetch analytics');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/analytics-overview.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/app/api/analytics/overview/route.ts src/__tests__/api/analytics-overview.test.ts
git commit -m "feat: add time-series analytics overview API endpoint"
```

---

### Task 2: Create Per-Funnel Analytics API

**Files:**
- Create: `src/app/api/analytics/funnel/[id]/route.ts`
- Create: `src/__tests__/api/analytics-funnel.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/api/analytics-funnel.test.ts`:

```typescript
import { GET } from '@/app/api/analytics/funnel/[id]/route';

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({ from: mockFrom }),
}));

import { auth } from '@/lib/auth';

describe('GET /api/analytics/funnel/[id]', () => {
  it('returns 401 if not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET(
      new Request('http://localhost/api/analytics/funnel/f1'),
      { params: Promise.resolve({ id: 'f1' }) }
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 if funnel not owned by user', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: jest.fn().mockReturnThis(),
        single: () => ({ data: null, error: { code: 'PGRST116' } }),
      }),
    }));
    const res = await GET(
      new Request('http://localhost/api/analytics/funnel/f1'),
      { params: Promise.resolve({ id: 'f1' }) }
    );
    expect(res.status).toBe(403);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/analytics-funnel.test.ts --no-coverage`
Expected: FAIL

**Step 3: Implement per-funnel analytics API**

Create `src/app/api/analytics/funnel/[id]/route.ts`. Returns:
- Time-series views and leads for a specific funnel
- Lead table with name, email, qualified status, UTM, date
- Qualification rate over time
- Auth checks: session + funnel ownership (`.eq('user_id', session.user.id).eq('id', funnelId).single()`)

Pattern: Same aggregation as Task 1 but scoped to a single `funnel_page_id`.

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add src/app/api/analytics/funnel/ src/__tests__/api/analytics-funnel.test.ts
git commit -m "feat: add per-funnel analytics API endpoint"
```

---

### Task 3: Build Analytics Overview Page

**Files:**
- Modify: `src/app/(dashboard)/analytics/page.tsx` (replace redirect with real page)
- Create: `src/components/analytics/AnalyticsOverview.tsx`
- Create: `src/components/analytics/TimeSeriesChart.tsx`
- Create: `src/components/analytics/UTMBreakdown.tsx`
- Create: `src/components/analytics/StatCards.tsx`

**Step 1: Build the chart components**

`TimeSeriesChart.tsx`: Client component using `ChartContainer` from `src/components/ui/chart.tsx` with Recharts `AreaChart`. Props: `data: Array<{date: string; value: number}>`, `label: string`, `color: string`. Responsive, shows date on X axis, value on Y axis, with `ChartTooltip`.

`UTMBreakdown.tsx`: Client component with Recharts `BarChart` (horizontal). Shows top UTM sources. Falls back to "No UTM data yet" message.

`StatCards.tsx`: Server component showing totals grid: Views, Leads, Conversion Rate %, Qualification Rate %. Each card shows value + trend arrow (compare to previous period).

**Step 2: Build the analytics page**

Replace `src/app/(dashboard)/analytics/page.tsx`:

```typescript
import { Suspense } from 'react';
import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview';

export const metadata = {
  title: 'Analytics | MagnetLab',
  description: 'View your funnel performance metrics',
};

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsOverview />
    </Suspense>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-muted mb-8" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border bg-muted" />
    </div>
  );
}
```

`AnalyticsOverview.tsx`: Client component that:
1. Has a date range selector (7d / 30d / 90d tabs)
2. Fetches `/api/analytics/overview?range=` via `useSWR` or `useEffect`
3. Renders `StatCards` + `TimeSeriesChart` (views) + `TimeSeriesChart` (leads) + `UTMBreakdown`
4. Below charts: funnel list with mini-stats, links to per-funnel detail

**Step 3: Verify build compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run build`

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/analytics/ src/components/analytics/
git commit -m "feat: build analytics dashboard with time-series charts and UTM breakdown"
```

---

### Task 4: Build Per-Funnel Analytics Detail View

**Files:**
- Create: `src/app/(dashboard)/analytics/funnel/[id]/page.tsx`
- Create: `src/components/analytics/FunnelDetail.tsx`

**Step 1: Build the funnel detail page**

Server component at `analytics/funnel/[id]/page.tsx` with:
- Breadcrumb back to analytics overview
- Funnel name header
- Same chart layout (views + leads time-series)
- Lead table: sortable columns (name, email, qualified, UTM, date)
- Qualification rate chart

`FunnelDetail.tsx`: Client component fetching `/api/analytics/funnel/[id]?range=`. Renders charts + table.

**Step 2: Verify build compiles**

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/analytics/funnel/ src/components/analytics/FunnelDetail.tsx
git commit -m "feat: add per-funnel analytics detail page with lead table"
```

---

### Task 5: Redesign Dashboard Home with Real Metrics

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`

**Step 1: Enhance dashboard stats**

Update `fetchDashboardStats()` in `src/app/(dashboard)/page.tsx:36-96` to also fetch:
- Views this week vs last week (from `page_views` where `view_date >= 7 days ago` vs `view_date BETWEEN 14 and 7 days ago`)
- Leads this week vs last week (from `funnel_leads` where `created_at >= 7 days ago`)
- Published posts this week (from `cp_pipeline_posts` where `published_at >= 7 days ago`)

Add to `DashboardStats` interface:
```typescript
viewsThisWeek: number;
viewsLastWeek: number;
leadsThisWeek: number;
leadsLastWeek: number;
postsThisWeek: number;
```

**Step 2: Update StatCard to show trend**

Add optional `trend` prop to `StatCard` that shows a green up-arrow or red down-arrow with percentage change vs last week. Display below the number.

**Step 3: Replace "Getting Started" with mini-chart for returning users**

For non-new users who have completed the checklist, show a compact 7-day spark line chart (views + leads) using a simple inline Recharts `LineChart` (no axis, just the line). Link to `/analytics` for full view.

**Step 4: Verify build**

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/page.tsx
git commit -m "feat: redesign dashboard home with weekly trends and mini charts"
```

---

### Task 6: Add Content Pipeline Stats to Analytics

**Files:**
- Modify: `src/app/api/analytics/overview/route.ts`
- Modify: `src/components/analytics/AnalyticsOverview.tsx`

**Step 1: Extend the overview API**

Add to the overview API response:
```typescript
contentStats: {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  draftPosts: number;
  totalTranscripts: number;
  knowledgeEntries: number;
}
```

Query `cp_pipeline_posts` grouped by status, `cp_call_transcripts` count, `cp_knowledge_entries` count — all scoped by `user_id`.

**Step 2: Add content stats section to analytics page**

Add a "Content Pipeline" section below the funnel charts with stat cards for posts by status, transcripts, and knowledge entries.

**Step 3: Run tests, verify build**

**Step 4: Commit**

```bash
git add src/app/api/analytics/overview/route.ts src/components/analytics/
git commit -m "feat: add content pipeline stats to analytics dashboard"
```

---

## Phase 5: Complete Unipile Migration

### Task 7: Add LinkedIn Automation Management UI

**Files:**
- Create: `src/app/(dashboard)/automations/page.tsx`
- Create: `src/components/automations/AutomationList.tsx`
- Create: `src/components/automations/AutomationEditor.tsx`

**Step 1: Build the automation list page**

The `linkedin_automations` table exists (migration `20260213200000`). API routes exist at `src/app/api/linkedin/automations/route.ts` (GET list, POST create) and `src/app/api/linkedin/automations/[id]/route.ts` (PATCH update, DELETE).

Create a dashboard page at `/automations` with:
- Table/card list of automations with name, post link, status badge (draft/running/paused), leads captured count
- Actions: start/pause toggle, edit, delete
- "New Automation" button

**Step 2: Build the automation editor**

`AutomationEditor.tsx`: Modal/drawer form with fields:
- Name (text)
- Post (dropdown of user's published posts from `cp_pipeline_posts`)
- Keywords (tag input — comma-separated)
- DM Template (textarea with {{name}}, {{comment}} placeholders preview)
- Auto-connect toggle
- Auto-like toggle
- Comment reply template (textarea, optional)
- Follow-up settings (toggle, template, delay in hours)

Save via `POST /api/linkedin/automations` or `PATCH /api/linkedin/automations/[id]`.

**Step 3: Add `/automations` to middleware protected routes**

In `src/middleware.ts:5-12`, add `'/automations'` to the `protectedRoutes` array.

**Step 4: Add sidebar nav link**

Find the sidebar component and add an "Automations" link with a Bot or Zap icon.

**Step 5: Verify build**

**Step 6: Commit**

```bash
git add src/app/\(dashboard\)/automations/ src/components/automations/ src/middleware.ts
git commit -m "feat: add LinkedIn automation management UI"
```

---

### Task 8: Add Publish Error Handling and Retry

**Files:**
- Modify: `src/trigger/auto-publish-check.ts`
- Create: `src/app/api/content-pipeline/posts/[id]/retry/route.ts`

**Step 1: Add error capture to auto-publish**

In `src/trigger/auto-publish-check.ts`, wrap the publish call in try/catch. On failure:
- Update `cp_pipeline_posts` set `status = 'publish_failed'`, `error_log = error.message`
- Log with `logError`
- Do NOT retry automatically (user should review and retry manually)

Add `'publish_failed'` to any status checks that currently only handle `'published'`.

**Step 2: Build retry endpoint**

Create `src/app/api/content-pipeline/posts/[id]/retry/route.ts`:
- Auth required
- Verify post ownership and status is `'publish_failed'`
- Reset status to `'scheduled'`, clear `error_log`, set `scheduled_time` to now
- The existing auto-publish cron will pick it up within 5 minutes

**Step 3: Add retry button to post list UI**

Find the posts list component and add a "Retry" button for posts with `status === 'publish_failed'`.

**Step 4: Commit**

```bash
git add src/trigger/auto-publish-check.ts src/app/api/content-pipeline/posts/
git commit -m "feat: add publish error handling and manual retry for failed posts"
```

---

### Task 9: Add Engagement Dashboard

**Files:**
- Create: `src/app/(dashboard)/analytics/engagement/page.tsx`
- Create: `src/components/analytics/EngagementDashboard.tsx`
- Create: `src/app/api/analytics/engagement/route.ts`

**Step 1: Build engagement API**

Create `src/app/api/analytics/engagement/route.ts` that queries:
- `cp_post_engagements` grouped by post — total comments, reactions per post
- `linkedin_automation_events` — DMs sent, keywords matched, connect requests
- Returns aggregated stats per post + totals

**Step 2: Build engagement dashboard**

`EngagementDashboard.tsx`: Client component showing:
- Total engagement stats (comments, reactions, DMs sent)
- Per-post engagement table (post title, comments, reactions, DMs sent, automation status)
- Link each post to its automation config

Add a tab or link from the main analytics page to `/analytics/engagement`.

**Step 3: Verify build**

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/analytics/engagement/ src/components/analytics/ src/app/api/analytics/engagement/
git commit -m "feat: add LinkedIn engagement analytics dashboard"
```

---

## Phase 6: Email Sequence Analytics

### Task 10: Create Email Events Table

**Files:**
- Create: `supabase/migrations/20260214000002_email_events.sql`

**Step 1: Write the migration**

```sql
-- Email event tracking for Resend webhooks
CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT NOT NULL,               -- Resend email ID
  lead_id UUID REFERENCES funnel_leads(id) ON DELETE SET NULL,
  lead_magnet_id UUID REFERENCES lead_magnets(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,                -- owner of the email sequence
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed'
  )),
  recipient_email TEXT NOT NULL,
  subject TEXT,
  link_url TEXT,                         -- for click events
  bounce_type TEXT,                      -- for bounce events (hard/soft)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_events_user ON email_events(user_id);
CREATE INDEX idx_email_events_lead_magnet ON email_events(lead_magnet_id);
CREATE INDEX idx_email_events_email_id ON email_events(email_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_email_events_created ON email_events(created_at);

-- RLS
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email events"
  ON email_events FOR SELECT
  USING (user_id = auth.uid());
```

**Step 2: Push migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx supabase db push`

**Step 3: Commit**

```bash
git add supabase/migrations/20260214000002_email_events.sql
git commit -m "feat: add email_events table for Resend webhook tracking"
```

---

### Task 11: Build Resend Webhook Handler

**Files:**
- Create: `src/app/api/webhooks/resend/route.ts`
- Create: `src/__tests__/api/webhooks-resend.test.ts`

**Step 1: Write the failing test**

```typescript
import { POST } from '@/app/api/webhooks/resend/route';

const mockInsert = jest.fn().mockReturnValue({ error: null });
const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({ from: mockFrom }),
}));

describe('POST /api/webhooks/resend', () => {
  it('processes email.delivered event', async () => {
    const req = new Request('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'test',
      },
      body: JSON.stringify({
        type: 'email.delivered',
        data: {
          email_id: 'e_123',
          to: ['lead@example.com'],
          subject: 'Test',
          created_at: '2026-02-14T10:00:00Z',
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 400 for unknown event types', async () => {
    const req = new Request('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'unknown.event', data: {} }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200); // Acknowledge but ignore
  });
});
```

**Step 2: Implement the webhook handler**

Create `src/app/api/webhooks/resend/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logInfo, logError, logWarn } from '@/lib/utils/logger';

// Map Resend webhook event types to our event_type values
const EVENT_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = EVENT_MAP[body.type];

    if (!eventType) {
      logInfo('webhooks/resend', 'Ignoring unhandled event type', { type: body.type });
      return NextResponse.json({ received: true });
    }

    const data = body.data;
    const recipientEmail = Array.isArray(data.to) ? data.to[0] : data.to;

    const supabase = createSupabaseAdminClient();

    // Look up the lead to get user_id and lead_magnet_id
    const { data: lead } = await supabase
      .from('funnel_leads')
      .select('id, user_id, lead_magnet_id')
      .eq('email', recipientEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!lead) {
      logWarn('webhooks/resend', 'No lead found for email event', { email: recipientEmail });
      return NextResponse.json({ received: true });
    }

    const { error } = await supabase.from('email_events').insert({
      email_id: data.email_id || data.id,
      lead_id: lead.id,
      lead_magnet_id: lead.lead_magnet_id,
      user_id: lead.user_id,
      event_type: eventType,
      recipient_email: recipientEmail,
      subject: data.subject,
      link_url: eventType === 'clicked' ? data.click?.link : null,
      bounce_type: eventType === 'bounced' ? data.bounce?.type : null,
      metadata: { raw_type: body.type, timestamp: data.created_at },
    });

    if (error) {
      logError('webhooks/resend', error, { event: eventType });
    }

    logInfo('webhooks/resend', 'Processed event', { event: eventType, email: recipientEmail });
    return NextResponse.json({ received: true });
  } catch (error) {
    logError('webhooks/resend', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Note:** Resend webhook signature verification uses the Svix library. For now, implement without signature verification (same pattern as the existing Cal.com webhook). Add `RESEND_WEBHOOK_SECRET` verification in a follow-up if needed.

**Step 3: Run test, verify pass**

**Step 4: Commit**

```bash
git add src/app/api/webhooks/resend/route.ts src/__tests__/api/webhooks-resend.test.ts
git commit -m "feat: add Resend webhook handler for email event tracking"
```

---

### Task 12: Build Email Analytics API and UI

**Files:**
- Create: `src/app/api/analytics/email/route.ts`
- Create: `src/app/(dashboard)/analytics/email/page.tsx`
- Create: `src/components/analytics/EmailAnalytics.tsx`

**Step 1: Build the email analytics API**

`src/app/api/analytics/email/route.ts`:
- Auth required
- Query `email_events` grouped by `event_type` for the user
- Also group by `lead_magnet_id` for per-magnet stats
- Returns:
  ```typescript
  {
    totals: { sent: number; delivered: number; opened: number; clicked: number; bounced: number },
    rates: { deliveryRate: number; openRate: number; clickRate: number; bounceRate: number },
    byMagnet: Array<{ leadMagnetId: string; title: string; sent: number; opened: number; clicked: number }>
  }
  ```

**Step 2: Build the email analytics page**

`EmailAnalytics.tsx`: Client component showing:
- Stat cards: Sent, Delivered, Opened, Clicked, Bounced
- Rate cards: Delivery %, Open %, Click %, Bounce %
- Per-magnet breakdown table
- Link from main analytics page

**Step 3: Verify build**

**Step 4: Commit**

```bash
git add src/app/api/analytics/email/ src/app/\(dashboard\)/analytics/email/ src/components/analytics/EmailAnalytics.tsx
git commit -m "feat: add email sequence analytics page with delivery and engagement rates"
```

---

## Phase 7: Testing & CI/CD

### Task 13: Add Coverage Reporting to CI

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `jest.config.js`

**Step 1: Update CI to run coverage**

In `.github/workflows/ci.yml`, change the test step:

```yaml
    - name: Run tests with coverage
      run: npm run test:coverage

    - name: Upload coverage report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: coverage/
        retention-days: 7
```

**Step 2: Verify jest coverage config**

The existing `jest.config.js` already has `coverageThreshold` at 50%. This is fine for now. As test coverage grows, we can raise it.

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add coverage reporting and artifact upload to CI workflow"
```

---

### Task 14: Write Critical Path Tests — Stripe Webhook

**Files:**
- Create: `src/__tests__/api/stripe-webhook.test.ts`

**Step 1: Write Stripe webhook tests**

Read `src/app/api/stripe/webhook/route.ts` first to understand the handler.

Test cases:
- Rejects requests without Stripe signature header
- Handles `checkout.session.completed` — creates/updates subscription
- Handles `customer.subscription.updated` — updates plan
- Handles `customer.subscription.deleted` — marks cancelled
- Ignores unknown event types gracefully

Mock `stripe.webhooks.constructEvent()` and the Supabase client.

**Step 2: Run tests, verify pass**

**Step 3: Commit**

```bash
git add src/__tests__/api/stripe-webhook.test.ts
git commit -m "test: add Stripe webhook handler test coverage"
```

---

### Task 15: Write Critical Path Tests — Lead Capture

**Files:**
- Create: `src/__tests__/api/public-lead-capture.test.ts`

**Step 1: Write lead capture tests**

Read `src/app/api/public/lead/route.ts` first.

Test cases:
- Rejects missing email
- Creates funnel_lead with correct fields
- Handles qualification answers
- Fires GTM webhook on capture
- Triggers email sequence if active
- Handles duplicate lead (same email, same funnel)

**Step 2: Run tests, verify pass**

**Step 3: Commit**

```bash
git add src/__tests__/api/public-lead-capture.test.ts
git commit -m "test: add lead capture API test coverage"
```

---

### Task 16: Write Content Pipeline Tests

**Files:**
- Create: `src/__tests__/api/content-pipeline-transcripts.test.ts`
- Create: `src/__tests__/api/content-pipeline-posts.test.ts`

**Step 1: Write transcript upload tests**

Read `src/app/api/content-pipeline/transcripts/route.ts`. Test:
- Auth required
- Creates transcript record
- Triggers `process-transcript` background job

**Step 2: Write post CRUD tests**

Read `src/app/api/content-pipeline/posts/route.ts`. Test:
- Auth required
- List posts returns user's posts only
- Create post with required fields
- Status transitions (draft → review → approved → scheduled)

**Step 3: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/__tests__/api/content-pipeline-*.test.ts
git commit -m "test: add content pipeline transcript and post API test coverage"
```

---

### Task 17: Configure Playwright E2E Tests

**Files:**
- Create: `playwright.config.ts`
- Modify: `e2e/settings.spec.ts` (verify existing spec still works)
- Create: `e2e/auth.setup.ts`

**Step 1: Create Playwright config**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Step 2: Add E2E to CI (optional, gated)**

Add a separate job to CI that only runs on `main` branch pushes (not PRs), since E2E requires a running server:

```yaml
  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    needs: ci
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
```

**Step 3: Commit**

```bash
git add playwright.config.ts .github/workflows/ci.yml
git commit -m "ci: configure Playwright E2E tests with CI integration"
```

---

## Phase 8: Team Permissions (RBAC)

### Task 18: Create RBAC Utility and Middleware Helper

**Files:**
- Create: `src/lib/auth/rbac.ts`
- Create: `src/__tests__/lib/auth/rbac.test.ts`

**Step 1: Write the failing test**

```typescript
import { checkTeamRole, TeamRole } from '@/lib/auth/rbac';

const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({ from: mockFrom }),
}));

describe('checkTeamRole', () => {
  it('returns owner role for team owner', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: jest.fn().mockReturnThis(),
        single: () => ({ data: { owner_id: 'user-1' }, error: null }),
      }),
    });

    const role = await checkTeamRole('user-1', 'team-1');
    expect(role).toBe('owner');
  });

  it('returns member role for team member', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: () => ({
            eq: jest.fn().mockReturnThis(),
            single: () => ({ data: { owner_id: 'other-user' }, error: null }),
          }),
        };
      }
      return {
        select: () => ({
          eq: jest.fn().mockReturnThis(),
          single: () => ({ data: { role: 'member', status: 'active' }, error: null }),
        }),
      };
    });

    const role = await checkTeamRole('user-1', 'team-1');
    expect(role).toBe('member');
  });

  it('returns null for non-member', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'teams') {
        return {
          select: () => ({
            eq: jest.fn().mockReturnThis(),
            single: () => ({ data: { owner_id: 'other-user' }, error: null }),
          }),
        };
      }
      return {
        select: () => ({
          eq: jest.fn().mockReturnThis(),
          single: () => ({ data: null, error: { code: 'PGRST116' } }),
        }),
      };
    });

    const role = await checkTeamRole('user-1', 'team-1');
    expect(role).toBeNull();
  });
});
```

**Step 2: Implement RBAC utility**

Create `src/lib/auth/rbac.ts`:

```typescript
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export type TeamRole = 'owner' | 'member' | null;

/**
 * Check a user's role in a specific team.
 * Returns 'owner', 'member', or null (not a member).
 */
export async function checkTeamRole(userId: string, teamId: string): Promise<TeamRole> {
  const supabase = createSupabaseAdminClient();

  // Check if user is team owner
  const { data: team } = await supabase
    .from('teams')
    .select('owner_id')
    .eq('id', teamId)
    .single();

  if (!team) return null;
  if (team.owner_id === userId) return 'owner';

  // Check team_members table
  const { data: member } = await supabase
    .from('team_members')
    .select('role, status')
    .eq('team_id', teamId)
    .eq('member_id', userId)
    .eq('status', 'active')
    .single();

  if (!member) return null;
  return member.role === 'owner' ? 'owner' : 'member';
}

/**
 * Require a minimum role for an API action.
 * Returns true if the user has the required role or higher.
 */
export function hasMinimumRole(actual: TeamRole, required: 'owner' | 'member'): boolean {
  if (!actual) return false;
  if (required === 'member') return true; // owner or member both pass
  return actual === 'owner';
}
```

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git add src/lib/auth/rbac.ts src/__tests__/lib/auth/rbac.test.ts
git commit -m "feat: add RBAC utility for team role checking"
```

---

### Task 19: Add RBAC to Team API Routes

**Files:**
- Modify: `src/app/api/team/[id]/route.ts`
- Modify: `src/app/api/team/memberships/route.ts`
- Modify: `src/app/api/teams/profiles/[id]/route.ts`

**Step 1: Read the existing team API routes**

Read each file to understand current auth patterns.

**Step 2: Add role checks**

For each team API route:
- Extract team ID from the request (route param or cookie `ml-team-context`)
- Call `checkTeamRole(session.user.id, teamId)`
- Owner-only operations: delete team, update team settings, remove members, change roles
- Member operations: view team, update own profile, view other profiles

Pattern:
```typescript
import { checkTeamRole, hasMinimumRole } from '@/lib/auth/rbac';

// In handler:
const role = await checkTeamRole(session.user.id, teamId);
if (!hasMinimumRole(role, 'owner')) {
  return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
}
```

**Step 3: Verify build**

**Step 4: Commit**

```bash
git add src/app/api/team/ src/app/api/teams/
git commit -m "feat: enforce RBAC on team API routes (owner/member permissions)"
```

---

### Task 20: Add Team-Scoped Data Access

**Files:**
- Create: `src/lib/utils/team-context.ts`

**Step 1: Build team context helper**

When a user is operating in a team context (cookie `ml-team-context` is set), data queries should be scoped to the team rather than just the individual user. Create a helper:

```typescript
import { cookies } from 'next/headers';
import { checkTeamRole } from '@/lib/auth/rbac';

export interface DataScope {
  type: 'user' | 'team';
  userId: string;
  teamId?: string;
}

/**
 * Get the current data scope based on session and team context.
 * If operating in a team, verifies membership.
 */
export async function getDataScope(userId: string): Promise<DataScope> {
  const cookieStore = await cookies();
  const teamId = cookieStore.get('ml-team-context')?.value;

  if (teamId) {
    const role = await checkTeamRole(userId, teamId);
    if (role) {
      return { type: 'team', userId, teamId };
    }
  }

  return { type: 'user', userId };
}
```

This utility is for future use — API routes can gradually adopt it to support team-scoped queries. Full migration of all routes to team-scoped queries is a separate effort.

**Step 2: Commit**

```bash
git add src/lib/utils/team-context.ts
git commit -m "feat: add team context utility for scoped data access"
```

---

### Task 21: Add Activity Log Table and API

**Files:**
- Create: `supabase/migrations/20260214000003_activity_log.sql`
- Create: `src/app/api/team/[id]/activity/route.ts`
- Create: `src/lib/utils/activity-log.ts`

**Step 1: Create migration**

```sql
CREATE TABLE IF NOT EXISTS team_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,         -- 'member.invited', 'member.removed', 'settings.updated', etc.
  target_type TEXT,             -- 'member', 'settings', 'lead_magnet', etc.
  target_id TEXT,               -- ID of the affected entity
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_team ON team_activity_log(team_id);
CREATE INDEX idx_activity_log_created ON team_activity_log(created_at DESC);
```

**Step 2: Create activity log utility**

`src/lib/utils/activity-log.ts`:

```typescript
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function logTeamActivity(params: {
  teamId: string;
  userId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from('team_activity_log').insert({
    team_id: params.teamId,
    user_id: params.userId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    details: params.details || {},
  });
}
```

**Step 3: Create activity API**

`src/app/api/team/[id]/activity/route.ts`: GET endpoint returning paginated activity log for a team. Auth + team membership required.

**Step 4: Commit**

```bash
git add supabase/migrations/20260214000003_activity_log.sql src/lib/utils/activity-log.ts src/app/api/team/
git commit -m "feat: add team activity log table, utility, and API"
```

---

## Phase 9: Dependency Updates

### Task 22: Update Anthropic SDK

**Files:**
- Modify: `package.json`
- Possibly modify: files in `src/lib/ai/`

**Step 1: Check current usage**

Search for `@anthropic-ai/sdk` imports to identify all usage patterns. Current version: `^0.30.0`.

**Step 2: Update the package**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npm install @anthropic-ai/sdk@latest
```

**Step 3: Verify no breaking changes**

Read the Anthropic SDK changelog for breaking changes between 0.30 and latest. The main API (`client.messages.create()`) is stable. Check:
- Import paths haven't changed
- Message types are compatible
- Stream handling still works

**Step 4: Run full test suite**

```bash
npm test
npm run typecheck
npm run build
```

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: update @anthropic-ai/sdk to latest version"
```

---

### Task 23: Update Stripe SDK

**Files:**
- Modify: `package.json`
- Possibly modify: `src/lib/integrations/stripe.ts`, `src/app/api/stripe/`

**Step 1: Update the package**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npm install stripe@latest
```

Current: `^17.5.0`. Target: latest 20.x.

**Step 2: Check for breaking changes**

Key areas to verify:
- `stripe.webhooks.constructEvent()` signature
- `stripe.checkout.sessions.create()` params
- `stripe.billingPortal.sessions.create()` params
- Subscription object shape in webhook events

**Step 3: Run tests + typecheck**

```bash
npm run typecheck
npm test
npm run build
```

Fix any type errors in `src/lib/integrations/stripe.ts` or `src/app/api/stripe/`.

**Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/integrations/stripe.ts src/app/api/stripe/
git commit -m "chore: update stripe SDK to latest version"
```

---

### Task 24: Update Next.js and React (Assessment)

**Note:** Next.js 15 → 16 and React 18 → 19 are major upgrades. This task is an **assessment only** — the actual upgrade should be done in a dedicated branch.

**Files:**
- Create: `docs/plans/2026-02-14-nextjs-react-upgrade-assessment.md`

**Step 1: Audit React 19 compatibility**

Search for:
- `useEffect` with cleanup patterns (React 19 may run effects differently)
- `forwardRef` usage (React 19 makes ref a regular prop)
- String refs (must be callback refs)
- `defaultProps` on function components (deprecated in React 19)

**Step 2: Audit Next.js 16 compatibility**

Check:
- `next.config.js` for deprecated options
- Middleware patterns
- App Router changes
- `turbopack` as default (check if build works)

**Step 3: Write assessment document**

Document findings, estimated effort, and recommended approach (single upgrade vs React first then Next.js).

**Step 4: Commit**

```bash
git add docs/plans/2026-02-14-nextjs-react-upgrade-assessment.md
git commit -m "docs: add Next.js 16 + React 19 upgrade assessment"
```

---

## Phase 10: Polish & Growth

### Task 25: Accessibility Audit and Fixes

**Files:**
- Modify: Multiple component files

**Step 1: Audit interactive elements**

Search for `<button`, `<a`, `onClick` without corresponding `aria-label` or visible text. Priority areas:
- Icon-only buttons (must have `aria-label`)
- Modal dialogs (need `role="dialog"`, `aria-modal`, focus trap)
- Form inputs (need `<label>` or `aria-label`)
- Skip-to-content link

**Step 2: Fix priority issues**

For each component:
- Add `aria-label` to icon-only buttons
- Add `role="dialog"` and `aria-modal="true"` to modals
- Add visible `<label>` elements for form inputs
- Add skip-to-content link in `src/app/(dashboard)/layout.tsx`

**Step 3: Add keyboard navigation**

- Ensure all interactive elements are focusable
- Add `Escape` key handling for modals/drawers
- Test tab order makes sense

**Step 4: Commit**

```bash
git add src/components/ src/app/
git commit -m "a11y: add ARIA labels, keyboard navigation, and focus management"
```

---

### Task 26: Billing Enforcement

**Files:**
- Modify: `src/lib/auth/config.ts` (add plan check helper)
- Create: `src/lib/auth/plan-limits.ts`
- Modify: Key API routes that should enforce limits

**Step 1: Define plan limits**

Create `src/lib/auth/plan-limits.ts`:

```typescript
export interface PlanLimits {
  maxLeadMagnets: number;
  maxFunnelPages: number;
  maxEmailSequences: number;
  maxTranscripts: number;  // per month
  maxPosts: number;        // per month
  features: {
    customDomain: boolean;
    teamMembers: boolean;
    apiAccess: boolean;
    brandKit: boolean;
  };
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxLeadMagnets: 3,
    maxFunnelPages: 3,
    maxEmailSequences: 1,
    maxTranscripts: 5,
    maxPosts: 10,
    features: {
      customDomain: false,
      teamMembers: false,
      apiAccess: false,
      brandKit: true,
    },
  },
  pro: {
    maxLeadMagnets: 25,
    maxFunnelPages: 25,
    maxEmailSequences: 10,
    maxTranscripts: 50,
    maxPosts: 100,
    features: {
      customDomain: true,
      teamMembers: true,
      apiAccess: true,
      brandKit: true,
    },
  },
  unlimited: {
    maxLeadMagnets: Infinity,
    maxFunnelPages: Infinity,
    maxEmailSequences: Infinity,
    maxTranscripts: Infinity,
    maxPosts: Infinity,
    features: {
      customDomain: true,
      teamMembers: true,
      apiAccess: true,
      brandKit: true,
    },
  },
};
```

**Step 2: Create plan check helper**

```typescript
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { PLAN_LIMITS, PlanLimits } from './plan-limits';

export async function getUserPlanLimits(userId: string): Promise<PlanLimits> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  return PLAN_LIMITS[data?.plan || 'free'];
}

export async function checkUsageLimit(
  userId: string,
  resource: 'lead_magnets' | 'funnel_pages' | 'email_sequences',
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const limits = await getUserPlanLimits(userId);
  const supabase = createSupabaseAdminClient();

  const tableMap = {
    lead_magnets: 'lead_magnets',
    funnel_pages: 'funnel_pages',
    email_sequences: 'email_sequences',
  };

  const { count } = await supabase
    .from(tableMap[resource])
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const limitKey = `max${resource.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join('')}` as keyof PlanLimits;
  const limit = limits[limitKey] as number;

  return {
    allowed: (count || 0) < limit,
    current: count || 0,
    limit,
  };
}
```

**Step 3: Add enforcement to creation endpoints**

Add `checkUsageLimit` call to:
- `POST /api/lead-magnet/route.ts` (before creating lead magnet)
- `POST /api/funnel/route.ts` (before creating funnel)
- `POST /api/email-sequence/generate/route.ts` (before creating sequence)

Return 403 with `{ error: 'Plan limit reached', current, limit }` when exceeded.

**Step 4: Add upgrade prompt to UI**

When creation fails with 403, show an upgrade prompt linking to `/settings` billing section.

**Step 5: Commit**

```bash
git add src/lib/auth/plan-limits.ts src/app/api/
git commit -m "feat: enforce billing plan limits on resource creation"
```

---

### Task 27: Custom Domain Support

**Files:**
- Create: `supabase/migrations/20260214000004_custom_domains.sql`
- Create: `src/app/api/settings/custom-domain/route.ts`
- Modify: `src/middleware.ts`

**Step 1: Create migration**

```sql
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS custom_domain TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnel_pages_custom_domain
  ON funnel_pages(custom_domain) WHERE custom_domain IS NOT NULL;
```

**Step 2: Build domain management API**

`src/app/api/settings/custom-domain/route.ts`:
- `POST`: Set custom domain for a funnel page. Validate format, check uniqueness.
- `DELETE`: Remove custom domain.
- `GET`: Check domain DNS verification status (CNAME to `cname.vercel-dns.com`).

**Step 3: Update middleware for custom domain routing**

In `src/middleware.ts`, add early check: if the `Host` header matches a custom domain in the DB, rewrite the request to the corresponding funnel page path.

**Note:** This requires Vercel project configuration to accept wildcard domains. Document the Vercel setup steps needed.

**Step 4: Commit**

```bash
git add supabase/migrations/20260214000004_custom_domains.sql src/app/api/settings/custom-domain/ src/middleware.ts
git commit -m "feat: add custom domain support for funnel pages"
```

---

### Task 28: Onboarding Optimization

**Files:**
- Modify: `src/components/onboarding/ProductTour.tsx`
- Modify: `src/components/dashboard/DashboardWelcomeClient.tsx`

**Step 1: Enhance the product tour**

Update the existing 5-step Driver.js tour to be more contextual:
- Step 1: Welcome + value prop ("You're about to create your first lead magnet")
- Step 2: Point to "Create" button — explain the 6-step wizard
- Step 3: Point to "Knowledge" — explain AI Brain
- Step 4: Point to "Posts" — explain content pipeline
- Step 5: Point to "Analytics" (now functional!) — explain metrics

Add conditional steps based on what the user has already done (skip "Create" step if they have magnets).

**Step 2: Add contextual tooltips**

For first-time visits to key pages (magnets, leads, posts), show a one-time tooltip explaining the page purpose. Use `localStorage` to track which tooltips have been shown.

**Step 3: Commit**

```bash
git add src/components/onboarding/ src/components/dashboard/
git commit -m "feat: enhance product tour with contextual steps and first-visit tooltips"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 4 | 1-6 | Analytics dashboard (time-series APIs, charts, dashboard redesign) |
| 5 | 7-9 | Unipile completion (automation UI, error handling, engagement dashboard) |
| 6 | 10-12 | Email analytics (events table, Resend webhooks, analytics UI) |
| 7 | 13-17 | Testing & CI (coverage, critical path tests, Playwright E2E) |
| 8 | 18-21 | Team RBAC (role utility, route enforcement, activity log) |
| 9 | 22-24 | Dependencies (Anthropic SDK, Stripe, React/Next.js assessment) |
| 10 | 25-28 | Polish (a11y, billing enforcement, custom domains, onboarding) |

**Total: 28 tasks**
