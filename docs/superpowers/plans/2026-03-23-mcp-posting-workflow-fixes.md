# MCP Posting Workflow Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps in magnetlab's MCP tooling so agents can publish LinkedIn posts with images on specific accounts, discover connected accounts, and create fully-configured post campaigns — without raw SQL or direct API calls.

**Architecture:** 2 prerequisite bug fixes (publisher image passthrough + account override factory), 1 shared validation helper, 4 new MCP tools with backing API routes/services, and 1 schema drift fix. All changes in standalone magnetlab, synced to mas-platform at the end.

**Tech Stack:** TypeScript, Next.js App Router, Zod, Supabase, Unipile API, MCP SDK (stdio transport)

**Spec:** `docs/superpowers/specs/2026-03-23-mcp-posting-workflow-fixes-design.md`

**Codebase patterns (MUST follow):**
- Auth: `import { auth } from '@/lib/auth'` then `const session = await auth()` (NextAuth v5). NOT `auth`.
- Supabase admin: `import { createSupabaseAdminClient } from '@/lib/utils/supabase-server'` then `const supabase = createSupabaseAdminClient()`. NOT `getServiceClient`.
- MCP client methods: `this.request<T>('GET', url)` or `this.request<T>('POST', url, body)`. There is no `this.get()` or `this.post()` helper.
- MCP validation export: `export const toolSchemas` in `validation.ts`. NOT `validationSchemas`.
- Zod field helpers: use `uuidField` (= `z.string().min(1)`) and `teamIdField` (= `z.string().optional()`). NOT `uuidField`.
- Service signatures: `publishPost(userId, postId)` — userId FIRST, postId SECOND.
- Route handlers: under 30 lines. Delegate to service layer.
- MCP handler registration: add tool name to the flat map in `handlers/index.ts` pointing to the correct handler function.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/server/services/linkedin-accounts.service.ts` | Account discovery, validation helper, Unipile enrichment |
| `src/app/api/content-pipeline/linkedin/accounts/route.ts` | GET — list connected LinkedIn accounts |
| `src/app/api/content-pipeline/posts/direct-publish/route.ts` | POST — direct-publish to LinkedIn |
| `src/app/api/content-pipeline/posts/[id]/upload-image-url/route.ts` | POST — upload image from external URL |
| `src/__tests__/server/services/linkedin-accounts.service.test.ts` | Tests for account service |
| `src/__tests__/api/content-pipeline/direct-publish.test.ts` | Tests for direct-publish route |
| `src/__tests__/api/content-pipeline/upload-image-url.test.ts` | Tests for URL upload route |
| `src/__tests__/api/content-pipeline/linkedin-accounts.test.ts` | Tests for accounts route |
| `src/__tests__/lib/integrations/linkedin-publisher.test.ts` | Tests for publisher fixes |
| `packages/mcp/src/__tests__/validation/posting-workflow.test.ts` | Zod schema tests for all new/modified tools |

### Modified files
| File | What changes |
|------|-------------|
| `src/lib/integrations/linkedin-publisher.ts` | Fix `_imageFile` bug, add `getLinkedInPublisherForAccount()` |
| `src/server/services/posts.service.ts` | Add `directPublish()`, `uploadImageFromUrl()`, modify `publishPost()` for account override |
| `src/app/api/content-pipeline/posts/[id]/publish/route.ts` | Accept `unipile_account_id` in body |
| `packages/mcp/src/tools/posts.ts` | Add 2 new tools, modify `publish_post` |
| `packages/mcp/src/tools/post-campaigns.ts` | Add 3 missing fields to create + update |
| `packages/mcp/src/tools/index.ts` | Register new tools |
| `packages/mcp/src/handlers/posts.ts` | Add handlers for 3 new tools |
| `packages/mcp/src/handlers/post-campaigns.ts` | Pass new fields |
| `packages/mcp/src/handlers/index.ts` | Register new handlers |
| `packages/mcp/src/validation.ts` | Add Zod schemas for new tools, update existing |
| `packages/mcp/src/client.ts` | Add 3 new methods, update `publishPost` signature |

---

## Task 1: Fix Publisher Image Passthrough Bug

The `publishNow` method in `linkedin-publisher.ts` ignores the image parameter. This is a prerequisite for all image publishing to work.

**Files:**
- Modify: `src/lib/integrations/linkedin-publisher.ts:44-46`
- Test: `src/__tests__/lib/integrations/linkedin-publisher.test.ts`

- [ ] **Step 1: Write failing test for image passthrough**

Create `src/__tests__/lib/integrations/linkedin-publisher.test.ts`:

```typescript
/** LinkedIn Publisher tests. Verifies image passthrough and account override factory. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Unipile client
const mockCreatePost = vi.fn().mockResolvedValue({ data: { id: 'post-123' } });
vi.mock('@/lib/integrations/unipile', () => ({
  getUnipileClient: () => ({
    createPost: mockCreatePost,
  }),
}));

// Mock encrypted-storage
vi.mock('@/lib/utils/encrypted-storage', () => ({
  getUserIntegration: vi.fn().mockResolvedValue({
    metadata: { unipile_account_id: 'test-account-id' },
    is_active: true,
  }),
}));

describe('linkedin-publisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('publishNow - image passthrough', () => {
    it('should pass imageFile to Unipile createPost', async () => {
      const { getUserLinkedInPublisher } = await import(
        '@/lib/integrations/linkedin-publisher'
      );
      const publisher = await getUserLinkedInPublisher('user-123');

      const imageFile = {
        buffer: Buffer.from('fake-image'),
        filename: 'test.png',
        mimeType: 'image/png',
      };

      await publisher!.publishNow('Hello world', imageFile);

      expect(mockCreatePost).toHaveBeenCalledWith(
        'test-account-id',
        'Hello world',
        imageFile
      );
    });

    it('should work without imageFile', async () => {
      const { getUserLinkedInPublisher } = await import(
        '@/lib/integrations/linkedin-publisher'
      );
      const publisher = await getUserLinkedInPublisher('user-123');

      await publisher!.publishNow('Hello world');

      expect(mockCreatePost).toHaveBeenCalledWith(
        'test-account-id',
        'Hello world',
        undefined
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern="linkedin-publisher" --no-coverage`

Expected: FAIL — `mockCreatePost` called without the imageFile argument.

- [ ] **Step 3: Fix the publisher**

In `src/lib/integrations/linkedin-publisher.ts`, line 44, change:

```typescript
// FROM (line 44):
async publishNow(content: string, _imageFile?: ImageFile) {
// TO:
async publishNow(content: string, imageFile?: ImageFile) {
```

And line 46, change:

```typescript
// FROM (line 46):
return client.createPost(accountId, content);
// TO:
return client.createPost(accountId, content, imageFile);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern="linkedin-publisher" --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/integrations/linkedin-publisher.ts src/__tests__/lib/integrations/linkedin-publisher.test.ts
git commit -m "fix: pass image file through to Unipile in LinkedIn publisher"
```

---

## Task 2: Add Publisher Account Override Factory

Add `getLinkedInPublisherForAccount(accountId)` so callers can publish from a specific Unipile account without resolving from `user_integrations`.

**Files:**
- Modify: `src/lib/integrations/linkedin-publisher.ts`
- Test: `src/__tests__/lib/integrations/linkedin-publisher.test.ts`

- [ ] **Step 1: Write failing test for account override factory**

Add to the existing test file:

```typescript
describe('getLinkedInPublisherForAccount', () => {
  it('should create publisher bound to specific account ID', async () => {
    const { getLinkedInPublisherForAccount } = await import(
      '@/lib/integrations/linkedin-publisher'
    );
    const publisher = getLinkedInPublisherForAccount('explicit-account-id');

    await publisher.publishNow('Test post');

    expect(mockCreatePost).toHaveBeenCalledWith(
      'explicit-account-id',
      'Test post',
      undefined
    );
  });

  it('should pass image through for explicit account', async () => {
    const { getLinkedInPublisherForAccount } = await import(
      '@/lib/integrations/linkedin-publisher'
    );
    const publisher = getLinkedInPublisherForAccount('explicit-account-id');

    const imageFile = {
      buffer: Buffer.from('img'),
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
    };

    await publisher.publishNow('With image', imageFile);

    expect(mockCreatePost).toHaveBeenCalledWith(
      'explicit-account-id',
      'With image',
      imageFile
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern="linkedin-publisher" --no-coverage`

Expected: FAIL — `getLinkedInPublisherForAccount` is not exported.

- [ ] **Step 3: Implement the factory**

Add to `src/lib/integrations/linkedin-publisher.ts` after the existing `getUserLinkedInPublisher` function:

```typescript
/**
 * Create a LinkedIn publisher bound to a specific Unipile account ID.
 * Use when the caller already knows which account to publish from.
 * Does not look up user_integrations — uses the provided account ID directly.
 */
export function getLinkedInPublisherForAccount(accountId: string): {
  publishNow: (content: string, imageFile?: ImageFile) => Promise<unknown>;
} {
  const client = getUnipileClient();
  return {
    async publishNow(content: string, imageFile?: ImageFile) {
      return client.createPost(accountId, content, imageFile);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern="linkedin-publisher" --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/integrations/linkedin-publisher.ts src/__tests__/lib/integrations/linkedin-publisher.test.ts
git commit -m "feat: add getLinkedInPublisherForAccount factory for explicit account publishing"
```

---

## Task 3: Account Validation Helper + LinkedIn Accounts Service

Shared helper to validate a Unipile account belongs to the authenticated user. Also the service for listing accounts.

**Files:**
- Create: `src/server/services/linkedin-accounts.service.ts`
- Create: `src/__tests__/server/services/linkedin-accounts.service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/server/services/linkedin-accounts.service.test.ts`:

```typescript
/** LinkedIn Accounts Service tests. Validates account access and listing. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSupabaseFrom = vi.fn();
vi.mock('@/lib/utils/supabase-admin', () => ({
  getServiceClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

const mockUnipileAccounts = vi.fn();
vi.mock('@/lib/integrations/unipile', () => ({
  getUnipileClient: () => ({
    get: mockUnipileAccounts,
  }),
}));

describe('linkedin-accounts.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateUnipileAccountAccess', () => {
    it('should return true when account exists in user_integrations', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'row-1', metadata: { unipile_account_id: 'acct-1' } },
                error: null,
              }),
            }),
          }),
        }),
      });

      const { validateUnipileAccountAccess } = await import(
        '@/server/services/linkedin-accounts.service'
      );
      const result = await validateUnipileAccountAccess('user-1', 'acct-1');
      expect(result).toBe(true);
    });

    it('should return false when account not found', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
      });

      const { validateUnipileAccountAccess } = await import(
        '@/server/services/linkedin-accounts.service'
      );
      const result = await validateUnipileAccountAccess('user-1', 'bad-acct');
      expect(result).toBe(false);
    });
  });

  describe('listLinkedInAccounts', () => {
    it('should return accounts from user_integrations', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: [
                {
                  metadata: {
                    unipile_account_id: 'acct-1',
                    unipile_account_name: 'Test User',
                  },
                  is_active: true,
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      const { listLinkedInAccounts } = await import(
        '@/server/services/linkedin-accounts.service'
      );
      const result = await listLinkedInAccounts('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].unipile_account_id).toBe('acct-1');
      expect(result[0].status).toBe('active');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern="linkedin-accounts.service" --no-coverage`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

Create `src/server/services/linkedin-accounts.service.ts`:

```typescript
/** LinkedIn Accounts Service. Account discovery, validation, and Unipile enrichment.
 * Never imports NextRequest/NextResponse. Pure service layer.
 */
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { logError } from '@/lib/utils/logger';

// ─── Types ─────────────────────────────────────────────
interface LinkedInAccount {
  unipile_account_id: string;
  name: string;
  status: string;
  source: 'user' | 'team';
  linkedin_username?: string;
  has_premium?: boolean;
  connected_at?: string;
}

// ─── Account Validation ────────────────────────────────

/**
 * Validate that a Unipile account ID belongs to the authenticated user.
 * Checks user_integrations first, then team_profile_integrations.
 */
export async function validateUnipileAccountAccess(
  userId: string,
  accountId: string
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  // Check user_integrations
  const { data: userInt } = await supabase
    .from('user_integrations')
    .select('id')
    .eq('user_id', userId)
    .eq('service', 'unipile')
    .eq('is_active', true)
    .single();

  if (
    userInt &&
    (await getAccountIdFromRow(supabase, 'user_integrations', userId, accountId))
  ) {
    return true;
  }

  // Check team_profile_integrations via team_profiles the user belongs to
  const { data: teamProfiles } = await supabase
    .from('team_profiles')
    .select('id')
    .eq('user_id', userId);

  if (teamProfiles && teamProfiles.length > 0) {
    const profileIds = teamProfiles.map((tp) => tp.id);
    const { data: teamInts } = await supabase
      .from('team_profile_integrations')
      .select('id, metadata')
      .in('team_profile_id', profileIds)
      .eq('service', 'unipile')
      .eq('is_active', true);

    if (teamInts) {
      return teamInts.some(
        (row) =>
          (row.metadata as Record<string, unknown>)?.unipile_account_id === accountId
      );
    }
  }

  return false;
}

async function getAccountIdFromRow(
  supabase: ReturnType<typeof getServiceClient>,
  _table: string,
  userId: string,
  accountId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('user_integrations')
    .select('metadata')
    .eq('user_id', userId)
    .eq('service', 'unipile')
    .eq('is_active', true);

  if (!data) return false;
  return data.some(
    (row) =>
      (row.metadata as Record<string, unknown>)?.unipile_account_id === accountId
  );
}

// ─── Account Listing ───────────────────────────────────

export async function listLinkedInAccounts(
  userId: string,
  teamId?: string,
  refresh = false
): Promise<LinkedInAccount[]> {
  const supabase = createSupabaseAdminClient();
  const accounts: LinkedInAccount[] = [];

  // User integrations
  const { data: userInts } = await supabase
    .from('user_integrations')
    .select('metadata, is_active')
    .eq('user_id', userId)
    .eq('service', 'unipile')
    .eq('is_active', true);

  if (userInts) {
    for (const row of userInts) {
      const meta = row.metadata as Record<string, unknown>;
      accounts.push({
        unipile_account_id: (meta?.unipile_account_id as string) || '',
        name: (meta?.unipile_account_name as string) || 'Unknown',
        status: 'active',
        source: 'user',
      });
    }
  }

  // Team integrations
  if (teamId) {
    const { data: teamProfiles } = await supabase
      .from('team_profiles')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (teamProfiles) {
      const profileIds = teamProfiles.map((tp) => tp.id);
      const { data: teamInts } = await supabase
        .from('team_profile_integrations')
        .select('metadata, is_active')
        .in('team_profile_id', profileIds)
        .eq('service', 'unipile')
        .eq('is_active', true);

      if (teamInts) {
        for (const row of teamInts) {
          const meta = row.metadata as Record<string, unknown>;
          const acctId = (meta?.unipile_account_id as string) || '';
          // Avoid duplicates
          if (!accounts.some((a) => a.unipile_account_id === acctId)) {
            accounts.push({
              unipile_account_id: acctId,
              name: (meta?.unipile_account_name as string) || 'Unknown',
              status: 'active',
              source: 'team',
            });
          }
        }
      }
    }
  }

  // Enrich from Unipile if refresh requested
  if (refresh && accounts.length > 0) {
    try {
      const client = getUnipileClient();
      const response = await client.get<{
        items: Array<{
          id: string;
          name: string;
          created_at: string;
          connection_params?: {
            im?: {
              publicIdentifier?: string;
              premiumFeatures?: string[];
            };
          };
          sources?: Array<{ status: string }>;
        }>;
      }>('/accounts');

      if (response.data?.items) {
        const unipileMap = new Map(
          response.data.items.map((a) => [a.id, a])
        );

        for (const account of accounts) {
          const live = unipileMap.get(account.unipile_account_id);
          if (live) {
            account.name = live.name || account.name;
            account.status =
              live.sources?.[0]?.status === 'OK' ? 'running' : 'disconnected';
            account.linkedin_username =
              live.connection_params?.im?.publicIdentifier;
            account.has_premium =
              (live.connection_params?.im?.premiumFeatures?.length ?? 0) > 0;
            account.connected_at = live.created_at;
          }
        }
      }
    } catch (err) {
      logError('linkedin-accounts:refresh', err as Error, {
        accountCount: accounts.length,
      });
      // Graceful degradation — return cached data
    }
  }

  return accounts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern="linkedin-accounts.service" --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/linkedin-accounts.service.ts src/__tests__/server/services/linkedin-accounts.service.test.ts
git commit -m "feat: add linkedin-accounts service with validation helper and listing"
```

---

## Task 4: List LinkedIn Accounts API Route + MCP Tool

**Files:**
- Create: `src/app/api/content-pipeline/linkedin/accounts/route.ts`
- Create: `src/__tests__/api/content-pipeline/linkedin-accounts.test.ts`
- Modify: `packages/mcp/src/tools/posts.ts`
- Modify: `packages/mcp/src/handlers/posts.ts`
- Modify: `packages/mcp/src/validation.ts`
- Modify: `packages/mcp/src/client.ts`
- Modify: `packages/mcp/src/tools/index.ts`
- Modify: `packages/mcp/src/handlers/index.ts`

- [ ] **Step 1: Write failing test for API route**

Create `src/__tests__/api/content-pipeline/linkedin-accounts.test.ts`:

```typescript
/** LinkedIn Accounts API route tests. */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/server/services/linkedin-accounts.service', () => ({
  listLinkedInAccounts: vi.fn().mockResolvedValue([
    {
      unipile_account_id: 'acct-1',
      name: 'Test User',
      status: 'active',
      source: 'user',
    },
  ]),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}));

describe('GET /api/content-pipeline/linkedin/accounts', () => {
  it('should return list of accounts', async () => {
    const { GET } = await import(
      '@/app/api/content-pipeline/linkedin/accounts/route'
    );
    const request = new Request('http://localhost/api/content-pipeline/linkedin/accounts');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0].unipile_account_id).toBe('acct-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern="linkedin-accounts.test" --no-coverage`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement API route**

Create `src/app/api/content-pipeline/linkedin/accounts/route.ts`:

```typescript
/** List LinkedIn Accounts. Returns connected Unipile accounts for the authenticated user.
 * GET /api/content-pipeline/linkedin/accounts?team_id=...&refresh=true
 */
import { NextResponse } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listLinkedInAccounts } from '@/server/services/linkedin-accounts.service';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const teamId = url.searchParams.get('team_id') ?? undefined;
  const refresh = url.searchParams.get('refresh') === 'true';

  const accounts = await listLinkedInAccounts(session.user.id, teamId, refresh);

  return NextResponse.json({ accounts });
}
```

- [ ] **Step 4: Add MCP tool definition**

In `packages/mcp/src/tools/posts.ts`, add to the `postTools` array:

```typescript
{
  name: 'magnetlab_list_linkedin_accounts',
  description: 'List all connected LinkedIn accounts (via Unipile) for the current user. Returns account IDs, names, and connection status. Pass refresh=true to verify live status with Unipile API (slower).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      team_id: { type: 'string', description: 'Team ID for scoping' },
      refresh: { type: 'boolean', description: 'If true, verify live status with Unipile API. Default: false.' },
    },
  },
},
```

- [ ] **Step 5: Add Zod validation**

In `packages/mcp/src/validation.ts`, in the posts validation section (around line 236), add:

```typescript
magnetlab_list_linkedin_accounts: z.object({
  team_id: teamIdField,
  refresh: z.boolean().optional(),
}),
```

- [ ] **Step 6: Add client method**

In `packages/mcp/src/client.ts`, add after the `publishPost` method:

```typescript
async listLinkedInAccounts(teamId?: string, refresh?: boolean) {
  const params = new URLSearchParams();
  if (teamId) params.set('team_id', teamId);
  if (refresh) params.set('refresh', 'true');
  const qs = params.toString();
  return this.request<unknown>('GET', `/content-pipeline/linkedin/accounts${qs ? `?${qs}` : ''}`);
}
```

- [ ] **Step 7: Add handler**

In `packages/mcp/src/handlers/posts.ts`, add a case in the switch:

```typescript
case 'magnetlab_list_linkedin_accounts':
  return client.listLinkedInAccounts(args.team_id, args.refresh);
```

- [ ] **Step 8: Register in index files**

In `packages/mcp/src/tools/index.ts`: the `postTools` array is already spread, so the new tool is auto-included.

In `packages/mcp/src/handlers/index.ts`: add these entries to the flat handler map:

```typescript
magnetlab_list_linkedin_accounts: handlePostTools,
```

- [ ] **Step 9: Run tests**

Run: `pnpm test -- --testPathPattern="linkedin-accounts" --no-coverage`

Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/app/api/content-pipeline/linkedin/accounts/ src/__tests__/api/content-pipeline/linkedin-accounts.test.ts packages/mcp/src/
git commit -m "feat: add magnetlab_list_linkedin_accounts MCP tool + API route"
```

---

## Task 5: Upload Image From URL — API Route + MCP Tool

**Files:**
- Create: `src/app/api/content-pipeline/posts/[id]/upload-image-url/route.ts`
- Create: `src/__tests__/api/content-pipeline/upload-image-url.test.ts`
- Modify: `src/server/services/posts.service.ts`
- Modify: `packages/mcp/src/tools/posts.ts`
- Modify: `packages/mcp/src/handlers/posts.ts`
- Modify: `packages/mcp/src/validation.ts`
- Modify: `packages/mcp/src/client.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/api/content-pipeline/upload-image-url.test.ts`:

```typescript
/** Upload Image From URL route tests. */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}));

const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'user-1/post-1/img.png' }, error: null });
const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.test/img.png' } });
const mockUpdate = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/utils/supabase-admin', () => ({
  getServiceClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
    from: () => ({
      update: () => ({
        eq: () => ({
          eq: mockUpdate,
        }),
      }),
    }),
  }),
}));

// Mock global fetch for image download
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  headers: new Headers({ 'content-type': 'image/png' }),
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
});

describe('POST /api/content-pipeline/posts/[id]/upload-image-url', () => {
  it('should download image and store it', async () => {
    const { POST } = await import(
      '@/app/api/content-pipeline/posts/[id]/upload-image-url/route'
    );
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: 'https://example.com/image.png' }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'post-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.storagePath).toBeDefined();
  });

  it('should reject invalid MIME type', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
    });

    const { POST } = await import(
      '@/app/api/content-pipeline/posts/[id]/upload-image-url/route'
    );
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: 'https://example.com/doc.pdf' }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'post-1' }) });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern="upload-image-url" --no-coverage`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement API route**

Create `src/app/api/content-pipeline/posts/[id]/upload-image-url/route.ts`:

```typescript
/** Upload Image From URL. Downloads an image from an external URL and stores it for a post.
 * POST /api/content-pipeline/posts/[id]/upload-image-url
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: postId } = await params;
  const body = await request.json();
  const { image_url } = body;

  if (!image_url || typeof image_url !== 'string') {
    return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
  }

  // Download image
  let imageResponse: Response;
  try {
    imageResponse = await fetch(image_url);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: `Failed to download image: ${imageResponse.status}` },
        { status: 400 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to download image: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  // Validate MIME type
  const contentType = imageResponse.headers.get('content-type')?.split(';')[0] || '';
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `Invalid image type: ${contentType}. Allowed: png, jpg, jpeg, webp, gif.` },
      { status: 400 }
    );
  }

  // Download buffer + validate size
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: `Image too large: ${buffer.byteLength} bytes. Max: 10MB.` },
      { status: 400 }
    );
  }

  // Extract filename from URL
  const urlPath = new URL(image_url).pathname;
  const filename = urlPath.split('/').pop() || 'image.png';
  const storagePath = `${session.user.id}/${postId}/${filename}`;

  const supabase = createSupabaseAdminClient();

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('post-images')
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (uploadError) {
    logError('upload-image-url:storage', uploadError as unknown as Error, { postId });
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }

  // Update post record
  const { error: updateError } = await supabase
    .from('cp_pipeline_posts')
    .update({ image_storage_path: storagePath })
    .eq('id', postId)
    .eq('user_id', session.user.id);

  if (updateError) {
    logError('upload-image-url:db', updateError as unknown as Error, { postId });
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from('post-images')
    .getPublicUrl(storagePath);

  return NextResponse.json({ imageUrl: urlData.publicUrl, storagePath });
}
```

- [ ] **Step 4: Add MCP tool, validation, client, handler**

In `packages/mcp/src/tools/posts.ts`, add to `postTools`:

```typescript
{
  name: 'magnetlab_upload_post_image',
  description: 'Upload an image to a pipeline post from an external URL. The image will be attached when the post is published.',
  inputSchema: {
    type: 'object' as const,
    required: ['post_id', 'image_url'],
    properties: {
      post_id: { type: 'string', description: 'Pipeline post ID' },
      image_url: { type: 'string', description: 'External image URL to download and store' },
      team_id: { type: 'string', description: 'Team ID for scoping' },
    },
  },
},
```

In `packages/mcp/src/validation.ts`:

```typescript
magnetlab_upload_post_image: z.object({
  post_id: uuidField,
  image_url: z.string().url(),
  team_id: teamIdField,
}),
```

In `packages/mcp/src/client.ts`:

```typescript
async uploadPostImageUrl(postId: string, imageUrl: string, teamId?: string) {
  const url = this.appendTeamId(`/content-pipeline/posts/${postId}/upload-image-url`, teamId);
  return this.request<unknown>('POST', url, { image_url: imageUrl });
}
```

In `packages/mcp/src/handlers/posts.ts`:

```typescript
case 'magnetlab_upload_post_image':
  return client.uploadPostImageUrl(args.post_id, args.image_url, args.team_id);
```

In `handlers/index.ts`, add: `magnetlab_upload_post_image: handlePostTools,`

- [ ] **Step 5: Run tests**

Run: `pnpm test -- --testPathPattern="upload-image-url" --no-coverage`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/content-pipeline/posts/\[id\]/upload-image-url/ src/__tests__/api/content-pipeline/upload-image-url.test.ts packages/mcp/src/
git commit -m "feat: add magnetlab_upload_post_image MCP tool + API route"
```

---

## Task 6: Modify `publishPost` for Account Override

**Files:**
- Modify: `src/app/api/content-pipeline/posts/[id]/publish/route.ts`
- Modify: `src/server/services/posts.service.ts`
- Modify: `packages/mcp/src/tools/posts.ts`
- Modify: `packages/mcp/src/validation.ts`
- Modify: `packages/mcp/src/client.ts`
- Modify: `packages/mcp/src/handlers/posts.ts`

- [ ] **Step 1: Modify API route to accept unipile_account_id**

In `src/app/api/content-pipeline/posts/[id]/publish/route.ts`, change the POST handler to read `unipile_account_id` from the request body:

```typescript
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const unipileAccountId = body.unipile_account_id;

  // Validate account access if explicit ID provided
  if (unipileAccountId) {
    const { validateUnipileAccountAccess } = await import(
      '@/server/services/linkedin-accounts.service'
    );
    const hasAccess = await validateUnipileAccountAccess(
      session.user.id,
      unipileAccountId
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Account not found or not authorized' },
        { status: 403 }
      );
    }
  }

  const result = await postsService.publishPost(id, session.user.id, unipileAccountId);
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Modify service method**

In `src/server/services/posts.service.ts`, update the `publishPost` method signature and publisher resolution:

```typescript
// Change signature from:
async publishPost(userId: string, postId: string)
// To:
async publishPost(userId: string, postId: string, unipileAccountId?: string)

// Change publisher resolution from:
const publisher = await getUserLinkedInPublisher(userId);
// To:
import { getLinkedInPublisherForAccount } from '@/lib/integrations/linkedin-publisher';

const publisher = unipileAccountId
  ? getLinkedInPublisherForAccount(unipileAccountId)
  : await getUserLinkedInPublisher(userId);
```

- [ ] **Step 3: Update MCP tool + validation + client + handler**

In `packages/mcp/src/tools/posts.ts`, add to `magnetlab_publish_post` inputSchema properties:

```typescript
unipile_account_id: {
  type: 'string',
  description: 'Override: publish from this Unipile account instead of the default',
},
```

In `packages/mcp/src/validation.ts`, update the `magnetlab_publish_post` schema:

```typescript
magnetlab_publish_post: z.object({
  id: uuidField,
  team_id: teamIdField,
  unipile_account_id: z.string().optional(),
}),
```

In `packages/mcp/src/client.ts`, update `publishPost`:

```typescript
async publishPost(id: string, unipileAccountId?: string, teamId?: string) {
  const url = this.appendTeamId(`/content-pipeline/posts/${id}/publish`, teamId);
  return this.request<unknown>('POST', url, { unipile_account_id: unipileAccountId });
}
```

In `packages/mcp/src/handlers/posts.ts`, update the publish case:

```typescript
case 'magnetlab_publish_post':
  return client.publishPost(args.id, args.unipile_account_id, args.team_id);
```

- [ ] **Step 4: Run typecheck + existing tests**

Run: `pnpm typecheck && pnpm test --no-coverage`

Expected: PASS — no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/content-pipeline/posts/\[id\]/publish/ src/server/services/posts.service.ts packages/mcp/src/
git commit -m "feat: add unipile_account_id override to magnetlab_publish_post"
```

---

## Task 7: Direct-Publish Tool — API Route + MCP

**Files:**
- Create: `src/app/api/content-pipeline/posts/direct-publish/route.ts`
- Create: `src/__tests__/api/content-pipeline/direct-publish.test.ts`
- Modify: `packages/mcp/src/tools/posts.ts`
- Modify: `packages/mcp/src/handlers/posts.ts`
- Modify: `packages/mcp/src/validation.ts`
- Modify: `packages/mcp/src/client.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/api/content-pipeline/direct-publish.test.ts`:

```typescript
/** Direct-Publish API route tests. */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}));

vi.mock('@/server/services/linkedin-accounts.service', () => ({
  validateUnipileAccountAccess: vi.fn().mockResolvedValue(true),
}));

const mockCreatePost = vi.fn().mockResolvedValue({
  data: { id: 'linkedin-post-123' },
});

vi.mock('@/lib/integrations/linkedin-publisher', () => ({
  getLinkedInPublisherForAccount: () => ({
    publishNow: mockCreatePost,
  }),
}));

const mockInsert = vi.fn().mockResolvedValue({
  data: [{ id: 'db-post-1' }],
  error: null,
});
const mockUpdate = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/utils/supabase-admin', () => ({
  getServiceClient: () => ({
    from: vi.fn().mockReturnValue({
      insert: mockInsert,
      update: () => ({ eq: mockUpdate }),
    }),
  }),
}));

describe('POST /api/content-pipeline/posts/direct-publish', () => {
  it('should publish and return post IDs', async () => {
    const { POST } = await import(
      '@/app/api/content-pipeline/posts/direct-publish/route'
    );
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unipile_account_id: 'acct-1',
        text: 'Hello LinkedIn!',
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.linkedin_post_id).toBeDefined();
  });

  it('should reject unauthorized account', async () => {
    const { validateUnipileAccountAccess } = await import(
      '@/server/services/linkedin-accounts.service'
    );
    (validateUnipileAccountAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    const { POST } = await import(
      '@/app/api/content-pipeline/posts/direct-publish/route'
    );
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unipile_account_id: 'bad-acct',
        text: 'Hello!',
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern="direct-publish" --no-coverage`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement API route**

Create `src/app/api/content-pipeline/posts/direct-publish/route.ts` — thin route handler that delegates to service:

```typescript
/** Direct Publish to LinkedIn. Creates a DB record and publishes in one call.
 * POST /api/content-pipeline/posts/direct-publish
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { validateUnipileAccountAccess } from '@/server/services/linkedin-accounts.service';
import * as postsService from '@/server/services/posts.service';
import { getStatusCode } from '@/lib/utils/logger';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { unipile_account_id, text } = body;

  if (!unipile_account_id || !text) {
    return NextResponse.json({ error: 'unipile_account_id and text are required' }, { status: 400 });
  }

  const hasAccess = await validateUnipileAccountAccess(session.user.id, unipile_account_id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Account not found or not authorized' }, { status: 403 });
  }

  try {
    const result = await postsService.directPublish(session.user.id, body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: getStatusCode(err) });
  }
}
```

Then add `directPublish` method to `src/server/services/posts.service.ts`. This method handles: DB record creation (via `createAgentPost` pattern with `source: 'direct'`), image download + storage if `image_url` provided, Unipile publish via `getLinkedInPublisherForAccount(accountId)`, and saving `linkedin_post_id` back to DB. Follow the same patterns as the existing `publishPost` method. Key implementation notes:

- Use `createSupabaseAdminClient()` for DB/storage operations
- Validate image MIME type against `ALLOWED_IMAGE_TYPES` set (same as upload-image route)
- Max image size 10MB
- On publish success, update post with `status: 'published'`, `linkedin_post_id`, `publish_provider: 'unipile'`, `published_at`
- On publish failure, update post with `status: 'failed'`
- Return `{ post_id, linkedin_post_id, linkedin_url }`

- [ ] **Step 4: Add MCP tool, validation, client, handler**

In `packages/mcp/src/tools/posts.ts`, add to `postTools`:

```typescript
{
  name: 'magnetlab_publish_to_linkedin',
  description: 'Publish a post directly to LinkedIn on a specific account. Creates a DB record and publishes in one call. Use this for ad-hoc posts. For scheduled/planned content, use create_post → upload_post_image → publish_post instead.',
  inputSchema: {
    type: 'object' as const,
    required: ['unipile_account_id', 'text'],
    properties: {
      unipile_account_id: { type: 'string', description: 'Unipile account ID to post from' },
      text: { type: 'string', description: 'Post body text' },
      image_url: { type: 'string', description: 'External image URL to download and attach' },
      title: { type: 'string', description: 'Internal label for the post (not shown on LinkedIn)' },
      team_id: { type: 'string', description: 'Team ID for scoping' },
    },
  },
},
```

In `packages/mcp/src/validation.ts`:

```typescript
magnetlab_publish_to_linkedin: z.object({
  unipile_account_id: z.string().min(1),
  text: z.string().min(1),
  image_url: z.string().url().optional(),
  title: z.string().optional(),
  team_id: teamIdField,
}),
```

In `packages/mcp/src/client.ts`:

```typescript
async directPublish(params: {
  unipile_account_id: string;
  text: string;
  image_url?: string;
  title?: string;
  team_id?: string;
}) {
  const url = this.appendTeamId('/content-pipeline/posts/direct-publish', params.team_id);
  return this.request<unknown>('POST', url, params);
}
```

In `packages/mcp/src/handlers/posts.ts`:

```typescript
case 'magnetlab_publish_to_linkedin':
  return client.directPublish(args);
```

In `handlers/index.ts`, add: `magnetlab_publish_to_linkedin: handlePostTools,`

- [ ] **Step 5: Run tests**

Run: `pnpm test -- --testPathPattern="direct-publish" --no-coverage`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/content-pipeline/posts/direct-publish/ src/__tests__/api/content-pipeline/direct-publish.test.ts packages/mcp/src/
git commit -m "feat: add magnetlab_publish_to_linkedin MCP tool + API route"
```

---

## Task 8: Fix Post Campaign Schema Drift

**Files:**
- Modify: `packages/mcp/src/tools/post-campaigns.ts`
- Modify: `packages/mcp/src/validation.ts`
- Create: `packages/mcp/src/__tests__/validation/posting-workflow.test.ts`

- [ ] **Step 1: Write schema validation tests**

Create `packages/mcp/src/__tests__/validation/posting-workflow.test.ts`:

```typescript
/** Posting workflow Zod validation tests. */
import { describe, it, expect } from 'vitest';
import { toolSchemas } from '../../validation';

describe('post campaign validation schemas', () => {
  it('should accept sender_name in create', () => {
    const schema = toolSchemas.magnetlab_create_post_campaign;
    const result = schema.safeParse({
      name: 'Test',
      post_url: 'https://linkedin.com/post/123',
      keywords: ['BLUEPRINT'],
      unipile_account_id: 'acct-1',
      dm_template: 'Hey {{name}}',
      sender_name: 'Vlad',
      connect_message_template: 'Hi {{name}}!',
      lead_expiry_days: 14,
    });
    expect(result.success).toBe(true);
  });

  it('should accept connect_message_template in update', () => {
    const schema = toolSchemas.magnetlab_update_post_campaign;
    const result = schema.safeParse({
      campaign_id: '123e4567-e89b-12d3-a456-426614174000',
      connect_message_template: 'Hello {{name}}',
      lead_expiry_days: 7,
    });
    expect(result.success).toBe(true);
  });

  it('should validate publish_to_linkedin requires text and account', () => {
    const schema = toolSchemas.magnetlab_publish_to_linkedin;
    const result = schema.safeParse({});
    expect(result.success).toBe(false);

    const valid = schema.safeParse({
      unipile_account_id: 'acct-1',
      text: 'Hello world',
    });
    expect(valid.success).toBe(true);
  });

  it('should validate list_linkedin_accounts optional params', () => {
    const schema = toolSchemas.magnetlab_list_linkedin_accounts;
    const result = schema.safeParse({});
    expect(result.success).toBe(true);

    const withRefresh = schema.safeParse({ refresh: true });
    expect(withRefresh.success).toBe(true);
  });

  it('should validate upload_post_image requires post_id and image_url', () => {
    const schema = toolSchemas.magnetlab_upload_post_image;
    const result = schema.safeParse({});
    expect(result.success).toBe(false);

    const valid = schema.safeParse({
      post_id: '123e4567-e89b-12d3-a456-426614174000',
      image_url: 'https://example.com/img.png',
    });
    expect(valid.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/mcp && pnpm test -- --testPathPattern="posting-workflow" --no-coverage`

Expected: FAIL — missing schemas / missing fields.

- [ ] **Step 3: Add missing fields to tool definitions**

In `packages/mcp/src/tools/post-campaigns.ts`, add to `magnetlab_create_post_campaign` inputSchema properties:

```typescript
sender_name: {
  type: 'string',
  description: 'Display name when sending DMs',
},
connect_message_template: {
  type: 'string',
  description: 'Message sent with connection requests. Supports {{name}} placeholder.',
},
lead_expiry_days: {
  type: 'number',
  description: 'Days before leads expire (default: 30)',
},
```

Add the same 3 fields to `magnetlab_update_post_campaign` inputSchema properties.

- [ ] **Step 4: Add to Zod validation**

In `packages/mcp/src/validation.ts`, update `magnetlab_create_post_campaign` schema:

```typescript
sender_name: z.string().optional(),
connect_message_template: z.string().optional(),
lead_expiry_days: z.number().int().positive().optional(),
```

Same for `magnetlab_update_post_campaign`.

- [ ] **Step 5: Run tests**

Run: `cd packages/mcp && pnpm test -- --testPathPattern="posting-workflow" --no-coverage`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/
git commit -m "fix: add missing fields to create/update post campaign MCP tools"
```

---

## Task 9: Full Test Suite + Typecheck

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`

Expected: PASS — no type errors.

- [ ] **Step 2: Run full test suite**

Run: `pnpm test --no-coverage`

Expected: All tests pass, no regressions.

- [ ] **Step 3: Run MCP package tests**

Run: `cd packages/mcp && pnpm test --no-coverage`

Expected: All MCP tests pass.

- [ ] **Step 4: Fix any failures, commit**

If any tests fail, fix them and commit the fix.

---

## Task 10: Sync to mas-platform

Copy all changes to the monorepo version of magnetlab and commit there.

- [ ] **Step 1: Sync modified files**

```bash
# From magnetlab standalone to mas-platform
MONO="/Users/timlife/Documents/claude code/mas-platform/apps/magnetlab"
STANDALONE="/Users/timlife/Documents/claude code/magnetlab"

# New files
cp "$STANDALONE/src/server/services/linkedin-accounts.service.ts" "$MONO/src/server/services/"
cp "$STANDALONE/src/app/api/content-pipeline/linkedin/accounts/route.ts" "$MONO/src/app/api/content-pipeline/linkedin/accounts/route.ts"
cp "$STANDALONE/src/app/api/content-pipeline/posts/direct-publish/route.ts" "$MONO/src/app/api/content-pipeline/posts/direct-publish/route.ts"
cp "$STANDALONE/src/app/api/content-pipeline/posts/[id]/upload-image-url/route.ts" "$MONO/src/app/api/content-pipeline/posts/[id]/upload-image-url/route.ts"

# Modified files
cp "$STANDALONE/src/lib/integrations/linkedin-publisher.ts" "$MONO/src/lib/integrations/"
cp "$STANDALONE/src/server/services/posts.service.ts" "$MONO/src/server/services/"
cp "$STANDALONE/src/app/api/content-pipeline/posts/[id]/publish/route.ts" "$MONO/src/app/api/content-pipeline/posts/[id]/publish/route.ts"

# MCP package (entire packages/mcp/src)
rsync -av "$STANDALONE/packages/mcp/src/" "$MONO/packages/mcp/src/"

# Tests
cp -r "$STANDALONE/src/__tests__/server/services/linkedin-accounts.service.test.ts" "$MONO/src/__tests__/server/services/" 2>/dev/null
cp -r "$STANDALONE/src/__tests__/api/content-pipeline/direct-publish.test.ts" "$MONO/src/__tests__/api/content-pipeline/" 2>/dev/null
cp -r "$STANDALONE/src/__tests__/api/content-pipeline/upload-image-url.test.ts" "$MONO/src/__tests__/api/content-pipeline/" 2>/dev/null
cp -r "$STANDALONE/src/__tests__/api/content-pipeline/linkedin-accounts.test.ts" "$MONO/src/__tests__/api/content-pipeline/" 2>/dev/null
cp -r "$STANDALONE/src/__tests__/lib/integrations/linkedin-publisher.test.ts" "$MONO/src/__tests__/lib/integrations/" 2>/dev/null
```

- [ ] **Step 2: Commit to mas-platform**

```bash
cd "/Users/timlife/Documents/claude code/mas-platform"
git add apps/magnetlab/
git commit -m "feat: sync MCP posting workflow fixes from standalone magnetlab

- magnetlab_publish_to_linkedin (direct-publish)
- magnetlab_publish_post account override
- magnetlab_upload_post_image (from URL)
- magnetlab_list_linkedin_accounts
- Fix publisher image passthrough bug
- Fix post campaign schema drift"
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck` in mas-platform root.

Expected: PASS (same pre-existing knowledge-graph issue may surface — ignore if unrelated).
