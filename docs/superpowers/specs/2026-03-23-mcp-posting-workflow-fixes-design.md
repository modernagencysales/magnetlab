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

These gaps were exposed on 2026-03-23 when we published posts for Vlad and Christian — every step required raw Unipile API calls or direct SQL.

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
1. Validate `unipile_account_id` exists in `user_integrations` for the authenticated user
2. Create `cp_pipeline_posts` row: `status: 'published'`, `source: 'direct'`, `final_content: text`
3. If `image_url`: download image → validate MIME type (png/jpg/webp/gif) and size (≤10MB) → upload to `post-images` bucket at `{userId}/{postId}/{filename}` → set `image_storage_path`
4. Call Unipile `POST /posts` with `account_id`, `text`, and optional image attachment
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

**DB record shape:**
```sql
INSERT INTO cp_pipeline_posts (
  user_id, team_id, final_content, status, source,
  image_storage_path, linkedin_post_id, published_at
) VALUES (...)
```

Note: `source` column may need to be added if it doesn't exist. If the column doesn't exist, use `metadata` JSONB field with `{ source: 'direct' }` instead.

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
- If provided, validate it belongs to the authenticated user's `user_integrations`
- Pass to `posts.service.ts → publishPost()` which passes to the Unipile client
- If not provided, fall back to `getUserPostingAccountId(userId)` (current behavior)

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
  description: 'List all connected LinkedIn accounts (via Unipile) for the current user. Returns account IDs, names, and connection status.',
  inputSchema: {
    type: 'object',
    properties: {
      team_id: { type: 'string', description: 'Team ID for scoping' }
    }
  }
}
```

**Flow:**
1. Query `user_integrations` where `service = 'unipile'` and `is_active = true` for the authenticated user
2. Also check `team_profile_integrations` if `team_id` provided
3. For each account, call Unipile `GET /api/v1/accounts/{id}` to get live status
4. Return array of accounts with status

**Return shape:**
```typescript
[{
  unipile_account_id: string;
  name: string;
  linkedin_username: string;
  status: 'running' | 'connecting' | 'disconnected' | 'stopped';
  connected_at: string;
  has_premium: boolean;
}]
```

**New API route:** `GET /api/integrations/linkedin/accounts`

**Service:** New file `src/server/services/linkedin-accounts.service.ts` — keeps this logic separate from the encrypted-storage utils.

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

**Handler change:** Pass these fields through to the API (they're already accepted by the API schema — just not exposed in MCP).

**Also add to `magnetlab_update_post_campaign`** — same 3 fields.

## Files Changed

### New files
| File | Purpose |
|------|---------|
| `src/app/api/content-pipeline/posts/direct-publish/route.ts` | Direct-publish API route |
| `src/app/api/content-pipeline/posts/[id]/upload-image-url/route.ts` | Image upload from URL route |
| `src/app/api/integrations/linkedin/accounts/route.ts` | List LinkedIn accounts route |
| `src/server/services/linkedin-accounts.service.ts` | LinkedIn account discovery service |

### Modified files
| File | Change |
|------|--------|
| `packages/mcp/src/tools/posts.ts` | Add `publish_to_linkedin`, `upload_post_image` tools; add `unipile_account_id` to `publish_post` |
| `packages/mcp/src/tools/post-campaigns.ts` | Add `sender_name`, `connect_message_template`, `lead_expiry_days` to create + update tools |
| `packages/mcp/src/handlers/posts.ts` | Add handlers for new tools |
| `packages/mcp/src/handlers/post-campaigns.ts` | Pass new fields through |
| `packages/mcp/src/client.ts` | Add `directPublish`, `uploadPostImageUrl`, `listLinkedInAccounts` methods; update `publishPost` signature |
| `src/server/services/posts.service.ts` | Add `directPublish`, `uploadImageFromUrl` methods; modify `publishPost` for account override |
| `src/app/api/content-pipeline/posts/[id]/publish/route.ts` | Accept `unipile_account_id` in body |

### Tests (new)
| File | Coverage |
|------|----------|
| `src/__tests__/api/content-pipeline/direct-publish.test.ts` | Direct-publish route: happy path, missing account, image download failure, DB record creation |
| `src/__tests__/api/content-pipeline/upload-image-url.test.ts` | URL upload: happy path, invalid MIME, too large, invalid URL |
| `src/__tests__/api/integrations/linkedin-accounts.test.ts` | List accounts: happy path, no accounts, Unipile API failure graceful degradation |
| `packages/mcp/src/__tests__/tools/posts.test.ts` | Schema tests for new/modified tool definitions |
| `packages/mcp/src/__tests__/tools/post-campaigns.test.ts` | Schema tests for added fields |

## Constraints

- Every publish MUST create a `cp_pipeline_posts` DB record — no exceptions
- Image validation reuses existing allowlist: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`, `image/gif`
- Image size limit: 10MB (matches existing upload route)
- Unipile does NOT support post editing or deletion — this spec does not attempt to add those
- All changes must be applied to BOTH repos: standalone magnetlab + mas-platform/apps/magnetlab
- `unipile_account_id` validation: must exist in `user_integrations` for the authenticated user (prevents posting from someone else's account)

## Not in scope

- Post editing/deletion (Unipile API limitation)
- Video upload support
- Account connection/disconnection tools (OAuth flow — separate spec)
- Batch publishing
