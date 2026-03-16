# Post Campaign Automation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate LinkedIn comment-to-DM-to-funnel pipeline: detect commenters via signals, accept connections via Unipile, send DM with funnel link.

**Architecture:** Extend existing signals engine (Harvest API polling) + Unipile integration (new methods for connections + messaging). New `post_campaigns` + `post_campaign_leads` tables with service/repo/API layers. Three Trigger.dev tasks orchestrate the workflow. One action at a time, always randomized delays.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL), Trigger.dev v4, Unipile API, TypeScript.

**Spec:** `docs/superpowers/specs/2026-03-16-post-campaign-automation-design.md`

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `src/lib/types/post-campaigns.ts` | Types for post campaigns, leads, daily limits |
| `src/lib/utils/linkedin-url.ts` | `normalizePostUrl()` + `extractLinkedInUsername()` utilities |
| `src/server/repositories/post-campaigns.repo.ts` | DB access for campaigns, leads, daily limits |
| `src/server/services/post-campaigns.service.ts` | Business logic: CRUD, detection matching, DM rendering |
| `src/app/api/post-campaigns/route.ts` | GET (list), POST (create) |
| `src/app/api/post-campaigns/[id]/route.ts` | GET, PATCH, DELETE |
| `src/app/api/post-campaigns/[id]/activate/route.ts` | POST activate |
| `src/app/api/post-campaigns/[id]/pause/route.ts` | POST pause |
| `src/app/api/post-campaigns/[id]/leads/route.ts` | GET leads |
| `src/app/api/post-campaigns/[id]/test-dm/route.ts` | POST test DM |
| `src/trigger/process-post-campaigns.ts` | Detect leads + send DMs (cron 5 min) |
| `src/trigger/poll-connection-requests.ts` | Accept connections (cron 20 min) |
| `supabase/migrations/20260316200000_post_campaigns.sql` | Tables + RLS + indexes |
| `src/__tests__/lib/linkedin-url.test.ts` | URL normalization tests |
| `src/__tests__/lib/post-campaigns-service.test.ts` | Service logic tests |
| `src/__tests__/api/post-campaigns/create.test.ts` | API route tests |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/integrations/unipile.ts` | Add connection + messaging + profile resolution methods |
| `src/lib/services/signal-engine.ts` | Add `normalizePostUrl()` import, use in processEngagers |
| `src/trigger/signal-push-heyreach.ts` | Add dedup check against post_campaign_leads |

---

## Chunk 1: Unipile Client Extensions + URL Utilities

### Task 1: LinkedIn URL Utilities

**Files:**
- Create: `src/lib/utils/linkedin-url.ts`
- Test: `src/__tests__/lib/linkedin-url.test.ts`

- [ ] **Step 1: Write failing tests for URL utilities**

Create `src/__tests__/lib/linkedin-url.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { normalizePostUrl, extractLinkedInUsername } from '@/lib/utils/linkedin-url';

describe('normalizePostUrl', () => {
  it('normalizes feed/update URL', () => {
    expect(normalizePostUrl('https://www.linkedin.com/feed/update/urn:li:activity:7123456789'))
      .toBe('urn:li:activity:7123456789');
  });

  it('normalizes posts/username URL', () => {
    expect(normalizePostUrl('https://www.linkedin.com/posts/timkeen_gtm-now-runs-activity-7123456789-abcd'))
      .toBe('urn:li:activity:7123456789');
  });

  it('normalizes URL without www', () => {
    expect(normalizePostUrl('https://linkedin.com/feed/update/urn:li:activity:7123456789'))
      .toBe('urn:li:activity:7123456789');
  });

  it('handles URL with query params', () => {
    expect(normalizePostUrl('https://www.linkedin.com/feed/update/urn:li:activity:7123456789?utm_source=share'))
      .toBe('urn:li:activity:7123456789');
  });

  it('returns raw URN if already normalized', () => {
    expect(normalizePostUrl('urn:li:activity:7123456789'))
      .toBe('urn:li:activity:7123456789');
  });

  it('returns null for non-LinkedIn URLs', () => {
    expect(normalizePostUrl('https://example.com/post/123')).toBeNull();
  });
});

describe('extractLinkedInUsername', () => {
  it('extracts username from full URL', () => {
    expect(extractLinkedInUsername('https://www.linkedin.com/in/vladtiminski'))
      .toBe('vladtiminski');
  });

  it('extracts username with trailing slash', () => {
    expect(extractLinkedInUsername('https://www.linkedin.com/in/vladtiminski/'))
      .toBe('vladtiminski');
  });

  it('handles URL without www', () => {
    expect(extractLinkedInUsername('https://linkedin.com/in/vladtiminski'))
      .toBe('vladtiminski');
  });

  it('returns null for non-profile URLs', () => {
    expect(extractLinkedInUsername('https://www.linkedin.com/company/magnetlab'))
      .toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="linkedin-url" --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement URL utilities**

Create `src/lib/utils/linkedin-url.ts`:

```typescript
/** LinkedIn URL normalization utilities. Never imports server-side deps. */

// ─── Post URL Normalization ──────────────────────────────────────────────

const ACTIVITY_URN_REGEX = /urn:li:activity:(\d+)/;
const POSTS_URL_REGEX = /linkedin\.com\/posts\/[^/]+-activity-(\d+)/;
const FEED_URL_REGEX = /linkedin\.com\/feed\/update\/urn:li:activity:(\d+)/;

/**
 * Normalize any LinkedIn post URL to canonical activity URN format.
 * Returns null if the URL doesn't match any known LinkedIn post pattern.
 */
export function normalizePostUrl(url: string): string | null {
  if (!url) return null;

  // Already a URN
  const urnMatch = url.match(/^urn:li:activity:(\d+)$/);
  if (urnMatch) return url;

  // Feed URL: /feed/update/urn:li:activity:123
  const feedMatch = url.match(FEED_URL_REGEX);
  if (feedMatch) return `urn:li:activity:${feedMatch[1]}`;

  // Posts URL: /posts/username-activity-123-slug
  const postsMatch = url.match(POSTS_URL_REGEX);
  if (postsMatch) return `urn:li:activity:${postsMatch[1]}`;

  // Generic: contains activity URN anywhere
  const genericMatch = url.match(ACTIVITY_URN_REGEX);
  if (genericMatch) return `urn:li:activity:${genericMatch[1]}`;

  return null;
}

// ─── Profile Username Extraction ─────────────────────────────────────────

const PROFILE_URL_REGEX = /linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?/;

/**
 * Extract LinkedIn username from a profile URL.
 * Returns null if the URL doesn't match the /in/username pattern.
 */
export function extractLinkedInUsername(url: string): string | null {
  if (!url) return null;
  const match = url.match(PROFILE_URL_REGEX);
  return match ? match[1] : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="linkedin-url" --no-coverage`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/utils/linkedin-url.ts src/__tests__/lib/linkedin-url.test.ts
git commit -m "feat: add LinkedIn post URL normalization and username extraction utilities"
```

---

### Task 2: Unipile Client — Connection Management

**Files:**
- Modify: `src/lib/integrations/unipile.ts`

- [ ] **Step 1: Add connection management types and methods to Unipile client**

Add these types near the top of `src/lib/integrations/unipile.ts`, after existing type definitions:

```typescript
// ─── Connection Management Types ─────────────────────────────────────────

interface UnipileInvitation {
  id: string;
  provider_id?: string;
  sender?: {
    id?: string;
    provider_id?: string;
    name?: string;
    headline?: string;
  };
  message?: string;
  created_at?: string;
}

interface UnipileInvitationListResponse {
  items: UnipileInvitation[];
  cursor?: string;
}

interface UnipileUserProfile {
  id: string;
  provider_id: string;
  public_identifier?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
}

interface UnipileChatResponse {
  chat_id: string;
  account_id: string;
}
```

Add these methods to the `UnipileClient` class:

```typescript
  // ─── Connection Management ───────────────────────────────────────────

  async listReceivedInvitations(accountId: string): Promise<ApiResponse<UnipileInvitation[]>> {
    const result = await this.get<UnipileInvitationListResponse>(
      `/users/invite/received?account_id=${encodeURIComponent(accountId)}`
    );
    if (result.error || !result.data) {
      return { data: null, error: result.error, status: result.status };
    }
    return { data: result.data.items ?? [], error: null, status: result.status };
  }

  async handleInvitation(
    invitationId: string,
    action: 'accept' | 'decline'
  ): Promise<ApiResponse<void>> {
    return this.post<void>(`/users/invite/received/${encodeURIComponent(invitationId)}`, { action });
  }

  // ─── Profile Resolution ──────────────────────────────────────────────

  async resolveLinkedInProfile(
    accountId: string,
    linkedinUsername: string
  ): Promise<ApiResponse<UnipileUserProfile>> {
    return this.get<UnipileUserProfile>(
      `/users/${encodeURIComponent(linkedinUsername)}?account_id=${encodeURIComponent(accountId)}`
    );
  }

  // ─── Messaging ───────────────────────────────────────────────────────

  async sendDirectMessage(
    accountId: string,
    recipientProviderId: string,
    text: string
  ): Promise<ApiResponse<UnipileChatResponse>> {
    return this.post<UnipileChatResponse>('/chats', {
      account_id: accountId,
      attendees_ids: [recipientProviderId],
      text,
    });
  }

  async sendConnectionRequest(
    accountId: string,
    recipientProviderId: string,
    message?: string
  ): Promise<ApiResponse<void>> {
    const body: Record<string, unknown> = {
      account_id: accountId,
      provider_id: recipientProviderId,
    };
    if (message) body.message = message;
    return this.post<void>('/users/invite', body);
  }
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/integrations/unipile.ts
git commit -m "feat: add Unipile connection acceptance, profile resolution, and DM methods"
```

---

## Chunk 2: Database Migration + Types

### Task 3: Types

**Files:**
- Create: `src/lib/types/post-campaigns.ts`

- [ ] **Step 1: Create post campaign types**

Create `src/lib/types/post-campaigns.ts`:

```typescript
/** Post Campaign Automation types. Matches DB schema from migration 20260316200000. */

// ─── Status Types ────────────────────────────────────────────────────────

export type PostCampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export type PostCampaignLeadStatus =
  | 'detected'
  | 'connection_pending'
  | 'connection_accepted'
  | 'dm_queued'
  | 'dm_sent'
  | 'dm_failed'
  | 'skipped';

// ─── Database Row Types ──────────────────────────────────────────────────

export interface PostCampaign {
  id: string;
  user_id: string;
  team_id: string | null;
  name: string;
  post_url: string;
  keywords: string[];
  unipile_account_id: string;
  sender_name: string | null;
  dm_template: string;
  connect_message_template: string | null;
  funnel_page_id: string | null;
  auto_accept_connections: boolean;
  auto_like_comments: boolean;
  auto_connect_non_requesters: boolean;
  status: PostCampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface PostCampaignLead {
  id: string;
  user_id: string;
  campaign_id: string;
  signal_lead_id: string | null;
  linkedin_url: string;
  linkedin_username: string | null;
  unipile_provider_id: string | null;
  name: string | null;
  comment_text: string | null;
  status: PostCampaignLeadStatus;
  detected_at: string;
  connection_accepted_at: string | null;
  dm_sent_at: string | null;
  error: string | null;
}

export interface LinkedInDailyLimit {
  id: string;
  user_id: string;
  unipile_account_id: string;
  date: string;
  dms_sent: number;
  connections_accepted: number;
  connection_requests_sent: number;
}

// ─── Input Types ─────────────────────────────────────────────────────────

export interface CreatePostCampaignInput {
  name: string;
  post_url: string;
  keywords: string[];
  unipile_account_id: string;
  sender_name?: string;
  dm_template: string;
  connect_message_template?: string;
  funnel_page_id?: string;
  auto_accept_connections?: boolean;
  auto_like_comments?: boolean;
  auto_connect_non_requesters?: boolean;
}

export interface UpdatePostCampaignInput {
  name?: string;
  keywords?: string[];
  dm_template?: string;
  connect_message_template?: string;
  funnel_page_id?: string | null;
  auto_accept_connections?: boolean;
  auto_like_comments?: boolean;
  auto_connect_non_requesters?: boolean;
}

// ─── DM Template Rendering ───────────────────────────────────────────────

export interface DmTemplateVars {
  name: string;
  funnel_url: string;
}

// ─── Column Constants ────────────────────────────────────────────────────

export const POST_CAMPAIGN_COLUMNS = 'id, user_id, team_id, name, post_url, keywords, unipile_account_id, sender_name, dm_template, connect_message_template, funnel_page_id, auto_accept_connections, auto_like_comments, auto_connect_non_requesters, status, created_at, updated_at' as const;

export const POST_CAMPAIGN_LEAD_COLUMNS = 'id, user_id, campaign_id, signal_lead_id, linkedin_url, linkedin_username, unipile_provider_id, name, comment_text, status, detected_at, connection_accepted_at, dm_sent_at, error' as const;

// ─── Safety Constants ────────────────────────────────────────────────────

export const LINKEDIN_SAFETY = {
  MAX_DMS_PER_DAY: 80,
  MAX_ACCEPTS_PER_DAY: 100,
  MAX_CONNECT_REQUESTS_PER_DAY: 20,
  MIN_DELAY_BETWEEN_DMS_MS: 60_000,
  MAX_DELAY_BETWEEN_DMS_MS: 180_000,
  MIN_DELAY_BETWEEN_ACCEPTS_MS: 45_000,
  MAX_DELAY_BETWEEN_ACCEPTS_MS: 120_000,
  MAX_ACTIONS_PER_RUN: 3,
  POLL_JITTER_MINUTES: 5,
} as const;
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/types/post-campaigns.ts
git commit -m "feat: add post campaign automation types and constants"
```

---

### Task 4: Database Migration

**Files:**
- Create: `supabase/migrations/20260316200000_post_campaigns.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260316200000_post_campaigns.sql`:

```sql
-- Post Campaign Automation
-- Automates LinkedIn comment → connection acceptance → DM → funnel pipeline.
-- See docs/superpowers/specs/2026-03-16-post-campaign-automation-design.md

-- ─── post_campaigns ──────────────────────────────────────────────────────

CREATE TABLE post_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  name text NOT NULL,

  post_url text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',

  unipile_account_id text NOT NULL,
  sender_name text,

  dm_template text NOT NULL,
  connect_message_template text,
  funnel_page_id uuid REFERENCES funnel_pages(id) ON DELETE RESTRICT,

  auto_accept_connections boolean NOT NULL DEFAULT true,
  auto_like_comments boolean NOT NULL DEFAULT false,
  auto_connect_non_requesters boolean NOT NULL DEFAULT false,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (array_length(keywords, 1) > 0)
);

CREATE INDEX idx_post_campaigns_user_status ON post_campaigns(user_id, status);

ALTER TABLE post_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaigns"
  ON post_campaigns FOR ALL USING (user_id = auth.uid());

-- ─── post_campaign_leads ─────────────────────────────────────────────────

CREATE TABLE post_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES post_campaigns(id) ON DELETE CASCADE,
  signal_lead_id uuid REFERENCES signal_leads(id) ON DELETE SET NULL,

  linkedin_url text NOT NULL,
  linkedin_username text,
  unipile_provider_id text,
  name text,
  comment_text text,

  status text NOT NULL DEFAULT 'detected'
    CHECK (status IN ('detected', 'connection_pending', 'connection_accepted',
                      'dm_queued', 'dm_sent', 'dm_failed', 'skipped')),

  detected_at timestamptz NOT NULL DEFAULT now(),
  connection_accepted_at timestamptz,
  dm_sent_at timestamptz,
  error text,

  UNIQUE(campaign_id, linkedin_url)
);

CREATE INDEX idx_pcl_campaign_status ON post_campaign_leads(campaign_id, status);
CREATE INDEX idx_pcl_user ON post_campaign_leads(user_id);
CREATE INDEX idx_pcl_linkedin_url ON post_campaign_leads(linkedin_url);

ALTER TABLE post_campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaign leads"
  ON post_campaign_leads FOR ALL USING (user_id = auth.uid());

-- ─── linkedin_daily_limits ───────────────────────────────────────────────

CREATE TABLE linkedin_daily_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unipile_account_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  dms_sent integer NOT NULL DEFAULT 0,
  connections_accepted integer NOT NULL DEFAULT 0,
  connection_requests_sent integer NOT NULL DEFAULT 0,
  UNIQUE(unipile_account_id, date)
);

CREATE INDEX idx_ldl_account_date ON linkedin_daily_limits(unipile_account_id, date);

ALTER TABLE linkedin_daily_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own limits"
  ON linkedin_daily_limits FOR ALL USING (user_id = auth.uid());
```

- [ ] **Step 2: Push migration to Supabase**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm db:push`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add supabase/migrations/20260316200000_post_campaigns.sql
git commit -m "feat: add post_campaigns, post_campaign_leads, linkedin_daily_limits tables"
```

---

## Chunk 3: Repository + Service Layer

### Task 5: Repository

**Files:**
- Create: `src/server/repositories/post-campaigns.repo.ts`

- [ ] **Step 1: Create repository with CRUD + query methods**

Create `src/server/repositories/post-campaigns.repo.ts`:

```typescript
/** Post Campaign data access. Pure DB operations, no business logic. */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  POST_CAMPAIGN_COLUMNS,
  POST_CAMPAIGN_LEAD_COLUMNS,
} from '@/lib/types/post-campaigns';

// ─── Campaigns ───────────────────────────────────────────────────────────

export async function listCampaigns(userId: string, status?: string) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('post_campaigns')
    .select(POST_CAMPAIGN_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  return query;
}

export async function getCampaign(userId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  return supabase
    .from('post_campaigns')
    .select(POST_CAMPAIGN_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
}

export async function createCampaign(userId: string, teamId: string | null, data: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  return supabase
    .from('post_campaigns')
    .insert({ user_id: userId, team_id: teamId, ...data })
    .select(POST_CAMPAIGN_COLUMNS)
    .single();
}

export async function updateCampaign(userId: string, id: string, data: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  return supabase
    .from('post_campaigns')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select(POST_CAMPAIGN_COLUMNS)
    .single();
}

export async function deleteCampaign(userId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  return supabase
    .from('post_campaigns')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
}

export async function listActiveCampaigns() {
  const supabase = createSupabaseAdminClient();
  return supabase
    .from('post_campaigns')
    .select(POST_CAMPAIGN_COLUMNS)
    .eq('status', 'active');
}

// ─── Campaign Leads ──────────────────────────────────────────────────────

export async function listCampaignLeads(
  userId: string,
  campaignId: string,
  status?: string,
  limit = 50,
  offset = 0
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('post_campaign_leads')
    .select(POST_CAMPAIGN_LEAD_COLUMNS)
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .order('detected_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  return query;
}

export async function insertCampaignLead(data: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  return supabase
    .from('post_campaign_leads')
    .insert(data)
    .select(POST_CAMPAIGN_LEAD_COLUMNS)
    .single();
}

export async function updateCampaignLead(id: string, data: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  return supabase
    .from('post_campaign_leads')
    .update(data)
    .eq('id', id)
    .select(POST_CAMPAIGN_LEAD_COLUMNS)
    .single();
}

export async function findCampaignLeadByUrl(campaignId: string, linkedinUrl: string) {
  const supabase = createSupabaseAdminClient();
  return supabase
    .from('post_campaign_leads')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('linkedin_url', linkedinUrl)
    .maybeSingle();
}

export async function findLeadsByStatus(campaignId: string, status: string, limit = 3) {
  const supabase = createSupabaseAdminClient();
  return supabase
    .from('post_campaign_leads')
    .select(POST_CAMPAIGN_LEAD_COLUMNS)
    .eq('campaign_id', campaignId)
    .eq('status', status)
    .order('detected_at', { ascending: true })
    .limit(limit);
}

export async function isLinkedInUrlInAnyCampaign(linkedinUrl: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('post_campaign_leads')
    .select('id')
    .eq('linkedin_url', linkedinUrl)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function getCampaignStats(campaignId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('post_campaign_leads')
    .select('status')
    .eq('campaign_id', campaignId);

  if (!data) return { detected: 0, accepted: 0, dm_sent: 0, dm_failed: 0 };

  return {
    detected: data.length,
    accepted: data.filter(r => r.status === 'connection_accepted').length,
    dm_sent: data.filter(r => r.status === 'dm_sent').length,
    dm_failed: data.filter(r => r.status === 'dm_failed').length,
  };
}

// ─── Daily Limits ────────────────────────────────────────────────────────

export async function getDailyLimit(userId: string, accountId: string) {
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('linkedin_daily_limits')
    .select('id, dms_sent, connections_accepted, connection_requests_sent')
    .eq('unipile_account_id', accountId)
    .eq('date', today)
    .maybeSingle();

  if (!data) {
    // Create today's record
    const { data: created } = await supabase
      .from('linkedin_daily_limits')
      .insert({ user_id: userId, unipile_account_id: accountId, date: today })
      .select('id, dms_sent, connections_accepted, connection_requests_sent')
      .single();
    return created;
  }
  return data;
}

export async function incrementDailyLimit(
  accountId: string,
  field: 'dms_sent' | 'connections_accepted' | 'connection_requests_sent'
) {
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0];
  return supabase.rpc('increment_daily_limit', {
    p_account_id: accountId,
    p_date: today,
    p_field: field,
  });
}
```

- [ ] **Step 2: Add the RPC function for atomic increment**

Add to the migration file (or create a new one if already pushed):

```sql
-- Atomic increment for daily limits
CREATE OR REPLACE FUNCTION increment_daily_limit(
  p_account_id text,
  p_date date,
  p_field text
) RETURNS void AS $$
BEGIN
  EXECUTE format(
    'UPDATE linkedin_daily_limits SET %I = %I + 1 WHERE unipile_account_id = $1 AND date = $2',
    p_field, p_field
  ) USING p_account_id, p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 3: Verify typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/server/repositories/post-campaigns.repo.ts
git commit -m "feat: add post campaigns repository with CRUD + daily limits"
```

---

### Task 6: Service Layer

**Files:**
- Create: `src/server/services/post-campaigns.service.ts`
- Test: `src/__tests__/lib/post-campaigns-service.test.ts`

- [ ] **Step 1: Write failing test for DM template rendering**

Create `src/__tests__/lib/post-campaigns-service.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { renderDmTemplate, validateCampaignInput } from '@/server/services/post-campaigns.service';

describe('renderDmTemplate', () => {
  it('replaces {{name}} and {{funnel_url}}', () => {
    const result = renderDmTemplate(
      'Hey {{name}}! Here is your access: {{funnel_url}}',
      { name: 'Tim', funnel_url: 'https://magnetlab.app/p/test/gtm-now' }
    );
    expect(result).toBe('Hey Tim! Here is your access: https://magnetlab.app/p/test/gtm-now');
  });

  it('handles missing name gracefully', () => {
    const result = renderDmTemplate(
      'Hey {{name}}! Link: {{funnel_url}}',
      { name: '', funnel_url: 'https://example.com' }
    );
    expect(result).toBe('Hey ! Link: https://example.com');
  });
});

describe('validateCampaignInput', () => {
  const validInput = {
    name: 'Test Campaign',
    post_url: 'https://www.linkedin.com/feed/update/urn:li:activity:7123456789',
    keywords: ['GTM'],
    unipile_account_id: 'acc-123',
    dm_template: 'Hey {{name}}! {{funnel_url}}',
  };

  it('accepts valid input', () => {
    const result = validateCampaignInput(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects empty keywords', () => {
    const result = validateCampaignInput({ ...validInput, keywords: [] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid post URL', () => {
    const result = validateCampaignInput({ ...validInput, post_url: 'https://example.com/post' });
    expect(result.success).toBe(false);
  });

  it('normalizes post URL', () => {
    const result = validateCampaignInput(validInput);
    if (result.success) {
      expect(result.data.post_url).toBe('urn:li:activity:7123456789');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="post-campaigns-service" --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Create service with validation + DM rendering + CRUD**

Create `src/server/services/post-campaigns.service.ts`:

```typescript
/** Post Campaign service. Business logic for campaign CRUD, validation, and DM rendering. */

import { logError } from '@/lib/utils/logger';
import { normalizePostUrl } from '@/lib/utils/linkedin-url';
import * as repo from '@/server/repositories/post-campaigns.repo';
import type {
  CreatePostCampaignInput,
  UpdatePostCampaignInput,
  DmTemplateVars,
  PostCampaign,
  LINKEDIN_SAFETY as SafetyType,
} from '@/lib/types/post-campaigns';
import { LINKEDIN_SAFETY } from '@/lib/types/post-campaigns';

// ─── Validation ──────────────────────────────────────────────────────────

type ValidationResult =
  | { success: true; data: CreatePostCampaignInput & { post_url: string } }
  | { success: false; error: string };

export function validateCampaignInput(input: Partial<CreatePostCampaignInput>): ValidationResult {
  if (!input.name?.trim()) return { success: false, error: 'name is required' };
  if (!input.post_url?.trim()) return { success: false, error: 'post_url is required' };
  if (!input.keywords?.length) return { success: false, error: 'at least one keyword is required' };
  if (!input.unipile_account_id?.trim()) return { success: false, error: 'unipile_account_id is required' };
  if (!input.dm_template?.trim()) return { success: false, error: 'dm_template is required' };

  const normalizedUrl = normalizePostUrl(input.post_url);
  if (!normalizedUrl) return { success: false, error: 'post_url must be a valid LinkedIn post URL' };

  return {
    success: true,
    data: {
      ...input as CreatePostCampaignInput,
      post_url: normalizedUrl,
    },
  };
}

// ─── DM Template Rendering ───────────────────────────────────────────────

export function renderDmTemplate(template: string, vars: DmTemplateVars): string {
  return template
    .replace(/\{\{name\}\}/g, vars.name)
    .replace(/\{\{funnel_url\}\}/g, vars.funnel_url);
}

// ─── CRUD ────────────────────────────────────────────────────────────────

export async function listCampaigns(userId: string, status?: string) {
  const { data, error } = await repo.listCampaigns(userId, status);
  if (error) {
    logError('post-campaigns/list', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const, campaigns: data ?? [] };
}

export async function getCampaign(userId: string, id: string) {
  const { data, error } = await repo.getCampaign(userId, id);
  if (error) {
    if (error.code === 'PGRST116') return { success: false as const, error: 'not_found' as const };
    logError('post-campaigns/get', error);
    return { success: false as const, error: 'database' as const };
  }
  const stats = await repo.getCampaignStats(id);
  return { success: true as const, campaign: data, stats };
}

export async function createCampaign(userId: string, teamId: string | null, input: Partial<CreatePostCampaignInput>) {
  const validation = validateCampaignInput(input);
  if (!validation.success) {
    return { success: false as const, error: 'validation' as const, message: validation.error };
  }

  const { data, error } = await repo.createCampaign(userId, teamId, {
    name: validation.data.name,
    post_url: validation.data.post_url,
    keywords: validation.data.keywords,
    unipile_account_id: validation.data.unipile_account_id,
    sender_name: validation.data.sender_name ?? null,
    dm_template: validation.data.dm_template,
    connect_message_template: validation.data.connect_message_template ?? null,
    funnel_page_id: validation.data.funnel_page_id ?? null,
    auto_accept_connections: validation.data.auto_accept_connections ?? true,
    auto_like_comments: validation.data.auto_like_comments ?? false,
    auto_connect_non_requesters: validation.data.auto_connect_non_requesters ?? false,
  });

  if (error) {
    logError('post-campaigns/create', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const, campaign: data };
}

export async function updateCampaign(userId: string, id: string, input: UpdatePostCampaignInput) {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.keywords !== undefined) {
    if (!input.keywords.length) {
      return { success: false as const, error: 'validation' as const, message: 'at least one keyword is required' };
    }
    updates.keywords = input.keywords;
  }
  if (input.dm_template !== undefined) updates.dm_template = input.dm_template;
  if (input.connect_message_template !== undefined) updates.connect_message_template = input.connect_message_template;
  if (input.funnel_page_id !== undefined) updates.funnel_page_id = input.funnel_page_id;
  if (input.auto_accept_connections !== undefined) updates.auto_accept_connections = input.auto_accept_connections;
  if (input.auto_like_comments !== undefined) updates.auto_like_comments = input.auto_like_comments;
  if (input.auto_connect_non_requesters !== undefined) updates.auto_connect_non_requesters = input.auto_connect_non_requesters;

  const { data, error } = await repo.updateCampaign(userId, id, updates);
  if (error) {
    if (error.code === 'PGRST116') return { success: false as const, error: 'not_found' as const };
    logError('post-campaigns/update', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const, campaign: data };
}

export async function deleteCampaign(userId: string, id: string) {
  // Verify exists first
  const { error: getError } = await repo.getCampaign(userId, id);
  if (getError) {
    if (getError.code === 'PGRST116') return { success: false as const, error: 'not_found' as const };
    return { success: false as const, error: 'database' as const };
  }

  const { error } = await repo.deleteCampaign(userId, id);
  if (error) {
    logError('post-campaigns/delete', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const };
}

export async function activateCampaign(userId: string, id: string) {
  return updateCampaignStatus(userId, id, 'active');
}

export async function pauseCampaign(userId: string, id: string) {
  return updateCampaignStatus(userId, id, 'paused');
}

async function updateCampaignStatus(userId: string, id: string, status: string) {
  const { data, error } = await repo.updateCampaign(userId, id, { status });
  if (error) {
    if (error.code === 'PGRST116') return { success: false as const, error: 'not_found' as const };
    logError('post-campaigns/status', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const, campaign: data };
}

// ─── Campaign Leads ──────────────────────────────────────────────────────

export async function listCampaignLeads(userId: string, campaignId: string, status?: string) {
  const { data, error } = await repo.listCampaignLeads(userId, campaignId, status);
  if (error) {
    logError('post-campaigns/leads', error);
    return { success: false as const, error: 'database' as const };
  }
  return { success: true as const, leads: data ?? [] };
}

// ─── Daily Limits ────────────────────────────────────────────────────────

export async function checkDailyLimit(
  userId: string,
  accountId: string,
  action: 'dms_sent' | 'connections_accepted' | 'connection_requests_sent'
): Promise<boolean> {
  const limits = await repo.getDailyLimit(userId, accountId);
  if (!limits) return false;

  const maxMap = {
    dms_sent: LINKEDIN_SAFETY.MAX_DMS_PER_DAY,
    connections_accepted: LINKEDIN_SAFETY.MAX_ACCEPTS_PER_DAY,
    connection_requests_sent: LINKEDIN_SAFETY.MAX_CONNECT_REQUESTS_PER_DAY,
  };

  return (limits[action] ?? 0) < maxMap[action];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

export function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="post-campaigns-service" --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/server/services/post-campaigns.service.ts src/__tests__/lib/post-campaigns-service.test.ts
git commit -m "feat: add post campaigns service with CRUD, validation, and DM rendering"
```

---

## Chunk 4: API Routes

### Task 7: API Routes — CRUD

**Files:**
- Create: `src/app/api/post-campaigns/route.ts`
- Create: `src/app/api/post-campaigns/[id]/route.ts`
- Create: `src/app/api/post-campaigns/[id]/activate/route.ts`
- Create: `src/app/api/post-campaigns/[id]/pause/route.ts`
- Create: `src/app/api/post-campaigns/[id]/leads/route.ts`
- Create: `src/app/api/post-campaigns/[id]/test-dm/route.ts`
- Test: `src/__tests__/api/post-campaigns/create.test.ts`

- [ ] **Step 1: Write failing test for POST /api/post-campaigns**

Create `src/__tests__/api/post-campaigns/create.test.ts`:

```typescript
/**
 * @jest-environment node
 */

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/server/services/post-campaigns.service', () => ({
  createCampaign: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createCampaign } from '@/server/services/post-campaigns.service';
import { POST } from '@/app/api/post-campaigns/route';

describe('POST /api/post-campaigns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-123' } });
  });

  it('returns 401 when not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/post-campaigns', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 201 on successful creation', async () => {
    (createCampaign as jest.Mock).mockResolvedValue({
      success: true,
      campaign: { id: 'camp-1', name: 'Test' },
    });

    const req = new NextRequest('http://localhost/api/post-campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test',
        post_url: 'https://linkedin.com/feed/update/urn:li:activity:123',
        keywords: ['GTM'],
        unipile_account_id: 'acc-1',
        dm_template: 'Hey {{name}}!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.campaign.id).toBe('camp-1');
  });

  it('returns 400 on validation error', async () => {
    (createCampaign as jest.Mock).mockResolvedValue({
      success: false,
      error: 'validation',
      message: 'name is required',
    });

    const req = new NextRequest('http://localhost/api/post-campaigns', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Create the list + create route**

Create `src/app/api/post-campaigns/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/post-campaigns.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = request.nextUrl.searchParams.get('status') ?? undefined;
    const result = await service.listCampaigns(session.user.id, status);

    if (!result.success) return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    return NextResponse.json({ campaigns: result.campaigns });
  } catch (error) {
    logError('api/post-campaigns/list', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const result = await service.createCampaign(session.user.id, null, body);

    if (!result.success) {
      if (result.error === 'validation') return NextResponse.json({ error: result.message }, { status: 400 });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ campaign: result.campaign }, { status: 201 });
  } catch (error) {
    logError('api/post-campaigns/create', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create [id] route (GET, PATCH, DELETE)**

Create `src/app/api/post-campaigns/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/post-campaigns.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const result = await service.getCampaign(session.user.id, id);

    if (!result.success) {
      if (result.error === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ campaign: result.campaign, stats: result.stats });
  } catch (error) {
    logError('api/post-campaigns/get', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const result = await service.updateCampaign(session.user.id, id, body);

    if (!result.success) {
      if (result.error === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (result.error === 'validation') return NextResponse.json({ error: result.message }, { status: 400 });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ campaign: result.campaign });
  } catch (error) {
    logError('api/post-campaigns/update', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const result = await service.deleteCampaign(session.user.id, id);

    if (!result.success) {
      if (result.error === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('api/post-campaigns/delete', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create activate, pause, leads, test-dm routes**

Create `src/app/api/post-campaigns/[id]/activate/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/post-campaigns.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const result = await service.activateCampaign(session.user.id, id);

    if (!result.success) {
      if (result.error === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ campaign: result.campaign });
  } catch (error) {
    logError('api/post-campaigns/activate', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

Create `src/app/api/post-campaigns/[id]/pause/route.ts` (same pattern, call `pauseCampaign`).

Create `src/app/api/post-campaigns/[id]/leads/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/post-campaigns.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const status = request.nextUrl.searchParams.get('status') ?? undefined;
    const result = await service.listCampaignLeads(session.user.id, id, status);

    if (!result.success) return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    return NextResponse.json({ leads: result.leads });
  } catch (error) {
    logError('api/post-campaigns/leads', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

Create `src/app/api/post-campaigns/[id]/test-dm/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { renderDmTemplate } from '@/server/services/post-campaigns.service';
import * as repo from '@/server/repositories/post-campaigns.repo';
import { getUnipileClient } from '@/lib/integrations/unipile';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { data: campaign } = await repo.getCampaign(session.user.id, id);
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const rendered = renderDmTemplate(campaign.dm_template, {
      name: 'Test User',
      funnel_url: campaign.funnel_page_id
        ? `https://magnetlab.app/p/test/${campaign.funnel_page_id}`
        : 'https://magnetlab.app',
    });

    return NextResponse.json({ rendered_dm: rendered, note: 'This is a preview only. No DM was sent.' });
  } catch (error) {
    logError('api/post-campaigns/test-dm', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck && pnpm test -- --testPathPattern="post-campaigns" --no-coverage`
Expected: Typecheck clean, all tests pass

- [ ] **Step 6: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/app/api/post-campaigns/ src/__tests__/api/post-campaigns/
git commit -m "feat: add post campaigns API routes (CRUD, activate, pause, leads, test-dm)"
```

---

## Chunk 5: Trigger.dev Tasks

### Task 8: Process Post Campaigns Task

**Files:**
- Create: `src/trigger/process-post-campaigns.ts`

- [ ] **Step 1: Create the detection + DM sending task**

Create `src/trigger/process-post-campaigns.ts`:

```typescript
import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { normalizePostUrl, extractLinkedInUsername } from '@/lib/utils/linkedin-url';
import { renderDmTemplate, randomDelay, sleep, checkDailyLimit } from '@/server/services/post-campaigns.service';
import * as repo from '@/server/repositories/post-campaigns.repo';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { LINKEDIN_SAFETY } from '@/lib/types/post-campaigns';
import type { PostCampaign } from '@/lib/types/post-campaigns';

export const processPostCampaigns = schedules.task({
  id: 'process-post-campaigns',
  cron: '*/5 * * * *',
  maxDuration: 300,
  run: async () => {
    const { data: campaigns } = await repo.listActiveCampaigns();
    if (!campaigns?.length) return { processed: 0 };

    let totalDetected = 0;
    let totalDmsSent = 0;

    for (const campaign of campaigns as PostCampaign[]) {
      try {
        // Phase 1: Detect new matching commenters
        const detected = await detectNewLeads(campaign);
        totalDetected += detected;

        // Phase 2: Send DMs to accepted connections (sequential, randomized)
        const sent = await sendPendingDms(campaign);
        totalDmsSent += sent;
      } catch (err) {
        logger.error(`Campaign ${campaign.id} failed`, { error: String(err) });
      }
    }

    return { campaigns: campaigns.length, detected: totalDetected, dms_sent: totalDmsSent };
  },
});

async function detectNewLeads(campaign: PostCampaign): Promise<number> {
  const supabase = createSupabaseAdminClient();

  // Join signal_leads + signal_events to find matching commenters
  const { data: events } = await supabase
    .from('signal_events')
    .select('lead_id, comment_text, source_url, signal_leads!inner(id, linkedin_url, first_name, last_name)')
    .eq('signal_leads.user_id', campaign.user_id)
    .eq('source_url', campaign.post_url)
    .eq('engagement_type', 'comment');

  if (!events?.length) return 0;

  let detected = 0;
  for (const event of events) {
    const lead = (event as Record<string, unknown>).signal_leads as { id: string; linkedin_url: string; first_name: string | null; last_name: string | null } | null;
    if (!lead?.linkedin_url) continue;

    // Check keyword match (case-insensitive)
    const comment = (event.comment_text ?? '').toLowerCase();
    const keywordMatch = campaign.keywords.some(kw => comment.includes(kw.toLowerCase()));
    if (!keywordMatch) continue;

    // Check not already tracked
    const { data: existing } = await repo.findCampaignLeadByUrl(campaign.id, lead.linkedin_url);
    if (existing) continue;

    const username = extractLinkedInUsername(lead.linkedin_url);
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ');

    const { error } = await repo.insertCampaignLead({
      user_id: campaign.user_id,
      campaign_id: campaign.id,
      signal_lead_id: lead.id,
      linkedin_url: lead.linkedin_url,
      linkedin_username: username,
      name: name || null,
      comment_text: event.comment_text,
      status: 'detected',
    });

    if (!error) detected++;
  }

  return detected;
}

async function sendPendingDms(campaign: PostCampaign): Promise<number> {
  const { data: leads } = await repo.findLeadsByStatus(
    campaign.id,
    'connection_accepted',
    LINKEDIN_SAFETY.MAX_ACTIONS_PER_RUN
  );
  if (!leads?.length) return 0;

  const canSend = await checkDailyLimit(campaign.user_id, campaign.unipile_account_id, 'dms_sent');
  if (!canSend) {
    logger.warn('Daily DM limit reached', { accountId: campaign.unipile_account_id });
    return 0;
  }

  const client = getUnipileClient();
  let sent = 0;

  // Build funnel URL
  let funnelUrl = 'https://magnetlab.app';
  if (campaign.funnel_page_id) {
    const supabase = createSupabaseAdminClient();
    const { data: funnel } = await supabase
      .from('funnel_pages')
      .select('slug')
      .eq('id', campaign.funnel_page_id)
      .single();
    if (funnel?.slug) {
      const { data: user } = await supabase
        .from('users')
        .select('username')
        .eq('id', campaign.user_id)
        .single();
      if (user?.username) {
        funnelUrl = `https://magnetlab.app/p/${user.username}/${funnel.slug}`;
      }
    }
  }

  for (const lead of leads) {
    try {
      // Resolve provider ID if not cached
      let providerId = lead.unipile_provider_id;
      if (!providerId && lead.linkedin_username) {
        const profile = await client.resolveLinkedInProfile(
          campaign.unipile_account_id,
          lead.linkedin_username
        );
        if (profile.data?.provider_id) {
          providerId = profile.data.provider_id;
          await repo.updateCampaignLead(lead.id, { unipile_provider_id: providerId });
        }
      }

      if (!providerId) {
        await repo.updateCampaignLead(lead.id, {
          status: 'dm_failed',
          error: 'Could not resolve Unipile provider ID',
        });
        continue;
      }

      // Render and send DM
      const text = renderDmTemplate(campaign.dm_template, {
        name: lead.name || '',
        funnel_url: funnelUrl,
      });

      const result = await client.sendDirectMessage(
        campaign.unipile_account_id,
        providerId,
        text
      );

      if (result.error) {
        await repo.updateCampaignLead(lead.id, { status: 'dm_failed', error: result.error });
      } else {
        await repo.updateCampaignLead(lead.id, {
          status: 'dm_sent',
          dm_sent_at: new Date().toISOString(),
        });
        await repo.incrementDailyLimit(campaign.unipile_account_id, 'dms_sent');
        sent++;
      }

      // Random delay before next action
      const delay = randomDelay(
        LINKEDIN_SAFETY.MIN_DELAY_BETWEEN_DMS_MS,
        LINKEDIN_SAFETY.MAX_DELAY_BETWEEN_DMS_MS
      );
      await sleep(delay);
    } catch (err) {
      logger.error(`DM failed for lead ${lead.id}`, { error: String(err) });
      await repo.updateCampaignLead(lead.id, { status: 'dm_failed', error: String(err) });
    }
  }

  return sent;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/trigger/process-post-campaigns.ts
git commit -m "feat: add process-post-campaigns Trigger.dev task (detect leads + send DMs)"
```

---

### Task 9: Poll Connection Requests Task

**Files:**
- Create: `src/trigger/poll-connection-requests.ts`

- [ ] **Step 1: Create the connection acceptance task**

Create `src/trigger/poll-connection-requests.ts`:

```typescript
import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { normalizeLinkedInUrl } from '@/lib/services/signal-engine';
import { randomDelay, sleep, checkDailyLimit } from '@/server/services/post-campaigns.service';
import * as repo from '@/server/repositories/post-campaigns.repo';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { LINKEDIN_SAFETY } from '@/lib/types/post-campaigns';
import type { PostCampaign } from '@/lib/types/post-campaigns';

export const pollConnectionRequests = schedules.task({
  id: 'poll-connection-requests',
  cron: '*/20 * * * *',
  maxDuration: 180,
  run: async () => {
    // Random jitter: wait 0 to POLL_JITTER_MINUTES before starting
    const jitter = randomDelay(0, LINKEDIN_SAFETY.POLL_JITTER_MINUTES * 60_000);
    await sleep(jitter);

    const { data: campaigns } = await repo.listActiveCampaigns();
    if (!campaigns?.length) return { processed: 0 };

    // Group by unipile_account_id (one poll per account)
    const accountMap = new Map<string, PostCampaign[]>();
    for (const campaign of campaigns as PostCampaign[]) {
      const existing = accountMap.get(campaign.unipile_account_id) ?? [];
      existing.push(campaign);
      accountMap.set(campaign.unipile_account_id, existing);
    }

    let totalAccepted = 0;
    const client = getUnipileClient();

    for (const [accountId, accountCampaigns] of accountMap) {
      try {
        const userId = accountCampaigns[0].user_id;
        const canAccept = await checkDailyLimit(userId, accountId, 'connections_accepted');
        if (!canAccept) {
          logger.warn('Daily accept limit reached', { accountId });
          continue;
        }

        // List pending invitations
        const invitations = await client.listReceivedInvitations(accountId);
        if (invitations.error || !invitations.data?.length) continue;

        for (const invitation of invitations.data) {
          // Extract sender LinkedIn URL from invitation
          const senderUrl = invitation.sender?.provider_id
            ? `https://www.linkedin.com/in/${invitation.sender.provider_id}`
            : null;

          if (!senderUrl) continue;

          // Check if this person is in any active campaign's leads
          let matchedLead: { id: string; campaign_id: string } | null = null;
          const supabase = createSupabaseAdminClient();

          for (const campaign of accountCampaigns) {
            if (!campaign.auto_accept_connections) continue;

            const { data: lead } = await supabase
              .from('post_campaign_leads')
              .select('id, campaign_id')
              .eq('campaign_id', campaign.id)
              .eq('status', 'detected')
              .ilike('linkedin_url', `%${invitation.sender?.provider_id ?? ''}%`)
              .maybeSingle();

            if (lead) {
              matchedLead = lead;
              break;
            }
          }

          if (!matchedLead) continue;

          // Accept the invitation
          const acceptResult = await client.handleInvitation(invitation.id, 'accept');
          if (acceptResult.error) {
            logger.error('Failed to accept invitation', {
              invitationId: invitation.id,
              error: acceptResult.error,
            });
            continue;
          }

          // Update lead status
          await repo.updateCampaignLead(matchedLead.id, {
            status: 'connection_accepted',
            connection_accepted_at: new Date().toISOString(),
          });

          await repo.incrementDailyLimit(accountId, 'connections_accepted');
          totalAccepted++;

          // Random delay
          const delay = randomDelay(
            LINKEDIN_SAFETY.MIN_DELAY_BETWEEN_ACCEPTS_MS,
            LINKEDIN_SAFETY.MAX_DELAY_BETWEEN_ACCEPTS_MS
          );
          await sleep(delay);

          // Check limit again after each accept
          const stillCanAccept = await checkDailyLimit(userId, accountId, 'connections_accepted');
          if (!stillCanAccept) break;
        }
      } catch (err) {
        logger.error(`Account ${accountId} poll failed`, { error: String(err) });
      }
    }

    return { accounts: accountMap.size, accepted: totalAccepted };
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/trigger/poll-connection-requests.ts
git commit -m "feat: add poll-connection-requests Trigger.dev task (auto-accept matching invitations)"
```

---

### Task 10: Signal-HeyReach Dedup

**Files:**
- Modify: `src/trigger/signal-push-heyreach.ts`

- [ ] **Step 1: Add dedup check against post_campaign_leads**

At the top of the push loop in `signal-push-heyreach.ts`, before pushing to HeyReach, add:

```typescript
// Skip leads already tracked in a post campaign (avoid double-outreach)
const isInCampaign = await postCampaignsRepo.isLinkedInUrlInAnyCampaign(lead.linkedin_url);
if (isInCampaign) {
  logger.info('Skipping lead — already in post campaign', { linkedin_url: lead.linkedin_url });
  continue;
}
```

Add import at top:
```typescript
import * as postCampaignsRepo from '@/server/repositories/post-campaigns.repo';
```

- [ ] **Step 2: Verify typecheck + existing tests still pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck && pnpm test --no-coverage`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/trigger/signal-push-heyreach.ts
git commit -m "feat: skip HeyReach push for leads already tracked in post campaigns"
```

---

## Chunk 6: Final Verification

### Task 11: Full Build + Test

- [ ] **Step 1: Run full typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test --no-coverage`
Expected: All pass

- [ ] **Step 3: Run MCP tests (ensure nothing broken)**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm --filter @magnetlab/mcp test`
Expected: All 281 tests pass

- [ ] **Step 4: Deploy Trigger.dev tasks**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy`
Expected: Tasks deployed (process-post-campaigns, poll-connection-requests)

- [ ] **Step 5: Verify new tasks appear in Trigger.dev dashboard**

Check: https://cloud.trigger.dev — confirm `process-post-campaigns` and `poll-connection-requests` are registered.

---

## Out of Scope (future plans)

- **MCP Tools** — 6 new tools for magnetlab MCP package (separate plan)
- **UI** — Dashboard page for campaign management (separate plan)
- **Auto-connect task** — `auto-connect-commenters` for non-requesters (add when needed)
