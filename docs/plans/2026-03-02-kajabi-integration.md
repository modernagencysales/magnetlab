# Kajabi Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow MagnetLab users to push funnel leads into Kajabi as contacts with tags, using the same integration pattern as GoHighLevel/HeyReach.

**Architecture:** Two-tier (account-level API key + site ID in `user_integrations`, funnel-level toggle + tag picker in `funnel_integrations`). Fire-and-forget sync on lead capture via `after()`. Kajabi REST API v1 with JSON:API spec.

**Tech Stack:** Next.js 15 API routes, Supabase, Kajabi REST API v1 (`https://api.kajabi.com/v1`), Jest

---

### Task 1: Kajabi API Types

**Files:**
- Create: `src/lib/integrations/kajabi/types.ts`

**Step 1: Create the types file**

```typescript
// src/lib/integrations/kajabi/types.ts

// Kajabi API uses JSON:API specification
// Base URL: https://api.kajabi.com/v1
// Auth: Bearer token
// Content-Type: application/vnd.api+json

export interface KajabiContactAttributes {
  name?: string;
  email: string;
  subscribed?: boolean;
}

export interface KajabiCreateContactPayload {
  data: {
    type: 'contacts';
    attributes: KajabiContactAttributes;
    relationships: {
      site: {
        data: { type: 'sites'; id: string };
      };
    };
  };
}

export interface KajabiContactResponse {
  data: {
    id: string;
    type: 'contacts';
    attributes: {
      name: string | null;
      email: string;
      subscribed: boolean;
    };
  };
}

export interface KajabiTagRelationship {
  data: Array<{ type: 'tags'; id: string }>;
}

export interface KajabiTag {
  id: string;
  type: 'contact_tags';
  attributes: {
    name: string;
  };
}

export interface KajabiTagsListResponse {
  data: KajabiTag[];
}

export interface KajabiSyncParams {
  userId: string;
  funnelPageId: string;
  lead: {
    email: string;
    name?: string | null;
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/integrations/kajabi/types.ts
git commit -m "feat(kajabi): add Kajabi API types"
```

---

### Task 2: Kajabi API Client

**Files:**
- Create: `src/lib/integrations/kajabi/client.ts`
- Test: `src/__tests__/lib/integrations/kajabi/client.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/__tests__/lib/integrations/kajabi/client.test.ts

import { KajabiClient } from '@/lib/integrations/kajabi/client';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('KajabiClient', () => {
  const apiKey = 'test-api-key';
  const siteId = 'test-site-id';
  let client: KajabiClient;

  beforeEach(() => {
    client = new KajabiClient(apiKey, siteId);
    mockFetch.mockReset();
  });

  describe('testConnection', () => {
    it('returns true when API responds with 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await client.testConnection();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kajabi.com/v1/contacts?page[size]=1',
        expect.objectContaining({
          method: 'GET',
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
    it('creates a contact and returns the id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: { id: 'contact-123', type: 'contacts', attributes: { email: 'test@example.com' } },
        }),
      });

      const result = await client.createContact('test@example.com', 'Test User');

      expect(result).toEqual({ id: 'contact-123' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kajabi.com/v1/contacts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/vnd.api+json',
          }),
          body: expect.stringContaining('"email":"test@example.com"'),
        })
      );

      // Verify site relationship is included
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.data.relationships.site.data.id).toBe('test-site-id');
    });

    it('creates a contact without name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: { id: 'contact-456', type: 'contacts', attributes: { email: 'noname@example.com' } },
        }),
      });

      const result = await client.createContact('noname@example.com');
      expect(result).toEqual({ id: 'contact-456' });
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ errors: [{ detail: 'Invalid email' }] }),
      });

      await expect(client.createContact('bad')).rejects.toThrow();
    });
  });

  describe('addTagsToContact', () => {
    it('sends tag relationship data', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      await client.addTagsToContact('contact-123', ['tag-1', 'tag-2']);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kajabi.com/v1/contacts/contact-123/relationships/tags',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            data: [
              { type: 'tags', id: 'tag-1' },
              { type: 'tags', id: 'tag-2' },
            ],
          }),
        })
      );
    });

    it('skips when no tag ids provided', async () => {
      await client.addTagsToContact('contact-123', []);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('listTags', () => {
    it('returns parsed tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'tag-1', type: 'contact_tags', attributes: { name: 'VIP' } },
            { id: 'tag-2', type: 'contact_tags', attributes: { name: 'Lead' } },
          ],
        }),
      });

      const tags = await client.listTags();
      expect(tags).toEqual([
        { id: 'tag-1', name: 'VIP' },
        { id: 'tag-2', name: 'Lead' },
      ]);
    });

    it('returns empty array on error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const tags = await client.listTags();
      expect(tags).toEqual([]);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/lib/integrations/kajabi/client.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write the client implementation**

```typescript
// src/lib/integrations/kajabi/client.ts

import type {
  KajabiCreateContactPayload,
  KajabiContactResponse,
  KajabiTagRelationship,
  KajabiTagsListResponse,
} from './types';

const KAJABI_BASE_URL = 'https://api.kajabi.com/v1';
const TIMEOUT_MS = 10_000;

export class KajabiClient {
  private apiKey: string;
  private siteId: string;

  constructor(apiKey: string, siteId: string) {
    this.apiKey = apiKey;
    this.siteId = siteId;
  }

  /**
   * Test the API connection by fetching 1 contact.
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${KAJABI_BASE_URL}/contacts?page[size]=1`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Create a contact in Kajabi.
   */
  async createContact(email: string, name?: string): Promise<{ id: string }> {
    const payload: KajabiCreateContactPayload = {
      data: {
        type: 'contacts',
        attributes: {
          email,
          ...(name ? { name } : {}),
          subscribed: true,
        },
        relationships: {
          site: {
            data: { type: 'sites', id: this.siteId },
          },
        },
      },
    };

    const response = await fetch(`${KAJABI_BASE_URL}/contacts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await this.parseErrorMessage(response);
      throw new Error(`Kajabi createContact failed (${response.status}): ${errorText}`);
    }

    const data: KajabiContactResponse = await response.json();
    return { id: data.data.id };
  }

  /**
   * Add tags to a contact.
   */
  async addTagsToContact(contactId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;

    const body: KajabiTagRelationship = {
      data: tagIds.map((id) => ({ type: 'tags', id })),
    };

    const response = await fetch(
      `${KAJABI_BASE_URL}/contacts/${contactId}/relationships/tags`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const errorText = await this.parseErrorMessage(response);
      throw new Error(`Kajabi addTags failed (${response.status}): ${errorText}`);
    }
  }

  /**
   * List all available contact tags.
   */
  async listTags(): Promise<{ id: string; name: string }[]> {
    try {
      const response = await fetch(`${KAJABI_BASE_URL}/contact_tags`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) return [];

      const data: KajabiTagsListResponse = await response.json();
      return data.data.map((tag) => ({
        id: tag.id,
        name: tag.attributes.name,
      }));
    } catch {
      return [];
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    };
  }

  private async parseErrorMessage(response: Response): Promise<string> {
    try {
      const body = await response.json();
      if (body.errors && Array.isArray(body.errors)) {
        return body.errors.map((e: { detail?: string }) => e.detail || 'Unknown error').join(', ');
      }
      return body.message || body.error || 'Unknown error';
    } catch {
      return 'Unknown error';
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/lib/integrations/kajabi/client.test.ts --no-coverage`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/integrations/kajabi/client.ts src/__tests__/lib/integrations/kajabi/client.test.ts
git commit -m "feat(kajabi): add Kajabi API client with tests"
```

---

### Task 3: API Routes (Connect, Verify, Disconnect, Tags)

**Files:**
- Create: `src/app/api/integrations/kajabi/connect/route.ts`
- Create: `src/app/api/integrations/kajabi/verify/route.ts`
- Create: `src/app/api/integrations/kajabi/disconnect/route.ts`
- Create: `src/app/api/integrations/kajabi/tags/route.ts`
- Test: `src/__tests__/api/integrations/kajabi/routes.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/__tests__/api/integrations/kajabi/routes.test.ts

// Mock dependencies before imports
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/integrations/kajabi/client', () => ({
  KajabiClient: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(true),
    listTags: jest.fn().mockResolvedValue([
      { id: 'tag-1', name: 'VIP' },
      { id: 'tag-2', name: 'Lead' },
    ]),
  })),
}));

jest.mock('@/lib/utils/encrypted-storage', () => ({
  upsertUserIntegration: jest.fn().mockResolvedValue({ id: 'int-1', service: 'kajabi' }),
  getUserIntegration: jest.fn().mockResolvedValue({
    api_key: 'test-key',
    is_active: true,
    metadata: { site_id: 'site-123' },
  }),
  updateIntegrationVerified: jest.fn().mockResolvedValue(undefined),
  deleteUserIntegration: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
    }),
  }),
}));

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe('Kajabi Integration Routes', () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
  });

  describe('POST /api/integrations/kajabi/connect', () => {
    it('returns 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const { POST } = await import('@/app/api/integrations/kajabi/connect/route');
      const req = new NextRequest('http://localhost/api/integrations/kajabi/connect', {
        method: 'POST',
        body: JSON.stringify({ api_key: 'key', site_id: 'site' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('returns 400 if api_key is missing', async () => {
      const { POST } = await import('@/app/api/integrations/kajabi/connect/route');
      const req = new NextRequest('http://localhost/api/integrations/kajabi/connect', {
        method: 'POST',
        body: JSON.stringify({ site_id: 'site' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 if site_id is missing', async () => {
      const { POST } = await import('@/app/api/integrations/kajabi/connect/route');
      const req = new NextRequest('http://localhost/api/integrations/kajabi/connect', {
        method: 'POST',
        body: JSON.stringify({ api_key: 'key' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 200 on successful connection', async () => {
      const { POST } = await import('@/app/api/integrations/kajabi/connect/route');
      const req = new NextRequest('http://localhost/api/integrations/kajabi/connect', {
        method: 'POST',
        body: JSON.stringify({ api_key: 'valid-key', site_id: 'site-123' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Connected successfully');
    });
  });

  describe('POST /api/integrations/kajabi/verify', () => {
    it('returns 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const { POST } = await import('@/app/api/integrations/kajabi/verify/route');
      const res = await POST();
      expect(res.status).toBe(401);
    });

    it('returns verified status', async () => {
      const { POST } = await import('@/app/api/integrations/kajabi/verify/route');
      const res = await POST();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.verified).toBe(true);
    });
  });

  describe('POST /api/integrations/kajabi/disconnect', () => {
    it('returns 200 on successful disconnect', async () => {
      const { POST } = await import('@/app/api/integrations/kajabi/disconnect/route');
      const res = await POST();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Disconnected successfully');
    });
  });

  describe('GET /api/integrations/kajabi/tags', () => {
    it('returns 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null as never);
      const { GET } = await import('@/app/api/integrations/kajabi/tags/route');
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns tags list', async () => {
      const { GET } = await import('@/app/api/integrations/kajabi/tags/route');
      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.tags).toEqual([
        { id: 'tag-1', name: 'VIP' },
        { id: 'tag-2', name: 'Lead' },
      ]);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/api/integrations/kajabi/routes.test.ts --no-coverage`
Expected: FAIL — modules not found

**Step 3: Write the connect route**

```typescript
// src/app/api/integrations/kajabi/connect/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KajabiClient } from '@/lib/integrations/kajabi/client';
import { upsertUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { api_key, site_id } = body;

    if (!api_key || typeof api_key !== 'string') {
      return ApiErrors.validationError('API key is required');
    }

    if (!site_id || typeof site_id !== 'string') {
      return ApiErrors.validationError('Site ID is required');
    }

    const client = new KajabiClient(api_key, site_id);
    const valid = await client.testConnection();

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid credentials. Please check your Kajabi API key and Site ID.', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    const integration = await upsertUserIntegration({
      userId: session.user.id,
      service: 'kajabi',
      apiKey: api_key,
      isActive: true,
      metadata: { site_id },
    });

    return NextResponse.json({
      integration,
      message: 'Connected successfully',
    });
  } catch (error) {
    logApiError('kajabi/connect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to connect Kajabi'
    );
  }
}
```

**Step 4: Write the verify route**

```typescript
// src/app/api/integrations/kajabi/verify/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KajabiClient } from '@/lib/integrations/kajabi/client';
import { getUserIntegration, updateIntegrationVerified } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const integration = await getUserIntegration(session.user.id, 'kajabi');
    if (!integration?.api_key) {
      return ApiErrors.notFound('Integration');
    }

    const siteId = (integration.metadata as { site_id?: string })?.site_id;
    if (!siteId) {
      return ApiErrors.notFound('Integration');
    }

    const client = new KajabiClient(integration.api_key, siteId);
    const verified = await client.testConnection();

    if (verified) {
      await updateIntegrationVerified(session.user.id, 'kajabi');
    }

    return NextResponse.json({ verified });
  } catch (error) {
    logApiError('kajabi/verify', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to verify connection'
    );
  }
}
```

**Step 5: Write the disconnect route**

```typescript
// src/app/api/integrations/kajabi/disconnect/route.ts

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

    await deleteUserIntegration(session.user.id, 'kajabi');

    const supabase = createSupabaseAdminClient();
    await supabase
      .from('funnel_integrations')
      .update({ is_active: false })
      .eq('user_id', session.user.id)
      .eq('provider', 'kajabi');

    return NextResponse.json({
      message: 'Disconnected successfully',
    });
  } catch (error) {
    logApiError('kajabi/disconnect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to disconnect Kajabi'
    );
  }
}
```

**Step 6: Write the tags route**

```typescript
// src/app/api/integrations/kajabi/tags/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KajabiClient } from '@/lib/integrations/kajabi/client';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const integration = await getUserIntegration(session.user.id, 'kajabi');
    if (!integration?.api_key || !integration.is_active) {
      return ApiErrors.notFound('Integration');
    }

    const siteId = (integration.metadata as { site_id?: string })?.site_id;
    if (!siteId) {
      return ApiErrors.notFound('Integration');
    }

    const client = new KajabiClient(integration.api_key, siteId);
    const tags = await client.listTags();

    return NextResponse.json({ tags });
  } catch (error) {
    logApiError('kajabi/tags', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to fetch tags'
    );
  }
}
```

**Step 7: Run tests to verify they pass**

Run: `npx jest src/__tests__/api/integrations/kajabi/routes.test.ts --no-coverage`
Expected: All tests PASS

**Step 8: Commit**

```bash
git add src/app/api/integrations/kajabi/ src/__tests__/api/integrations/kajabi/
git commit -m "feat(kajabi): add connect, verify, disconnect, and tags API routes"
```

---

### Task 4: Lead Sync Function

**Files:**
- Create: `src/lib/integrations/kajabi/sync.ts`
- Test: `src/__tests__/lib/integrations/kajabi/sync.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/__tests__/lib/integrations/kajabi/sync.test.ts

const mockGetUserIntegration = jest.fn();
const mockCreateContact = jest.fn();
const mockAddTagsToContact = jest.fn();

jest.mock('@/lib/utils/encrypted-storage', () => ({
  getUserIntegration: (...args: unknown[]) => mockGetUserIntegration(...args),
}));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { id: 'fi-1', is_active: true, settings: { tag_ids: ['tag-1'] } },
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));

jest.mock('@/lib/integrations/kajabi/client', () => ({
  KajabiClient: jest.fn().mockImplementation(() => ({
    createContact: (...args: unknown[]) => mockCreateContact(...args),
    addTagsToContact: (...args: unknown[]) => mockAddTagsToContact(...args),
  })),
}));

import { syncLeadToKajabi } from '@/lib/integrations/kajabi/sync';

describe('syncLeadToKajabi', () => {
  beforeEach(() => {
    mockGetUserIntegration.mockReset();
    mockCreateContact.mockReset();
    mockAddTagsToContact.mockReset();
  });

  it('skips when no integration exists', async () => {
    mockGetUserIntegration.mockResolvedValue(null);

    await syncLeadToKajabi({
      userId: 'user-1',
      funnelPageId: 'fp-1',
      lead: { email: 'test@example.com' },
    });

    expect(mockCreateContact).not.toHaveBeenCalled();
  });

  it('skips when integration is inactive', async () => {
    mockGetUserIntegration.mockResolvedValue({
      api_key: 'key',
      is_active: false,
      metadata: { site_id: 'site-1' },
    });

    await syncLeadToKajabi({
      userId: 'user-1',
      funnelPageId: 'fp-1',
      lead: { email: 'test@example.com' },
    });

    expect(mockCreateContact).not.toHaveBeenCalled();
  });

  it('creates contact and adds tags on success', async () => {
    mockGetUserIntegration.mockResolvedValue({
      api_key: 'key',
      is_active: true,
      metadata: { site_id: 'site-1' },
    });
    mockCreateContact.mockResolvedValue({ id: 'contact-123' });
    mockAddTagsToContact.mockResolvedValue(undefined);

    await syncLeadToKajabi({
      userId: 'user-1',
      funnelPageId: 'fp-1',
      lead: { email: 'test@example.com', name: 'Test User' },
    });

    expect(mockCreateContact).toHaveBeenCalledWith('test@example.com', 'Test User');
    expect(mockAddTagsToContact).toHaveBeenCalledWith('contact-123', ['tag-1']);
  });

  it('does not throw on error', async () => {
    mockGetUserIntegration.mockResolvedValue({
      api_key: 'key',
      is_active: true,
      metadata: { site_id: 'site-1' },
    });
    mockCreateContact.mockRejectedValue(new Error('API error'));

    // Should NOT throw
    await expect(
      syncLeadToKajabi({
        userId: 'user-1',
        funnelPageId: 'fp-1',
        lead: { email: 'test@example.com' },
      })
    ).resolves.toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/lib/integrations/kajabi/sync.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write the sync implementation**

```typescript
// src/lib/integrations/kajabi/sync.ts

import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { KajabiClient } from './client';
import type { KajabiSyncParams } from './types';

/**
 * Sync a captured lead to Kajabi.
 *
 * Fire-and-forget: errors are logged but never thrown,
 * so it can be called without blocking the lead capture response.
 */
export async function syncLeadToKajabi(params: KajabiSyncParams): Promise<void> {
  try {
    const { userId, funnelPageId, lead } = params;

    // 1. Check account-level connection
    const integration = await getUserIntegration(userId, 'kajabi');
    if (!integration || !integration.api_key || !integration.is_active) {
      return;
    }

    const siteId = (integration.metadata as { site_id?: string })?.site_id;
    if (!siteId) {
      return;
    }

    // 2. Check funnel-level toggle
    const supabase = createSupabaseAdminClient();
    const { data: funnelIntegration, error } = await supabase
      .from('funnel_integrations')
      .select('id, is_active, settings')
      .eq('provider', 'kajabi')
      .eq('funnel_page_id', funnelPageId)
      .single();

    if (error || !funnelIntegration || !funnelIntegration.is_active) {
      return;
    }

    // 3. Create contact
    const client = new KajabiClient(integration.api_key, siteId);
    const { id: contactId } = await client.createContact(
      lead.email,
      lead.name || undefined
    );

    // 4. Apply tags if configured
    const settings = funnelIntegration.settings as { tag_ids?: string[] } | null;
    if (settings?.tag_ids && settings.tag_ids.length > 0) {
      await client.addTagsToContact(contactId, settings.tag_ids);
    }
  } catch (err) {
    console.error('[Kajabi sync] Unexpected error:', err instanceof Error ? err.message : err);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/lib/integrations/kajabi/sync.test.ts --no-coverage`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/integrations/kajabi/sync.ts src/__tests__/lib/integrations/kajabi/sync.test.ts
git commit -m "feat(kajabi): add fire-and-forget lead sync function"
```

---

### Task 5: Wire Sync into Lead Capture Route

**Files:**
- Modify: `src/app/api/public/lead/route.ts`

**Step 1: Add import**

Add this import alongside the existing GoHighLevel/HeyReach imports at the top of the file:

```typescript
import { syncLeadToKajabi } from '@/lib/integrations/kajabi/sync';
```

**Step 2: Add sync call in `after()` callback**

Inside the `after()` callback of the POST handler, add the Kajabi sync call right after the HeyReach sync (same fire-and-forget pattern):

```typescript
  // Sync to Kajabi
  await syncLeadToKajabi({
    userId: funnel.user_id,
    funnelPageId: funnelPageId,
    lead: {
      email: lead.email,
      name: lead.name,
    },
  }).catch((err) => logApiError('public/lead/kajabi', err, { leadId: lead.id }));
```

**Step 3: Commit**

```bash
git add src/app/api/public/lead/route.ts
git commit -m "feat(kajabi): wire sync into lead capture route"
```

---

### Task 6: Add 'kajabi' to Funnel Integration Provider List

**Files:**
- Modify: `src/app/api/funnels/[id]/integrations/route.ts`

**Step 1: Add 'kajabi' to VALID_FUNNEL_PROVIDERS**

Find line:
```typescript
const VALID_FUNNEL_PROVIDERS = ['kit', 'mailerlite', 'mailchimp', 'activecampaign', 'gohighlevel', 'heyreach'] as const;
```

Replace with:
```typescript
const VALID_FUNNEL_PROVIDERS = ['kit', 'mailerlite', 'mailchimp', 'activecampaign', 'gohighlevel', 'heyreach', 'kajabi'] as const;
```

**Step 2: Commit**

```bash
git add src/app/api/funnels/[id]/integrations/route.ts
git commit -m "feat(kajabi): add kajabi to valid funnel providers"
```

---

### Task 7: Settings UI Component

**Files:**
- Create: `src/components/settings/KajabiSettings.tsx`
- Modify: `src/components/settings/IntegrationsSettings.tsx`

**Step 1: Create KajabiSettings component**

Reference: `GoHighLevelSettings.tsx` pattern — same states, same UI, but with two inputs (API Key + Site ID).

```typescript
// src/components/settings/KajabiSettings.tsx

'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, BookOpen } from 'lucide-react';
import { logError } from '@/lib/utils/logger';

interface KajabiSettingsProps {
  isConnected: boolean;
  lastVerifiedAt: string | null;
}

export function KajabiSettings({ isConnected, lastVerifiedAt }: KajabiSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [siteId, setSiteId] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleConnect = async () => {
    if (!apiKey.trim() || !siteId.trim()) return;

    setConnecting(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/integrations/kajabi/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, site_id: siteId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFeedback({
          type: 'error',
          message: data.error || 'Failed to connect Kajabi',
        });
        return;
      }

      setFeedback({ type: 'success', message: 'Connected successfully! Refreshing...' });
      setApiKey('');
      setSiteId('');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      logError('settings/kajabi', error, { step: 'connect_error' });
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to connect',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/integrations/kajabi/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.verified) {
        setFeedback({ type: 'success', message: 'Connection verified successfully' });
      } else {
        setFeedback({
          type: 'error',
          message: 'Connection could not be verified. Your API key may have been revoked.',
        });
      }
    } catch (error) {
      logError('settings/kajabi', error, { step: 'verify_error' });
      setFeedback({
        type: 'error',
        message: 'Failed to verify connection',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Kajabi? Leads will no longer be pushed to your Kajabi account.')) {
      return;
    }

    setDisconnecting(true);
    setFeedback(null);

    try {
      await fetch('/api/integrations/kajabi/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      window.location.reload();
    } catch (error) {
      logError('settings/kajabi', error, { step: 'disconnect_error' });
      setFeedback({
        type: 'error',
        message: 'Failed to disconnect',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
            <BookOpen className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="font-medium">Kajabi</p>
            <p className="text-xs text-muted-foreground">
              Push leads to Kajabi as contacts when they opt in
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
            Your Kajabi account is connected. New funnel leads will be automatically created as contacts.
          </p>

          {lastVerifiedAt && (
            <p className="text-xs text-muted-foreground">
              Last verified: {new Date(lastVerifiedAt).toLocaleDateString()}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
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
          <p className="text-sm text-muted-foreground">
            Enter your Kajabi API key and Site ID to connect your account.
          </p>

          <div>
            <label className="text-xs text-muted-foreground">API Key</label>
            <div className="relative mt-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your Kajabi API key"
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

          <div>
            <label className="text-xs text-muted-foreground">Site ID</label>
            <input
              type="text"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              placeholder="Your Kajabi Site ID"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleConnect}
              disabled={connecting || !apiKey.trim() || !siteId.trim()}
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
                setSiteId('');
                setFeedback(null);
              }}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Find your API key in Kajabi Admin &gt; User API Keys. Your Site ID is in the URL when logged in (e.g., app.kajabi.com/admin/sites/<strong>YOUR_SITE_ID</strong>).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect Kajabi to automatically push funnel leads to your Kajabi account as contacts.
          </p>

          <button
            onClick={() => setExpanded(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Connect Kajabi
          </button>
        </div>
      )}

      {feedback?.type === 'success' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          {feedback.message}
        </p>
      )}

      {feedback?.type === 'error' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-red-500">
          <XCircle className="h-4 w-4" />
          {feedback.message}
        </p>
      )}
    </div>
  );
}
```

**Step 2: Add KajabiSettings to IntegrationsSettings**

In `src/components/settings/IntegrationsSettings.tsx`:

Add import:
```typescript
import { KajabiSettings } from '@/components/settings/KajabiSettings';
```

Add lookup (alongside `gohighlevelIntegration`):
```typescript
const kajabiIntegration = integrations.find((i) => i.service === 'kajabi');
```

Add to the CRM section (right after `<GoHighLevelSettings ... />`):
```typescript
          <KajabiSettings
            isConnected={kajabiIntegration?.is_active ?? false}
            lastVerifiedAt={kajabiIntegration?.last_verified_at ?? null}
          />
```

**Step 3: Commit**

```bash
git add src/components/settings/KajabiSettings.tsx src/components/settings/IntegrationsSettings.tsx
git commit -m "feat(kajabi): add Kajabi settings UI to integrations page"
```

---

### Task 8: Funnel-Level Kajabi Toggle with Tag Picker

**Files:**
- Modify: `src/components/funnel/FunnelIntegrationsTab.tsx`

**Step 1: Read the current file**

Read `src/components/funnel/FunnelIntegrationsTab.tsx` to understand its structure. Look for `GHLFunnelToggle` and `HeyReachFunnelToggle` components to understand the pattern.

**Step 2: Add KajabiFunnelToggle component**

Add a new component following the same pattern as `GHLFunnelToggle`:

- Toggle to enable/disable (calls `POST /api/funnels/[id]/integrations` with `provider: 'kajabi'`)
- Multi-select tag picker (fetches tags from `GET /api/integrations/kajabi/tags`)
- Selected tags stored in `settings.tag_ids`

The toggle should:
1. Check if Kajabi is connected at account level (fetch `/api/integrations/kajabi/verify` or check the existing integrations prop)
2. If not connected, show "Connect Kajabi in Settings first" link
3. If connected, show toggle + tag picker

**Step 3: Add KajabiFunnelToggle to the tab**

Add the component in the CRM section alongside the GHL toggle.

**Step 4: Commit**

```bash
git add src/components/funnel/FunnelIntegrationsTab.tsx
git commit -m "feat(kajabi): add funnel-level toggle with tag picker"
```

---

### Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add Kajabi integration docs**

Add a new section after "HeyReach LinkedIn Delivery Integration" following the same documentation pattern:

```markdown
## Kajabi Integration

Push leads to Kajabi as contacts on capture. Account-level API key + Site ID auth, per-funnel toggle with tag picker.

### Data Flow

\`\`\`
User connects Kajabi in Settings → API key + Site ID validated → stored in user_integrations (service: 'kajabi', metadata: { site_id })
User enables Kajabi per-funnel → toggle stored in funnel_integrations (provider: 'kajabi', settings: { tag_ids })
Lead opts in → POST /api/public/lead → syncLeadToKajabi() [fire-and-forget]
  → checks account + funnel toggles
  → POST /v1/contacts (create contact with site relationship)
  → POST /v1/contacts/{id}/relationships/tags (apply tags)
  → errors logged only (never blocks lead capture)
\`\`\`

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/kajabi/connect` | POST | Validate API key + Site ID, save integration |
| `/api/integrations/kajabi/verify` | POST | Re-validate stored credentials |
| `/api/integrations/kajabi/disconnect` | POST | Remove key + deactivate funnel toggles |
| `/api/integrations/kajabi/tags` | GET | Fetch available Kajabi tags (for funnel picker) |

### Key Files

- `src/lib/integrations/kajabi/types.ts` — Kajabi API types (JSON:API spec)
- `src/lib/integrations/kajabi/client.ts` — API client (createContact, addTagsToContact, listTags, testConnection)
- `src/lib/integrations/kajabi/sync.ts` — `syncLeadToKajabi()` fire-and-forget, called from lead capture route
- `src/components/settings/KajabiSettings.tsx` — Settings UI (connect/verify/disconnect)
- `src/components/funnel/FunnelIntegrationsTab.tsx` — Per-funnel toggle (KajabiFunnelToggle with tag picker)

### Notes

- Kajabi API requires Pro plan
- JSON:API spec: Content-Type `application/vnd.api+json`, request bodies use `data.type/attributes/relationships` format
- Site ID stored in `user_integrations.metadata.site_id` (required for contact creation)
- Contact creation includes `subscribed: true` and site relationship
- Duplicate emails handled gracefully by Kajabi (returns existing contact)
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Kajabi integration documentation to CLAUDE.md"
```

---

### Task 10: Build Verification + Deploy

**Step 1: Run all Kajabi tests**

Run: `npx jest src/__tests__/lib/integrations/kajabi/ src/__tests__/api/integrations/kajabi/ --no-coverage`
Expected: All tests PASS

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run full build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Deploy**

Run: `vercel --prod`
Expected: Deploys successfully to magnetlab.app

**Step 5: Commit any fixes**

If any issues found, fix and commit before deploying.
