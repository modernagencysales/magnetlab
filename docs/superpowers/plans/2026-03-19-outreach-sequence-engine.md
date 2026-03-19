# Outreach Sequence Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a LinkedIn outreach sequence engine with a shared action queue that serializes all LinkedIn actions across post campaigns and outreach sequences.

**Architecture:** Three layers — (1) LinkedIn Action Queue with single executor for all LinkedIn actions, (2) Outreach Sequence Engine with presets/advancer/lead state machine, (3) Unified Activity Log. Post campaigns refactored to enqueue instead of calling Unipile directly.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL), Trigger.dev v4, Unipile API, MCP (packages/mcp)

**Spec:** `docs/superpowers/specs/2026-03-18-outreach-sequence-engine-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260319200000_linkedin_action_queue.sql` | Queue + activity log + safety columns |
| `supabase/migrations/20260319300000_outreach_campaigns.sql` | Campaign + steps + leads tables |
| `src/lib/types/linkedin-action-queue.ts` | Queue types, action payloads, priority constants |
| `src/lib/types/outreach-campaigns.ts` | Campaign/lead types, column constants, preset definitions |
| `src/server/repositories/linkedin-action-queue.repo.ts` | Queue CRUD (enqueue, dequeue, markProcessed, cancel, cleanup) |
| `src/server/repositories/outreach-campaigns.repo.ts` | Campaign + lead DB access |
| `src/server/services/linkedin-action-executor.ts` | executeAction dispatch (maps action types to Unipile calls) |
| `src/server/services/outreach-campaigns.service.ts` | Campaign CRUD, validation, template rendering, preset expansion |
| `src/trigger/execute-linkedin-actions.ts` | Queue executor task (every 5 min) |
| `src/trigger/advance-outreach-sequences.ts` | Lead advancer task (every 5 min) |
| `src/trigger/check-outreach-replies.ts` | Reply detection task (every 30 min) |
| `src/app/api/outreach-campaigns/route.ts` | GET (list), POST (create) |
| `src/app/api/outreach-campaigns/[id]/route.ts` | GET, PATCH, DELETE |
| `src/app/api/outreach-campaigns/[id]/activate/route.ts` | POST (activate) |
| `src/app/api/outreach-campaigns/[id]/pause/route.ts` | POST (pause) |
| `src/app/api/outreach-campaigns/[id]/leads/route.ts` | GET (list), POST (bulk add) |
| `src/app/api/outreach-campaigns/[id]/leads/[leadId]/route.ts` | GET (detail) |
| `src/app/api/outreach-campaigns/[id]/leads/[leadId]/skip/route.ts` | POST (skip) |
| `src/app/api/linkedin-activity/route.ts` | GET (unified stream) |
| `packages/mcp/src/tools/outreach-campaigns.ts` | 11 outreach tool definitions (12 total with activity) |
| `packages/mcp/src/handlers/outreach-campaigns.ts` | Handler dispatch |
| `packages/mcp/src/tools/linkedin-activity.ts` | 1 activity stream tool |
| `packages/mcp/src/handlers/linkedin-activity.ts` | Handler |
| `src/__tests__/server/repositories/linkedin-action-queue.repo.test.ts` | Queue repo tests |
| `src/__tests__/server/services/linkedin-action-executor.test.ts` | Executor dispatch tests |
| `src/__tests__/trigger/execute-linkedin-actions.test.ts` | Executor task tests |
| `src/__tests__/server/services/outreach-campaigns.service.test.ts` | Service tests |
| `src/__tests__/server/repositories/outreach-campaigns.repo.test.ts` | Repo tests |
| `src/__tests__/trigger/advance-outreach-sequences.test.ts` | Advancer tests |
| `src/__tests__/trigger/check-outreach-replies.test.ts` | Reply detection tests |
| `src/__tests__/api/outreach-campaigns/campaigns.test.ts` | API route tests |
| `src/__tests__/api/outreach-campaigns/leads.test.ts` | Lead route tests |
| `src/__tests__/api/linkedin-activity/activity.test.ts` | Activity route tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/integrations/unipile.ts` | Add 4 methods: listChats, getChatMessages, listSentInvitations, cancelInvitation |
| `src/server/services/account-safety.service.ts` | Add `profile_view` to ACTION_MAP, add mapToLimitAction helper |
| `src/trigger/process-post-campaigns.ts` | Refactor phases 2+3 to enqueue, add phase 0 result processing |
| `src/trigger/poll-connection-requests.ts` | Add outreach lead matching on accept |
| `packages/mcp/src/client.ts` | Add outreach campaign + activity client methods |
| `packages/mcp/src/tools/index.ts` | Register new tool arrays |
| `packages/mcp/src/handlers/index.ts` | Register new handlers |

---

## Task 1: Database Migration — Action Queue + Safety Columns

**Files:**
- Create: `supabase/migrations/20260319200000_linkedin_action_queue.sql`

**Docs to check:** Spec lines 54-97 (queue schema), 204-222 (activity log), 549-556 (safety columns), 708-728 (RLS policies)

- [ ] **Step 1: Write the migration SQL**

```sql
-- LinkedIn Action Queue
CREATE TABLE linkedin_action_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  unipile_account_id text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'view_profile', 'connect', 'message', 'follow_up_message',
    'withdraw', 'accept_invitation', 'react', 'comment'
  )),
  target_provider_id text,
  target_linkedin_url text,
  payload jsonb NOT NULL DEFAULT '{}',
  priority integer NOT NULL DEFAULT 10,
  source_type text NOT NULL CHECK (source_type IN ('post_campaign', 'outreach_campaign')),
  source_campaign_id uuid NOT NULL,
  source_lead_id uuid NOT NULL,
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

ALTER TABLE linkedin_action_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own actions" ON linkedin_action_queue FOR ALL USING (user_id = auth.uid());

-- LinkedIn Activity Log
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

ALTER TABLE linkedin_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own activity" ON linkedin_activity_log FOR SELECT USING (user_id = auth.uid());

-- Safety settings: add profile view limit
ALTER TABLE account_safety_settings ADD COLUMN
  max_profile_views_per_day integer NOT NULL DEFAULT 80;

-- Daily limits: add profile views counter
ALTER TABLE linkedin_daily_limits ADD COLUMN
  profile_views integer NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Push migration to Supabase**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm db:push`
Expected: Migration applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260319200000_linkedin_action_queue.sql
git commit -m "feat: add linkedin_action_queue + activity_log tables + safety columns"
```

---

## Task 2: Queue Types + Action Payload Definitions

**Files:**
- Create: `src/lib/types/linkedin-action-queue.ts`

**Docs to check:** Spec lines 61-63 (action types), 172-183 (daily limit mapping), 99-101 (priority)

- [ ] **Step 1: Write the types file**

Define: `QueueActionType`, `QueueActionStatus`, `QueuedAction` (DB row interface), `EnqueueActionInput`, `QUEUE_ACTION_COLUMNS`, `QUEUE_PRIORITY` constants, `ActivityLogEntry` interface, `ACTIVITY_LOG_COLUMNS`.

**Do NOT define action-to-limit mapping here** — it lives in `account-safety.service.ts` (single source of truth, see Task 4).

Key constants:
```typescript
export const QUEUE_PRIORITY = { POST_CAMPAIGN: 1, OUTREACH: 10 } as const;
```

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/linkedin-action-queue.ts
git commit -m "feat: add linkedin action queue types and constants"
```

---

## Task 3: Queue Repository

**Files:**
- Create: `src/server/repositories/linkedin-action-queue.repo.ts`
- Create: `src/__tests__/server/repositories/linkedin-action-queue.repo.test.ts`

**Docs to check:** Spec lines 137-144 (dequeue), 393-412 (markProcessed), 611 (cancel)

- [ ] **Step 1: Write failing tests for queue repo**

Test cases:
- `enqueueAction` — inserts a row with correct fields, returns the row
- `dequeueNext` — returns highest priority queued action for account, ordered by priority ASC then created_at ASC
- `markExecuting` — updates status to 'executing'
- `markCompleted` — updates status to 'completed', sets executed_at and result
- `markFailed` — updates status to 'failed', sets error
- `markProcessed` — sets processed = true
- `cancelByCampaign` — cancels all queued actions for a source_campaign_id
- `getUnprocessedResults` — returns completed/failed actions where processed = false for a source lead
- `hasPendingAction` — returns true if queued/executing action exists for a source_lead_id
- `cleanupOldRows` — deletes processed rows older than 7 days

Mock Supabase client. Follow pattern from existing repo tests.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="linkedin-action-queue.repo" --no-coverage`
Expected: All tests FAIL (functions not defined)

- [ ] **Step 3: Write the queue repo implementation**

Follow the pattern from `src/server/repositories/post-campaigns.repo.ts`:
- JSDoc module header
- Import `QUEUE_ACTION_COLUMNS` from types
- `createSupabaseAdminClient()` in each function
- Explicit column selects only
- Return `{ data, error }` pattern

Key functions: `enqueueAction`, `dequeueNext`, `markExecuting`, `markCompleted`, `markFailed`, `markProcessed`, `cancelByCampaign`, `getUnprocessedResults`, `hasPendingAction`, `cleanupOldRows`, `insertActivityLog`, `listActivityLog` (with filters: account_id, action_type, since, source_campaign_id, limit, offset).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="linkedin-action-queue.repo" --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/linkedin-action-queue.repo.ts src/__tests__/server/repositories/linkedin-action-queue.repo.test.ts
git commit -m "feat: add linkedin action queue repository with tests"
```

---

## Task 4: Update Safety System — Profile View Limit + Type Consolidation

**Files:**
- Modify: `src/lib/types/post-campaigns.ts`
- Modify: `src/server/repositories/account-safety.repo.ts`
- Modify: `src/server/services/account-safety.service.ts`

**Docs to check:** Spec lines 172-183 (action type mapping), 549-556 (profile_view limit), 187 (daily limit consolidation)

This task updates the entire safety stack: types → repo → service.

- [ ] **Step 1: Add `profile_view` to `ActionType` in types**

In `src/lib/types/post-campaigns.ts`:
- Add `'profile_view'` to `export type ActionType = 'dm' | 'connection_request' | 'connection_accept' | 'comment' | 'like' | 'profile_view'`

- [ ] **Step 2: Update safety repo with profile_view**

In `src/server/repositories/account-safety.repo.ts`:
- Add `profile_view: 'profile_views'` to `ACTION_COLUMN_MAP`
- Add `profile_views` to `SELECT_DAILY_LIMITS` column string
- Add `profile_views: number` to `DailyLimitsRow` interface
- Ensure `incrementDailyLimit` accepts `user_id` parameter and passes it to inserts (for FK)

- [ ] **Step 3: Update safety service with profile_view + mapping**

In `src/server/services/account-safety.service.ts`:
- Add `'profile_view'` to `DailyLimitAction` type
- Add `profile_view: { dbField: 'profile_views', settingsField: 'max_profile_views_per_day', isHighRisk: false }` to `ACTION_MAP`
- Add `max_profile_views_per_day: 80` to `DEFAULT_SETTINGS`
- Add `max_profile_views_per_day` to `ACCOUNT_SAFETY_COLUMNS` string and `AccountSafetySettings` interface
- Add `maxProfileViewsPerDay: 'max_profile_views_per_day'` to `SETTINGS_FIELD_MAP`

- [ ] **Step 4: Add `mapToLimitAction` helper (single source of truth for queue → limit mapping)**

In `src/server/services/account-safety.service.ts`:

```typescript
/** Map a queue action_type to DailyLimitAction. Returns null for actions without daily limits (withdraw). */
export function mapToLimitAction(actionType: string): DailyLimitAction | null {
  const map: Record<string, DailyLimitAction | null> = {
    view_profile: 'profile_view',
    connect: 'connection_request',
    message: 'dm',
    follow_up_message: 'dm',
    withdraw: null,
    accept_invitation: 'connection_accept',
    react: 'like',
    comment: 'comment',
  };
  return map[actionType] ?? null;
}
```

- [ ] **Step 5: Deprecate UTC-based `incrementDailyLimit` in post-campaigns.repo.ts**

In `src/server/repositories/post-campaigns.repo.ts`:
- Add `@deprecated` JSDoc to `incrementDailyLimit`
- All new code should use `account-safety.repo.ts` version

- [ ] **Step 6: Run existing safety tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="account-safety" --no-coverage`
Expected: PASS (existing tests should still pass)

- [ ] **Step 7: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/types/post-campaigns.ts src/server/repositories/account-safety.repo.ts src/server/services/account-safety.service.ts src/server/repositories/post-campaigns.repo.ts
git commit -m "feat: add profile_view daily limit across types, repo, and service layers"
```

---

## Task 5: Add New Unipile Client Methods

**Files:**
- Modify: `src/lib/integrations/unipile.ts`

**Docs to check:** Spec lines 570-583 (new methods), `docs/unipile-api-reference.md` lines 250-290 (invitation endpoints)

- [ ] **Step 1: Add `listChats` method**

```typescript
async listChats(accountId: string): Promise<ApiResponse<Array<{ id: string; attendees?: Array<{ provider_id?: string; name?: string }> }>>> {
  return this.get(`/chats?account_id=${encodeURIComponent(accountId)}`);
}
```

- [ ] **Step 2: Add `getChatMessages` method**

```typescript
async getChatMessages(chatId: string): Promise<ApiResponse<Array<{ id: string; sender_id?: string; text?: string; timestamp?: string }>>> {
  return this.get(`/chats/${encodeURIComponent(chatId)}/messages`);
}
```

- [ ] **Step 3: Add `listSentInvitations` method**

```typescript
async listSentInvitations(accountId: string): Promise<ApiResponse<UnipileInvitation[]>> {
  const result = await this.get<UnipileInvitationListResponse>(
    `/users/invite/sent?account_id=${encodeURIComponent(accountId)}`
  );
  if (result.error || !result.data) {
    return { data: null, error: result.error, status: result.status };
  }
  return { data: result.data.items ?? [], error: null, status: result.status };
}
```

- [ ] **Step 4: Add `cancelInvitation` method**

```typescript
async cancelInvitation(invitationId: string): Promise<ApiResponse<void>> {
  return this.delete(`/users/invite/${encodeURIComponent(invitationId)}`);
}
```

- [ ] **Step 5: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/integrations/unipile.ts
git commit -m "feat: add listChats, getChatMessages, listSentInvitations, cancelInvitation to Unipile client"
```

---

## Task 6: Action Executor Service

**Files:**
- Create: `src/server/services/linkedin-action-executor.ts`
- Create: `src/__tests__/server/services/linkedin-action-executor.test.ts`

**Docs to check:** Spec lines 189-200 (dispatch table), 560-583 (Unipile methods)

**Depends on:** Task 5 (Unipile client methods must exist for withdrawal flow)

- [ ] **Step 1: Write failing tests for executor dispatch**

Test cases per action type:
- `view_profile` → calls `client.resolveLinkedInProfile(accountId, payload.username)`
- `connect` → calls `client.sendConnectionRequest(accountId, providerId, payload.message)`
- `message` → calls `client.sendDirectMessage(accountId, providerId, payload.text)`
- `follow_up_message` → calls `client.sendDirectMessage(accountId, providerId, payload.text)`
- `withdraw` → calls withdrawal flow (listSentInvitations → find match → cancelInvitation)
- `withdraw` with no matching invitation → throws with "Invitation not found for withdrawal"
- `accept_invitation` → calls `client.handleInvitation(payload.invitation_id, 'accept')`
- `react` → calls `client.addReaction(payload.post_id, accountId, payload.reaction_type)`
- `comment` → calls `client.addComment(payload.post_id, accountId, payload.text, payload.options)`
- Unknown action type → throws error
- `isRateLimitError` — detects 429 status, "restricted", "temporarily unavailable", "challenge" in error messages

Mock the Unipile client.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="linkedin-action-executor" --no-coverage`
Expected: All tests FAIL

- [ ] **Step 3: Write the executor service**

```typescript
/**
 * LinkedIn Action Executor
 * Maps queue action_type to Unipile API calls. Pure dispatch — no safety logic, no queue management.
 * Never imports route-layer modules. Only called by execute-linkedin-actions task.
 */
```

Functions:
- `executeAction(client: UnipileClient, action: QueuedAction): Promise<unknown>` — switch dispatch
- `isRateLimitError(error: unknown): boolean` — checks for 429, restriction keywords
- `executeWithdrawal(client: UnipileClient, action: QueuedAction): Promise<unknown>` — listSentInvitations → find match by provider_id → cancelInvitation. Fallback: throw `"Invitation not found for withdrawal"`

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="linkedin-action-executor" --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/linkedin-action-executor.ts src/__tests__/server/services/linkedin-action-executor.test.ts
git commit -m "feat: add linkedin action executor service with tests"
```

---

## Task 7: Execute LinkedIn Actions — Trigger.dev Task

**Files:**
- Create: `src/trigger/execute-linkedin-actions.ts`
- Create: `src/__tests__/trigger/execute-linkedin-actions.test.ts`

**Docs to check:** Spec lines 110-170 (executor pseudocode)

- [ ] **Step 1: Write failing tests for the executor task**

Test cases:
- Skips run 10% of the time (`shouldSkipRun` returns true)
- Skips account outside operating hours
- Skips account with active circuit breaker
- Dequeues actions ordered by priority ASC, created_at ASC
- Skips action when daily limit reached (but processes view_profile/withdraw which have no limit → actually profile_view does have a limit now)
- Marks action as 'executing' before calling Unipile
- On success: marks 'completed', inserts activity log, increments daily limit
- On rate limit error: activates circuit breaker, stops all actions for account
- On non-rate-limit error: marks 'failed', continues
- Respects MAX_ACTIONS_PER_RUN (3)
- Delays between actions using randomDelay from safety settings
- Runs hourly cleanup on first run of each hour

Mock: Unipile client, queue repo, safety service, Trigger.dev SDK.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="execute-linkedin-actions" --no-coverage`
Expected: All tests FAIL

- [ ] **Step 3: Write the executor task**

Follow pattern from `src/trigger/process-post-campaigns.ts`:
- `schedules.task({ id: 'execute-linkedin-actions', cron: '*/5 * * * *', maxDuration: 300, queue: { concurrencyLimit: 1 } })`
- Import safety service functions, queue repo, executor service
- Implement hourly cleanup guard: `new Date().getMinutes() < 5`
- Main loop: distinct accounts → per-account drain loop

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="execute-linkedin-actions" --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/trigger/execute-linkedin-actions.ts src/__tests__/trigger/execute-linkedin-actions.test.ts
git commit -m "feat: add execute-linkedin-actions queue executor task with tests"
```

---

## Task 8: Refactor process-post-campaigns to Use Queue

**Files:**
- Modify: `src/trigger/process-post-campaigns.ts`

**Docs to check:** Spec lines 503-523 (refactored phases)

This is the most delicate task — refactoring working code. The key change: phases 2 and 3 stop calling Unipile directly and instead insert into `linkedin_action_queue`. A new phase 0 processes completed queue actions.

- [ ] **Step 1: Add Phase 0 — process completed queue actions**

At the top of the `run` function, before `detectCommenters()`:
- Query `linkedin_action_queue` for completed/failed actions where `source_type = 'post_campaign'` and `processed = false`
- For each completed action: update `post_campaign_leads` timestamps based on action_type (same logic that was inline before)
- For each failed action: update lead status to reflect the failure
- Mark queue rows as `processed = true`

- [ ] **Step 2: Refactor `reactReplyConnect` to enqueue instead of calling Unipile**

Replace each direct Unipile call with an `enqueueAction` call:
- `client.addReaction(...)` → `enqueueAction({ action_type: 'react', priority: 1, source_type: 'post_campaign', ... })`
- `client.addComment(...)` → `enqueueAction({ action_type: 'comment', priority: 1, ... })`
- `client.sendConnectionRequest(...)` → `enqueueAction({ action_type: 'connect', priority: 1, ... })`

Remove the `sleep(randomDelay(...))` calls — delays are now handled by the executor.
Remove safety checks (operating hours, circuit breaker, daily limits) — enforced by executor.
Keep the detection logic and lead status updates.

- [ ] **Step 3: Refactor `sendDms` to enqueue instead of calling Unipile**

Replace `client.sendDirectMessage(...)` with `enqueueAction({ action_type: 'message', priority: 1, ... })`.
Remove inline delay and safety checks.

- [ ] **Step 4: Remove Unipile client import**

The task no longer calls Unipile directly. Remove `import { getUnipileClient }` and any `client` variable.

- [ ] **Step 5: Run existing post campaign tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="post-campaign" --no-coverage`
Expected: Tests may need updating since the task no longer calls Unipile directly. Update mocks to verify `enqueueAction` is called instead.

- [ ] **Step 6: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/trigger/process-post-campaigns.ts
git commit -m "refactor: process-post-campaigns uses action queue instead of direct Unipile calls"
```

---

## Task 9: Refactor poll-connection-requests to Use Queue + Match Outreach Leads

**Files:**
- Modify: `src/trigger/poll-connection-requests.ts`

**Docs to check:** Spec lines 484-501 (refactored poll)

- [ ] **Step 1: Read the existing poll-connection-requests task**

Read `src/trigger/poll-connection-requests.ts` to understand current structure.

- [ ] **Step 2: Add Phase 0 — process completed accept actions from queue**

At the top of the run function, query completed/failed `accept_invitation` actions from `linkedin_action_queue` where `source_type = 'post_campaign'` and `processed = false`. For completed accepts, update `post_campaign_leads` connection status. Mark queue rows as processed.

- [ ] **Step 3: Refactor accept actions to enqueue**

Replace `client.handleInvitation(id, 'accept')` with `enqueueAction({ action_type: 'accept_invitation', priority: 1, ... })`. Remove inline safety checks (operating hours, circuit breaker, daily limits, delays) — these are now handled by the executor. Keep the invitation listing logic (the task still needs to call Unipile to discover pending invitations).

- [ ] **Step 4: Add outreach lead matching**

After checking `post_campaign_leads` for a match, also check `outreach_campaign_leads`:
```typescript
const { data: outreachMatch } = await supabase
  .from('outreach_campaign_leads')
  .select('id, campaign_id')
  .eq('unipile_provider_id', sender.provider_id)
  .eq('status', 'active')
  .not('connect_sent_at', 'is', null)
  .is('connected_at', null)
  .limit(1)
  .maybeSingle();

if (outreachMatch) {
  await supabase
    .from('outreach_campaign_leads')
    .update({ connected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', outreachMatch.id);
}
```

- [ ] **Step 5: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/trigger/poll-connection-requests.ts
git commit -m "refactor: poll-connection-requests uses queue + matches outreach leads"
```

---

## Task 10: Database Migration — Outreach Campaign Tables

**Files:**
- Create: `supabase/migrations/20260319300000_outreach_campaigns.sql`

**Docs to check:** Spec lines 232-280 (campaign + steps + leads tables), 708-728 (RLS)

- [ ] **Step 1: Write the migration SQL**

```sql
-- Outreach Campaigns
CREATE TABLE outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid,
  name text NOT NULL,
  preset text NOT NULL CHECK (preset IN ('warm_connect', 'direct_connect', 'nurture')),
  unipile_account_id text NOT NULL,
  connect_message text,
  first_message_template text NOT NULL,
  follow_up_template text,
  follow_up_delay_days integer NOT NULL DEFAULT 3,
  withdraw_delay_days integer NOT NULL DEFAULT 7,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE outreach_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaigns" ON outreach_campaigns FOR ALL USING (user_id = auth.uid());

-- Outreach Campaign Steps
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
    'previous_completed', 'connection_accepted', 'no_reply'
  )),
  config jsonb NOT NULL DEFAULT '{}',
  UNIQUE(campaign_id, step_order)
);

ALTER TABLE outreach_campaign_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own steps" ON outreach_campaign_steps FOR ALL
  USING (campaign_id IN (SELECT id FROM outreach_campaigns WHERE user_id = auth.uid()));

-- Outreach Campaign Leads
CREATE TABLE outreach_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  linkedin_url text NOT NULL,
  linkedin_username text,
  unipile_provider_id text,
  name text,
  company text,
  current_step_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'completed', 'replied', 'withdrawn', 'failed', 'skipped'
  )),
  step_completed_at timestamptz,
  viewed_at timestamptz,
  connect_sent_at timestamptz,
  connected_at timestamptz,
  messaged_at timestamptz,
  follow_up_sent_at timestamptz,
  withdrawn_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE outreach_campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own leads" ON outreach_campaign_leads FOR ALL USING (user_id = auth.uid());
```

- [ ] **Step 2: Push migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm db:push`
Expected: Migration applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260319300000_outreach_campaigns.sql
git commit -m "feat: add outreach_campaigns, outreach_campaign_steps, outreach_campaign_leads tables"
```

---

## Task 11: Outreach Campaign Types + Preset Definitions

**Files:**
- Create: `src/lib/types/outreach-campaigns.ts`

**Docs to check:** Spec lines 228-366 (data model), 285-315 (presets)

- [ ] **Step 1: Write the types file**

Define:
- `OutreachPreset` = `'warm_connect' | 'direct_connect' | 'nurture'`
- `OutreachCampaignStatus` = `'draft' | 'active' | 'paused' | 'completed'`
- `OutreachLeadStatus` = `'pending' | 'active' | 'completed' | 'replied' | 'withdrawn' | 'failed' | 'skipped'`
- `OutreachCampaign` interface (DB row)
- `OutreachCampaignStep` interface (DB row)
- `OutreachCampaignLead` interface (DB row)
- `CreateOutreachCampaignInput`, `UpdateOutreachCampaignInput` interfaces
- `AddOutreachLeadsInput` interface (bulk add)
- `OUTREACH_CAMPAIGN_COLUMNS`, `OUTREACH_STEP_COLUMNS`, `OUTREACH_LEAD_COLUMNS` constants
- `ALLOWED_UPDATE_FIELDS` whitelist
- `PRESET_STEPS` — maps each preset to its step array:

```typescript
export const PRESET_STEPS: Record<OutreachPreset, Array<{
  step_order: number;
  action_type: string;
  delay_days: number;
  delay_hours: number;
  trigger: string;
}>> = {
  warm_connect: [
    { step_order: 1, action_type: 'view_profile', delay_days: 0, delay_hours: 0, trigger: 'previous_completed' },
    { step_order: 2, action_type: 'connect', delay_days: 1, delay_hours: 0, trigger: 'previous_completed' },
    { step_order: 3, action_type: 'message', delay_days: 0, delay_hours: 0, trigger: 'connection_accepted' },
    { step_order: 4, action_type: 'follow_up_message', delay_days: 3, delay_hours: 0, trigger: 'no_reply' },
  ],
  direct_connect: [
    { step_order: 1, action_type: 'view_profile', delay_days: 0, delay_hours: 0, trigger: 'previous_completed' },
    { step_order: 2, action_type: 'connect', delay_days: 0, delay_hours: 0, trigger: 'previous_completed' },
    { step_order: 3, action_type: 'message', delay_days: 0, delay_hours: 0, trigger: 'connection_accepted' },
    { step_order: 4, action_type: 'follow_up_message', delay_days: 3, delay_hours: 0, trigger: 'no_reply' },
  ],
  nurture: [
    { step_order: 1, action_type: 'view_profile', delay_days: 0, delay_hours: 0, trigger: 'previous_completed' },
    { step_order: 2, action_type: 'connect', delay_days: 3, delay_hours: 0, trigger: 'previous_completed' },
    { step_order: 3, action_type: 'message', delay_days: 0, delay_hours: 0, trigger: 'connection_accepted' },
    { step_order: 4, action_type: 'follow_up_message', delay_days: 5, delay_hours: 0, trigger: 'no_reply' },
  ],
};
```

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/outreach-campaigns.ts
git commit -m "feat: add outreach campaign types, preset definitions, and column constants"
```

---

## Task 12: Outreach Campaign Repository

**Files:**
- Create: `src/server/repositories/outreach-campaigns.repo.ts`
- Create: `src/__tests__/server/repositories/outreach-campaigns.repo.test.ts`

- [ ] **Step 1: Write failing tests**

Test cases:
- Campaign CRUD: create (with steps expansion), get (with stats), list (with status filter), update (whitelist enforcement), delete (cascades)
- Lead operations: bulkAddLeads (dedup within campaign, max 500), listLeads (status filter), getLead (individual), skipLead (status update)
- Stats: getCampaignStats (count by status), getCampaignProgress (count by timestamp)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="outreach-campaigns.repo" --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write the repo implementation**

Key functions:
- `createCampaign(userId, teamId, input)` — insert campaign + expand preset into steps
- `getCampaign(userId, id)` — select with column constant
- `listCampaigns(userId, status?)` — filtered list
- `updateCampaign(userId, id, input)` — whitelist-enforced update
- `deleteCampaign(userId, id)` — delete (cascades via FK)
- `bulkAddLeads(userId, campaignId, leads[])` — insert with dedup, max 500
- `listLeads(userId, campaignId, status?)` — filtered
- `getLead(userId, leadId)` — single lead detail
- `updateLead(leadId, fields)` — timestamp/status updates
- `skipLead(leadId)` — set status = 'skipped'
- `getCampaignStats(campaignId)` — count grouped by status
- `getCampaignProgress(campaignId)` — count WHERE timestamp IS NOT NULL for each stage
- `listActiveCampaigns()` — all campaigns where status = 'active' (used by advancer)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="outreach-campaigns.repo" --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/outreach-campaigns.repo.ts src/__tests__/server/repositories/outreach-campaigns.repo.test.ts
git commit -m "feat: add outreach campaigns repository with tests"
```

---

## Task 13: Outreach Campaign Service

**Files:**
- Create: `src/server/services/outreach-campaigns.service.ts`
- Create: `src/__tests__/server/services/outreach-campaigns.service.test.ts`

- [ ] **Step 1: Write failing tests**

Test cases:
- Validation: name required, preset must be valid enum, first_message_template required, unipile_account_id required
- `createCampaign` — validates input, calls repo, returns ServiceResult
- `activateCampaign` — fails if 0 leads, fails if no template, succeeds otherwise
- `pauseCampaign` — cancels queued actions in queue, updates status
- `deleteCampaign` — cancels queued actions, calls repo delete
- `renderTemplate` — replaces {{name}} and {{company}} variables
- `addLeads` — validates LinkedIn URLs, calls repo bulkAddLeads
- `skipLead` — cancels queued actions for lead, calls repo skipLead

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="outreach-campaigns.service" --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write the service**

Follow `post-campaigns.service.ts` pattern:
- `ServiceResult<T>` discriminated union
- Validation functions
- CRUD operations wrapping repo
- Template rendering: `renderTemplate(template, { name, company })`
- `getStatusCode(err)` helper

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="outreach-campaigns.service" --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/outreach-campaigns.service.ts src/__tests__/server/services/outreach-campaigns.service.test.ts
git commit -m "feat: add outreach campaigns service with validation and template rendering"
```

---

## Task 14: Outreach Campaign API Routes

**Files:**
- Create: `src/app/api/outreach-campaigns/route.ts`
- Create: `src/app/api/outreach-campaigns/[id]/route.ts`
- Create: `src/app/api/outreach-campaigns/[id]/activate/route.ts`
- Create: `src/app/api/outreach-campaigns/[id]/pause/route.ts`
- Create: `src/app/api/outreach-campaigns/[id]/leads/route.ts`
- Create: `src/app/api/outreach-campaigns/[id]/leads/[leadId]/route.ts`
- Create: `src/app/api/outreach-campaigns/[id]/leads/[leadId]/skip/route.ts`
- Create: `src/app/api/linkedin-activity/route.ts`
- Create: `src/__tests__/api/outreach-campaigns/campaigns.test.ts`
- Create: `src/__tests__/api/outreach-campaigns/leads.test.ts`
- Create: `src/__tests__/api/linkedin-activity/activity.test.ts`

**Docs to check:** Spec lines 587-612 (routes)

- [ ] **Step 1: Write failing API route tests**

Test each route handler:
- `POST /api/outreach-campaigns` — creates campaign, returns 201, validates required fields
- `GET /api/outreach-campaigns` — lists campaigns, supports `?status=` filter
- `GET /api/outreach-campaigns/[id]` — returns campaign with stats + progress, 404 if not found
- `PATCH /api/outreach-campaigns/[id]` — updates allowed fields only
- `DELETE /api/outreach-campaigns/[id]` — deletes and cancels queue
- `POST /api/outreach-campaigns/[id]/activate` — validates prerequisites, returns 400 if no leads
- `POST /api/outreach-campaigns/[id]/pause` — pauses and cancels queue
- `POST /api/outreach-campaigns/[id]/leads` — bulk add, validates URLs, max 500
- `GET /api/outreach-campaigns/[id]/leads` — lists with status filter
- `GET /api/outreach-campaigns/[id]/leads/[leadId]` — single lead detail
- `POST /api/outreach-campaigns/[id]/leads/[leadId]/skip` — skips lead
- `GET /api/linkedin-activity` — lists activity with filters (account_id, action_type, since, limit, offset)
- All routes require auth (401 without session)

Mock: `getServerSession`, service layer.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="outreach-campaigns|linkedin-activity" --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write all route handlers**

Each route follows the same pattern from existing routes:
- `getServerSession()` → 401 if missing
- Parse params/body
- Call service
- Return JSON response with appropriate status code
- Route handlers stay under 30 lines

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="outreach-campaigns|linkedin-activity" --no-coverage`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/outreach-campaigns/ src/app/api/linkedin-activity/ src/__tests__/api/outreach-campaigns/ src/__tests__/api/linkedin-activity/
git commit -m "feat: add outreach campaign + activity stream API routes with tests"
```

---

## Task 15: Advance Outreach Sequences — Trigger.dev Task

**Files:**
- Create: `src/trigger/advance-outreach-sequences.ts`
- Create: `src/__tests__/trigger/advance-outreach-sequences.test.ts`

**Docs to check:** Spec lines 383-444 (advancer pseudocode)

- [ ] **Step 1: Write failing tests**

Test cases:
- **Process completed actions:** view_profile completed → sets viewed_at + caches provider_id. connect completed → sets connect_sent_at. message completed → sets messaged_at. follow_up completed → sets follow_up_sent_at + marks 'completed'. withdraw completed → marks 'withdrawn'. Failed action → marks lead 'failed'.
- **Double-enqueue guard:** skips lead if queued/executing action exists in queue
- **Withdrawal timeout:** lead with connect_sent_at older than withdraw_delay_days and no connected_at → enqueues withdraw
- **Step advancement per preset:**
  - pending lead → enqueues view_profile, sets status 'active'
  - viewed lead + delay elapsed + no connect_sent_at → enqueues connect
  - connected lead + no messaged_at → enqueues message with rendered template
  - follow_up handled by separate task (not here)
- **Campaign completion:** all leads in terminal state → campaign status = 'completed'
- **Template rendering:** message payload contains rendered first_message_template with {{name}} and {{company}} replaced

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="advance-outreach-sequences" --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write the advancer task**

```typescript
export const advanceOutreachSequences = schedules.task({
  id: 'advance-outreach-sequences',
  cron: '*/5 * * * *',
  maxDuration: 120,
  queue: { concurrencyLimit: 1 },
  run: async () => { /* ... */ },
});
```

Core logic: for each active campaign → processCompletedActions → checkWithdrawalTimeouts → evaluateNextSteps → checkCampaignCompletion.

Use preset-specific delay lookup from `PRESET_STEPS` to determine delay between view and connect.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="advance-outreach-sequences" --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/trigger/advance-outreach-sequences.ts src/__tests__/trigger/advance-outreach-sequences.test.ts
git commit -m "feat: add advance-outreach-sequences task with preset-based state machine"
```

---

## Task 16: Check Outreach Replies — Trigger.dev Task

**Files:**
- Create: `src/trigger/check-outreach-replies.ts`
- Create: `src/__tests__/trigger/check-outreach-replies.test.ts`

**Docs to check:** Spec lines 446-482 (reply detection pseudocode)

- [ ] **Step 1: Write failing tests**

Test cases:
- Fetches chats once per account (batch)
- If chat found with reply after messaged_at → marks lead 'replied'
- If no reply and follow_up_delay_days elapsed + follow_up_template set → enqueues follow_up_message
- If no reply and follow_up_delay_days elapsed + no follow_up_template → marks 'completed'
- If follow_up already sent (follow_up_sent_at set) → skip (should not be in query)
- Handles Unipile listChats error gracefully
- Respects jitter (shouldSkipRun)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="check-outreach-replies" --no-coverage`
Expected: FAIL

- [ ] **Step 3: Write the reply detection task**

```typescript
export const checkOutreachReplies = schedules.task({
  id: 'check-outreach-replies',
  cron: '*/30 * * * *',
  maxDuration: 120,
  queue: { concurrencyLimit: 1 },
  run: async () => { /* ... */ },
});
```

Key logic: per-account batch chat fetch → per-lead reply check → follow-up evaluation.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="check-outreach-replies" --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/trigger/check-outreach-replies.ts src/__tests__/trigger/check-outreach-replies.test.ts
git commit -m "feat: add check-outreach-replies task with batch chat detection"
```

---

## Task 17: MCP Tools — Outreach Campaigns + Activity Stream

**Files:**
- Create: `packages/mcp/src/tools/outreach-campaigns.ts`
- Create: `packages/mcp/src/handlers/outreach-campaigns.ts`
- Create: `packages/mcp/src/tools/linkedin-activity.ts`
- Create: `packages/mcp/src/handlers/linkedin-activity.ts`
- Modify: `packages/mcp/src/client.ts`
- Modify: `packages/mcp/src/tools/index.ts`
- Modify: `packages/mcp/src/handlers/index.ts`

**Docs to check:** Spec lines 615-659 (MCP tools), `packages/mcp/src/tools/post-campaigns.ts` (pattern)

- [ ] **Step 1: Write outreach campaign tool definitions (11 tools)**

Follow pattern from `packages/mcp/src/tools/post-campaigns.ts`. Each tool has name, description, inputSchema with JSON Schema properties.

Tools: create, list, get, update, activate, pause, delete, add_leads, list_leads, get_lead, skip_lead.

- [ ] **Step 2: Write linkedin activity tool definition (1 tool)**

`magnetlab_get_linkedin_activity` with params: account_id?, action_type?, since?, source_campaign_id?, limit?, offset?.

- [ ] **Step 3: Add client methods to MagnetLabClient**

In `packages/mcp/src/client.ts`, add methods:
- `createOutreachCampaign(input)` → `POST /outreach-campaigns`
- `listOutreachCampaigns(status?)` → `GET /outreach-campaigns`
- `getOutreachCampaign(id)` → `GET /outreach-campaigns/{id}`
- `updateOutreachCampaign(id, input)` → `PATCH /outreach-campaigns/{id}`
- `activateOutreachCampaign(id)` → `POST /outreach-campaigns/{id}/activate`
- `pauseOutreachCampaign(id)` → `POST /outreach-campaigns/{id}/pause`
- `deleteOutreachCampaign(id)` → `DELETE /outreach-campaigns/{id}`
- `addOutreachLeads(id, leads)` → `POST /outreach-campaigns/{id}/leads`
- `listOutreachLeads(id, status?)` → `GET /outreach-campaigns/{id}/leads`
- `getOutreachLead(campaignId, leadId)` → `GET /outreach-campaigns/{campaignId}/leads/{leadId}`
- `skipOutreachLead(campaignId, leadId)` → `POST /outreach-campaigns/{campaignId}/leads/{leadId}/skip`
- `getLinkedInActivity(params)` → `GET /linkedin-activity`

- [ ] **Step 4: Write handler dispatch functions**

`handleOutreachCampaignTools(name, args, client)` — switch on tool name, call client methods.
`handleLinkedInActivityTools(name, args, client)` — single tool dispatch.

- [ ] **Step 5: Register tools and handlers in index files**

Add imports and spread tool arrays / handler dispatch in `packages/mcp/src/tools/index.ts` and `packages/mcp/src/handlers/index.ts`.

- [ ] **Step 6: Run MCP package tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp" && pnpm test --no-coverage`
Expected: PASS (existing + new)

- [ ] **Step 7: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/mcp/src/tools/outreach-campaigns.ts packages/mcp/src/handlers/outreach-campaigns.ts packages/mcp/src/tools/linkedin-activity.ts packages/mcp/src/handlers/linkedin-activity.ts packages/mcp/src/client.ts packages/mcp/src/tools/index.ts packages/mcp/src/handlers/index.ts
git commit -m "feat: add 12 MCP tools for outreach campaigns + activity stream"
```

---

## Task 18: Full Test Suite + Typecheck

**Files:** All test files created above

- [ ] **Step 1: Run full test suite**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test --no-coverage`
Expected: All tests PASS. Note any failures and fix.

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Fix any failures and commit**

Stage only the specific files that were fixed (do NOT use `git add -A`):
```bash
git add <specific-files-that-were-fixed>
git commit -m "fix: resolve test and typecheck issues from outreach sequence engine"
```

---

## Task 19: Update Documentation

**Files:**
- Modify: `CLAUDE.md` (magnetlab)
- Modify: `docs/unipile-api-reference.md`

- [ ] **Step 1: Add feature documentation to CLAUDE.md**

Add a new section in the Feature Documentation table and inline docs:
- Outreach Sequence Engine overview
- Key files list
- MCP tools (12 new)
- Trigger.dev tasks (3 new)
- Architecture: action queue → executor → advancer pattern

- [ ] **Step 2: Update Unipile API reference with new endpoints**

Add documented and verified shapes for:
- `GET /chats?account_id=X` (listChats)
- `GET /chats/{id}/messages` (getChatMessages)
- `GET /users/invite/sent?account_id=X` (listSentInvitations)
- `DELETE /users/invite/{id}` (cancelInvitation)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/unipile-api-reference.md
git commit -m "docs: add outreach sequence engine docs to CLAUDE.md + Unipile API reference"
```
