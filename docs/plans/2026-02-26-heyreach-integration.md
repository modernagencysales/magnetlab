# HeyReach Lead Magnet Delivery Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable magnetlab users to deliver lead magnets via HeyReach LinkedIn campaigns — connect API key, configure delivery campaign per funnel, auto-add leads with custom variables on opt-in.

**Architecture:** Two-layer integration (account-level API key in `user_integrations` + funnel-level campaign config in `funnel_integrations`). Fire-and-forget delivery in the `after()` block of `POST /api/public/lead`, matching the existing GoHighLevel pattern exactly. LinkedIn URL captured from `?li=` URL parameter on opt-in pages.

**Tech Stack:** Next.js 15 API routes, Supabase PostgreSQL, HeyReach API (`https://api.heyreach.io/api/public`), Jest 29

---

### Task 1: HeyReach Client — Types

**Files:**
- Create: `src/lib/integrations/heyreach/types.ts`

**Step 1: Create the types file**

```typescript
// HeyReach API Types

export interface HeyReachSyncParams {
  userId: string;
  funnelPageId: string;
  lead: {
    email: string;
    name?: string | null;
    linkedinUrl?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    isQualified?: boolean | null;
    qualificationAnswers?: Record<string, string> | null;
  };
  leadMagnetTitle: string;
  leadMagnetUrl: string;
  funnelSlug: string;
}

export interface HeyReachContact {
  linkedinUrl?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  customFields?: Record<string, string>;
}

export interface HeyReachCampaign {
  id: number;
  name: string;
  status: string;
  createdAt?: string;
}

export interface HeyReachLinkedInAccount {
  id: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  isActive: boolean;
  authIsValid: boolean;
  profileUrl: string;
}

export interface AddContactsResult {
  success: boolean;
  added: number;
  error?: string;
}
```

**Step 2: Commit**

```bash
git add src/lib/integrations/heyreach/types.ts
git commit -m "feat(heyreach): add HeyReach integration types"
```

---

### Task 2: HeyReach Client — API Client

**Files:**
- Replace: `src/lib/integrations/heyreach.ts` → `src/lib/integrations/heyreach/client.ts`

The existing `src/lib/integrations/heyreach.ts` is a simple function used by Engagement Intelligence. We'll replace it with a proper class that covers both use cases.

**Step 1: Create the client**

```typescript
// HeyReach API Client
// Base URL: https://api.heyreach.io/api/public
// Auth: X-API-KEY header
// Note: AddLeadsToCampaign is correct (NOT AddLeadsToListV2 which returns 404)

import type { HeyReachCampaign, HeyReachContact, HeyReachLinkedInAccount, AddContactsResult } from './types';

const HEYREACH_BASE_URL = 'https://api.heyreach.io/api/public';
const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export class HeyReachClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Verify the API key by listing campaigns with limit 1.
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${HEYREACH_BASE_URL}/campaign/GetAll`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ statuses: [], accountIds: [], limit: 1, offset: 0 }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List campaigns for the dropdown selector.
   */
  async listCampaigns(params?: {
    statuses?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ campaigns: HeyReachCampaign[]; total: number; error?: string }> {
    try {
      const response = await fetch(`${HEYREACH_BASE_URL}/campaign/GetAll`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          statuses: params?.statuses || [],
          accountIds: [],
          limit: params?.limit || 100,
          offset: params?.offset || 0,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { campaigns: [], total: 0, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      const campaigns = (data.items || []).map((item: Record<string, unknown>) => ({
        id: item.id as number,
        name: item.name as string,
        status: item.status as string,
        createdAt: item.createdAt as string | undefined,
      }));

      return { campaigns, total: data.totalCount || 0 };
    } catch (err) {
      return { campaigns: [], total: 0, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * List connected LinkedIn accounts.
   */
  async listLinkedInAccounts(): Promise<{ accounts: HeyReachLinkedInAccount[]; error?: string }> {
    try {
      const response = await fetch(`${HEYREACH_BASE_URL}/linkedin/GetAll`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ limit: 100, offset: 0 }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { accounts: [], error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      return { accounts: data.items || [] };
    } catch (err) {
      return { accounts: [], error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Add contacts to a campaign with retry logic.
   * Custom fields are sent as customUserFields on the lead object.
   */
  async addContactsToCampaign(
    campaignId: number,
    contacts: HeyReachContact[]
  ): Promise<AddContactsResult> {
    if (contacts.length === 0) {
      return { success: true, added: 0 };
    }

    const accountLeadPairs = contacts.map((c) => ({
      linkedInAccountId: null,
      lead: {
        profileUrl: c.linkedinUrl
          ? c.linkedinUrl.endsWith('/') ? c.linkedinUrl : `${c.linkedinUrl}/`
          : null,
        firstName: c.firstName || null,
        lastName: c.lastName || null,
        emailAddress: c.email || null,
        companyName: c.company || null,
        customUserFields: c.customFields
          ? Object.entries(c.customFields).map(([name, value]) => ({ name, value }))
          : null,
      },
    }));

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await this.delay(BASE_DELAY_MS * Math.pow(2, attempt - 1));
      }

      try {
        const response = await fetch(`${HEYREACH_BASE_URL}/campaign/AddLeadsToCampaign`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ campaignId, accountLeadPairs }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (response.ok) {
          return { success: true, added: contacts.length };
        }

        const errorText = await response.text();
        lastError = `HTTP ${response.status}: ${errorText}`;

        if (!RETRYABLE_STATUS_CODES.has(response.status)) {
          return { success: false, added: 0, error: lastError };
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    return { success: false, added: 0, error: lastError };
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': this.apiKey,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Legacy function for backward compatibility with Engagement Intelligence.
 * Uses global HEYREACH_API_KEY env var.
 */
export async function pushLeadsToHeyReach(
  campaignId: string,
  leads: Array<{
    profileUrl: string;
    firstName?: string;
    lastName?: string;
    customVariables?: Record<string, string>;
  }>
): Promise<{ success: boolean; added: number; error?: string }> {
  const apiKey = process.env.HEYREACH_API_KEY;
  if (!apiKey) {
    return { success: false, added: 0, error: 'HEYREACH_API_KEY not set' };
  }

  const client = new HeyReachClient(apiKey);
  return client.addContactsToCampaign(
    Number(campaignId),
    leads.map((l) => ({
      linkedinUrl: l.profileUrl,
      firstName: l.firstName,
      lastName: l.lastName,
      customFields: l.customVariables,
    }))
  );
}
```

**Step 2: Update any imports of the old file**

Search for `from '@/lib/integrations/heyreach'` and update to `from '@/lib/integrations/heyreach/client'`. The `pushLeadsToHeyReach` function is re-exported for backward compatibility.

Run: `grep -r "from '@/lib/integrations/heyreach'" src/ --include="*.ts" --include="*.tsx"`

Update each import path to point to `@/lib/integrations/heyreach/client`.

**Step 3: Delete old file, commit**

```bash
rm src/lib/integrations/heyreach.ts
git add src/lib/integrations/heyreach/
git add -u  # stage deleted file + updated imports
git commit -m "feat(heyreach): add HeyReach API client with retry logic"
```

---

### Task 3: HeyReach Client — Tests

**Files:**
- Create: `src/__tests__/lib/integrations/heyreach-client.test.ts`

**Step 1: Write tests**

```typescript
/**
 * @jest-environment node
 */

import { HeyReachClient } from '@/lib/integrations/heyreach/client';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('HeyReachClient', () => {
  let client: HeyReachClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new HeyReachClient('test-api-key');
  });

  describe('testConnection', () => {
    it('returns true when API responds 200', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const result = await client.testConnection();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.heyreach.io/api/public/campaign/GetAll',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-API-KEY': 'test-api-key' }),
        })
      );
    });

    it('returns false when API responds with error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      const result = await client.testConnection();
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await client.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('listCampaigns', () => {
    it('returns campaigns on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCount: 2,
          items: [
            { id: 1, name: 'Campaign 1', status: 'active' },
            { id: 2, name: 'Campaign 2', status: 'paused' },
          ],
        }),
      });

      const result = await client.listCampaigns();
      expect(result.campaigns).toHaveLength(2);
      expect(result.campaigns[0].name).toBe('Campaign 1');
      expect(result.total).toBe(2);
      expect(result.error).toBeUndefined();
    });

    it('returns error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      const result = await client.listCampaigns();
      expect(result.campaigns).toHaveLength(0);
      expect(result.error).toContain('500');
    });
  });

  describe('addContactsToCampaign', () => {
    it('adds contacts successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const result = await client.addContactsToCampaign(123, [
        {
          linkedinUrl: 'https://linkedin.com/in/john',
          firstName: 'John',
          email: 'john@example.com',
          customFields: { lead_magnet_title: 'My Guide' },
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.added).toBe(1);

      // Verify trailing slash normalization
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.accountLeadPairs[0].lead.profileUrl).toBe('https://linkedin.com/in/john/');
    });

    it('returns early for empty contacts', async () => {
      const result = await client.addContactsToCampaign(123, []);
      expect(result.success).toBe(true);
      expect(result.added).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not retry on 4xx errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      });

      const result = await client.addContactsToCampaign(123, [
        { linkedinUrl: 'https://linkedin.com/in/john' },
      ]);

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('sends customFields as customUserFields array', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await client.addContactsToCampaign(123, [
        {
          linkedinUrl: 'https://linkedin.com/in/john/',
          customFields: { lead_magnet_title: 'My Guide', lead_magnet_url: 'https://example.com' },
        },
      ]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const customFields = body.accountLeadPairs[0].lead.customUserFields;
      expect(customFields).toEqual([
        { name: 'lead_magnet_title', value: 'My Guide' },
        { name: 'lead_magnet_url', value: 'https://example.com' },
      ]);
    });
  });
});
```

**Step 2: Run tests**

Run: `npx jest src/__tests__/lib/integrations/heyreach-client.test.ts --no-coverage`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/__tests__/lib/integrations/heyreach-client.test.ts
git commit -m "test(heyreach): add HeyReach client tests"
```

---

### Task 4: HeyReach Sync Function

**Files:**
- Create: `src/lib/integrations/heyreach/sync.ts`

This mirrors `src/lib/integrations/gohighlevel/sync.ts` exactly.

**Step 1: Write the failing test**

Create `src/__tests__/lib/integrations/heyreach-sync.test.ts`:

```typescript
/**
 * @jest-environment node
 */

import type { HeyReachSyncParams } from '@/lib/integrations/heyreach/types';

// Mock dependencies
const mockGetUserIntegration = jest.fn();
jest.mock('@/lib/utils/encrypted-storage', () => ({
  getUserIntegration: (...args: unknown[]) => mockGetUserIntegration(...args),
}));

const mockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
  update: jest.fn(),
};
mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => mockSupabaseClient,
}));

const mockAddContacts = jest.fn();
jest.mock('@/lib/integrations/heyreach/client', () => ({
  HeyReachClient: jest.fn().mockImplementation(() => ({
    addContactsToCampaign: mockAddContacts,
  })),
}));

import { syncLeadToHeyReach } from '@/lib/integrations/heyreach/sync';

describe('syncLeadToHeyReach', () => {
  const baseParams: HeyReachSyncParams = {
    userId: 'user-123',
    funnelPageId: 'funnel-456',
    lead: {
      email: 'john@example.com',
      name: 'John Doe',
      linkedinUrl: 'https://linkedin.com/in/john',
    },
    leadMagnetTitle: 'My Guide',
    leadMagnetUrl: 'https://magnetlab.app/p/user/slug/content',
    funnelSlug: 'my-guide',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
  });

  it('skips silently when no integration configured', async () => {
    mockGetUserIntegration.mockResolvedValueOnce(null);

    await syncLeadToHeyReach(baseParams);

    expect(mockAddContacts).not.toHaveBeenCalled();
  });

  it('skips when integration is inactive', async () => {
    mockGetUserIntegration.mockResolvedValueOnce({
      api_key: 'key-123',
      is_active: false,
    });

    await syncLeadToHeyReach(baseParams);

    expect(mockAddContacts).not.toHaveBeenCalled();
  });

  it('skips when funnel integration not found', async () => {
    mockGetUserIntegration.mockResolvedValueOnce({
      api_key: 'key-123',
      is_active: true,
    });
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116' },
    });

    await syncLeadToHeyReach(baseParams);

    expect(mockAddContacts).not.toHaveBeenCalled();
  });

  it('delivers lead to HeyReach campaign with custom fields', async () => {
    mockGetUserIntegration.mockResolvedValueOnce({
      api_key: 'key-123',
      is_active: true,
    });
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: 'fi-1',
        provider: 'heyreach',
        is_active: true,
        settings: { campaign_id: 789 },
      },
      error: null,
    });
    mockAddContacts.mockResolvedValueOnce({ success: true, added: 1 });
    // Mock the update chain for delivery status
    mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: null });

    await syncLeadToHeyReach(baseParams);

    expect(mockAddContacts).toHaveBeenCalledWith(789, [
      expect.objectContaining({
        linkedinUrl: 'https://linkedin.com/in/john',
        firstName: 'John',
        email: 'john@example.com',
        customFields: expect.objectContaining({
          lead_magnet_title: 'My Guide',
          lead_magnet_url: 'https://magnetlab.app/p/user/slug/content',
        }),
      }),
    ]);
  });

  it('never throws (fire-and-forget)', async () => {
    mockGetUserIntegration.mockRejectedValueOnce(new Error('DB down'));

    // Should not throw
    await expect(syncLeadToHeyReach(baseParams)).resolves.not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/integrations/heyreach-sync.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write the sync function**

Create `src/lib/integrations/heyreach/sync.ts`:

```typescript
// HeyReach Lead Sync — fire-and-forget
// Syncs a funnel lead to the user's HeyReach delivery campaign
// if both account-level and funnel-level integrations are active.

import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { HeyReachClient } from './client';
import type { HeyReachSyncParams } from './types';

/**
 * Sync a captured lead to HeyReach.
 *
 * This is fire-and-forget: errors are logged but never thrown,
 * so it can be called without blocking the lead capture response.
 */
export async function syncLeadToHeyReach(params: HeyReachSyncParams): Promise<void> {
  try {
    const { userId, funnelPageId, lead, leadMagnetTitle, leadMagnetUrl, funnelSlug } = params;

    // 1. Check account-level connection
    const integration = await getUserIntegration(userId, 'heyreach');
    if (!integration || !integration.api_key || !integration.is_active) {
      return;
    }

    // 2. Check funnel-level toggle
    const supabase = createSupabaseAdminClient();
    const { data: funnelIntegration, error } = await supabase
      .from('funnel_integrations')
      .select('id, funnel_page_id, provider, is_active, settings')
      .eq('provider', 'heyreach')
      .eq('funnel_page_id', funnelPageId)
      .single();

    if (error || !funnelIntegration || !funnelIntegration.is_active) {
      return;
    }

    // 3. Get campaign ID from funnel settings
    const settings = funnelIntegration.settings as Record<string, unknown> | null;
    const campaignId = settings?.campaign_id as number | undefined;
    if (!campaignId) {
      console.error('[HeyReach sync] No campaign_id configured for funnel', funnelPageId);
      return;
    }

    // 4. Build custom fields
    const customFields: Record<string, string> = {
      lead_magnet_title: leadMagnetTitle,
      lead_magnet_url: leadMagnetUrl,
    };
    if (lead.utmSource) customFields.utm_source = lead.utmSource;
    if (lead.utmMedium) customFields.utm_medium = lead.utmMedium;
    if (lead.utmCampaign) customFields.utm_campaign = lead.utmCampaign;

    // 5. Split name into first/last
    const nameParts = (lead.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // 6. Push to HeyReach
    const client = new HeyReachClient(integration.api_key);
    const result = await client.addContactsToCampaign(campaignId, [
      {
        linkedinUrl: lead.linkedinUrl || undefined,
        firstName,
        lastName,
        email: lead.email,
        customFields,
      },
    ]);

    // 7. Update delivery status on the lead (best-effort)
    const status = result.success ? 'sent' : 'failed';
    await supabase
      .from('funnel_leads')
      .update({ heyreach_delivery_status: status })
      .eq('funnel_page_id', funnelPageId)
      .eq('email', lead.email)
      .catch(() => {}); // Ignore update errors

    if (!result.success) {
      console.error('[HeyReach sync] addContactsToCampaign failed:', result.error);
    }
  } catch (err) {
    console.error('[HeyReach sync] Unexpected error:', err instanceof Error ? err.message : err);
  }
}
```

**Step 4: Run tests**

Run: `npx jest src/__tests__/lib/integrations/heyreach-sync.test.ts --no-coverage`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/integrations/heyreach/sync.ts src/__tests__/lib/integrations/heyreach-sync.test.ts
git commit -m "feat(heyreach): add fire-and-forget sync function"
```

---

### Task 5: Database Migration

**Files:**
- Create: `supabase/migrations/20260226200000_heyreach_funnel_delivery.sql`

**Step 1: Write migration**

```sql
-- Add LinkedIn URL and HeyReach delivery status to funnel_leads
ALTER TABLE funnel_leads
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS heyreach_delivery_status TEXT;

-- Update funnel_integrations provider constraint to include heyreach
-- First drop the old constraint (if it exists), then add the new one
DO $$
BEGIN
  -- Try to drop existing check constraint (name may vary)
  BEGIN
    ALTER TABLE funnel_integrations DROP CONSTRAINT IF EXISTS funnel_integrations_provider_check;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore if doesn't exist
  END;
END $$;

-- Add updated constraint with heyreach
ALTER TABLE funnel_integrations
  ADD CONSTRAINT funnel_integrations_provider_check
  CHECK (provider IN ('kit', 'mailerlite', 'mailchimp', 'activecampaign', 'gohighlevel', 'heyreach'));

-- Index for delivery status queries
CREATE INDEX IF NOT EXISTS idx_funnel_leads_heyreach_status
  ON funnel_leads (heyreach_delivery_status)
  WHERE heyreach_delivery_status IS NOT NULL;
```

**Step 2: Push migration**

Run: `npm run db:push`

**Step 3: Commit**

```bash
git add supabase/migrations/20260226200000_heyreach_funnel_delivery.sql
git commit -m "feat(heyreach): add DB migration for linkedin_url and delivery status"
```

---

### Task 6: API Routes — Connect, Verify, Status, Disconnect

**Files:**
- Create: `src/app/api/integrations/heyreach/connect/route.ts`
- Create: `src/app/api/integrations/heyreach/verify/route.ts`
- Create: `src/app/api/integrations/heyreach/status/route.ts`
- Create: `src/app/api/integrations/heyreach/disconnect/route.ts`

These mirror the GoHighLevel routes exactly.

**Step 1: Create connect route**

`src/app/api/integrations/heyreach/connect/route.ts`:

```typescript
// HeyReach Connect API
// POST /api/integrations/heyreach/connect
// Validates API key, then saves integration

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { HeyReachClient } from '@/lib/integrations/heyreach/client';
import { upsertUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { api_key } = body;

    if (!api_key || typeof api_key !== 'string') {
      return ApiErrors.validationError('API key is required');
    }

    const client = new HeyReachClient(api_key);
    const valid = await client.testConnection();

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your HeyReach API key and try again.', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    const integration = await upsertUserIntegration({
      userId: session.user.id,
      service: 'heyreach',
      apiKey: api_key,
      isActive: true,
    });

    return NextResponse.json({ integration, message: 'Connected successfully' });
  } catch (error) {
    logApiError('heyreach/connect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to connect HeyReach'
    );
  }
}
```

**Step 2: Create verify route**

`src/app/api/integrations/heyreach/verify/route.ts`:

```typescript
// HeyReach Verify API
// POST /api/integrations/heyreach/verify

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { HeyReachClient } from '@/lib/integrations/heyreach/client';
import { getUserIntegration, updateIntegrationVerified } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const integration = await getUserIntegration(session.user.id, 'heyreach');
    if (!integration?.api_key) {
      return ApiErrors.notFound('Integration');
    }

    const client = new HeyReachClient(integration.api_key);
    const verified = await client.testConnection();

    if (verified) {
      await updateIntegrationVerified(session.user.id, 'heyreach');
    }

    return NextResponse.json({ verified });
  } catch (error) {
    logApiError('heyreach/verify', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to verify connection'
    );
  }
}
```

**Step 3: Create status route**

`src/app/api/integrations/heyreach/status/route.ts`:

```typescript
// HeyReach Status API
// GET /api/integrations/heyreach/status

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const integration = await getUserIntegration(session.user.id, 'heyreach');
    const connected = !!(integration?.api_key && integration?.is_active);

    return NextResponse.json({ connected });
  } catch (error) {
    logApiError('heyreach/status', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to check connection status'
    );
  }
}
```

**Step 4: Create disconnect route**

`src/app/api/integrations/heyreach/disconnect/route.ts`:

```typescript
// HeyReach Disconnect API
// POST /api/integrations/heyreach/disconnect

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    await deleteUserIntegration(session.user.id, 'heyreach');

    // Deactivate all funnel-level HeyReach integrations
    const supabase = createSupabaseAdminClient();
    await supabase
      .from('funnel_integrations')
      .update({ is_active: false })
      .eq('user_id', session.user.id)
      .eq('provider', 'heyreach');

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('heyreach/disconnect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to disconnect HeyReach'
    );
  }
}
```

**Step 5: Commit**

```bash
git add src/app/api/integrations/heyreach/
git commit -m "feat(heyreach): add connect/verify/status/disconnect API routes"
```

---

### Task 7: API Routes — Campaigns & Accounts (for dropdown)

**Files:**
- Create: `src/app/api/integrations/heyreach/campaigns/route.ts`
- Create: `src/app/api/integrations/heyreach/accounts/route.ts`

**Step 1: Create campaigns route**

`src/app/api/integrations/heyreach/campaigns/route.ts`:

```typescript
// HeyReach Campaigns API
// GET /api/integrations/heyreach/campaigns
// Proxies to HeyReach API to fetch user's campaigns for dropdown selector

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { HeyReachClient } from '@/lib/integrations/heyreach/client';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const integration = await getUserIntegration(session.user.id, 'heyreach');
    if (!integration?.api_key || !integration?.is_active) {
      return ApiErrors.notFound('HeyReach integration not connected');
    }

    const client = new HeyReachClient(integration.api_key);
    const result = await client.listCampaigns({ limit: 100 });

    if (result.error) {
      return NextResponse.json(
        { error: result.error, campaigns: [] },
        { status: 502 }
      );
    }

    return NextResponse.json({
      campaigns: result.campaigns,
      total: result.total,
    });
  } catch (error) {
    logApiError('heyreach/campaigns', error);
    return ApiErrors.internalError('Failed to fetch campaigns');
  }
}
```

**Step 2: Create accounts route**

`src/app/api/integrations/heyreach/accounts/route.ts`:

```typescript
// HeyReach LinkedIn Accounts API
// GET /api/integrations/heyreach/accounts
// Fetches connected LinkedIn accounts for selector

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { HeyReachClient } from '@/lib/integrations/heyreach/client';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const integration = await getUserIntegration(session.user.id, 'heyreach');
    if (!integration?.api_key || !integration?.is_active) {
      return ApiErrors.notFound('HeyReach integration not connected');
    }

    const client = new HeyReachClient(integration.api_key);
    const result = await client.listLinkedInAccounts();

    if (result.error) {
      return NextResponse.json(
        { error: result.error, accounts: [] },
        { status: 502 }
      );
    }

    return NextResponse.json({ accounts: result.accounts });
  } catch (error) {
    logApiError('heyreach/accounts', error);
    return ApiErrors.internalError('Failed to fetch LinkedIn accounts');
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/integrations/heyreach/campaigns/ src/app/api/integrations/heyreach/accounts/
git commit -m "feat(heyreach): add campaigns and accounts proxy API routes"
```

---

### Task 8: Wire Into Lead Capture Route

**Files:**
- Modify: `src/app/api/public/lead/route.ts`
- Modify: `src/lib/validations/api.ts`
- Modify: `src/lib/types/funnel.ts`

**Step 1: Add `linkedinUrl` to lead capture schema**

In `src/lib/validations/api.ts`, add to `leadCaptureSchema`:

```typescript
linkedinUrl: z.string().url().max(500).optional(),
```

**Step 2: Update lead insert + add sync call in route.ts**

In `src/app/api/public/lead/route.ts`:

Add import at top:
```typescript
import { syncLeadToHeyReach } from '@/lib/integrations/heyreach/sync';
```

In the POST handler, update the destructuring (around line 97):
```typescript
const { funnelPageId, email, name, utmSource, utmMedium, utmCampaign, fbc, fbp, linkedinUrl } = validation.data;
```

In the lead insert (around line 127), add `linkedin_url`:
```typescript
linkedin_url: linkedinUrl || null,
```

In the `after()` block, after the GoHighLevel sync (after line 303), add:

```typescript
// Sync to HeyReach delivery campaign
await syncLeadToHeyReach({
  userId: funnel.user_id,
  funnelPageId: funnelPageId,
  lead: {
    email: lead.email,
    name: lead.name,
    linkedinUrl: lead.linkedin_url || null,
    utmSource: lead.utm_source,
    utmMedium: lead.utm_medium,
    utmCampaign: lead.utm_campaign,
    isQualified: null,
    qualificationAnswers: null,
  },
  leadMagnetTitle: leadMagnet?.title || '',
  leadMagnetUrl: resourceUrl || '',
  funnelSlug: funnel.slug,
}).catch((err) => logApiError('public/lead/heyreach', err, { leadId: lead.id }));
```

Also add in the PATCH handler's `after()` block (after the GHL sync around line 550):

```typescript
// Sync to HeyReach (with qualification data)
await syncLeadToHeyReach({
  userId: lead.user_id,
  funnelPageId: lead.funnel_page_id,
  lead: {
    email: lead.email,
    name: lead.name,
    linkedinUrl: updatedLead.linkedin_url || null,
    utmSource: updatedLead.utm_source,
    utmMedium: updatedLead.utm_medium,
    utmCampaign: updatedLead.utm_campaign,
    isQualified,
    qualificationAnswers: answers,
  },
  leadMagnetTitle: leadMagnetTitle || '',
  leadMagnetUrl: '', // URL already sent on initial capture
  funnelSlug: funnel?.slug || '',
}).catch((err) => logApiError('public/lead/heyreach-qualified', err, { leadId: lead.id }));
```

**Step 3: Update FunnelLeadRow type**

In `src/lib/types/funnel.ts`, add to `FunnelLeadRow` interface:

```typescript
linkedin_url: string | null;
heyreach_delivery_status: string | null;
```

And update the `funnelLeadFromRow` function to include:

```typescript
linkedinUrl: row.linkedin_url,
heyreachDeliveryStatus: row.heyreach_delivery_status,
```

**Step 4: Update VALID_FUNNEL_PROVIDERS**

In `src/app/api/funnels/[id]/integrations/route.ts` line 16, add `'heyreach'`:

```typescript
const VALID_FUNNEL_PROVIDERS = ['kit', 'mailerlite', 'mailchimp', 'activecampaign', 'gohighlevel', 'heyreach'] as const;
```

**Step 5: Commit**

```bash
git add src/app/api/public/lead/route.ts src/lib/validations/api.ts src/lib/types/funnel.ts src/app/api/funnels/[id]/integrations/route.ts
git commit -m "feat(heyreach): wire sync into lead capture pipeline"
```

---

### Task 9: Opt-In Page — Capture LinkedIn URL from Query Param

**Files:**
- Modify: `src/components/funnel/public/OptinPage.tsx` (or wherever the opt-in form submits)

**Step 1: Find the opt-in form component**

Search for where `POST /api/public/lead` is called from the frontend. It's likely in `OptinPage.tsx`.

**Step 2: Read the `li` param from URL on page load**

In the opt-in page component, read the `li` query parameter:

```typescript
const searchParams = useSearchParams();
const linkedinUrl = searchParams.get('li') || undefined;
```

**Step 3: Include it in the form submission**

When POSTing to `/api/public/lead`, add `linkedinUrl` to the body:

```typescript
body: JSON.stringify({
  funnelPageId,
  email,
  name,
  utmSource,
  utmMedium,
  utmCampaign,
  linkedinUrl,  // from ?li= param
}),
```

**Step 4: Commit**

```bash
git add src/components/funnel/public/OptinPage.tsx
git commit -m "feat(heyreach): capture LinkedIn URL from li query param on opt-in"
```

---

### Task 10: Settings UI — HeyReach Connection

**Files:**
- Create: `src/components/settings/HeyReachSettings.tsx`
- Modify: Settings page to include the component

This mirrors `GoHighLevelSettings.tsx` with one addition: a "variable reference" section showing users what `{variables}` to use in their HeyReach campaign templates.

**Step 1: Create the component**

`src/components/settings/HeyReachSettings.tsx`:

Follow the exact pattern of `GoHighLevelSettings.tsx` (lines 1-272), replacing:
- `GoHighLevel` → `HeyReach`
- `gohighlevel` → `heyreach`
- Icon: `Building2` → `LinkedinIcon` (or `MessageSquare` from lucide-react)
- Description: "Push leads to your CRM" → "Deliver lead magnets via LinkedIn DM campaigns"
- API key hint: "Find your API key in HeyReach under Settings → Integrations → API."
- Add a small "Variable Reference" section (visible when connected):

```tsx
<div className="mt-3 rounded-md bg-muted/50 p-3">
  <p className="text-xs font-medium mb-1">Template Variables</p>
  <p className="text-xs text-muted-foreground">
    Use these in your HeyReach campaign message templates:
  </p>
  <div className="mt-1 space-y-0.5 font-mono text-xs text-muted-foreground">
    <p>{'{lead_magnet_title}'} — Lead magnet name</p>
    <p>{'{lead_magnet_url}'} — Content delivery URL</p>
    <p>{'{utm_source}'} — UTM source</p>
  </div>
</div>
```

**Step 2: Add to settings page**

Find the settings page that renders `GoHighLevelSettings` and add `HeyReachSettings` alongside it. Pass `isConnected` and `lastVerifiedAt` props the same way.

**Step 3: Commit**

```bash
git add src/components/settings/HeyReachSettings.tsx
git add -u  # settings page modification
git commit -m "feat(heyreach): add HeyReach settings UI component"
```

---

### Task 11: Funnel Integration Tab — HeyReach Toggle + Campaign Selector

**Files:**
- Modify: `src/components/funnel/FunnelIntegrationsTab.tsx`

**Step 1: Add HeyReach section**

Mirror the `GHLFunnelToggle` component pattern. Create a `HeyReachFunnelToggle` component inside the same file (or a new one) that:

1. Checks if HeyReach is connected (fetch `/api/integrations/heyreach/status`)
2. If connected, shows:
   - Active/inactive toggle
   - Campaign dropdown (fetched from `/api/integrations/heyreach/campaigns`)
   - Auto-generated funnel link with `?li={linkedinUrl}` placeholder shown as copyable text
3. On save, POSTs to `/api/funnels/[id]/integrations` with:
   ```json
   {
     "provider": "heyreach",
     "is_active": true,
     "settings": { "campaign_id": 12345 }
   }
   ```

**Step 2: Add to FunnelIntegrationsTab render**

In the main `FunnelIntegrationsTab` component, add a "LinkedIn Delivery" section after the CRM section:

```tsx
{/* LinkedIn Delivery Section */}
<HeyReachFunnelToggle
  funnelPageId={funnelPageId}
  leadMagnetTitle={leadMagnetTitle}
  funnelSlug={funnelSlug}
  username={username}
/>
```

**Step 3: Commit**

```bash
git add src/components/funnel/FunnelIntegrationsTab.tsx
git commit -m "feat(heyreach): add campaign selector to funnel integrations tab"
```

---

### Task 12: API Route Tests

**Files:**
- Create: `src/__tests__/api/integrations/heyreach.test.ts`

**Step 1: Write route tests**

Test the connect, verify, status, and disconnect routes following the pattern in `src/__tests__/api/external-resources/route.test.ts`:

- Test 401 for unauthenticated requests
- Test 422 for invalid API key (connect)
- Test success path for connect
- Test success path for verify
- Test disconnect deactivates funnel integrations

**Step 2: Run tests**

Run: `npx jest src/__tests__/api/integrations/heyreach.test.ts --no-coverage`

**Step 3: Commit**

```bash
git add src/__tests__/api/integrations/heyreach.test.ts
git commit -m "test(heyreach): add API route tests"
```

---

### Task 13: Typecheck & Full Test Run

**Step 1: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

Fix any type errors that arise.

**Step 2: Run all tests**

Run: `npm run test`
Expected: All tests pass

**Step 3: Commit any fixes**

```bash
git add -u
git commit -m "fix(heyreach): resolve type errors and test issues"
```

---

### Task 14: Update CLAUDE.md

**Files:**
- Modify: `/Users/timlife/Documents/claude code/magnetlab/CLAUDE.md`

**Step 1: Add HeyReach section**

Add a "HeyReach LinkedIn Delivery Integration" section after the GoHighLevel section, documenting:

- Data flow (LinkedIn DM → ?li= param → opt-in → sync)
- API routes
- Key files
- Custom variables
- Settings

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add HeyReach integration to CLAUDE.md"
```
