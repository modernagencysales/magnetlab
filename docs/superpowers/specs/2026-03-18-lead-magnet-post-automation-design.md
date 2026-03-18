# Lead Magnet Post Automation — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Repo:** magnetlab
**Supersedes:** `2026-03-16-post-campaign-automation-design.md`

## Problem

When a LinkedIn post includes a CTA like "comment GTM below and connect with Vlad", there's a manual gap between the comment and delivery. Someone must monitor comments, like them, reply, accept connection requests, and DM each person the funnel link. This doesn't scale and creates hours of delay when a post performs well.

We want to post lead magnets daily across all team accounts — different posts, different lead magnets, different accounts — and have the entire end-to-end delivery automated.

## Solution

Extend the existing Post Campaign system to become a zero-config, AI-powered lead magnet delivery pipeline:

1. **AI auto-setup** — user toggles "Lead Magnet Post" on a post, AI reads the content and configures everything: keyword, lead magnet match, delivery account, reply template, DM template
2. **Image publishing** — file upload in UI + MCP, Unipile media upload on publish
3. **Full action chain** — react to post → reply (threaded) from delivery account → accept/send connection → DM with funnel URL
4. **Loose matching** — keyword substring + AI intent fallback for comments like "Interested!" or "🙋‍♂️"
5. **Location-gated outbound connections** — only send connection requests to commenters in target locations
6. **Safety-first** — operating hours, configurable per-account limits, randomization, warm-up, circuit breaker

Everything works from both UI and MCP/Claude Code.

## Non-Goals

- Replacing HeyReach for cold outbound
- AI-generated post images (file upload only for now)
- Full LinkedIn automation suite (this is specifically for post-driven lead magnet delivery)
- A/B testing DM templates (v1 is single template per campaign)

## Relationship to Existing Systems

**Post Campaigns (this spec):** Primary system. Detects comments via Signal Engine polling, executes full action chain.

**LinkedIn Automations (existing):** Triggered by Unipile webhooks for Unipile-published posts. Deprecated by this spec — Post Campaigns subsume all functionality. Keep existing code but don't build on it.

**Signal Engine (existing):** Unchanged. Continues to poll Harvest API for post engagements. Post Campaigns read from `signal_leads` + `signal_events`.

---

## Architecture

### AI Auto-Setup Flow

When a post is marked as a "Lead Magnet Post" (toggle in UI or `is_lead_magnet_post: true` via MCP), AI analyzes the post text and auto-configures a Post Campaign:

```
Post text: "...comment GTM below, and send a connection request to Vlad..."

AI extracts:
  keyword: "GTM"           ← from "comment GTM below"
  lead_magnet: match by    ← semantic similarity against published lead magnets
  delivery_account: "Vlad" ← from "connect with Vlad" → matched to team profile
  reply_template: "Hey {{name}}! Just sent you a connection request — accept it and I'll send the resource right over 🚀"
  dm_template: "Hey {{name}}, here's the guide you requested: {{funnel_url}}"
```

**AI module:** `src/lib/ai/post-campaign/auto-setup.ts`

**Inputs:** post text, user's published funnels list, team profiles with connected accounts

**Outputs:** Draft `PostCampaign` config (keyword, funnel_page_id, delivery account, templates)

**Fallback rules:**
- If no "connect with X" found → delivery account = poster's account
- If no clear keyword found → AI proposes one based on CTA, user confirms
- If no lead magnet match with high confidence → prompt user to select
- If multiple possible matches → return ranked list, user picks

**Confidence levels:**
- **high** — keyword found AND single funnel match AND delivery account resolved → auto-activate safe
- **medium** — keyword found but multiple funnel matches OR delivery account ambiguous → show options
- **low** — no clear keyword OR no funnel match → requires user input before activation

**From UI:** Shows a summary card with all extracted config. User reviews, can edit any field, then hits "Activate". One click if AI got it right.

**From MCP:** Returns config for agent review. Agent can auto-activate if confidence is high, or present to user.

### Data Flow

```
1. Create post (with image) + mark as lead magnet post
   │
   ▼
2. AI auto-configures Post Campaign (keyword, funnel, delivery account, templates)
   │
   ▼
3. User reviews + activates (UI) or agent activates (MCP)
   │
   ▼
4. Publish post via Unipile (with image attachment)
   │
   ▼
5. Signal Engine detects commenters (Harvest API, every 10 min)
   │
   ▼
6. process-post-campaigns task (every 5 min):
   ├─ Match comments: keyword substring → AI intent fallback
   ├─ Like comment (poster's account)
   ├─ Reply to comment (delivery account)
   ├─ If commenter in target location + not connected:
   │   └─ Send connection request (delivery account, max 10/day)
   │
   ▼
7. poll-connection-requests task (every 20 min ± jitter):
   ├─ Accept matching invitations on delivery account
   │
   ▼
8. process-post-campaigns task (next run):
   ├─ DM with funnel URL (delivery account)
   │
   ▼
9. Lead clicks funnel URL → magnetlab opt-in → qualification → delivery
```

### Action Sequence Per Lead

| Step | Account | Action | When |
|------|---------|--------|------|
| Detect | — | Keyword + intent match on comment | 5-min poll |
| React | **Poster's** account | React (LIKE) to the post (once, not per comment) | After first detect, one-time |
| Reply | **Delivery** account | Threaded reply to the specific comment (using `comment_id`) | After detect, randomized delay |
| Connect | **Delivery** account | Send connection request (location-gated) | After reply, if not already connected |
| Accept | **Delivery** account | Accept incoming connection request | 20-min poll |
| DM | **Delivery** account | Send funnel URL | After connection established |

**Reply threading:** Replies use Unipile's `comment_id` parameter to thread under the specific comment (not as a top-level comment). The commenter is mentioned using Unipile's `{{0}}` + `mentions` array pattern so they get a notification.

**Post reaction vs comment like:** Unipile's reaction endpoint takes a `post_id` but does not support targeting individual comments for reactions. We react to the post itself once (the first time any lead is detected), not per comment. This is a LinkedIn UX detail — the poster's "like" of their own post is a common engagement signal.

**When poster = delivery (same person):** All actions use the same account ID. No logic change needed.

**Cross-account commenting:** Unipile supports any account commenting on any public post. Verified via API docs — `POST /posts/{post_id}/comments` accepts any `account_id`.

### Timing

| Step | Delay | Cumulative |
|------|-------|------------|
| Signal detects comment | 0–10 min | 10 min |
| Campaign matches + likes + replies | 0–5 min | 15 min |
| Connection polled + accepted | 0–20 min | 35 min |
| DM sent on next campaign run | 0–5 min | 40 min |

**Worst case: ~40 min.** Average: ~15–25 min. Looks natural.

### URL Normalization Contract

LinkedIn posts have multiple URL formats. Both `post_campaigns.post_url` and `signal_events.source_url` MUST be normalized to the same canonical format for matching to work.

**Canonical format:** Extract the activity ID and store as `urn:li:activity:{numericId}`

| Input format | Normalized |
|---|---|
| `https://www.linkedin.com/posts/username-text-7332661864792854528-xxxx` | `urn:li:activity:7332661864792854528` |
| `https://www.linkedin.com/feed/update/urn:li:activity:7332661864792854528` | `urn:li:activity:7332661864792854528` |
| `urn:li:activity:7332661864792854528` | `urn:li:activity:7332661864792854528` |
| `urn:li:ugcPost:7332661864792854528` | `urn:li:ugcPost:7332661864792854528` |

**Implementation:** Add `normalizePostUrl()` utility. Both campaign creation (API route) and signal event storage (scrape-engagement task) must use this function. Verify that the Signal Engine already normalizes URLs — if not, add normalization to the scrape-engagement task.

### Reply Template Spec

Replies are posted as **threaded comments** under the specific commenter's comment, NOT as top-level comments. This prevents the bot from appearing spammy with multiple top-level comments.

**Unipile threading:** Use `comment_id` parameter in `POST /posts/{post_id}/comments` to reply to a specific comment. The comment_id comes from the Signal Engine's engagement scrape (stored in `signal_events`).

**Mention:** Use Unipile's `{{0}}` + `mentions` array to @-mention the commenter, ensuring they get a LinkedIn notification:

```json
{
  "account_id": "vlads_account_id",
  "text": "{{0}} Just sent you a connection request — accept it and I'll send the resource right over! 🚀",
  "comment_id": "7335000001439513601",
  "mentions": [{
    "name": "John Doe",
    "profile_id": "ACoAASss4UBzQV9fDt_ziQ45zzpCVnAhxbW"
  }]
}
```

**Template variables for `reply_template`:**
- `{{name}}` — commenter's first name
- `{{full_name}}` — commenter's full name
- Mention is auto-prepended (not in the template itself)

**Signal Engine dependency:** The `signal_events` table must store the comment's social_id (for `comment_id`) and the commenter's `provider_id` (for mentions). Verify these fields exist in the scrape-engagement output.

---

## Comment Matching — Two-Tier

### Tier 1: Keyword Match (fast, no API call)

Case-insensitive substring match with punctuation/emoji stripping.

```typescript
function matchesKeyword(commentText: string, keywords: string[]): boolean {
  const normalized = commentText.toLowerCase().replace(/[^\w\s]/g, '').trim();
  return keywords.some(kw => normalized.includes(kw.toLowerCase()));
}
```

"comment GTM below" + comment "GTM please!" → match.

### Tier 2: Intent Match (LLM fallback)

Only runs if Tier 1 fails. Quick Claude Haiku call:

```
Given this LinkedIn post CTA: "{cta_text}"
Is this comment expressing interest in receiving the resource?
Comment: "{comment_text}"
Answer YES or NO.
```

Catches: "Interested!", "Yes please!", "Send it my way!", "🙋‍♂️", "Need this!", "👋"

**Cost:** ~$0.003/call. At 100 non-keyword comments/day = $0.30/day. Negligible.

**Caching:** Post CTA context is the same for all comments on one post — cache the system prompt per campaign.

---

## Image Publishing

### Unipile Media Upload

Unipile's `POST /api/v1/posts` accepts `multipart/form-data` with an `attachments` field for file upload. Verified in API docs.

### Updated Unipile Client

```typescript
async createPost(
  accountId: string,
  text: string,
  imageFile?: { buffer: Buffer; filename: string; mimeType: string }
): Promise<{ postId: string }> {
  const formData = new FormData();
  formData.append('account_id', accountId);
  formData.append('text', text);
  if (imageFile) {
    formData.append('attachments', new Blob([imageFile.buffer], { type: imageFile.mimeType }), imageFile.filename);
  }
  // POST /api/v1/posts with multipart/form-data
}
```

### Upload Flow

**From UI:**
1. User uploads image via file input on post creation form
2. Image stored in Supabase Storage (`post-images` bucket)
3. On publish, image fetched from storage and sent to Unipile

**From MCP:**
1. Agent provides image URL (public URL or Supabase storage URL)
2. System fetches the image, sends to Unipile
3. MCP tool: `magnetlab_create_post({ text, image_url, team_profile_id, is_lead_magnet_post })`

### Post Schema Update

Add to `cp_pipeline_posts`:
```sql
image_storage_path text,  -- Supabase storage path (e.g., 'post-images/{user_id}/{uuid}.png')
```

The existing `image_urls` field stores the final public URLs after publishing.

Add `is_lead_magnet_post` flag:
```sql
ALTER TABLE cp_pipeline_posts ADD COLUMN
  is_lead_magnet_post boolean NOT NULL DEFAULT false;
```

When true, publishing triggers the AI auto-setup flow to create a Post Campaign.

---

## Database Schema Changes

### `post_campaigns` — Updated

```sql
-- New columns (added to existing table)
ALTER TABLE post_campaigns ADD COLUMN
  reply_template text,                          -- reply from delivery account, supports {{name}}
  reply_account_id text,                        -- delivery account for replies (= unipile_account_id usually)
  poster_account_id text,                       -- poster's account for likes
  target_locations text[] DEFAULT '{}',         -- ICP location filter for outbound connection requests
  lead_expiry_days integer NOT NULL DEFAULT 7;  -- auto-expire unconnected leads after N days
```

### `post_campaign_leads` — Updated

```sql
-- New columns
ALTER TABLE post_campaign_leads ADD COLUMN
  match_type text DEFAULT 'keyword'             -- 'keyword' or 'intent' (for analytics)
    CHECK (match_type IN ('keyword', 'intent')),
  location text,                                -- commenter's location from profile
  liked_at timestamptz,                         -- when we liked their comment
  replied_at timestamptz,                       -- when we replied to their comment
  connection_requested_at timestamptz,          -- when we sent connection request
  expired_at timestamptz;                       -- when lead expired (no connection after N days)

-- Add 'expired' to status check
ALTER TABLE post_campaign_leads DROP CONSTRAINT post_campaign_leads_status_check;
ALTER TABLE post_campaign_leads ADD CONSTRAINT post_campaign_leads_status_check
  CHECK (status IN ('detected', 'connection_pending', 'connection_accepted',
                    'dm_queued', 'dm_sent', 'dm_failed', 'skipped', 'expired'));
```

### `account_safety_settings` — New

Configurable per-account safety limits, editable from UI and MCP.

```sql
CREATE TABLE account_safety_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unipile_account_id text NOT NULL,

  -- Operating hours
  operating_hours_start time NOT NULL DEFAULT '08:00',
  operating_hours_end time NOT NULL DEFAULT '19:00',
  timezone text NOT NULL DEFAULT 'America/New_York',

  -- Daily limits (all configurable)
  max_dms_per_day integer NOT NULL DEFAULT 50,
  max_connection_requests_per_day integer NOT NULL DEFAULT 10,
  max_connection_accepts_per_day integer NOT NULL DEFAULT 80,
  max_comments_per_day integer NOT NULL DEFAULT 30,
  max_likes_per_day integer NOT NULL DEFAULT 60,

  -- Delays (milliseconds, randomized between min and max)
  min_action_delay_ms integer NOT NULL DEFAULT 45000,
  max_action_delay_ms integer NOT NULL DEFAULT 210000,

  -- Warm-up
  account_connected_at timestamptz,  -- for warm-up calculation
  -- Week 1: 50% of limits, Week 2: 75%, Week 3+: 100%

  -- NOTE: target_locations lives on post_campaigns (per-campaign), NOT here.
  -- Different campaigns may target different geographies.

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, unipile_account_id)
);

ALTER TABLE account_safety_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own account settings"
  ON account_safety_settings FOR ALL USING (user_id = auth.uid());
```

### `linkedin_daily_limits` — Updated

```sql
-- Add new action types + timezone-aware reset
ALTER TABLE linkedin_daily_limits ADD COLUMN
  comments_sent integer NOT NULL DEFAULT 0,
  likes_sent integer NOT NULL DEFAULT 0,
  connection_requests_sent integer NOT NULL DEFAULT 0;

-- Change date to be timezone-aware: store the LOCAL date in account's timezone
-- Check is done in code: if current local date (in account TZ) != stored date, reset
```

---

## Safety System

### Per-Account Limits (defaults, all editable)

| Action | Default daily cap | Notes |
|---|---|---|
| Connection requests sent | **10** | Highest risk, very conservative |
| DMs sent | 50 | Moderate risk |
| Comments (replies) | 30 | Low risk but capped |
| Likes | 60 | Lowest risk |
| Connection accepts | 80 | Low risk (they initiated) |

### Operating Hours

- Defined per account in `account_safety_settings`
- Default: 8:00 AM - 7:00 PM in account's timezone
- All actions (likes, replies, connection requests, DMs) only execute within operating hours
- Tasks check `isWithinOperatingHours(accountSettings)` before any action
- Posts scheduled outside operating hours get shifted to next available window

### Randomization

- **Action delays:** 45-210 seconds (random uniform) between every action
- **Poll jitter:** ±5 minutes on all scheduled tasks
- **Action ordering:** Randomize order of leads processed within a batch
- **Skip runs:** 10% chance of skipping a poll cycle entirely
- **Never fixed intervals** — every delay is `randomBetween(min, max)`

### Warm-Up Ramp

Based on `account_connected_at`:
- **Week 1:** 50% of configured limits
- **Week 2:** 75% of configured limits
- **Week 3+:** 100% of configured limits

Only applies to high-risk actions (DMs, connection requests). Likes and comments use full limits from day 1.

```typescript
function getEffectiveLimit(baseLimit: number, connectedAt: Date, isHighRisk: boolean): number {
  if (!isHighRisk) return baseLimit;
  const weeksConnected = Math.floor((Date.now() - connectedAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
  if (weeksConnected < 1) return Math.floor(baseLimit * 0.5);
  if (weeksConnected < 2) return Math.floor(baseLimit * 0.75);
  return baseLimit;
}
```

### Circuit Breaker

If any LinkedIn action returns an error indicating rate limiting or restriction (HTTP 429, "restricted", "temporarily unavailable", "challenge"):
1. Immediately stop ALL automation for that account
2. Set a `circuit_breaker_until` timestamp = now + 24 hours
3. Log the error with full context
4. Alert the user (in-app notification + log)

```sql
ALTER TABLE account_safety_settings ADD COLUMN
  circuit_breaker_until timestamptz;  -- null = no breaker active
```

### Lead Expiry

Leads that are `detected` or `connection_pending` for longer than `lead_expiry_days` (default 7) get marked as `expired`. A cleanup query runs in the process-post-campaigns task:

```sql
UPDATE post_campaign_leads
SET status = 'expired', expired_at = now()
WHERE status IN ('detected', 'connection_pending')
  AND detected_at < now() - (campaign.lead_expiry_days || ' days')::interval;
```

### Warm-Up Risk Classification

| Action | isHighRisk | Warm-up applies? |
|---|---|---|
| Connection requests | YES | Yes — 50%/75%/100% ramp |
| DMs | YES | Yes — 50%/75%/100% ramp |
| Connection accepts | NO | No — full limits from day 1 |
| Comments (replies) | NO | No — full limits from day 1 |
| Likes (reactions) | NO | No — full limits from day 1 |

### LINKEDIN_SAFETY Constants Transition

The existing `LINKEDIN_SAFETY` constants in `src/lib/types/post-campaigns.ts` become **fallback defaults only**. All limit checks must read from `account_safety_settings` first:

```typescript
async function getEffectiveLimits(userId: string, accountId: string): Promise<SafetyLimits> {
  const settings = await getAccountSafetySettings(userId, accountId);
  if (settings) return settings;
  // Fallback to LINKEDIN_SAFETY constants (legacy)
  return LINKEDIN_SAFETY_DEFAULTS;
}
```

Phase 1 must refactor `checkDailyLimit()` in `post-campaigns.service.ts` to call `getEffectiveLimits()` instead of reading hardcoded constants.

### Daily Limit Timezone Alignment

Daily limits reset at midnight in the **account's operating timezone** (from `account_safety_settings.timezone`), not UTC. The check:

```typescript
function getDailyLimitDate(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
}
```

If stored `date` !== current local date → reset counters.

---

## Trigger.dev Tasks

### Concurrency Control

All tasks that perform LinkedIn actions use Trigger.dev concurrency keyed per account:
```typescript
concurrencyLimit: { id: `linkedin-actions-${accountId}`, limit: 1 }
```

### 1. `process-post-campaigns` (updated)

**Schedule:** Every 5 minutes
**Max duration:** 5 minutes
**Concurrency:** `maxConcurrentRuns: 1` on the scheduled task itself (prevents overlapping runs)

```
For each active post_campaign:

  -- PHASE 1: DETECTION (DB only, no LinkedIn API, runs regardless of operating hours)
  1. Query new matching commenters from signal_leads + signal_events
  2. For non-keyword matches: run AI intent classification (Tier 2)
  3. Insert post_campaign_leads (status: detected, match_type: keyword|intent)

  -- Operating hours gate: skip Phases 2-3 if outside operating hours or circuit breaker active

  -- PHASE 2: REACT + REPLY + CONNECT (poster + delivery accounts)
  4. One-time post reaction: If no leads have been reacted to yet for this campaign,
     react (LIKE) to the post from poster's account. Track via campaign-level flag.
  5. Query leads WHERE status = 'detected' AND replied_at IS NULL
  6. For each (up to MAX_ACTIONS_PER_RUN):
     a. Reply from delivery account using comment_id for threading + mention commenter
        - Dedup check: query Unipile comments list to verify we haven't already replied
        - Set replied_at on success
     b. Random delay (45-210s)
     c. If commenter has location data + in target locations + auto_connect:
        - Resolve profile → get provider_id + location
        - Send connection request from delivery account
        - Update status → connection_pending, set connection_requested_at
     d. If commenter NOT in target locations:
        - Leave at detected (they can still connect themselves)
     e. Random delay (45-210s)

  -- PHASE 3: DM SENDING (delivery account)
  7. Query leads WHERE status = 'connection_accepted' AND dm_sent_at IS NULL
  8. For each (up to MAX_ACTIONS_PER_RUN):
     a. Resolve provider_id (if not cached)
     b. Render DM template with {{name}} and {{funnel_url}}
     c. Send DM via Unipile
     d. Update status → dm_sent, set dm_sent_at
     e. On failure: status → dm_failed, set error
     f. Random delay (45-210s)

  -- PHASE 4: RECONCILE COUNTERS
  9. Update campaign counters from COUNT queries
```

**Note:** Lead expiry is handled by the dedicated `expire-campaign-leads` task (every 6 hours), NOT in this task. Keeps this task focused on active processing.

### 2. `poll-connection-requests` (updated)

**Schedule:** Every 20 minutes (± 5 min jitter)
**Max duration:** 3 minutes
**Concurrency:** `maxConcurrentRuns: 1` on the scheduled task

```
Apply random jitter (0-5 min delay at start)
10% chance: skip this run entirely

For each unique delivery account across active campaigns:
  Check operating hours + circuit breaker
  Check daily accept limit

  1. List received invitations via Unipile
  2. For each invitation:
     - Match sender to post_campaign_leads WHERE status IN ('detected', 'connection_pending')
       by provider_id or linkedin_url
     - If match found AND auto_accept_connections:
       - Accept invitation
       - Update lead status → connection_accepted
       - Set connection_accepted_at
       - Increment daily counter
       - Random delay (45-210s)
     - If NOT in any campaign: skip (never auto-accept strangers)
```

### 3. `expire-campaign-leads` (new, lightweight)

**Schedule:** Every 6 hours
**Purpose:** Clean up leads that never connected

```sql
UPDATE post_campaign_leads pcl
SET status = 'expired', expired_at = now()
FROM post_campaigns pc
WHERE pcl.campaign_id = pc.id
  AND pc.status = 'active'
  AND pcl.status IN ('detected', 'connection_pending')
  AND pcl.detected_at < now() - (pc.lead_expiry_days || ' days')::interval;
```

---

## API Routes

### Existing (from v1 spec, kept as-is)

```
GET    /api/post-campaigns                    — list user's campaigns
POST   /api/post-campaigns                    — create campaign
GET    /api/post-campaigns/[id]               — get campaign + lead stats
PATCH  /api/post-campaigns/[id]               — update campaign config
DELETE /api/post-campaigns/[id]               — delete campaign + leads
POST   /api/post-campaigns/[id]/activate      — set status = active
POST   /api/post-campaigns/[id]/pause         — set status = paused
POST   /api/post-campaigns/[id]/test-dm       — send test DM to yourself
GET    /api/post-campaigns/[id]/leads         — list leads with status filter
```

### New Routes

```
POST   /api/post-campaigns/auto-setup         — AI reads post text, returns draft campaign config
POST   /api/content-pipeline/posts/[id]/upload-image  — upload image for a post
GET    /api/account-safety-settings            — list all account safety settings
PATCH  /api/account-safety-settings/[accountId] — update limits, operating hours, locations
```

### Auto-Setup Route

```
POST /api/post-campaigns/auto-setup
Body: { post_id: string }  // or { post_text: string, team_profile_id?: string }

Response: {
  keyword: string,
  funnel_page_id: string | null,
  funnel_name: string | null,
  delivery_account_id: string,
  delivery_account_name: string,
  poster_account_id: string,
  reply_template: string,
  dm_template: string,
  confidence: 'high' | 'medium' | 'low',
  needs_user_input: string[]  // e.g., ['funnel_page_id'] if no match found
}
```

---

## MCP Tools

### Post Campaign Tools

```
magnetlab_create_post          — create post with image + lead magnet toggle
magnetlab_list_post_campaigns  — list campaigns with status filter
magnetlab_create_post_campaign — create new campaign (or auto-setup from post)
magnetlab_get_post_campaign    — get campaign details + lead breakdown by status
magnetlab_update_post_campaign — update config (keyword, templates, etc.)
magnetlab_activate_post_campaign — activate campaign
magnetlab_pause_post_campaign  — pause campaign
magnetlab_delete_post_campaign — delete campaign + leads
```

### Safety Settings Tools

```
magnetlab_get_account_safety_settings    — get limits, operating hours, locations for an account
magnetlab_update_account_safety_settings — update limits, hours, locations, target_locations
```

### Enhanced Existing Tool

`magnetlab_create_post` — updated to accept:
```
{
  text: string,
  image_url?: string,        // URL to fetch and upload
  team_profile_id?: string,
  is_lead_magnet_post?: boolean,  // triggers auto-setup
  auto_activate?: boolean         // skip review, activate immediately (high confidence only)
}
```

---

## UI

### Post Creation Form — Updated

Add to existing post creation/edit form:
- **Image upload** — file input with preview, stores to Supabase Storage
- **"Lead Magnet Post" toggle** — when enabled, triggers auto-setup on publish
- **Auto-setup summary card** — shows extracted config (keyword, funnel, delivery account, templates)
- **Edit fields** — user can override any auto-setup value
- **Activate button** — starts the campaign

### Campaign Dashboard — `/(dashboard)/post-campaigns`

**List view:**
- Table: name, post URL (truncated), status badge, detected/connected/DM'd counters
- Actions: activate, pause, delete
- Filter by status

**Detail view:**
- Stats funnel: detected → liked → replied → connected → DM'd
- Lead table: name, LinkedIn URL, status, match type, timestamps, error
- Campaign config summary (keyword, funnel, accounts)
- Edit button → form

### Settings → Account Safety — `/(dashboard)/settings/safety`

Per-account cards showing:
- Operating hours (time pickers + timezone dropdown)
- Daily limits (number inputs for each action type)
- Target locations (tag input)
- Warm-up status (days since connected, current multiplier)
- Circuit breaker status (active/inactive, reset time)

---

## Unipile Client Updates

### Updated Methods

```typescript
// createPost — add image support (multipart/form-data)
async createPost(
  accountId: string,
  text: string,
  imageFile?: { buffer: Buffer; filename: string; mimeType: string }
): Promise<{ postId: string }>

// addComment — already exists, needs update for threading + mentions
// account_id param lets us comment from ANY account on ANY public post
// NEW params: comment_id (for threading), mentions (for @-mentioning commenter)
async addComment(
  postSocialId: string,
  accountId: string,
  text: string,
  options?: { commentId?: string; mentions?: Array<{ name: string; profile_id: string }> }
): Promise<{ id: string }>

// addReaction — already exists, no changes needed
// NOTE: Targets posts only, NOT individual comments. Call once per post, not per lead.
```

### Content-Type Requirements

| Method | Content-Type | Notes |
|--------|-------------|-------|
| `createPost` (with image) | `multipart/form-data` | New — requires `postMultipart()` on BaseApiClient |
| `createPost` (text only) | `application/json` | Existing works |
| `sendDirectMessage` | `multipart/form-data` | **Unipile requires multipart for POST /chats** — must verify current JSON implementation works or add multipart support |
| `addComment` | `application/json` | Existing works |
| `addReaction` | `application/json` | Existing works |
| `sendConnectionRequest` | `application/json` | Existing works |

**BaseApiClient update needed:** Add `postMultipart(path, formData)` method for endpoints that require `multipart/form-data`. Used by `createPost` (image upload) and potentially `sendDirectMessage`.

### Verify Existing Methods Work

These already exist in the client but need verification against live API:
- `listReceivedInvitations(accountId)` — confirm response shape
- `handleInvitation(invitationId, action)` — confirm accept works
- `sendConnectionRequest(accountId, providerId, message?)` — currently dead code, needs testing
- `resolveLinkedInProfile(accountId, username)` — confirm provider_id in response
- `sendDirectMessage(accountId, providerId, text)` — **CRITICAL: confirm JSON content-type works, or switch to multipart/form-data** (Unipile docs specify multipart for POST /chats)

### Unipile API Reference

Full API reference documented at `docs/unipile-api-reference.md` (verified 2026-03-18).

---

## File Structure

### New Files

```
src/lib/ai/post-campaign/
  auto-setup.ts                    — AI post analyzer (keyword, lead magnet, delivery account extraction)
  intent-classifier.ts             — Tier 2 comment intent classification

src/app/api/post-campaigns/
  auto-setup/route.ts              — AI auto-setup endpoint

src/app/api/account-safety-settings/
  route.ts                         — GET (list all)
  [accountId]/route.ts             — PATCH (update)

src/app/api/content-pipeline/posts/
  [id]/upload-image/route.ts       — Image upload endpoint

src/app/(dashboard)/post-campaigns/
  page.tsx                         — Campaign list
  [id]/page.tsx                    — Campaign detail

src/app/(dashboard)/settings/safety/
  page.tsx                         — Account safety settings

src/server/services/
  account-safety.service.ts        — Safety settings CRUD + limit checks

src/server/repositories/
  account-safety.repo.ts           — DB access for safety settings

src/components/post-campaigns/
  CampaignList.tsx                 — List view
  CampaignDetail.tsx               — Detail view with lead table
  AutoSetupCard.tsx                — AI-generated config summary card
  CampaignForm.tsx                 — Edit form

src/components/settings/
  AccountSafetySettings.tsx        — Per-account safety config

src/frontend/api/
  post-campaigns.ts                — Client API module
  account-safety.ts                — Client API module

src/frontend/hooks/api/
  usePostCampaigns.ts              — SWR hooks
  useAccountSafety.ts              — SWR hooks
```

### Modified Files

```
src/lib/integrations/unipile.ts              — Add image upload to createPost()
src/lib/integrations/linkedin-publisher.ts   — Pass image through to Unipile
src/trigger/process-post-campaigns.ts        — Add like, reply, connect, intent matching, operating hours
src/trigger/poll-connection-requests.ts      — Add operating hours, circuit breaker, skip runs
src/server/services/post-campaigns.service.ts — Add auto-setup, safety checks
src/server/repositories/post-campaigns.repo.ts — Add new columns to update whitelist:
  liked_at, replied_at, connection_requested_at, expired_at, match_type, location
packages/mcp/src/tools/                      — Add campaign + safety tools
packages/mcp/src/handlers/                   — Add campaign + safety handlers
packages/mcp/src/client.ts                   — Add client methods
```

---

## Migration Plan

### Phase 1: Safety Infrastructure
- `account_safety_settings` table + migration
- `linkedin_daily_limits` column additions
- Safety service + repo
- API routes for safety settings
- Settings UI page

### Phase 2: Image Publishing
- Unipile client `createPost()` update for multipart/form-data
- Supabase Storage bucket for post images
- Image upload API route
- Post creation form image upload
- MCP tool update

### Phase 3: AI Auto-Setup
- `auto-setup.ts` AI module
- `intent-classifier.ts` for Tier 2 matching
- Auto-setup API route
- `post_campaigns` column additions (reply_template, poster_account_id, etc.)
- AutoSetupCard UI component

### Phase 4: Action Chain (Like + Reply + Connect)
- Update `process-post-campaigns` task: add like, reply, connect phases
- Update `poll-connection-requests` task: operating hours, circuit breaker, skip runs
- Add `expire-campaign-leads` task
- `post_campaign_leads` column additions (liked_at, replied_at, etc.)
- Location-based ICP filtering in connect phase

### Phase 5: UI + MCP
- Campaign dashboard page (list + detail)
- Campaign form components
- MCP tools for campaigns + safety settings
- Frontend API modules + hooks

### Phase 6: Testing + Verification
- Unit tests for AI auto-setup
- Unit tests for intent classifier
- Unit tests for safety limit calculations
- Integration tests for Unipile client methods (against live API)
- API route tests for all new routes
- Manual end-to-end test with real LinkedIn post

---

## Dependencies

- **Unipile accounts connected** for all team members who will post or deliver
- **Signal Engine profile monitors** set up for posting accounts
- **Supabase Storage** bucket for post images
- **Anthropic API key** for AI auto-setup and intent classification (Claude Haiku)
- **Existing env vars** — `UNIPILE_DSN`, `UNIPILE_ACCESS_TOKEN` already configured

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| LinkedIn restricts account | Conservative limits (10 conn/day), operating hours, warm-up ramp, circuit breaker |
| Unipile API changes | Reference doc at `docs/unipile-api-reference.md`, pin SDK version |
| AI picks wrong lead magnet | Review card before activation, confidence score, `needs_user_input` flag |
| Thousands of comments overwhelm system | MAX_ACTIONS_PER_RUN caps processing, natural multi-day spread looks human |
| Cross-account reply fails | Graceful degradation: skip reply, still accept + DM. Log error for investigation |
| Image upload fails on publish | Separate image upload from post publish. If image fails, publish text-only + alert user |
