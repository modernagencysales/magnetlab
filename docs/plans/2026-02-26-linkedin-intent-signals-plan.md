# LinkedIn Intent Signals Engine — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-signal LinkedIn lead discovery engine that monitors keywords, company pages, profiles, and job changes, enriches leads against ICP filters, scores intent via AI sentiment analysis and signal stacking, and pushes qualified leads to HeyReach — all powered by Harvest API replacing Apify.

**Architecture:** Harvest API client → Trigger.dev scheduled tasks (keyword/company/profile scan) → signal_events + signal_leads tables → enrichment pipeline → ICP filtering → AI sentiment scoring → compound scoring → HeyReach push. Settings UI for ICP config, keyword/company monitors. Dashboard page for signal leads with filtering and bulk actions.

**Tech Stack:** Next.js 15 (App Router), Supabase (shared project qvawbxpijxlwdkolmjrs), Trigger.dev 4.3.3, Harvest API (REST), Anthropic Claude for sentiment scoring, HeyReach API, TypeScript, Tailwind CSS, Lucide icons.

**Design doc:** `docs/plans/2026-02-26-linkedin-intent-signals-design.md`

---

## Task 1: Database Migration — Signal Tables

**Files:**
- Create: `supabase/migrations/20260227000000_signal_engine.sql`

**Step 1: Write the migration SQL**

```sql
-- Signal Engine: Intent-based lead discovery

-- 1. ICP configuration per tenant
CREATE TABLE IF NOT EXISTS signal_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_countries TEXT[] DEFAULT '{}',
  target_job_titles TEXT[] DEFAULT '{}',
  exclude_job_titles TEXT[] DEFAULT '{}',
  min_company_size INTEGER,
  max_company_size INTEGER,
  target_industries TEXT[] DEFAULT '{}',
  default_heyreach_campaign_id TEXT,
  enrichment_enabled BOOLEAN NOT NULL DEFAULT true,
  sentiment_scoring_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_push_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- 2. Keyword monitors
CREATE TABLE IF NOT EXISTS signal_keyword_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  posts_found INTEGER NOT NULL DEFAULT 0,
  leads_found INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, keyword)
);

-- 3. Company page monitors
CREATE TABLE IF NOT EXISTS signal_company_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_company_url TEXT NOT NULL,
  company_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  heyreach_campaign_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, linkedin_company_url)
);

-- 4. Profile monitors (replaces cp_monitored_competitors)
CREATE TABLE IF NOT EXISTS signal_profile_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_profile_url TEXT NOT NULL,
  name TEXT,
  headline TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  heyreach_campaign_id TEXT,
  monitor_type TEXT NOT NULL DEFAULT 'competitor' CHECK (monitor_type IN ('competitor', 'influencer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, linkedin_profile_url)
);

-- 5. Signal leads (deduplicated across all sources)
CREATE TABLE IF NOT EXISTS signal_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_url TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  headline TEXT,
  job_title TEXT,
  company TEXT,
  country TEXT,
  profile_data JSONB,
  email TEXT,
  icp_match BOOLEAN,
  icp_score INTEGER DEFAULT 0,
  signal_count INTEGER NOT NULL DEFAULT 0,
  compound_score INTEGER DEFAULT 0,
  sentiment_score TEXT,
  content_velocity_score REAL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'enriched', 'qualified', 'pushed', 'excluded')),
  heyreach_campaign_id TEXT,
  heyreach_pushed_at TIMESTAMPTZ,
  heyreach_error TEXT,
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, linkedin_url)
);

-- 6. Signal events (individual signal occurrences)
CREATE TABLE IF NOT EXISTS signal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES signal_leads(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'keyword_engagement', 'company_engagement', 'profile_engagement',
    'job_change', 'content_velocity', 'job_posting'
  )),
  source_url TEXT,
  source_monitor_id UUID,
  comment_text TEXT,
  sentiment TEXT CHECK (sentiment IN ('high_intent', 'medium_intent', 'low_intent', 'question', NULL)),
  keyword_matched TEXT,
  engagement_type TEXT CHECK (engagement_type IN ('comment', 'reaction', 'post_author', NULL)),
  metadata JSONB DEFAULT '{}',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for signal_events
CREATE INDEX idx_signal_events_user_lead ON signal_events(user_id, lead_id);
CREATE INDEX idx_signal_events_type ON signal_events(user_id, signal_type);
CREATE INDEX idx_signal_events_dedup ON signal_events(user_id, lead_id, signal_type, source_url);

-- Indexes for signal_leads
CREATE INDEX idx_signal_leads_status ON signal_leads(user_id, status);
CREATE INDEX idx_signal_leads_score ON signal_leads(user_id, compound_score DESC);
CREATE INDEX idx_signal_leads_icp ON signal_leads(user_id, icp_match) WHERE icp_match = true;

-- RLS policies
ALTER TABLE signal_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_keyword_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_company_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_profile_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_events ENABLE ROW LEVEL SECURITY;

-- Users can manage their own data
CREATE POLICY "Users manage own signal_configs" ON signal_configs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own keyword_monitors" ON signal_keyword_monitors
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own company_monitors" ON signal_company_monitors
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own profile_monitors" ON signal_profile_monitors
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own signal_leads" ON signal_leads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own signal_events" ON signal_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role bypass for Trigger.dev tasks
CREATE POLICY "Service role full access signal_configs" ON signal_configs
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access keyword_monitors" ON signal_keyword_monitors
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access company_monitors" ON signal_company_monitors
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access profile_monitors" ON signal_profile_monitors
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access signal_leads" ON signal_leads
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access signal_events" ON signal_events
  FOR ALL USING (auth.role() = 'service_role');

-- Migrate existing competitor data
INSERT INTO signal_profile_monitors (id, user_id, linkedin_profile_url, name, headline, is_active, last_scraped_at, heyreach_campaign_id, monitor_type, created_at, updated_at)
SELECT id, user_id, linkedin_profile_url, name, headline, is_active, last_scraped_at, heyreach_campaign_id, 'competitor', created_at, updated_at
FROM cp_monitored_competitors
ON CONFLICT DO NOTHING;
```

**Step 2: Apply migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx supabase db push --linked`

If remote push is not available, apply via Supabase Management API:
```bash
# Extract Supabase token
TOKEN=$(security find-generic-password -s "Supabase CLI" -w | sed 's/go-keyring-base64://' | base64 -D)
# Apply migration via SQL endpoint
curl -X POST "https://api.supabase.com/v1/projects/qvawbxpijxlwdkolmjrs/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "<migration SQL>"}'
```

**Step 3: Verify tables exist**

Run SQL: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'signal_%' ORDER BY table_name;`

Expected: signal_company_monitors, signal_configs, signal_events, signal_keyword_monitors, signal_leads, signal_profile_monitors

**Step 4: Commit**

```bash
git add supabase/migrations/20260227000000_signal_engine.sql
git commit -m "feat: add signal engine database tables and migrate competitor data"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/lib/types/signals.ts`

**Step 1: Write type definitions**

```typescript
// Signal Engine types

export interface SignalConfig {
  id: string;
  user_id: string;
  target_countries: string[];
  target_job_titles: string[];
  exclude_job_titles: string[];
  min_company_size: number | null;
  max_company_size: number | null;
  target_industries: string[];
  default_heyreach_campaign_id: string | null;
  enrichment_enabled: boolean;
  sentiment_scoring_enabled: boolean;
  auto_push_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SignalKeywordMonitor {
  id: string;
  user_id: string;
  keyword: string;
  is_active: boolean;
  last_scanned_at: string | null;
  posts_found: number;
  leads_found: number;
  created_at: string;
}

export interface SignalCompanyMonitor {
  id: string;
  user_id: string;
  linkedin_company_url: string;
  company_name: string | null;
  is_active: boolean;
  last_scanned_at: string | null;
  heyreach_campaign_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignalProfileMonitor {
  id: string;
  user_id: string;
  linkedin_profile_url: string;
  name: string | null;
  headline: string | null;
  is_active: boolean;
  last_scraped_at: string | null;
  heyreach_campaign_id: string | null;
  monitor_type: 'competitor' | 'influencer';
  created_at: string;
  updated_at: string;
}

export type SignalLeadStatus = 'new' | 'enriched' | 'qualified' | 'pushed' | 'excluded';
export type SentimentScore = 'high_intent' | 'medium_intent' | 'low_intent' | 'question';
export type SignalType =
  | 'keyword_engagement'
  | 'company_engagement'
  | 'profile_engagement'
  | 'job_change'
  | 'content_velocity'
  | 'job_posting';

export interface SignalLead {
  id: string;
  user_id: string;
  linkedin_url: string;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  job_title: string | null;
  company: string | null;
  country: string | null;
  profile_data: Record<string, unknown> | null;
  email: string | null;
  icp_match: boolean | null;
  icp_score: number;
  signal_count: number;
  compound_score: number;
  sentiment_score: SentimentScore | null;
  content_velocity_score: number | null;
  status: SignalLeadStatus;
  heyreach_campaign_id: string | null;
  heyreach_pushed_at: string | null;
  heyreach_error: string | null;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignalEvent {
  id: string;
  user_id: string;
  lead_id: string | null;
  signal_type: SignalType;
  source_url: string | null;
  source_monitor_id: string | null;
  comment_text: string | null;
  sentiment: SentimentScore | null;
  keyword_matched: string | null;
  engagement_type: 'comment' | 'reaction' | 'post_author' | null;
  metadata: Record<string, unknown>;
  detected_at: string;
  created_at: string;
}

// Harvest API response types

export interface HarvestPostShort {
  id: string;
  content: string;
  linkedinUrl: string;
  publicIdentifier?: string;
  universalName?: string;
  name?: string;
  postedAt?: {
    timestamp: number;
    date: string;
    postedAgoShort?: string;
    postedAgoText?: string;
  };
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    reactions?: Array<{ type: string; count: number }>;
  };
  article?: {
    title: string;
    subtitle?: string;
    link?: string;
    description?: string;
  };
}

export interface HarvestPostComment {
  id: string;
  linkedinUrl: string;
  commentary: string;
  createdAt: string;
  createdAtTimestamp: number;
  numComments: number;
  reactionTypeCounts: Array<{ type: string; count: number }>;
  postId: string;
  actor: {
    id: string;
    name: string;
    linkedinUrl: string;
    position: string;
    pictureUrl?: string;
  };
  pinned: boolean;
  edited: boolean;
}

export interface HarvestPostReaction {
  id: string;
  reactionType: string;
  postId: string;
  actor: {
    id: string;
    name: string;
    linkedinUrl: string;
    position: string;
    pictureUrl?: string;
  };
}

export interface HarvestProfile {
  id: string;
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  headline: string;
  about: string;
  linkedinUrl: string;
  photo?: string;
  connectionsCount?: number;
  followerCount?: number;
  openToWork?: boolean;
  hiring?: boolean;
  location?: {
    linkedinText?: string;
    countryCode?: string;
    parsed?: {
      countryCode?: string;
      country?: string;
      countryFull?: string;
      state?: string;
      city?: string;
    };
  };
  currentPosition?: Array<{ companyName: string }>;
  experience?: Array<{
    companyName: string;
    position: string;
    duration?: string;
    location?: string;
    companyLink?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    employmentType?: string;
  }>;
  education?: Array<{
    title: string;
    degree?: string;
    startDate?: string;
    endDate?: string;
  }>;
  skills?: Array<{ name: string }>;
  topSkills?: string[];
}

export interface HarvestPagination {
  totalPages: number;
  totalElements: number;
  pageNumber: number;
  previousElements: number;
  pageSize: number;
  paginationToken: string | null;
}

export interface HarvestResponse<T> {
  elements: T[];
  pagination: HarvestPagination;
  status: string;
  error?: string;
}

export interface HarvestJobShort {
  id: string;
  linkedinUrl: string;
  title: string;
  postedDate?: string;
  companyName?: string;
  companyLink?: string;
  easyApply?: boolean;
}
```

**Step 2: Commit**

```bash
git add src/lib/types/signals.ts
git commit -m "feat: add signal engine TypeScript types"
```

---

## Task 3: Harvest API Client

**Files:**
- Create: `src/lib/integrations/harvest-api.ts`
- Test: `src/__tests__/lib/integrations/harvest-api.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  searchPosts,
  getPostComments,
  getPostReactions,
  getProfilePosts,
  getProfile,
  getCompanyPosts,
  searchJobs,
} from '@/lib/integrations/harvest-api';

describe('Harvest API Client', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.HARVEST_API_KEY = 'test-key';
  });

  describe('searchPosts', () => {
    it('searches posts by keyword with correct params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [{ id: '1', content: 'AI automation', linkedinUrl: 'https://linkedin.com/post/1' }],
          pagination: { totalPages: 1, totalElements: 1, pageNumber: 1, pageSize: 10, paginationToken: null },
          status: 'ok',
        }),
      });

      const result = await searchPosts({ search: 'AI automation', postedLimit: '24h' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/linkedin/post-search?search=AI+automation&postedLimit=24h'),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-API-Key': 'test-key' }),
        })
      );
      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
    });

    it('returns error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 400, message: 'Bad request' }),
      });

      const result = await searchPosts({ search: 'test' });
      expect(result.data).toEqual([]);
      expect(result.error).toBe('Harvest API error 400: Bad request');
    });
  });

  describe('getPostComments', () => {
    it('fetches comments for a post URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [{
            id: 'c1',
            commentary: 'How does this work?',
            actor: { id: 'a1', name: 'Jane Doe', linkedinUrl: 'https://linkedin.com/in/janedoe', position: 'VP Sales' },
          }],
          pagination: { totalPages: 1, totalElements: 1, pageNumber: 1, pageSize: 10, paginationToken: null },
          status: 'ok',
        }),
      });

      const result = await getPostComments('https://linkedin.com/posts/test-post');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].commentary).toBe('How does this work?');
    });
  });

  describe('getProfile', () => {
    it('fetches profile with enrichment fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'p1',
          firstName: 'Jane',
          lastName: 'Doe',
          headline: 'VP Sales at Acme',
          linkedinUrl: 'https://linkedin.com/in/janedoe',
          location: { parsed: { countryCode: 'US', countryFull: 'United States', city: 'New York' } },
          experience: [{ companyName: 'Acme', position: 'VP Sales', startDate: '2026-01' }],
        }),
      });

      const result = await getProfile({ url: 'https://linkedin.com/in/janedoe' });
      expect(result.data?.firstName).toBe('Jane');
      expect(result.data?.location?.parsed?.countryCode).toBe('US');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm test -- --testPathPattern="harvest-api" --no-coverage`
Expected: FAIL — module not found

**Step 3: Write the Harvest API client**

```typescript
// Harvest API client — LinkedIn data via REST
// Docs: https://docs.harvest-api.com
// Base URL: https://api.harvest-api.com

import type {
  HarvestPostShort,
  HarvestPostComment,
  HarvestPostReaction,
  HarvestProfile,
  HarvestResponse,
  HarvestJobShort,
} from '@/lib/types/signals';

const BASE_URL = 'https://api.harvest-api.com';

function getApiKey(): string {
  const key = process.env.HARVEST_API_KEY;
  if (!key) throw new Error('HARVEST_API_KEY not set');
  return key;
}

async function harvestGet<T>(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<{ data: T[]; error: string | null; pagination?: { totalPages: number; totalElements: number } }> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const url = `${BASE_URL}${path}?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-Key': getApiKey() },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Unknown error' }));
      return { data: [], error: `Harvest API error ${response.status}: ${err.message || 'Unknown error'}` };
    }

    const json = await response.json() as HarvestResponse<T>;
    return {
      data: json.elements || [],
      error: json.error || null,
      pagination: json.pagination ? { totalPages: json.pagination.totalPages, totalElements: json.pagination.totalElements } : undefined,
    };
  } catch (err) {
    return { data: [], error: `Harvest API fetch failed: ${(err as Error).message}` };
  }
}

async function harvestGetSingle<T>(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<{ data: T | null; error: string | null }> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const url = `${BASE_URL}${path}?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-Key': getApiKey() },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Unknown error' }));
      return { data: null, error: `Harvest API error ${response.status}: ${err.message || 'Unknown error'}` };
    }

    const json = await response.json() as T;
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: `Harvest API fetch failed: ${(err as Error).message}` };
  }
}

// --- Post endpoints ---

export async function searchPosts(params: {
  search?: string;
  profile?: string;
  company?: string;
  postedLimit?: '24h' | 'week' | 'month';
  scrapePostedLimit?: '1h' | '24h' | 'week' | 'month' | '3months' | '6months' | 'year';
  sortBy?: 'relevance' | 'date';
  page?: number;
  paginationToken?: string;
}) {
  return harvestGet<HarvestPostShort>('/linkedin/post-search', params);
}

export async function getPostComments(postUrl: string, params?: {
  sortBy?: 'relevance' | 'date';
  page?: number;
  paginationToken?: string;
}) {
  return harvestGet<HarvestPostComment>('/linkedin/post-comments', { post: postUrl, ...params });
}

export async function getPostReactions(postUrl: string, params?: { page?: number }) {
  return harvestGet<HarvestPostReaction>('/linkedin/post-reactions', { post: postUrl, ...params });
}

// --- Profile endpoints ---

export async function getProfilePosts(params: {
  profile?: string;
  profileId?: string;
  postedLimit?: '24h' | 'week' | 'month';
  scrapePostedLimit?: '1h' | '24h' | 'week' | 'month' | '3months' | '6months' | 'year';
  page?: number;
  paginationToken?: string;
}) {
  return harvestGet<HarvestPostShort>('/linkedin/profile-posts', params);
}

export async function getProfile(params: {
  url?: string;
  publicIdentifier?: string;
  profileId?: string;
  main?: string;
  findEmail?: string;
  skipSmtp?: string;
}) {
  return harvestGetSingle<HarvestProfile>('/linkedin/profile', params);
}

// --- Company endpoints ---

export async function getCompanyPosts(params: {
  company?: string;
  companyId?: string;
  companyUniversalName?: string;
  postedLimit?: '24h' | 'week' | 'month';
  scrapePostedLimit?: '1h' | '24h' | 'week' | 'month';
  page?: number;
  paginationToken?: string;
}) {
  return harvestGet<HarvestPostShort>('/linkedin/company-posts', params);
}

// --- Job endpoints ---

export async function searchJobs(params: {
  search?: string;
  companyId?: string;
  location?: string;
  postedLimit?: '24h' | 'week' | 'month';
  page?: number;
}) {
  return harvestGet<HarvestJobShort>('/linkedin/job-search', params);
}
```

**Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm test -- --testPathPattern="harvest-api" --no-coverage`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/integrations/harvest-api.ts src/__tests__/lib/integrations/harvest-api.test.ts
git commit -m "feat: add Harvest API client replacing Apify for LinkedIn data"
```

---

## Task 4: Signal Lead Upsert + Event Recording Utilities

**Files:**
- Create: `src/lib/services/signal-engine.ts`
- Test: `src/__tests__/lib/services/signal-engine.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockUpsert = vi.fn().mockResolvedValue({ data: [{ id: 'lead-1' }], error: null });
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'lead-1' }, error: null }) }) });
const mockUpdate = vi.fn().mockResolvedValue({ data: null, error: null });
const mockFrom = vi.fn().mockReturnValue({
  upsert: mockUpsert,
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate,
});

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ from: mockFrom }),
}));

import { upsertSignalLead, recordSignalEvent, updateSignalCounts } from '@/lib/services/signal-engine';

describe('Signal Engine', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('upsertSignalLead', () => {
    it('upserts a lead by user_id + linkedin_url', async () => {
      await upsertSignalLead({
        user_id: 'user-1',
        linkedin_url: 'https://linkedin.com/in/janedoe',
        first_name: 'Jane',
        last_name: 'Doe',
        headline: 'VP Sales',
      });

      expect(mockFrom).toHaveBeenCalledWith('signal_leads');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          linkedin_url: 'https://linkedin.com/in/janedoe',
          first_name: 'Jane',
        }),
        expect.objectContaining({ onConflict: 'user_id,linkedin_url' })
      );
    });
  });

  describe('recordSignalEvent', () => {
    it('inserts a signal event', async () => {
      await recordSignalEvent({
        user_id: 'user-1',
        lead_id: 'lead-1',
        signal_type: 'keyword_engagement',
        source_url: 'https://linkedin.com/posts/test',
        keyword_matched: 'AI automation',
        engagement_type: 'comment',
        comment_text: 'How does this work?',
      });

      expect(mockFrom).toHaveBeenCalledWith('signal_events');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          signal_type: 'keyword_engagement',
          keyword_matched: 'AI automation',
        })
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm test -- --testPathPattern="signal-engine" --no-coverage`
Expected: FAIL — module not found

**Step 3: Write the signal engine service**

```typescript
// Signal engine core: lead upsert, event recording, scoring utilities

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { SignalType, SentimentScore } from '@/lib/types/signals';

const supabase = createSupabaseAdminClient();

/** Normalize LinkedIn URL: strip query params, ensure trailing slash, lowercase */
export function normalizeLinkedInUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    let path = parsed.pathname.replace(/\/+$/, '');
    return `https://www.linkedin.com${path}`.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

/** Split full name into first/last */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/** Upsert a signal lead (dedup on user_id + linkedin_url) */
export async function upsertSignalLead(lead: {
  user_id: string;
  linkedin_url: string;
  first_name?: string | null;
  last_name?: string | null;
  headline?: string | null;
  job_title?: string | null;
  company?: string | null;
  country?: string | null;
}): Promise<{ id: string | null; error: string | null }> {
  const normalized = normalizeLinkedInUrl(lead.linkedin_url);

  const { data, error } = await supabase
    .from('signal_leads')
    .upsert(
      {
        ...lead,
        linkedin_url: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,linkedin_url', ignoreDuplicates: false }
    )
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data?.id || null, error: null };
}

/** Record a signal event for a lead */
export async function recordSignalEvent(event: {
  user_id: string;
  lead_id: string;
  signal_type: SignalType;
  source_url?: string | null;
  source_monitor_id?: string | null;
  comment_text?: string | null;
  sentiment?: SentimentScore | null;
  keyword_matched?: string | null;
  engagement_type?: 'comment' | 'reaction' | 'post_author' | null;
  metadata?: Record<string, unknown>;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('signal_events').insert({
    ...event,
    detected_at: new Date().toISOString(),
  });

  return { error: error?.message || null };
}

/** Update signal_count and compound_score for a lead based on its events */
export async function updateSignalCounts(userId: string, leadId: string): Promise<void> {
  // Count distinct signal types for this lead
  const { data: events } = await supabase
    .from('signal_events')
    .select('signal_type, sentiment')
    .eq('user_id', userId)
    .eq('lead_id', leadId);

  if (!events || events.length === 0) return;

  const signalTypes = new Set(events.map(e => e.signal_type));
  const signalCount = signalTypes.size;

  // Weight-based compound scoring
  const weights: Record<string, number> = {
    job_change: 30,
    job_posting: 20,
    keyword_engagement: 15,
    company_engagement: 10,
    profile_engagement: 10,
    content_velocity: 15,
  };

  let compoundScore = 0;
  for (const type of signalTypes) {
    compoundScore += weights[type] || 10;
  }

  // Sentiment bonus
  const sentiments = events.map(e => e.sentiment).filter(Boolean);
  if (sentiments.includes('high_intent')) compoundScore += 20;
  else if (sentiments.includes('question')) compoundScore += 15;
  else if (sentiments.includes('medium_intent')) compoundScore += 5;

  // Cap at 100
  compoundScore = Math.min(100, compoundScore);

  // Best sentiment
  const sentimentRank: Record<string, number> = { high_intent: 4, question: 3, medium_intent: 2, low_intent: 1 };
  const bestSentiment = sentiments.sort((a, b) => (sentimentRank[b!] || 0) - (sentimentRank[a!] || 0))[0] || null;

  await supabase
    .from('signal_leads')
    .update({
      signal_count: signalCount,
      compound_score: compoundScore,
      sentiment_score: bestSentiment,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('user_id', userId);
}

/** Batch-process engagers from a post into signal leads + events */
export async function processEngagers(params: {
  userId: string;
  signalType: SignalType;
  sourceUrl: string;
  sourceMonitorId?: string;
  keywordMatched?: string;
  engagers: Array<{
    linkedinUrl: string;
    name: string;
    headline?: string;
    commentText?: string;
    engagementType: 'comment' | 'reaction';
  }>;
}): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  for (const engager of params.engagers) {
    if (!engager.linkedinUrl) continue;

    const { firstName, lastName } = splitName(engager.name || '');

    const { id: leadId, error: upsertError } = await upsertSignalLead({
      user_id: params.userId,
      linkedin_url: engager.linkedinUrl,
      first_name: firstName || null,
      last_name: lastName || null,
      headline: engager.headline || null,
    });

    if (upsertError || !leadId) {
      errors.push(`Upsert failed for ${engager.linkedinUrl}: ${upsertError}`);
      continue;
    }

    const { error: eventError } = await recordSignalEvent({
      user_id: params.userId,
      lead_id: leadId,
      signal_type: params.signalType,
      source_url: params.sourceUrl,
      source_monitor_id: params.sourceMonitorId,
      keyword_matched: params.keywordMatched,
      engagement_type: engager.engagementType,
      comment_text: engager.commentText || null,
    });

    if (eventError) {
      errors.push(`Event failed for ${engager.linkedinUrl}: ${eventError}`);
    }

    processed++;
  }

  return { processed, errors };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm test -- --testPathPattern="signal-engine" --no-coverage`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/services/signal-engine.ts src/__tests__/lib/services/signal-engine.test.ts
git commit -m "feat: add signal engine service (lead upsert, events, scoring)"
```

---

## Task 5: AI Sentiment Scoring

**Files:**
- Create: `src/lib/ai/signal-sentiment.ts`
- Test: `src/__tests__/lib/ai/signal-sentiment.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ sentiment: 'high_intent', reasoning: 'Asking how it works' }) }],
      }),
    },
  })),
}));

import { classifyCommentSentiment, batchClassifySentiment } from '@/lib/ai/signal-sentiment';

describe('Signal Sentiment Scoring', () => {
  it('classifies a high-intent comment', async () => {
    const result = await classifyCommentSentiment('How does this integrate with our CRM?');
    expect(result.sentiment).toBe('high_intent');
  });

  it('batch classifies multiple comments', async () => {
    const results = await batchClassifySentiment([
      { id: '1', text: 'How does this work?' },
      { id: '2', text: 'Great post!' },
    ]);
    expect(results).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm test -- --testPathPattern="signal-sentiment" --no-coverage`
Expected: FAIL — module not found

**Step 3: Write sentiment classifier**

```typescript
// AI-powered comment sentiment scoring for buying intent

import Anthropic from '@anthropic-ai/sdk';
import type { SentimentScore } from '@/lib/types/signals';

const anthropic = new Anthropic();

const SENTIMENT_PROMPT = `You are a B2B sales intent classifier. Given a LinkedIn comment, classify the commenter's buying intent.

Categories:
- high_intent: Actively evaluating, asking about features/pricing/integration, expressing a need ("How does this work?", "We're looking for this", "Does this integrate with X?", "What's the pricing?")
- question: Asking a genuine question that shows interest but not active evaluation ("What do you mean by X?", "Can you elaborate?", "Is this different from Y?")
- medium_intent: Shows genuine interest beyond politeness ("Interesting approach", "We've been thinking about this", "This is relevant to what we're building")
- low_intent: Polite/generic engagement with no buying signal ("Great post!", "Congrats!", "Love this", emoji reactions, tagging someone without context)

Respond with JSON only: {"sentiment": "<category>", "reasoning": "<one sentence>"}`;

export async function classifyCommentSentiment(
  commentText: string
): Promise<{ sentiment: SentimentScore; reasoning: string }> {
  if (!commentText || commentText.trim().length < 3) {
    return { sentiment: 'low_intent', reasoning: 'Empty or trivial comment' };
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [
        { role: 'user', content: `${SENTIMENT_PROMPT}\n\nComment: "${commentText}"` },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text);
    return {
      sentiment: parsed.sentiment as SentimentScore,
      reasoning: parsed.reasoning || '',
    };
  } catch {
    return { sentiment: 'low_intent', reasoning: 'Classification failed, defaulting to low_intent' };
  }
}

export async function batchClassifySentiment(
  comments: Array<{ id: string; text: string }>
): Promise<Array<{ id: string; sentiment: SentimentScore; reasoning: string }>> {
  // Process in parallel batches of 10 to avoid rate limits
  const batchSize = 10;
  const results: Array<{ id: string; sentiment: SentimentScore; reasoning: string }> = [];

  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (comment) => {
        const { sentiment, reasoning } = await classifyCommentSentiment(comment.text);
        return { id: comment.id, sentiment, reasoning };
      })
    );
    results.push(...batchResults);
  }

  return results;
}
```

**Step 4: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm test -- --testPathPattern="signal-sentiment" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/signal-sentiment.ts src/__tests__/lib/ai/signal-sentiment.test.ts
git commit -m "feat: add AI sentiment scoring for comment buying intent"
```

---

## Task 6: ICP Filter Service

**Files:**
- Create: `src/lib/services/signal-icp-filter.ts`
- Test: `src/__tests__/lib/services/signal-icp-filter.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { matchesIcp, computeIcpScore } from '@/lib/services/signal-icp-filter';
import type { SignalConfig, HarvestProfile } from '@/lib/types/signals';

const baseConfig: Pick<SignalConfig, 'target_countries' | 'target_job_titles' | 'exclude_job_titles' | 'min_company_size' | 'max_company_size' | 'target_industries'> = {
  target_countries: ['US', 'UK'],
  target_job_titles: ['VP Sales', 'Head of Marketing', 'CMO', 'CEO'],
  exclude_job_titles: ['Intern', 'Student', 'Junior'],
  min_company_size: null,
  max_company_size: null,
  target_industries: [],
};

describe('ICP Filter', () => {
  it('matches a profile with correct country and job title', () => {
    const profile: Partial<HarvestProfile> = {
      headline: 'VP Sales at Acme Corp',
      location: { parsed: { countryCode: 'US' } },
    };
    expect(matchesIcp(profile as HarvestProfile, baseConfig)).toBe(true);
  });

  it('rejects a profile with excluded job title', () => {
    const profile: Partial<HarvestProfile> = {
      headline: 'Junior Marketing Intern at Acme',
      location: { parsed: { countryCode: 'US' } },
    };
    expect(matchesIcp(profile as HarvestProfile, baseConfig)).toBe(false);
  });

  it('rejects a profile from wrong country', () => {
    const profile: Partial<HarvestProfile> = {
      headline: 'VP Sales at GlobalCo',
      location: { parsed: { countryCode: 'IN' } },
    };
    expect(matchesIcp(profile as HarvestProfile, baseConfig)).toBe(false);
  });

  it('passes with empty country filter (no country restriction)', () => {
    const profile: Partial<HarvestProfile> = {
      headline: 'CMO at StartupX',
      location: { parsed: { countryCode: 'BR' } },
    };
    expect(matchesIcp(profile as HarvestProfile, { ...baseConfig, target_countries: [] })).toBe(true);
  });

  it('computes ICP score based on match strength', () => {
    const profile: Partial<HarvestProfile> = {
      headline: 'VP Sales at Acme Corp',
      location: { parsed: { countryCode: 'US' } },
      experience: [{ companyName: 'Acme Corp', position: 'VP Sales', startDate: '2026-01' }],
    };
    const score = computeIcpScore(profile as HarvestProfile, baseConfig);
    expect(score).toBeGreaterThan(50);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm test -- --testPathPattern="signal-icp" --no-coverage`

**Step 3: Write ICP filter**

```typescript
// ICP matching and scoring for signal leads

import type { SignalConfig, HarvestProfile } from '@/lib/types/signals';

type IcpFilters = Pick<SignalConfig,
  'target_countries' | 'target_job_titles' | 'exclude_job_titles' |
  'min_company_size' | 'max_company_size' | 'target_industries'
>;

/** Check if a profile matches ICP filters */
export function matchesIcp(profile: HarvestProfile, config: IcpFilters): boolean {
  const headline = (profile.headline || '').toLowerCase();
  const country = profile.location?.parsed?.countryCode?.toUpperCase() ||
    profile.location?.countryCode?.toUpperCase() || '';

  // Country filter (skip if empty = no restriction)
  if (config.target_countries.length > 0 && country) {
    if (!config.target_countries.some(c => c.toUpperCase() === country)) {
      return false;
    }
  }

  // Exclude job titles
  if (config.exclude_job_titles.length > 0) {
    const hasExcluded = config.exclude_job_titles.some(title =>
      headline.includes(title.toLowerCase())
    );
    if (hasExcluded) return false;
  }

  // Target job titles (skip if empty = no restriction)
  if (config.target_job_titles.length > 0) {
    const hasTarget = config.target_job_titles.some(title =>
      headline.includes(title.toLowerCase())
    );
    if (!hasTarget) return false;
  }

  return true;
}

/** Compute 0-100 ICP score based on match strength */
export function computeIcpScore(profile: HarvestProfile, config: IcpFilters): number {
  let score = 0;
  const headline = (profile.headline || '').toLowerCase();
  const country = profile.location?.parsed?.countryCode?.toUpperCase() || '';

  // Country match: +20
  if (config.target_countries.length === 0 || config.target_countries.some(c => c.toUpperCase() === country)) {
    score += 20;
  }

  // Job title match: +30 (exact title match gets more)
  if (config.target_job_titles.length > 0) {
    const matchedTitles = config.target_job_titles.filter(t => headline.includes(t.toLowerCase()));
    if (matchedTitles.length > 0) score += 30;
  } else {
    score += 15; // No filter = partial credit
  }

  // Has current position: +10
  if (profile.experience && profile.experience.length > 0) {
    const current = profile.experience.find(e => !e.endDate);
    if (current) score += 10;
  }

  // Recent role (started in last 90 days): +20 (job change signal)
  if (profile.experience && profile.experience.length > 0) {
    const current = profile.experience[0];
    if (current.startDate) {
      const startDate = new Date(current.startDate);
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      if (startDate > ninetyDaysAgo) score += 20;
    }
  }

  // Connection count / follower count as engagement proxy: +10
  if (profile.connectionsCount && profile.connectionsCount > 500) score += 5;
  if (profile.followerCount && profile.followerCount > 1000) score += 5;

  // Open to work (negative signal for decision-makers): -10
  if (profile.openToWork) score -= 10;

  // Hiring (positive signal — company is growing): +10
  if (profile.hiring) score += 10;

  return Math.max(0, Math.min(100, score));
}

/** Extract structured job title from headline (best-effort) */
export function extractJobTitle(headline: string): string | null {
  if (!headline) return null;
  // Common patterns: "Title at Company" or "Title | Company" or "Title, Company"
  const match = headline.match(/^(.+?)(?:\s+at\s+|\s*\|\s*|\s*[,–—]\s*)/i);
  return match ? match[1].trim() : headline.split(' at ')[0]?.trim() || headline;
}

/** Extract company from headline */
export function extractCompany(headline: string): string | null {
  if (!headline) return null;
  const match = headline.match(/(?:at|@)\s+(.+?)(?:\s*\||$)/i);
  return match ? match[1].trim() : null;
}
```

**Step 4: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm test -- --testPathPattern="signal-icp" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/services/signal-icp-filter.ts src/__tests__/lib/services/signal-icp-filter.test.ts
git commit -m "feat: add ICP matching and scoring for signal leads"
```

---

## Task 7: Trigger.dev Task — Keyword Scan

**Files:**
- Create: `src/trigger/signal-keyword-scan.ts`

**Step 1: Write the keyword scan task**

This is the core GoJiberri feature — search LinkedIn for posts matching keywords, extract engagers.

```typescript
import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { searchPosts, getPostComments, getPostReactions } from '@/lib/integrations/harvest-api';
import { processEngagers } from '@/lib/services/signal-engine';
import type { HarvestPostComment, HarvestPostReaction } from '@/lib/types/signals';

export const signalKeywordScan = schedules.task({
  id: 'signal-keyword-scan',
  cron: '0 */12 * * *', // Every 12 hours
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Get all active keyword monitors across all users
    const { data: monitors, error } = await supabase
      .from('signal_keyword_monitors')
      .select('*')
      .eq('is_active', true);

    if (error || !monitors || monitors.length === 0) {
      logger.info('No active keyword monitors', { error: error?.message });
      return { scanned: 0 };
    }

    // Group monitors by user to process per-user
    const byUser = new Map<string, typeof monitors>();
    for (const m of monitors) {
      const existing = byUser.get(m.user_id) || [];
      existing.push(m);
      byUser.set(m.user_id, existing);
    }

    let totalPosts = 0;
    let totalLeads = 0;

    for (const [userId, userMonitors] of byUser) {
      for (const monitor of userMonitors) {
        logger.info(`Scanning keyword: "${monitor.keyword}" for user ${userId}`);

        // Search LinkedIn for posts with this keyword (last 24h)
        const { data: posts, error: searchError } = await searchPosts({
          search: monitor.keyword,
          postedLimit: '24h',
          sortBy: 'date',
        });

        if (searchError) {
          logger.error(`Search failed for "${monitor.keyword}": ${searchError}`);
          continue;
        }

        if (!posts || posts.length === 0) {
          logger.info(`No posts found for "${monitor.keyword}"`);
          await supabase.from('signal_keyword_monitors').update({ last_scanned_at: new Date().toISOString() }).eq('id', monitor.id);
          continue;
        }

        let monitorPostsFound = 0;
        let monitorLeadsFound = 0;

        for (const post of posts.slice(0, 10)) { // Max 10 posts per keyword per scan
          const postUrl = post.linkedinUrl;
          if (!postUrl) continue;

          monitorPostsFound++;

          // Get commenters
          const { data: comments } = await getPostComments(postUrl);
          // Get reactors (first page only — cap at ~50)
          const { data: reactions } = await getPostReactions(postUrl);

          const engagers: Array<{
            linkedinUrl: string;
            name: string;
            headline?: string;
            commentText?: string;
            engagementType: 'comment' | 'reaction';
          }> = [];

          // Process comments
          if (comments) {
            for (const c of comments as HarvestPostComment[]) {
              if (c.actor?.linkedinUrl) {
                engagers.push({
                  linkedinUrl: c.actor.linkedinUrl,
                  name: c.actor.name || '',
                  headline: c.actor.position || undefined,
                  commentText: c.commentary || undefined,
                  engagementType: 'comment',
                });
              }
            }
          }

          // Process reactions
          if (reactions) {
            for (const r of reactions as HarvestPostReaction[]) {
              if (r.actor?.linkedinUrl) {
                engagers.push({
                  linkedinUrl: r.actor.linkedinUrl,
                  name: r.actor.name || '',
                  headline: r.actor.position || undefined,
                  engagementType: 'reaction',
                });
              }
            }
          }

          if (engagers.length > 0) {
            const { processed } = await processEngagers({
              userId,
              signalType: 'keyword_engagement',
              sourceUrl: postUrl,
              sourceMonitorId: monitor.id,
              keywordMatched: monitor.keyword,
              engagers,
            });
            monitorLeadsFound += processed;
          }
        }

        // Update monitor stats
        await supabase.from('signal_keyword_monitors').update({
          last_scanned_at: new Date().toISOString(),
          posts_found: monitor.posts_found + monitorPostsFound,
          leads_found: monitor.leads_found + monitorLeadsFound,
        }).eq('id', monitor.id);

        totalPosts += monitorPostsFound;
        totalLeads += monitorLeadsFound;

        logger.info(`Keyword "${monitor.keyword}": ${monitorPostsFound} posts, ${monitorLeadsFound} leads`);
      }
    }

    logger.info(`Keyword scan complete: ${totalPosts} posts, ${totalLeads} leads`);
    return { posts: totalPosts, leads: totalLeads };
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/signal-keyword-scan.ts
git commit -m "feat: add keyword scan Trigger.dev task (every 12h)"
```

---

## Task 8: Trigger.dev Task — Company Page Scan

**Files:**
- Create: `src/trigger/signal-company-scan.ts`

**Step 1: Write the company scan task**

```typescript
import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCompanyPosts, getPostComments, getPostReactions } from '@/lib/integrations/harvest-api';
import { processEngagers } from '@/lib/services/signal-engine';
import type { HarvestPostComment, HarvestPostReaction } from '@/lib/types/signals';

export const signalCompanyScan = schedules.task({
  id: 'signal-company-scan',
  cron: '30 */12 * * *', // Every 12 hours, offset 30 min from keyword scan
  run: async () => {
    const supabase = createSupabaseAdminClient();

    const { data: monitors, error } = await supabase
      .from('signal_company_monitors')
      .select('*')
      .eq('is_active', true);

    if (error || !monitors || monitors.length === 0) {
      logger.info('No active company monitors');
      return { scanned: 0 };
    }

    let totalLeads = 0;

    for (const monitor of monitors) {
      logger.info(`Scanning company: ${monitor.company_name || monitor.linkedin_company_url}`);

      const { data: posts, error: postsError } = await getCompanyPosts({
        company: monitor.linkedin_company_url,
        postedLimit: '24h',
      });

      if (postsError || !posts || posts.length === 0) {
        logger.info(`No recent posts for company ${monitor.linkedin_company_url}`);
        await supabase.from('signal_company_monitors').update({
          last_scanned_at: new Date().toISOString(),
        }).eq('id', monitor.id);
        continue;
      }

      // Update company name from first post if not set
      if (!monitor.company_name && posts[0]?.name) {
        await supabase.from('signal_company_monitors').update({
          company_name: posts[0].name,
        }).eq('id', monitor.id);
      }

      let monitorLeads = 0;

      for (const post of posts.slice(0, 5)) {
        const postUrl = post.linkedinUrl;
        if (!postUrl) continue;

        const { data: comments } = await getPostComments(postUrl);
        const { data: reactions } = await getPostReactions(postUrl);

        const engagers: Array<{
          linkedinUrl: string;
          name: string;
          headline?: string;
          commentText?: string;
          engagementType: 'comment' | 'reaction';
        }> = [];

        if (comments) {
          for (const c of comments as HarvestPostComment[]) {
            if (c.actor?.linkedinUrl) {
              engagers.push({
                linkedinUrl: c.actor.linkedinUrl,
                name: c.actor.name || '',
                headline: c.actor.position || undefined,
                commentText: c.commentary || undefined,
                engagementType: 'comment',
              });
            }
          }
        }

        if (reactions) {
          for (const r of reactions as HarvestPostReaction[]) {
            if (r.actor?.linkedinUrl) {
              engagers.push({
                linkedinUrl: r.actor.linkedinUrl,
                name: r.actor.name || '',
                headline: r.actor.position || undefined,
                engagementType: 'reaction',
              });
            }
          }
        }

        if (engagers.length > 0) {
          const { processed } = await processEngagers({
            userId: monitor.user_id,
            signalType: 'company_engagement',
            sourceUrl: postUrl,
            sourceMonitorId: monitor.id,
            engagers,
          });
          monitorLeads += processed;
        }
      }

      await supabase.from('signal_company_monitors').update({
        last_scanned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', monitor.id);

      totalLeads += monitorLeads;
      logger.info(`Company ${monitor.company_name}: ${monitorLeads} leads`);
    }

    return { leads: totalLeads };
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/signal-company-scan.ts
git commit -m "feat: add company page scan Trigger.dev task (every 12h)"
```

---

## Task 9: Trigger.dev Task — Enrich + ICP Filter + Sentiment Score

**Files:**
- Create: `src/trigger/signal-enrich-and-score.ts`

**Step 1: Write the enrichment and scoring pipeline task**

This is the pipeline that runs after scan tasks: enrich profiles, apply ICP filter, score sentiment, compute compound score.

```typescript
import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/lib/integrations/harvest-api';
import { matchesIcp, computeIcpScore, extractJobTitle, extractCompany } from '@/lib/services/signal-icp-filter';
import { updateSignalCounts } from '@/lib/services/signal-engine';
import { batchClassifySentiment } from '@/lib/ai/signal-sentiment';
import type { SignalConfig } from '@/lib/types/signals';

export const signalEnrichAndScore = schedules.task({
  id: 'signal-enrich-and-score',
  cron: '15 */2 * * *', // Every 2 hours, offset 15 min
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Step 1: Enrich new leads (status = 'new')
    const { data: newLeads, error: leadsError } = await supabase
      .from('signal_leads')
      .select('id, user_id, linkedin_url, headline')
      .eq('status', 'new')
      .limit(100); // Batch of 100 to control costs

    if (leadsError || !newLeads || newLeads.length === 0) {
      logger.info('No new leads to enrich');
      return { enriched: 0, qualified: 0 };
    }

    logger.info(`Enriching ${newLeads.length} new leads`);

    // Get all unique user configs
    const userIds = [...new Set(newLeads.map(l => l.user_id))];
    const { data: configs } = await supabase
      .from('signal_configs')
      .select('*')
      .in('user_id', userIds);

    const configMap = new Map<string, SignalConfig>();
    for (const c of configs || []) {
      configMap.set(c.user_id, c as SignalConfig);
    }

    let enriched = 0;
    let qualified = 0;

    for (const lead of newLeads) {
      const config = configMap.get(lead.user_id);

      // Enrich via Harvest API
      if (config?.enrichment_enabled !== false) {
        const { data: profile, error: profileError } = await getProfile({ url: lead.linkedin_url });

        if (profile && !profileError) {
          const jobTitle = extractJobTitle(profile.headline || lead.headline || '') || null;
          const company = extractCompany(profile.headline || '') ||
            (profile.currentPosition?.[0]?.companyName) || null;
          const country = profile.location?.parsed?.countryCode?.toUpperCase() || null;

          await supabase.from('signal_leads').update({
            first_name: profile.firstName || lead.headline,
            last_name: profile.lastName,
            headline: profile.headline,
            job_title: jobTitle,
            company,
            country,
            profile_data: profile as unknown as Record<string, unknown>,
            status: 'enriched',
            enriched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', lead.id);

          enriched++;

          // ICP filter
          if (config) {
            const icpMatch = matchesIcp(profile, config);
            const icpScore = computeIcpScore(profile, config);

            await supabase.from('signal_leads').update({
              icp_match: icpMatch,
              icp_score: icpScore,
              status: icpMatch ? 'qualified' : 'excluded',
              updated_at: new Date().toISOString(),
            }).eq('id', lead.id);

            if (icpMatch) qualified++;
          }
        } else {
          // Enrichment failed — still try ICP with headline-only
          logger.warn(`Enrichment failed for ${lead.linkedin_url}: ${profileError}`);
          await supabase.from('signal_leads').update({
            status: 'enriched', // Mark as enriched even if API failed
            enriched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', lead.id);
          enriched++;
        }
      } else {
        // Enrichment disabled — mark enriched, skip ICP
        await supabase.from('signal_leads').update({
          status: 'enriched',
          enriched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', lead.id);
        enriched++;
      }
    }

    // Step 2: Sentiment scoring for unscored comments
    const { data: unscoredEvents } = await supabase
      .from('signal_events')
      .select('id, comment_text')
      .is('sentiment', null)
      .not('comment_text', 'is', null)
      .limit(50);

    if (unscoredEvents && unscoredEvents.length > 0) {
      logger.info(`Scoring sentiment for ${unscoredEvents.length} comments`);
      const sentiments = await batchClassifySentiment(
        unscoredEvents.map(e => ({ id: e.id, text: e.comment_text! }))
      );

      for (const s of sentiments) {
        await supabase.from('signal_events').update({ sentiment: s.sentiment }).eq('id', s.id);
      }
    }

    // Step 3: Update compound scores for enriched leads
    const { data: leadsToScore } = await supabase
      .from('signal_leads')
      .select('id, user_id')
      .in('status', ['enriched', 'qualified'])
      .limit(100);

    if (leadsToScore) {
      for (const lead of leadsToScore) {
        await updateSignalCounts(lead.user_id, lead.id);
      }
    }

    logger.info(`Enrich complete: ${enriched} enriched, ${qualified} qualified`);
    return { enriched, qualified };
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/signal-enrich-and-score.ts
git commit -m "feat: add enrichment + ICP filter + sentiment scoring Trigger.dev task"
```

---

## Task 10: Trigger.dev Task — HeyReach Push

**Files:**
- Create: `src/trigger/signal-push-heyreach.ts`

**Step 1: Write the HeyReach push task**

```typescript
import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { pushLeadsToHeyReach } from '@/lib/integrations/heyreach';

export const signalPushHeyreach = schedules.task({
  id: 'signal-push-heyreach',
  cron: '*/30 * * * *', // Every 30 minutes
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Get users with auto_push_enabled
    const { data: configs } = await supabase
      .from('signal_configs')
      .select('user_id, default_heyreach_campaign_id')
      .eq('auto_push_enabled', true)
      .not('default_heyreach_campaign_id', 'is', null);

    if (!configs || configs.length === 0) {
      logger.info('No users with auto-push enabled');
      return { pushed: 0 };
    }

    let totalPushed = 0;

    for (const config of configs) {
      // Get qualified leads not yet pushed
      const { data: leads } = await supabase
        .from('signal_leads')
        .select('id, linkedin_url, first_name, last_name, headline, compound_score, signal_count')
        .eq('user_id', config.user_id)
        .eq('status', 'qualified')
        .eq('icp_match', true)
        .is('heyreach_pushed_at', null)
        .order('compound_score', { ascending: false })
        .limit(100);

      if (!leads || leads.length === 0) continue;

      // Determine campaign: lead-level override or default
      const campaignId = config.default_heyreach_campaign_id!;

      const heyreachLeads = leads.map(l => ({
        profileUrl: l.linkedin_url.endsWith('/') ? l.linkedin_url : `${l.linkedin_url}/`,
        firstName: l.first_name || undefined,
        lastName: l.last_name || undefined,
        customVariables: {
          compound_score: String(l.compound_score || 0),
          signal_count: String(l.signal_count || 0),
          headline: l.headline || '',
        },
      }));

      const { success, added, error } = await pushLeadsToHeyReach(campaignId, heyreachLeads);

      if (success) {
        const leadIds = leads.map(l => l.id);
        await supabase.from('signal_leads').update({
          status: 'pushed',
          heyreach_campaign_id: campaignId,
          heyreach_pushed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).in('id', leadIds);

        totalPushed += added;
        logger.info(`Pushed ${added} leads to HeyReach campaign ${campaignId}`);
      } else {
        logger.error(`HeyReach push failed for user ${config.user_id}: ${error}`);
        // Mark error on leads so they're retried next cycle
        const leadIds = leads.map(l => l.id);
        await supabase.from('signal_leads').update({
          heyreach_error: error || 'Push failed',
          updated_at: new Date().toISOString(),
        }).in('id', leadIds);
      }
    }

    return { pushed: totalPushed };
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/signal-push-heyreach.ts
git commit -m "feat: add HeyReach push Trigger.dev task (every 30 min)"
```

---

## Task 11: Migrate Existing Profile Scan to Harvest API

**Files:**
- Modify: `src/trigger/scrape-engagement.ts`
- Modify: `src/lib/integrations/apify-engagers.ts` (deprecate)

**Step 1: Create new profile scan task using Harvest API**

Create `src/trigger/signal-profile-scan.ts` that replaces the competitor portion of the existing `scrape-engagement.ts`, using Harvest API instead of Apify. Keep the existing `scrape-engagement.ts` for own-post scraping (Phase 1) temporarily — only migrate the competitor/profile monitoring (Phase 2).

```typescript
import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getProfilePosts, getPostComments, getPostReactions } from '@/lib/integrations/harvest-api';
import { processEngagers } from '@/lib/services/signal-engine';
import type { HarvestPostComment, HarvestPostReaction } from '@/lib/types/signals';

const SCRAPE_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes between scrapes per profile

function shouldScrapeProfile(lastScrapedAt: string | null): boolean {
  if (!lastScrapedAt) return true;
  return Date.now() - new Date(lastScrapedAt).getTime() > SCRAPE_INTERVAL_MS;
}

export const signalProfileScan = schedules.task({
  id: 'signal-profile-scan',
  cron: '*/10 * * * *', // Every 10 minutes (matches existing cadence)
  run: async () => {
    const supabase = createSupabaseAdminClient();

    const { data: monitors, error } = await supabase
      .from('signal_profile_monitors')
      .select('*')
      .eq('is_active', true)
      .limit(20);

    if (error || !monitors || monitors.length === 0) {
      return { scanned: 0 };
    }

    // Filter to profiles due for scraping
    const dueMonitors = monitors.filter(m => shouldScrapeProfile(m.last_scraped_at));
    if (dueMonitors.length === 0) return { scanned: 0 };

    let totalLeads = 0;

    for (const monitor of dueMonitors.slice(0, 5)) { // Max 5 per cycle
      logger.info(`Scanning profile: ${monitor.name || monitor.linkedin_profile_url}`);

      const { data: posts, error: postsError } = await getProfilePosts({
        profile: monitor.linkedin_profile_url,
        scrapePostedLimit: 'week', // Last 7 days
      });

      if (postsError || !posts || posts.length === 0) {
        await supabase.from('signal_profile_monitors').update({
          last_scraped_at: new Date().toISOString(),
        }).eq('id', monitor.id);
        continue;
      }

      // Update name/headline from posts if not set
      if (!monitor.name && posts[0]?.name) {
        await supabase.from('signal_profile_monitors').update({
          name: posts[0].name,
        }).eq('id', monitor.id);
      }

      let monitorLeads = 0;

      for (const post of posts.slice(0, 10)) {
        const postUrl = post.linkedinUrl;
        if (!postUrl) continue;

        const { data: comments } = await getPostComments(postUrl);
        const { data: reactions } = await getPostReactions(postUrl);

        const engagers: Array<{
          linkedinUrl: string;
          name: string;
          headline?: string;
          commentText?: string;
          engagementType: 'comment' | 'reaction';
        }> = [];

        if (comments) {
          for (const c of comments as HarvestPostComment[]) {
            if (c.actor?.linkedinUrl) {
              engagers.push({
                linkedinUrl: c.actor.linkedinUrl,
                name: c.actor.name || '',
                headline: c.actor.position || undefined,
                commentText: c.commentary || undefined,
                engagementType: 'comment',
              });
            }
          }
        }

        if (reactions) {
          for (const r of reactions as HarvestPostReaction[]) {
            if (r.actor?.linkedinUrl) {
              engagers.push({
                linkedinUrl: r.actor.linkedinUrl,
                name: r.actor.name || '',
                headline: r.actor.position || undefined,
                engagementType: 'reaction',
              });
            }
          }
        }

        if (engagers.length > 0) {
          const { processed } = await processEngagers({
            userId: monitor.user_id,
            signalType: 'profile_engagement',
            sourceUrl: postUrl,
            sourceMonitorId: monitor.id,
            engagers,
          });
          monitorLeads += processed;
        }
      }

      await supabase.from('signal_profile_monitors').update({
        last_scraped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', monitor.id);

      totalLeads += monitorLeads;
    }

    return { leads: totalLeads };
  },
});
```

**Step 2: Comment out the competitor phase in existing scrape-engagement.ts**

In `src/trigger/scrape-engagement.ts`, add a comment at the top of Phase 2 (competitor scraping):

```typescript
// DEPRECATED: Competitor scraping migrated to signal-profile-scan.ts (Harvest API)
// Phase 2 code below is kept for reference but no longer runs.
// TODO: Remove after confirming signal-profile-scan is stable.
```

And wrap the Phase 2 logic in an `if (false)` block or remove the competitor loop. Keep Phase 1 (own posts) running until that's also migrated.

**Step 3: Commit**

```bash
git add src/trigger/signal-profile-scan.ts src/trigger/scrape-engagement.ts
git commit -m "feat: migrate profile scanning from Apify to Harvest API"
```

---

## Task 12: API Routes — Signal Config + Keyword/Company Monitors

**Files:**
- Create: `src/app/api/signals/config/route.ts`
- Create: `src/app/api/signals/keywords/route.ts`
- Create: `src/app/api/signals/keywords/[id]/route.ts`
- Create: `src/app/api/signals/companies/route.ts`
- Create: `src/app/api/signals/companies/[id]/route.ts`

**Step 1: Signal Config API**

```typescript
// src/app/api/signals/config/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('signal_configs')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // Not "no rows"
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data || null });
}

export async function PUT(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from('signal_configs')
    .upsert({
      user_id: session.user.id,
      target_countries: body.target_countries || [],
      target_job_titles: body.target_job_titles || [],
      exclude_job_titles: body.exclude_job_titles || [],
      min_company_size: body.min_company_size || null,
      max_company_size: body.max_company_size || null,
      target_industries: body.target_industries || [],
      default_heyreach_campaign_id: body.default_heyreach_campaign_id || null,
      enrichment_enabled: body.enrichment_enabled ?? true,
      sentiment_scoring_enabled: body.sentiment_scoring_enabled ?? true,
      auto_push_enabled: body.auto_push_enabled ?? false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
```

**Step 2: Keyword Monitors API**

```typescript
// src/app/api/signals/keywords/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('signal_keyword_monitors')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keywords: data });
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { keyword } = await request.json();
  if (!keyword || keyword.trim().length < 2) {
    return NextResponse.json({ error: 'Keyword must be at least 2 characters' }, { status: 400 });
  }

  // Max 20 keywords per user
  const { count } = await supabase
    .from('signal_keyword_monitors')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.user.id);

  if ((count || 0) >= 20) {
    return NextResponse.json({ error: 'Maximum 20 keywords allowed' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('signal_keyword_monitors')
    .insert({ user_id: session.user.id, keyword: keyword.trim() })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Keyword already exists' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keyword: data }, { status: 201 });
}
```

```typescript
// src/app/api/signals/keywords/[id]/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from('signal_keyword_monitors')
    .update({ is_active: body.is_active })
    .eq('id', params.id)
    .eq('user_id', session.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keyword: data });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('signal_keyword_monitors')
    .delete()
    .eq('id', params.id)
    .eq('user_id', session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

**Step 3: Company Monitors API** — same pattern as keywords but for `signal_company_monitors`, with LinkedIn company URL validation (`linkedin.com/company/`), max 10 companies per user.

**Step 4: Commit**

```bash
git add src/app/api/signals/
git commit -m "feat: add signal config + keyword/company monitor API routes"
```

---

## Task 13: API Route — Signal Leads Dashboard

**Files:**
- Create: `src/app/api/signals/leads/route.ts`

**Step 1: Write the leads API**

```typescript
// src/app/api/signals/leads/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status'); // new, enriched, qualified, pushed, excluded
  const icpMatch = url.searchParams.get('icp_match'); // true, false
  const signalType = url.searchParams.get('signal_type');
  const minScore = url.searchParams.get('min_score');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let query = supabase
    .from('signal_leads')
    .select('*, signal_events(id, signal_type, comment_text, sentiment, keyword_matched, detected_at)', { count: 'exact' })
    .eq('user_id', session.user.id)
    .order('compound_score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (icpMatch === 'true') query = query.eq('icp_match', true);
  if (icpMatch === 'false') query = query.eq('icp_match', false);
  if (minScore) query = query.gte('compound_score', parseInt(minScore));

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If signal_type filter requested, filter leads that have that signal type in events
  let filteredData = data;
  if (signalType && filteredData) {
    filteredData = filteredData.filter(lead =>
      (lead.signal_events as Array<{ signal_type: string }>)?.some(e => e.signal_type === signalType)
    );
  }

  return NextResponse.json({
    leads: filteredData,
    total: count || 0,
    page,
    limit,
  });
}

// Bulk push to HeyReach
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, lead_ids, campaign_id } = await request.json();

  if (action === 'exclude') {
    await supabase
      .from('signal_leads')
      .update({ status: 'excluded', updated_at: new Date().toISOString() })
      .in('id', lead_ids)
      .eq('user_id', session.user.id);
    return NextResponse.json({ success: true });
  }

  if (action === 'push' && campaign_id) {
    // Import pushLeadsToHeyReach dynamically to avoid client-side import
    const { pushLeadsToHeyReach } = await import('@/lib/integrations/heyreach');
    const { data: leads } = await supabase
      .from('signal_leads')
      .select('id, linkedin_url, first_name, last_name, headline, compound_score')
      .in('id', lead_ids)
      .eq('user_id', session.user.id);

    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: 'No leads found' }, { status: 404 });
    }

    const heyreachLeads = leads.map(l => ({
      profileUrl: l.linkedin_url.endsWith('/') ? l.linkedin_url : `${l.linkedin_url}/`,
      firstName: l.first_name || undefined,
      lastName: l.last_name || undefined,
    }));

    const { success, added, error } = await pushLeadsToHeyReach(campaign_id, heyreachLeads);

    if (success) {
      await supabase.from('signal_leads').update({
        status: 'pushed',
        heyreach_campaign_id: campaign_id,
        heyreach_pushed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).in('id', lead_ids).eq('user_id', session.user.id);
    }

    return NextResponse.json({ success, added, error });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
```

**Step 2: Commit**

```bash
git add src/app/api/signals/leads/route.ts
git commit -m "feat: add signal leads API with filtering and bulk actions"
```

---

## Task 14: Settings UI — ICP Config + Keyword/Company Monitors

**Files:**
- Create: `src/components/settings/SignalConfig.tsx`
- Create: `src/components/settings/KeywordMonitors.tsx`
- Create: `src/components/settings/CompanyMonitors.tsx`
- Modify: Settings page to include new components

**Step 1: Build the ICP Config component**

This is a form with: country multi-select (tag input), job title tag input, exclude titles tag input, HeyReach campaign ID, enrichment toggle, sentiment toggle, auto-push toggle. Follow the same patterns as `CompetitorMonitoring.tsx` — fetch on mount via API, save via PUT.

**Step 2: Build the Keyword Monitors component**

Input to add keywords, list of keywords with toggle active/delete, shows posts_found and leads_found counts. Same CRUD pattern as `CompetitorMonitoring.tsx`.

**Step 3: Build the Company Monitors component**

Input for LinkedIn company URL, list with toggle/delete, shows company_name and last_scanned_at. Same pattern.

**Step 4: Add components to settings page**

Find the settings page that includes `<CompetitorMonitoring />` and add the new components in a "Signal Engine" section above/alongside it.

**Step 5: Commit**

```bash
git add src/components/settings/SignalConfig.tsx src/components/settings/KeywordMonitors.tsx src/components/settings/CompanyMonitors.tsx
git commit -m "feat: add settings UI for ICP config, keyword monitors, company monitors"
```

---

## Task 15: Dashboard — Signal Leads Page

**Files:**
- Create: `src/app/(dashboard)/signals/page.tsx`
- Create: `src/components/signals/SignalLeadsTable.tsx`
- Create: `src/components/signals/SignalLeadDetail.tsx`

**Step 1: Build the Signal Leads page**

Table view with columns: Name, Headline, Company, Country, Signal Count, Compound Score, Sentiment, Status, Detected Date. Filters: status dropdown, ICP match toggle, signal type dropdown, min score slider, date range. Bulk actions: push to HeyReach (with campaign ID input), exclude. Click row → slide-out detail panel showing all signal_events for that lead, full profile data, timeline.

Follow existing dashboard page patterns in `src/app/(dashboard)/`.

**Step 2: Build the detail drawer**

Shows: lead profile card, all signal events in reverse chronological order, each event shows type badge, source URL, comment text (if any), sentiment badge, detected date.

**Step 3: Add to navigation**

Add "Signals" nav item in the dashboard sidebar. Look at existing navigation component for the pattern.

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/signals/ src/components/signals/
git commit -m "feat: add signal leads dashboard page with table, filters, and detail drawer"
```

---

## Task 16: Set Environment Variables

**Step 1: Set HARVEST_API_KEY in local, Vercel, and Trigger.dev**

```bash
# Local .env.local
echo "HARVEST_API_KEY=alVIGw5vMtgQwCG9FdAh2jkMmCOP0PZ6" >> "/Users/timlife/Documents/claude code/magnetlab/.env.local"

# Vercel
cd "/Users/timlife/Documents/claude code/magnetlab" && vercel env add HARVEST_API_KEY production

# Trigger.dev
curl -X POST "https://api.trigger.dev/api/v1/projects/proj_jdjofdqazqwitpinxady/envvars/prod" \
  -H "Authorization: Bearer tr_prod_DB3vrdcduJYcXF19rrEB" \
  -H "Content-Type: application/json" \
  -d '{"name":"HARVEST_API_KEY","value":"alVIGw5vMtgQwCG9FdAh2jkMmCOP0PZ6"}'
```

**Step 2: Verify ANTHROPIC_API_KEY is set in Trigger.dev** (for sentiment scoring)

Check via Trigger.dev dashboard or API. Should already be set from Helicone integration.

**Step 3: No commit needed**

---

## Task 17: Deploy + Smoke Test

**Step 1: Deploy to Vercel**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && vercel --prod
```

**Step 2: Deploy Trigger.dev tasks**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy
```

**Step 3: Smoke test**

1. Go to Settings → Signal Engine → add ICP config (country: US, titles: VP Sales, Head of Marketing)
2. Add keyword monitor: "sales automation"
3. Add company monitor: https://linkedin.com/company/gong-io
4. Wait for next scheduled scan (or trigger manually via Trigger.dev dashboard)
5. Check Signal Leads dashboard for results
6. Verify enrichment populated job_title/company/country
7. Verify ICP filter excluded non-matching leads
8. Test bulk push to HeyReach with a test campaign

**Step 4: Commit any fixes**

---

## Task 18: Remove Apify Dependency (Cleanup)

**Step 1: Migrate own-post scanning**

Once `signal-profile-scan.ts` is confirmed stable, update `scrape-engagement.ts` Phase 1 (own posts) to also use Harvest API. The own-post flow uses `scrapeEngagers()` with a LinkedIn post URL — replace with `getPostComments()` + `getPostReactions()` from the Harvest client.

**Step 2: Remove Apify references**

- Delete or deprecate `src/lib/integrations/apify-engagers.ts`
- Remove `APIFY_API_TOKEN` from env vars (Vercel, Trigger.dev)
- Cancel Apify actor subscriptions ($30/mo savings)

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove Apify dependency, fully migrated to Harvest API"
```

---

## Summary of All Files Created/Modified

| File | Action |
|------|--------|
| `supabase/migrations/20260227000000_signal_engine.sql` | Create |
| `src/lib/types/signals.ts` | Create |
| `src/lib/integrations/harvest-api.ts` | Create |
| `src/__tests__/lib/integrations/harvest-api.test.ts` | Create |
| `src/lib/services/signal-engine.ts` | Create |
| `src/__tests__/lib/services/signal-engine.test.ts` | Create |
| `src/lib/ai/signal-sentiment.ts` | Create |
| `src/__tests__/lib/ai/signal-sentiment.test.ts` | Create |
| `src/lib/services/signal-icp-filter.ts` | Create |
| `src/__tests__/lib/services/signal-icp-filter.test.ts` | Create |
| `src/trigger/signal-keyword-scan.ts` | Create |
| `src/trigger/signal-company-scan.ts` | Create |
| `src/trigger/signal-enrich-and-score.ts` | Create |
| `src/trigger/signal-push-heyreach.ts` | Create |
| `src/trigger/signal-profile-scan.ts` | Create |
| `src/trigger/scrape-engagement.ts` | Modify (deprecate Phase 2) |
| `src/app/api/signals/config/route.ts` | Create |
| `src/app/api/signals/keywords/route.ts` | Create |
| `src/app/api/signals/keywords/[id]/route.ts` | Create |
| `src/app/api/signals/companies/route.ts` | Create |
| `src/app/api/signals/companies/[id]/route.ts` | Create |
| `src/app/api/signals/leads/route.ts` | Create |
| `src/components/settings/SignalConfig.tsx` | Create |
| `src/components/settings/KeywordMonitors.tsx` | Create |
| `src/components/settings/CompanyMonitors.tsx` | Create |
| `src/app/(dashboard)/signals/page.tsx` | Create |
| `src/components/signals/SignalLeadsTable.tsx` | Create |
| `src/components/signals/SignalLeadDetail.tsx` | Create |
| `src/lib/integrations/apify-engagers.ts` | Deprecate/Delete (Task 18) |
