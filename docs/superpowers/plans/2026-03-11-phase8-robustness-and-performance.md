# Phase 8: Robustness & Performance

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken funnel metrics collection, optimize usage/metrics queries to use DB aggregation instead of loading all rows into memory, add the missing Stripe webhook integration test, and further decompose the chat route.

**Architecture:** Replace client-side `.filter()` counting with PostgreSQL `GROUP BY` aggregation. Fix M1 metrics to compute views/conversions from `page_views` and `funnel_leads` tables instead of non-existent columns on `funnel_pages`. Extract conversation management and tool setup from chat route into services. Add integration test for accelerator payment webhook flow.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL), Jest, Trigger.dev

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/ai/copilot/chat-conversation.ts` | Conversation CRUD: lookup/create, save user message, update timestamp |
| `src/lib/ai/copilot/chat-tools.ts` | Tool definitions assembly: base tools + sub-agent dispatch tool |
| `src/__tests__/lib/ai/copilot/chat-conversation.test.ts` | Tests for conversation service |
| `src/__tests__/lib/ai/copilot/chat-tools.test.ts` | Tests for tool assembly |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/services/accelerator-usage.ts` | Replace client-side `.filter()` with `GROUP BY` query |
| `src/lib/services/accelerator-program.ts` | Replace `getUsageThisPeriod` with call to usage service |
| `src/lib/services/accelerator-metrics.ts` | Replace limit-50 dedup with `DISTINCT ON` RPC or increased limit |
| `src/trigger/accelerator-collect-metrics.ts` | Fix M1 metrics to use `page_views` + `funnel_leads` tables |
| `src/app/api/copilot/chat/route.ts` | Extract conversation CRUD + tool setup to new services |
| `src/__tests__/api/stripe/webhook.test.ts` | Add accelerator payment webhook test |
| `src/__tests__/lib/services/accelerator-usage.test.ts` | Update tests for new query pattern |
| `src/__tests__/lib/services/accelerator-metrics.test.ts` | Update tests for new dedup pattern |

---

## Chunk 1: Fix Broken Metrics & Performance

### Task 1: Fix M1 Funnel Metrics Collection (CRITICAL)

The `funnel_pages` table does NOT have `views` or `conversions` columns. The current code selects non-existent columns, causing a PostgREST 400 error that silently fails.

Views must be computed from `page_views` table. Conversions must be computed from `funnel_leads` table.

**Files:**
- Modify: `src/trigger/accelerator-collect-metrics.ts`
- Test: Manual verification (Trigger.dev task — runs in cloud)

- [ ] **Step 1: Read the current file**

Read `src/trigger/accelerator-collect-metrics.ts` to understand the full context.

- [ ] **Step 2: Replace the M1 funnel metrics section**

Find the section that queries `funnel_pages` with `.select('id, views, conversions')` and replace it with:

```typescript
// ─── Funnel Metrics (M1) ────────────────────────
if (enrollment.selected_modules.includes('m1')) {
  try {
    // Get published funnel page IDs for this user
    const { data: funnels } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('user_id', enrollment.user_id)
      .not('published_at', 'is', null);

    if (funnels && funnels.length > 0) {
      const funnelIds = funnels.map((f: { id: string }) => f.id);

      // Count views from page_views table
      const { count: viewCount } = await supabase
        .from('page_views')
        .select('id', { count: 'exact', head: true })
        .in('funnel_page_id', funnelIds);

      // Count conversions from funnel_leads table
      const { count: leadCount } = await supabase
        .from('funnel_leads')
        .select('id', { count: 'exact', head: true })
        .in('funnel_page_id', funnelIds);

      const totalViews = viewCount || 0;
      const totalConversions = leadCount || 0;

      metrics.push(
        {
          module_id: 'm1',
          metric_key: 'funnel_page_views',
          value: totalViews,
          source: 'magnetlab',
        },
        {
          module_id: 'm1',
          metric_key: 'funnel_opt_in_rate',
          value: totalViews > 0 ? (totalConversions / totalViews) * 100 : 0,
          source: 'magnetlab',
        }
      );
    }
  } catch (err) {
    logger.error('Failed to collect funnel metrics', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add src/trigger/accelerator-collect-metrics.ts
git commit -m "fix(accelerator): compute M1 funnel metrics from page_views + funnel_leads tables"
```

---

### Task 2: Optimize Usage Counting with DB Aggregation

Replace client-side `.filter()` counting with a single `GROUP BY` query.

**Files:**
- Modify: `src/lib/services/accelerator-usage.ts`
- Modify: `src/__tests__/lib/services/accelerator-usage.test.ts` (if exists)

- [ ] **Step 1: Read accelerator-usage.ts**

- [ ] **Step 2: Replace checkUsageAllocation with aggregated query**

Replace the current implementation that fetches all event_type rows and filters in JS with:

```typescript
export async function checkUsageAllocation(
  enrollmentId: string
): Promise<{
  withinLimits: boolean;
  usage: Record<string, number>;
  limits: Record<string, number>;
}> {
  const supabase = getSupabaseAdminClient();
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  // Use RPC or raw count queries grouped by event_type
  // Supabase JS client doesn't support GROUP BY directly,
  // so we use three parallel count queries
  const [sessions, deliverables, apiCalls] = await Promise.all([
    supabase
      .from('program_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('event_type', 'session_start')
      .gte('created_at', periodStart.toISOString()),
    supabase
      .from('program_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('event_type', 'deliverable_created')
      .gte('created_at', periodStart.toISOString()),
    supabase
      .from('program_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('event_type', 'api_call')
      .gte('created_at', periodStart.toISOString()),
  ]);

  const usage = {
    sessions: sessions.count || 0,
    deliverables: deliverables.count || 0,
    api_calls: apiCalls.count || 0,
  };

  const withinLimits =
    usage.sessions <= DEFAULT_MONTHLY_ALLOCATION.sessions &&
    usage.deliverables <= DEFAULT_MONTHLY_ALLOCATION.deliverables;

  return { withinLimits, usage, limits: DEFAULT_MONTHLY_ALLOCATION };
}
```

- [ ] **Step 3: Update tests if they mock the old query pattern**

The test mocks should now mock three `.select('id', { count: 'exact', head: true })` calls with `.eq('event_type', ...)` instead of a single `.select('event_type')` call.

- [ ] **Step 4: Run tests**

Run: `pnpm jest --no-coverage src/__tests__/lib/services/accelerator-usage`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/accelerator-usage.ts src/__tests__/lib/services/accelerator-usage.test.ts
git commit -m "perf(accelerator): use DB count queries instead of loading all usage events"
```

---

### Task 3: Deduplicate getUsageThisPeriod in accelerator-program.ts

`accelerator-program.ts` has its own inline usage counting logic that duplicates `accelerator-usage.ts`. Replace it with a call to the usage service.

**Files:**
- Modify: `src/lib/services/accelerator-program.ts`

- [ ] **Step 1: Read accelerator-program.ts, find getUsageThisPeriod or similar**

Look for any function that queries `program_usage_events` and counts by `event_type`.

- [ ] **Step 2: Replace with call to checkUsageAllocation**

Import `checkUsageAllocation` from `./accelerator-usage` and delegate to it. Remove the inline counting logic.

- [ ] **Step 3: Run typecheck + tests**

Run: `pnpm typecheck && pnpm jest --no-coverage src/__tests__/lib/services/accelerator-program`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/accelerator-program.ts
git commit -m "refactor(accelerator): deduplicate usage counting — delegate to usage service"
```

---

### Task 4: Fix Metrics Deduplication Limit

Replace the limit-50 client-side dedup with a proper approach that handles any number of metric keys.

**Files:**
- Modify: `src/lib/services/accelerator-metrics.ts`
- Modify: `src/__tests__/lib/services/accelerator-metrics.test.ts`

- [ ] **Step 1: Read getLatestMetrics in accelerator-metrics.ts**

- [ ] **Step 2: Increase limit and add proper dedup**

The simplest fix is to increase the limit to cover all possible metric keys with headroom. With 20 metric keys and daily collection, 200 rows covers 10 days. Alternatively, use a two-pass approach.

Replace the current `getLatestMetrics` with:

```typescript
export async function getLatestMetrics(enrollmentId: string): Promise<ProgramMetric[]> {
  const supabase = getSupabaseAdminClient();

  // Fetch enough rows to cover all metric keys (20 keys × 10 days of daily collection = 200)
  const { data, error } = await supabase
    .from('program_metrics')
    .select(METRIC_COLUMNS)
    .eq('enrollment_id', enrollmentId)
    .order('collected_at', { ascending: false })
    .limit(200);

  if (error) {
    logError(LOG_CTX, error, { enrollmentId });
    return [];
  }

  // Deduplicate: keep only the latest per metric_key
  const seen = new Set<string>();
  const latest: ProgramMetric[] = [];
  for (const row of data || []) {
    if (!seen.has(row.metric_key)) {
      seen.add(row.metric_key);
      latest.push(row);
    }
  }
  return latest;
}
```

- [ ] **Step 3: Update test if it asserts on limit value**

- [ ] **Step 4: Run tests**

Run: `pnpm jest --no-coverage src/__tests__/lib/services/accelerator-metrics`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/accelerator-metrics.ts src/__tests__/lib/services/accelerator-metrics.test.ts
git commit -m "perf(accelerator): increase metrics dedup limit from 50 to 200 rows"
```

---

## Chunk 2: Stripe Webhook Test & Chat Route Decomposition

### Task 5: Add Stripe Webhook Integration Test for Accelerator Payment

**Files:**
- Modify: `src/__tests__/api/stripe/webhook.test.ts`

- [ ] **Step 1: Read the existing webhook test file**

Read `src/__tests__/api/stripe/webhook.test.ts` to understand the test patterns and mocks.

- [ ] **Step 2: Add accelerator payment test**

Add a new test case inside the existing describe block, after the subscription tests:

```typescript
it('creates accelerator enrollment on one-time payment checkout', async () => {
  const mockEvent = {
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'payment',
        metadata: {
          product: 'accelerator',
          userId: 'user-123',
        },
        customer: 'cus_test_123',
        payment_intent: 'pi_test_456',
      },
    },
  };

  // Mock stripe.webhooks.constructEvent to return our event
  mockConstructEvent.mockReturnValue(mockEvent);

  const response = await POST(
    new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: JSON.stringify(mockEvent),
      headers: { 'stripe-signature': 'valid-sig' },
    })
  );

  expect(response.status).toBe(200);
  expect(mockCreatePaidEnrollment).toHaveBeenCalledWith(
    'user-123',
    'cus_test_123',
    'pi_test_456'
  );
});

it('skips enrollment when metadata.product is not accelerator', async () => {
  const mockEvent = {
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'payment',
        metadata: { product: 'other', userId: 'user-123' },
        customer: 'cus_test',
        payment_intent: 'pi_test',
      },
    },
  };

  mockConstructEvent.mockReturnValue(mockEvent);

  const response = await POST(
    new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: JSON.stringify(mockEvent),
      headers: { 'stripe-signature': 'valid-sig' },
    })
  );

  expect(response.status).toBe(200);
  expect(mockCreatePaidEnrollment).not.toHaveBeenCalled();
});
```

You will need to add a mock for `createPaidEnrollment` — check how the existing test mocks services and follow the same pattern. Add:

```typescript
const mockCreatePaidEnrollment = jest.fn();
jest.mock('@/lib/services/accelerator-enrollment', () => ({
  createPaidEnrollment: (...args: unknown[]) => mockCreatePaidEnrollment(...args),
}));
```

- [ ] **Step 3: Run tests**

Run: `pnpm jest --no-coverage src/__tests__/api/stripe/webhook`
Expected: All pass (existing + 2 new)

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/api/stripe/webhook.test.ts
git commit -m "test(accelerator): add Stripe webhook integration tests for accelerator payment"
```

---

### Task 6: Extract Conversation Service from Chat Route

**Files:**
- Create: `src/lib/ai/copilot/chat-conversation.ts`
- Create: `src/__tests__/lib/ai/copilot/chat-conversation.test.ts`

Extract conversation lookup/create and user message saving from `route.ts`.

- [ ] **Step 1: Read route.ts lines 63-106**

Understand the conversation lookup, creation, and user message save logic.

- [ ] **Step 2: Create chat-conversation.ts**

```typescript
/** Chat Conversation Service.
 *  Manages copilot conversation lifecycle: lookup, create, save messages.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Types ───────────────────────────────────────────────

export interface ConversationContext {
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
}

// ─── Conversation CRUD ───────────────────────────────────

/**
 * Verify an existing conversation belongs to the user, or create a new one.
 * Returns the conversation ID or null if verification fails.
 */
export async function getOrCreateConversation(
  userId: string,
  existingId: string | undefined,
  message: string,
  context?: ConversationContext
): Promise<{ conversationId: string } | { error: string; status: number }> {
  const supabase = createSupabaseAdminClient();

  if (existingId) {
    const { data: existing } = await supabase
      .from('copilot_conversations')
      .select('id')
      .eq('id', existingId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return { error: 'Conversation not found', status: 404 };
    }
    return { conversationId: existingId };
  }

  const { data: conv, error: convError } = await supabase
    .from('copilot_conversations')
    .insert({
      user_id: userId,
      entity_type: context?.entityType || null,
      entity_id: context?.entityId || null,
      title: message.slice(0, 100),
    })
    .select('id')
    .single();

  if (convError || !conv) {
    return { error: 'Failed to create conversation', status: 500 };
  }

  return { conversationId: conv.id };
}

/**
 * Save a user message to the conversation.
 */
export async function saveUserMessage(conversationId: string, content: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from('copilot_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content,
  });
}

/**
 * Update conversation timestamp after agent loop completes.
 */
export async function touchConversation(conversationId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('copilot_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}
```

- [ ] **Step 3: Write tests**

```typescript
/**
 * @jest-environment node
 */

import {
  getOrCreateConversation,
  saveUserMessage,
  touchConversation,
} from '@/lib/ai/copilot/chat-conversation';

// Mock Supabase
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return { eq: (...eqArgs: unknown[]) => {
          mockEq(...eqArgs);
          return { eq: (...eqArgs2: unknown[]) => {
            mockEq(...eqArgs2);
            return { single: () => mockSingle() };
          }};
        }};
      },
      insert: (...args: unknown[]) => {
        mockInsert(...args);
        return {
          select: () => ({ single: () => mockSingle() }),
        };
      },
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return { eq: () => ({ data: null, error: null }) };
      },
    }),
  }),
}));

describe('chat-conversation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns existing conversation when found', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'conv-1' }, error: null });
    const result = await getOrCreateConversation('user-1', 'conv-1', 'hello');
    expect(result).toEqual({ conversationId: 'conv-1' });
  });

  it('returns 404 when existing conversation not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });
    const result = await getOrCreateConversation('user-1', 'conv-bad', 'hello');
    expect(result).toEqual({ error: 'Conversation not found', status: 404 });
  });

  it('creates new conversation when no existingId', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'conv-new' }, error: null });
    const result = await getOrCreateConversation('user-1', undefined, 'hello');
    expect(result).toEqual({ conversationId: 'conv-new' });
  });

  it('saveUserMessage inserts a message', async () => {
    await saveUserMessage('conv-1', 'hello world');
    expect(mockInsert).toHaveBeenCalledWith({
      conversation_id: 'conv-1',
      role: 'user',
      content: 'hello world',
    });
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm jest --no-coverage src/__tests__/lib/ai/copilot/chat-conversation`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/copilot/chat-conversation.ts src/__tests__/lib/ai/copilot/chat-conversation.test.ts
git commit -m "refactor(copilot): extract conversation service from chat route"
```

---

### Task 7: Extract Tool Setup from Chat Route

**Files:**
- Create: `src/lib/ai/copilot/chat-tools.ts`
- Create: `src/__tests__/lib/ai/copilot/chat-tools.test.ts`

Extract the tool definitions assembly (base tools + dispatch_sub_agent) from the route.

- [ ] **Step 1: Read route.ts tool definition section**

Find the section that calls `getToolDefinitions()` and appends the `dispatch_sub_agent` tool definition.

- [ ] **Step 2: Create chat-tools.ts**

```typescript
/** Chat Tools Assembly.
 *  Builds the complete tool list for copilot chat: base actions + sub-agent dispatch.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getToolDefinitions } from '@/lib/actions';

// ─── Types ───────────────────────────────────────────────

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

// ─── Constants ───────────────────────────────────────────

const SUB_AGENT_DISPATCH_TOOL: ToolDefinition = {
  name: 'dispatch_sub_agent',
  description:
    'Dispatch a specialist sub-agent for deep module work. The sub-agent runs independently and returns a handoff summary.',
  input_schema: {
    type: 'object',
    properties: {
      agent_type: {
        type: 'string',
        enum: [
          'icp',
          'lead_magnet',
          'content',
          'troubleshooter',
          'tam',
          'outreach',
          'linkedin_ads',
          'operating_system',
        ],
        description: 'Which specialist to dispatch',
      },
      context: {
        type: 'string',
        description: 'Summary of what the user needs help with',
      },
      user_message: {
        type: 'string',
        description: 'The user message to forward to the sub-agent',
      },
    },
    required: ['agent_type', 'context', 'user_message'],
  },
};

// ─── Builder ─────────────────────────────────────────────

export function buildChatTools(): ToolDefinition[] {
  const baseTools = getToolDefinitions();
  return [...baseTools, SUB_AGENT_DISPATCH_TOOL];
}
```

- [ ] **Step 3: Write tests**

```typescript
/**
 * @jest-environment node
 */

jest.mock('@/lib/actions', () => ({
  getToolDefinitions: () => [
    { name: 'get_program_state', description: 'test', input_schema: {} },
  ],
}));

import { buildChatTools } from '@/lib/ai/copilot/chat-tools';

describe('buildChatTools', () => {
  it('includes base tools plus dispatch_sub_agent', () => {
    const tools = buildChatTools();
    expect(tools.length).toBeGreaterThan(1);
    expect(tools.find((t) => t.name === 'dispatch_sub_agent')).toBeDefined();
    expect(tools.find((t) => t.name === 'get_program_state')).toBeDefined();
  });

  it('dispatch_sub_agent has required schema properties', () => {
    const tools = buildChatTools();
    const dispatch = tools.find((t) => t.name === 'dispatch_sub_agent');
    const props = (dispatch?.input_schema as Record<string, unknown>).properties as Record<string, unknown>;
    expect(props).toHaveProperty('agent_type');
    expect(props).toHaveProperty('context');
    expect(props).toHaveProperty('user_message');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm jest --no-coverage src/__tests__/lib/ai/copilot/chat-tools`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/copilot/chat-tools.ts src/__tests__/lib/ai/copilot/chat-tools.test.ts
git commit -m "refactor(copilot): extract tool assembly from chat route"
```

---

### Task 8: Wire Extracted Services into Chat Route

**Files:**
- Modify: `src/app/api/copilot/chat/route.ts`

Replace inline conversation CRUD, tool setup, and message persistence with imports from the extracted services.

- [ ] **Step 1: Read the current route.ts**

- [ ] **Step 2: Replace conversation CRUD with service calls**

```typescript
import { getOrCreateConversation, saveUserMessage, touchConversation } from '@/lib/ai/copilot/chat-conversation';
import { buildChatTools } from '@/lib/ai/copilot/chat-tools';
```

Replace the inline conversation lookup/create block (lines ~63-97) with:
```typescript
const convResult = await getOrCreateConversation(userId, body.conversationId, body.message, body.pageContext);
if ('error' in convResult) {
  return new Response(JSON.stringify({ error: convResult.error }), { status: convResult.status });
}
const conversationId = convResult.conversationId;
```

Replace the user message save (lines ~99-104) with:
```typescript
await saveUserMessage(conversationId, body.message);
```

Replace tool definitions assembly with:
```typescript
const allTools = buildChatTools();
```

Replace conversation timestamp update with:
```typescript
await touchConversation(conversationId);
```

- [ ] **Step 3: Remove now-unused imports and inline code**

Remove direct Supabase conversation queries from the route. Keep the `createSupabaseAdminClient` import only if still used for other queries (history loading).

- [ ] **Step 4: Verify route is under 200 lines**

The route should now be ~160-180 lines.

- [ ] **Step 5: Run typecheck + tests**

Run: `pnpm typecheck`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add src/app/api/copilot/chat/route.ts
git commit -m "refactor(copilot): slim chat route to ~170 lines using extracted services"
```

---

## Chunk 3: Verification

### Task 9: E2E Verification

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: Clean

- [ ] **Step 2: Run full test suite**

Run: `pnpm test --no-coverage`
Expected: Same pass count as before (~1984), only pre-existing PostDetailModal failures

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: Clean build

---
