# Outreach Sequence Engine — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Repo:** magnetlab
**Spec 1 of 2** — Spec 2 (Lead Sourcing Pipeline) deferred.

## Problem

DFY clients need LinkedIn outreach campaigns: connect with prospects, send personalized messages, follow up if no reply. Currently this requires HeyReach — a tool that can't create campaigns programmatically. Every DFY client requires manual campaign setup in a browser UI. No LinkedIn automation tool is built for CLI/agent workflows.

We want to: create a campaign, add a list of LinkedIn URLs, activate it, and have the system execute a multi-step outreach sequence on each lead — all controllable from Claude Code via MCP.

## Solution

Build a proactive LinkedIn outreach sequence engine into magnetlab with three layers:

1. **LinkedIn Action Queue** — shared foundation. Every LinkedIn action from any system (post campaigns, outreach sequences) flows through a single queue with a single executor. Guarantees one action at a time per account with human-like delays.
2. **Outreach Sequence Engine** — campaign management, preset-based step sequences, lead state machine, and an advancer task that evaluates leads and enqueues next actions.
3. **Unified Activity Log** — every LinkedIn action recorded in one stream regardless of source.

The existing post campaign system gets refactored to enqueue actions through the shared queue instead of calling Unipile directly.

## Non-Goals

- Custom step builder UI (v1 uses presets only; data model supports custom steps for v2)
- Lead sourcing / LinkedIn search (Spec 2)
- Follow action (not available via Unipile API)
- Like recent post action (removed for v1 simplicity)
- Auto-retry failed leads (agent can investigate via MCP and decide)
- Cross-campaign lead dedup (user's choice — same person can be in multiple campaigns)
- Browser-based automation (Unipile API only for v1; architecture allows swapping transport later)

## Relationship to Existing Systems

**Post Campaigns (existing):** Reactive system — detects comments, delivers lead magnets. Refactored to enqueue actions through the shared LinkedIn Action Queue instead of calling Unipile inline. Detection logic (Phase 1) unchanged.

**Outreach Sequences (this spec):** Proactive system — takes a list of leads, runs multi-step sequences. Built on the same queue from day one.

**Safety System (existing):** Shared. Both systems consume from the same `account_safety_settings`, `linkedin_daily_limits`. The action queue executor enforces all safety checks. Neither system touches safety directly.

**Signal Engine (existing):** Unchanged. Outreach sequences don't interact with Signal Engine in v1. Spec 2 (Lead Sourcing) will.

---

## Architecture

### Layer 1: LinkedIn Action Queue

A dumb action buffer. The queue knows nothing about campaigns — it just executes LinkedIn actions and logs results. Campaign-specific advancers enqueue actions and read results.

#### Data Model

```sql
CREATE TABLE linkedin_action_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  unipile_account_id text NOT NULL,

  -- What to do
  action_type text NOT NULL CHECK (action_type IN (
    'view_profile', 'connect', 'message', 'follow_up_message',
    'withdraw', 'accept_invitation', 'react', 'comment'
  )),
  target_provider_id text,
  target_linkedin_url text,
  payload jsonb NOT NULL DEFAULT '{}',

  -- Priority (lower = higher priority)
  priority integer NOT NULL DEFAULT 10,

  -- Source tracking
  source_type text NOT NULL CHECK (source_type IN ('post_campaign', 'outreach_campaign')),
  source_campaign_id uuid NOT NULL,
  source_lead_id uuid NOT NULL,

  -- Execution state
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'executing', 'completed', 'failed', 'cancelled'
  )),
  processed boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  result jsonb DEFAULT '{}',
  executed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_queue_drain
  ON linkedin_action_queue (unipile_account_id, status, priority, created_at)
  WHERE status = 'queued';

CREATE INDEX idx_action_queue_results
  ON linkedin_action_queue (source_lead_id, status, processed)
  WHERE status IN ('completed', 'failed') AND processed = false;
```

**Priority values:**
- `1` — post campaign actions (lead magnet delivery is time-sensitive)
- `10` — outreach sequence actions (delays measured in days)

**Status lifecycle:**
```
queued → executing → completed → (processed by advancer) → cleaned up after 7 days
                   → failed → (processed by advancer) → cleaned up after 7 days
       → cancelled (campaign paused/deleted)
```

#### Executor Task: `execute-linkedin-actions`

Single Trigger.dev task. Drains the queue per account.

**Schedule:** Every 5 minutes
**Max duration:** 300 seconds
**Concurrency:** `maxConcurrentRuns: 1`

```
10% chance skip for naturalness (shouldSkipRun())

Get distinct account_ids with queued actions

For each account:
  settings = getAccountSettings(userId, accountId)
  if !isWithinOperatingHours(settings) → skip
  if isCircuitBreakerActive(settings) → skip

  actionsThisRun = 0

  While actionsThisRun < MAX_ACTIONS_PER_RUN (3):
    action = SELECT FROM linkedin_action_queue
      WHERE unipile_account_id = account
      AND status = 'queued'
      ORDER BY priority ASC, created_at ASC
      LIMIT 1

    if !action → break

    if !checkDailyLimit(account, action.action_type, settings) → break

    UPDATE status = 'executing'

    try:
      result = executeAction(client, action)
      UPDATE status = 'completed', executed_at = now(), result = result
      INSERT INTO linkedin_activity_log (...)
      incrementDailyLimit(account, action.action_type)
      actionsThisRun++
    catch (err):
      if isRateLimitError(err):
        activateCircuitBreaker(account, err.message)
        UPDATE status = 'failed', error = err.message
        break  // stop ALL actions for this account
      else:
        UPDATE status = 'failed', error = err.message
        actionsThisRun++

    await sleep(randomDelay(settings))  // 45-210s
```

**`executeAction` dispatch:**

| action_type | Unipile method |
|-------------|---------------|
| `view_profile` | `resolveLinkedInProfile(accountId, username)` |
| `connect` | `sendConnectionRequest(accountId, providerId, message?)` |
| `message` | `sendDirectMessage(accountId, providerId, text)` |
| `follow_up_message` | `sendDirectMessage(accountId, providerId, text)` |
| `withdraw` | `cancelInvitation(invitationId)` |
| `accept_invitation` | `handleInvitation(invitationId, 'accept')` |
| `react` | `addReaction(postId, accountId, reactionType)` |
| `comment` | `addComment(postId, accountId, text, options)` |

#### Unified Activity Log

```sql
CREATE TABLE linkedin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unipile_account_id text NOT NULL,
  action_type text NOT NULL,
  target_provider_id text,
  target_linkedin_url text,
  source_type text NOT NULL,
  source_campaign_id uuid NOT NULL,
  source_lead_id uuid NOT NULL,
  payload jsonb DEFAULT '{}',
  result jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_account
  ON linkedin_activity_log (unipile_account_id, created_at DESC);
```

#### Queue Cleanup

Rows with `status IN ('completed', 'failed', 'cancelled') AND processed = true` are deleted after 7 days. Runs as a lightweight query in the executor task at the start of each run:

```sql
DELETE FROM linkedin_action_queue
WHERE status IN ('completed', 'failed', 'cancelled')
  AND processed = true
  AND created_at < now() - interval '7 days';
```

The `linkedin_activity_log` is the permanent record.

---

### Layer 2: Outreach Sequence Engine

#### Campaigns

```sql
CREATE TABLE outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid,

  name text NOT NULL,
  preset text NOT NULL CHECK (preset IN ('warm_connect', 'direct_connect', 'nurture')),
  unipile_account_id text NOT NULL,

  -- Templates (support {{name}} and {{company}} variables)
  connect_message text,
  first_message_template text NOT NULL,
  follow_up_template text,
  follow_up_delay_days integer NOT NULL DEFAULT 3,
  withdraw_delay_days integer NOT NULL DEFAULT 7,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### Steps (expanded from preset at creation time)

```sql
CREATE TABLE outreach_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,

  step_order integer NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'view_profile', 'connect', 'message', 'follow_up_message', 'withdraw'
  )),
  delay_days integer NOT NULL DEFAULT 0,
  delay_hours integer NOT NULL DEFAULT 0,

  trigger text NOT NULL DEFAULT 'previous_completed' CHECK (trigger IN (
    'previous_completed',
    'connection_accepted',
    'no_reply'
  )),

  config jsonb NOT NULL DEFAULT '{}',

  UNIQUE(campaign_id, step_order)
);
```

The steps table documents what actions exist in the sequence. For v1, the advancer uses preset-specific branching logic (not the trigger field) to determine what to do next. The trigger field exists for v2 when custom sequences use it.

#### Presets

All presets start with `view_profile` — this resolves the provider_id needed for all subsequent actions.

**warm_connect:**

| Order | Action | Delay | Notes |
|-------|--------|-------|-------|
| 1 | view_profile | 0 | Resolves provider_id, shows "viewed your profile" |
| 2 | connect | 1 day | With or without note |
| 3 | message | 0 (on accept) | First DM with {{name}}, {{company}} |
| 4 | follow_up_message | 3 days (on no reply) | Check chat first |

**direct_connect:**

| Order | Action | Delay | Notes |
|-------|--------|-------|-------|
| 1 | view_profile | 0 | Resolves provider_id |
| 2 | connect | 0 (immediate) | Right after view |
| 3 | message | 0 (on accept) | First DM |
| 4 | follow_up_message | 3 days (on no reply) | Check chat first |

**nurture:**

| Order | Action | Delay | Notes |
|-------|--------|-------|-------|
| 1 | view_profile | 0 | Resolves provider_id |
| 2 | connect | 3 days | Longer warm-up |
| 3 | message | 0 (on accept) | First DM |
| 4 | follow_up_message | 5 days (on no reply) | Longer patience |

Withdrawal is not a step — it's a timeout on the connect action. `withdraw_delay_days` on the campaign controls when a `connect_pending` lead gets auto-withdrawn.

#### Leads

```sql
CREATE TABLE outreach_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,

  linkedin_url text NOT NULL,
  linkedin_username text,
  unipile_provider_id text,
  name text,
  company text,

  -- Progress tracking
  current_step_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'completed', 'replied',
    'withdrawn', 'failed', 'skipped'
  )),

  -- Timestamps (drive advancer logic + progress stats)
  step_completed_at timestamptz,
  viewed_at timestamptz,
  connect_sent_at timestamptz,
  connected_at timestamptz,
  messaged_at timestamptz,
  follow_up_sent_at timestamptz,
  withdrawn_at timestamptz,

  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Lead status (7 values):**

| Status | Meaning |
|--------|---------|
| `pending` | Not started, waiting for advancer |
| `active` | In the sequence, at least one step completed |
| `completed` | All applicable steps finished |
| `replied` | Target replied to DM (goal achieved) |
| `withdrawn` | Connection timed out, invitation withdrawn |
| `failed` | Action error |
| `skipped` | Manually excluded |

Intermediate progress (viewed, connect sent, connected, messaged) is derived from timestamps, not status.

---

### Layer 3: Trigger.dev Tasks

#### Task Inventory

| Task | Schedule | Purpose |
|------|----------|---------|
| `execute-linkedin-actions` | */5 * * * * | Drain action queue, call Unipile |
| `advance-outreach-sequences` | */5 * * * * | Evaluate leads, enqueue next actions |
| `check-outreach-replies` | */30 * * * * | Check chats for replies to DMs |
| `process-post-campaigns` | */5 * * * * (refactored) | Detect commenters, enqueue actions, process results |
| `poll-connection-requests` | */20 * * * * (refactored) | Accept invitations, update leads in both systems |
| `expire-campaign-leads` | Every 6 hours (unchanged) | Expire stale post campaign leads |

#### advance-outreach-sequences

**Schedule:** Every 5 minutes
**Max duration:** 120 seconds
**Concurrency:** `maxConcurrentRuns: 1`

```
For each active outreach_campaign:

  // Step 1: Process completed queue actions
  completedActions = SELECT FROM linkedin_action_queue
    WHERE source_type = 'outreach_campaign'
    AND source_campaign_id = campaign.id
    AND status IN ('completed', 'failed')
    AND processed = false

  For each completed action:
    lead = get lead by action.source_lead_id
    if action.status == 'failed':
      mark lead 'failed', set error
    else:
      update lead timestamp based on action.action_type:
        view_profile  → set viewed_at, cache provider_id from result
        connect       → set connect_sent_at
        message       → set messaged_at
        follow_up     → set follow_up_sent_at, mark 'completed'
        withdraw      → set withdrawn_at, mark 'withdrawn'
      set step_completed_at = now()
      advance current_step_order
    mark queue row processed = true

  // Step 2: Check withdrawal timeouts
  For leads WHERE status = 'active'
    AND connect_sent_at IS NOT NULL
    AND connected_at IS NULL
    AND connect_sent_at + withdraw_delay_days elapsed:
      if no queued/executing action for this lead:
        enqueue 'withdraw' action
        // Lead marked 'withdrawn' when action completes

  // Step 3: Evaluate next steps for pending/active leads
  For leads WHERE status IN ('pending', 'active')
    AND no queued/executing action in queue for this lead:

    Determine next action based on preset + timestamps:
      pending, no viewed_at
        → enqueue 'view_profile', set status 'active'

      viewed_at set, delay elapsed (per preset), no connect_sent_at
        → enqueue 'connect'

      connected_at set, no messaged_at
        → enqueue 'message' with rendered first_message_template

      // follow_up handled by check-outreach-replies task

  // Step 4: Check campaign completion
  if count(leads WHERE status IN ('pending', 'active')) == 0:
    set campaign status = 'completed'
```

**Guard against double-enqueue:** Before enqueuing any action, the advancer checks `linkedin_action_queue WHERE source_lead_id = X AND status IN ('queued', 'executing')`. If a pending action exists, skip that lead.

#### check-outreach-replies

**Schedule:** Every 30 minutes (with jitter)
**Max duration:** 120 seconds
**Concurrency:** `maxConcurrentRuns: 1`

```
For each unique account across active outreach campaigns:

  // Batch: fetch recent chats once per account
  recentChats = client.listChats(accountId)

  // Find leads that have been messaged but not resolved
  leads = SELECT FROM outreach_campaign_leads
    WHERE status = 'active'
    AND messaged_at IS NOT NULL
    AND follow_up_sent_at IS NULL

  For each lead:
    // Find chat with this target
    chat = recentChats.find(c => attendee matches lead.unipile_provider_id)

    if chat found:
      messages = client.getChatMessages(chat.id)
      if any message from target after lead.messaged_at:
        mark lead 'replied'
        continue

    // Check if follow-up is due
    if messaged_at + campaign.follow_up_delay_days elapsed:
      if campaign.follow_up_template:
        enqueue 'follow_up_message' with rendered follow_up_template
      else:
        mark lead 'completed'
```

**API call budget:** One `listChats` per account per run (batch), plus one `getChatMessages` per lead with a chat. At 30-min intervals with ~20-30 messaged leads, this is manageable.

#### poll-connection-requests (refactored)

Existing logic stays. Adds matching against outreach campaign leads:

```
For each accepted invitation:
  // Existing: check post_campaign_leads
  // New: also check outreach_campaign_leads
  match = SELECT FROM outreach_campaign_leads
    WHERE unipile_provider_id = sender.provider_id
    AND status = 'active'
    AND connect_sent_at IS NOT NULL
    AND connected_at IS NULL

  if match:
    UPDATE connected_at = now()
    // advance-outreach-sequences will enqueue 'message' on next run
```

#### process-post-campaigns (refactored)

**Phase 0 (new): Process completed queue actions**
```
Check linkedin_action_queue
  WHERE source_type = 'post_campaign'
  AND status IN ('completed', 'failed')
  AND processed = false

For each:
  Update post_campaign_leads timestamps/status
  Mark queue row processed = true
```

**Phase 1 (unchanged): Detection** — DB-only, no LinkedIn API calls.

**Phase 2 (refactored): React + Reply + Connect** — instead of calling Unipile directly, insert into `linkedin_action_queue` with `priority: 1` and `source_type: 'post_campaign'`.

**Phase 3 (refactored): DM sending** — same, enqueue with `priority: 1`.

The post campaign task becomes: process results → detect → enqueue. No more Unipile calls in the task.

---

## Safety Integration

All safety enforcement lives in the executor. No other task calls Unipile directly.

| Concern | Where enforced | How |
|---------|---------------|-----|
| Operating hours | Executor | Skip account if outside hours |
| Daily limits | Executor | Check before each action, increment after |
| Warm-up ramp | Executor | `getEffectiveLimit()` applies multiplier |
| Circuit breaker | Executor | Activate on rate limit, skip account |
| Randomized delays | Executor | 45-210s between every action |
| Skip runs | Executor | 10% chance of skipping entire run |
| Action serialization | Executor + Trigger.dev | `concurrencyLimit: 1`, one action at a time per account |
| Cross-system limits | Shared counters | Both systems consume from same `linkedin_daily_limits` |
| Priority | Queue ordering | Post campaigns (priority 1) drain before outreach (priority 10) |

**Latency trade-off:** The queue adds ~5 minutes of scheduling overhead per action compared to inline calls. For post campaigns (current worst case: 40 min), this extends to ~45 min — still natural. For outreach sequences (delays in days), irrelevant.

---

## Unipile Client Updates

New methods needed (all documented in `docs/unipile-api-reference.md`):

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `listChats(accountId)` | `GET /chats?account_id=X` | Reply detection batch |
| `getChatMessages(chatId)` | `GET /chats/{id}/messages` | Check for reply content |
| `listSentInvitations(accountId)` | `GET /users/invite/sent?account_id=X` | Find invitation ID for withdrawal |
| `cancelInvitation(invitationId)` | `DELETE /users/invite/{id}` | Withdraw connection request |

**Withdrawal flow:** When withdrawing, call `listSentInvitations` to find the pending invitation matching the target's `provider_id`, then call `cancelInvitation` with that invitation ID. More reliable than storing invitation IDs from the connect response.

---

## API Routes

```
POST   /api/outreach-campaigns                    — create campaign (preset expands into steps)
GET    /api/outreach-campaigns                    — list campaigns with status filter
GET    /api/outreach-campaigns/[id]               — campaign + stats + progress
PATCH  /api/outreach-campaigns/[id]               — update templates, delays
DELETE /api/outreach-campaigns/[id]               — delete + cancel queued actions
POST   /api/outreach-campaigns/[id]/activate      — activate (validates leads > 0, template set)
POST   /api/outreach-campaigns/[id]/pause         — pause + cancel queued actions
POST   /api/outreach-campaigns/[id]/leads         — bulk add leads (max 500 per request)
GET    /api/outreach-campaigns/[id]/leads         — list leads with status filter
GET    /api/outreach-campaigns/[id]/leads/[leadId] — individual lead detail
POST   /api/outreach-campaigns/[id]/leads/[leadId]/skip — skip lead + cancel queued actions
GET    /api/linkedin-activity                     — unified stream with filters + pagination
```

**Activation validation:** Cannot activate if:
- 0 leads added
- `first_message_template` is empty
- Account not connected in Unipile

**Pause/Delete side effects:** Cancel all `queued` actions in `linkedin_action_queue` for this campaign.

---

## MCP Tools

12 tools:

```
magnetlab_create_outreach_campaign     — { name, preset, account_id, first_message_template, ... }
magnetlab_list_outreach_campaigns      — { status? }
magnetlab_get_outreach_campaign        — { campaign_id } → config + stats + progress
magnetlab_update_outreach_campaign     — { campaign_id, first_message_template?, follow_up_template?, ... }
magnetlab_activate_outreach_campaign   — { campaign_id }
magnetlab_pause_outreach_campaign      — { campaign_id }
magnetlab_delete_outreach_campaign     — { campaign_id }
magnetlab_add_outreach_leads           — { campaign_id, leads: [{ linkedin_url, name?, company? }] }
magnetlab_list_outreach_leads          — { campaign_id, status? }
magnetlab_get_outreach_lead            — { lead_id } → timestamps, step, queued actions, errors
magnetlab_skip_outreach_lead           — { lead_id } → set skipped + cancel queued
magnetlab_get_linkedin_activity        — { account_id?, action_type?, since?, source_campaign_id?, limit?, offset? }
```

**Stats response shape (get_outreach_campaign):**

```json
{
  "campaign": { "id", "name", "preset", "status", "..." },
  "stats": {
    "total": 150,
    "pending": 80,
    "active": 35,
    "replied": 6,
    "completed": 8,
    "withdrawn": 15,
    "failed": 2,
    "skipped": 4
  },
  "progress": {
    "viewed": 70,
    "connect_sent": 55,
    "connected": 12,
    "messaged": 10,
    "follow_up_sent": 4
  }
}
```

`stats` = by lead status (for filtering). `progress` = derived from timestamps (for funnel visualization).

---

## File Structure

### New Files

```
src/lib/types/outreach-campaigns.ts              — types, column constants, presets
src/lib/types/linkedin-action-queue.ts            — queue types, action payloads

src/server/repositories/outreach-campaigns.repo.ts — DB access
src/server/repositories/linkedin-action-queue.repo.ts — queue operations
src/server/services/outreach-campaigns.service.ts — campaign CRUD + validation
src/server/services/linkedin-action-executor.ts   — executeAction dispatch

src/app/api/outreach-campaigns/route.ts           — GET (list), POST (create)
src/app/api/outreach-campaigns/[id]/route.ts      — GET, PATCH, DELETE
src/app/api/outreach-campaigns/[id]/activate/route.ts
src/app/api/outreach-campaigns/[id]/pause/route.ts
src/app/api/outreach-campaigns/[id]/leads/route.ts — GET (list), POST (bulk add)
src/app/api/outreach-campaigns/[id]/leads/[leadId]/route.ts — GET (detail)
src/app/api/outreach-campaigns/[id]/leads/[leadId]/skip/route.ts — POST
src/app/api/linkedin-activity/route.ts            — GET (unified stream)

src/trigger/execute-linkedin-actions.ts           — queue executor
src/trigger/advance-outreach-sequences.ts         — lead advancer
src/trigger/check-outreach-replies.ts             — reply detection

packages/mcp/src/tools/outreach-campaigns.ts      — tool definitions
packages/mcp/src/handlers/outreach-campaigns.ts   — handlers
packages/mcp/src/tools/linkedin-activity.ts       — activity stream tool
packages/mcp/src/handlers/linkedin-activity.ts    — handler
```

### Modified Files

```
src/lib/integrations/unipile.ts                   — add listChats, getChatMessages,
                                                    listSentInvitations, cancelInvitation
src/trigger/process-post-campaigns.ts             — refactor to enqueue actions + process results
src/trigger/poll-connection-requests.ts           — add outreach lead matching
src/server/services/account-safety.service.ts     — add action_type mapping for new types
packages/mcp/src/client.ts                        — add outreach + activity client methods
```

---

## Migration Plan

### Phase 1: LinkedIn Action Queue + Activity Log
- `linkedin_action_queue` table + migration
- `linkedin_activity_log` table + migration
- Queue repo (enqueue, dequeue, markProcessed, cancel, cleanup)
- `linkedin-action-executor.ts` service (executeAction dispatch)
- `execute-linkedin-actions` Trigger.dev task
- Refactor `process-post-campaigns` to enqueue + process results
- Refactor `poll-connection-requests` to enqueue accept actions

### Phase 2: Outreach Campaign CRUD
- `outreach_campaigns` + `outreach_campaign_steps` + `outreach_campaign_leads` tables
- Types + column constants
- Preset expansion logic
- Repo + service (CRUD, validation, template rendering)
- API routes (campaigns + leads)

### Phase 3: Sequence Advancement
- `advance-outreach-sequences` Trigger.dev task
- Lead state machine logic per preset
- Double-enqueue guard (check queue before inserting)
- Withdrawal timeout logic
- Campaign auto-completion

### Phase 4: Reply Detection
- Add `listChats`, `getChatMessages` to Unipile client
- `check-outreach-replies` Trigger.dev task
- Batch chat fetching + per-lead reply checking
- Follow-up enqueuing

### Phase 5: Withdrawal
- Add `listSentInvitations`, `cancelInvitation` to Unipile client
- Withdrawal flow in advancer (find invitation, enqueue cancel)

### Phase 6: MCP Tools + Activity Stream
- 12 MCP tools (outreach campaigns + activity)
- Activity stream API route with filters + pagination
- MCP client methods

### Phase 7: Testing
- Queue repo + executor unit tests
- Advancer logic unit tests (per preset, state transitions)
- Reply detection tests
- Withdrawal flow tests
- API route tests for all new routes
- MCP tool schema tests
- Integration test with Unipile (live API)

---

## Dependencies

- **Unipile accounts connected** — at least one LinkedIn account via Settings > Integrations
- **Existing safety system** — `account_safety_settings` + `linkedin_daily_limits` tables already deployed
- **Existing Unipile client** — `src/lib/integrations/unipile.ts` with base methods
- **Existing env vars** — `UNIPILE_DSN`, `UNIPILE_ACCESS_TOKEN` already configured
- **Anthropic API key** — not needed (no AI in outreach sequences)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| LinkedIn restricts account | Conservative limits (10 conn/day), operating hours, warm-up, circuit breaker. All enforced in executor. |
| Two systems race on same account | Single executor with concurrencyLimit: 1. Action queue guarantees serialization. |
| Post campaign latency increases | ~5 min added per action. Still within 45 min worst case. Acceptable. |
| Unipile API changes | Reference doc at `docs/unipile-api-reference.md`. New methods verified against docs. |
| Queue grows unbounded | 7-day cleanup of processed rows. Activity log is permanent record. |
| Agent adds 10k leads at once | 500 per request limit. Agent calls multiple times. |
| Follow-up sent to someone who replied | `check-outreach-replies` verifies chat before enqueuing follow-up. |
| Withdrawal can't find invitation ID | `listSentInvitations` lookup by provider_id instead of storing ID at connect time. |
