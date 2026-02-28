# Team Command Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified multi-account scheduling view where a team owner can see, schedule, and broadcast LinkedIn posts across all team members from one weekly calendar grid.

**Architecture:** New `/content/team-scheduler` tab in the content pipeline with a weekly grid (rows = team profiles, columns = days). Posts can be assigned, rescheduled, and broadcast with AI voice-adapted variations via a Trigger.dev task. A new `team_profile_integrations` table decouples LinkedIn connections from user accounts, supporting both owner-managed and self-connected profiles.

**Tech Stack:** Next.js 15, React 18, Supabase (PostgreSQL), Trigger.dev v4, Claude AI (Anthropic SDK), Unipile (LinkedIn OAuth), Tailwind CSS + shadcn/ui, date-fns

---

## Task 1: Database Migration — `team_profile_integrations` + `broadcast_group_id`

**Files:**
- Create: `supabase/migrations/20260226200000_team_command_center.sql`

**Step 1: Write the migration**

```sql
-- Team profile integrations (decouples LinkedIn connections from user accounts)
CREATE TABLE IF NOT EXISTS team_profile_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_profile_id UUID NOT NULL REFERENCES team_profiles(id) ON DELETE CASCADE,
  service TEXT NOT NULL DEFAULT 'unipile',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  connected_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_profile_id, service)
);

-- RLS
ALTER TABLE team_profile_integrations ENABLE ROW LEVEL SECURITY;

-- Team owners and members can read their team's integrations
CREATE POLICY "team_profile_integrations_select" ON team_profile_integrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_profiles tp
      JOIN teams t ON t.id = tp.team_id
      WHERE tp.id = team_profile_integrations.team_profile_id
        AND (t.owner_id = auth.uid() OR tp.user_id = auth.uid())
    )
  );

-- Team owners can manage all integrations, members can manage their own
CREATE POLICY "team_profile_integrations_insert" ON team_profile_integrations
  FOR INSERT WITH CHECK (connected_by = auth.uid());

CREATE POLICY "team_profile_integrations_update" ON team_profile_integrations
  FOR UPDATE USING (connected_by = auth.uid());

CREATE POLICY "team_profile_integrations_delete" ON team_profile_integrations
  FOR DELETE USING (connected_by = auth.uid());

-- Broadcast group ID on pipeline posts
ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS broadcast_group_id UUID;

-- Index for querying broadcast siblings
CREATE INDEX IF NOT EXISTS idx_pipeline_posts_broadcast_group
  ON cp_pipeline_posts(broadcast_group_id)
  WHERE broadcast_group_id IS NOT NULL;

-- Updated_at trigger for team_profile_integrations
CREATE OR REPLACE FUNCTION update_team_profile_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_profile_integrations_updated_at
  BEFORE UPDATE ON team_profile_integrations
  FOR EACH ROW EXECUTE FUNCTION update_team_profile_integrations_updated_at();
```

**Step 2: Push migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run db:push`
Expected: Migration applies successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260226200000_team_command_center.sql
git commit -m "feat: add team_profile_integrations table + broadcast_group_id column"
```

---

## Task 2: TypeScript Types + API Helpers

**Files:**
- Modify: `src/lib/types/content-pipeline.ts`
- Create: `src/lib/services/team-integrations.ts`
- Test: `src/__tests__/lib/services/team-integrations.test.ts`

**Step 1: Add types to content-pipeline.ts**

Add to `src/lib/types/content-pipeline.ts`:

```typescript
export interface TeamProfileIntegration {
  id: string;
  team_profile_id: string;
  service: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  connected_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamProfileWithConnection extends TeamProfile {
  linkedin_connected: boolean;
  unipile_account_id: string | null;
}

export interface BroadcastGroup {
  broadcast_group_id: string;
  source_post_id: string;
  variations: {
    profile_id: string;
    post_id: string;
    scheduled_time: string | null;
  }[];
}
```

**Step 2: Write the team integrations service**

Create `src/lib/services/team-integrations.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { UnipileClient, isUnipileConfigured } from '@/lib/integrations/unipile';
import type { TeamProfileIntegration, TeamProfileWithConnection, TeamProfile } from '@/lib/types/content-pipeline';

/**
 * Get the Unipile account ID for a team profile.
 * Checks team_profile_integrations first, falls back to user_integrations.
 */
export async function getTeamProfileUnipileAccountId(
  teamProfileId: string
): Promise<string | null> {
  const supabase = await createClient();

  // Check team_profile_integrations first
  const { data: tpi } = await supabase
    .from('team_profile_integrations')
    .select('metadata, is_active')
    .eq('team_profile_id', teamProfileId)
    .eq('service', 'unipile')
    .single();

  if (tpi?.is_active) {
    const accountId = (tpi.metadata as Record<string, unknown>)?.unipile_account_id;
    if (typeof accountId === 'string') return accountId;
  }

  // Fallback: check if the profile's user has a user_integrations entry
  const { data: profile } = await supabase
    .from('team_profiles')
    .select('user_id')
    .eq('id', teamProfileId)
    .single();

  if (!profile?.user_id) return null;

  const { data: ui } = await supabase
    .from('user_integrations')
    .select('metadata, is_active')
    .eq('user_id', profile.user_id)
    .eq('service', 'unipile')
    .single();

  if (ui?.is_active) {
    const accountId = (ui.metadata as Record<string, unknown>)?.unipile_account_id;
    if (typeof accountId === 'string') return accountId;
  }

  return null;
}

/**
 * Get a LinkedIn publisher for a team profile.
 */
export async function getTeamProfileLinkedInPublisher(teamProfileId: string) {
  if (!isUnipileConfigured()) return null;

  const accountId = await getTeamProfileUnipileAccountId(teamProfileId);
  if (!accountId) return null;

  const client = new UnipileClient();
  return {
    async publishNow(content: string) {
      const result = await client.createPost(accountId, content);
      return { postId: result.social_id, provider: 'unipile' as const };
    },
    async getPostStats(postId: string) {
      return client.getPostStats(postId);
    },
    provider: 'unipile' as const,
  };
}

/**
 * Enrich team profiles with LinkedIn connection status.
 */
export async function getTeamProfilesWithConnections(
  teamId: string
): Promise<TeamProfileWithConnection[]> {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'active')
    .order('is_default', { ascending: false });

  if (!profiles?.length) return [];

  const profileIds = profiles.map((p) => p.id);
  const { data: integrations } = await supabase
    .from('team_profile_integrations')
    .select('team_profile_id, metadata, is_active')
    .in('team_profile_id', profileIds)
    .eq('service', 'unipile');

  const integrationMap = new Map(
    (integrations || []).map((i) => [i.team_profile_id, i])
  );

  // Also check user_integrations fallback
  const userIds = profiles.map((p) => p.user_id).filter(Boolean);
  const { data: userIntegrations } = await supabase
    .from('user_integrations')
    .select('user_id, metadata, is_active')
    .in('user_id', userIds)
    .eq('service', 'unipile');

  const userIntMap = new Map(
    (userIntegrations || []).map((i) => [i.user_id, i])
  );

  return profiles.map((profile) => {
    const tpi = integrationMap.get(profile.id);
    const ui = profile.user_id ? userIntMap.get(profile.user_id) : null;
    const activeIntegration = tpi?.is_active ? tpi : ui?.is_active ? ui : null;
    const accountId = activeIntegration
      ? (activeIntegration.metadata as Record<string, unknown>)?.unipile_account_id
      : null;

    return {
      ...profile,
      linkedin_connected: typeof accountId === 'string',
      unipile_account_id: typeof accountId === 'string' ? accountId : null,
    } as TeamProfileWithConnection;
  });
}

/**
 * Store a Unipile account connection for a team profile.
 */
export async function connectTeamProfileLinkedIn(
  teamProfileId: string,
  unipileAccountId: string,
  connectedBy: string
): Promise<void> {
  const supabase = await createClient();
  await supabase.from('team_profile_integrations').upsert(
    {
      team_profile_id: teamProfileId,
      service: 'unipile',
      is_active: true,
      metadata: { unipile_account_id: unipileAccountId },
      connected_by: connectedBy,
    },
    { onConflict: 'team_profile_id,service' }
  );
}
```

**Step 3: Write tests**

Create `src/__tests__/lib/services/team-integrations.test.ts`:

```typescript
/**
 * @jest-environment node
 */

// Mock Supabase before imports
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockSingle = jest.fn();
const mockOrder = jest.fn();
const mockUpsert = jest.fn();

const chainable = {
  select: mockSelect,
  eq: mockEq,
  in: mockIn,
  single: mockSingle,
  order: mockOrder,
  upsert: mockUpsert,
};

// Each chainable method returns the chainable object
Object.values(chainable).forEach((fn) => {
  fn.mockReturnValue(chainable);
});

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnValue(chainable),
  }),
}));

jest.mock('@/lib/integrations/unipile', () => ({
  isUnipileConfigured: jest.fn().mockReturnValue(true),
  UnipileClient: jest.fn().mockImplementation(() => ({
    createPost: jest.fn().mockResolvedValue({ social_id: 'urn:li:activity:123' }),
    getPostStats: jest.fn().mockResolvedValue(null),
  })),
}));

import {
  getTeamProfileUnipileAccountId,
  getTeamProfilesWithConnections,
} from '@/lib/services/team-integrations';

describe('team-integrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(chainable).forEach((fn) => {
      fn.mockReturnValue(chainable);
    });
  });

  describe('getTeamProfileUnipileAccountId', () => {
    it('returns account ID from team_profile_integrations', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          metadata: { unipile_account_id: 'acc_123' },
          is_active: true,
        },
      });

      const result = await getTeamProfileUnipileAccountId('profile-1');
      expect(result).toBe('acc_123');
    });

    it('returns null when no integration exists', async () => {
      mockSingle.mockResolvedValueOnce({ data: null });
      mockSingle.mockResolvedValueOnce({ data: null });

      const result = await getTeamProfileUnipileAccountId('profile-1');
      expect(result).toBeNull();
    });
  });

  describe('getTeamProfilesWithConnections', () => {
    it('enriches profiles with linkedin_connected status', async () => {
      // First call: team_profiles
      mockOrder.mockResolvedValueOnce({
        data: [
          { id: 'p1', user_id: 'u1', full_name: 'Tim', status: 'active', is_default: true },
          { id: 'p2', user_id: 'u2', full_name: 'Sarah', status: 'active', is_default: false },
        ],
      });

      // Second call: team_profile_integrations
      mockEq.mockReturnValueOnce({
        ...chainable,
        then: undefined,
        data: [
          { team_profile_id: 'p1', metadata: { unipile_account_id: 'acc_1' }, is_active: true },
        ],
      });

      const result = await getTeamProfilesWithConnections('team-1');
      expect(result).toHaveLength(2);
      expect(result[0].linkedin_connected).toBe(true);
    });
  });
});
```

**Step 4: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/lib/services/team-integrations.test.ts`
Expected: Tests pass

**Step 5: Commit**

```bash
git add src/lib/types/content-pipeline.ts src/lib/services/team-integrations.ts src/__tests__/lib/services/team-integrations.test.ts
git commit -m "feat: add team profile integrations service + types"
```

---

## Task 3: API Routes — Team Command Center Data

**Files:**
- Create: `src/app/api/content-pipeline/team-schedule/route.ts`
- Create: `src/app/api/content-pipeline/team-schedule/assign/route.ts`
- Create: `src/app/api/team-profile-integrations/route.ts`
- Test: `src/__tests__/api/content-pipeline/team-schedule.test.ts`

**Step 1: Write the team schedule GET endpoint**

Create `src/app/api/content-pipeline/team-schedule/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const weekStart = searchParams.get('week_start'); // ISO date string
  const teamId = searchParams.get('team_id');

  if (!teamId) {
    return NextResponse.json({ error: 'team_id required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify user is team owner or member
  const { data: team } = await supabase
    .from('teams')
    .select('id, owner_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // Get active team profiles
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id, full_name, title, avatar_url, role, linkedin_url')
    .eq('team_id', teamId)
    .eq('status', 'active')
    .order('is_default', { ascending: false });

  if (!profiles?.length) {
    return NextResponse.json({ profiles: [], posts: [], slots: [] });
  }

  const profileIds = profiles.map((p) => p.id);

  // Calculate week range
  const baseDate = weekStart ? parseISO(weekStart) : new Date();
  const weekStartDate = startOfWeek(baseDate, { weekStartsOn: 1 }); // Monday
  const weekEndDate = endOfWeek(baseDate, { weekStartsOn: 1 }); // Sunday

  // Fetch posts for the week across all team profiles
  const { data: posts } = await supabase
    .from('cp_pipeline_posts')
    .select(
      'id, team_profile_id, status, scheduled_time, draft_content, final_content, content_type, broadcast_group_id, is_buffer, buffer_position, auto_publish_after, created_at'
    )
    .in('team_profile_id', profileIds)
    .in('status', ['draft', 'reviewing', 'approved', 'scheduled'])
    .gte('scheduled_time', weekStartDate.toISOString())
    .lte('scheduled_time', weekEndDate.toISOString())
    .order('scheduled_time', { ascending: true });

  // Fetch posting slots for all profiles
  const { data: slots } = await supabase
    .from('cp_posting_slots')
    .select('id, user_id, slot_number, day_of_week, time_of_day, timezone, is_active, team_profile_id')
    .in('team_profile_id', profileIds)
    .eq('is_active', true);

  // Fetch buffer posts (unscheduled, approved) per profile
  const { data: bufferPosts } = await supabase
    .from('cp_pipeline_posts')
    .select(
      'id, team_profile_id, status, draft_content, final_content, content_type, is_buffer, buffer_position, created_at'
    )
    .in('team_profile_id', profileIds)
    .eq('is_buffer', true)
    .in('status', ['approved', 'reviewing'])
    .order('buffer_position', { ascending: true })
    .limit(50);

  // Fetch LinkedIn connection status
  const { data: integrations } = await supabase
    .from('team_profile_integrations')
    .select('team_profile_id, is_active')
    .in('team_profile_id', profileIds)
    .eq('service', 'unipile');

  const connectedSet = new Set(
    (integrations || []).filter((i) => i.is_active).map((i) => i.team_profile_id)
  );

  // Also check user_integrations fallback
  const { data: profileUsers } = await supabase
    .from('team_profiles')
    .select('id, user_id')
    .in('id', profileIds);

  const userIds = (profileUsers || []).map((p) => p.user_id).filter(Boolean);
  if (userIds.length) {
    const { data: userInts } = await supabase
      .from('user_integrations')
      .select('user_id, is_active')
      .in('user_id', userIds)
      .eq('service', 'unipile');

    const userIdToProfileId = new Map(
      (profileUsers || []).filter((p) => p.user_id).map((p) => [p.user_id, p.id])
    );

    (userInts || [])
      .filter((i) => i.is_active)
      .forEach((i) => {
        const profileId = userIdToProfileId.get(i.user_id);
        if (profileId) connectedSet.add(profileId);
      });
  }

  const enrichedProfiles = (profiles || []).map((p) => ({
    ...p,
    linkedin_connected: connectedSet.has(p.id),
  }));

  return NextResponse.json({
    profiles: enrichedProfiles,
    posts: posts || [],
    slots: slots || [],
    buffer_posts: bufferPosts || [],
    week_start: weekStartDate.toISOString(),
    week_end: weekEndDate.toISOString(),
  });
}
```

**Step 2: Write the assign-to-slot endpoint**

Create `src/app/api/content-pipeline/team-schedule/assign/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { post_id, scheduled_time, team_profile_id } = body;

  if (!post_id || !scheduled_time) {
    return NextResponse.json({ error: 'post_id and scheduled_time required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify the post belongs to the user's team
  const { data: post } = await supabase
    .from('cp_pipeline_posts')
    .select('id, user_id, team_profile_id, status')
    .eq('id', post_id)
    .single();

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  // Update the post with new schedule
  const updates: Record<string, unknown> = {
    scheduled_time,
    status: 'scheduled',
    is_buffer: false,
  };

  if (team_profile_id) {
    updates.team_profile_id = team_profile_id;
  }

  const { error } = await supabase
    .from('cp_pipeline_posts')
    .update(updates)
    .eq('id', post_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: Write the team profile integrations endpoint**

Create `src/app/api/team-profile-integrations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeamProfilesWithConnections } from '@/lib/services/team-integrations';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const teamId = request.nextUrl.searchParams.get('team_id');
  if (!teamId) {
    return NextResponse.json({ error: 'team_id required' }, { status: 400 });
  }

  const profiles = await getTeamProfilesWithConnections(teamId);
  return NextResponse.json({ profiles });
}
```

**Step 4: Write tests for the team-schedule endpoint**

Create `src/__tests__/api/content-pipeline/team-schedule.test.ts`:

```typescript
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1', email: 'test@test.com' } }),
}));

// Mock Supabase
const mockFrom = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({ from: mockFrom }),
}));

describe('GET /api/content-pipeline/team-schedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 if team_id is missing', async () => {
    const { GET } = await import(
      '@/app/api/content-pipeline/team-schedule/route'
    );

    const req = new NextRequest('http://localhost/api/content-pipeline/team-schedule');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 if team not found', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null }),
    };
    mockFrom.mockReturnValue(chain);

    const { GET } = await import(
      '@/app/api/content-pipeline/team-schedule/route'
    );

    const req = new NextRequest(
      'http://localhost/api/content-pipeline/team-schedule?team_id=nonexistent'
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/content-pipeline/team-schedule/assign', () => {
  it('returns 400 if post_id or scheduled_time missing', async () => {
    const { POST } = await import(
      '@/app/api/content-pipeline/team-schedule/assign/route'
    );

    const req = new NextRequest(
      'http://localhost/api/content-pipeline/team-schedule/assign',
      { method: 'POST', body: JSON.stringify({}) }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

**Step 5: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/api/content-pipeline/team-schedule.test.ts`
Expected: Tests pass

**Step 6: Commit**

```bash
git add src/app/api/content-pipeline/team-schedule/ src/app/api/team-profile-integrations/ src/__tests__/api/content-pipeline/team-schedule.test.ts
git commit -m "feat: add team-schedule and team-profile-integrations API routes"
```

---

## Task 4: Weekly Calendar Grid Component

**Files:**
- Create: `src/components/content-pipeline/TeamCommandCenter.tsx`
- Create: `src/components/content-pipeline/WeeklyGrid.tsx`
- Create: `src/components/content-pipeline/GridCell.tsx`
- Modify: `src/components/content-pipeline/ContentPipelineContent.tsx` (add tab)

**Step 1: Create the GridCell component**

Create `src/components/content-pipeline/GridCell.tsx`:

```typescript
'use client';

import { PipelinePost } from '@/lib/types/content-pipeline';
import { format } from 'date-fns';

interface GridCellProps {
  post: PipelinePost | null;
  slotTime: string | null; // "HH:MM" or null if no slot
  hasSlot: boolean;
  onCellClick: () => void;
  isToday: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-green-100 border-green-300 text-green-800',
  approved: 'bg-green-50 border-green-200 text-green-700',
  reviewing: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  draft: 'bg-yellow-50 border-yellow-200 text-yellow-700',
};

const CONTENT_TYPE_BADGES: Record<string, string> = {
  story: 'Story',
  insight: 'Insight',
  tip: 'Tip',
  framework: 'Framework',
  question: 'Question',
  lead_magnet: 'Lead Mag',
  contrarian: 'Contrarian',
  listicle: 'Listicle',
  case_study: 'Case Study',
};

function getHookPreview(post: PipelinePost): string {
  const content = post.final_content || post.draft_content || '';
  const firstLine = content.split('\n')[0] || '';
  return firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine;
}

export function GridCell({ post, slotTime, hasSlot, onCellClick, isToday }: GridCellProps) {
  if (!hasSlot) {
    return (
      <div className={`h-20 border border-transparent ${isToday ? 'bg-blue-50/30' : ''}`} />
    );
  }

  if (!post) {
    return (
      <button
        onClick={onCellClick}
        className={`h-20 border border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer ${isToday ? 'bg-blue-50/30' : ''}`}
      >
        <span className="text-xs text-gray-400">
          {slotTime || 'Open'}
        </span>
      </button>
    );
  }

  const colorClass = STATUS_COLORS[post.status] || STATUS_COLORS.draft;
  const contentType = (post as Record<string, unknown>).content_type as string | undefined;

  return (
    <button
      onClick={onCellClick}
      className={`h-20 border rounded-lg p-1.5 text-left hover:shadow-sm transition-shadow cursor-pointer overflow-hidden ${colorClass} ${isToday ? 'ring-1 ring-blue-300' : ''}`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        {slotTime && (
          <span className="text-[10px] font-medium opacity-70">{slotTime}</span>
        )}
        {contentType && CONTENT_TYPE_BADGES[contentType] && (
          <span className="text-[10px] px-1 rounded bg-white/50">
            {CONTENT_TYPE_BADGES[contentType]}
          </span>
        )}
      </div>
      <p className="text-[11px] leading-tight line-clamp-2">{getHookPreview(post)}</p>
      {post.broadcast_group_id && (
        <span className="text-[9px] opacity-50 mt-0.5 block">Broadcast</span>
      )}
    </button>
  );
}
```

**Step 2: Create the WeeklyGrid component**

Create `src/components/content-pipeline/WeeklyGrid.tsx`:

```typescript
'use client';

import { useMemo } from 'react';
import {
  startOfWeek,
  addDays,
  format,
  isSameDay,
  isToday as isDateToday,
} from 'date-fns';
import { GridCell } from './GridCell';
import type {
  PipelinePost,
  PostingSlot,
  TeamProfileWithConnection,
} from '@/lib/types/content-pipeline';

interface WeeklyGridProps {
  profiles: TeamProfileWithConnection[];
  posts: PipelinePost[];
  slots: PostingSlot[];
  weekStart: Date;
  onCellClick: (profileId: string, date: Date, post: PipelinePost | null) => void;
  onPostClick: (post: PipelinePost) => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getSlotForDay(
  slots: PostingSlot[],
  profileId: string,
  dayOfWeek: number
): PostingSlot | null {
  const profileSlots = slots.filter((s) => s.team_profile_id === profileId);
  // day_of_week: 0=Sunday, 1=Monday... 6=Saturday. null = daily
  return (
    profileSlots.find(
      (s) => s.day_of_week === null || s.day_of_week === dayOfWeek
    ) || null
  );
}

function getPostForCell(
  posts: PipelinePost[],
  profileId: string,
  date: Date
): PipelinePost | null {
  return (
    posts.find(
      (p) =>
        p.team_profile_id === profileId &&
        p.scheduled_time &&
        isSameDay(new Date(p.scheduled_time), date)
    ) || null
  );
}

export function WeeklyGrid({
  profiles,
  posts,
  slots,
  weekStart,
  onCellClick,
  onPostClick,
}: WeeklyGridProps) {
  const days = useMemo(() => {
    const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [weekStart]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header row */}
        <div className="grid grid-cols-[180px_repeat(7,1fr)] gap-1 mb-1">
          <div className="text-xs font-medium text-gray-500 p-2">Team Member</div>
          {days.map((day, i) => (
            <div
              key={i}
              className={`text-xs font-medium text-center p-2 rounded ${
                isDateToday(day)
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-500'
              }`}
            >
              <div>{DAY_LABELS[i]}</div>
              <div className="text-[10px]">{format(day, 'MMM d')}</div>
            </div>
          ))}
        </div>

        {/* Profile rows */}
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="grid grid-cols-[180px_repeat(7,1fr)] gap-1 mb-1"
          >
            {/* Profile label */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                  {profile.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {profile.full_name}
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      profile.linkedin_connected
                        ? 'bg-green-500'
                        : 'bg-red-400'
                    }`}
                  />
                  <span className="text-[10px] text-gray-400">
                    {profile.linkedin_connected ? 'Connected' : 'No LinkedIn'}
                  </span>
                </div>
              </div>
            </div>

            {/* Day cells */}
            {days.map((day, dayIndex) => {
              const dayOfWeek = day.getDay(); // 0=Sun, 1=Mon...
              const slot = getSlotForDay(slots, profile.id, dayOfWeek);
              const post = getPostForCell(posts, profile.id, day);

              return (
                <GridCell
                  key={dayIndex}
                  post={post}
                  slotTime={slot?.time_of_day || null}
                  hasSlot={!!slot}
                  isToday={isDateToday(day)}
                  onCellClick={() =>
                    post
                      ? onPostClick(post)
                      : onCellClick(profile.id, day, null)
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Create the TeamCommandCenter container component**

Create `src/components/content-pipeline/TeamCommandCenter.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { addWeeks, subWeeks, startOfWeek, format } from 'date-fns';
import { WeeklyGrid } from './WeeklyGrid';
import { PostDetailModal } from './PostDetailModal';
import type {
  PipelinePost,
  PostingSlot,
  TeamProfileWithConnection,
} from '@/lib/types/content-pipeline';

interface TeamCommandCenterProps {
  teamId: string;
}

interface ScheduleData {
  profiles: TeamProfileWithConnection[];
  posts: PipelinePost[];
  slots: PostingSlot[];
  buffer_posts: PipelinePost[];
  week_start: string;
  week_end: string;
}

export function TeamCommandCenter({ teamId }: TeamCommandCenterProps) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<PipelinePost | null>(null);
  const [showBufferDock, setShowBufferDock] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{
    profileId: string;
    date: Date;
  } | null>(null);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/content-pipeline/team-schedule?team_id=${teamId}&week_start=${weekStart.toISOString()}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [teamId, weekStart]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleCellClick = (
    profileId: string,
    date: Date,
    post: PipelinePost | null
  ) => {
    if (!post) {
      // Empty slot clicked — show buffer for assignment
      setAssignTarget({ profileId, date });
      setShowBufferDock(true);
    }
  };

  const handlePostClick = (post: PipelinePost) => {
    setSelectedPost(post);
  };

  const handleAssignPost = async (postId: string, scheduledTime: string) => {
    if (!assignTarget) return;

    await fetch('/api/content-pipeline/team-schedule/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: postId,
        scheduled_time: scheduledTime,
        team_profile_id: assignTarget.profileId,
      }),
    });

    setAssignTarget(null);
    setShowBufferDock(false);
    fetchSchedule();
  };

  const handleBroadcast = async (postId: string) => {
    // Will be implemented in Task 6
    setSelectedPost(null);
  };

  const bufferByProfile = (data?.buffer_posts || []).reduce(
    (acc, post) => {
      const pid = post.team_profile_id || 'unassigned';
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(post);
      return acc;
    },
    {} as Record<string, PipelinePost[]>
  );

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => subWeeks(w, 1))}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
          >
            ← Prev
          </button>
          <button
            onClick={() =>
              setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 font-medium"
          >
            This Week
          </button>
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
          >
            Next →
          </button>
          <span className="text-sm text-gray-500 ml-2">
            {format(weekStart, 'MMM d')} –{' '}
            {format(addWeeks(weekStart, 1), 'MMM d, yyyy')}
          </span>
        </div>

        {/* Stats summary */}
        {data && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>
              {data.posts.filter((p) => p.status === 'scheduled').length} scheduled
            </span>
            <span>
              {data.buffer_posts.length} in buffer
            </span>
            <span>
              {data.profiles.filter((p) => p.linkedin_connected).length}/
              {data.profiles.length} connected
            </span>
          </div>
        )}
      </div>

      {/* Weekly grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading schedule...</div>
        </div>
      ) : data ? (
        <WeeklyGrid
          profiles={data.profiles}
          posts={data.posts}
          slots={data.slots}
          weekStart={weekStart}
          onCellClick={handleCellClick}
          onPostClick={handlePostClick}
        />
      ) : (
        <div className="text-center text-gray-500 py-12">
          No team data found. Set up team profiles first.
        </div>
      )}

      {/* Buffer dock */}
      {showBufferDock && assignTarget && data && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-40">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">
                Assign post to{' '}
                {data.profiles.find((p) => p.id === assignTarget.profileId)
                  ?.full_name || 'member'}{' '}
                on {format(assignTarget.date, 'EEE, MMM d')}
              </h3>
              <button
                onClick={() => {
                  setAssignTarget(null);
                  setShowBufferDock(false);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {(bufferByProfile[assignTarget.profileId] || []).map((post) => (
                <button
                  key={post.id}
                  onClick={() => {
                    const slot = data.slots.find(
                      (s) =>
                        s.team_profile_id === assignTarget.profileId &&
                        (s.day_of_week === null ||
                          s.day_of_week === assignTarget.date.getDay())
                    );
                    const time = slot?.time_of_day || '09:00';
                    const [h, m] = time.split(':');
                    const scheduled = new Date(assignTarget.date);
                    scheduled.setHours(parseInt(h), parseInt(m), 0, 0);
                    handleAssignPost(post.id, scheduled.toISOString());
                  }}
                  className="flex-shrink-0 w-64 p-3 border rounded-lg text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="text-xs text-gray-500 mb-1">
                    {post.status}
                  </div>
                  <p className="text-sm line-clamp-3">
                    {(post.final_content || post.draft_content || '')
                      .split('\n')[0]
                      ?.slice(0, 100)}
                  </p>
                </button>
              ))}
              {(!bufferByProfile[assignTarget.profileId] ||
                bufferByProfile[assignTarget.profileId].length === 0) && (
                <div className="text-sm text-gray-400 py-4">
                  No buffer posts for this member. Generate some via Autopilot.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post detail modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onPolish={() => {}}
          onUpdate={fetchSchedule}
          polishing={false}
        />
      )}
    </div>
  );
}
```

**Step 4: Add the Command Center tab to ContentPipelineContent.tsx**

Modify `src/components/content-pipeline/ContentPipelineContent.tsx`:

Add to the `TABS` array (after 'autopilot'):
```typescript
{ id: 'command-center', label: 'Command Center', icon: /* use an existing icon like LayoutGrid or CalendarDays from lucide-react */ }
```

Add dynamic import:
```typescript
const TeamCommandCenter = dynamic(
  () => import('./TeamCommandCenter').then((m) => ({ default: m.TeamCommandCenter })),
  { ssr: false }
);
```

Add to the Tab union type:
```typescript
type Tab = 'transcripts' | 'brain' | 'ideas' | 'posts' | 'pipeline' | 'templates' | 'autopilot' | 'command-center';
```

Add conditional render (only when in team context):
```typescript
{activeTab === 'command-center' && teamId && (
  <TeamCommandCenter teamId={teamId} />
)}
```

The tab should only appear when `teamId` is set (user is in team context).

**Step 5: Verify dev server renders the grid**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run dev`
Expected: Dev server starts. Navigate to content pipeline, see "Command Center" tab when in team context.

**Step 6: Commit**

```bash
git add src/components/content-pipeline/GridCell.tsx src/components/content-pipeline/WeeklyGrid.tsx src/components/content-pipeline/TeamCommandCenter.tsx src/components/content-pipeline/ContentPipelineContent.tsx
git commit -m "feat: add Team Command Center with weekly calendar grid"
```

---

## Task 5: LinkedIn Connection Flow for Team Profiles

**Files:**
- Modify: `src/app/api/linkedin/connect/route.ts`
- Modify: `src/app/api/webhooks/unipile/route.ts`
- Create: `src/components/content-pipeline/TeamLinkedInConnect.tsx`

**Step 1: Update the LinkedIn connect route to accept team_profile_id**

Modify `src/app/api/linkedin/connect/route.ts` — the hosted auth link request should pass `team_profile_id` in the `userId` field (or as a query param that gets round-tripped):

In the connect route, read `team_profile_id` from query params and encode it in the callback metadata:

```typescript
// Add to GET handler:
const teamProfileId = request.nextUrl.searchParams.get('team_profile_id');

const callbackUserId = teamProfileId
  ? `${session.user.id}:${teamProfileId}`  // Encode both in userId field
  : session.user.id;

const result = await client.requestHostedAuthLink({
  userId: callbackUserId,
  // ... rest stays the same
});
```

**Step 2: Update the Unipile webhook to handle team profile connections**

Modify `src/app/api/webhooks/unipile/route.ts` — when `body.name` contains a colon, split it to extract `team_profile_id`:

```typescript
// In the CREATION_SUCCESS handler:
const nameParts = body.name.split(':');
const userId = nameParts[0];
const teamProfileId = nameParts[1] || null;

// Always store in user_integrations (backward compat)
await upsertUserIntegration({
  userId,
  service: 'unipile',
  isActive: true,
  metadata: { unipile_account_id: body.account_id },
});

// If team_profile_id provided, also store in team_profile_integrations
if (teamProfileId) {
  const { connectTeamProfileLinkedIn } = await import(
    '@/lib/services/team-integrations'
  );
  await connectTeamProfileLinkedIn(teamProfileId, body.account_id, userId);
}
```

**Step 3: Create TeamLinkedInConnect component**

Create `src/components/content-pipeline/TeamLinkedInConnect.tsx`:

```typescript
'use client';

import { TeamProfileWithConnection } from '@/lib/types/content-pipeline';

interface TeamLinkedInConnectProps {
  profiles: TeamProfileWithConnection[];
  onRefresh: () => void;
}

export function TeamLinkedInConnect({ profiles, onRefresh }: TeamLinkedInConnectProps) {
  const disconnected = profiles.filter((p) => !p.linkedin_connected);

  if (disconnected.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <p className="text-sm font-medium text-amber-800 mb-2">
        {disconnected.length} member{disconnected.length > 1 ? 's' : ''} not connected to LinkedIn
      </p>
      <div className="flex flex-wrap gap-2">
        {disconnected.map((profile) => (
          <a
            key={profile.id}
            href={`/api/linkedin/connect?team_profile_id=${profile.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 rounded-md hover:bg-amber-50 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Connect {profile.full_name}
          </a>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Integrate TeamLinkedInConnect into TeamCommandCenter**

Add to `TeamCommandCenter.tsx`, below the week navigation and above the grid:

```typescript
import { TeamLinkedInConnect } from './TeamLinkedInConnect';

// In the render, between nav and grid:
{data && <TeamLinkedInConnect profiles={data.profiles} onRefresh={fetchSchedule} />}
```

**Step 5: Commit**

```bash
git add src/app/api/linkedin/connect/route.ts src/app/api/webhooks/unipile/route.ts src/components/content-pipeline/TeamLinkedInConnect.tsx src/components/content-pipeline/TeamCommandCenter.tsx
git commit -m "feat: add team profile LinkedIn connection flow"
```

---

## Task 6: Broadcast Feature — AI Voice Variations

**Files:**
- Create: `src/trigger/broadcast-post-variations.ts`
- Create: `src/components/content-pipeline/BroadcastModal.tsx`
- Create: `src/app/api/content-pipeline/broadcast/route.ts`
- Test: `src/__tests__/api/content-pipeline/broadcast.test.ts`

**Step 1: Write the Trigger.dev broadcast task**

Create `src/trigger/broadcast-post-variations.ts`:

```typescript
import { task } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { buildVoicePromptSection } from '@/lib/ai/content-pipeline/voice-prompt-builder';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  defaultHeaders: {
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
  },
  baseURL: process.env.HELICONE_API_KEY
    ? 'https://anthropic.helicone.ai/v1'
    : undefined,
});

interface BroadcastInput {
  sourcePostId: string;
  targetProfileIds: string[];
  userId: string;
  staggerDays?: number; // Spread across N days (default 2)
}

export const broadcastPostVariations = task({
  id: 'broadcast-post-variations',
  retry: { maxAttempts: 2 },
  run: async (payload: BroadcastInput) => {
    const { sourcePostId, targetProfileIds, userId, staggerDays = 2 } = payload;

    // Fetch source post
    const { data: sourcePost } = await supabase
      .from('cp_pipeline_posts')
      .select('*')
      .eq('id', sourcePostId)
      .single();

    if (!sourcePost) throw new Error(`Source post ${sourcePostId} not found`);

    const sourceContent = sourcePost.final_content || sourcePost.draft_content;
    if (!sourceContent) throw new Error('Source post has no content');

    // Fetch target profiles with voice data
    const { data: profiles } = await supabase
      .from('team_profiles')
      .select('*')
      .in('id', targetProfileIds);

    if (!profiles?.length) throw new Error('No target profiles found');

    // Generate broadcast group ID
    const broadcastGroupId = uuidv4();

    // Mark source post with broadcast group
    await supabase
      .from('cp_pipeline_posts')
      .update({ broadcast_group_id: broadcastGroupId })
      .eq('id', sourcePostId);

    // Fetch posting slots for stagger scheduling
    const { data: slots } = await supabase
      .from('cp_posting_slots')
      .select('*')
      .in('team_profile_id', targetProfileIds)
      .eq('is_active', true);

    const results: { profileId: string; postId: string; scheduledTime: string | null }[] = [];

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      const voiceSection = buildVoicePromptSection(
        profile.voice_profile || {},
        'linkedin'
      );

      // AI rewrite in this profile's voice
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `You are rewriting a LinkedIn post in a specific person's voice. Keep the core message and structure identical, but adapt the tone, vocabulary, and perspective to match this person.

${voiceSection}

AUTHOR: ${profile.full_name}${profile.title ? `, ${profile.title}` : ''}

ORIGINAL POST:
${sourceContent}

Rewrite this post as ${profile.full_name}. Use first person from their perspective. Keep the same core insight and structure but make it sound authentically like them. Do NOT add any preamble or explanation — output ONLY the rewritten post.`,
          },
        ],
      });

      const variation =
        response.content[0].type === 'text' ? response.content[0].text : '';

      // Calculate stagger time
      const staggerOffset = Math.floor(i / Math.ceil(profiles.length / staggerDays));
      const profileSlots = (slots || []).filter(
        (s) => s.team_profile_id === profile.id
      );
      let scheduledTime: string | null = null;

      if (profileSlots.length > 0) {
        const slot = profileSlots[0];
        const now = new Date();
        const target = new Date(now);
        target.setDate(target.getDate() + 1 + staggerOffset); // Tomorrow + stagger
        const [h, m] = slot.time_of_day.split(':');
        target.setHours(parseInt(h), parseInt(m), 0, 0);
        scheduledTime = target.toISOString();
      }

      // Create variation post
      const { data: newPost } = await supabase
        .from('cp_pipeline_posts')
        .insert({
          user_id: userId,
          team_profile_id: profile.id,
          draft_content: variation,
          final_content: variation,
          status: 'reviewing', // Needs approval before publishing
          scheduled_time: scheduledTime,
          broadcast_group_id: broadcastGroupId,
          is_buffer: false,
          idea_id: sourcePost.idea_id,
        })
        .select('id')
        .single();

      results.push({
        profileId: profile.id,
        postId: newPost?.id || '',
        scheduledTime,
      });
    }

    return { broadcastGroupId, variations: results };
  },
});
```

**Step 2: Write the broadcast API route**

Create `src/app/api/content-pipeline/broadcast/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { tasks } from '@trigger.dev/sdk/v3';
import type { broadcastPostVariations } from '@/trigger/broadcast-post-variations';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { source_post_id, target_profile_ids, stagger_days } = body;

  if (!source_post_id || !target_profile_ids?.length) {
    return NextResponse.json(
      { error: 'source_post_id and target_profile_ids required' },
      { status: 400 }
    );
  }

  const handle = await tasks.trigger<typeof broadcastPostVariations>(
    'broadcast-post-variations',
    {
      sourcePostId: source_post_id,
      targetProfileIds: target_profile_ids,
      userId: session.user.id,
      staggerDays: stagger_days || 2,
    }
  );

  return NextResponse.json({
    success: true,
    run_id: handle.id,
    message: `Broadcasting to ${target_profile_ids.length} profiles`,
  });
}
```

**Step 3: Create the BroadcastModal component**

Create `src/components/content-pipeline/BroadcastModal.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { PipelinePost, TeamProfileWithConnection } from '@/lib/types/content-pipeline';

interface BroadcastModalProps {
  post: PipelinePost;
  profiles: TeamProfileWithConnection[];
  onClose: () => void;
  onBroadcast: () => void;
}

export function BroadcastModal({
  post,
  profiles,
  onClose,
  onBroadcast,
}: BroadcastModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(
      profiles
        .filter((p) => p.id !== post.team_profile_id && p.linkedin_connected)
        .map((p) => p.id)
    )
  );
  const [staggerDays, setStaggerDays] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  const toggleProfile = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/content-pipeline/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_post_id: post.id,
          target_profile_ids: Array.from(selectedIds),
          stagger_days: staggerDays,
        }),
      });

      if (res.ok) {
        onBroadcast();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const content = post.final_content || post.draft_content || '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Broadcast to Team</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            AI will rewrite this post in each member's voice and schedule it across{' '}
            {staggerDays} days.
          </p>
        </div>

        {/* Source preview */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="text-xs font-medium text-gray-500 mb-1">Source post</div>
          <p className="text-sm whitespace-pre-line line-clamp-4">{content}</p>
        </div>

        {/* Profile selection */}
        <div className="p-4 space-y-3">
          <div className="text-sm font-medium">Select team members</div>
          {profiles
            .filter((p) => p.id !== post.team_profile_id)
            .map((profile) => (
              <label
                key={profile.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(profile.id)}
                  onChange={() => toggleProfile(profile.id)}
                  className="rounded border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{profile.full_name}</span>
                  {profile.title && (
                    <span className="text-xs text-gray-500 ml-2">{profile.title}</span>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    profile.linkedin_connected
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {profile.linkedin_connected ? 'Connected' : 'No LinkedIn'}
                </span>
              </label>
            ))}
        </div>

        {/* Stagger config */}
        <div className="p-4 border-t">
          <label className="flex items-center gap-3">
            <span className="text-sm">Spread across</span>
            <select
              value={staggerDays}
              onChange={(e) => setStaggerDays(parseInt(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value={1}>1 day (same day)</option>
              <option value={2}>2 days</option>
              <option value={3}>3 days</option>
              <option value={5}>5 days (one per day)</option>
            </select>
          </label>
          <p className="text-xs text-gray-400 mt-1">
            Staggering avoids LinkedIn detecting coordinated posting
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 border-t flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedIds.size === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting
              ? 'Broadcasting...'
              : `Broadcast to ${selectedIds.size} member${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Wire BroadcastModal into TeamCommandCenter**

Add to `TeamCommandCenter.tsx`:

```typescript
import { BroadcastModal } from './BroadcastModal';

// Add state:
const [broadcastPost, setBroadcastPost] = useState<PipelinePost | null>(null);

// Add "Broadcast" button to the post detail or right-click context:
// In handleBroadcast:
const handleBroadcast = (post: PipelinePost) => {
  setBroadcastPost(post);
  setSelectedPost(null);
};

// Render broadcast modal:
{broadcastPost && data && (
  <BroadcastModal
    post={broadcastPost}
    profiles={data.profiles}
    onClose={() => setBroadcastPost(null)}
    onBroadcast={() => {
      setBroadcastPost(null);
      fetchSchedule();
    }}
  />
)}
```

Also add a "Broadcast to Team" button accessible from the post detail sidebar/modal. The easiest approach: add a context menu (right-click) on `GridCell` that includes "Broadcast to team" for filled cells.

**Step 5: Write tests**

Create `src/__tests__/api/content-pipeline/broadcast.test.ts`:

```typescript
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}));

jest.mock('@trigger.dev/sdk/v3', () => ({
  tasks: {
    trigger: jest.fn().mockResolvedValue({ id: 'run-123' }),
  },
}));

describe('POST /api/content-pipeline/broadcast', () => {
  it('returns 400 if source_post_id missing', async () => {
    const { POST } = await import('@/app/api/content-pipeline/broadcast/route');
    const req = new NextRequest('http://localhost/api/content-pipeline/broadcast', {
      method: 'POST',
      body: JSON.stringify({ target_profile_ids: ['p1'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('triggers broadcast task with correct payload', async () => {
    const { tasks } = require('@trigger.dev/sdk/v3');
    const { POST } = await import('@/app/api/content-pipeline/broadcast/route');
    const req = new NextRequest('http://localhost/api/content-pipeline/broadcast', {
      method: 'POST',
      body: JSON.stringify({
        source_post_id: 'post-1',
        target_profile_ids: ['p1', 'p2'],
        stagger_days: 3,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(tasks.trigger).toHaveBeenCalledWith('broadcast-post-variations', {
      sourcePostId: 'post-1',
      targetProfileIds: ['p1', 'p2'],
      userId: 'user-1',
      staggerDays: 3,
    });
  });
});
```

**Step 6: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/api/content-pipeline/broadcast.test.ts`
Expected: Tests pass

**Step 7: Commit**

```bash
git add src/trigger/broadcast-post-variations.ts src/app/api/content-pipeline/broadcast/route.ts src/components/content-pipeline/BroadcastModal.tsx src/components/content-pipeline/TeamCommandCenter.tsx src/__tests__/api/content-pipeline/broadcast.test.ts
git commit -m "feat: add broadcast-to-team with AI voice variations"
```

---

## Task 7: Content Collision Detection

**Files:**
- Create: `src/lib/ai/content-pipeline/collision-detector.ts`
- Modify: `src/trigger/broadcast-post-variations.ts` (add collision check)
- Modify: `src/components/content-pipeline/TeamCommandCenter.tsx` (show warnings)

**Step 1: Write the collision detector**

Create `src/lib/ai/content-pipeline/collision-detector.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  defaultHeaders: {
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
  },
  baseURL: process.env.HELICONE_API_KEY
    ? 'https://anthropic.helicone.ai/v1'
    : undefined,
});

interface PostForCollision {
  id: string;
  profile_name: string;
  content: string;
  scheduled_date: string; // YYYY-MM-DD
}

interface CollisionResult {
  has_collision: boolean;
  collisions: {
    post_a_id: string;
    post_b_id: string;
    overlap_description: string;
    severity: 'high' | 'medium' | 'low';
    suggestion: string;
  }[];
}

export async function detectContentCollisions(
  posts: PostForCollision[]
): Promise<CollisionResult> {
  if (posts.length < 2) return { has_collision: false, collisions: [] };

  // Group by date
  const byDate = posts.reduce(
    (acc, p) => {
      if (!acc[p.scheduled_date]) acc[p.scheduled_date] = [];
      acc[p.scheduled_date].push(p);
      return acc;
    },
    {} as Record<string, PostForCollision[]>
  );

  // Only check dates with 2+ posts
  const sameDayGroups = Object.entries(byDate).filter(([, group]) => group.length >= 2);
  if (sameDayGroups.length === 0) return { has_collision: false, collisions: [] };

  const postSummaries = sameDayGroups
    .map(
      ([date, group]) =>
        `DATE: ${date}\n${group
          .map(
            (p) =>
              `- [${p.id}] ${p.profile_name}: "${p.content.split('\n')[0]?.slice(0, 150)}"`
          )
          .join('\n')}`
    )
    .join('\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `You're checking LinkedIn posts scheduled for the same day by different team members. Flag if any posts on the same day cover the same core topic (would look coordinated/redundant to the audience).

POSTS:
${postSummaries}

Respond in JSON only:
{
  "has_collision": boolean,
  "collisions": [
    {
      "post_a_id": "id",
      "post_b_id": "id",
      "overlap_description": "Both discuss X topic",
      "severity": "high|medium|low",
      "suggestion": "Move post B to Thursday instead"
    }
  ]
}

If no collisions, return {"has_collision": false, "collisions": []}`,
      },
    ],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { has_collision: false, collisions: [] };
  } catch {
    return { has_collision: false, collisions: [] };
  }
}
```

**Step 2: Add collision detection to the team schedule API**

Add an optional `?check_collisions=true` query param to `GET /api/content-pipeline/team-schedule`. When set, run collision detection on posts for the week and include results in the response.

Add to the end of the GET handler in `src/app/api/content-pipeline/team-schedule/route.ts`:

```typescript
import { detectContentCollisions } from '@/lib/ai/content-pipeline/collision-detector';

// At end of GET handler, before return:
let collisions = null;
const checkCollisions = searchParams.get('check_collisions') === 'true';

if (checkCollisions && posts?.length >= 2) {
  const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
  const postsForCheck = (posts || [])
    .filter(p => p.scheduled_time)
    .map(p => ({
      id: p.id,
      profile_name: profileMap.get(p.team_profile_id) || 'Unknown',
      content: p.final_content || p.draft_content || '',
      scheduled_date: new Date(p.scheduled_time!).toISOString().split('T')[0],
    }));

  collisions = await detectContentCollisions(postsForCheck);
}

// Add to response JSON:
return NextResponse.json({
  // ... existing fields
  collisions,
});
```

**Step 3: Show collision warnings in TeamCommandCenter**

Add to `TeamCommandCenter.tsx`:

```typescript
// Add state for collisions:
const [collisions, setCollisions] = useState<CollisionResult | null>(null);

// After initial fetch, do a collision check:
useEffect(() => {
  if (data && data.posts.length >= 2) {
    fetch(
      `/api/content-pipeline/team-schedule?team_id=${teamId}&week_start=${weekStart.toISOString()}&check_collisions=true`
    )
      .then((r) => r.json())
      .then((json) => {
        if (json.collisions?.has_collision) {
          setCollisions(json.collisions);
        }
      });
  }
}, [data]);

// Render collision banner if detected:
{collisions?.has_collision && (
  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
    <p className="text-sm font-medium text-orange-800 mb-1">
      Content overlap detected
    </p>
    {collisions.collisions.map((c, i) => (
      <div key={i} className="text-xs text-orange-700 mb-1">
        <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
          c.severity === 'high' ? 'bg-red-500' : c.severity === 'medium' ? 'bg-orange-500' : 'bg-yellow-500'
        }`} />
        {c.overlap_description} — {c.suggestion}
      </div>
    ))}
  </div>
)}
```

**Step 4: Commit**

```bash
git add src/lib/ai/content-pipeline/collision-detector.ts src/app/api/content-pipeline/team-schedule/route.ts src/components/content-pipeline/TeamCommandCenter.tsx
git commit -m "feat: add content collision detection for same-day team posts"
```

---

## Task 8: Context Menu + Post Actions

**Files:**
- Create: `src/components/content-pipeline/GridContextMenu.tsx`
- Modify: `src/components/content-pipeline/GridCell.tsx`
- Modify: `src/components/content-pipeline/TeamCommandCenter.tsx`

**Step 1: Create the context menu component**

Create `src/components/content-pipeline/GridContextMenu.tsx`:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import type { PipelinePost } from '@/lib/types/content-pipeline';

interface GridContextMenuProps {
  post: PipelinePost;
  x: number;
  y: number;
  onClose: () => void;
  onViewDetails: () => void;
  onBroadcast: () => void;
  onReschedule: () => void;
  onRemoveFromSchedule: () => void;
}

export function GridContextMenu({
  post,
  x,
  y,
  onClose,
  onViewDetails,
  onBroadcast,
  onReschedule,
  onRemoveFromSchedule,
}: GridContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-lg shadow-lg border py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={onViewDetails}
        className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
      >
        View details
      </button>
      <button
        onClick={onBroadcast}
        className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
      >
        Broadcast to team
      </button>
      <button
        onClick={onReschedule}
        className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
      >
        Reschedule
      </button>
      <hr className="my-1" />
      <button
        onClick={onRemoveFromSchedule}
        className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
      >
        Remove from schedule
      </button>
    </div>
  );
}
```

**Step 2: Add right-click handler to GridCell**

Modify `src/components/content-pipeline/GridCell.tsx` — add `onContextMenu` prop:

```typescript
interface GridCellProps {
  // ... existing props
  onContextMenu?: (e: React.MouseEvent) => void;
}

// On the post button:
<button
  onClick={onCellClick}
  onContextMenu={(e) => {
    e.preventDefault();
    onContextMenu?.(e);
  }}
  // ... rest
>
```

**Step 3: Wire context menu into TeamCommandCenter**

Add state and handlers to `TeamCommandCenter.tsx`:

```typescript
const [contextMenu, setContextMenu] = useState<{
  post: PipelinePost;
  x: number;
  y: number;
} | null>(null);

// Pass to WeeklyGrid:
onPostContextMenu={(post, e) =>
  setContextMenu({ post, x: e.clientX, y: e.clientY })
}

// Render:
{contextMenu && (
  <GridContextMenu
    post={contextMenu.post}
    x={contextMenu.x}
    y={contextMenu.y}
    onClose={() => setContextMenu(null)}
    onViewDetails={() => {
      setSelectedPost(contextMenu.post);
      setContextMenu(null);
    }}
    onBroadcast={() => {
      setBroadcastPost(contextMenu.post);
      setContextMenu(null);
    }}
    onReschedule={() => {
      setSelectedPost(contextMenu.post);
      setContextMenu(null);
    }}
    onRemoveFromSchedule={async () => {
      await fetch(`/api/content-pipeline/posts/${contextMenu.post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          scheduled_time: null,
          is_buffer: true,
        }),
      });
      setContextMenu(null);
      fetchSchedule();
    }}
  />
)}
```

**Step 4: Commit**

```bash
git add src/components/content-pipeline/GridContextMenu.tsx src/components/content-pipeline/GridCell.tsx src/components/content-pipeline/WeeklyGrid.tsx src/components/content-pipeline/TeamCommandCenter.tsx
git commit -m "feat: add right-click context menu with broadcast action on grid cells"
```

---

## Task 9: Typecheck + Lint + Final Integration Test

**Step 1: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run typecheck`
Expected: No type errors. Fix any issues found.

**Step 2: Run lint**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run lint`
Expected: No lint errors. Fix any issues found.

**Step 3: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test`
Expected: All tests pass, including the new ones.

**Step 4: Manual smoke test**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run dev`

Manual verification checklist:
- Navigate to Content Pipeline → see "Command Center" tab (only in team context)
- Click Command Center → see weekly grid with team profiles as rows
- See LinkedIn connection status indicators per profile
- Click empty slot → buffer dock appears
- Click filled cell → post detail sidebar
- Right-click filled cell → context menu with "Broadcast to team"
- Week navigation (prev/next/this week) works

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve typecheck and lint issues in Team Command Center"
```

---

## Task 10: Update CLAUDE.md Documentation

**Files:**
- Modify: `/Users/timlife/Documents/claude code/magnetlab/CLAUDE.md`

**Step 1: Add Team Command Center section to CLAUDE.md**

Add a new section after "Engagement Intelligence" documenting:

```markdown
## Team Command Center (Multi-Account Scheduling)

Unified weekly calendar view for managing LinkedIn posts across all team members from one screen. Includes broadcast-to-team with AI voice-adapted variations and content collision detection.

### Data Model

- `team_profile_integrations` — per-profile LinkedIn connection (service, metadata with unipile_account_id, connected_by)
- `cp_pipeline_posts.broadcast_group_id` — UUID linking broadcast siblings

### Architecture

```
Team Command Center (weekly grid) → team-schedule API → Supabase
  ↓ right-click "Broadcast"
  → broadcast API → Trigger.dev `broadcast-post-variations` task
    → Claude AI rewrites in each member's voice
    → Creates variation posts (status: reviewing)
    → Auto-staggers across 2-3 days
  ↓ collision check (Haiku)
  → Detects same-day topic overlap → suggests rescheduling
```

### Key Files

| File | Purpose |
|------|---------|
| `src/components/content-pipeline/TeamCommandCenter.tsx` | Main container (week nav, grid, buffer dock) |
| `src/components/content-pipeline/WeeklyGrid.tsx` | Calendar grid (profiles × days) |
| `src/components/content-pipeline/GridCell.tsx` | Individual day cell (post preview, empty slot) |
| `src/components/content-pipeline/BroadcastModal.tsx` | Profile picker + stagger config |
| `src/components/content-pipeline/GridContextMenu.tsx` | Right-click actions (broadcast, reschedule, etc.) |
| `src/components/content-pipeline/TeamLinkedInConnect.tsx` | Connection status banner |
| `src/lib/services/team-integrations.ts` | Team profile LinkedIn account resolution |
| `src/lib/ai/content-pipeline/collision-detector.ts` | Same-day topic overlap detection (Haiku) |
| `src/trigger/broadcast-post-variations.ts` | AI voice rewriting + stagger scheduling |
| `src/app/api/content-pipeline/team-schedule/route.ts` | GET: weekly data for all profiles |
| `src/app/api/content-pipeline/team-schedule/assign/route.ts` | POST: assign buffer post to slot |
| `src/app/api/content-pipeline/broadcast/route.ts` | POST: trigger broadcast task |
| `supabase/migrations/20260226200000_team_command_center.sql` | DB migration |

### LinkedIn Connection

`team_profile_integrations` table decouples LinkedIn connections from user accounts. Connect flow: `/api/linkedin/connect?team_profile_id=X` → Unipile OAuth → webhook stores account ID against the profile. Falls back to `user_integrations` for backward compat.

### Publishing

`getTeamProfileLinkedInPublisher(profileId)` resolves the Unipile account ID from `team_profile_integrations` first, then `user_integrations` fallback.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Team Command Center section to CLAUDE.md"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | DB migration (team_profile_integrations + broadcast_group_id) | `supabase/migrations/` |
| 2 | TypeScript types + team integrations service | `src/lib/services/team-integrations.ts` |
| 3 | API routes (team-schedule, assign, integrations) | `src/app/api/content-pipeline/team-schedule/` |
| 4 | Weekly calendar grid UI (GridCell, WeeklyGrid, TeamCommandCenter) | `src/components/content-pipeline/` |
| 5 | LinkedIn connection flow for team profiles | `src/app/api/linkedin/connect/` |
| 6 | Broadcast feature (AI variations + Trigger.dev task + modal) | `src/trigger/broadcast-post-variations.ts` |
| 7 | Content collision detection | `src/lib/ai/content-pipeline/collision-detector.ts` |
| 8 | Context menu + post actions | `src/components/content-pipeline/GridContextMenu.tsx` |
| 9 | Typecheck + lint + smoke test | — |
| 10 | CLAUDE.md documentation | `CLAUDE.md` |
