# Post Campaign Automation — Design Spec

**Date:** 2026-03-16
**Status:** Reviewed (spec review passed, pending user approval)
**Repo:** magnetlab

## Problem

When a LinkedIn post includes a CTA like "comment GTM below and connect with Vlad", there's a manual gap between the comment and delivery. Someone must:
1. Monitor comments for the keyword
2. Accept incoming connection requests
3. DM each person the opt-in funnel link

This doesn't scale past ~20-30 people and creates hours of delay when a post performs well.

## Solution

A "Post Campaign" feature that automates the comment → connection → DM → funnel pipeline using:
- **Signals engine** (existing) for commenter detection via Harvest API
- **Unipile** (existing integration, new capabilities) for connection acceptance + DM sending
- **New `post_campaigns` entity** to configure and track campaigns
- **New Trigger.dev tasks** for polling and processing

## Non-Goals

- Replacing HeyReach for cold outbound (HeyReach stays for cold campaigns)
- Building a full LinkedIn automation suite (this is specifically for post-driven opt-in campaigns)
- Real-time detection (polling intervals are acceptable for organic LinkedIn)

## Relationship to Existing `linkedin_automations`

The existing `linkedin_automations` system triggers on Unipile webhook events (only fires for posts published through Unipile). Post campaigns trigger via Harvest API polling (works for any LinkedIn post). They have different detection paths and don't conflict.

**Dedup rule:** If a commenter is already tracked in `post_campaign_leads`, the signals engine should skip HeyReach push for that lead. Implemented as a check in `signal-push-heyreach` task: query `post_campaign_leads` by `linkedin_url` before pushing.

**Long-term:** Post campaigns may subsume `linkedin_automations` once Unipile DMs are proven reliable. For now, both coexist — automations handle Unipile-published posts, post campaigns handle all others.

---

## Architecture

### Approach

Extend the existing signals engine + Unipile integration (Approach A from brainstorming). Signals already polls LinkedIn for post commenters. We add: connection acceptance, DM sending, and a campaign config to link them.

### Data Flow

```
LinkedIn post with CTA ("comment GTM, connect with Vlad")
  │
  ▼
signal_profile_monitors detects commenters (every 10 min, Harvest API)
  │
  ▼
signal_leads table populated with commenter LinkedIn URLs + comment text
  │
  ▼
process-post-campaigns task (every 5 min):
  ├─ Matches signal_leads against active campaigns (post URL + keyword)
  ├─ Creates post_campaign_leads records (status: detected)
  ├─ Auto-likes matching comments (optional, via Unipile)
  │
  ▼
poll-connection-requests task (every 15 min ± random jitter):
  ├─ Lists pending invitations for campaign sender's Unipile account
  ├─ Cross-references with post_campaign_leads
  ├─ Accepts matching invitations
  ├─ Updates status: detected → connection_accepted
  │
  ▼
process-post-campaigns task (next run):
  ├─ Finds connection_accepted leads
  ├─ Sends DM via Unipile with template + funnel URL
  ├─ Updates status: connection_accepted → dm_sent
  │
  ▼
Person clicks funnel link → magnetlab opt-in → survey → delivery
```

### Timing

| Step | Delay | Cumulative |
|------|-------|------------|
| Signal detects comment | 0–10 min | 10 min |
| Campaign matches lead | 0–5 min | 15 min |
| Connection polled + accepted | 0–15 min | 30 min |
| DM sent on next campaign run | 0–5 min | 35 min |

**Worst case: ~35 min.** Average: ~15–20 min. Acceptable for organic LinkedIn where people expect a personal response within an hour.

---

## Database Schema

### `post_campaigns`

```sql
CREATE TABLE post_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  name text NOT NULL,

  -- Detection config
  post_url text NOT NULL,                -- normalized to activity URN format
  keywords text[] NOT NULL DEFAULT '{}',
  CHECK (array_length(keywords, 1) > 0),  -- must have at least one keyword

  -- Sender config
  unipile_account_id text NOT NULL,
  sender_name text,                      -- for DM personalization context

  -- DM config
  dm_template text NOT NULL,             -- supports {{name}}, {{funnel_url}}
  connect_message_template text,         -- optional note for outbound connection requests
  funnel_page_id uuid REFERENCES funnel_pages(id) ON DELETE RESTRICT,  -- block delete if campaign references funnel

  -- Behavior flags
  auto_accept_connections boolean NOT NULL DEFAULT true,
  auto_like_comments boolean NOT NULL DEFAULT false,
  auto_connect_non_requesters boolean NOT NULL DEFAULT false,

  -- Status
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed')),

  -- Counters (denormalized for fast reads)
  leads_detected integer NOT NULL DEFAULT 0,
  connections_accepted integer NOT NULL DEFAULT 0,
  dms_sent integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_campaigns_user_status ON post_campaigns(user_id, status);
```

### `post_campaign_leads`

```sql
CREATE TABLE post_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- flat RLS, no subquery
  campaign_id uuid NOT NULL REFERENCES post_campaigns(id) ON DELETE CASCADE,
  signal_lead_id uuid REFERENCES signal_leads(id) ON DELETE SET NULL,

  linkedin_url text NOT NULL,
  linkedin_username text,          -- extracted from URL, used for Unipile profile lookup
  unipile_provider_id text,        -- resolved Unipile internal ID for DM sending
  name text,
  comment_text text,

  -- Workflow state machine
  -- detected → connection_pending → connection_accepted → dm_queued → dm_sent
  --                                                                  → dm_failed
  status text NOT NULL DEFAULT 'detected'
    CHECK (status IN ('detected', 'connection_pending', 'connection_accepted',
                      'dm_queued', 'dm_sent', 'dm_failed', 'skipped')),

  detected_at timestamptz NOT NULL DEFAULT now(),
  connection_accepted_at timestamptz,
  dm_sent_at timestamptz,
  error text,

  UNIQUE(campaign_id, linkedin_url)
);

CREATE INDEX idx_pcl_campaign_status ON post_campaign_leads(campaign_id, status);
```

### RLS

Both tables use `user_id` isolation matching the signals engine pattern:

```sql
ALTER TABLE post_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaigns"
  ON post_campaigns FOR ALL USING (user_id = auth.uid());

ALTER TABLE post_campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaign leads"
  ON post_campaign_leads FOR ALL USING (user_id = auth.uid());
```

---

## Unipile Client Extensions

Add to `src/lib/integrations/unipile.ts`:

```typescript
// ─── Connection Management ───────────────────────────────────────────────

interface Invitation {
  id: string;
  sender: { linkedin_url: string; name: string; headline?: string };
  message?: string;
  created_at: string;
}

async listReceivedInvitations(accountId: string): Promise<Invitation[]> {
  // GET /api/v1/users/invite/received
  // Paginate with cursor if needed
  // Rate: max 3 calls/hour per account
}

async handleInvitation(
  accountId: string,
  invitationId: string,
  action: 'accept' | 'decline'
): Promise<void> {
  // POST /api/v1/users/invite/received/{invitation_id}
  // Body: { action: 'accept' | 'decline' }
}

// ─── Profile Resolution ──────────────────────────────────────────────────

async resolveLinkedInProfile(
  accountId: string,
  linkedinUsername: string
): Promise<{ providerId: string; name: string }> {
  // GET /api/v1/users/{linkedinUsername}?account_id={accountId}
  // Returns provider_id (internal Unipile ID needed for messaging)
  // Extract username from URL first: linkedin.com/in/vladtiminski → vladtiminski
}

// ─── Messaging ───────────────────────────────────────────────────────────

async sendDirectMessage(
  accountId: string,
  recipientProviderId: string,  // from resolveLinkedInProfile()
  text: string
): Promise<{ chatId: string }> {
  // POST /api/v1/chats
  // Body: { account_id: accountId, attendees_ids: [recipientProviderId], text }
  // Note: requires existing connection. For non-connections, use InMail (Premium only).
}

// Two-step DM flow:
// 1. resolveLinkedInProfile(accountId, username) → providerId
// 2. sendDirectMessage(accountId, providerId, text) → chatId
// Cache providerId on post_campaign_leads.unipile_provider_id to avoid repeated lookups.
```

### Safety Constraints (built into client)

```typescript
const LINKEDIN_SAFETY = {
  // Daily limits (conservative)
  MAX_DMS_PER_DAY: 80,
  MAX_ACCEPTS_PER_DAY: 100,
  MAX_CONNECT_REQUESTS_PER_DAY: 20,

  // Delays between actions (randomized, never fixed)
  MIN_DELAY_BETWEEN_DMS_MS: 60_000,      // 60s min
  MAX_DELAY_BETWEEN_DMS_MS: 180_000,     // 180s max
  MIN_DELAY_BETWEEN_ACCEPTS_MS: 45_000,  // 45s min
  MAX_DELAY_BETWEEN_ACCEPTS_MS: 120_000, // 120s max

  // Per task run limits (avoid long-running tasks)
  MAX_ACTIONS_PER_RUN: 3,        // max 3 actions per task execution
  POLL_JITTER_MINUTES: 5,        // ±5 min randomization on polling
} as const;
```

Daily counters tracked in a `linkedin_daily_limits` table or in-memory per task run:

```sql
CREATE TABLE linkedin_daily_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  unipile_account_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  dms_sent integer NOT NULL DEFAULT 0,
  connections_accepted integer NOT NULL DEFAULT 0,
  UNIQUE(unipile_account_id, date)
);
```

---

## Trigger.dev Tasks

### Concurrency Control

All tasks that perform LinkedIn actions use Trigger.dev's `concurrencyLimit` with a key per Unipile account. This ensures only one task at a time performs actions on a given LinkedIn account, even if multiple task types are scheduled simultaneously.

```typescript
concurrencyLimit: { id: `linkedin-actions-${accountId}`, limit: 1 }
```

### 1. `process-post-campaigns`

**Schedule:** Every 5 minutes
**Duration limit:** 5 minutes (sequential actions with delays)
**Concurrency:** Keyed per unipile_account_id (max 1 concurrent)

```
For each active post_campaign:
  -- DETECTION (DB only, no LinkedIn API calls)
  1. Query new matching commenters via join:
     SELECT sl.linkedin_url, sl.name, se.comment_text
     FROM signal_leads sl
     JOIN signal_events se ON se.lead_id = sl.id
     WHERE se.source_url = normalizePostUrl(campaign.post_url)
       AND se.engagement_type = 'comment'
       AND EXISTS (
         SELECT 1 FROM unnest(campaign.keywords) kw
         WHERE se.comment_text ILIKE '%' || kw || '%'
       )
       AND sl.linkedin_url NOT IN (
         SELECT linkedin_url FROM post_campaign_leads WHERE campaign_id = campaign.id
       )
  2. For each match:
     - Extract linkedin_username from linkedin_url
     - Insert post_campaign_leads (status: 'detected', linkedin_username extracted)
  3. Update campaign.leads_detected via COUNT (reconcile, don't increment)

  -- DM SENDING (LinkedIn API calls — sequential, randomized)
  4. Query post_campaign_leads WHERE status = 'connection_accepted' AND dm_sent_at IS NULL
  5. Check daily DM limit
  6. For each (up to MAX_ACTIONS_PER_RUN), one at a time:
     a. Resolve linkedin_username → unipile_provider_id (if not cached)
     b. Render DM template (replace {{name}}, {{funnel_url}})
     c. Send DM via Unipile using provider_id
     d. Update status → 'dm_sent', set dm_sent_at, cache provider_id
     e. On failure: status → 'dm_failed', set error
     f. sleep(randomBetween(60s, 180s))
  7. Reconcile campaign.dms_sent from COUNT
```

**Post URL normalization:** LinkedIn posts have multiple URL formats (`/feed/update/urn:li:activity:123`, `/posts/username-123`, with/without `www`). Both `post_campaigns.post_url` and `signal_events.source_url` should be normalized to canonical activity URN at storage time. Add `normalizePostUrl()` utility alongside existing `normalizeLinkedInUrl()`.

**Counter reconciliation:** Instead of incrementing counters (which drift on failures), always derive from `SELECT COUNT(*) FROM post_campaign_leads WHERE campaign_id = ? AND status = ?`.

### 2. `poll-connection-requests`

**Schedule:** Every 20 minutes (3/hour, with ±5 min jitter built into task)
**Duration limit:** 3 minutes
**Concurrency:** Keyed per unipile_account_id (max 1 concurrent)

```
For each user with active post_campaigns:
  1. Get unique unipile_account_ids across active campaigns
  2. For each account:
     a. Check daily accept limit
     b. List received invitations via Unipile
     c. For each invitation:
        - Look up sender linkedin_url in post_campaign_leads (status: 'detected')
        - If found AND campaign.auto_accept_connections:
          - Accept invitation via Unipile
          - Update lead status → 'connection_accepted'
          - Increment campaign.connections_accepted + daily counter
          - Random delay between accepts
        - If NOT in any campaign: skip (don't auto-accept strangers)
```

### 3. `auto-connect-commenters` (optional, for non-requesters)

**Schedule:** Every 30 minutes
**Purpose:** For commenters who don't send a connection request, send one from Vlad's side.

```
For each active campaign with auto_connect_non_requesters = true:
  1. Query post_campaign_leads WHERE status = 'detected'
     AND detected_at < NOW() - INTERVAL '30 minutes'  -- give them time to request first
  2. Send connection request from campaign's Unipile account
  3. Update status → 'connection_pending'
```

This is optional (flag defaults to false). Can be enabled per campaign.

---

## API Routes

```
GET    /api/post-campaigns                    — list user's campaigns
POST   /api/post-campaigns                    — create campaign
GET    /api/post-campaigns/[id]               — get campaign + lead stats
PATCH  /api/post-campaigns/[id]               — update campaign config
DELETE /api/post-campaigns/[id]               — delete campaign + leads
POST   /api/post-campaigns/[id]/activate      — set status = 'active'
POST   /api/post-campaigns/[id]/pause         — set status = 'paused'
POST   /api/post-campaigns/[id]/test-dm       — send rendered template DM to yourself
GET    /api/post-campaigns/[id]/leads         — list campaign leads with status filter
```

### Route Structure

```
src/app/api/post-campaigns/
  route.ts                    — GET (list), POST (create)
  [id]/
    route.ts                  — GET, PATCH, DELETE
    activate/route.ts         — POST
    pause/route.ts            — POST
    leads/route.ts            — GET
```

### Service Layer

```
src/server/services/post-campaigns.service.ts
src/server/repositories/post-campaigns.repo.ts
```

---

## MCP Tools

New category or extension of lead magnets:

```
magnetlab_list_post_campaigns     — list campaigns with status filter
magnetlab_create_post_campaign    — create new campaign
magnetlab_get_post_campaign       — get campaign details + lead breakdown
magnetlab_update_post_campaign    — update config
magnetlab_activate_post_campaign  — activate
magnetlab_pause_post_campaign     — pause
```

---

## UI (Settings → Signals or dedicated page)

Minimal UI needed for v1:

### Campaign List (/(dashboard)/post-campaigns)
- Table: name, post URL, status, leads/connections/DMs counters
- Actions: activate, pause, delete

### Campaign Create/Edit
- Post URL input
- Keywords (tag input)
- Sender account (dropdown of connected Unipile accounts)
- DM template (textarea with {{name}}, {{funnel_url}} placeholders)
- Funnel page selector (dropdown)
- Behavior toggles: auto-accept, auto-like, auto-connect

### Campaign Detail
- Stats: detected → accepted → DM'd funnel
- Lead table: name, LinkedIn URL, status, timestamps
- Error log for failed DMs

---

## Account Safety

### Rate Limits (enforced in code)

| Action | Daily Limit | Delay After | Batch Size |
|--------|------------|-------------|------------|
| Accept connection | 100/day | 45–120s random | 1 |
| Send DM | 80/day | 60–180s random | 1 |
| Send connection request | 20/day | 90–240s random | 1 |
| Poll invitations | 3/hour | 15 min ± 5 min | — |

### Core Safety Rule: One Action at a Time, Always Randomized

**NEVER perform multiple LinkedIn actions in parallel.** Every action (accept, DM, connect) is sequential with a randomized delay before the next. No batching, no Promise.all, no concurrent requests. One action → random wait → one action → random wait.

```typescript
// CORRECT: sequential with random delay
for (const lead of leadsToProcess) {
  await performAction(lead);
  await sleep(randomBetween(MIN_DELAY, MAX_DELAY));
}

// WRONG: parallel execution
await Promise.all(leads.map(lead => performAction(lead)));
```

Delays are always randomized using a uniform distribution between min and max. Never fixed intervals. The randomization range should be wide enough to be indistinguishable from human behavior.

### Safeguards

1. **One at a time** — every LinkedIn action is sequential, never batched or parallelized
2. **Always randomized** — every delay between actions uses `randomBetween(min, max)`, never a fixed value
3. **Daily limit table** — hard stop when limit reached, reset at midnight UTC
4. **No burst after pause** — when campaign activated, don't process backlog all at once. Process max 3 per task run, normal cadence.
5. **Connection-first, DM-second** — never attempt DM without confirmed connection
6. **Campaign-scoped only** — only accept connections from people who commented on the monitored post. Never auto-accept random invitations.
7. **Mixed action types** — if accepting AND DMing in the same task run, interleave with extra delays. Don't do all accepts then all DMs.

### Monitoring

- Daily limit table shows usage per account per day
- Campaign counters show conversion funnel
- dm_failed status + error field for debugging
- Trigger.dev dashboard shows task runs and failures

---

## Migration Plan

### Phase 1: Unipile Client (no new tables)
- Add `listReceivedInvitations`, `handleInvitation`, `sendDirectMessage` to Unipile client
- Unit tests for each method
- Manual testing via API route or script

### Phase 2: Database + Service Layer
- Migration: `post_campaigns`, `post_campaign_leads`, `linkedin_daily_limits`
- Repo + service: CRUD, status transitions, daily limit checks
- API routes

### Phase 3: Trigger.dev Tasks
- `process-post-campaigns` task
- `poll-connection-requests` task
- `auto-connect-commenters` task (optional)

### Phase 4: MCP Tools
- Add 6 tools to MCP package
- Discovery category registration

### Phase 5: UI
- Campaign list page
- Create/edit form
- Campaign detail with leads table

---

## Dependencies

- **Unipile account connected for Vlad** — required before any campaign can run
- **Signals profile monitor for Tim** — required for commenter detection
- **Existing Unipile env vars** — `UNIPILE_DSN`, `UNIPILE_ACCESS_TOKEN` already set

## Open Questions

1. **Should we support multiple DM templates per campaign?** (A/B test DMs) — probably not for v1.
2. **Should completed campaigns auto-pause after N days?** — nice to have, not blocking.
