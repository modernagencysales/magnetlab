# Email Marketing Integrations — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Native email marketing integrations (Kit, MailerLite, Mailchimp, ActiveCampaign) that auto-subscribe funnel leads to the user's ESP list with optional tag.

**Architecture:** Provider module pattern — each ESP implements a shared `EmailMarketingProvider` interface. Global connection stored in `user_integrations`, per-funnel mapping in new `funnel_integrations` table. Lead capture hook fires subscribe calls fire-and-forget.

**Tech Stack:** Next.js 15 API routes, Supabase (RLS), existing `encrypted-storage.ts` helpers, Mailchimp OAuth 2.0

**Design doc:** `docs/plans/2026-02-20-email-marketing-integrations-design.md`

---

## Provider API Quick Reference

| Provider | Auth Header | Base URL | Subscribe calls |
|----------|------------|----------|-----------------|
| Kit | `X-Kit-Api-Key: {key}` | `https://api.kit.com/v4` | 1 (form) + 1 (tag, optional) |
| MailerLite | `Authorization: Bearer {key}` | `https://connect.mailerlite.com/api` | 1 (POST /subscribers with groups[]) |
| Mailchimp | `Authorization: Bearer {token}` | `https://{dc}.api.mailchimp.com/3.0` | 1 (PUT members/{hash}) + 1 (tags, optional) |
| ActiveCampaign | `Api-Token: {key}` | `https://{account}.api-us1.com/api/3` | 3 (contact + contactLists + contactTags) |

---

## Task 1: Database Migration — `funnel_integrations` Table

**Files:**
- Create: `supabase/migrations/20260220010000_funnel_integrations.sql`

**Step 1: Write the migration**

```sql
-- funnel_integrations: per-funnel email marketing provider mappings
CREATE TABLE IF NOT EXISTS funnel_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_page_id UUID NOT NULL REFERENCES funnel_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('kit', 'mailerlite', 'mailchimp', 'activecampaign')),
  list_id TEXT NOT NULL,
  list_name TEXT,
  tag_id TEXT,
  tag_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(funnel_page_id, provider)
);

-- RLS
ALTER TABLE funnel_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own funnel integrations"
  ON funnel_integrations FOR ALL
  USING (user_id = auth.uid());

-- Index for the lead capture lookup (hot path)
CREATE INDEX idx_funnel_integrations_page_active
  ON funnel_integrations(funnel_page_id)
  WHERE is_active = true;

-- updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON funnel_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

**Step 2: Apply the migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx supabase db push`

If `update_updated_at()` function doesn't exist, check existing migrations for the trigger function name used elsewhere and use that instead. Search with: `grep -r "update_updated_at\|set_updated_at\|moddatetime" supabase/migrations/`

**Step 3: Commit**

```bash
git add supabase/migrations/20260220010000_funnel_integrations.sql
git commit -m "feat: add funnel_integrations table for email marketing provider mappings"
```

---

## Task 2: Provider Interface + Types

**Files:**
- Create: `src/lib/integrations/email-marketing/types.ts`

**Step 1: Write the types file**

```typescript
// src/lib/integrations/email-marketing/types.ts

export type EmailMarketingProviderName = 'kit' | 'mailerlite' | 'mailchimp' | 'activecampaign';

export interface EmailMarketingList {
  id: string;
  name: string;
}

export interface EmailMarketingTag {
  id: string;
  name: string;
}

export interface SubscribeParams {
  listId: string;
  email: string;
  firstName?: string;
  tagId?: string;
}

export interface SubscribeResult {
  success: boolean;
  error?: string;
}

export interface EmailMarketingProvider {
  /** Test that credentials are valid */
  validateCredentials(): Promise<boolean>;

  /** Fetch lists/forms/audiences the user can subscribe leads to */
  getLists(): Promise<EmailMarketingList[]>;

  /** Fetch tags (empty array if provider doesn't support tags) */
  getTags(listId?: string): Promise<EmailMarketingTag[]>;

  /** Subscribe a lead to a list, optionally applying a tag */
  subscribe(params: SubscribeParams): Promise<SubscribeResult>;
}

export interface ProviderCredentials {
  apiKey: string;
  metadata?: Record<string, string>;
}
```

Note: `getTags` takes optional `listId` because Mailchimp tags are per-audience (list-scoped). Kit and ActiveCampaign tags are global.

**Step 2: Commit**

```bash
git add src/lib/integrations/email-marketing/types.ts
git commit -m "feat: add EmailMarketingProvider interface and types"
```

---

## Task 3: Kit Provider Module

**Files:**
- Create: `src/lib/integrations/email-marketing/providers/kit.ts`
- Create: `src/lib/integrations/email-marketing/providers/__tests__/kit.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/integrations/email-marketing/providers/__tests__/kit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KitProvider } from '../kit';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('KitProvider', () => {
  let provider: KitProvider;

  beforeEach(() => {
    provider = new KitProvider({ apiKey: 'test-api-key' });
    mockFetch.mockReset();
  });

  describe('validateCredentials', () => {
    it('returns true when API key is valid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ forms: [] }),
      });

      const result = await provider.validateCredentials();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kit.com/v4/forms?per_page=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Kit-Api-Key': 'test-api-key',
          }),
        })
      );
    });

    it('returns false when API key is invalid', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      const result = await provider.validateCredentials();
      expect(result).toBe(false);
    });
  });

  describe('getLists', () => {
    it('returns forms as lists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          forms: [
            { id: 52, name: 'My Landing Page' },
            { id: 53, name: 'Newsletter' },
          ],
        }),
      });

      const lists = await provider.getLists();
      expect(lists).toEqual([
        { id: '52', name: 'My Landing Page' },
        { id: '53', name: 'Newsletter' },
      ]);
    });
  });

  describe('getTags', () => {
    it('returns tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tags: [
            { id: 17, name: 'Interested' },
            { id: 18, name: 'VIP' },
          ],
        }),
      });

      const tags = await provider.getTags();
      expect(tags).toEqual([
        { id: '17', name: 'Interested' },
        { id: '18', name: 'VIP' },
      ]);
    });
  });

  describe('subscribe', () => {
    it('subscribes to form without tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscriber: { id: 288 } }),
      });

      const result = await provider.subscribe({
        listId: '52',
        email: 'alice@example.com',
        firstName: 'Alice',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kit.com/v4/forms/52/subscribers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email_address: 'alice@example.com', first_name: 'Alice' }),
        })
      );
    });

    it('subscribes to form and applies tag', async () => {
      // First call: subscribe to form
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscriber: { id: 288 } }),
      });
      // Second call: apply tag
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscriber: { id: 288 } }),
      });

      const result = await provider.subscribe({
        listId: '52',
        email: 'alice@example.com',
        tagId: '17',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.kit.com/v4/tags/17/subscribers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email_address: 'alice@example.com' }),
        })
      );
    });

    it('returns error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => 'Invalid email',
      });

      const result = await provider.subscribe({
        listId: '52',
        email: 'bad-email',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/lib/integrations/email-marketing/providers/__tests__/kit.test.ts`

Expected: FAIL — cannot import `KitProvider`

**Step 3: Write the implementation**

```typescript
// src/lib/integrations/email-marketing/providers/kit.ts
import type {
  EmailMarketingProvider,
  EmailMarketingList,
  EmailMarketingTag,
  SubscribeParams,
  SubscribeResult,
  ProviderCredentials,
} from '../types';

const BASE_URL = 'https://api.kit.com/v4';

export class KitProvider implements EmailMarketingProvider {
  private apiKey: string;

  constructor(credentials: ProviderCredentials) {
    this.apiKey = credentials.apiKey;
  }

  private headers(): HeadersInit {
    return {
      'X-Kit-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async validateCredentials(): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/forms?per_page=1`, {
      headers: this.headers(),
    });
    return res.ok;
  }

  async getLists(): Promise<EmailMarketingList[]> {
    const lists: EmailMarketingList[] = [];
    let cursor: string | undefined;

    do {
      const url = cursor
        ? `${BASE_URL}/forms?per_page=100&after=${cursor}`
        : `${BASE_URL}/forms?per_page=100`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) break;

      const data = await res.json();
      for (const form of data.forms ?? []) {
        lists.push({ id: String(form.id), name: form.name });
      }
      cursor = data.pagination?.has_next_page ? data.pagination.end_cursor : undefined;
    } while (cursor);

    return lists;
  }

  async getTags(): Promise<EmailMarketingTag[]> {
    const tags: EmailMarketingTag[] = [];
    let cursor: string | undefined;

    do {
      const url = cursor
        ? `${BASE_URL}/tags?per_page=100&after=${cursor}`
        : `${BASE_URL}/tags?per_page=100`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) break;

      const data = await res.json();
      for (const tag of data.tags ?? []) {
        tags.push({ id: String(tag.id), name: tag.name });
      }
      cursor = data.pagination?.has_next_page ? data.pagination.end_cursor : undefined;
    } while (cursor);

    return tags;
  }

  async subscribe(params: SubscribeParams): Promise<SubscribeResult> {
    // Step 1: Add to form
    const body: Record<string, string> = { email_address: params.email };
    if (params.firstName) body.first_name = params.firstName;

    const res = await fetch(`${BASE_URL}/forms/${params.listId}/subscribers`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Kit subscribe failed (${res.status}): ${text}` };
    }

    // Step 2: Apply tag if provided
    if (params.tagId) {
      const tagRes = await fetch(`${BASE_URL}/tags/${params.tagId}/subscribers`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ email_address: params.email }),
      });

      if (!tagRes.ok) {
        const text = await tagRes.text();
        return { success: false, error: `Kit tag failed (${tagRes.status}): ${text}` };
      }
    }

    return { success: true };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/lib/integrations/email-marketing/providers/__tests__/kit.test.ts`

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/integrations/email-marketing/providers/kit.ts src/lib/integrations/email-marketing/providers/__tests__/kit.test.ts
git commit -m "feat: add Kit (ConvertKit) email marketing provider"
```

---

## Task 4: MailerLite Provider Module

**Files:**
- Create: `src/lib/integrations/email-marketing/providers/mailerlite.ts`
- Create: `src/lib/integrations/email-marketing/providers/__tests__/mailerlite.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/integrations/email-marketing/providers/__tests__/mailerlite.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailerLiteProvider } from '../mailerlite';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MailerLiteProvider', () => {
  let provider: MailerLiteProvider;

  beforeEach(() => {
    provider = new MailerLiteProvider({ apiKey: 'test-ml-key' });
    mockFetch.mockReset();
  });

  describe('validateCredentials', () => {
    it('returns true on valid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });
      expect(await provider.validateCredentials()).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://connect.mailerlite.com/api/groups?limit=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-ml-key',
          }),
        })
      );
    });

    it('returns false on invalid key', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      expect(await provider.validateCredentials()).toBe(false);
    });
  });

  describe('getLists', () => {
    it('returns groups as lists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: '1', name: 'Newsletter' },
            { id: '2', name: 'Leads' },
          ],
          meta: { current_page: 1, last_page: 1 },
        }),
      });

      const lists = await provider.getLists();
      expect(lists).toEqual([
        { id: '1', name: 'Newsletter' },
        { id: '2', name: 'Leads' },
      ]);
    });
  });

  describe('getTags', () => {
    it('returns empty array (MailerLite has no tags)', async () => {
      const tags = await provider.getTags();
      expect(tags).toEqual([]);
    });
  });

  describe('subscribe', () => {
    it('subscribes with group in one call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: '123', email: 'alice@example.com' } }),
      });

      const result = await provider.subscribe({
        listId: '1',
        email: 'alice@example.com',
        firstName: 'Alice',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://connect.mailerlite.com/api/subscribers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'alice@example.com',
            fields: { name: 'Alice' },
            groups: ['1'],
          }),
        })
      );
    });

    it('returns error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => 'Validation failed',
      });

      const result = await provider.subscribe({
        listId: '1',
        email: 'bad',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/lib/integrations/email-marketing/providers/__tests__/mailerlite.test.ts`

Expected: FAIL

**Step 3: Write the implementation**

```typescript
// src/lib/integrations/email-marketing/providers/mailerlite.ts
import type {
  EmailMarketingProvider,
  EmailMarketingList,
  EmailMarketingTag,
  SubscribeParams,
  SubscribeResult,
  ProviderCredentials,
} from '../types';

const BASE_URL = 'https://connect.mailerlite.com/api';

export class MailerLiteProvider implements EmailMarketingProvider {
  private apiKey: string;

  constructor(credentials: ProviderCredentials) {
    this.apiKey = credentials.apiKey;
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async validateCredentials(): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/groups?limit=1`, {
      headers: this.headers(),
    });
    return res.ok;
  }

  async getLists(): Promise<EmailMarketingList[]> {
    const lists: EmailMarketingList[] = [];
    let page = 1;

    do {
      const res = await fetch(`${BASE_URL}/groups?limit=50&page=${page}`, {
        headers: this.headers(),
      });
      if (!res.ok) break;

      const data = await res.json();
      for (const group of data.data ?? []) {
        lists.push({ id: String(group.id), name: group.name });
      }

      if (page >= (data.meta?.last_page ?? 1)) break;
      page++;
    } while (true);

    return lists;
  }

  async getTags(): Promise<EmailMarketingTag[]> {
    // MailerLite doesn't have a native tags API for subscriber tagging
    return [];
  }

  async subscribe(params: SubscribeParams): Promise<SubscribeResult> {
    const body: Record<string, unknown> = {
      email: params.email,
      groups: [params.listId],
    };

    if (params.firstName) {
      body.fields = { name: params.firstName };
    }

    const res = await fetch(`${BASE_URL}/subscribers`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `MailerLite subscribe failed (${res.status}): ${text}` };
    }

    return { success: true };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/lib/integrations/email-marketing/providers/__tests__/mailerlite.test.ts`

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/integrations/email-marketing/providers/mailerlite.ts src/lib/integrations/email-marketing/providers/__tests__/mailerlite.test.ts
git commit -m "feat: add MailerLite email marketing provider"
```

---

## Task 5: Mailchimp Provider Module

**Files:**
- Create: `src/lib/integrations/email-marketing/providers/mailchimp.ts`
- Create: `src/lib/integrations/email-marketing/providers/__tests__/mailchimp.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/integrations/email-marketing/providers/__tests__/mailchimp.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailchimpProvider } from '../mailchimp';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MailchimpProvider', () => {
  let provider: MailchimpProvider;

  beforeEach(() => {
    provider = new MailchimpProvider({
      apiKey: 'mc-access-token',
      metadata: { server_prefix: 'us19' },
    });
    mockFetch.mockReset();
  });

  describe('validateCredentials', () => {
    it('returns true on valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lists: [] }),
      });
      expect(await provider.validateCredentials()).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://us19.api.mailchimp.com/3.0/lists?count=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mc-access-token',
          }),
        })
      );
    });
  });

  describe('getLists', () => {
    it('returns audiences as lists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lists: [
            { id: 'abc123', name: 'My Audience' },
            { id: 'def456', name: 'Newsletter' },
          ],
          total_items: 2,
        }),
      });

      const lists = await provider.getLists();
      expect(lists).toEqual([
        { id: 'abc123', name: 'My Audience' },
        { id: 'def456', name: 'Newsletter' },
      ]);
    });
  });

  describe('getTags', () => {
    it('returns tags for a specific list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tags: [
            { id: 12345, name: 'VIP' },
            { id: 12346, name: 'Lead Magnet' },
          ],
        }),
      });

      const tags = await provider.getTags('abc123');
      expect(tags).toEqual([
        { id: '12345', name: 'VIP' },
        { id: '12346', name: 'Lead Magnet' },
      ]);
    });

    it('returns empty array when no listId provided', async () => {
      const tags = await provider.getTags();
      expect(tags).toEqual([]);
    });
  });

  describe('subscribe', () => {
    it('upserts member with tag', async () => {
      // Upsert member
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'abc123', email_address: 'alice@example.com' }),
      });
      // Apply tag
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      const result = await provider.subscribe({
        listId: 'abc123',
        email: 'alice@example.com',
        firstName: 'Alice',
        tagId: 'VIP',  // Mailchimp tags use name, not numeric ID
      });

      expect(result).toEqual({ success: true });

      // Check upsert call (PUT with MD5 hash of email)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/3.0/lists/abc123/members/'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('subscribes without tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'abc123' }),
      });

      const result = await provider.subscribe({
        listId: 'abc123',
        email: 'alice@example.com',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(1); // No tag call
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/lib/integrations/email-marketing/providers/__tests__/mailchimp.test.ts`

Expected: FAIL

**Step 3: Write the implementation**

```typescript
// src/lib/integrations/email-marketing/providers/mailchimp.ts
import type {
  EmailMarketingProvider,
  EmailMarketingList,
  EmailMarketingTag,
  SubscribeParams,
  SubscribeResult,
  ProviderCredentials,
} from '../types';

function md5Hash(str: string): string {
  // Use Web Crypto for MD5 — but MD5 isn't in SubtleCrypto.
  // Use a simple implementation or import one.
  // For server-side Node.js, use crypto module:
  const crypto = require('crypto');
  return crypto.createHash('md5').update(str.toLowerCase()).digest('hex');
}

export class MailchimpProvider implements EmailMarketingProvider {
  private accessToken: string;
  private serverPrefix: string;

  constructor(credentials: ProviderCredentials) {
    this.accessToken = credentials.apiKey;
    this.serverPrefix = credentials.metadata?.server_prefix ?? '';
  }

  private get baseUrl(): string {
    return `https://${this.serverPrefix}.api.mailchimp.com/3.0`;
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async validateCredentials(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/lists?count=1`, {
      headers: this.headers(),
    });
    return res.ok;
  }

  async getLists(): Promise<EmailMarketingList[]> {
    const lists: EmailMarketingList[] = [];
    let offset = 0;
    const count = 100;

    do {
      const res = await fetch(`${this.baseUrl}/lists?count=${count}&offset=${offset}`, {
        headers: this.headers(),
      });
      if (!res.ok) break;

      const data = await res.json();
      for (const list of data.lists ?? []) {
        lists.push({ id: list.id, name: list.name });
      }

      if (lists.length >= (data.total_items ?? 0)) break;
      offset += count;
    } while (true);

    return lists;
  }

  async getTags(listId?: string): Promise<EmailMarketingTag[]> {
    if (!listId) return [];

    const res = await fetch(`${this.baseUrl}/lists/${listId}/tag-search`, {
      headers: this.headers(),
    });
    if (!res.ok) return [];

    const data = await res.json();
    return (data.tags ?? []).map((tag: { id: number; name: string }) => ({
      id: String(tag.id),
      name: tag.name,
    }));
  }

  async subscribe(params: SubscribeParams): Promise<SubscribeResult> {
    const subscriberHash = md5Hash(params.email);

    // Upsert member
    const body: Record<string, unknown> = {
      email_address: params.email,
      status_if_new: 'subscribed',
    };

    if (params.firstName) {
      body.merge_fields = { FNAME: params.firstName };
    }

    const res = await fetch(
      `${this.baseUrl}/lists/${params.listId}/members/${subscriberHash}`,
      {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Mailchimp subscribe failed (${res.status}): ${text}` };
    }

    // Apply tag if provided (tagId is the tag NAME for Mailchimp)
    if (params.tagId) {
      const tagRes = await fetch(
        `${this.baseUrl}/lists/${params.listId}/members/${subscriberHash}/tags`,
        {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            tags: [{ name: params.tagId, status: 'active' }],
          }),
        }
      );

      if (!tagRes.ok) {
        const text = await tagRes.text();
        return { success: false, error: `Mailchimp tag failed (${tagRes.status}): ${text}` };
      }
    }

    return { success: true };
  }
}
```

**Important note about Mailchimp tags:** When the user picks a tag in the UI, we store the tag `name` as `tag_id` in `funnel_integrations` (not the numeric ID), because the Mailchimp tags endpoint accepts tag names. The UI should make this clear.

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/lib/integrations/email-marketing/providers/__tests__/mailchimp.test.ts`

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/integrations/email-marketing/providers/mailchimp.ts src/lib/integrations/email-marketing/providers/__tests__/mailchimp.test.ts
git commit -m "feat: add Mailchimp email marketing provider"
```

---

## Task 6: ActiveCampaign Provider Module

**Files:**
- Create: `src/lib/integrations/email-marketing/providers/activecampaign.ts`
- Create: `src/lib/integrations/email-marketing/providers/__tests__/activecampaign.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/integrations/email-marketing/providers/__tests__/activecampaign.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActiveCampaignProvider } from '../activecampaign';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ActiveCampaignProvider', () => {
  let provider: ActiveCampaignProvider;

  beforeEach(() => {
    provider = new ActiveCampaignProvider({
      apiKey: 'test-ac-key',
      metadata: { base_url: 'https://myaccount.api-us1.com' },
    });
    mockFetch.mockReset();
  });

  describe('validateCredentials', () => {
    it('returns true on valid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lists: [] }),
      });
      expect(await provider.validateCredentials()).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://myaccount.api-us1.com/api/3/lists?limit=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Api-Token': 'test-ac-key',
          }),
        })
      );
    });
  });

  describe('getLists', () => {
    it('returns lists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lists: [
            { id: '1', name: 'My Email List' },
            { id: '2', name: 'Leads' },
          ],
          meta: { total: '2' },
        }),
      });

      const lists = await provider.getLists();
      expect(lists).toEqual([
        { id: '1', name: 'My Email List' },
        { id: '2', name: 'Leads' },
      ]);
    });
  });

  describe('getTags', () => {
    it('returns tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tags: [
            { id: '1', tag: 'VIP' },
            { id: '2', tag: 'Interested' },
          ],
          meta: { total: '2' },
        }),
      });

      const tags = await provider.getTags();
      expect(tags).toEqual([
        { id: '1', name: 'VIP' },
        { id: '2', name: 'Interested' },
      ]);
    });
  });

  describe('subscribe', () => {
    it('creates contact, adds to list, and applies tag', async () => {
      // Create contact
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contact: { id: '42' } }),
      });
      // Add to list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contactList: { contact: '42', list: '1' } }),
      });
      // Apply tag
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contactTag: { contact: '42', tag: '5' } }),
      });

      const result = await provider.subscribe({
        listId: '1',
        email: 'alice@example.com',
        firstName: 'Alice',
        tagId: '5',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('creates contact and adds to list without tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contact: { id: '42' } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contactList: {} }),
      });

      const result = await provider.subscribe({
        listId: '1',
        email: 'alice@example.com',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2); // No tag call
    });

    it('handles sync (existing contact) via contact lookup', async () => {
      // Create contact returns 422 (duplicate)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ errors: [{ title: 'Duplicate' }] }),
      });
      // Search for existing contact
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contacts: [{ id: '99' }] }),
      });
      // Add to list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contactList: {} }),
      });

      const result = await provider.subscribe({
        listId: '1',
        email: 'alice@example.com',
      });

      expect(result).toEqual({ success: true });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/lib/integrations/email-marketing/providers/__tests__/activecampaign.test.ts`

Expected: FAIL

**Step 3: Write the implementation**

```typescript
// src/lib/integrations/email-marketing/providers/activecampaign.ts
import type {
  EmailMarketingProvider,
  EmailMarketingList,
  EmailMarketingTag,
  SubscribeParams,
  SubscribeResult,
  ProviderCredentials,
} from '../types';

export class ActiveCampaignProvider implements EmailMarketingProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(credentials: ProviderCredentials) {
    this.apiKey = credentials.apiKey;
    // base_url should be like "https://myaccount.api-us1.com"
    this.baseUrl = (credentials.metadata?.base_url ?? '').replace(/\/$/, '');
  }

  private headers(): HeadersInit {
    return {
      'Api-Token': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async validateCredentials(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/3/lists?limit=1`, {
      headers: this.headers(),
    });
    return res.ok;
  }

  async getLists(): Promise<EmailMarketingList[]> {
    const lists: EmailMarketingList[] = [];
    let offset = 0;
    const limit = 100;

    do {
      const res = await fetch(
        `${this.baseUrl}/api/3/lists?limit=${limit}&offset=${offset}`,
        { headers: this.headers() }
      );
      if (!res.ok) break;

      const data = await res.json();
      for (const list of data.lists ?? []) {
        lists.push({ id: String(list.id), name: list.name });
      }

      const total = parseInt(data.meta?.total ?? '0', 10);
      if (lists.length >= total) break;
      offset += limit;
    } while (true);

    return lists;
  }

  async getTags(): Promise<EmailMarketingTag[]> {
    const tags: EmailMarketingTag[] = [];
    let offset = 0;
    const limit = 100;

    do {
      const res = await fetch(
        `${this.baseUrl}/api/3/tags?limit=${limit}&offset=${offset}`,
        { headers: this.headers() }
      );
      if (!res.ok) break;

      const data = await res.json();
      for (const tag of data.tags ?? []) {
        tags.push({ id: String(tag.id), name: tag.tag });
      }

      const total = parseInt(data.meta?.total ?? '0', 10);
      if (tags.length >= total) break;
      offset += limit;
    } while (true);

    return tags;
  }

  async subscribe(params: SubscribeParams): Promise<SubscribeResult> {
    // Step 1: Create or find contact
    let contactId: string | undefined;

    const contactBody: Record<string, unknown> = {
      contact: {
        email: params.email,
        ...(params.firstName ? { firstName: params.firstName } : {}),
      },
    };

    const createRes = await fetch(`${this.baseUrl}/api/3/contacts`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(contactBody),
    });

    if (createRes.ok) {
      const data = await createRes.json();
      contactId = data.contact?.id;
    } else if (createRes.status === 422) {
      // Duplicate — look up existing contact by email
      const searchRes = await fetch(
        `${this.baseUrl}/api/3/contacts?email=${encodeURIComponent(params.email)}`,
        { headers: this.headers() }
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        contactId = data.contacts?.[0]?.id;
      }
    }

    if (!contactId) {
      return { success: false, error: 'ActiveCampaign: failed to create or find contact' };
    }

    // Step 2: Add contact to list
    const listRes = await fetch(`${this.baseUrl}/api/3/contactLists`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        contactList: {
          list: parseInt(params.listId, 10),
          contact: parseInt(contactId, 10),
          status: 1,
        },
      }),
    });

    if (!listRes.ok) {
      const text = await listRes.text();
      return { success: false, error: `ActiveCampaign add-to-list failed (${listRes.status}): ${text}` };
    }

    // Step 3: Apply tag if provided
    if (params.tagId) {
      const tagRes = await fetch(`${this.baseUrl}/api/3/contactTags`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          contactTag: {
            contact: contactId,
            tag: params.tagId,
          },
        }),
      });

      if (!tagRes.ok) {
        const text = await tagRes.text();
        return { success: false, error: `ActiveCampaign tag failed (${tagRes.status}): ${text}` };
      }
    }

    return { success: true };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/lib/integrations/email-marketing/providers/__tests__/activecampaign.test.ts`

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/integrations/email-marketing/providers/activecampaign.ts src/lib/integrations/email-marketing/providers/__tests__/activecampaign.test.ts
git commit -m "feat: add ActiveCampaign email marketing provider"
```

---

## Task 7: Factory + Sync Function

**Files:**
- Create: `src/lib/integrations/email-marketing/index.ts`
- Create: `src/lib/integrations/email-marketing/__tests__/sync.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/integrations/email-marketing/__tests__/sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEmailMarketingProvider } from '../index';

describe('getEmailMarketingProvider', () => {
  it('returns KitProvider for "kit"', () => {
    const provider = getEmailMarketingProvider('kit', { apiKey: 'test' });
    expect(provider).toBeDefined();
    expect(provider.constructor.name).toBe('KitProvider');
  });

  it('returns MailerLiteProvider for "mailerlite"', () => {
    const provider = getEmailMarketingProvider('mailerlite', { apiKey: 'test' });
    expect(provider).toBeDefined();
    expect(provider.constructor.name).toBe('MailerLiteProvider');
  });

  it('returns MailchimpProvider for "mailchimp"', () => {
    const provider = getEmailMarketingProvider('mailchimp', {
      apiKey: 'test',
      metadata: { server_prefix: 'us19' },
    });
    expect(provider).toBeDefined();
    expect(provider.constructor.name).toBe('MailchimpProvider');
  });

  it('returns ActiveCampaignProvider for "activecampaign"', () => {
    const provider = getEmailMarketingProvider('activecampaign', {
      apiKey: 'test',
      metadata: { base_url: 'https://test.api-us1.com' },
    });
    expect(provider).toBeDefined();
    expect(provider.constructor.name).toBe('ActiveCampaignProvider');
  });

  it('throws for unknown provider', () => {
    expect(() => getEmailMarketingProvider('unknown', { apiKey: 'test' })).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/lib/integrations/email-marketing/__tests__/sync.test.ts`

Expected: FAIL

**Step 3: Write the implementation**

```typescript
// src/lib/integrations/email-marketing/index.ts
import type {
  EmailMarketingProvider,
  EmailMarketingProviderName,
  ProviderCredentials,
} from './types';
import { KitProvider } from './providers/kit';
import { MailerLiteProvider } from './providers/mailerlite';
import { MailchimpProvider } from './providers/mailchimp';
import { ActiveCampaignProvider } from './providers/activecampaign';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export { type EmailMarketingProvider, type EmailMarketingProviderName } from './types';

const PROVIDERS = ['kit', 'mailerlite', 'mailchimp', 'activecampaign'] as const;

export function isEmailMarketingProvider(s: string): s is EmailMarketingProviderName {
  return (PROVIDERS as readonly string[]).includes(s);
}

export function getEmailMarketingProvider(
  provider: string,
  credentials: ProviderCredentials
): EmailMarketingProvider {
  switch (provider) {
    case 'kit':
      return new KitProvider(credentials);
    case 'mailerlite':
      return new MailerLiteProvider(credentials);
    case 'mailchimp':
      return new MailchimpProvider(credentials);
    case 'activecampaign':
      return new ActiveCampaignProvider(credentials);
    default:
      throw new Error(`Unknown email marketing provider: ${provider}`);
  }
}

/**
 * Fire-and-forget: sync a new lead to all active email marketing integrations
 * configured for this funnel page.
 */
export async function syncLeadToEmailProviders(
  funnelPageId: string,
  lead: { email: string; name?: string | null }
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // 1. Get active funnel integrations
  const { data: mappings } = await supabase
    .from('funnel_integrations')
    .select('provider, list_id, tag_id, user_id')
    .eq('funnel_page_id', funnelPageId)
    .eq('is_active', true);

  if (!mappings?.length) return;

  // 2. For each mapping, get credentials and subscribe
  const results = await Promise.allSettled(
    mappings.map(async (mapping) => {
      const integration = await getUserIntegration(mapping.user_id, mapping.provider);
      if (!integration?.api_key) return;

      const provider = getEmailMarketingProvider(mapping.provider, {
        apiKey: integration.api_key,
        metadata: (integration.metadata ?? {}) as Record<string, string>,
      });

      const result = await provider.subscribe({
        listId: mapping.list_id,
        email: lead.email,
        firstName: lead.name?.split(' ')[0] ?? undefined,
        tagId: mapping.tag_id ?? undefined,
      });

      if (!result.success) {
        console.error(
          `[email-marketing] ${mapping.provider} subscribe failed for ${lead.email}:`,
          result.error
        );
      }
    })
  );

  // Log any rejected promises (shouldn't happen since we catch inside, but just in case)
  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('[email-marketing] Unexpected error:', r.reason);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/lib/integrations/email-marketing/__tests__/sync.test.ts`

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/integrations/email-marketing/index.ts src/lib/integrations/email-marketing/__tests__/sync.test.ts
git commit -m "feat: add email marketing provider factory and sync function"
```

---

## Task 8: API Routes — Connect, Disconnect, Verify, Lists, Tags

**Files:**
- Create: `src/app/api/integrations/email-marketing/connect/route.ts`
- Create: `src/app/api/integrations/email-marketing/disconnect/route.ts`
- Create: `src/app/api/integrations/email-marketing/verify/route.ts`
- Create: `src/app/api/integrations/email-marketing/lists/route.ts`
- Create: `src/app/api/integrations/email-marketing/tags/route.ts`

These routes follow the same pattern as existing `/api/integrations/route.ts` and `/api/integrations/verify/route.ts`.

**Step 1: Write connect route**

```typescript
// src/app/api/integrations/email-marketing/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { upsertUserIntegration } from '@/lib/utils/encrypted-storage';
import { getEmailMarketingProvider, isEmailMarketingProvider } from '@/lib/integrations/email-marketing';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { provider, api_key, metadata } = body;

  if (!provider || !isEmailMarketingProvider(provider)) {
    return NextResponse.json(
      { error: 'Invalid provider. Must be one of: kit, mailerlite, mailchimp, activecampaign' },
      { status: 400 }
    );
  }

  if (!api_key) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  // Validate credentials before saving
  try {
    const client = getEmailMarketingProvider(provider, {
      apiKey: api_key,
      metadata: metadata ?? {},
    });
    const isValid = await client.validateCredentials();

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials. Please check your API key and try again.' },
        { status: 422 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to validate credentials: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 422 }
    );
  }

  // Save integration
  const integration = await upsertUserIntegration({
    userId: session.user.id,
    service: provider,
    apiKey: api_key,
    isActive: true,
    metadata: metadata ?? {},
  });

  return NextResponse.json({ integration, message: 'Connected successfully' });
}
```

**Step 2: Write disconnect route**

```typescript
// src/app/api/integrations/email-marketing/disconnect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteUserIntegration } from '@/lib/utils/encrypted-storage';
import { isEmailMarketingProvider } from '@/lib/integrations/email-marketing';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { provider } = body;

  if (!provider || !isEmailMarketingProvider(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  // Delete the integration
  await deleteUserIntegration(session.user.id, provider);

  // Deactivate all funnel mappings for this provider
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('funnel_integrations')
    .update({ is_active: false })
    .eq('user_id', session.user.id)
    .eq('provider', provider);

  return NextResponse.json({ message: 'Disconnected successfully' });
}
```

**Step 3: Write verify route**

```typescript
// src/app/api/integrations/email-marketing/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserIntegration, updateIntegrationVerified } from '@/lib/utils/encrypted-storage';
import { getEmailMarketingProvider, isEmailMarketingProvider } from '@/lib/integrations/email-marketing';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { provider } = body;

  if (!provider || !isEmailMarketingProvider(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  const integration = await getUserIntegration(session.user.id, provider);
  if (!integration?.api_key) {
    return NextResponse.json({ error: 'Provider not connected' }, { status: 404 });
  }

  const client = getEmailMarketingProvider(provider, {
    apiKey: integration.api_key,
    metadata: (integration.metadata ?? {}) as Record<string, string>,
  });

  const isValid = await client.validateCredentials();

  if (isValid) {
    await updateIntegrationVerified(session.user.id, provider);
  }

  return NextResponse.json({ verified: isValid });
}
```

**Step 4: Write lists route**

```typescript
// src/app/api/integrations/email-marketing/lists/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { getEmailMarketingProvider, isEmailMarketingProvider } from '@/lib/integrations/email-marketing';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provider = request.nextUrl.searchParams.get('provider');
  if (!provider || !isEmailMarketingProvider(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  const integration = await getUserIntegration(session.user.id, provider);
  if (!integration?.api_key) {
    return NextResponse.json({ error: 'Provider not connected' }, { status: 404 });
  }

  const client = getEmailMarketingProvider(provider, {
    apiKey: integration.api_key,
    metadata: (integration.metadata ?? {}) as Record<string, string>,
  });

  const lists = await client.getLists();
  return NextResponse.json({ lists });
}
```

**Step 5: Write tags route**

```typescript
// src/app/api/integrations/email-marketing/tags/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { getEmailMarketingProvider, isEmailMarketingProvider } from '@/lib/integrations/email-marketing';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provider = request.nextUrl.searchParams.get('provider');
  const listId = request.nextUrl.searchParams.get('listId') ?? undefined;

  if (!provider || !isEmailMarketingProvider(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  const integration = await getUserIntegration(session.user.id, provider);
  if (!integration?.api_key) {
    return NextResponse.json({ error: 'Provider not connected' }, { status: 404 });
  }

  const client = getEmailMarketingProvider(provider, {
    apiKey: integration.api_key,
    metadata: (integration.metadata ?? {}) as Record<string, string>,
  });

  const tags = await client.getTags(listId);
  return NextResponse.json({ tags });
}
```

**Step 6: Commit**

```bash
git add src/app/api/integrations/email-marketing/
git commit -m "feat: add email marketing connect/disconnect/verify/lists/tags API routes"
```

---

## Task 9: Mailchimp OAuth Routes

**Files:**
- Create: `src/app/api/integrations/mailchimp/authorize/route.ts`
- Create: `src/app/api/integrations/mailchimp/callback/route.ts`

**Prerequisite:** You need Mailchimp OAuth app credentials. Set these env vars:
- `MAILCHIMP_CLIENT_ID`
- `MAILCHIMP_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL` (already should exist — e.g., `https://magnetlab.app`)

The OAuth redirect URI will be: `{NEXT_PUBLIC_APP_URL}/api/integrations/mailchimp/callback`

Register this redirect URI in Mailchimp's developer portal.

**Step 1: Write authorize route**

```typescript
// src/app/api/integrations/mailchimp/authorize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.MAILCHIMP_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Mailchimp OAuth not configured' }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/mailchimp/callback`;

  // Store state in cookie for CSRF protection (10 min expiry)
  const cookieStore = await cookies();
  cookieStore.set('mailchimp_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const authUrl = new URL('https://login.mailchimp.com/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
```

**Step 2: Write callback route**

```typescript
// src/app/api/integrations/mailchimp/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { cookies } from 'next/headers';
import { upsertUserIntegration } from '@/lib/utils/encrypted-storage';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?mailchimp=error&reason=unauthorized`);
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  // Validate CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('mailchimp_oauth_state')?.value;
  cookieStore.delete('mailchimp_oauth_state');

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?mailchimp=error&reason=invalid_state`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://login.mailchimp.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.MAILCHIMP_CLIENT_ID!,
        client_secret: process.env.MAILCHIMP_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/mailchimp/callback`,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('[mailchimp-oauth] Token exchange failed:', errorText);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?mailchimp=error&reason=token_exchange`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Get server prefix (dc) from metadata endpoint
    const metaRes = await fetch('https://login.mailchimp.com/oauth2/metadata', {
      headers: { Authorization: `OAuth ${accessToken}` },
    });

    if (!metaRes.ok) {
      console.error('[mailchimp-oauth] Metadata fetch failed');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?mailchimp=error&reason=metadata`);
    }

    const metaData = await metaRes.json();
    const serverPrefix = metaData.dc;
    const accountName = metaData.accountname ?? metaData.login?.login_name ?? '';

    // Save integration
    await upsertUserIntegration({
      userId: session.user.id,
      service: 'mailchimp',
      apiKey: accessToken,
      isActive: true,
      metadata: {
        server_prefix: serverPrefix,
        account_name: accountName,
      },
    });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?mailchimp=connected`);
  } catch (err) {
    console.error('[mailchimp-oauth] Unexpected error:', err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?mailchimp=error&reason=unexpected`);
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/integrations/mailchimp/
git commit -m "feat: add Mailchimp OAuth authorize + callback routes"
```

---

## Task 10: Per-Funnel Integration Routes

**Files:**
- Create: `src/app/api/funnels/[id]/integrations/route.ts`
- Create: `src/app/api/funnels/[id]/integrations/[provider]/route.ts`

**Step 1: Write funnel integrations CRUD route**

```typescript
// src/app/api/funnels/[id]/integrations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { isEmailMarketingProvider } from '@/lib/integrations/email-marketing';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: funnelPageId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: integrations, error } = await supabase
    .from('funnel_integrations')
    .select('id, provider, list_id, list_name, tag_id, tag_name, is_active, created_at, updated_at')
    .eq('funnel_page_id', funnelPageId)
    .eq('user_id', session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ integrations: integrations ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: funnelPageId } = await params;
  const body = await request.json();
  const { provider, list_id, list_name, tag_id, tag_name, is_active } = body;

  if (!provider || !isEmailMarketingProvider(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  if (!list_id) {
    return NextResponse.json({ error: 'list_id is required' }, { status: 400 });
  }

  // Verify user owns this funnel page
  const supabase = createSupabaseAdminClient();
  const { data: funnel } = await supabase
    .from('funnel_pages')
    .select('id')
    .eq('id', funnelPageId)
    .eq('user_id', session.user.id)
    .single();

  if (!funnel) {
    return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
  }

  // Upsert the mapping (unique on funnel_page_id + provider)
  const { data: integration, error } = await supabase
    .from('funnel_integrations')
    .upsert(
      {
        funnel_page_id: funnelPageId,
        user_id: session.user.id,
        provider,
        list_id,
        list_name: list_name ?? null,
        tag_id: tag_id ?? null,
        tag_name: tag_name ?? null,
        is_active: is_active ?? true,
      },
      { onConflict: 'funnel_page_id,provider' }
    )
    .select('id, provider, list_id, list_name, tag_id, tag_name, is_active')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ integration });
}
```

**Step 2: Write per-provider delete route**

```typescript
// src/app/api/funnels/[id]/integrations/[provider]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { isEmailMarketingProvider } from '@/lib/integrations/email-marketing';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; provider: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: funnelPageId, provider } = await params;

  if (!isEmailMarketingProvider(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('funnel_integrations')
    .delete()
    .eq('funnel_page_id', funnelPageId)
    .eq('user_id', session.user.id)
    .eq('provider', provider);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Removed' });
}
```

**Step 3: Commit**

```bash
git add src/app/api/funnels/
git commit -m "feat: add per-funnel integration mapping API routes"
```

---

## Task 11: Lead Capture Hook

**Files:**
- Modify: `src/app/api/public/lead/route.ts`

**Step 1: Add the sync call to the POST handler**

Find the section in the POST handler where webhooks are delivered (after the `funnel_leads` insert, near the fire-and-forget block). Add:

```typescript
import { syncLeadToEmailProviders } from '@/lib/integrations/email-marketing';
```

Then in the POST handler, alongside the other fire-and-forget calls:

```typescript
// Sync to email marketing providers (fire-and-forget)
syncLeadToEmailProviders(funnelPageId, { email, name }).catch((err) =>
  console.error('[lead-capture] Email marketing sync error:', err)
);
```

Place this after the existing webhook delivery calls but before the response is returned. It must NOT await — fire-and-forget only.

**Step 2: Test manually**

- Create a funnel integration mapping (Task 10's POST endpoint)
- Submit a test lead through the funnel
- Check the provider to see if the subscriber was created

**Step 3: Commit**

```bash
git add src/app/api/public/lead/route.ts
git commit -m "feat: hook email marketing sync into lead capture flow"
```

---

## Task 12: EmailMarketingSettings Component

**Files:**
- Create: `src/components/settings/EmailMarketingSettings.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx` (add the component)

This component follows the same pattern as `ResendSettings.tsx`. Read that file first for exact styling/component patterns used in the settings page.

**Step 1: Write the settings component**

```typescript
// src/components/settings/EmailMarketingSettings.tsx
'use client';

import { useState, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

interface Integration {
  service: string;
  is_active: boolean;
  last_verified_at: string | null;
  metadata: Record<string, unknown>;
}

interface Props {
  integrations: Integration[];
}

const PROVIDERS = [
  {
    id: 'kit',
    name: 'Kit (ConvertKit)',
    description: 'Connect your Kit account to subscribe leads to forms and apply tags.',
    authType: 'api_key' as const,
    placeholder: 'Enter your Kit API key',
    helpUrl: 'https://app.kit.com/account_settings/developer_settings',
    helpText: 'Find your API key in Kit → Settings → Developer',
    extraFields: [],
  },
  {
    id: 'mailerlite',
    name: 'MailerLite',
    description: 'Connect your MailerLite account to subscribe leads to groups.',
    authType: 'api_key' as const,
    placeholder: 'Enter your MailerLite API token',
    helpUrl: 'https://dashboard.mailerlite.com/integrations/api',
    helpText: 'Find your API token in MailerLite → Integrations → API',
    extraFields: [],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Connect your Mailchimp account to subscribe leads to audiences and apply tags.',
    authType: 'oauth' as const,
    extraFields: [],
  },
  {
    id: 'activecampaign',
    name: 'ActiveCampaign',
    description: 'Connect your ActiveCampaign account to add contacts to lists and apply tags.',
    authType: 'api_key' as const,
    placeholder: 'Enter your ActiveCampaign API key',
    helpUrl: 'https://help.activecampaign.com/hc/en-us/articles/207317590-Getting-started-with-the-API',
    helpText: 'Find your API key in ActiveCampaign → Settings → Developer',
    extraFields: [
      {
        key: 'base_url',
        label: 'API URL',
        placeholder: 'https://youraccountname.api-us1.com',
        helpText: 'Found in ActiveCampaign → Settings → Developer → API Access',
      },
    ],
  },
] as const;

export default function EmailMarketingSettings({ integrations }: Props) {
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [extraFieldValues, setExtraFieldValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  const getIntegration = useCallback(
    (providerId: string) => integrations.find((i) => i.service === providerId),
    [integrations]
  );

  const handleConnect = async (providerId: string) => {
    setLoading(providerId);
    setError(null);

    try {
      const provider = PROVIDERS.find((p) => p.id === providerId);
      if (!provider) return;

      if (provider.authType === 'oauth') {
        // Redirect to OAuth flow
        window.location.href = `/api/integrations/mailchimp/authorize`;
        return;
      }

      const metadata: Record<string, string> = {};
      for (const field of provider.extraFields) {
        if (extraFieldValues[field.key]) {
          metadata[field.key] = extraFieldValues[field.key];
        }
      }

      const res = await fetch('/api/integrations/email-marketing/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, api_key: apiKey, metadata }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to connect');
        return;
      }

      // Reload to show connected state
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    if (!confirm(`Disconnect ${PROVIDERS.find((p) => p.id === providerId)?.name}? All funnel mappings for this provider will be deactivated.`)) {
      return;
    }

    setLoading(providerId);
    try {
      await fetch('/api/integrations/email-marketing/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      });
      window.location.reload();
    } catch {
      setError('Failed to disconnect');
    } finally {
      setLoading(null);
    }
  };

  const handleVerify = async (providerId: string) => {
    setVerifying(providerId);
    try {
      const res = await fetch('/api/integrations/email-marketing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      });
      const data = await res.json();
      if (data.verified) {
        window.location.reload();
      } else {
        setError('Verification failed — credentials may be invalid');
      }
    } catch {
      setError('Verification request failed');
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Email Marketing</h3>
        <p className="text-sm text-muted-foreground">
          Connect your email marketing provider to automatically subscribe leads when they opt in.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const integration = getIntegration(provider.id);
          const isConnected = integration?.is_active;
          const isLoading = loading === provider.id;
          const isVerifyingThis = verifying === provider.id;
          const isExpanded = connectingProvider === provider.id;

          return (
            <div
              key={provider.id}
              className="rounded-lg border p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{provider.name}</h4>
                    {isConnected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle className="h-3 w-3" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{provider.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => handleVerify(provider.id)}
                        disabled={isVerifyingThis}
                        className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                      >
                        {isVerifyingThis ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Test Connection'
                        )}
                      </button>
                      <button
                        onClick={() => handleDisconnect(provider.id)}
                        disabled={isLoading}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        if (provider.authType === 'oauth') {
                          handleConnect(provider.id);
                        } else {
                          setConnectingProvider(isExpanded ? null : provider.id);
                          setApiKey('');
                          setExtraFieldValues({});
                          setError(null);
                        }
                      }}
                      disabled={isLoading}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        `Connect ${provider.authType === 'oauth' ? '(OAuth)' : ''}`
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* API key input form (expanded state) */}
              {isExpanded && !isConnected && provider.authType === 'api_key' && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  {provider.extraFields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium">{field.label}</label>
                      <input
                        type="text"
                        value={extraFieldValues[field.key] ?? ''}
                        onChange={(e) =>
                          setExtraFieldValues({ ...extraFieldValues, [field.key]: e.target.value })
                        }
                        placeholder={field.placeholder}
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      />
                      {field.helpText && (
                        <p className="mt-1 text-xs text-muted-foreground">{field.helpText}</p>
                      )}
                    </div>
                  ))}

                  <div>
                    <label className="block text-sm font-medium">API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={provider.placeholder}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    />
                    {provider.helpUrl && (
                      <a
                        href={provider.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {provider.helpText} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConnect(provider.id)}
                      disabled={!apiKey || isLoading}
                      className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verifying...
                        </span>
                      ) : (
                        'Connect'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setConnectingProvider(null);
                        setError(null);
                      }}
                      className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Show last verified timestamp */}
              {isConnected && integration?.last_verified_at && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Last verified: {new Date(integration.last_verified_at).toLocaleDateString()}
                  {integration.metadata?.account_name && (
                    <> &middot; {String(integration.metadata.account_name)}</>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Add to settings page**

Read `src/app/(dashboard)/settings/page.tsx` to find where integration settings components are rendered. Add `EmailMarketingSettings` alongside `ResendSettings`, `FathomSettings`, etc. Pass the `integrations` prop from the server component's data fetch.

```typescript
import EmailMarketingSettings from '@/components/settings/EmailMarketingSettings';
// In the JSX, alongside other settings:
<EmailMarketingSettings integrations={integrations ?? []} />
```

**Step 3: Commit**

```bash
git add src/components/settings/EmailMarketingSettings.tsx src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add EmailMarketingSettings component to settings page"
```

---

## Task 13: FunnelIntegrationsTab Component

**Files:**
- Create: `src/components/funnel-editor/FunnelIntegrationsTab.tsx`
- Modify: the funnel page editor to include this tab

First, read the funnel editor at `src/app/(dashboard)/library/[id]/page.tsx` and its tab components to understand the tab system. The new tab should be added alongside existing tabs.

**Step 1: Write the funnel integrations tab**

```typescript
// src/components/funnel-editor/FunnelIntegrationsTab.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, ChevronDown } from 'lucide-react';

interface FunnelIntegration {
  id: string;
  provider: string;
  list_id: string;
  list_name: string | null;
  tag_id: string | null;
  tag_name: string | null;
  is_active: boolean;
}

interface ListOption {
  id: string;
  name: string;
}

interface Props {
  funnelPageId: string;
  connectedProviders: string[]; // providers the user has connected globally
}

const PROVIDER_LABELS: Record<string, string> = {
  kit: 'Kit (ConvertKit)',
  mailerlite: 'MailerLite',
  mailchimp: 'Mailchimp',
  activecampaign: 'ActiveCampaign',
};

export default function FunnelIntegrationsTab({ funnelPageId, connectedProviders }: Props) {
  const [integrations, setIntegrations] = useState<FunnelIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingProvider, setAddingProvider] = useState<string | null>(null);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [tags, setTags] = useState<ListOption[]>([]);
  const [selectedList, setSelectedList] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);

  const fetchIntegrations = useCallback(async () => {
    const res = await fetch(`/api/funnels/${funnelPageId}/integrations`);
    if (res.ok) {
      const data = await res.json();
      setIntegrations(data.integrations ?? []);
    }
    setLoading(false);
  }, [funnelPageId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const fetchLists = async (provider: string) => {
    setLoadingLists(true);
    setLists([]);
    setTags([]);
    setSelectedList('');
    setSelectedTag('');
    const res = await fetch(`/api/integrations/email-marketing/lists?provider=${provider}`);
    if (res.ok) {
      const data = await res.json();
      setLists(data.lists ?? []);
    }
    setLoadingLists(false);
  };

  const fetchTags = async (provider: string, listId?: string) => {
    setLoadingTags(true);
    setTags([]);
    setSelectedTag('');
    const url = listId
      ? `/api/integrations/email-marketing/tags?provider=${provider}&listId=${listId}`
      : `/api/integrations/email-marketing/tags?provider=${provider}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setTags(data.tags ?? []);
    }
    setLoadingTags(false);
  };

  const handleStartAdding = (provider: string) => {
    setAddingProvider(provider);
    fetchLists(provider);
    // Fetch tags (Kit/AC have global tags, Mailchimp needs listId)
    if (provider !== 'mailchimp') {
      fetchTags(provider);
    }
  };

  const handleListChange = (listId: string, provider: string) => {
    setSelectedList(listId);
    // For Mailchimp, tags are per-list
    if (provider === 'mailchimp' && listId) {
      fetchTags(provider, listId);
    }
  };

  const handleSave = async () => {
    if (!addingProvider || !selectedList) return;
    setSaving(true);

    const listOption = lists.find((l) => l.id === selectedList);
    const tagOption = tags.find((t) => t.id === selectedTag);

    const res = await fetch(`/api/funnels/${funnelPageId}/integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: addingProvider,
        list_id: selectedList,
        list_name: listOption?.name ?? null,
        tag_id: selectedTag || null,
        tag_name: tagOption?.name ?? null,
        is_active: true,
      }),
    });

    if (res.ok) {
      setAddingProvider(null);
      setSelectedList('');
      setSelectedTag('');
      await fetchIntegrations();
    }
    setSaving(false);
  };

  const handleRemove = async (provider: string) => {
    if (!confirm(`Remove ${PROVIDER_LABELS[provider]} integration from this funnel?`)) return;

    await fetch(`/api/funnels/${funnelPageId}/integrations/${provider}`, {
      method: 'DELETE',
    });
    await fetchIntegrations();
  };

  const handleToggle = async (integration: FunnelIntegration) => {
    await fetch(`/api/funnels/${funnelPageId}/integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: integration.provider,
        list_id: integration.list_id,
        list_name: integration.list_name,
        tag_id: integration.tag_id,
        tag_name: integration.tag_name,
        is_active: !integration.is_active,
      }),
    });
    await fetchIntegrations();
  };

  // Providers the user has connected but hasn't mapped to this funnel yet
  const unmappedProviders = connectedProviders.filter(
    (p) => !integrations.some((i) => i.provider === p)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Email Marketing Integrations</h3>
        <p className="text-sm text-muted-foreground">
          Leads who opt in through this funnel will be automatically subscribed to your selected lists.
        </p>
      </div>

      {/* Existing mappings */}
      {integrations.length > 0 && (
        <div className="space-y-2">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(integration)}
                  className={`h-4 w-8 rounded-full transition-colors ${
                    integration.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      integration.is_active ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <div>
                  <span className="font-medium">
                    {PROVIDER_LABELS[integration.provider] ?? integration.provider}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {integration.list_name ?? integration.list_id}
                    {integration.tag_name && ` + tag: ${integration.tag_name}`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleRemove(integration.provider)}
                className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new mapping */}
      {addingProvider ? (
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="font-medium">{PROVIDER_LABELS[addingProvider]}</h4>

          {/* List selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {addingProvider === 'kit' ? 'Form' : addingProvider === 'mailerlite' ? 'Group' : 'List'}
            </label>
            {loadingLists ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <select
                value={selectedList}
                onChange={(e) => handleListChange(e.target.value, addingProvider)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Tag selection (optional) */}
          {(addingProvider !== 'mailerlite') && (
            <div>
              <label className="block text-sm font-medium mb-1">Tag (optional)</label>
              {loadingTags ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : tags.length > 0 ? (
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">No tag</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {addingProvider === 'mailchimp' && !selectedList
                    ? 'Select a list first to see tags'
                    : 'No tags found'}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!selectedList || saving}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </button>
            <button
              onClick={() => setAddingProvider(null)}
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : unmappedProviders.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {unmappedProviders.map((provider) => (
            <button
              key={provider}
              onClick={() => handleStartAdding(provider)}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <Plus className="h-3 w-3" />
              {PROVIDER_LABELS[provider] ?? provider}
            </button>
          ))}
        </div>
      ) : integrations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No email marketing providers connected.{' '}
          <a href="/settings" className="text-primary underline">
            Connect one in Settings
          </a>{' '}
          to start subscribing leads automatically.
        </div>
      ) : null}
    </div>
  );
}
```

**Step 2: Add to funnel editor**

Read the funnel editor page/component to understand the tab system. Add the `FunnelIntegrationsTab` as a new tab. You'll need to:

1. Pass `funnelPageId` from the page params
2. Fetch the user's connected email marketing providers (from `user_integrations` where service is one of kit/mailerlite/mailchimp/activecampaign and is_active = true)
3. Pass `connectedProviders` as a string array of service names

**Step 3: Commit**

```bash
git add src/components/funnel-editor/FunnelIntegrationsTab.tsx
git commit -m "feat: add FunnelIntegrationsTab component for per-funnel ESP mapping"
```

---

## Task 14: Integration Test — End-to-End Manual Test

**No files to create — manual verification.**

**Steps:**

1. **Run migrations**: `npx supabase db push`
2. **Start dev server**: `npm run dev`
3. **Connect Kit in Settings**: Go to Settings, find Email Marketing section, connect Kit with a real API key → verify "Connected" badge appears
4. **Map funnel to Kit**: Open a funnel editor, go to Integrations tab → select Kit form + optional tag → Save
5. **Submit test lead**: Open the funnel's public page, enter a test email → submit
6. **Verify in Kit**: Check Kit dashboard — the subscriber should appear in the selected form with the tag applied
7. **Disconnect**: Go back to Settings → Disconnect Kit → verify funnel mapping is deactivated
8. **Repeat for MailerLite** (if you have an API key)
9. **Test Mailchimp OAuth**: Click Connect (OAuth) → authorize → verify callback saves token → verify lists load → map funnel → test lead

---

## Task 15: Run All Tests

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/lib/integrations/email-marketing/`

Expected: ALL tests pass (kit, mailerlite, mailchimp, activecampaign, sync).

Then run the full test suite to check for regressions:

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run`

Expected: No regressions.

**Commit if any fixes were needed:**

```bash
git commit -am "test: fix any test issues from email marketing integration"
```

---

## Summary

| Task | Description | New Files |
|------|-------------|-----------|
| 1 | Database migration | 1 SQL |
| 2 | Types + interface | 1 TS |
| 3 | Kit provider + test | 2 TS |
| 4 | MailerLite provider + test | 2 TS |
| 5 | Mailchimp provider + test | 2 TS |
| 6 | ActiveCampaign provider + test | 2 TS |
| 7 | Factory + sync + test | 2 TS |
| 8 | API routes (5 routes) | 5 TS |
| 9 | Mailchimp OAuth (2 routes) | 2 TS |
| 10 | Per-funnel routes (2 routes) | 2 TS |
| 11 | Lead capture hook | 0 (modify 1) |
| 12 | Settings UI | 1 TSX (modify 1) |
| 13 | Funnel editor tab | 1 TSX (modify 1) |
| 14 | Manual E2E test | 0 |
| 15 | Run full test suite | 0 |

**Total: ~23 new files, 3 modified files**

## Env Vars Needed

- `MAILCHIMP_CLIENT_ID` — Mailchimp OAuth app client ID
- `MAILCHIMP_CLIENT_SECRET` — Mailchimp OAuth app client secret
- `NEXT_PUBLIC_APP_URL` — should already be set (e.g., `https://magnetlab.app`)

Register Mailchimp OAuth redirect URI: `https://magnetlab.app/api/integrations/mailchimp/callback`
