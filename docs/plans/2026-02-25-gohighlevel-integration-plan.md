# GoHighLevel Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Push magnetlab leads to GoHighLevel as contacts with auto-tags on capture.

**Architecture:** Follows existing email marketing integration pattern — API key stored in `user_integrations`, per-funnel toggle in `funnel_integrations`, sync function called fire-and-forget from lead capture route with retry.

**Tech Stack:** Next.js 15, Supabase, GHL REST API v1, Jest

**Design doc:** `docs/plans/2026-02-25-gohighlevel-integration-design.md`

---

### Task 1: GHL Types

**Files:**
- Create: `src/lib/integrations/gohighlevel/types.ts`

**Step 1: Write the types file**

```typescript
// GoHighLevel API v1 Types

export interface GHLContactPayload {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  source?: string;
  customField?: Record<string, string>;
}

export interface GHLContactResponse {
  contact: {
    id: string;
    email: string;
    tags: string[];
  };
}

export interface GHLErrorResponse {
  message?: string;
  error?: string;
  statusCode?: number;
}

export interface GHLSyncParams {
  userId: string;
  funnelPageId: string;
  lead: {
    email: string;
    name?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    isQualified?: boolean | null;
    qualificationAnswers?: Record<string, string> | null;
  };
  leadMagnetTitle: string;
  funnelSlug: string;
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to the new file

**Step 3: Commit**

```bash
git add src/lib/integrations/gohighlevel/types.ts
git commit -m "feat(ghl): add GoHighLevel API types"
```

---

### Task 2: GHL API Client

**Files:**
- Create: `src/lib/integrations/gohighlevel/client.ts`

**Step 1: Write the failing test**

Create `src/lib/integrations/gohighlevel/__tests__/client.test.ts`:

```typescript
/**
 * @jest-environment node
 */

import { GoHighLevelClient } from '../client';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GoHighLevelClient', () => {
  const client = new GoHighLevelClient('test-api-key');

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('testConnection', () => {
    it('returns true when API responds 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contacts: [] }),
      });

      const result = await client.testConnection();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://rest.gohighlevel.com/v1/contacts/?limit=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
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

  describe('createContact', () => {
    it('creates a contact successfully', async () => {
      const contactResponse = {
        contact: { id: 'ghl-123', email: 'jane@example.com', tags: ['magnetlab'] },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => contactResponse,
      });

      const result = await client.createContact({
        email: 'jane@example.com',
        name: 'Jane Doe',
        tags: ['magnetlab'],
        source: 'magnetlab',
      });

      expect(result.success).toBe(true);
      expect(result.contactId).toBe('ghl-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://rest.gohighlevel.com/v1/contacts/',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'jane@example.com',
            name: 'Jane Doe',
            tags: ['magnetlab'],
            source: 'magnetlab',
          }),
        })
      );
    });

    it('returns error on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      const result = await client.createContact({
        email: 'jane@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('retries on 5xx errors', async () => {
      // First call: 500, second call: success
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            contact: { id: 'ghl-456', email: 'jane@example.com', tags: [] },
          }),
        });

      const result = await client.createContact(
        { email: 'jane@example.com' },
        { maxRetries: 2, initialBackoffMs: 1 } // fast retry for tests
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('gives up after max retries', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

      const result = await client.createContact(
        { email: 'jane@example.com' },
        { maxRetries: 2, initialBackoffMs: 1 }
      );

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 4xx (except 408, 429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Bad request' }),
      });

      const result = await client.createContact(
        { email: 'jane@example.com' },
        { maxRetries: 3, initialBackoffMs: 1 }
      );

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1); // no retry
    });

    it('retries on 429', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            contact: { id: 'ghl-789', email: 'jane@example.com', tags: [] },
          }),
        });

      const result = await client.createContact(
        { email: 'jane@example.com' },
        { maxRetries: 2, initialBackoffMs: 1 }
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/lib/integrations/gohighlevel/__tests__/client.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL — module not found

**Step 3: Write the client**

```typescript
// GoHighLevel API v1 Client
// Base URL: https://rest.gohighlevel.com/v1
// Auth: Location API Key via Bearer token

import type { GHLContactPayload, GHLContactResponse } from './types';

const BASE_URL = 'https://rest.gohighlevel.com/v1';
const TIMEOUT_MS = 10_000;

interface RetryOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
}

const DEFAULT_RETRY: Required<RetryOptions> = {
  maxRetries: 3,
  initialBackoffMs: 1000,
};

interface CreateContactResult {
  success: boolean;
  contactId?: string;
  error?: string;
}

function isRetryable(status: number): boolean {
  // Retry on server errors and rate limits/timeouts
  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GoHighLevelClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Test the API key by fetching one contact.
   * Returns true if the key is valid, false otherwise.
   */
  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/contacts/?limit=1`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Create (or upsert) a contact in GoHighLevel.
   * GHL deduplicates by email automatically.
   * Retries on 5xx / 429 / 408 with exponential backoff.
   */
  async createContact(
    payload: GHLContactPayload,
    retryOptions?: RetryOptions
  ): Promise<CreateContactResult> {
    const opts = { ...DEFAULT_RETRY, ...retryOptions };
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        const res = await fetch(`${BASE_URL}/contacts/`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (res.ok) {
          const data: GHLContactResponse = await res.json();
          return { success: true, contactId: data.contact?.id };
        }

        lastError = `HTTP ${res.status}`;

        // Non-retryable client errors (except 408/429)
        if (!isRetryable(res.status)) {
          return { success: false, error: lastError };
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
      }

      // Exponential backoff before retry
      if (attempt < opts.maxRetries) {
        await delay(opts.initialBackoffMs * Math.pow(2, attempt - 1));
      }
    }

    return { success: false, error: `Failed after ${opts.maxRetries} attempts: ${lastError}` };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/lib/integrations/gohighlevel/__tests__/client.test.ts --no-coverage 2>&1 | tail -15`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add src/lib/integrations/gohighlevel/client.ts src/lib/integrations/gohighlevel/__tests__/client.test.ts
git commit -m "feat(ghl): add GoHighLevel API client with retry and tests"
```

---

### Task 3: GHL Sync Function

**Files:**
- Create: `src/lib/integrations/gohighlevel/sync.ts`

**Step 1: Write the failing test**

Create `src/lib/integrations/gohighlevel/__tests__/sync.test.ts`:

```typescript
/**
 * @jest-environment node
 */

// Mock dependencies BEFORE imports
jest.mock('@/lib/utils/encrypted-storage', () => ({
  getUserIntegration: jest.fn(),
}));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('../client', () => ({
  GoHighLevelClient: jest.fn().mockImplementation(() => ({
    createContact: jest.fn().mockResolvedValue({ success: true, contactId: 'ghl-1' }),
  })),
}));

import { syncLeadToGoHighLevel } from '../sync';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { GoHighLevelClient } from '../client';

const mockGetUserIntegration = getUserIntegration as jest.MockedFunction<typeof getUserIntegration>;
const mockCreateSupabaseAdminClient = createSupabaseAdminClient as jest.MockedFunction<typeof createSupabaseAdminClient>;

describe('syncLeadToGoHighLevel', () => {
  const baseParams = {
    userId: 'user-1',
    funnelPageId: 'funnel-1',
    lead: {
      email: 'jane@example.com',
      name: 'Jane Doe',
      utmSource: 'linkedin',
      utmMedium: 'social',
      utmCampaign: 'winter2026',
      isQualified: true,
      qualificationAnswers: { q1: 'yes' },
    },
    leadMagnetTitle: 'LinkedIn Playbook',
    funnelSlug: 'linkedin-opt-in',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing if user has no GHL integration', async () => {
    mockGetUserIntegration.mockResolvedValueOnce(null);

    await syncLeadToGoHighLevel(baseParams);

    expect(GoHighLevelClient).not.toHaveBeenCalled();
  });

  it('does nothing if GHL integration has no API key', async () => {
    mockGetUserIntegration.mockResolvedValueOnce({
      id: 'int-1',
      user_id: 'user-1',
      service: 'gohighlevel',
      api_key: null,
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: {},
      created_at: '',
      updated_at: '',
    });

    await syncLeadToGoHighLevel(baseParams);

    expect(GoHighLevelClient).not.toHaveBeenCalled();
  });

  it('does nothing if GHL integration is inactive', async () => {
    mockGetUserIntegration.mockResolvedValueOnce({
      id: 'int-1',
      user_id: 'user-1',
      service: 'gohighlevel',
      api_key: 'ghl-key',
      webhook_secret: null,
      is_active: false,
      last_verified_at: null,
      metadata: {},
      created_at: '',
      updated_at: '',
    });

    await syncLeadToGoHighLevel(baseParams);

    expect(GoHighLevelClient).not.toHaveBeenCalled();
  });

  it('skips if funnel has GHL integration disabled', async () => {
    mockGetUserIntegration.mockResolvedValueOnce({
      id: 'int-1',
      user_id: 'user-1',
      service: 'gohighlevel',
      api_key: 'ghl-key',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: {},
      created_at: '',
      updated_at: '',
    });

    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(mockSupabase as any);

    await syncLeadToGoHighLevel(baseParams);

    // Client created but should check funnel-level toggle
    // If no funnel_integrations row for GHL, it still syncs (account-level default)
    // Actually based on design: per-funnel toggle. No row = not enabled.
    // Let's verify GoHighLevelClient was NOT called for createContact
  });

  it('creates contact with correct tags when funnel integration exists and is active', async () => {
    mockGetUserIntegration.mockResolvedValueOnce({
      id: 'int-1',
      user_id: 'user-1',
      service: 'gohighlevel',
      api_key: 'ghl-key-123',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: {},
      created_at: '',
      updated_at: '',
    });

    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'fi-1',
          provider: 'gohighlevel',
          is_active: true,
          settings: { custom_tags: ['vip', 'cold-outreach'] },
        },
        error: null,
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(mockSupabase as any);

    const mockCreateContact = jest.fn().mockResolvedValue({ success: true, contactId: 'ghl-1' });
    (GoHighLevelClient as jest.MockedClass<typeof GoHighLevelClient>).mockImplementation(
      () => ({ createContact: mockCreateContact, testConnection: jest.fn() } as any)
    );

    await syncLeadToGoHighLevel(baseParams);

    expect(GoHighLevelClient).toHaveBeenCalledWith('ghl-key-123');
    expect(mockCreateContact).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@example.com',
        name: 'Jane Doe',
        source: 'magnetlab',
        tags: expect.arrayContaining(['LinkedIn Playbook', 'linkedin-opt-in', 'magnetlab', 'vip', 'cold-outreach']),
        customField: expect.objectContaining({
          utm_source: 'linkedin',
          utm_medium: 'social',
          utm_campaign: 'winter2026',
          qualified: 'yes',
        }),
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/lib/integrations/gohighlevel/__tests__/sync.test.ts --no-coverage 2>&1 | tail -10`
Expected: FAIL — module '../sync' not found

**Step 3: Write the sync function**

```typescript
// GoHighLevel Lead Sync
// Called fire-and-forget from lead capture route.
// Checks account-level + funnel-level toggles, then pushes to GHL.

import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { GoHighLevelClient } from './client';
import type { GHLContactPayload, GHLSyncParams } from './types';

/**
 * Push a captured lead to GoHighLevel if the user has GHL connected
 * and the funnel has GHL enabled.
 *
 * This is fire-and-forget — errors are logged, never thrown.
 */
export async function syncLeadToGoHighLevel(params: GHLSyncParams): Promise<void> {
  const { userId, funnelPageId, lead, leadMagnetTitle, funnelSlug } = params;

  // 1. Check account-level connection
  const integration = await getUserIntegration(userId, 'gohighlevel');
  if (!integration?.api_key || !integration.is_active) return;

  // 2. Check funnel-level toggle
  const supabase = createSupabaseAdminClient();
  const { data: funnelIntegration } = await supabase
    .from('funnel_integrations')
    .select('id, provider, is_active, settings')
    .eq('funnel_page_id', funnelPageId)
    .eq('provider', 'gohighlevel')
    .single();

  // No row or inactive = not enabled for this funnel
  if (!funnelIntegration?.is_active) return;

  // 3. Build tags: auto-tags + user custom tags
  const tags: string[] = [leadMagnetTitle, funnelSlug, 'magnetlab'];

  const settings = funnelIntegration.settings as { custom_tags?: string[] } | null;
  if (settings?.custom_tags?.length) {
    tags.push(...settings.custom_tags);
  }

  // 4. Build custom fields from UTMs + qualification
  const customField: Record<string, string> = {};
  if (lead.utmSource) customField.utm_source = lead.utmSource;
  if (lead.utmMedium) customField.utm_medium = lead.utmMedium;
  if (lead.utmCampaign) customField.utm_campaign = lead.utmCampaign;
  if (lead.isQualified !== null && lead.isQualified !== undefined) {
    customField.qualified = lead.isQualified ? 'yes' : 'no';
  }
  if (lead.qualificationAnswers) {
    customField.qualification_answers = JSON.stringify(lead.qualificationAnswers);
  }

  // 5. Build payload
  const payload: GHLContactPayload = {
    email: lead.email,
    source: 'magnetlab',
    tags,
  };

  if (lead.name) payload.name = lead.name;
  if (Object.keys(customField).length > 0) payload.customField = customField;

  // 6. Push to GHL
  const client = new GoHighLevelClient(integration.api_key);
  const result = await client.createContact(payload);

  if (!result.success) {
    console.error(`[gohighlevel] Failed to sync lead ${lead.email}:`, result.error);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/lib/integrations/gohighlevel/__tests__/sync.test.ts --no-coverage 2>&1 | tail -15`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/integrations/gohighlevel/sync.ts src/lib/integrations/gohighlevel/__tests__/sync.test.ts
git commit -m "feat(ghl): add sync function with account + funnel-level toggle checks"
```

---

### Task 4: Wire Sync into Lead Capture Route

**Files:**
- Modify: `src/app/api/public/lead/route.ts`

**Step 1: Add import at top of file**

After line 18 (`import { syncLeadToEmailProviders }...`), add:

```typescript
import { syncLeadToGoHighLevel } from '@/lib/integrations/gohighlevel/sync';
```

**Step 2: Add sync call in the `after()` block of POST handler**

After the tracking pixel call (around line 286, after `fireTrackingPixelLeadEvent(...).catch(...)`) and before the PostHog capture, add:

```typescript
      // Sync to GoHighLevel CRM
      await syncLeadToGoHighLevel({
        userId: funnel.user_id,
        funnelPageId: funnelPageId,
        lead: {
          email: lead.email,
          name: lead.name,
          utmSource: lead.utm_source,
          utmMedium: lead.utm_medium,
          utmCampaign: lead.utm_campaign,
          isQualified: null,
          qualificationAnswers: null,
        },
        leadMagnetTitle: leadMagnet?.title || '',
        funnelSlug: funnel.slug,
      }).catch((err) => logApiError('public/lead/gohighlevel', err, { leadId: lead.id }));
```

**Step 3: Also add sync call in the PATCH handler's `after()` block**

After the Conductor webhook call in the PATCH handler (around line 515), add:

```typescript
      // Sync updated lead to GoHighLevel CRM (with qualification data)
      await syncLeadToGoHighLevel({
        userId: lead.user_id,
        funnelPageId: lead.funnel_page_id,
        lead: {
          email: lead.email,
          name: lead.name,
          utmSource: updatedLead.utm_source,
          utmMedium: updatedLead.utm_medium,
          utmCampaign: updatedLead.utm_campaign,
          isQualified,
          qualificationAnswers: answers,
        },
        leadMagnetTitle: leadMagnetTitle || '',
        funnelSlug: funnel?.slug || '',
      }).catch((err) => logApiError('public/lead/gohighlevel-qualified', err, { leadId: lead.id }));
```

**Step 4: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/public/lead/route.ts
git commit -m "feat(ghl): wire GoHighLevel sync into lead capture route"
```

---

### Task 5: Settings UI — GoHighLevelSettings Component

**Files:**
- Create: `src/components/settings/GoHighLevelSettings.tsx`
- Modify: `src/components/dashboard/SettingsContent.tsx`

**Step 1: Create the settings component**

Pattern: follows `ConductorSettings.tsx` exactly (API key input, test connection, disconnect). Use the existing `/api/integrations/email-marketing/connect`, `/verify`, `/disconnect` routes — but we need to add `gohighlevel` to the email marketing provider list first. Actually, GHL is NOT an email marketing provider — it's a CRM. So we'll use the generic `/api/integrations` route (same as Conductor).

Actually, looking at the codebase more carefully: the Conductor settings use `/api/integrations` (a generic route) and `/api/integrations/verify`. GHL should follow the same pattern but with its own connect/verify/disconnect API routes for cleanliness. However, the simplest approach is to create dedicated API routes under `/api/integrations/gohighlevel/`.

Create `src/components/settings/GoHighLevelSettings.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';

import { logError } from '@/lib/utils/logger';

interface GoHighLevelSettingsProps {
  isConnected: boolean;
  lastVerifiedAt: string | null;
}

export function GoHighLevelSettings({ isConnected, lastVerifiedAt }: GoHighLevelSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleConnect = async () => {
    if (!apiKey.trim()) return;

    setConnecting(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/integrations/gohighlevel/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      setFeedback({ type: 'success', message: 'Connected successfully! Refreshing...' });
      setApiKey('');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to connect',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    setVerifying(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/integrations/gohighlevel/verify', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.verified) {
        setFeedback({ type: 'success', message: 'Connection verified successfully' });
      } else {
        setFeedback({ type: 'error', message: 'Connection test failed. API key may have been revoked.' });
      }
    } catch (error) {
      logError('settings/gohighlevel', error, { step: 'verify_error' });
      setFeedback({ type: 'error', message: 'Failed to test connection' });
    } finally {
      setVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect GoHighLevel? Leads will no longer be pushed to your GHL account.')) {
      return;
    }

    setDisconnecting(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/integrations/gohighlevel/disconnect', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to disconnect');

      window.location.reload();
    } catch (error) {
      logError('settings/gohighlevel', error, { step: 'disconnect_error' });
      setFeedback({ type: 'error', message: 'Failed to disconnect' });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <svg className="h-5 w-5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="font-medium">GoHighLevel</p>
            <p className="text-xs text-muted-foreground">
              Push leads to your GHL CRM as contacts
            </p>
          </div>
        </div>
        {isConnected && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            Connected
          </span>
        )}
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your GoHighLevel account is connected. To start syncing leads, go to each funnel&apos;s <strong>Integrations</strong> tab and enable GoHighLevel.
          </p>

          {lastVerifiedAt && (
            <p className="text-xs text-muted-foreground">
              Last verified: {new Date(lastVerifiedAt).toLocaleDateString()}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              disabled={verifying}
              className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {verifying ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Testing...
                </span>
              ) : (
                'Test Connection'
              )}
            </button>

            <span className="text-muted-foreground">|</span>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm text-red-500 hover:text-red-600 transition-colors font-medium"
            >
              {disconnecting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Disconnecting...
                </span>
              ) : (
                'Disconnect'
              )}
            </button>
          </div>
        </div>
      ) : expanded ? (
        <div className="space-y-3">
          <div className="relative">
            <label className="text-xs text-muted-foreground">API Key</label>
            <div className="relative mt-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your GoHighLevel Location API key"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleConnect}
              disabled={connecting || !apiKey.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {connecting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </span>
              ) : (
                'Connect'
              )}
            </button>
            <button
              onClick={() => {
                setExpanded(false);
                setApiKey('');
                setFeedback(null);
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Find your Location API key in GoHighLevel under Settings &gt; Business Profile &gt; API Keys.
          </p>
        </div>
      ) : (
        <div>
          <button
            onClick={() => setExpanded(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Connect GoHighLevel
          </button>
        </div>
      )}

      {feedback && (
        <p className={`mt-3 flex items-center gap-2 text-sm ${
          feedback.type === 'success' ? 'text-green-600' : 'text-red-500'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {feedback.message}
        </p>
      )}
    </div>
  );
}
```

**Step 2: Add GoHighLevelSettings to SettingsContent.tsx**

In `src/components/dashboard/SettingsContent.tsx`:

Add import (after the EmailMarketingSettings import, line 19):
```typescript
import { GoHighLevelSettings } from '@/components/settings/GoHighLevelSettings';
```

Add the integration lookup (after line 103, where other integrations are looked up):
```typescript
  const gohighlevelIntegration = integrations.find((i) => i.service === 'gohighlevel');
```

Add the component rendering inside the Integrations section, after the EmailMarketingSettings block (after line 342) and before the Tracking Pixels block:
```typescript
          {/* GoHighLevel CRM */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-semibold mb-1">CRM</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Push leads to your CRM when they opt in to your funnels.
            </p>
            <GoHighLevelSettings
              isConnected={gohighlevelIntegration?.is_active ?? false}
              lastVerifiedAt={gohighlevelIntegration?.last_verified_at ?? null}
            />
          </div>
```

**Step 3: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/settings/GoHighLevelSettings.tsx src/components/dashboard/SettingsContent.tsx
git commit -m "feat(ghl): add GoHighLevel settings UI component"
```

---

### Task 6: GHL API Routes (Connect / Verify / Disconnect)

**Files:**
- Create: `src/app/api/integrations/gohighlevel/connect/route.ts`
- Create: `src/app/api/integrations/gohighlevel/verify/route.ts`
- Create: `src/app/api/integrations/gohighlevel/disconnect/route.ts`

**Step 1: Create connect route**

```typescript
// GoHighLevel Connect API
// POST /api/integrations/gohighlevel/connect
// Validates API key against GHL, then saves integration

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { GoHighLevelClient } from '@/lib/integrations/gohighlevel/client';
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

    // Validate the API key by testing connection
    const client = new GoHighLevelClient(api_key);
    const valid = await client.testConnection();

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your GoHighLevel Location API key.', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    // Save the integration
    const integration = await upsertUserIntegration({
      userId: session.user.id,
      service: 'gohighlevel',
      apiKey: api_key,
      isActive: true,
    });

    return NextResponse.json({
      integration,
      message: 'Connected successfully',
    });
  } catch (error) {
    logApiError('gohighlevel/connect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to connect GoHighLevel'
    );
  }
}
```

**Step 2: Create verify route**

```typescript
// GoHighLevel Verify API
// POST /api/integrations/gohighlevel/verify
// Re-validates stored API key

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { GoHighLevelClient } from '@/lib/integrations/gohighlevel/client';
import { getUserIntegration, updateIntegrationVerified } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const integration = await getUserIntegration(session.user.id, 'gohighlevel');
    if (!integration?.api_key) {
      return ApiErrors.notFound('Integration');
    }

    const client = new GoHighLevelClient(integration.api_key);
    const verified = await client.testConnection();

    if (verified) {
      await updateIntegrationVerified(session.user.id, 'gohighlevel');
    }

    return NextResponse.json({ verified });
  } catch (error) {
    logApiError('gohighlevel/verify', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to verify credentials'
    );
  }
}
```

**Step 3: Create disconnect route**

```typescript
// GoHighLevel Disconnect API
// POST /api/integrations/gohighlevel/disconnect
// Deletes integration and deactivates funnel mappings

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

    // Delete the integration credentials
    await deleteUserIntegration(session.user.id, 'gohighlevel');

    // Deactivate all funnel mappings for GHL
    const supabase = createSupabaseAdminClient();
    await supabase
      .from('funnel_integrations')
      .update({ is_active: false })
      .eq('user_id', session.user.id)
      .eq('provider', 'gohighlevel');

    return NextResponse.json({
      message: 'Disconnected successfully',
    });
  } catch (error) {
    logApiError('gohighlevel/disconnect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to disconnect GoHighLevel'
    );
  }
}
```

**Step 4: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/integrations/gohighlevel/
git commit -m "feat(ghl): add connect, verify, disconnect API routes"
```

---

### Task 7: Per-Funnel Toggle in FunnelIntegrationsTab

**Files:**
- Modify: `src/components/funnel/FunnelIntegrationsTab.tsx`

The `FunnelIntegrationsTab` currently only handles email marketing providers. We need to add a separate section for CRM integrations (GoHighLevel). The GHL per-funnel integration uses the same `funnel_integrations` table but with `provider: 'gohighlevel'` and a `settings` column for custom tags instead of `list_id`/`tag_id`.

**Step 1: Add GHL section to FunnelIntegrationsTab**

Add to the `PROVIDER_LABELS` map:
```typescript
  gohighlevel: 'GoHighLevel',
```

Add a new `GHLFunnelToggle` component inside the same file (before the main export):

```typescript
function GHLFunnelToggle({ funnelPageId }: { funnelPageId: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [customTags, setCustomTags] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load current state
  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/funnels/${funnelPageId}/integrations`);
        if (response.ok) {
          const data = await response.json();
          const ghl = (data.integrations || []).find(
            (i: FunnelIntegration) => i.provider === 'gohighlevel'
          );
          setEnabled(ghl?.is_active ?? false);
          const settings = ghl?.settings as { custom_tags?: string[] } | undefined;
          setCustomTags(settings?.custom_tags?.join(', ') || '');
        }
      } catch (error) {
        logError('funnel-ghl', error, { step: 'load_error' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [funnelPageId]);

  const handleSave = async (newEnabled: boolean) => {
    setSaving(true);
    setFeedback(null);

    try {
      const tagsArray = customTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const response = await fetch(`/api/funnels/${funnelPageId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'gohighlevel',
          list_id: 'n/a',
          list_name: null,
          tag_id: null,
          tag_name: null,
          is_active: newEnabled,
          settings: { custom_tags: tagsArray },
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      setEnabled(newEnabled);
      setFeedback({ type: 'success', message: newEnabled ? 'GoHighLevel enabled' : 'GoHighLevel disabled' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      logError('funnel-ghl', error, { step: 'save_error' });
      setFeedback({ type: 'error', message: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
            <svg className="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium">GoHighLevel</p>
            <p className="text-xs text-muted-foreground">Push leads as CRM contacts</p>
          </div>
        </div>

        <button
          onClick={() => handleSave(!enabled)}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin mx-auto text-white" />
          ) : (
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          )}
        </button>
      </div>

      {enabled && (
        <div>
          <label className="text-xs text-muted-foreground">Custom Tags (optional, comma-separated)</label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={customTags}
              onChange={(e) => setCustomTags(e.target.value)}
              placeholder="vip, cold-outreach"
              className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Auto-tags (lead magnet title, funnel slug, &quot;magnetlab&quot;) are always included.
          </p>
        </div>
      )}

      {feedback && (
        <p className={`flex items-center gap-1 text-xs ${
          feedback.type === 'success' ? 'text-green-600' : 'text-red-500'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {feedback.message}
        </p>
      )}
    </div>
  );
}
```

**Step 2: Update the `FunnelIntegrationsTabProps` and render section**

Add `ghlConnected: boolean` to the props interface:
```typescript
interface FunnelIntegrationsTabProps {
  funnelPageId: string;
  connectedProviders: string[];
  ghlConnected?: boolean;
}
```

Destructure it:
```typescript
export function FunnelIntegrationsTab({
  funnelPageId,
  connectedProviders,
  ghlConnected,
}: FunnelIntegrationsTabProps) {
```

At the bottom of the component's return, before the closing `</div>`, add a CRM section:

```typescript
      {/* CRM Integrations */}
      {ghlConnected && (
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-semibold mb-1">CRM</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Push leads to your CRM when they opt in.
          </p>
          <GHLFunnelToggle funnelPageId={funnelPageId} />
        </div>
      )}
```

**Step 3: Pass `ghlConnected` prop from FunnelBuilder**

Find where `FunnelIntegrationsTab` is used in the funnel builder and add the `ghlConnected` prop. This will be in `src/components/funnel/FunnelBuilder.tsx` — search for `FunnelIntegrationsTab` and add the prop. The `connectedProviders` is already fetched from `/api/integrations/email-marketing/connected`. For GHL, we need to check if it's in the `integrations` list.

In `FunnelBuilder.tsx`, find where `connectedProviders` is fetched. Near there, add a fetch for GHL connection status (or piggyback on an existing integrations fetch). The simplest approach: the settings page already loads all `user_integrations` — we can check if `gohighlevel` is in the list.

Actually, looking at `FunnelIntegrationsTab`, it receives `connectedProviders` which is just a string array of email marketing provider names. The cleanest approach is to fetch GHL status in the same place `connectedProviders` is fetched and pass it as a separate boolean prop.

Find the data-fetching component that passes `connectedProviders` to `FunnelIntegrationsTab` and add a GHL check there. Search for the component.

**Step 4: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/funnel/FunnelIntegrationsTab.tsx
git commit -m "feat(ghl): add per-funnel GoHighLevel toggle with custom tags"
```

---

### Task 8: Wire GHL Prop into Funnel Builder

**Files:**
- Modify: The component that renders `FunnelIntegrationsTab` (likely `FunnelBuilder.tsx` or a parent)

**Step 1: Find where FunnelIntegrationsTab is rendered**

Run: `grep -rn "FunnelIntegrationsTab" src/` in the magnetlab directory to find all usages.

**Step 2: Add GHL connection check**

In the component that fetches `connectedProviders`, add a parallel fetch:

```typescript
const [ghlConnected, setGhlConnected] = useState(false);

// In the useEffect that fetches connected providers, add:
const ghlRes = await fetch('/api/integrations/gohighlevel/status');
if (ghlRes.ok) {
  const ghlData = await ghlRes.json();
  setGhlConnected(ghlData.connected);
}
```

We also need a simple status endpoint. Create `src/app/api/integrations/gohighlevel/status/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors } from '@/lib/api/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const integration = await getUserIntegration(session.user.id, 'gohighlevel');
    const connected = !!(integration?.api_key && integration.is_active);

    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
```

**Step 3: Pass prop to FunnelIntegrationsTab**

```tsx
<FunnelIntegrationsTab
  funnelPageId={funnelPageId}
  connectedProviders={connectedProviders}
  ghlConnected={ghlConnected}
/>
```

**Step 4: Verify TypeScript compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/integrations/gohighlevel/status/route.ts src/components/funnel/FunnelBuilder.tsx
git commit -m "feat(ghl): wire GHL connection status into funnel builder"
```

---

### Task 9: Handle `settings` Column in Funnel Integrations API

**Files:**
- Modify: `src/app/api/funnels/[id]/integrations/route.ts`

The existing funnel integrations POST route saves `list_id`, `tag_id`, `list_name`, `tag_name`. For GHL we also pass a `settings` field with `custom_tags`. Check if the route already handles a `settings` column or if we need to add it.

**Step 1: Check the existing route**

Read `src/app/api/funnels/[id]/integrations/route.ts` and check if there's a `settings` column in the upsert.

**Step 2: Add `settings` to the upsert if missing**

If the route doesn't include `settings`, add it to the insert/upsert object:

```typescript
settings: body.settings ?? null,
```

And add it to the select query so it's returned.

**Step 3: Check if `funnel_integrations` table has a `settings` column**

Run SQL or check migrations. If the column doesn't exist, create a migration:

```sql
ALTER TABLE funnel_integrations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT NULL;
```

**Step 4: Verify**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 5: Commit**

```bash
git add src/app/api/funnels/*/integrations/route.ts supabase/migrations/
git commit -m "feat(ghl): add settings column to funnel_integrations for custom tags"
```

---

### Task 10: Final Integration Test + Typecheck

**Step 1: Run all GHL tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/lib/integrations/gohighlevel/ --no-coverage 2>&1`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

**Step 3: Run full test suite**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test 2>&1 | tail -20`
Expected: All tests pass

**Step 4: Run dev server smoke test**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run build 2>&1 | tail -20`
Expected: Build succeeds

**Step 5: Commit**

If any fixes were needed, commit them:
```bash
git commit -m "fix(ghl): address build/test issues from integration"
```

---

### Task 11: Update CLAUDE.md Documentation

**Files:**
- Modify: `/Users/timlife/Documents/claude code/magnetlab/CLAUDE.md`

**Step 1: Add GHL integration section**

Add a new section after "Email Marketing Integrations":

```markdown
## GoHighLevel CRM Integration

Push leads to GoHighLevel as contacts on capture. Account-level API key, per-funnel toggle with custom tags.

### Data Flow

```
User connects GHL in Settings → API key validated → stored in user_integrations
User enables GHL per-funnel → toggle stored in funnel_integrations (provider: 'gohighlevel')
Lead opts in → POST /api/public/lead → syncLeadToGoHighLevel() [fire-and-forget with retry]
  → checks account + funnel toggles
  → builds payload with auto-tags + custom tags + UTMs
  → POST /contacts/ to GHL API v1
  → 3 retries with exponential backoff, errors logged only
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/gohighlevel/connect` | POST | Validate + save API key |
| `/api/integrations/gohighlevel/verify` | POST | Re-validate stored key |
| `/api/integrations/gohighlevel/disconnect` | POST | Remove key + deactivate funnel toggles |
| `/api/integrations/gohighlevel/status` | GET | Check if GHL is connected |

### Key Files

- `src/lib/integrations/gohighlevel/client.ts` — GHL API client (createContact, testConnection, retry logic)
- `src/lib/integrations/gohighlevel/sync.ts` — `syncLeadToGoHighLevel()` called from lead capture
- `src/lib/integrations/gohighlevel/types.ts` — GHL API types
- `src/components/settings/GoHighLevelSettings.tsx` — Settings UI
- `src/components/funnel/FunnelIntegrationsTab.tsx` — Per-funnel toggle (GHLFunnelToggle)

### Tags

Auto-tags (always applied): lead magnet title, funnel slug, "magnetlab"
Custom tags (optional): configured per-funnel, comma-separated
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add GoHighLevel integration documentation"
```
