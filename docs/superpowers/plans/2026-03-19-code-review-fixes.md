# Code Review Fixes — C1-C3, I1-I7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical (C1-C3) and important (I1-I7) findings from the 2026-03-19 code review before the dev reviews the day's work.

**Architecture:** Security fixes (scoping, race conditions) first, then architecture fixes (service extraction), then cleanup (console.log, colors, Zod, raw fetch). Each task is independent — no cross-task dependencies except Task 7 depends on Task 6 (Task 7 modifies the hook file created in Task 6).

**Tech Stack:** Next.js 15, Supabase (PostgreSQL RPCs), TypeScript, Zod, React

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `src/app/api/content-pipeline/posts/generate/route.ts` | Add user scoping to knowledge, template, idea queries (C1) |
| Create | `supabase/migrations/20260320200000_dequeue_and_claim.sql` | Atomic dequeue RPC (C2) |
| Modify | `src/server/repositories/linkedin-action-queue.repo.ts` | Call RPC instead of read-then-update (C2) |
| Create | `src/server/services/homepage-data.service.ts` | Extract business logic from route (C3) |
| Modify | `src/app/api/copilot/homepage-data/route.ts` | Thin route delegating to service (C3) |
| Modify | `src/components/mixer/MixerZone.tsx` | Remove debug console.log (I1) |
| Create | `src/components/copilot/useConversationStream.ts` | Extract SSE streaming hook (I2) |
| Modify | `src/components/copilot/CopilotConversation.tsx` | Use extracted hook (I2) |
| Create | `src/components/copilot/ContentReviewSections.tsx` | Extract section renderers (I2) |
| Modify | `src/components/copilot/ContentReviewPanel.tsx` | Use extracted components, replace zinc with tokens (I2+I3) |
| Create | `src/frontend/api/copilot.ts` | API module for copilot endpoints (I4) |
| Create | `src/server/services/mixer-inventory.service.ts` | Extract inventory logic (I5) |
| Create | `src/server/services/mixer-performance.service.ts` | Extract recipes + combo logic (I5) |
| Modify | `src/server/services/mixer.service.ts` | Delegate to sub-services (I5) |
| Create | `src/lib/validations/outreach-campaigns.ts` | Zod schemas for create/update (I6) |
| Modify | `src/app/api/outreach-campaigns/route.ts` | Parse body through Zod (I6) |
| Modify | `src/app/api/outreach-campaigns/[id]/route.ts` | Parse body through Zod (I6) |
| Modify | `src/server/services/copilot-briefing.service.ts` | Fix team scoping for posts (I7) |
| Test | `src/__tests__/api/content-pipeline/posts-generate.test.ts` | Update scoping tests (C1) |
| Test | `src/__tests__/server/repositories/linkedin-action-queue.repo.test.ts` | Update dequeue tests (C2) |
| Test | `src/__tests__/api/copilot/homepage-data.test.ts` | Update to test service layer (C3) |
| Test | `src/__tests__/lib/validations/outreach-campaigns.test.ts` | Zod schema tests (I6) |

---

### Task 1: C1 — Fix cross-tenant data leakage in generate route

**Files:**
- Modify: `src/app/api/content-pipeline/posts/generate/route.ts:87-135`
- Modify: `src/__tests__/api/content-pipeline/posts-generate.test.ts`

The `knowledge_ids`, `template_id`, `idea_id`, and `style_id` queries all lack user scoping. An authenticated user can read any other user's data by passing arbitrary UUIDs. The `exploit_id` and `creative_id` queries are already properly scoped.

- [ ] **Step 1: Add user scoping to knowledge_ids query**

In `src/app/api/content-pipeline/posts/generate/route.ts`, change the knowledge query (lines 87-91) to scope by user_id:

```typescript
if (knowledge_ids && knowledge_ids.length > 0) {
  const { data: entries } = await supabase
    .from('cp_knowledge_entries')
    .select('content')
    .in('id', knowledge_ids)
    .eq('user_id', userId);
  if (entries && entries.length > 0) {
    primitives.knowledge = entries.map((e: { content: string }) => ({ content: e.content }));
  }
}
```

- [ ] **Step 2: Add user + team scoping to template_id query**

Change the template query (lines 97-106). Templates can be global, user-owned, or team-owned. Match the mixer service pattern (mixer.service.ts line 171) which uses `is_global OR user_id OR team_id`:

```typescript
if (template_id) {
  const teamId = scope.teamId;
  const orFilter = teamId
    ? `is_global.eq.true,user_id.eq.${session.user.id},team_id.eq.${teamId}`
    : `is_global.eq.true,user_id.eq.${session.user.id}`;
  const { data: template } = await supabase
    .from('cp_post_templates')
    .select('structure')
    .eq('id', template_id)
    .or(orFilter)
    .single();
  if (template) {
    primitives.template = { structure: template.structure };
  }
}
```

- [ ] **Step 3: Add user scoping to idea_id query**

Change the idea query (lines 108-119):

```typescript
if (idea_id) {
  const { data: idea } = await supabase
    .from('cp_content_ideas')
    .select('core_insight, key_points')
    .eq('id', idea_id)
    .eq('user_id', userId)
    .single();
  if (idea) {
    primitives.idea = {
      core_insight: idea.core_insight,
      key_points: idea.key_points ?? [],
    };
  }
}
```

- [ ] **Step 4: Add user + team scoping to style_id query**

Change the style query (lines 122-134). Writing styles can be user-owned or team-owned. Match the mixer service pattern (mixer.service.ts line 177) which uses `user_id OR team_id`:

```typescript
if (style_id) {
  const teamId = scope.teamId;
  const orFilter = teamId
    ? `user_id.eq.${userId},team_id.eq.${teamId}`
    : `user_id.eq.${userId}`;
  const { data: style } = await supabase
    .from('cp_writing_styles')
    .select('tone, vocabulary, banned_phrases')
    .eq('id', style_id)
    .or(orFilter)
    .single();
  if (style) {
    primitives.voice = {
      tone: style.tone,
      vocabulary: style.vocabulary ?? [],
      banned_phrases: style.banned_phrases ?? [],
    };
  }
}
```

- [ ] **Step 5: Verify existing tests cover cross-user access**

Open `src/__tests__/api/content-pipeline/posts-generate.test.ts`. Add a test that verifies passing a knowledge_id belonging to another user returns a generated post WITHOUT that knowledge (the query should return empty, not error). The test should mock the supabase `.eq('user_id', ...)` filter returning no data. This confirms scoping works.

- [ ] **Step 6: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="posts-generate" --no-coverage`
Expected: All tests pass including new scoping test.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/content-pipeline/posts/generate/route.ts src/__tests__/api/content-pipeline/posts-generate.test.ts
git commit -m "fix(security): scope knowledge, template, idea, style queries to user in generate route

knowledge_ids, template_id, idea_id, and style_id queries had no user scoping —
any authenticated user could read other users' data by passing arbitrary UUIDs.
Exploit and creative queries were already scoped correctly."
```

---

### Task 2: C2 — Fix dequeue race condition with atomic claim RPC

**Files:**
- Create: `supabase/migrations/20260320200000_dequeue_and_claim.sql`
- Modify: `src/server/repositories/linkedin-action-queue.repo.ts:67-79`
- Modify: `src/__tests__/server/repositories/linkedin-action-queue.repo.test.ts`

The current `dequeueNext()` reads, then the caller calls `markExecuting()` — a classic TOCTOU race. Replace with an atomic `dequeue_and_claim` Supabase RPC that uses `FOR UPDATE SKIP LOCKED`.

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260320200000_dequeue_and_claim.sql`:

```sql
-- Atomic dequeue: selects the oldest queued action for an account and marks it executing in one statement.
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions if two workers somehow run concurrently.

CREATE OR REPLACE FUNCTION dequeue_and_claim(p_account_id text)
RETURNS SETOF linkedin_action_queue
LANGUAGE sql
AS $$
  UPDATE linkedin_action_queue
  SET status = 'executing'
  WHERE id = (
    SELECT id
    FROM linkedin_action_queue
    WHERE unipile_account_id = p_account_id
      AND status = 'queued'
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
```

- [ ] **Step 2: Replace dequeueNext() with RPC call**

In `src/server/repositories/linkedin-action-queue.repo.ts`, replace the `dequeueNext` function (lines 66-79):

```typescript
/**
 * Atomically claim the oldest queued action for an account.
 * Uses a Postgres RPC with FOR UPDATE SKIP LOCKED to prevent double-execution.
 * Returns the claimed row (now status='executing'), or null if the queue is empty.
 */
export async function dequeueNext(accountId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('dequeue_and_claim', {
    p_account_id: accountId,
  });

  if (error) return { data: null, error };

  // RPC returns an array; take the first (only) row or null
  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  return { data: row, error: null };
}
```

- [ ] **Step 3: Remove the markExecuting() call from the executor**

Open `src/trigger/execute-linkedin-actions.ts`. Find where `dequeueNext()` is called followed by `markExecuting()`. Remove the `markExecuting()` call since the RPC now atomically sets `status = 'executing'`. The dequeued row is already in executing state.

Search for `markExecuting` in the file and remove or comment it. If `markExecuting` is still used elsewhere in the repo, keep the function but remove the call from the executor. If it's only used here, you can leave the function in the repo (it's still valid for other potential callers) but remove the executor call.

- [ ] **Step 4: Update tests**

In `src/__tests__/server/repositories/linkedin-action-queue.repo.test.ts`, update the dequeue test to mock `.rpc('dequeue_and_claim', ...)` instead of the old `.select().eq().eq().order().order().limit().maybeSingle()` chain.

- [ ] **Step 5: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="linkedin-action-queue" --no-coverage`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260320200000_dequeue_and_claim.sql src/server/repositories/linkedin-action-queue.repo.ts src/trigger/execute-linkedin-actions.ts src/__tests__/server/repositories/linkedin-action-queue.repo.test.ts
git commit -m "fix: atomic dequeue with FOR UPDATE SKIP LOCKED to prevent race condition

The old read-then-update pattern could double-execute LinkedIn actions if
concurrent runs picked the same queued action. New dequeue_and_claim RPC
atomically selects and marks executing in one statement."
```

---

### Task 3: C3 — Extract homepage-data business logic to service

**Files:**
- Create: `src/server/services/homepage-data.service.ts`
- Modify: `src/app/api/copilot/homepage-data/route.ts`
- Modify: `src/__tests__/api/copilot/homepage-data.test.ts`

The route handler is 284 lines with `buildSuggestions()`, `buildStats()`, `buildConversations()`, formatters, and date helpers. Extract all to a service; route becomes ~20 lines.

- [ ] **Step 1: Create the service file**

Create `src/server/services/homepage-data.service.ts` with the types, column constants, `buildSuggestions`, `buildStats`, `buildConversations`, `formatCountChange`, `formatPercentChange`, `deriveChangeType`, and a new `getHomepageData(userId: string)` function that contains the DB queries currently in the GET handler.

JSDoc header:

```typescript
/** Homepage Data Service. Builds suggestions, stats, and conversations for the copilot homepage. Never imports from Next.js request/response objects. */
```

Move from route.ts:
- `Suggestion`, `ChangeType`, `Stat`, `RecentConversation`, `HomepageData` interfaces
- Column constants (`POST_COUNT_COLUMNS`, etc.)
- `buildSuggestions`, `buildStats`, `buildConversations`
- `formatCountChange`, `formatPercentChange`, `deriveChangeType`
- The DB query logic from the GET handler body (everything between `const supabase = ...` and `return NextResponse.json(data)`)

Export: `getHomepageData(userId: string): Promise<HomepageData>` — this is the single function the route calls.

Also export: `getStatusCode(err: unknown): number` error helper (standard pattern).

- [ ] **Step 2: Slim down the route handler**

Replace `src/app/api/copilot/homepage-data/route.ts` with:

```typescript
/**
 * GET /api/copilot/homepage-data.
 * Purpose: Combined homepage data (suggestions + stats + conversations).
 * Constraint: Auth required. Delegates to homepage-data service.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { getHomepageData, getStatusCode } from '@/server/services/homepage-data.service';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await getHomepageData(session.user.id);
    return NextResponse.json(data);
  } catch (err) {
    logError('GET /api/copilot/homepage-data', err, { userId: session.user.id });
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(err) });
  }
}
```

- [ ] **Step 3: Update tests to mock service**

In `src/__tests__/api/copilot/homepage-data.test.ts`, update mocks. The route now imports from the service, so you may need to mock `@/server/services/homepage-data.service` instead of individual DB calls. Alternatively, keep the DB mocking if the tests already work — the service extraction is structural, not behavioral.

- [ ] **Step 4: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="homepage-data" --no-coverage`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/homepage-data.service.ts src/app/api/copilot/homepage-data/route.ts src/__tests__/api/copilot/homepage-data.test.ts
git commit -m "refactor: extract homepage-data business logic to service layer

Route was 284 lines with buildSuggestions, buildStats, buildConversations,
formatters, and DB queries. Now route is ~20 lines delegating to
homepage-data.service.ts."
```

---

### Task 4: I1 — Remove debug console.log from MixerZone

**Files:**
- Modify: `src/components/mixer/MixerZone.tsx:78`

- [ ] **Step 1: Remove the debug log**

In `src/components/mixer/MixerZone.tsx`, line 78, delete:

```typescript
console.log('[MixerZone] tile clicked:', type, 'setting drawer open');
```

The `handleTileClick` callback should just be:

```typescript
const handleTileClick = useCallback((type: IngredientType) => {
  setActiveDrawerType(type);
  setDrawerOpen(true);
}, []);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/mixer/MixerZone.tsx
git commit -m "fix: remove debug console.log from MixerZone"
```

---

### Task 5: I2 + I3 — Shrink ContentReviewPanel + replace hardcoded colors

**Files:**
- Create: `src/components/copilot/ContentReviewSections.tsx`
- Modify: `src/components/copilot/ContentReviewPanel.tsx`

ContentReviewPanel is 620 lines with 21 instances of hardcoded zinc classes. Extract section renderers and replace all `zinc-*` / `gray-*` / `slate-*` classes with design tokens.

- [ ] **Step 1: Create ContentReviewSections.tsx**

Extract the section rendering JSX from ContentReviewPanel into sub-components. At minimum extract:
- `SectionRenderer` — the collapsible section with items (this is the largest block, ~80 lines of JSX per section)
- `MistakesList` — the common mistakes list rendering
- `ContentMetadata` — the insight/experience/proof/differentiation block

Each sub-component receives the relevant slice of `editedContent` + editing callbacks as props.

JSDoc header:

```typescript
/** ContentReviewSections. Sub-components for rendering content review sections. Constraint: Pure render, no API calls. */
```

- [ ] **Step 2: Replace hardcoded color classes in both files**

Global replacements for ContentReviewPanel.tsx (and the new ContentReviewSections.tsx):

| Hardcoded | Design Token |
|-----------|-------------|
| `bg-zinc-100 dark:bg-zinc-800` | `bg-muted` |
| `bg-zinc-50 dark:bg-zinc-800/50` | `bg-muted/50` |
| `bg-zinc-200 dark:bg-zinc-700` | `bg-muted` |
| `text-zinc-900 dark:text-zinc-100` | `text-foreground` |
| `text-zinc-800 dark:text-zinc-200` | `text-foreground` |
| `text-zinc-700 dark:text-zinc-300` | `text-muted-foreground` |
| `text-zinc-500 dark:text-zinc-400` | `text-muted-foreground` |
| `text-zinc-400` | `text-muted-foreground` |
| `border-zinc-300 dark:border-zinc-600` | `border-border` |
| `border-zinc-200 dark:border-zinc-700` | `border-border` |
| `hover:bg-zinc-100 dark:hover:bg-zinc-800` | `hover:bg-muted` |
| `hover:bg-zinc-300 dark:hover:bg-zinc-600` | `hover:bg-muted` |
| `bg-white dark:bg-zinc-800` | `bg-background` |
| `border border-violet-300` | `border border-ring` |

Also fix the `EditableField` sub-component's `sharedClasses` string (line 92-93):

From: `'w-full rounded-md border border-violet-300 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500'`

To: `'w-full rounded-md border border-ring bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'`

- [ ] **Step 3: Verify ContentReviewPanel is now under 300 lines**

After extraction, the main component should be ~350 lines or less (EditableField is already inline and takes ~100 lines — could be moved to the sections file too if needed to get under 300).

- [ ] **Step 4: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="CopilotComponents" --no-coverage`
Expected: All tests pass (rendering tests should be unaffected by color token changes).

- [ ] **Step 5: Commit**

```bash
git add src/components/copilot/ContentReviewPanel.tsx src/components/copilot/ContentReviewSections.tsx
git commit -m "refactor: extract ContentReviewSections + replace hardcoded zinc with design tokens

ContentReviewPanel was 620 lines with 21 hardcoded zinc color classes.
Extracted section renderers to ContentReviewSections.tsx and replaced all
zinc/gray/slate classes with design system tokens (bg-muted, text-foreground,
border-border, etc.) to prevent light mode breakage."
```

---

### Task 6: I2 (continued) — Extract SSE streaming hook from CopilotConversation

**Files:**
- Create: `src/components/copilot/useConversationStream.ts`
- Modify: `src/components/copilot/CopilotConversation.tsx`

CopilotConversation is 560 lines. The SSE parsing, message sending, and streaming state management (~250 lines) can be extracted to a custom hook.

- [ ] **Step 1: Create useConversationStream hook**

Create `src/components/copilot/useConversationStream.ts`:

```typescript
/** useConversationStream. Encapsulates SSE streaming, message state, and send/cancel/retry for copilot conversations. */
```

Move from CopilotConversation:
- `parseSSELines` function and `SSEEventHandler` type
- All state: `messages`, `conversationId`, `conversationTitle`, `isStreaming`, `error`, `pendingConfirmation`
- All refs: `abortRef`, `sendMessageRef`, `hasInitializedRef`, `conversationIdRef`
- `loadConversation`, `sendMessage`, `cancelStream`, `confirmAction`, `submitFeedback`, `deleteConversation`, `retry`

The hook accepts: `{ conversationId: string; initialMessage?: string; sourceContext?: {...} }`

The hook returns: `{ messages, conversationId, conversationTitle, isStreaming, error, pendingConfirmation, sendMessage, cancelStream, confirmAction, submitFeedback, deleteConversation, retry, isEmpty }`

- [ ] **Step 2: Slim CopilotConversation to render-only**

CopilotConversation becomes a pure render component (~100-150 lines) that calls `useConversationStream(...)` and renders the header, message list, streaming indicator, error state, and input.

- [ ] **Step 3: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="copilot" --no-coverage`
Expected: All copilot tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/copilot/useConversationStream.ts src/components/copilot/CopilotConversation.tsx
git commit -m "refactor: extract useConversationStream hook from CopilotConversation

CopilotConversation was 560 lines. SSE streaming, message state, and all
action handlers extracted to useConversationStream hook. Component is now
~150 lines of pure rendering."
```

---

### Task 7: I4 — Create copilot API module and replace raw fetch calls

**Files:**
- Create: `src/frontend/api/copilot.ts`
- Modify: `src/components/copilot/CopilotConversation.tsx` (or `useConversationStream.ts` after Task 6)
- Modify: `src/components/copilot/CommandBar.tsx`

Raw `fetch()` calls in copilot components should use an API module (same pattern as all other frontend modules). SSE streaming fetch is exempt (no standard client supports it), but standard GET/POST/DELETE calls should go through the module.

- [ ] **Step 1: Create the API module**

Create `src/frontend/api/copilot.ts`.

**IMPORTANT:** `apiClient` already prepends `/api` (see `client.ts` line 8: `const BASE = '/api'`). All paths must omit the `/api` prefix or you'll get `/api/api/...` which 404s.

```typescript
/** Copilot API module. Client-side wrappers for copilot endpoints. Never imports server-only modules. */

import { apiClient } from './client';

// ─── Conversations ──────────────────────────────────────────────────────────

export async function getConversation(id: string) {
  return apiClient.get<{
    conversation: { id: string; title: string };
    messages: Array<Record<string, unknown>>;
  }>(`/copilot/conversations/${id}`);
}

export async function listConversations(limit = 5) {
  return apiClient.get<{
    conversations: Array<{
      id: string;
      title: string;
      entity_type: string | null;
      entity_id: string | null;
      model: string | null;
      created_at: string;
      updated_at: string;
    }>;
  }>(`/copilot/conversations?limit=${limit}`);
}

export async function deleteConversation(id: string) {
  return apiClient.delete(`/copilot/conversations/${id}`);
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export async function submitFeedback(
  conversationId: string,
  messageId: string,
  rating: 'positive' | 'negative',
  note?: string
) {
  return apiClient.post(`/copilot/conversations/${conversationId}/feedback`, {
    messageId,
    rating,
    note,
  });
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function confirmAction(
  conversationId: string,
  toolUseId: string,
  approved: boolean,
  toolName: string,
  toolArgs: Record<string, unknown>
) {
  return apiClient.post<{
    executed?: boolean;
    result?: Record<string, unknown>;
  }>(`/copilot/confirm-action`, {
    conversationId,
    toolUseId,
    approved,
    toolName,
    toolArgs,
  });
}
```

- [ ] **Step 2: Replace raw fetch in CopilotConversation / useConversationStream**

Replace these raw fetch calls with the API module:
- `loadConversation`: `fetch(\`/api/copilot/conversations/${id}\`)` → `getConversation(id)`
- `confirmAction`: `fetch('/api/copilot/confirm-action', ...)` → `confirmAction(...)`
- `submitFeedback`: `fetch(\`/api/copilot/conversations/${currentId}/feedback\`, ...)` → `submitFeedback(...)`
- `deleteConversation`: `fetch(\`/api/copilot/conversations/${currentId}\`, { method: 'DELETE' })` → `deleteConversation(currentId)`

Leave the SSE streaming `fetch('/api/copilot/chat', ...)` as-is — it requires ReadableStream which the API client doesn't support.

- [ ] **Step 3: Replace raw fetch in CommandBar**

In `src/components/copilot/CommandBar.tsx`, line 71, replace:
```typescript
fetch('/api/copilot/conversations?limit=5')
```
with:
```typescript
import { listConversations } from '@/frontend/api/copilot';
// ...
listConversations(5)
```

- [ ] **Step 4: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="copilot" --no-coverage`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/api/copilot.ts src/components/copilot/CopilotConversation.tsx src/components/copilot/useConversationStream.ts src/components/copilot/CommandBar.tsx
git commit -m "refactor: add copilot API module, replace raw fetch calls

Standard GET/POST/DELETE copilot calls now go through src/frontend/api/copilot.ts.
SSE streaming fetch remains raw (ReadableStream not supported by API client)."
```

---

### Task 8: I5 — Split mixer.service.ts into sub-services

**Files:**
- Create: `src/server/services/mixer-inventory.service.ts`
- Create: `src/server/services/mixer-performance.service.ts`
- Modify: `src/server/services/mixer.service.ts`
- Modify: `src/__tests__/server/services/mixer.service.test.ts`

mixer.service.ts is 836 lines. Split into 3 files: scope/auth + mix orchestration stays in mixer.service.ts, inventory goes to mixer-inventory.service.ts, recipes + combo performance goes to mixer-performance.service.ts.

- [ ] **Step 1: Create mixer-inventory.service.ts**

Extract `getInventory()` and its helper queries. Move the column constants it uses (`KNOWLEDGE_COLUMNS`, `EXPLOIT_COLUMNS`, etc. — only the ones used by inventory). Import `resolveScope` from mixer.service.ts.

JSDoc: `/** Mixer Inventory Service. Fetches counts and health indicators for all 7 ingredient types. Never imports from Next.js request/response objects. */`

- [ ] **Step 2: Create mixer-performance.service.ts**

Extract `getSuggestedRecipes()` and `getComboPerformance()`. Import `resolveScope` from mixer.service.ts.

JSDoc: `/** Mixer Performance Service. Recipe suggestions and combo performance analytics. Never imports from Next.js request/response objects. */`

- [ ] **Step 3: Update mixer.service.ts**

Remove the extracted functions. Keep: `resolveScope`, `verifyAccess`, `mix()` (the core AI orchestrator), `getStatusCode`, and the `escapeIlike` helper. After extraction, mixer.service.ts should be ~500 lines (the `mix()` function alone is ~350 lines, which is the expected size for an AI orchestrator). Re-export the extracted functions so existing callers don't break:

```typescript
// Re-exports for API routes that import from mixer.service
export { getInventory } from './mixer-inventory.service';
export { getSuggestedRecipes, getComboPerformance } from './mixer-performance.service';
```

Also fix the import order issue (I-M1): move the `escapeIlike` helper after all imports, not between them.

- [ ] **Step 4: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="mixer" --no-coverage`
Expected: All tests pass (re-exports preserve the import paths).

- [ ] **Step 5: Commit**

```bash
git add src/server/services/mixer.service.ts src/server/services/mixer-inventory.service.ts src/server/services/mixer-performance.service.ts
git commit -m "refactor: split mixer.service.ts (836 lines) into sub-services

mixer-inventory.service.ts: getInventory (counts + health for 7 ingredient types)
mixer-performance.service.ts: getSuggestedRecipes + getComboPerformance
mixer.service.ts: resolveScope, verifyAccess, mix() orchestrator (~300 lines)
Re-exports preserve existing import paths."
```

---

### Task 9: I6 — Add Zod validation for outreach campaign create/update

**Files:**
- Create: `src/lib/validations/outreach-campaigns.ts`
- Create: `src/__tests__/lib/validations/outreach-campaigns.test.ts`
- Modify: `src/app/api/outreach-campaigns/route.ts:50`
- Modify: `src/app/api/outreach-campaigns/[id]/route.ts:40`

Both route handlers cast request body with `as` instead of Zod parsing.

- [ ] **Step 1: Create the Zod schemas**

Create `src/lib/validations/outreach-campaigns.ts`:

```typescript
/** Outreach campaign validation schemas. Matches types in lib/types/outreach-campaigns.ts. */

import { z } from 'zod';

const PRESETS = ['warm_connect', 'direct_connect', 'nurture'] as const;

export const CreateOutreachCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  preset: z.enum(PRESETS),
  unipile_account_id: z.string().min(1, 'LinkedIn account is required'),
  first_message_template: z.string().min(1, 'First message template is required'),
  connect_message: z.string().max(300).optional(),
  follow_up_template: z.string().optional(),
  follow_up_delay_days: z.number().int().min(1).max(30).optional(),
  withdraw_delay_days: z.number().int().min(1).max(90).optional(),
});

export const UpdateOutreachCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  connect_message: z.string().max(300).nullable().optional(),
  first_message_template: z.string().min(1).optional(),
  follow_up_template: z.string().nullable().optional(),
  follow_up_delay_days: z.number().int().min(1).max(30).optional(),
  withdraw_delay_days: z.number().int().min(1).max(90).optional(),
});

export const AddOutreachLeadSchema = z.object({
  linkedin_url: z.string().url('Must be a valid URL').refine(
    (url) => url.includes('linkedin.com/in/'),
    'Must be a LinkedIn profile URL'
  ),
  name: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
});

export const AddOutreachLeadsBatchSchema = z.object({
  leads: z.array(AddOutreachLeadSchema).min(1, 'At least one lead required').max(1000),
});
```

- [ ] **Step 2: Write Zod schema tests**

Create `src/__tests__/lib/validations/outreach-campaigns.test.ts` with:
- Valid create input passes
- Missing required fields fail (name, preset, unipile_account_id, first_message_template)
- Invalid preset value fails
- Valid update input passes (all optional)
- Invalid LinkedIn URL fails AddOutreachLeadSchema
- Batch with empty leads array fails

- [ ] **Step 3: Wire Zod into POST route**

In `src/app/api/outreach-campaigns/route.ts`, replace line 50:

```typescript
// Before:
const body = (await request.json()) as CreateOutreachCampaignInput;

// After:
import { CreateOutreachCampaignSchema } from '@/lib/validations/outreach-campaigns';
import { formatZodError } from '@/lib/validations/api';
// ...
const rawBody = await request.json();
const parsed = CreateOutreachCampaignSchema.safeParse(rawBody);
if (!parsed.success) {
  return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
}
const body = parsed.data;
```

- [ ] **Step 4: Wire Zod into PATCH route**

In `src/app/api/outreach-campaigns/[id]/route.ts`, replace line 40:

```typescript
// Before:
const body = (await request.json()) as UpdateOutreachCampaignInput;

// After:
import { UpdateOutreachCampaignSchema } from '@/lib/validations/outreach-campaigns';
import { formatZodError } from '@/lib/validations/api';
// ...
const rawBody = await request.json();
const parsed = UpdateOutreachCampaignSchema.safeParse(rawBody);
if (!parsed.success) {
  return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
}
const body = parsed.data;
```

- [ ] **Step 5: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="outreach-campaigns" --no-coverage`
Expected: All tests pass (validation + API).

- [ ] **Step 6: Commit**

```bash
git add src/lib/validations/outreach-campaigns.ts src/__tests__/lib/validations/outreach-campaigns.test.ts src/app/api/outreach-campaigns/route.ts src/app/api/outreach-campaigns/\[id\]/route.ts
git commit -m "fix: add Zod validation for outreach campaign create/update

Request bodies were cast with 'as' instead of validated through Zod.
Added CreateOutreachCampaignSchema, UpdateOutreachCampaignSchema,
AddOutreachLeadSchema with Zod schema tests."
```

---

### Task 10: I7 — Fix copilot briefing team scoping for posts

**Files:**
- Modify: `src/server/services/copilot-briefing.service.ts:38-49`
- Modify: `src/__tests__/server/services/copilot-briefing.service.test.ts`

The `applyPostScope` function always falls back to `user_id` even in team mode, so team members only see their own posts in homepage stats — not the team's posts.

- [ ] **Step 1: Fix applyPostScope to use team_profile_id in team mode**

`DataScope` (from `src/lib/utils/team-context.ts`) does NOT have `teamProfileId` — it only has `userId`, `teamId`, and `billingUserId`. So we need to resolve `team_profile_id` via a lookup, same pattern the mixer service uses.

In `src/server/services/copilot-briefing.service.ts`, replace the `applyPostScope` function (lines 38-49). Change it from sync to async and add a `supabase` parameter:

```typescript
/**
 * Apply scope to cp_pipeline_posts.
 * In team mode, resolve team_profile_id via team_profiles lookup (cp_pipeline_posts uses team_profile_id).
 * In personal mode, scope to user_id.
 * Extra query is small and runs once per homepage load — acceptable trade-off.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyPostScope(query: any, scope: DataScope, supabase: SupabaseClient): Promise<any> {
  if (scope.type === 'team' && scope.teamId) {
    const { data: profile } = await supabase
      .from('team_profiles')
      .select('id')
      .eq('team_id', scope.teamId)
      .eq('user_id', scope.userId)
      .maybeSingle();
    if (profile) {
      return query.eq('team_profile_id', profile.id);
    }
  }
  return query.eq('user_id', scope.userId);
}
```

Then update the two call sites inside `fetchBriefingData` to pass `supabase` and `await`:

- Line 86-92 (queueQuery): change to `const queueQuery = await applyPostScope(supabase.from(...).select(...).eq('status', 'reviewing'), scope, supabase);`
- Line 95-103 (scheduledQuery): change to `const scheduledQuery = await applyPostScope(supabase.from(...).select(...).eq('status', 'scheduled')..., scope, supabase);`

Since these two queries are built before the `Promise.all` block, and `applyPostScope` is now async, build the scoped queries first, then pass them into `Promise.all`.

- [ ] **Step 2: Update tests**

In `src/__tests__/server/services/copilot-briefing.service.test.ts`, add a test for team mode that verifies `team_profile_id` scoping is applied to the posts query.

- [ ] **Step 3: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="copilot-briefing" --no-coverage`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/services/copilot-briefing.service.ts src/__tests__/server/services/copilot-briefing.service.test.ts
git commit -m "fix: copilot briefing now shows team posts in team mode

applyPostScope was falling back to user_id in both modes, so team members
only saw their own posts in homepage stats. Now resolves team_profile_id
for proper team-level scoping."
```

---

## Verification

After all tasks are complete:

- [ ] Run full test suite: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test --no-coverage`
- [ ] Run typecheck: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
- [ ] Run lint: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm lint`
