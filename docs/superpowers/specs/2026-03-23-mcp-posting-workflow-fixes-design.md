# MCP Posting Workflow Fixes

> **Date:** 2026-03-23
> **Status:** Approved
> **Scope:** MCP tools, API routes, services — both magnetlab standalone + mas-platform/apps/magnetlab

## Problem

The MCP tooling covers ~70% of the LinkedIn posting workflow but critical gaps force agents to bypass MCP entirely:

1. **No direct-publish** — Agents can't publish a post to a specific LinkedIn account in one call. `publish_post` always uses the logged-in user's default account.
2. **No image upload tool** — The API route exists but no MCP tool wraps it.
3. **No account discovery** — Agents can't list connected LinkedIn/Unipile accounts.
4. **Schema drift** — `create_post_campaign` MCP tool is missing 3 fields the API accepts.
5. **Publisher ignores images** — `linkedin-publisher.ts` prefixes `imageFile` with underscore and never passes it to Unipile. Pipeline posts with images silently publish without the image.

These gaps were exposed on 2026-03-23 when we published posts for Vlad and Christian — every step required raw Unipile API calls or direct SQL.

## Prerequisite Fix: Publisher Image Passthrough

`linkedin-publisher.ts` line 44 has `_imageFile` (ignored) instead of `imageFile`. The `publishNow` method calls `client.createPost(accountId, content)` without the image, even though `UnipileClient.createPost()` at `unipile.ts:123` fully supports multipart image uploads.

**Fix:** Change `_imageFile` → `imageFile` and pass it: `client.createPost(accountId, content, imageFile)`. This fixes the existing pipeline publish + image flow (not just the new tools).

## Prerequisite Fix: Publisher Account Override

The current publisher factory `getUserLinkedInPublisher(userId)` always resolves the account from `user_integrations`. To support explicit account selection, add a new factory:

```typescript
// linkedin-publisher.ts
function getLinkedInPublisherForAccount(accountId: string): LinkedInPublisher {
  const client = getUnipileClient();
  return {
    publishNow: async (content: string, imageFile?: ImageFile) => {
      return client.createPost(accountId, content, imageFile);
    }
  };
}
```

Both `directPublish` and the modified `publishPost` use this factory when an explicit `unipile_account_id` is provided. The existing `getUserLinkedInPublisher` remains the fallback when no account is specified.

## Design

### 1. `magnetlab_publish_to_linkedin` (new tool)

Single-call direct-publish that always creates a DB record.

**MCP tool definition:**
```typescript
{
  name: 'magnetlab_publish_to_linkedin',
  description: 'Publish a post directly to LinkedIn on a specific account. Creates a DB record and publishes in one call. Use this for ad-hoc posts. For scheduled/planned content, use create_post → upload_post_image → publish_post instead.',
  inputSchema: {
    type: 'object',
    required: ['unipile_account_id', 'text'],
    properties: {
      unipile_account_id: { type: 'string', description: 'Unipile account ID to post from' },
      text: { type: 'string', description: 'Post body text' },
      image_url: { type: 'string', description: 'External image URL to download and attach' },
      title: { type: 'string', description: 'Internal label for the post (not shown on LinkedIn)' },
      team_id: { type: 'string', description: 'Team ID for scoping' }
    }
  }
}
```

**Flow:**
1. Validate `unipile_account_id` exists in `user_integrations` or `team_profile_integrations` for the authenticated user (see Account Validation section below)
2. Resolve `team_id` via `DataScope` for proper team scoping. Create `cp_pipeline_posts` row using `createAgentPost()` repo method with `source: 'direct'`, `final_content: text`
3. If `image_url`: download image → validate MIME type (png/jpg/webp/gif) and size (≤10MB) → upload to `post-images` bucket at `{userId}/{postId}/{filename}` → set `image_storage_path`
4. Call `getLinkedInPublisherForAccount(accountId).publishNow(text, imageFile?)` which calls Unipile `POST /posts`
5. Save `linkedin_post_id` and `published_at` to the DB record
6. Return `{ post_id, linkedin_post_id, linkedin_url }`

**New API route:** `POST /api/content-pipeline/posts/direct-publish`

**Request body:**
```typescript
{
  unipile_account_id: string;
  text: string;
  image_url?: string;
  title?: string;
  team_id?: string;
}
```

**Service method:** `posts.service.ts → directPublish(userId, params)`

**DB record:** Uses existing `createAgentPost()` from `posts.repo.ts` with `source: 'direct'`. The `source` column already exists in `cp_pipeline_posts`.

### 2. `magnetlab_publish_post` — add account selection

Add optional `unipile_account_id` parameter to the existing tool.

**MCP tool change:**
```typescript
// Add to inputSchema.properties:
unipile_account_id: {
  type: 'string',
  description: 'Override: publish from this Unipile account instead of the default'
}
```

**MCP client change:**
```typescript
// client.ts → publishPost
publishPost(id: string, unipileAccountId?: string, teamId?: string) {
  return this.post(`/content-pipeline/posts/${id}/publish`, {
    unipile_account_id: unipileAccountId
  }, teamId);
}
```

**API route change:** `POST /content-pipeline/posts/[id]/publish`
- Accept `unipile_account_id` in request body
- If provided, validate via account validation logic (see below), then use `getLinkedInPublisherForAccount(accountId)`
- If not provided, fall back to `getUserLinkedInPublisher(userId)` (current behavior)

**Service change:** `posts.service.ts → publishPost(postId, userId, unipileAccountId?)`

### 3. `magnetlab_upload_post_image` (new tool)

**MCP tool definition:**
```typescript
{
  name: 'magnetlab_upload_post_image',
  description: 'Upload an image to a pipeline post from an external URL. The image will be attached when the post is published.',
  inputSchema: {
    type: 'object',
    required: ['post_id', 'image_url'],
    properties: {
      post_id: { type: 'string', description: 'Pipeline post ID' },
      image_url: { type: 'string', description: 'External image URL to download and store' },
      team_id: { type: 'string', description: 'Team ID for scoping' }
    }
  }
}
```

**Flow:**
1. Download image from `image_url`
2. Validate MIME type (png/jpg/jpeg/webp/gif) and size (≤10MB)
3. Upload to Supabase Storage `post-images` bucket at `{userId}/{postId}/{filename}`
4. Update `cp_pipeline_posts.image_storage_path`
5. Return `{ storage_path }`

**New API route:** `POST /api/content-pipeline/posts/[id]/upload-image-url`

This is separate from the existing `upload-image` route (which accepts multipart form data). This route accepts JSON with an `image_url` field and handles the download server-side.

**Request body:**
```typescript
{
  image_url: string;
  team_id?: string;
}
```

**Service method:** `posts.service.ts → uploadImageFromUrl(postId, userId, imageUrl)`

### 4. `magnetlab_list_linkedin_accounts` (new tool)

**MCP tool definition:**
```typescript
{
  name: 'magnetlab_list_linkedin_accounts',
  description: 'List all connected LinkedIn accounts (via Unipile) for the current user. Returns account IDs, names, and connection status. Pass refresh=true to verify live status with Unipile (slower).',
  inputSchema: {
    type: 'object',
    properties: {
      team_id: { type: 'string', description: 'Team ID for scoping' },
      refresh: { type: 'boolean', description: 'If true, verify live status with Unipile API (slower). Default: false — returns cached DB status.' }
    }
  }
}
```

**Flow:**
1. Query `user_integrations` where `service = 'unipile'` and `is_active = true` for the authenticated user
2. Also check `team_profile_integrations` if `team_id` provided
3. If `refresh: true`: call Unipile `GET /api/v1/accounts` (single call, returns all accounts) and match against DB records to enrich with live status, name, and profile data
4. If `refresh: false` (default): return DB-cached info only (`unipile_account_id`, `is_active`, `metadata.unipile_account_name`)
5. Return array of accounts

**Return shape:**
```typescript
[{
  unipile_account_id: string;
  name: string;                    // from DB metadata or Unipile API
  status: 'active' | 'unknown';   // 'active' from DB, enriched to running/stopped/etc when refresh=true
  source: 'user' | 'team';        // which table it came from
}]
```

When `refresh: true`, status is enriched from Unipile's response and additional fields are available:
```typescript
{
  // ...base fields above
  status: 'running' | 'connecting' | 'disconnected' | 'stopped';
  linkedin_username?: string;      // from connection_params.im.publicIdentifier
  has_premium?: boolean;           // from connection_params.im.premiumFeatures
  connected_at?: string;           // from created_at
}
```

**New API route:** `GET /api/content-pipeline/linkedin/accounts`

Note: Route is under `/content-pipeline/` (not `/integrations/`) since this is designed for MCP/publishing consumption, consistent with other content-pipeline-adjacent tools.

**Service:** New file `src/server/services/linkedin-accounts.service.ts`

### 5. Fix `magnetlab_create_post_campaign` schema drift

Add 3 missing fields to the MCP tool definition in `tools/post-campaigns.ts`:

```typescript
// Add to inputSchema.properties:
sender_name: {
  type: 'string',
  description: 'Display name when sending DMs'
},
connect_message_template: {
  type: 'string',
  description: 'Message sent with connection requests. Supports {{name}} placeholder.'
},
lead_expiry_days: {
  type: 'number',
  description: 'Days before leads expire (default: 30)'
}
```

**Also add to `magnetlab_update_post_campaign`** — same 3 fields.

**Critical:** These fields must ALSO be added to the Zod validation schemas in `packages/mcp/src/validation.ts` for both `magnetlab_create_post_campaign` and `magnetlab_update_post_campaign`. Without this, the fields are stripped before reaching the handler.

## Account Validation

Consistent across all tools that accept `unipile_account_id`:

1. Check `user_integrations` where `service = 'unipile'` and `metadata->>'unipile_account_id' = provided_id` and `user_id = authenticated_user`
2. If not found, check `team_profile_integrations` where `service = 'unipile'` and `metadata->>'unipile_account_id' = provided_id` for any team profile the user belongs to
3. If not found in either, return 403 "Account not found or not authorized"

Extract this into a shared helper: `validateUnipileAccountAccess(userId: string, accountId: string): Promise<boolean>`

## Files Changed

### New files
| File | Purpose |
|------|---------|
| `src/app/api/content-pipeline/posts/direct-publish/route.ts` | Direct-publish API route |
| `src/app/api/content-pipeline/posts/[id]/upload-image-url/route.ts` | Image upload from URL route |
| `src/app/api/content-pipeline/linkedin/accounts/route.ts` | List LinkedIn accounts route |
| `src/server/services/linkedin-accounts.service.ts` | LinkedIn account discovery + validation service |

### Modified files
| File | Change |
|------|--------|
| `src/lib/integrations/linkedin-publisher.ts` | Fix image passthrough (`_imageFile` → `imageFile`); add `getLinkedInPublisherForAccount(accountId)` factory |
| `packages/mcp/src/tools/posts.ts` | Add `publish_to_linkedin`, `upload_post_image` tools; add `unipile_account_id` to `publish_post` |
| `packages/mcp/src/tools/post-campaigns.ts` | Add `sender_name`, `connect_message_template`, `lead_expiry_days` to create + update tools |
| `packages/mcp/src/tools/index.ts` | Register new tools |
| `packages/mcp/src/handlers/posts.ts` | Add handlers for new tools |
| `packages/mcp/src/handlers/post-campaigns.ts` | Pass new fields through |
| `packages/mcp/src/handlers/index.ts` | Register new handlers |
| `packages/mcp/src/validation.ts` | Add Zod schemas for 3 new tools; update `publish_post` schema (add `unipile_account_id`); add 3 fields to `create_post_campaign` and `update_post_campaign` schemas |
| `packages/mcp/src/client.ts` | Add `directPublish`, `uploadPostImageUrl`, `listLinkedInAccounts` methods; update `publishPost` signature |
| `src/server/services/posts.service.ts` | Add `directPublish`, `uploadImageFromUrl` methods; modify `publishPost` for account override |
| `src/app/api/content-pipeline/posts/[id]/publish/route.ts` | Accept `unipile_account_id` in body |

### Tests (new)
| File | Coverage |
|------|----------|
| `src/__tests__/api/content-pipeline/direct-publish.test.ts` | Direct-publish route: happy path, missing account, image download failure, DB record creation |
| `src/__tests__/api/content-pipeline/upload-image-url.test.ts` | URL upload: happy path, invalid MIME, too large, invalid URL |
| `src/__tests__/api/content-pipeline/linkedin-accounts.test.ts` | List accounts: happy path, no accounts, refresh mode, Unipile API failure graceful degradation |
| `src/__tests__/lib/integrations/linkedin-publisher.test.ts` | Publisher image passthrough, account override factory |
| `packages/mcp/src/__tests__/tools/posts.test.ts` | Schema tests for new/modified tool definitions |
| `packages/mcp/src/__tests__/tools/post-campaigns.test.ts` | Schema tests for added fields |
| `packages/mcp/src/__tests__/validation/posts.test.ts` | Zod validation for new tool schemas |

## Constraints

- Every publish MUST create a `cp_pipeline_posts` DB record — no exceptions
- Image validation reuses existing allowlist: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`, `image/gif`
- Image size limit: 10MB (matches existing upload route)
- Unipile does NOT support post editing or deletion — this spec does not attempt to add those
- All changes must be applied to BOTH repos: standalone magnetlab + mas-platform/apps/magnetlab
- Account validation checks BOTH `user_integrations` and `team_profile_integrations` (consistent across all tools)
- `directPublish` uses existing `createAgentPost()` repo method with `source: 'direct'` for DB record creation
- `list_linkedin_accounts` defaults to cached DB status; live Unipile verification only on `refresh: true` (avoids N+1 API calls)

## Not in scope

- Post editing/deletion (Unipile API limitation)
- Video upload support
- Account connection/disconnection tools (OAuth flow — separate spec)
- Batch publishing
