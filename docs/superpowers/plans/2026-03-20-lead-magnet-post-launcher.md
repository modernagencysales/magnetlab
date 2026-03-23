# Lead Magnet Post Launcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the copilot (and later the UI) to post a lead magnet on any team member's LinkedIn account and auto-activate comment monitoring — in one action.

**Architecture:** Three layers — (1) new API route `POST /api/lead-magnet-post/launch` that orchestrates publish → create campaign → auto-setup → activate, (2) three new MCP tools (`magnetlab_list_sender_accounts`, `magnetlab_publish_linkedin_post`, `magnetlab_launch_lead_magnet_post`), (3) missing `GET /api/post-campaigns/sender-accounts` endpoint that both MCP and UI need.

**Tech Stack:** Next.js API routes, Supabase (admin client), Unipile SDK, MCP tool definitions (packages/mcp), existing `team-integrations.ts` service, existing `post-campaigns.service.ts`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/api/post-campaigns/sender-accounts/route.ts` | GET — list team profiles with connected LinkedIn accounts |
| Create | `src/app/api/lead-magnet-post/launch/route.ts` | POST — orchestrate: publish to LinkedIn → create campaign → auto-setup → activate |
| Create | `src/server/services/lead-magnet-post-launcher.service.ts` | Business logic for the orchestrated launch flow |
| Create | `packages/mcp/src/tools/lead-magnet-post.ts` | 3 tool definitions: list_sender_accounts, publish_linkedin_post, launch_lead_magnet_post |
| Create | `packages/mcp/src/handlers/lead-magnet-post.ts` | Handler dispatcher for the 3 new tools |
| Modify | `packages/mcp/src/client.ts` | Add 3 client methods: listSenderAccounts, publishLinkedInPost, launchLeadMagnetPost |
| Modify | `packages/mcp/src/validation.ts` | Add Zod schemas for 3 new tools (required — `validateToolArgs` throws without them) |
| Modify | `packages/mcp/src/tools/index.ts` | Register new tool array |
| Modify | `packages/mcp/src/handlers/index.ts` | Register new handler + handler map entries |
| Create | `src/__tests__/api/lead-magnet-post/launch.test.ts` | Tests for the launch orchestrator |
| Create | `src/__tests__/api/post-campaigns/sender-accounts.test.ts` | Tests for sender accounts endpoint |

**Key interfaces (verified from source):**
- `AutoSetupResult` (`src/lib/ai/post-campaign/auto-setup.ts`): returns `keyword` (singular string), NOT `keywords` (array)
- `UnipilePost` (`src/lib/types/integrations.ts`): has `id`, `social_id` — NO `url` field. Always construct URL from `social_id`.
- `normalizePostUrl` (`src/lib/utils/linkedin-url.ts`): accepts feed URLs like `https://www.linkedin.com/feed/update/urn:li:activity:123`
- `validateToolArgs` (`packages/mcp/src/validation.ts`): throws `Unknown tool` if no Zod schema exists — schemas are REQUIRED

---

### Task 1: Sender Accounts API Route

The `CampaignForm.tsx` already calls `listSenderAccounts()` which hits `GET /api/post-campaigns/sender-accounts` — but the route doesn't exist. This is needed by both MCP tools and UI.

**Files:**
- Create: `src/app/api/post-campaigns/sender-accounts/route.ts`
- Create: `src/__tests__/api/post-campaigns/sender-accounts.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/__tests__/api/post-campaigns/sender-accounts.test.ts

import { GET } from '@/app/api/post-campaigns/sender-accounts/route';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock team-context
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn(),
}));

// Mock team-integrations
jest.mock('@/lib/services/team-integrations', () => ({
  getTeamProfilesWithConnections: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { getTeamProfilesWithConnections } from '@/lib/services/team-integrations';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockGetDataScope = getDataScope as jest.MockedFunction<typeof getDataScope>;
const mockGetProfiles = getTeamProfilesWithConnections as jest.MockedFunction<typeof getTeamProfilesWithConnections>;

describe('GET /api/post-campaigns/sender-accounts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns empty array for personal scope (no team)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockGetDataScope.mockResolvedValue({ type: 'personal', userId: 'u1' } as any);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.accounts).toEqual([]);
  });

  it('returns connected profiles for team scope', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' } as any);
    mockGetProfiles.mockResolvedValue([
      { id: 'p1', full_name: 'Christian', linkedin_connected: true, unipile_account_id: 'acc1' } as any,
      { id: 'p2', full_name: 'Vlad', linkedin_connected: false, unipile_account_id: null } as any,
    ]);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0]).toEqual({
      team_profile_id: 'p1',
      name: 'Christian',
      unipile_account_id: 'acc1',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="sender-accounts" --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write the API route**

```typescript
// src/app/api/post-campaigns/sender-accounts/route.ts

/** Sender Accounts. Lists team profiles with connected LinkedIn (Unipile) accounts.
 *  Never contains business logic — reads from team-integrations service. */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getTeamProfilesWithConnections } from '@/lib/services/team-integrations';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);

    // Personal scope — no team profiles to list
    if (scope.type !== 'team' || !scope.teamId) {
      return NextResponse.json({ accounts: [] });
    }

    const profiles = await getTeamProfilesWithConnections(scope.teamId);
    const accounts = profiles
      .filter((p) => p.linkedin_connected && p.unipile_account_id)
      .map((p) => ({
        team_profile_id: p.id,
        name: p.full_name || '',
        unipile_account_id: p.unipile_account_id,
      }));

    return NextResponse.json({ accounts });
  } catch (error) {
    logApiError('post-campaigns/sender-accounts', error);
    return ApiErrors.internalError('Failed to list sender accounts');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="sender-accounts" --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/app/api/post-campaigns/sender-accounts/route.ts src/__tests__/api/post-campaigns/sender-accounts.test.ts
git commit -m "feat: add GET /api/post-campaigns/sender-accounts endpoint"
```

---

### Task 2: Lead Magnet Post Launcher Service

The orchestrator service that: (1) publishes a post to LinkedIn via a team member's Unipile account, (2) creates a post campaign linked to the resulting LinkedIn URL, (3) runs AI auto-setup for keywords/templates, (4) activates the campaign.

**Files:**
- Create: `src/server/services/lead-magnet-post-launcher.service.ts`

- [ ] **Step 1: Write the test file**

Create `src/__tests__/services/lead-magnet-post-launcher.test.ts`:

```typescript
import { launchLeadMagnetPost } from '@/server/services/lead-magnet-post-launcher.service';

// Mock dependencies
jest.mock('@/lib/services/team-integrations', () => ({
  getTeamProfileUnipileAccountId: jest.fn(),
}));
jest.mock('@/lib/integrations/unipile', () => ({
  getUnipileClient: jest.fn(),
  isUnipileConfigured: jest.fn().mockReturnValue(true),
}));
jest.mock('@/server/services/post-campaigns.service', () => ({
  createCampaign: jest.fn(),
  activateCampaign: jest.fn(),
}));
jest.mock('@/lib/ai/post-campaign/auto-setup', () => ({
  analyzePostForCampaign: jest.fn(),
}));
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  }),
}));

import { getTeamProfileUnipileAccountId } from '@/lib/services/team-integrations';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { createCampaign, activateCampaign } from '@/server/services/post-campaigns.service';
import { analyzePostForCampaign } from '@/lib/ai/post-campaign/auto-setup';

const mockGetAccountId = getTeamProfileUnipileAccountId as jest.MockedFunction<typeof getTeamProfileUnipileAccountId>;
const mockGetClient = getUnipileClient as jest.MockedFunction<typeof getUnipileClient>;
const mockCreateCampaign = createCampaign as jest.MockedFunction<typeof createCampaign>;
const mockActivateCampaign = activateCampaign as jest.MockedFunction<typeof activateCampaign>;
const mockAnalyze = analyzePostForCampaign as jest.MockedFunction<typeof analyzePostForCampaign>;

describe('launchLeadMagnetPost', () => {
  const mockClient = {
    createPost: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClient.mockReturnValue(mockClient as any);
  });

  it('throws if team profile has no Unipile account', async () => {
    mockGetAccountId.mockResolvedValue(null);
    await expect(
      launchLeadMagnetPost({
        userId: 'u1',
        teamId: 't1',
        teamProfileId: 'p1',
        postText: 'Hello world',
        funnelPageId: 'f1',
      })
    ).rejects.toThrow('LinkedIn account not connected');
  });

  it('throws if Unipile publish fails', async () => {
    mockGetAccountId.mockResolvedValue('acc1');
    mockClient.createPost.mockResolvedValue({ error: 'rate limited', data: null });
    await expect(
      launchLeadMagnetPost({
        userId: 'u1',
        teamId: 't1',
        teamProfileId: 'p1',
        postText: 'Hello world',
        funnelPageId: 'f1',
      })
    ).rejects.toThrow('Failed to publish');
  });

  it('orchestrates full flow: publish → create campaign → activate', async () => {
    mockGetAccountId.mockResolvedValue('acc1');
    mockClient.createPost.mockResolvedValue({
      error: null,
      data: { id: 'post123', social_id: 'urn:li:activity:123', account_id: 'acc1', provider: 'LINKEDIN', text: 'test', created_at: '2026-03-20' },
    });
    // AutoSetupResult uses singular `keyword` (string), not `keywords` (array)
    mockAnalyze.mockResolvedValue({
      keyword: 'guide',
      dmTemplate: 'Hey {{first_name}}, here is the guide: {{funnel_url}}',
      replyTemplate: 'Thanks for commenting!',
      funnelPageId: 'f1',
      funnelName: 'Growth Guide',
      deliveryAccountId: 'acc1',
      deliveryAccountName: 'Christian',
      posterAccountId: 'p1',
      confidence: 'high',
      needsUserInput: [],
    } as any);
    mockCreateCampaign.mockResolvedValue({
      success: true,
      data: { id: 'camp1', name: 'Test', status: 'draft' },
    } as any);
    mockActivateCampaign.mockResolvedValue({
      success: true,
      data: { id: 'camp1', name: 'Test', status: 'active' },
    } as any);

    const result = await launchLeadMagnetPost({
      userId: 'u1',
      teamId: 't1',
      teamProfileId: 'p1',
      postText: 'Download my free LinkedIn growth guide...',
      funnelPageId: 'f1',
    });

    expect(mockClient.createPost).toHaveBeenCalledWith('acc1', expect.any(String));
    expect(mockCreateCampaign).toHaveBeenCalled();
    expect(mockActivateCampaign).toHaveBeenCalled();
    expect(result.linkedinPostUrl).toContain('linkedin.com');
    expect(result.campaignId).toBe('camp1');
    expect(result.status).toBe('active');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="lead-magnet-post-launcher" --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write the launcher service**

```typescript
// src/server/services/lead-magnet-post-launcher.service.ts

/** Lead Magnet Post Launcher. Orchestrates: publish to LinkedIn → create campaign → auto-setup → activate.
 *  Never imports NextRequest/NextResponse. Depends on team-integrations, unipile, post-campaigns services. */

import { getTeamProfileUnipileAccountId } from '@/lib/services/team-integrations';
import { getUnipileClient, isUnipileConfigured } from '@/lib/integrations/unipile';
import { createCampaign, activateCampaign } from '@/server/services/post-campaigns.service';
import { analyzePostForCampaign } from '@/lib/ai/post-campaign/auto-setup';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LaunchInput {
  userId: string;
  teamId: string;
  teamProfileId: string;
  postText: string;
  funnelPageId?: string;
  /** Override AI-generated keywords */
  keywords?: string[];
  /** Override AI-generated DM template */
  dmTemplate?: string;
  /** Campaign name override (default: auto-generated) */
  campaignName?: string;
}

export interface LaunchResult {
  linkedinPostUrl: string;
  linkedinPostId: string;
  campaignId: string;
  campaignName: string;
  status: 'active';
  keywords: string[];
  funnelPageId: string | null;
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export async function launchLeadMagnetPost(input: LaunchInput): Promise<LaunchResult> {
  const {
    userId,
    teamId,
    teamProfileId,
    postText,
    funnelPageId,
    keywords: overrideKeywords,
    dmTemplate: overrideDmTemplate,
    campaignName: overrideName,
  } = input;

  // 1. Resolve Unipile account for this team profile
  const unipileAccountId = await getTeamProfileUnipileAccountId(teamProfileId);
  if (!unipileAccountId) {
    throw Object.assign(
      new Error('LinkedIn account not connected for this team profile'),
      { statusCode: 400 }
    );
  }

  if (!isUnipileConfigured()) {
    throw Object.assign(new Error('Unipile is not configured'), { statusCode: 500 });
  }

  // 2. Publish to LinkedIn
  const client = getUnipileClient();
  const publishResult = await client.createPost(unipileAccountId, postText);

  if (publishResult.error || !publishResult.data) {
    throw Object.assign(
      new Error(`Failed to publish to LinkedIn: ${publishResult.error || 'unknown error'}`),
      { statusCode: 502 }
    );
  }

  const linkedinPostId = publishResult.data.social_id || publishResult.data.id;
  // UnipilePost has no `url` field — always construct from social_id
  const linkedinPostUrl = `https://www.linkedin.com/feed/update/${linkedinPostId}`;

  // 3. Resolve funnel info for AI context
  let publishedFunnels: Array<{ id: string; title: string; slug: string; leadMagnetTitle: string }> = [];
  if (funnelPageId) {
    const supabase = createSupabaseAdminClient();
    const { data: funnel } = await supabase
      .from('funnel_pages')
      .select('id, slug, optin_headline, lead_magnets(title)')
      .eq('id', funnelPageId)
      .single();

    if (funnel) {
      publishedFunnels = [{
        id: funnel.id as string,
        title: (funnel.optin_headline as string) || '',
        slug: (funnel.slug as string) || '',
        leadMagnetTitle: (funnel.lead_magnets as { title: string } | null)?.title || '',
      }];
    }
  }

  // 4. AI auto-setup (keywords, DM template, reply template)
  let keywords = overrideKeywords || [];
  let dmTemplate = overrideDmTemplate || '';
  let replyTemplate = '';
  let resolvedFunnelPageId = funnelPageId || null;

  if (!overrideKeywords || !overrideDmTemplate) {
    try {
      const aiResult = await analyzePostForCampaign({
        postText,
        publishedFunnels,
        teamProfiles: [],
        posterProfileId: teamProfileId,
      });
      // AutoSetupResult returns singular `keyword` (string), not `keywords` (array)
      if (!overrideKeywords) keywords = aiResult.keyword ? [aiResult.keyword] : [];
      if (!overrideDmTemplate) dmTemplate = aiResult.dmTemplate || '';
      replyTemplate = aiResult.replyTemplate || '';
      if (!resolvedFunnelPageId && aiResult.funnelPageId) {
        resolvedFunnelPageId = aiResult.funnelPageId;
      }
    } catch (err) {
      // AI failure should not block the launch — use sensible defaults
      logError('lead-magnet-post-launcher', err, { step: 'auto-setup' });
      if (!keywords.length) keywords = ['guide', 'interested', 'send'];
      if (!dmTemplate) dmTemplate = 'Hey {{first_name}}, thanks for your interest! Here you go: {{funnel_url}}';
    }
  }

  // 5. Create post campaign
  const name = overrideName || `Lead Magnet Post — ${new Date().toISOString().slice(0, 10)}`;

  const campaignResult = await createCampaign(userId, teamId, {
    name,
    post_url: linkedinPostUrl,
    keywords,
    unipile_account_id: unipileAccountId,
    dm_template: dmTemplate,
    reply_template: replyTemplate,
    funnel_page_id: resolvedFunnelPageId || undefined,
    auto_accept_connections: true,
    auto_like_comments: true,
    auto_connect_non_requesters: true,
  });

  if (!campaignResult.success) {
    throw Object.assign(
      new Error(`Failed to create campaign: ${campaignResult.message || 'unknown'}`),
      { statusCode: 500 }
    );
  }

  const campaignId = campaignResult.data.id;

  // 6. Activate immediately
  const activateResult = await activateCampaign(userId, campaignId);
  if (!activateResult.success) {
    // Campaign was created but not activated — still return it, just warn
    logError('lead-magnet-post-launcher', new Error('Failed to activate campaign'), {
      campaignId,
      error: activateResult.message,
    });
  }

  return {
    linkedinPostUrl,
    linkedinPostId,
    campaignId,
    campaignName: name,
    status: 'active',
    keywords,
    funnelPageId: resolvedFunnelPageId,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="lead-magnet-post-launcher" --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/server/services/lead-magnet-post-launcher.service.ts src/__tests__/services/lead-magnet-post-launcher.test.ts
git commit -m "feat: add lead magnet post launcher orchestrator service"
```

---

### Task 3: Launch API Route

Thin API route that delegates to the launcher service.

**Files:**
- Create: `src/app/api/lead-magnet-post/launch/route.ts`
- Create: `src/__tests__/api/lead-magnet-post/launch.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/__tests__/api/lead-magnet-post/launch.test.ts

import { POST } from '@/app/api/lead-magnet-post/launch/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/utils/team-context', () => ({ getDataScope: jest.fn() }));
jest.mock('@/server/services/lead-magnet-post-launcher.service', () => ({
  launchLeadMagnetPost: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { launchLeadMagnetPost } from '@/server/services/lead-magnet-post-launcher.service';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockGetDataScope = getDataScope as jest.MockedFunction<typeof getDataScope>;
const mockLaunch = launchLeadMagnetPost as jest.MockedFunction<typeof launchLeadMagnetPost>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/lead-magnet-post/launch', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/lead-magnet-post/launch', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ team_profile_id: 'p1', post_text: 'hi' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when team_profile_id is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' } as any);
    const res = await POST(makeRequest({ post_text: 'hi' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when post_text is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' } as any);
    const res = await POST(makeRequest({ team_profile_id: 'p1' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 with launch result on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' } as any);
    mockLaunch.mockResolvedValue({
      linkedinPostUrl: 'https://linkedin.com/feed/update/urn:li:activity:123',
      linkedinPostId: 'urn:li:activity:123',
      campaignId: 'camp1',
      campaignName: 'Test Campaign',
      status: 'active',
      keywords: ['guide'],
      funnelPageId: 'f1',
    });

    const res = await POST(makeRequest({
      team_profile_id: 'p1',
      post_text: 'Check out my guide',
      funnel_page_id: 'f1',
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.linkedinPostUrl).toBeDefined();
    expect(body.campaignId).toBe('camp1');
    expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      teamId: 't1',
      teamProfileId: 'p1',
      postText: 'Check out my guide',
      funnelPageId: 'f1',
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="lead-magnet-post/launch" --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write the API route**

```typescript
// src/app/api/lead-magnet-post/launch/route.ts

/** Lead Magnet Post Launch. Publishes to LinkedIn and auto-creates an active post campaign.
 *  Never contains business logic — delegates to launcher service. */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { launchLeadMagnetPost } from '@/server/services/lead-magnet-post-launcher.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('Team context required. Select a team first.');
    }

    const body = await request.json();
    const { team_profile_id, post_text, funnel_page_id, keywords, dm_template, campaign_name } = body;

    if (!team_profile_id || typeof team_profile_id !== 'string') {
      return ApiErrors.validationError('team_profile_id is required');
    }
    if (!post_text || typeof post_text !== 'string') {
      return ApiErrors.validationError('post_text is required');
    }

    const result = await launchLeadMagnetPost({
      userId: session.user.id,
      teamId: scope.teamId,
      teamProfileId: team_profile_id,
      postText: post_text,
      funnelPageId: funnel_page_id,
      keywords,
      dmTemplate: dm_template,
      campaignName: campaign_name,
    });

    return NextResponse.json(result);
  } catch (error) {
    logApiError('lead-magnet-post/launch', error);
    const statusCode =
      error && typeof error === 'object' && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : 500;
    if (statusCode === 400) {
      return ApiErrors.validationError((error as Error).message);
    }
    if (statusCode === 502) {
      return ApiErrors.internalError((error as Error).message);
    }
    return ApiErrors.internalError('Failed to launch lead magnet post');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="lead-magnet-post/launch" --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/app/api/lead-magnet-post/launch/route.ts src/__tests__/api/lead-magnet-post/launch.test.ts
git commit -m "feat: add POST /api/lead-magnet-post/launch orchestrator route"
```

---

### Task 4: MCP Tool Definitions

Three new tools: `magnetlab_list_sender_accounts`, `magnetlab_publish_linkedin_post`, `magnetlab_launch_lead_magnet_post`.

**Files:**
- Create: `packages/mcp/src/tools/lead-magnet-post.ts`

- [ ] **Step 1: Write the tool definitions**

```typescript
// packages/mcp/src/tools/lead-magnet-post.ts

/** Lead magnet post tools (3). List sender accounts, publish to LinkedIn, launch lead magnet post with auto-campaign. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const leadMagnetPostTools: Tool[] = [
  {
    name: 'magnetlab_list_sender_accounts',
    description:
      'List team members with connected LinkedIn accounts. Returns profile ID, name, and Unipile account ID for each connected member. Use the team_profile_id from this response in publish and launch tools.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_publish_linkedin_post',
    description:
      'Publish a post to LinkedIn on behalf of a team member. Requires a team_profile_id (from magnetlab_list_sender_accounts) and the post text. Returns the LinkedIn post URL. Does NOT create a campaign — use magnetlab_launch_lead_magnet_post for the full flow.',
    inputSchema: {
      type: 'object',
      properties: {
        team_profile_id: {
          type: 'string',
          description: 'Team profile UUID (from magnetlab_list_sender_accounts)',
        },
        post_text: {
          type: 'string',
          description: 'Full LinkedIn post text to publish',
        },
      },
      required: ['team_profile_id', 'post_text'],
    },
  },
  {
    name: 'magnetlab_launch_lead_magnet_post',
    description:
      'One-shot: publish a LinkedIn post on a team member\'s account AND auto-create an active post campaign that monitors comments and DMs the lead magnet funnel link. AI generates keywords and DM template from the post text. The most common workflow for distributing lead magnets.',
    inputSchema: {
      type: 'object',
      properties: {
        team_profile_id: {
          type: 'string',
          description: 'Team profile UUID (from magnetlab_list_sender_accounts)',
        },
        post_text: {
          type: 'string',
          description: 'Full LinkedIn post text to publish',
        },
        funnel_page_id: {
          type: 'string',
          description: 'Funnel page UUID to include in DMs. Use magnetlab_list_funnels to find published funnels.',
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Override AI-generated keywords for comment matching. Omit to let AI decide.',
        },
        dm_template: {
          type: 'string',
          description: 'Override AI-generated DM template. Use {{first_name}} and {{funnel_url}} placeholders. Omit to let AI decide.',
        },
        campaign_name: {
          type: 'string',
          description: 'Optional campaign name. Auto-generated if omitted.',
        },
      },
      required: ['team_profile_id', 'post_text'],
    },
  },
];
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add packages/mcp/src/tools/lead-magnet-post.ts
git commit -m "feat: add lead magnet post MCP tool definitions (3 tools)"
```

---

### Task 5: MCP Client Methods

Add the three HTTP methods to `MagnetLabClient`.

**Files:**
- Modify: `packages/mcp/src/client.ts` (add methods after Post Campaigns section, around line 886)

- [ ] **Step 1: Add client methods**

Add after the `// ─── Post Campaigns ───` section (after `deletePostCampaign`):

```typescript
  // ─── Lead Magnet Post ──────────────────────────────────────────────────────

  async listSenderAccounts() {
    return this.request<{ accounts: Array<{ team_profile_id: string; name: string; unipile_account_id: string }> }>(
      'GET',
      '/post-campaigns/sender-accounts'
    );
  }

  async publishLinkedInPost(params: { team_profile_id: string; post_text: string }) {
    return this.request<{ linkedinPostUrl: string; linkedinPostId: string }>(
      'POST',
      '/lead-magnet-post/launch',
      { ...params, publish_only: true }
    );
  }

  async launchLeadMagnetPost(params: {
    team_profile_id: string;
    post_text: string;
    funnel_page_id?: string;
    keywords?: string[];
    dm_template?: string;
    campaign_name?: string;
  }) {
    return this.aiRequest<{
      linkedinPostUrl: string;
      linkedinPostId: string;
      campaignId: string;
      campaignName: string;
      status: string;
      keywords: string[];
      funnelPageId: string | null;
    }>('POST', '/lead-magnet-post/launch', params);
  }
```

The `publishLinkedInPost` and `launchLeadMagnetPost` tools share the same endpoint with a `publish_only` flag. The publish-only path is extracted to the launcher service to keep the route thin.

**Client methods to add to `client.ts`:**

```typescript
  // ─── Lead Magnet Post ──────────────────────────────────────────────────────

  async listSenderAccounts() {
    return this.request<{ accounts: Array<{ team_profile_id: string; name: string; unipile_account_id: string }> }>(
      'GET',
      '/post-campaigns/sender-accounts'
    );
  }

  async publishLinkedInPost(teamProfileId: string, postText: string) {
    return this.request<{ linkedinPostUrl: string; linkedinPostId: string }>(
      'POST',
      '/lead-magnet-post/launch',
      { team_profile_id: teamProfileId, post_text: postText, publish_only: true }
    );
  }

  async launchLeadMagnetPost(params: {
    team_profile_id: string;
    post_text: string;
    funnel_page_id?: string;
    keywords?: string[];
    dm_template?: string;
    campaign_name?: string;
  }) {
    return this.aiRequest<{
      linkedinPostUrl: string;
      linkedinPostId: string;
      campaignId: string;
      campaignName: string;
      status: string;
      keywords: string[];
      funnelPageId: string | null;
    }>('POST', '/lead-magnet-post/launch', params);
  }
```

- [ ] **Step 2: Add `publishOnly` function to the launcher service**

Add this function to `src/server/services/lead-magnet-post-launcher.service.ts`:

```typescript
// ─── Publish Only ───────────────────────────────────────────────────────────

export interface PublishOnlyResult {
  linkedinPostUrl: string;
  linkedinPostId: string;
}

export async function publishLinkedInPost(
  teamProfileId: string,
  postText: string,
): Promise<PublishOnlyResult> {
  const unipileAccountId = await getTeamProfileUnipileAccountId(teamProfileId);
  if (!unipileAccountId) {
    throw Object.assign(
      new Error('LinkedIn account not connected for this team profile'),
      { statusCode: 400 }
    );
  }

  if (!isUnipileConfigured()) {
    throw Object.assign(new Error('Unipile is not configured'), { statusCode: 500 });
  }

  const client = getUnipileClient();
  const publishResult = await client.createPost(unipileAccountId, postText);

  if (publishResult.error || !publishResult.data) {
    throw Object.assign(
      new Error(`Failed to publish to LinkedIn: ${publishResult.error || 'unknown error'}`),
      { statusCode: 502 }
    );
  }

  const linkedinPostId = publishResult.data.social_id || publishResult.data.id;
  const linkedinPostUrl = `https://www.linkedin.com/feed/update/${linkedinPostId}`;

  return { linkedinPostUrl, linkedinPostId };
}
```

- [ ] **Step 3: Update the launch route to handle publish_only**

In `src/app/api/lead-magnet-post/launch/route.ts`, update the import and add the publish-only branch. Update the import:

```typescript
import { launchLeadMagnetPost, publishLinkedInPost } from '@/server/services/lead-magnet-post-launcher.service';
```

Add this block after the `post_text` validation and before the `launchLeadMagnetPost` call:

```typescript
    // Publish-only mode: just post to LinkedIn, no campaign
    if (body.publish_only) {
      const result = await publishLinkedInPost(team_profile_id, post_text);
      return NextResponse.json(result);
    }
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add packages/mcp/src/client.ts src/app/api/lead-magnet-post/launch/route.ts
git commit -m "feat: add MCP client methods for lead magnet post tools"
```

---

### Task 6: MCP Handler + Registration

Wire the tools into the MCP handler dispatcher.

**Files:**
- Create: `packages/mcp/src/handlers/lead-magnet-post.ts`
- Modify: `packages/mcp/src/tools/index.ts`
- Modify: `packages/mcp/src/handlers/index.ts`

- [ ] **Step 1: Write the handler**

```typescript
// packages/mcp/src/handlers/lead-magnet-post.ts

/** Lead magnet post handler. Dispatches 3 lead magnet post tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';

export async function handleLeadMagnetPostTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_sender_accounts':
      return client.listSenderAccounts();

    case 'magnetlab_publish_linkedin_post':
      return client.publishLinkedInPost(
        args.team_profile_id as string,
        args.post_text as string
      );

    case 'magnetlab_launch_lead_magnet_post':
      return client.launchLeadMagnetPost({
        team_profile_id: args.team_profile_id as string,
        post_text: args.post_text as string,
        funnel_page_id: args.funnel_page_id as string | undefined,
        keywords: args.keywords as string[] | undefined,
        dm_template: args.dm_template as string | undefined,
        campaign_name: args.campaign_name as string | undefined,
      });

    default:
      throw new Error(`Unknown lead magnet post tool: ${name}`);
  }
}
```

- [ ] **Step 2: Add Zod validation schemas to `packages/mcp/src/validation.ts`**

Without these, `validateToolArgs()` throws `Unknown tool` for all 3 new tools. Add before the closing `};` of `toolSchemas`:

```typescript
  // ── Lead Magnet Post (3) ───────────────────────────────────────────────────

  magnetlab_list_sender_accounts: z.object({}),

  magnetlab_publish_linkedin_post: z.object({
    team_profile_id: uuidField,
    post_text: z.string().min(1, 'post_text is required'),
  }),

  magnetlab_launch_lead_magnet_post: z.object({
    team_profile_id: uuidField,
    post_text: z.string().min(1, 'post_text is required'),
    funnel_page_id: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    dm_template: z.string().optional(),
    campaign_name: z.string().optional(),
  }),
```

- [ ] **Step 3: Register tools in `packages/mcp/src/tools/index.ts`**

Add import:
```typescript
import { leadMagnetPostTools } from './lead-magnet-post.js';
```

Add to the tools array:
```typescript
  ...leadMagnetPostTools,
```

Update the JSDoc comment from `77` to `80` tools.

- [ ] **Step 4: Register handler in `packages/mcp/src/handlers/index.ts`**

Add import:
```typescript
import { handleLeadMagnetPostTools } from './lead-magnet-post.js';
```

Add to `handlerMap`:
```typescript
  // Lead magnet post (3)
  magnetlab_list_sender_accounts: handleLeadMagnetPostTools,
  magnetlab_publish_linkedin_post: handleLeadMagnetPostTools,
  magnetlab_launch_lead_magnet_post: handleLeadMagnetPostTools,
```

Add re-export:
```typescript
export { handleLeadMagnetPostTools } from './lead-magnet-post.js';
```

Update the JSDoc tool count to match actual entries (count the handler map entries after adding).

- [ ] **Step 5: Run MCP package tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp" && pnpm test --no-coverage`
Expected: PASS (existing tests should still pass)

- [ ] **Step 6: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add packages/mcp/src/handlers/lead-magnet-post.ts packages/mcp/src/tools/index.ts packages/mcp/src/handlers/index.ts packages/mcp/src/validation.ts
git commit -m "feat: register 3 lead magnet post MCP tools (80 total)"
```

---

### Task 7: Typecheck + Build Verification

- [ ] **Step 1: Run typecheck across monorepo**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: PASS — no type errors

- [ ] **Step 2: Run full test suite**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test --no-coverage`
Expected: PASS — all tests pass

- [ ] **Step 3: Build MCP package**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp" && pnpm build`
Expected: PASS — clean build

- [ ] **Step 4: Build main app**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm build`
Expected: PASS — clean build

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add -A && git commit -m "fix: resolve typecheck/build issues from lead magnet post launcher"
```

---

### Task 8: Manual Smoke Test via MCP

Verify the full flow works end-to-end using the copilot.

- [ ] **Step 1: Test list sender accounts**

Use the MCP tool `magnetlab_list_sender_accounts` and verify Christian and Vlad appear with their Unipile account IDs.

- [ ] **Step 2: Test list funnels**

Use `magnetlab_list_funnels` to find a published funnel to use for the test.

- [ ] **Step 3: Test the full launch (on one account first)**

Use `magnetlab_launch_lead_magnet_post` with:
- `team_profile_id`: Christian's profile ID from step 1
- `post_text`: A test lead magnet post
- `funnel_page_id`: From step 2

Verify:
- Post appears on Christian's LinkedIn
- Campaign was created and is active
- Keywords were auto-generated
- DM template includes the funnel URL placeholder

- [ ] **Step 4: Repeat for second account**

Same flow with Vlad's profile ID.

- [ ] **Step 5: Verify campaigns are monitoring**

Wait 5 minutes, check that `process-post-campaigns` Trigger.dev task picks up the new campaigns.
