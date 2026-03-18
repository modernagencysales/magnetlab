# Lead Magnet Post Automation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable zero-config, AI-powered lead magnet delivery from LinkedIn posts — toggle "Lead Magnet Post," AI configures everything, automation handles like → reply → connect → DM.

**Architecture:** Extends existing Post Campaign system with: AI auto-setup (reads post text, extracts config), image publishing (Unipile multipart), full action chain (react/reply/connect/DM), configurable safety (per-account limits, operating hours, warm-up), and two-tier comment matching (keyword + AI intent).

**Tech Stack:** Next.js 15, Supabase, Trigger.dev v4, Unipile API, Claude Haiku (intent classification), Supabase Storage (images)

**Spec:** `docs/superpowers/specs/2026-03-18-lead-magnet-post-automation-design.md`
**Unipile Reference:** `docs/unipile-api-reference.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/YYYYMMDD_lead_magnet_post_automation.sql` | DB schema changes (account_safety_settings, post_campaigns alterations, cp_pipeline_posts flag) |
| `src/server/services/account-safety.service.ts` | Safety settings CRUD, effective limit calculation, operating hours check, circuit breaker |
| `src/server/repositories/account-safety.repo.ts` | DB access for account_safety_settings + linkedin_daily_limits |
| `src/app/api/account-safety-settings/route.ts` | GET list all account settings |
| `src/app/api/account-safety-settings/[accountId]/route.ts` | PATCH update account settings |
| `src/lib/ai/post-campaign/auto-setup.ts` | AI post analyzer — extract keyword, match lead magnet, find delivery account, generate templates |
| `src/lib/ai/post-campaign/intent-classifier.ts` | Tier 2 comment intent classification via Claude Haiku |
| `src/app/api/post-campaigns/auto-setup/route.ts` | POST auto-setup endpoint |
| `src/app/api/content-pipeline/posts/[id]/upload-image/route.ts` | POST image upload for posts |
| ~~`src/lib/utils/normalize-post-url.ts`~~ | REMOVED — use existing `src/lib/utils/linkedin-url.ts` which already has `normalizePostUrl()` |
| `src/trigger/expire-campaign-leads.ts` | Scheduled task to expire old unconnected leads |
| `src/app/(dashboard)/post-campaigns/page.tsx` | Campaign list page |
| `src/app/(dashboard)/post-campaigns/[id]/page.tsx` | Campaign detail page |
| `src/app/(dashboard)/settings/safety/page.tsx` | Account safety settings page |
| `src/components/post-campaigns/CampaignList.tsx` | Campaign list table component |
| `src/components/post-campaigns/CampaignDetail.tsx` | Campaign detail with lead table |
| `src/components/post-campaigns/AutoSetupCard.tsx` | AI-generated config summary card |
| `src/components/post-campaigns/CampaignForm.tsx` | Campaign create/edit form |
| `src/components/settings/AccountSafetySettings.tsx` | Per-account safety config cards |
| `src/frontend/api/post-campaigns.ts` | Client API module for campaigns |
| `src/frontend/api/account-safety.ts` | Client API module for safety settings |
| `src/frontend/hooks/api/usePostCampaigns.ts` | SWR hooks for campaigns |
| `src/frontend/hooks/api/useAccountSafety.ts` | SWR hooks for safety settings |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/integrations/unipile.ts` | Add `postMultipart()`, update `createPost()` for images, update `addComment()` for threading + mentions |
| `src/lib/integrations/base-client.ts` | Add `postMultipart()` method |
| `src/lib/integrations/linkedin-publisher.ts` | Pass image through to Unipile |
| `src/trigger/process-post-campaigns.ts` | Add Phase 2 (react + reply + connect), update Phase 3 (DM), add operating hours + safety checks |
| `src/trigger/poll-connection-requests.ts` | Add operating hours, circuit breaker, skip runs, query both `detected` and `connection_pending` |
| `src/server/services/post-campaigns.service.ts` | Add auto-setup flow, safety limit integration, DM template rendering |
| `src/server/repositories/post-campaigns.repo.ts` | Add new columns to whitelist, update SELECT constants |
| `src/lib/types/post-campaigns.ts` | Add new status, fields, safety types |
| `packages/mcp/src/tools/post-campaigns.ts` | Add campaign + safety MCP tool definitions |
| `packages/mcp/src/handlers/post-campaigns.ts` | Add campaign + safety MCP handlers |
| `packages/mcp/src/client.ts` | Add campaign + safety client methods |

---

## Dependency Graph

```
Task 1 (DB Migration)
  ├─ Task 2 (Safety Service) ──── Task 8 (Poll Task Update) ──┐
  ├─ Task 3 (Unipile Client) ─── Task 4 (Image Upload) ──────┤
  ├─ Task 5 (AI Modules) ─────── Task 6 (Auto-Setup Route) ──┤
  └─ Task 9 (Expire Task) ───────────────────────────────────┤
                                                               │
  Task 7 (Process Task Update) ← depends on Tasks 2, 3, 5 ───┤
  Task 10 (MCP Tools) ← depends on Tasks 2, 6 ───────────────┤
  Task 11 (Frontend API) ← depends on Tasks 2, 6 ────────────┤
  Task 12 (Campaign UI) ← depends on Task 11 ────────────────┤
  Task 13 (Safety UI) ← depends on Task 11 ──────────────────┤
  Task 14 (Integration Test) ← depends on all ────────────────┘
```

**Parallelizable after Task 1:** Tasks 2, 3, 5, 9 can all run simultaneously.

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_lead_magnet_post_automation.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- ─── account_safety_settings ─────────────────────────────────────────────────

CREATE TABLE account_safety_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unipile_account_id text NOT NULL,

  -- Operating hours
  operating_hours_start time NOT NULL DEFAULT '08:00',
  operating_hours_end time NOT NULL DEFAULT '19:00',
  timezone text NOT NULL DEFAULT 'America/New_York',

  -- Daily limits
  max_dms_per_day integer NOT NULL DEFAULT 50,
  max_connection_requests_per_day integer NOT NULL DEFAULT 10,
  max_connection_accepts_per_day integer NOT NULL DEFAULT 80,
  max_comments_per_day integer NOT NULL DEFAULT 30,
  max_likes_per_day integer NOT NULL DEFAULT 60,

  -- Delays (ms)
  min_action_delay_ms integer NOT NULL DEFAULT 45000,
  max_action_delay_ms integer NOT NULL DEFAULT 210000,

  -- Warm-up
  account_connected_at timestamptz,

  -- Circuit breaker
  circuit_breaker_until timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, unipile_account_id)
);

ALTER TABLE account_safety_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own account settings"
  ON account_safety_settings FOR ALL USING (user_id = auth.uid());

-- ─── post_campaigns additions ────────────────────────────────────────────────

ALTER TABLE post_campaigns ADD COLUMN IF NOT EXISTS
  reply_template text;
-- reply_account_id removed — delivery account (unipile_account_id) handles replies, DMs, and connections
ALTER TABLE post_campaigns ADD COLUMN IF NOT EXISTS
  poster_account_id text;  -- poster's account for reactions (separate from delivery account)
ALTER TABLE post_campaigns ADD COLUMN IF NOT EXISTS
  target_locations text[] DEFAULT '{}';
ALTER TABLE post_campaigns ADD COLUMN IF NOT EXISTS
  lead_expiry_days integer NOT NULL DEFAULT 7;

-- ─── post_campaign_leads additions ───────────────────────────────────────────

ALTER TABLE post_campaign_leads ADD COLUMN IF NOT EXISTS
  match_type text DEFAULT 'keyword' CHECK (match_type IN ('keyword', 'intent'));
ALTER TABLE post_campaign_leads ADD COLUMN IF NOT EXISTS
  location text;
ALTER TABLE post_campaign_leads ADD COLUMN IF NOT EXISTS
  liked_at timestamptz;
ALTER TABLE post_campaign_leads ADD COLUMN IF NOT EXISTS
  replied_at timestamptz;
ALTER TABLE post_campaign_leads ADD COLUMN IF NOT EXISTS
  connection_requested_at timestamptz;
ALTER TABLE post_campaign_leads ADD COLUMN IF NOT EXISTS
  expired_at timestamptz;

-- Update status check to include 'expired'
ALTER TABLE post_campaign_leads DROP CONSTRAINT IF EXISTS post_campaign_leads_status_check;
ALTER TABLE post_campaign_leads ADD CONSTRAINT post_campaign_leads_status_check
  CHECK (status IN ('detected', 'connection_pending', 'connection_accepted',
                    'dm_queued', 'dm_sent', 'dm_failed', 'skipped', 'expired'));

-- ─── linkedin_daily_limits additions ─────────────────────────────────────────

ALTER TABLE linkedin_daily_limits ADD COLUMN IF NOT EXISTS
  comments_sent integer NOT NULL DEFAULT 0;
ALTER TABLE linkedin_daily_limits ADD COLUMN IF NOT EXISTS
  likes_sent integer NOT NULL DEFAULT 0;
ALTER TABLE linkedin_daily_limits ADD COLUMN IF NOT EXISTS
  connection_requests_sent integer NOT NULL DEFAULT 0;

-- ─── signal_events + signal_leads additions (for reply threading + mentions) ──

ALTER TABLE signal_events ADD COLUMN IF NOT EXISTS
  comment_social_id text;  -- Unipile comment ID for threaded replies

ALTER TABLE signal_leads ADD COLUMN IF NOT EXISTS
  provider_id text;  -- Unipile provider_id for mentions + DMs

-- NOTE: scrape-engagement task must be updated to populate these from Harvest API

-- ─── cp_pipeline_posts additions ─────────────────────────────────────────────

ALTER TABLE cp_pipeline_posts ADD COLUMN IF NOT EXISTS
  is_lead_magnet_post boolean NOT NULL DEFAULT false;
ALTER TABLE cp_pipeline_posts ADD COLUMN IF NOT EXISTS
  image_storage_path text;
```

- [ ] **Step 2: Push migration to Supabase**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm db:push`
Expected: Migration applies successfully

- [ ] **Step 3: Verify columns exist**

Run SQL in Supabase dashboard or via CLI:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'account_safety_settings';
SELECT column_name FROM information_schema.columns WHERE table_name = 'post_campaigns' AND column_name IN ('reply_template', 'poster_account_id', 'target_locations', 'lead_expiry_days');
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add account_safety_settings table and extend post_campaigns schema"
```

---

## Task 2: Account Safety Service + API

**Files:**
- Create: `src/server/repositories/account-safety.repo.ts`
- Create: `src/server/services/account-safety.service.ts`
- Create: `src/app/api/account-safety-settings/route.ts`
- Create: `src/app/api/account-safety-settings/[accountId]/route.ts`
- Modify: `src/lib/types/post-campaigns.ts`
- Test: `src/__tests__/api/account-safety/account-safety.test.ts`

- [ ] **Step 1: Update types — add safety types to `post-campaigns.ts`**

Add to `src/lib/types/post-campaigns.ts`:

```typescript
// ─── Account Safety ──────────────────────────────────────────────────────────

export interface AccountSafetySettings {
  id: string;
  userId: string;
  unipileAccountId: string;
  operatingHoursStart: string; // HH:MM
  operatingHoursEnd: string;
  timezone: string;
  maxDmsPerDay: number;
  maxConnectionRequestsPerDay: number;
  maxConnectionAcceptsPerDay: number;
  maxCommentsPerDay: number;
  maxLikesPerDay: number;
  minActionDelayMs: number;
  maxActionDelayMs: number;
  accountConnectedAt: string | null;
  circuitBreakerUntil: string | null;
}

export interface SafetyLimitsInput {
  maxDmsPerDay?: number;
  maxConnectionRequestsPerDay?: number;
  maxConnectionAcceptsPerDay?: number;
  maxCommentsPerDay?: number;
  maxLikesPerDay?: number;
  minActionDelayMs?: number;
  maxActionDelayMs?: number;
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  timezone?: string;
  // NOTE: target_locations lives on post_campaigns (per-campaign), NOT on safety settings
}

/** Default limits — fallback when no account_safety_settings row exists.
 *  REPLACES the old LINKEDIN_SAFETY constants (which used higher, less conservative values).
 *  Mark LINKEDIN_SAFETY as @deprecated and update all callers to use getEffectiveLimits(). */
export const SAFETY_DEFAULTS = {
  maxDmsPerDay: 50,
  maxConnectionRequestsPerDay: 10,
  maxConnectionAcceptsPerDay: 80,
  maxCommentsPerDay: 30,
  maxLikesPerDay: 60,
  minActionDelayMs: 45_000,
  maxActionDelayMs: 210_000,
  operatingHoursStart: '08:00',
  operatingHoursEnd: '19:00',
  timezone: 'America/New_York',
} as const;

export type ActionType = 'dm' | 'connection_request' | 'connection_accept' | 'comment' | 'like';

/** High-risk actions get warm-up ramp applied */
export const HIGH_RISK_ACTIONS: ActionType[] = ['dm', 'connection_request'];
```

- [ ] **Step 2: Write the repository**

Create `src/server/repositories/account-safety.repo.ts` following the leads.repo.ts pattern:
- `SELECT_SAFETY_SETTINGS` constant (explicit columns)
- `findByAccountId(userId, accountId)` — returns settings or null
- `findAllByUser(userId)` — returns all account settings for user
- `upsert(userId, accountId, settings)` — insert or update
- `getDailyLimits(accountId, localDate)` — returns current day's usage
- `incrementDailyLimit(accountId, localDate, actionType)` — increment counter
- `setCircuitBreaker(userId, accountId, until)` — set circuit breaker timestamp

- [ ] **Step 3: Write the service**

Create `src/server/services/account-safety.service.ts`:
- `getAccountSettings(userId, accountId)` — returns settings with defaults fallback
- `updateAccountSettings(userId, accountId, input: SafetyLimitsInput)` — upsert
- `getEffectiveLimit(settings, actionType)` — applies warm-up ramp for high-risk actions
- `isWithinOperatingHours(settings)` — timezone-aware check
- `isCircuitBreakerActive(settings)` — check if breaker is set and not expired
- `checkDailyLimit(accountId, actionType, settings)` — returns `{allowed: boolean, used: number, limit: number}`
- `randomDelay(settings)` — returns promise that resolves after random delay between min/max
- `shouldSkipRun()` — 10% chance returns true

- [ ] **Step 4: Write the test**

Create `src/__tests__/api/account-safety/account-safety.test.ts`:
- Test `getEffectiveLimit()` — verify warm-up ramp (week 1 = 50%, week 2 = 75%, week 3+ = 100%)
- Test `isWithinOperatingHours()` — inside hours returns true, outside returns false, handles timezone
- Test `isCircuitBreakerActive()` — active when timestamp is in future, inactive when past or null
- Test `checkDailyLimit()` — returns allowed=true when under limit, false when at limit
- Test `shouldSkipRun()` — returns boolean (statistical test: run 1000 times, ~100 should be true)
- Test `randomDelay()` — returns value between min and max

- [ ] **Step 5: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="account-safety"`
Expected: All tests pass

- [ ] **Step 6: Write API routes**

Create `src/app/api/account-safety-settings/route.ts` — GET handler:
- Auth check, get scope
- Call service to get all settings for user
- Return JSON array

Create `src/app/api/account-safety-settings/[accountId]/route.ts` — PATCH handler:
- Auth check, get scope
- Validate body (operating hours, limits, etc.)
- Call service to upsert
- Return updated settings

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/post-campaigns.ts src/server/repositories/account-safety.repo.ts \
  src/server/services/account-safety.service.ts src/app/api/account-safety-settings/ \
  src/__tests__/api/account-safety/
git commit -m "feat: add account safety settings service with configurable limits and operating hours"
```

---

## Task 3: Unipile Client Updates

**Files:**
- Modify: `src/lib/integrations/base-client.ts`
- Modify: `src/lib/integrations/unipile.ts`
- Test: `src/__tests__/lib/integrations/unipile.test.ts`

- [ ] **Step 1: Verify `postMultipart()` exists on BaseApiClient**

`postMultipart()` already exists at `src/lib/integrations/base-client.ts` (line ~85). Verify it works for our use cases (image upload, DM sending). No code changes needed — just confirm the method signature accepts `FormData`.

- [ ] **Step 2: Update `createPost()` for image support**

In `src/lib/integrations/unipile.ts`:

```typescript
async createPost(
  accountId: string,
  text: string,
  imageFile?: { buffer: Buffer; filename: string; mimeType: string }
): Promise<ApiResponse<UnipilePost>> {
  if (imageFile) {
    const formData = new FormData();
    formData.append('account_id', accountId);
    formData.append('text', text);
    formData.append('attachments', new Blob([imageFile.buffer], { type: imageFile.mimeType }), imageFile.filename);
    return this.postMultipart<UnipilePost>('/posts', formData);
  }
  return this.post<UnipilePost>('/posts', { account_id: accountId, text });
}
```

- [ ] **Step 3: Update `addComment()` for threading + mentions**

```typescript
async addComment(
  postSocialId: string,
  accountId: string,
  text: string,
  options?: {
    commentId?: string;
    mentions?: Array<{ name: string; profile_id: string }>;
  }
): Promise<ApiResponse<{ id: string }>> {
  return this.post(`/posts/${postSocialId}/comments`, {
    account_id: accountId,
    text,
    ...(options?.commentId && { comment_id: options.commentId }),
    ...(options?.mentions && { mentions: options.mentions }),
  });
}
```

- [ ] **Step 4: Verify `sendDirectMessage()` content type**

The Unipile docs say `POST /chats` requires `multipart/form-data`. Check if current JSON implementation works. If not, update to use `postMultipart()`:

```typescript
async sendDirectMessage(
  accountId: string,
  recipientProviderId: string,
  text: string
): Promise<ApiResponse<UnipileChatResponse>> {
  const formData = new FormData();
  formData.append('account_id', accountId);
  formData.append('attendees_ids', recipientProviderId);
  formData.append('text', text);
  return this.postMultipart<UnipileChatResponse>('/chats', formData);
}
```

- [ ] **Step 5: Write tests**

Test `createPost()` with and without image, `addComment()` with and without threading, `sendDirectMessage()`. Mock fetch to verify correct content-type and body structure.

- [ ] **Step 6: Run tests**

Run: `pnpm test -- --testPathPattern="unipile"`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/integrations/base-client.ts src/lib/integrations/unipile.ts src/__tests__/
git commit -m "feat: add multipart support to Unipile client for image posts and threaded comments"
```

---

## Task 4: Image Upload for Posts

**Files:**
- Create: `src/app/api/content-pipeline/posts/[id]/upload-image/route.ts`
- Modify: `src/lib/integrations/linkedin-publisher.ts`
- Modify: `src/server/repositories/posts.repo.ts` (add image_storage_path to whitelist)

- [ ] **Step 1: Create Supabase Storage bucket**

Via Supabase dashboard or migration: create `post-images` bucket (public read, authenticated write).

- [ ] **Step 2: Write image upload API route**

`POST /api/content-pipeline/posts/[id]/upload-image`:
- Auth check
- Accept `multipart/form-data` with `image` field
- Validate file type (png, jpg, webp) and size (<10MB)
- Upload to Supabase Storage: `post-images/{userId}/{postId}/{filename}`
- Update `cp_pipeline_posts.image_storage_path`
- Return `{ imageUrl: string }`

- [ ] **Step 3: Update linkedin-publisher to pass image**

In `src/lib/integrations/linkedin-publisher.ts`, update `publishNow()` to accept optional image:

```typescript
async publishNow(content: string, imageFile?: { buffer: Buffer; filename: string; mimeType: string }) {
  const result = await client.createPost(accountId, content, imageFile);
  // ...
}
```

When publishing a post with `image_storage_path`, fetch the image from Supabase Storage and pass to Unipile.

- [ ] **Step 4: Test image upload route**

Write test: mock Supabase Storage upload, verify file validation, verify storage path update.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/content-pipeline/posts/ src/lib/integrations/linkedin-publisher.ts \
  src/server/repositories/posts.repo.ts src/__tests__/
git commit -m "feat: add image upload for posts with Supabase Storage + Unipile publishing"
```

---

## Task 5: AI Modules (Auto-Setup + Intent Classifier)

**Files:**
- Create: `src/lib/ai/post-campaign/auto-setup.ts`
- Create: `src/lib/ai/post-campaign/intent-classifier.ts`
- Use existing: `src/lib/utils/linkedin-url.ts` (already has `normalizePostUrl()` + `extractLinkedInUsername()`)
- Test: `src/__tests__/lib/ai/post-campaign/auto-setup.test.ts`
- Test: `src/__tests__/lib/ai/post-campaign/intent-classifier.test.ts`

- [ ] **Step 1: Verify existing `normalizePostUrl()` handles all spec formats**

The function already exists in `src/lib/utils/linkedin-url.ts`. Verify it handles all URL formats from the spec's normalization contract table. If it doesn't handle any format, extend it (don't create a new file). Import as `import { normalizePostUrl } from '@/lib/utils/linkedin-url'` everywhere.

- [ ] **Step 2: Write intent classifier**

Create `src/lib/ai/post-campaign/intent-classifier.ts`:

```typescript
/** Tier 2 comment intent classification. Uses Claude Haiku to determine if a comment
 *  expresses interest in a lead magnet when no keyword match is found. */

import Anthropic from '@anthropic-ai/sdk';

const INTENT_CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001';

export async function classifyCommentIntent(
  postCtaText: string,
  commentText: string
): Promise<{ isInterested: boolean; confidence: number }> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: INTENT_CLASSIFIER_MODEL,
    max_tokens: 10,
    messages: [{
      role: 'user',
      content: `Given this LinkedIn post CTA: "${postCtaText}"\nIs this comment expressing interest in receiving the resource?\nComment: "${commentText}"\nAnswer YES or NO.`,
    }],
  });
  const answer = (response.content[0] as { text: string }).text.trim().toUpperCase();
  return {
    isInterested: answer.startsWith('YES'),
    confidence: answer.startsWith('YES') ? 0.8 : 0.2,
  };
}
```

- [ ] **Step 4: Write auto-setup module**

Create `src/lib/ai/post-campaign/auto-setup.ts`:

```typescript
/** AI post analyzer. Reads post text and auto-configures a Post Campaign.
 *  Never imports HTTP or DB directly — receives data as params. */

import Anthropic from '@anthropic-ai/sdk';

export interface AutoSetupInput {
  postText: string;
  publishedFunnels: Array<{ id: string; title: string; slug: string; leadMagnetTitle: string }>;
  teamProfiles: Array<{ id: string; name: string; unipileAccountId: string }>;
  posterProfileId: string;
}

export interface AutoSetupResult {
  keyword: string;
  funnelPageId: string | null;
  funnelName: string | null;
  deliveryAccountId: string;
  deliveryAccountName: string;
  posterAccountId: string;
  replyTemplate: string;
  dmTemplate: string;
  confidence: 'high' | 'medium' | 'low';
  needsUserInput: string[];
}

export async function analyzePostForCampaign(input: AutoSetupInput): Promise<AutoSetupResult> {
  // 1. Extract keyword from CTA (e.g., "comment GTM below" → "GTM")
  // 2. Find "connect with X" → match to team profile
  // 3. Match post content to published funnels by semantic similarity
  // 4. Generate reply + DM templates
  // 5. Determine confidence level
  // Uses Claude Sonnet for the analysis prompt
}
```

- [ ] **Step 5: Write tests for intent classifier**

Test: "GTM" → keyword match (skip classifier), "Interested!" → classifier returns YES, "Nice post but not for me" → classifier returns NO, emoji-only comments.

- [ ] **Step 6: Write tests for auto-setup**

Test: post with clear CTA → high confidence. Post without keyword → low confidence. Post with "connect with Vlad" → correct delivery account. Post matching multiple funnels → medium confidence with options.

- [ ] **Step 7: Run tests**

Run: `pnpm test -- --testPathPattern="post-campaign|normalize-post-url"`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/post-campaign/ src/lib/utils/normalize-post-url.ts src/__tests__/
git commit -m "feat: add AI auto-setup and intent classifier for lead magnet post campaigns"
```

---

## Task 6: Auto-Setup API Route

**Files:**
- Create: `src/app/api/post-campaigns/auto-setup/route.ts`
- Modify: `src/server/services/post-campaigns.service.ts`

- [ ] **Step 1: Add auto-setup method to service**

In `post-campaigns.service.ts`, add:

```typescript
export async function autoSetupCampaign(
  scope: DataScope,
  postId: string
): Promise<AutoSetupResult> {
  // 1. Fetch post text from cp_pipeline_posts
  // 2. Fetch user's published funnels
  // 3. Fetch team profiles with Unipile accounts
  // 4. Call analyzePostForCampaign()
  // 5. Return result
}
```

- [ ] **Step 2: Write API route**

`POST /api/post-campaigns/auto-setup`:
```typescript
// Body: { post_id: string }
// Returns: AutoSetupResult
// Auth check, scope, call service, return JSON
```

- [ ] **Step 3: Write test for route**

Mock the service, verify auth, verify response shape.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/post-campaigns/auto-setup/ src/server/services/post-campaigns.service.ts src/__tests__/
git commit -m "feat: add auto-setup API route for AI-powered campaign configuration"
```

---

## Task 7: Process Post Campaigns Task Update

**Files:**
- Modify: `src/trigger/process-post-campaigns.ts`
- Modify: `src/server/repositories/post-campaigns.repo.ts`
- Test: `src/__tests__/trigger/process-post-campaigns.test.ts`

**Depends on:** Tasks 2 (safety), 3 (Unipile), 5 (AI modules)

- [ ] **Step 1: Update repo — extend typed interfaces and SELECT constants**

In `post-campaigns.repo.ts`:
- Extend the `updateCampaignLead()` parameter interface to include new optional fields: `liked_at`, `replied_at`, `connection_requested_at`, `expired_at`, `match_type`, `location` (this is a typed interface, not a whitelist — add the fields to the type)
- Add `reply_template`, `poster_account_id`, `target_locations`, `lead_expiry_days` to SELECT constants and campaign queries
- Update `LinkedInDailyLimit` interface in types to include `comments_sent`, `likes_sent`

In existing API routes (`src/app/api/post-campaigns/route.ts` and `[id]/route.ts`):
- Update `CreatePostCampaignInput` to accept new fields: `reply_template`, `poster_account_id`, `target_locations`, `lead_expiry_days`
- Update `UpdatePostCampaignInput` similarly

- [ ] **Step 2: Add two-tier matching to detection phase**

In `process-post-campaigns.ts`, Phase 1:
- After keyword substring match fails, call `classifyCommentIntent()`
- Set `match_type: 'keyword'` or `'intent'` on lead record
- Detection runs regardless of operating hours

- [ ] **Step 3: Add Phase 2 — React + Reply + Connect**

After detection, gate on operating hours:
- One-time post reaction (LIKE) from poster's account
- For each unreplied lead (up to MAX_ACTIONS_PER_RUN):
  - Reply from delivery account using `addComment()` with `commentId` + `mentions`
  - Dedup: check `replied_at` is null before replying
  - Set `replied_at` on success
  - Random delay
  - If commenter location matches `target_locations` + `auto_connect`:
    - Resolve profile → get provider_id + location
    - Send connection request from delivery account
    - Set status → `connection_pending`, `connection_requested_at`
  - Random delay

- [ ] **Step 4: Update DM phase — use safety service**

Replace hardcoded `LINKEDIN_SAFETY` checks with `accountSafetyService.checkDailyLimit()` and `accountSafetyService.randomDelay()`.

- [ ] **Step 5: Add concurrency controls**

Two levels of concurrency protection:
1. `maxConcurrentRuns: 1` on the scheduled task (prevents overlapping cron runs)
2. Per-account concurrency: when processing LinkedIn actions, fan out per-account work using Trigger.dev's `concurrencyLimit: { id: 'linkedin-actions-${accountId}', limit: 1 }` to prevent different tasks (process-post-campaigns and poll-connection-requests) from performing actions on the same LinkedIn account simultaneously

- [ ] **Step 6: Write tests**

Test: detection finds keyword match, detection falls through to intent match, operating hours gate, reply uses correct account, connection request only sent for target locations, daily limits respected.

- [ ] **Step 7: Commit**

```bash
git add src/trigger/process-post-campaigns.ts src/server/repositories/post-campaigns.repo.ts src/__tests__/
git commit -m "feat: add react + reply + connect action chain to process-post-campaigns task"
```

---

## Task 8: Poll Connection Requests Task Update

**Files:**
- Modify: `src/trigger/poll-connection-requests.ts`

**Depends on:** Task 2 (safety)

- [ ] **Step 1: Add operating hours + circuit breaker checks**

Before processing each account:
```typescript
const settings = await getAccountSettings(userId, accountId);
if (!isWithinOperatingHours(settings)) continue;
if (isCircuitBreakerActive(settings)) continue;
```

- [ ] **Step 2: Update status query to include `connection_pending`**

Change lead query from `status = 'detected'` to `status IN ('detected', 'connection_pending')`.

- [ ] **Step 3: Add 10% skip run chance**

At task start:
```typescript
if (shouldSkipRun()) {
  logger.info('Randomly skipping this poll run');
  return { skipped: true };
}
```

- [ ] **Step 4: Add `maxConcurrentRuns: 1`**

- [ ] **Step 5: Add circuit breaker trigger on errors**

If any Unipile call returns 429 or restricted error:
```typescript
await setCircuitBreaker(userId, accountId, new Date(Date.now() + 24 * 60 * 60 * 1000));
logger.error('Circuit breaker activated', { accountId, error });
break; // Stop all actions for this account
```

- [ ] **Step 6: Commit**

```bash
git add src/trigger/poll-connection-requests.ts
git commit -m "feat: add operating hours, circuit breaker, and skip-run to poll-connection-requests"
```

---

## Task 9: Expire Campaign Leads Task

**Files:**
- Create: `src/trigger/expire-campaign-leads.ts`

- [ ] **Step 1: Write the task**

```typescript
import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export const expireCampaignLeads = schedules.task({
  id: 'expire-campaign-leads',
  cron: '0 */6 * * *', // Every 6 hours
  maxDuration: 60,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Expire leads that haven't connected within lead_expiry_days
    const { data, error } = await supabase.rpc('expire_campaign_leads');
    // Or raw query joining post_campaigns for lead_expiry_days

    logger.info('Expired campaign leads', { count: data?.length ?? 0 });
    return { expired: data?.length ?? 0 };
  },
});
```

- [ ] **Step 2: Write the RPC or inline query**

Use the SQL from the spec:
```sql
UPDATE post_campaign_leads pcl
SET status = 'expired', expired_at = now()
FROM post_campaigns pc
WHERE pcl.campaign_id = pc.id
  AND pc.status = 'active'
  AND pcl.status IN ('detected', 'connection_pending')
  AND pcl.detected_at < now() - (pc.lead_expiry_days || ' days')::interval;
```

- [ ] **Step 3: Write test for expire logic**

Test: lead detected 8 days ago with campaign `lead_expiry_days=7` → expired. Lead detected 5 days ago → not expired. Lead with `connection_accepted` status → not expired (only `detected` and `connection_pending` get expired).

- [ ] **Step 4: Commit**

```bash
git add src/trigger/expire-campaign-leads.ts
git commit -m "feat: add expire-campaign-leads scheduled task"
```

---

## Task 10: MCP Tools

**Files:**
- Modify: `packages/mcp/src/tools/post-campaigns.ts` (or create if doesn't exist)
- Modify: `packages/mcp/src/handlers/post-campaigns.ts`
- Modify: `packages/mcp/src/client.ts`
- Create: `packages/mcp/src/tools/account-safety.ts`
- Create: `packages/mcp/src/handlers/account-safety.ts`

**Depends on:** Tasks 2, 6

- [ ] **Step 1: Define campaign MCP tools**

Add/update tools following the `accountTools` pattern:
- `magnetlab_list_post_campaigns` — list with status filter
- `magnetlab_create_post_campaign` — create with auto-setup option
- `magnetlab_get_post_campaign` — detail + lead breakdown
- `magnetlab_update_post_campaign` — update config
- `magnetlab_activate_post_campaign` — activate
- `magnetlab_pause_post_campaign` — pause
- `magnetlab_delete_post_campaign` — delete

- [ ] **Step 2: Define safety MCP tools**

Create `account-safety.ts`:
- `magnetlab_get_account_safety_settings` — get settings for an account
- `magnetlab_update_account_safety_settings` — update limits, hours, locations

- [ ] **Step 3: Write handlers**

Switch/case dispatch following existing handler pattern. Call `client` methods.

- [ ] **Step 4: Add client methods**

Add to `packages/mcp/src/client.ts`:
- `listPostCampaigns(status?)`
- `createPostCampaign(config)` / `autoSetupPostCampaign(postId)`
- `getPostCampaign(id)`
- `updatePostCampaign(id, config)`
- `activatePostCampaign(id)`
- `pausePostCampaign(id)`
- `deletePostCampaign(id)`
- `getAccountSafetySettings(accountId)`
- `updateAccountSafetySettings(accountId, settings)`

- [ ] **Step 5: Update existing `magnetlab_create_post` tool**

In `packages/mcp/src/tools/posts.ts` and `packages/mcp/src/handlers/posts.ts`:
- Add `image_url?: string` parameter (URL to fetch and upload)
- Add `is_lead_magnet_post?: boolean` parameter (triggers auto-setup)
- Add `auto_activate?: boolean` parameter (skip review, activate immediately if high confidence)
- Update handler to call image upload + auto-setup when these params are provided

- [ ] **Step 6: Register tools in tool registry**

Add new tool arrays to the main tool registration in `packages/mcp/src/index.ts` (or wherever tools are aggregated).

- [ ] **Step 7: Write MCP tool tests**

Test tool schema validation, handler dispatch, client method calls.

- [ ] **Step 8: Run MCP tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm --filter @magnetlab/mcp test`
Expected: All pass

- [ ] **Step 9: Commit**

```bash
git add packages/mcp/
git commit -m "feat: add MCP tools for post campaigns and account safety settings"
```

---

## Task 11: Frontend API Modules + Hooks

**Files:**
- Create: `src/frontend/api/post-campaigns.ts`
- Create: `src/frontend/api/account-safety.ts`
- Create: `src/frontend/hooks/api/usePostCampaigns.ts`
- Create: `src/frontend/hooks/api/useAccountSafety.ts`

**Depends on:** Tasks 2, 6

- [ ] **Step 1: Write post campaigns API module**

Following `src/frontend/api/settings/whitelabel.ts` pattern:

```typescript
/** Post Campaigns API (client). Routes: /api/post-campaigns/* */
import { apiClient } from '../client';

export async function listCampaigns(status?: string) { ... }
export async function getCampaign(id: string) { ... }
export async function createCampaign(config: CreateCampaignInput) { ... }
export async function updateCampaign(id: string, config: Partial<CreateCampaignInput>) { ... }
export async function activateCampaign(id: string) { ... }
export async function pauseCampaign(id: string) { ... }
export async function deleteCampaign(id: string) { ... }
export async function autoSetupCampaign(postId: string) { ... }
export async function getCampaignLeads(id: string, status?: string) { ... }
```

- [ ] **Step 2: Write account safety API module**

```typescript
/** Account Safety API (client). Routes: /api/account-safety-settings/* */
import { apiClient } from '../client';

export async function listAccountSettings() { ... }
export async function updateAccountSettings(accountId: string, settings: SafetyLimitsInput) { ... }
```

- [ ] **Step 3: Write SWR hooks**

`usePostCampaigns.ts` — `useCampaigns()`, `useCampaign(id)`, `useCampaignLeads(id, status)`
`useAccountSafety.ts` — `useAccountSafetySettings()`

Follow existing hook patterns with SWR `mutate` for optimistic updates.

- [ ] **Step 4: Commit**

```bash
git add src/frontend/api/ src/frontend/hooks/api/
git commit -m "feat: add frontend API modules and SWR hooks for post campaigns and safety settings"
```

---

## Task 12: Campaign UI Pages

**Files:**
- Create: `src/app/(dashboard)/post-campaigns/page.tsx`
- Create: `src/app/(dashboard)/post-campaigns/[id]/page.tsx`
- Create: `src/components/post-campaigns/CampaignList.tsx`
- Create: `src/components/post-campaigns/CampaignDetail.tsx`
- Create: `src/components/post-campaigns/AutoSetupCard.tsx`
- Create: `src/components/post-campaigns/CampaignForm.tsx`

**Depends on:** Task 11

- [ ] **Step 1: Build CampaignList component**

Table with columns: name, post URL (truncated), status badge, detected/connected/DM'd counters. Actions: activate, pause, delete. Filter by status.

Use `useCampaigns()` hook. Follow existing dashboard table patterns.

- [ ] **Step 2: Build CampaignForm component**

Fields: post URL input, keywords (tag input), sender account dropdown, DM template textarea with {{name}}/{{funnel_url}} placeholder chips, funnel page selector dropdown, reply template textarea, behavior toggles (auto-accept, auto-connect).

- [ ] **Step 3: Build AutoSetupCard component**

Shows AI-extracted config: keyword, funnel match, delivery account, templates. Each field editable inline. "Activate" button. Rendered after auto-setup API returns.

- [ ] **Step 4: Build CampaignDetail component**

Stats funnel visualization: detected → replied → connected → DM'd. Lead table with status, name, LinkedIn URL, timestamps, match type, error. Campaign config summary. Edit + pause/activate buttons.

- [ ] **Step 5: Wire up pages**

`/(dashboard)/post-campaigns/page.tsx` — renders CampaignList + create button (opens form/auto-setup flow)
`/(dashboard)/post-campaigns/[id]/page.tsx` — renders CampaignDetail

- [ ] **Step 6: Add nav link**

Add "Post Campaigns" to dashboard sidebar navigation.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/post-campaigns/ src/components/post-campaigns/
git commit -m "feat: add post campaigns dashboard UI with list, detail, form, and auto-setup card"
```

---

## Task 13: Safety Settings UI

**Files:**
- Create: `src/app/(dashboard)/settings/safety/page.tsx`
- Create: `src/components/settings/AccountSafetySettings.tsx`

**Depends on:** Task 11

- [ ] **Step 1: Build AccountSafetySettings component**

Per-account cards showing:
- Operating hours: time pickers (start/end) + timezone dropdown
- Daily limits: number inputs for each action type (DMs, connection requests, accepts, comments, likes)
- Delay range: min/max sliders
- Warm-up status: days since connected, current multiplier percentage
- Circuit breaker: status badge (active/inactive), reset time if active

Use `useAccountSafetySettings()` hook. Save on blur or via save button.

- [ ] **Step 2: Wire up settings page**

`/(dashboard)/settings/safety/page.tsx` — renders AccountSafetySettings for each connected account.

- [ ] **Step 3: Add settings nav link**

Add "Safety" to settings sub-navigation alongside account, integrations, branding, etc.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/settings/safety/ src/components/settings/
git commit -m "feat: add account safety settings UI with per-account limits and operating hours"
```

---

## Task 14: Integration Testing

**Depends on:** All previous tasks

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All existing + new tests pass

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Manual Unipile verification**

Using a test account:
1. Verify `createPost()` with image works
2. Verify `addComment()` with `comment_id` threading works
3. Verify `sendDirectMessage()` works (JSON or multipart)
4. Verify `sendConnectionRequest()` works
5. Verify `listReceivedInvitations()` returns expected shape

Document results and any adjustments needed.

- [ ] **Step 5: Deploy Trigger.dev tasks**

Run: `TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB pnpm dlx trigger.dev@4.3.3 deploy`
Expected: All tasks registered, no errors

- [ ] **Step 6: End-to-end test with real post**

1. Create a test post with image in magnetlab
2. Mark as lead magnet post
3. Verify auto-setup returns correct config
4. Activate campaign
5. Comment on the LinkedIn post with the keyword
6. Wait 5-10 minutes, verify: comment detected, lead created
7. Verify: comment liked, reply posted from delivery account
8. Send connection request from test account
9. Wait 20 minutes, verify: connection accepted
10. Wait 5 more minutes, verify: DM sent with funnel URL

- [ ] **Step 7: Commit any fixes**

Stage only the specific files that were changed during integration testing — never use `git add -A`.

```bash
git commit -m "fix: integration test adjustments"
```

---

## Post-Completion Checklist

- [ ] All tests pass (`pnpm test`)
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] Build passes (`pnpm build`)
- [ ] Trigger.dev tasks deployed
- [ ] CLAUDE.md updated with Post Campaigns feature documentation
- [ ] Code review via `superpowers:requesting-code-review`
- [ ] All review findings resolved
