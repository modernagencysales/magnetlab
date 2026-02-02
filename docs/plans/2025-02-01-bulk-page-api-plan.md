# Bulk Page Creation API — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an API-driven bulk page creation system with API key auth, user-level theme defaults, and in-app API documentation.

**Architecture:** Three new DB migrations (theme defaults on users, external_url on lead_magnets, api_keys table). An auth middleware layer that accepts both session and bearer token auth. A bulk create endpoint that creates lightweight lead magnets + funnel pages in a loop. A static docs page in the dashboard.

**Tech Stack:** Next.js 15 API routes, Supabase, Zod validation, crypto for API key hashing.

---

### Task 1: Migration — Add theme defaults to users table

**Files:**
- Create: `supabase/migrations/20260201_user_theme_defaults.sql`

**Step 1: Write the migration**

```sql
-- Add user-level theme defaults
-- New funnel pages inherit these values when no theme is specified
ALTER TABLE users
  ADD COLUMN default_theme TEXT DEFAULT 'dark'
    CHECK (default_theme IN ('dark', 'light', 'custom')),
  ADD COLUMN default_primary_color TEXT DEFAULT '#8b5cf6',
  ADD COLUMN default_background_style TEXT DEFAULT 'solid'
    CHECK (default_background_style IN ('solid', 'gradient', 'pattern')),
  ADD COLUMN default_logo_url TEXT;
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260201_user_theme_defaults.sql
git commit -m "feat: add user-level theme default columns"
```

---

### Task 2: Migration — Add external_url to lead_magnets

**Files:**
- Create: `supabase/migrations/20260201_lead_magnet_external_url.sql`

**Step 1: Write the migration**

```sql
-- Add external_url for imported lead magnets that are just a link
ALTER TABLE lead_magnets
  ADD COLUMN external_url TEXT;
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260201_lead_magnet_external_url.sql
git commit -m "feat: add external_url column to lead_magnets"
```

---

### Task 3: Migration — Create api_keys table

**Files:**
- Create: `supabase/migrations/20260201_api_keys.sql`

**Step 1: Write the migration**

```sql
-- API keys for programmatic access
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- RLS policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own API keys"
  ON api_keys FOR ALL
  USING (user_id = auth.uid());
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260201_api_keys.sql
git commit -m "feat: add api_keys table"
```

---

### Task 4: API key auth utility

**Files:**
- Create: `src/lib/auth/api-key.ts`

**Step 1: Write the failing test**

Create `src/__tests__/lib/auth/api-key.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { hashApiKey, generateApiKey, verifyApiKeyFromRequest } from '@/lib/auth/api-key';

describe('API Key utilities', () => {
  describe('generateApiKey', () => {
    it('should return a key starting with ml_live_', () => {
      const { rawKey } = generateApiKey();
      expect(rawKey).toMatch(/^ml_live_/);
    });

    it('should return a hash and prefix', () => {
      const { rawKey, keyHash, keyPrefix } = generateApiKey();
      expect(keyHash).toBeTruthy();
      expect(keyPrefix).toBe(rawKey.slice(-4));
    });
  });

  describe('hashApiKey', () => {
    it('should produce consistent hashes', () => {
      const hash1 = hashApiKey('test-key');
      const hash2 = hashApiKey('test-key');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('key-1');
      const hash2 = hashApiKey('key-2');
      expect(hash1).not.toBe(hash2);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/auth/api-key.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/lib/auth/api-key.ts`:

```typescript
import { createHash, randomBytes } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const API_KEY_PREFIX = 'ml_live_';

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = API_KEY_PREFIX + randomBytes(32).toString('hex');
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(-4);
  return { rawKey, keyHash, keyPrefix };
}

/**
 * Resolve a user ID from an API request.
 * Checks for Bearer token first, then falls back to session auth.
 * Returns the user ID string or null if unauthenticated.
 */
export async function resolveUserId(request: Request): Promise<string | null> {
  // Check for Bearer token
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const keyHash = hashApiKey(token);
    const supabase = createSupabaseAdminClient();

    const { data } = await supabase
      .from('api_keys')
      .select('user_id, id')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (data) {
      // Update last_used_at (fire and forget)
      supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id)
        .then(() => {});
      return data.user_id;
    }
    return null;
  }

  // Fall back to session auth
  const { auth } = await import('@/lib/auth');
  const session = await auth();
  return session?.user?.id ?? null;
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/auth/api-key.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/auth/api-key.ts src/__tests__/lib/auth/api-key.test.ts
git commit -m "feat: API key generation, hashing, and auth resolution"
```

---

### Task 5: API key management endpoints

**Files:**
- Create: `src/app/api/keys/route.ts`
- Create: `src/app/api/keys/[id]/route.ts`

**Step 1: Write the failing test**

Create `src/__tests__/api/keys/route.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { POST, GET } from '@/app/api/keys/route';

const mockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
  order: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

describe('API Keys Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.order.mockReturnValue(mockSupabaseClient);
  });

  describe('POST /api/keys', () => {
    it('should return 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);
      const request = new Request('http://localhost:3000/api/keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('should create an API key and return the raw key', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'key-uuid', name: 'Test Key', created_at: '2025-02-01' },
        error: null,
      });

      const request = new Request('http://localhost:3000/api/keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.key).toMatch(/^ml_live_/);
      expect(data.name).toBe('Test Key');
      expect(data.id).toBe('key-uuid');
    });
  });

  describe('GET /api/keys', () => {
    it('should list API keys without exposing hashes', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
      mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [{ id: 'k1', name: 'Key 1', key_prefix: 'ab12', is_active: true, last_used_at: null, created_at: '2025-02-01' }],
        error: null,
      });

      const request = new Request('http://localhost:3000/api/keys');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.keys[0]).not.toHaveProperty('key_hash');
      expect(data.keys[0].prefix).toBe('ab12');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/keys/route.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write POST/GET /api/keys**

Create `src/app/api/keys/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { generateApiKey } from '@/lib/auth/api-key';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const name = body.name?.trim();
    if (!name || name.length > 100) {
      return ApiErrors.validationError('name is required (max 100 chars)');
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: session.user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name,
      })
      .select('id, name, created_at')
      .single();

    if (error) {
      logApiError('keys/create', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to create API key');
    }

    return NextResponse.json(
      { id: data.id, key: rawKey, name: data.name, prefix: keyPrefix, createdAt: data.created_at },
      { status: 201 }
    );
  } catch (error) {
    logApiError('keys/create', error);
    return ApiErrors.internalError();
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, is_active, last_used_at, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logApiError('keys/list', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to list API keys');
    }

    const keys = (data || []).map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.key_prefix,
      isActive: k.is_active,
      lastUsedAt: k.last_used_at,
      createdAt: k.created_at,
    }));

    return NextResponse.json({ keys });
  } catch (error) {
    logApiError('keys/list', error);
    return ApiErrors.internalError();
  }
}
```

**Step 4: Write DELETE /api/keys/[id]**

Create `src/app/api/keys/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      logApiError('keys/revoke', error, { userId: session.user.id, keyId: id });
      return ApiErrors.databaseError('Failed to revoke API key');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('keys/revoke', error);
    return ApiErrors.internalError();
  }
}
```

**Step 5: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/keys/route.test.ts --no-coverage`
Expected: PASS

**Step 6: Commit**

```bash
git add src/app/api/keys/ src/__tests__/api/keys/
git commit -m "feat: API key create, list, and revoke endpoints"
```

---

### Task 6: Bulk create Zod schema

**Files:**
- Modify: `src/lib/validations/api.ts`

**Step 1: Add the schema**

Append to `src/lib/validations/api.ts` before the validation helper section:

```typescript
// ============================================
// BULK IMPORT SCHEMAS
// ============================================

export const bulkPageItemSchema = z.object({
  title: z.string().min(1, 'title is required').max(200),
  slug: z.string().max(50).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens').optional(),
  optinHeadline: z.string().min(1, 'optinHeadline is required').max(500),
  optinSubline: z.string().max(1000).optional(),
  optinButtonText: z.string().max(100).optional(),
  leadMagnetUrl: z.string().url('leadMagnetUrl must be a valid URL'),
  thankyouHeadline: z.string().max(500).optional(),
  thankyouSubline: z.string().max(1000).optional(),
  autoPublish: z.boolean().optional(),
});

export type BulkPageItemInput = z.infer<typeof bulkPageItemSchema>;

export const bulkCreatePagesSchema = z.object({
  pages: z.array(bulkPageItemSchema).min(1, 'At least one page is required').max(100, 'Maximum 100 pages per request'),
});

export type BulkCreatePagesInput = z.infer<typeof bulkCreatePagesSchema>;
```

**Step 2: Commit**

```bash
git add src/lib/validations/api.ts
git commit -m "feat: add Zod schemas for bulk page creation"
```

---

### Task 7: Bulk create endpoint

**Files:**
- Create: `src/app/api/funnel/bulk/route.ts`
- Create: `src/app/api/funnel/bulk/template/route.ts`

**Step 1: Write the failing test**

Create `src/__tests__/api/funnel/bulk.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { POST } from '@/app/api/funnel/bulk/route';

const mockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
  update: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@/lib/auth/api-key', () => ({
  resolveUserId: jest.fn(),
}));

import { resolveUserId } from '@/lib/auth/api-key';
const mockResolveUserId = resolveUserId as jest.MockedFunction<typeof resolveUserId>;

describe('POST /api/funnel/bulk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
  });

  it('should return 401 if not authenticated', async () => {
    mockResolveUserId.mockResolvedValueOnce(null);
    const request = new Request('http://localhost:3000/api/funnel/bulk', {
      method: 'POST',
      body: JSON.stringify({ pages: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 if pages array is empty', async () => {
    mockResolveUserId.mockResolvedValueOnce('user-123');
    const request = new Request('http://localhost:3000/api/funnel/bulk', {
      method: 'POST',
      body: JSON.stringify({ pages: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 400 if a page is missing required fields', async () => {
    mockResolveUserId.mockResolvedValueOnce('user-123');
    const request = new Request('http://localhost:3000/api/funnel/bulk', {
      method: 'POST',
      body: JSON.stringify({ pages: [{ title: 'Test' }] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should create pages and return results', async () => {
    mockResolveUserId.mockResolvedValueOnce('user-123');

    // Mock user profile defaults
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { default_theme: 'dark', default_primary_color: '#8b5cf6', default_background_style: 'solid', default_logo_url: null, username: 'testuser' },
      error: null,
    });

    // Mock slug check (no collision)
    mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    // Mock lead magnet insert
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { id: 'lm-1' },
      error: null,
    });

    // Mock funnel page insert
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { id: 'fp-1', slug: 'test-page' },
      error: null,
    });

    const request = new Request('http://localhost:3000/api/funnel/bulk', {
      method: 'POST',
      body: JSON.stringify({
        pages: [{
          title: 'Test Page',
          optinHeadline: 'Get the guide',
          leadMagnetUrl: 'https://example.com/guide.pdf',
        }],
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(1);
    expect(data.failed).toBe(0);
    expect(data.results[0].status).toBe('created');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/funnel/bulk.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write the bulk create endpoint**

Create `src/app/api/funnel/bulk/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { resolveUserId } from '@/lib/auth/api-key';
import { validateBody, bulkCreatePagesSchema, type BulkPageItemInput } from '@/lib/validations/api';
import { slugify } from '@/lib/utils';

interface BulkResult {
  index: number;
  status: 'created' | 'failed';
  id?: string;
  slug?: string;
  error?: string;
}

export async function POST(request: Request) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) return ApiErrors.unauthorized();

    const body = await request.json();
    const validation = validateBody(body, bulkCreatePagesSchema);
    if (!validation.success) {
      return ApiErrors.validationError(validation.error, validation.details);
    }

    const { pages } = validation.data;
    const supabase = createSupabaseAdminClient();

    // Fetch user profile for theme defaults and username
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('default_theme, default_primary_color, default_background_style, default_logo_url, username')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return ApiErrors.internalError('Failed to load user profile');
    }

    const results: BulkResult[] = [];
    let created = 0;
    let failed = 0;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      try {
        const result = await createSinglePage(supabase, userId, profile, page, i);
        results.push(result);
        if (result.status === 'created') created++;
        else failed++;
      } catch (err) {
        results.push({ index: i, status: 'failed', error: 'Unexpected error' });
        failed++;
        logApiError('funnel/bulk/item', err, { userId, index: i });
      }
    }

    return NextResponse.json({ created, failed, results });
  } catch (error) {
    logApiError('funnel/bulk', error);
    return ApiErrors.internalError('Bulk creation failed');
  }
}

async function createSinglePage(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  profile: { default_theme: string; default_primary_color: string; default_background_style: string; default_logo_url: string | null; username: string | null },
  page: BulkPageItemInput,
  index: number
): Promise<BulkResult> {
  const slug = page.slug || slugify(page.title).slice(0, 50);

  // Check slug collision
  const { data: slugExists } = await supabase
    .from('funnel_pages')
    .select('id')
    .eq('user_id', userId)
    .eq('slug', slug)
    .single();

  if (slugExists) {
    return { index, status: 'failed', error: `Slug "${slug}" already exists` };
  }

  // Create lightweight lead magnet
  const { data: leadMagnet, error: lmError } = await supabase
    .from('lead_magnets')
    .insert({
      user_id: userId,
      title: page.title,
      external_url: page.leadMagnetUrl,
      archetype: 'resource-list',
      status: 'published',
    })
    .select('id')
    .single();

  if (lmError || !leadMagnet) {
    return { index, status: 'failed', error: 'Failed to create lead magnet' };
  }

  // Create funnel page with theme defaults from profile
  const { data: funnelPage, error: fpError } = await supabase
    .from('funnel_pages')
    .insert({
      lead_magnet_id: leadMagnet.id,
      user_id: userId,
      slug,
      optin_headline: page.optinHeadline,
      optin_subline: page.optinSubline || null,
      optin_button_text: page.optinButtonText || 'Get It Now',
      thankyou_headline: page.thankyouHeadline || 'Thanks! Check your email.',
      thankyou_subline: page.thankyouSubline || null,
      qualification_pass_message: 'Great! Book a call below.',
      qualification_fail_message: 'Thanks for your interest!',
      theme: profile.default_theme || 'dark',
      primary_color: profile.default_primary_color || '#8b5cf6',
      background_style: profile.default_background_style || 'solid',
      logo_url: profile.default_logo_url || null,
      is_published: page.autoPublish === true,
      published_at: page.autoPublish === true ? new Date().toISOString() : null,
    })
    .select('id, slug')
    .single();

  if (fpError || !funnelPage) {
    // Clean up the lead magnet we just created
    await supabase.from('lead_magnets').delete().eq('id', leadMagnet.id);
    return { index, status: 'failed', error: 'Failed to create funnel page' };
  }

  return { index, status: 'created', id: funnelPage.id, slug: funnelPage.slug };
}
```

**Step 4: Write the template endpoint**

Create `src/app/api/funnel/bulk/template/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    description: 'Bulk page creation template. POST this shape to /api/funnel/bulk',
    pages: [
      {
        title: 'Your Lead Magnet Title (required)',
        slug: 'your-slug (optional, auto-generated from title)',
        optinHeadline: 'The headline visitors see (required)',
        optinSubline: 'Supporting text (optional)',
        optinButtonText: 'Button text (optional, default: Get It Now)',
        leadMagnetUrl: 'https://example.com/your-resource.pdf (required)',
        thankyouHeadline: 'Thank you page headline (optional)',
        thankyouSubline: 'Thank you page subtext (optional)',
        autoPublish: false,
      },
    ],
  });
}
```

**Step 5: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/funnel/bulk.test.ts --no-coverage`
Expected: PASS

**Step 6: Commit**

```bash
git add src/app/api/funnel/bulk/ src/__tests__/api/funnel/bulk.test.ts
git commit -m "feat: bulk page creation endpoint with template"
```

---

### Task 8: Update existing funnel creation to inherit theme defaults

**Files:**
- Modify: `src/app/api/funnel/route.ts` (lines 124-142)

**Step 1: Update the POST handler**

In the existing POST handler in `src/app/api/funnel/route.ts`, after verifying lead magnet ownership (~line 92), add a profile fetch and use its defaults. Replace the hardcoded theme defaults (lines 138-141) with profile values:

```typescript
// After the leadMagnet check, before slug collision check, add:
const { data: profile } = await supabase
  .from('users')
  .select('default_theme, default_primary_color, default_background_style, default_logo_url')
  .eq('id', session.user.id)
  .single();

// Then in funnelInsertData, change:
//   theme: funnelData.theme || 'dark',
//   primary_color: funnelData.primaryColor || '#8b5cf6',
//   background_style: funnelData.backgroundStyle || 'solid',
//   logo_url: funnelData.logoUrl || null,
// To:
//   theme: funnelData.theme || profile?.default_theme || 'dark',
//   primary_color: funnelData.primaryColor || profile?.default_primary_color || '#8b5cf6',
//   background_style: funnelData.backgroundStyle || profile?.default_background_style || 'solid',
//   logo_url: funnelData.logoUrl || profile?.default_logo_url || null,
```

**Step 2: Run existing funnel tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/funnel/route.test.ts --no-coverage`
Expected: PASS (mocks return undefined for new fields, falls through to hardcoded defaults)

**Step 3: Commit**

```bash
git add src/app/api/funnel/route.ts
git commit -m "feat: single funnel creation inherits user theme defaults"
```

---

### Task 9: Add Docs nav item to dashboard

**Files:**
- Modify: `src/components/dashboard/DashboardNav.tsx` (line 20-27)

**Step 1: Add the nav item**

Add `BookOpen` to the lucide-react import, and add an entry to the `navItems` array:

```typescript
// Add to imports:
import { ..., BookOpen } from 'lucide-react';

// Add to navItems array (after Analytics, before Settings):
{ href: '/docs', label: 'API Docs', icon: BookOpen },
```

**Step 2: Commit**

```bash
git add src/components/dashboard/DashboardNav.tsx
git commit -m "feat: add API Docs link to dashboard nav"
```

---

### Task 10: In-app API documentation page

**Files:**
- Create: `src/app/(dashboard)/docs/page.tsx`

**Step 1: Create the docs page**

```tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation - MagnetLab',
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-4 overflow-x-auto text-sm leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({ method, path, description }: { method: string; path: string; description: string }) {
  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    POST: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <div className="flex items-start gap-3 mb-2">
      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${methodColors[method] || ''}`}>
        {method}
      </span>
      <div>
        <code className="text-sm font-mono text-zinc-200">{path}</code>
        <p className="text-sm text-zinc-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
      <p className="text-zinc-400 mb-8">
        Programmatic access to MagnetLab for bulk operations and automation.
      </p>

      {/* Authentication */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 border-b border-zinc-800 pb-2">Authentication</h2>
        <p className="text-zinc-300 mb-4">
          All API endpoints require authentication via an API key. Generate a key from{' '}
          <strong>Settings &gt; API Keys</strong>, then include it as a Bearer token:
        </p>
        <CodeBlock>{`curl -H "Authorization: Bearer ml_live_your_key_here" \\
  https://your-app.com/api/funnel/bulk`}</CodeBlock>
        <p className="text-zinc-400 text-sm mt-3">
          API keys provide the same access as your logged-in session. Keep them secret.
          Revoke compromised keys immediately from Settings.
        </p>
      </section>

      {/* API Keys */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 border-b border-zinc-800 pb-2">API Key Management</h2>

        <Endpoint method="POST" path="/api/keys" description="Create a new API key. The raw key is returned once — save it." />
        <CodeBlock>{`curl -X POST https://your-app.com/api/keys \\
  -H "Authorization: Bearer ml_live_existing_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Import Script"}'

# Response:
{
  "id": "uuid",
  "key": "ml_live_abc123...",
  "name": "Import Script",
  "prefix": "...c123",
  "createdAt": "2025-02-01T00:00:00Z"
}`}</CodeBlock>

        <div className="mt-6">
          <Endpoint method="GET" path="/api/keys" description="List all API keys (prefix and metadata only, never the full key)." />
        </div>

        <div className="mt-6">
          <Endpoint method="DELETE" path="/api/keys/:id" description="Revoke an API key. Takes effect immediately." />
        </div>
      </section>

      {/* Bulk Create */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 border-b border-zinc-800 pb-2">Bulk Page Creation</h2>

        <Endpoint method="POST" path="/api/funnel/bulk" description="Create multiple landing pages in one request (max 100)." />

        <h3 className="text-lg font-medium mt-6 mb-3">Request Body</h3>
        <CodeBlock>{`{
  "pages": [
    {
      "title": "LinkedIn Growth Playbook",
      "slug": "linkedin-growth-playbook",
      "optinHeadline": "Get the Playbook",
      "optinSubline": "10 steps to 10k followers",
      "optinButtonText": "Download Now",
      "leadMagnetUrl": "https://example.com/playbook.pdf",
      "thankyouHeadline": "Check your inbox!",
      "thankyouSubline": "Here's what to do next",
      "autoPublish": false
    }
  ]
}`}</CodeBlock>

        <h3 className="text-lg font-medium mt-6 mb-3">Fields</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="py-2 pr-4 text-zinc-300">Field</th>
                <th className="py-2 pr-4 text-zinc-300">Required</th>
                <th className="py-2 text-zinc-300">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">title</td>
                <td className="py-2 pr-4 text-emerald-400">Yes</td>
                <td className="py-2">Lead magnet name (max 200 chars)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">optinHeadline</td>
                <td className="py-2 pr-4 text-emerald-400">Yes</td>
                <td className="py-2">Main headline on the opt-in page (max 500 chars)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">leadMagnetUrl</td>
                <td className="py-2 pr-4 text-emerald-400">Yes</td>
                <td className="py-2">URL to the hosted resource</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">slug</td>
                <td className="py-2 pr-4 text-zinc-500">No</td>
                <td className="py-2">URL path segment. Auto-generated from title if omitted.</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">optinSubline</td>
                <td className="py-2 pr-4 text-zinc-500">No</td>
                <td className="py-2">Supporting text below the headline</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">optinButtonText</td>
                <td className="py-2 pr-4 text-zinc-500">No</td>
                <td className="py-2">CTA button text (default: &quot;Get It Now&quot;)</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">thankyouHeadline</td>
                <td className="py-2 pr-4 text-zinc-500">No</td>
                <td className="py-2">Thank-you page headline</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">thankyouSubline</td>
                <td className="py-2 pr-4 text-zinc-500">No</td>
                <td className="py-2">Thank-you page supporting text</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-mono text-xs">autoPublish</td>
                <td className="py-2 pr-4 text-zinc-500">No</td>
                <td className="py-2">Publish immediately (default: false)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-medium mt-6 mb-3">Response</h3>
        <CodeBlock>{`{
  "created": 12,
  "failed": 1,
  "results": [
    { "index": 0, "status": "created", "id": "uuid", "slug": "linkedin-growth-playbook" },
    { "index": 5, "status": "failed", "error": "Slug \\"my-slug\\" already exists" }
  ]
}`}</CodeBlock>

        <h3 className="text-lg font-medium mt-6 mb-3">Theme</h3>
        <p className="text-zinc-400">
          Pages inherit your global theme settings (dark/light, primary color, background style, logo).
          Set these in <strong>Settings &gt; Theme Defaults</strong>.
        </p>
      </section>

      {/* Template */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 border-b border-zinc-800 pb-2">Template</h2>
        <Endpoint method="GET" path="/api/funnel/bulk/template" description="Get an example payload with field descriptions." />
        <CodeBlock>{`curl https://your-app.com/api/funnel/bulk/template`}</CodeBlock>
      </section>

      {/* Errors */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 border-b border-zinc-800 pb-2">Error Reference</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="py-2 pr-4 text-zinc-300">Status</th>
                <th className="py-2 pr-4 text-zinc-300">Code</th>
                <th className="py-2 text-zinc-300">Meaning</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4">400</td>
                <td className="py-2 pr-4 font-mono text-xs">VALIDATION_ERROR</td>
                <td className="py-2">Invalid request body. Check the details field for specifics.</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4">401</td>
                <td className="py-2 pr-4 font-mono text-xs">UNAUTHORIZED</td>
                <td className="py-2">Missing or invalid API key / session.</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4">409</td>
                <td className="py-2 pr-4 font-mono text-xs">CONFLICT</td>
                <td className="py-2">Resource already exists (e.g., duplicate slug).</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4">429</td>
                <td className="py-2 pr-4 font-mono text-xs">RATE_LIMITED</td>
                <td className="py-2">Too many requests. Back off and retry.</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="py-2 pr-4">500</td>
                <td className="py-2 pr-4 font-mono text-xs">INTERNAL_ERROR</td>
                <td className="py-2">Server error. Retry or contact support.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Full Example */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 border-b border-zinc-800 pb-2">Full Example</h2>
        <CodeBlock>{`curl -X POST https://your-app.com/api/funnel/bulk \\
  -H "Authorization: Bearer ml_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "pages": [
      {
        "title": "LinkedIn Growth Playbook",
        "optinHeadline": "Get the Playbook That Grew My Network 10x",
        "optinSubline": "Step-by-step guide used by 500+ creators",
        "leadMagnetUrl": "https://drive.google.com/file/d/abc123/view",
        "autoPublish": true
      },
      {
        "title": "Cold Email Templates",
        "slug": "cold-email-templates",
        "optinHeadline": "47 Cold Email Templates That Get Replies",
        "optinButtonText": "Send Me the Templates",
        "leadMagnetUrl": "https://notion.so/cold-emails-xyz",
        "thankyouHeadline": "Templates are on the way!",
        "thankyouSubline": "Check your inbox in the next 2 minutes"
      }
    ]
  }'`}</CodeBlock>
      </section>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/docs/page.tsx
git commit -m "feat: add in-app API documentation page"
```

---

### Task 11: Run full test suite and typecheck

**Step 1: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit`
Expected: No errors

**Step 2: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm test -- --no-coverage`
Expected: All tests pass

**Step 3: Fix any issues and commit**

```bash
git add -A
git commit -m "chore: fix any type/test issues from bulk API feature"
```

---

### Task 12: Update middleware to allow /docs route

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Check if /docs needs to be added to protected routes**

The middleware protects dashboard routes. Since `/docs` is under `(dashboard)`, it should already be protected by the layout's `auth()` call. Check if the middleware explicitly lists routes — if so, add `/docs`. If it uses a pattern that already covers dashboard routes, no change needed.

**Step 2: Commit if changed**

```bash
git add src/middleware.ts
git commit -m "feat: add /docs to protected routes in middleware"
```
