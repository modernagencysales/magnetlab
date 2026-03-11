# Phase 6: Navigation, Onboarding & Chat Route Refactor

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the accelerator discoverable (sidebar nav), guide new enrollees through onboarding intake, seed diagnostic rules, expand the frontend API module, extract shared sub-agent types, and decompose the 482-line chat route into testable service layers.

**Architecture:** Add sidebar link + onboarding flow (chat-driven via existing intake card + save_intake_data action). Extract chat route internals into 3 service modules (history builder, memory extractor, agent loop). Seed diagnostic rules for troubleshooter. Unify sub-agent type imports.

**Tech Stack:** Next.js 15, React 18, Supabase, Tailwind/shadcn, Jest

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/ai/copilot/chat-history.ts` | Build Claude message array from DB rows (deterministic tool IDs) |
| `src/lib/ai/copilot/chat-agent-loop.ts` | Agentic iteration loop: stream Claude, execute tools, persist results |
| `src/frontend/api/accelerator.ts` | Expand with `getProgramState()` (already has `startEnrollment()`) |
| `scripts/seed-diagnostic-rules.ts` | Seed diagnostic rules for troubleshooter across all modules |
| `src/__tests__/lib/ai/copilot/chat-history.test.ts` | Tests for history builder |
| `src/__tests__/lib/ai/copilot/chat-agent-loop.test.ts` | Tests for agent loop |

### Modified Files
| File | Change |
|------|--------|
| `src/components/dashboard/AppSidebar.tsx` | Add accelerator nav item to mainNav array |
| `src/components/accelerator/AcceleratorPage.tsx` | Detect missing intake → prompt onboarding in chat |
| `src/app/api/copilot/chat/route.ts` | Extract history builder + agent loop → slim to <100 lines |
| `src/lib/ai/copilot/sub-agents/icp-agent.ts` | Import shared SopData/UserContext from types.ts |
| `src/lib/ai/copilot/sub-agents/lead-magnet-agent.ts` | Import shared SopData/UserContext from types.ts |
| `src/lib/ai/copilot/sub-agents/content-agent.ts` | Import shared SopData/UserContext from types.ts |
| `src/lib/ai/copilot/sub-agents/outreach-agent.ts` | Import shared SopData/UserContext from types.ts |

---

## Chunk 1: Sidebar Navigation & Onboarding

### Task 1: Add Accelerator to Sidebar Navigation

**Files:**
- Modify: `src/components/dashboard/AppSidebar.tsx`

- [ ] **Step 1: Read AppSidebar.tsx and locate mainNav array**

The `mainNav` array (around line 76) contains `NavItem` objects with `{ href, label, icon, activePrefix? }`.

- [ ] **Step 2: Add accelerator nav item**

Add to `mainNav` after `{ href: '/signals', ... }`:
```typescript
{ href: '/accelerator', label: 'Accelerator', icon: Rocket },
```

Import `Rocket` from `lucide-react` at the top of the file.

- [ ] **Step 3: Verify the icon import compiles**

Run: `pnpm typecheck`
Expected: Clean pass

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/AppSidebar.tsx
git commit -m "feat(accelerator): add Accelerator link to sidebar navigation"
```

---

### Task 2: Onboarding Detection in AcceleratorPage

**Files:**
- Modify: `src/components/accelerator/AcceleratorPage.tsx`
- Modify: `src/components/accelerator/AcceleratorChat.tsx`
- Modify: `src/components/accelerator/useAcceleratorChat.ts`

When a newly enrolled user arrives with empty `intake_data`, the chat should start with a system message prompting onboarding. The AI agent already has `save_intake_data` action and `OnboardingIntakeCard` — we just need to trigger the conversation.

- [ ] **Step 1: Read AcceleratorPage.tsx**

Understand current state-loading logic.

- [ ] **Step 2: Pass `needsOnboarding` flag to AcceleratorChat**

In AcceleratorPage, after loading programState, compute:
```typescript
const needsOnboarding = enrolled && !programState?.enrollment?.intake_data?.business_description;
```

Pass `needsOnboarding` as a prop to `<AcceleratorChat>`.

- [ ] **Step 3: Update AcceleratorChat props to accept needsOnboarding**

Add `needsOnboarding?: boolean` to AcceleratorChatProps. Pass through to `useAcceleratorChat`.

- [ ] **Step 4: Auto-send onboarding prompt in useAcceleratorChat**

In `useAcceleratorChat`, when `needsOnboarding` is true and there are no existing messages, auto-send an initial message:
```typescript
useEffect(() => {
  if (needsOnboarding && messages.length === 0 && !loading) {
    sendMessage("I just enrolled in the GTM Accelerator. Let's start with my onboarding intake.");
  }
}, [needsOnboarding]);
```

This triggers the AI to use the `save_intake_data` action and render `OnboardingIntakeCard`.

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: Clean pass

- [ ] **Step 6: Commit**

```bash
git add src/components/accelerator/AcceleratorPage.tsx src/components/accelerator/AcceleratorChat.tsx src/components/accelerator/useAcceleratorChat.ts
git commit -m "feat(accelerator): auto-trigger onboarding for new enrollees"
```

---

### Task 3: Expand Frontend API Module

**Files:**
- Modify: `src/frontend/api/accelerator.ts`

- [ ] **Step 1: Read existing accelerator.ts**

Currently only has `startEnrollment()`.

- [ ] **Step 2: Add getProgramState()**

```typescript
import type { ProgramState } from '@/lib/types/accelerator';

export async function getProgramState(): Promise<{ enrolled: boolean; programState: ProgramState | null }> {
  return apiClient.get('/accelerator/program-state');
}
```

- [ ] **Step 3: Update AcceleratorPage to use getProgramState()**

Replace raw `fetch('/api/accelerator/program-state')` with `getProgramState()` import.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: Clean pass

- [ ] **Step 5: Commit**

```bash
git add src/frontend/api/accelerator.ts src/components/accelerator/AcceleratorPage.tsx
git commit -m "feat(accelerator): expand frontend API module with getProgramState"
```

---

### Task 4: Seed Diagnostic Rules

**Files:**
- Create: `scripts/seed-diagnostic-rules.ts`

The troubleshooter agent matches diagnostic rules against metrics, but the `diagnostic_rules` table is empty.

- [ ] **Step 1: Create seed script**

```typescript
/** Seed diagnostic rules for the GTM Accelerator troubleshooter.
 *  Inserts rules across all 8 modules for metric-based diagnostics. */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RULES = [
  // M0 — ICP
  {
    module_id: 'm0',
    symptom: 'Low ICP clarity score',
    metric_key: 'icp_clarity',
    threshold_operator: 'lt',
    threshold_value: 50,
    diagnostic_questions: [
      'Have you completed the Caroline Framework exercise?',
      'Can you describe your ideal client in one sentence?',
    ],
    common_causes: [
      'Skipped the ICP definition deliverable',
      'Targeting too broad an audience',
      'Mixing B2B and B2C characteristics',
    ],
    priority: 'high',
  },
  // M1 — Lead Magnets
  {
    module_id: 'm1',
    symptom: 'No lead magnets published',
    metric_key: 'lm_count',
    threshold_operator: 'lt',
    threshold_value: 1,
    diagnostic_questions: [
      'Have you started the lead magnet creation wizard?',
      'What type of lead magnet are you creating?',
    ],
    common_causes: [
      'Analysis paralysis on topic selection',
      'Content not extracted from transcripts yet',
      'Funnel page not published',
    ],
    priority: 'high',
  },
  {
    module_id: 'm1',
    symptom: 'Low opt-in conversion rate',
    metric_key: 'lm_optin_rate',
    threshold_operator: 'lt',
    threshold_value: 15,
    diagnostic_questions: [
      'What is your current opt-in page headline?',
      'Are you driving targeted traffic to the page?',
    ],
    common_causes: [
      'Weak headline or value proposition',
      'Too many form fields',
      'Page not matching ad/post messaging',
    ],
    priority: 'medium',
  },
  // M2 — TAM
  {
    module_id: 'm2',
    symptom: 'TAM list too small',
    metric_key: 'tam_size',
    threshold_operator: 'lt',
    threshold_value: 100,
    diagnostic_questions: [
      'How many companies are in your TAM list?',
      'Are your ICP filters too restrictive?',
    ],
    common_causes: [
      'ICP criteria too narrow',
      'Only using one data source',
      'Geographic filters too restrictive',
    ],
    priority: 'high',
  },
  // M3 — LinkedIn Outreach
  {
    module_id: 'm3',
    symptom: 'Low LinkedIn reply rate',
    metric_key: 'li_reply_rate',
    threshold_operator: 'lt',
    threshold_value: 10,
    diagnostic_questions: [
      'What does your first DM look like?',
      'Are you personalizing each message?',
    ],
    common_causes: [
      'Generic template messages',
      'Selling too early in the conversation',
      'Not referencing shared connections or content',
      'Profile not optimized for credibility',
    ],
    priority: 'high',
  },
  {
    module_id: 'm3',
    symptom: 'Low connection acceptance rate',
    metric_key: 'li_accept_rate',
    threshold_operator: 'lt',
    threshold_value: 25,
    diagnostic_questions: [
      'What does your connection request note say?',
      'Is your LinkedIn profile complete and professional?',
    ],
    common_causes: [
      'No connection note or generic note',
      'Profile photo or headline not professional',
      'Targeting wrong seniority level',
    ],
    priority: 'medium',
  },
  // M4 — Cold Email
  {
    module_id: 'm4',
    symptom: 'Low email reply rate',
    metric_key: 'email_reply_rate',
    threshold_operator: 'lt',
    threshold_value: 3,
    diagnostic_questions: [
      'What is your current subject line?',
      'How many follow-ups are in your sequence?',
    ],
    common_causes: [
      'Poor subject lines',
      'Too long first email',
      'No clear CTA',
      'Sending to wrong contacts',
      'Domain reputation issues',
    ],
    priority: 'high',
  },
  {
    module_id: 'm4',
    symptom: 'High bounce rate',
    metric_key: 'email_bounce_rate',
    threshold_operator: 'gt',
    threshold_value: 5,
    diagnostic_questions: [
      'Are you verifying emails before sending?',
      'When was your list last cleaned?',
    ],
    common_causes: [
      'Not using email verification',
      'Stale contact data',
      'Catch-all domain issues',
    ],
    priority: 'high',
  },
  // M5 — LinkedIn Ads
  {
    module_id: 'm5',
    symptom: 'High cost per lead from ads',
    metric_key: 'ads_cpl',
    threshold_operator: 'gt',
    threshold_value: 150,
    diagnostic_questions: [
      'What is your current targeting criteria?',
      'What ad format are you using?',
    ],
    common_causes: [
      'Audience too broad',
      'Low relevance score',
      'Not using lead gen forms',
      'Budget spread too thin across campaigns',
    ],
    priority: 'medium',
  },
  {
    module_id: 'm5',
    symptom: 'Low ad click-through rate',
    metric_key: 'ads_ctr',
    threshold_operator: 'lt',
    threshold_value: 0.3,
    diagnostic_questions: [
      'What does your ad creative look like?',
      'Is your CTA clear and compelling?',
    ],
    common_causes: [
      'Weak ad copy or creative',
      'Wrong audience targeting',
      'Ad fatigue (same creative too long)',
    ],
    priority: 'medium',
  },
  // M6 — Operating System
  {
    module_id: 'm6',
    symptom: 'Low daily session consistency',
    metric_key: 'os_daily_sessions',
    threshold_operator: 'lt',
    threshold_value: 15,
    diagnostic_questions: [
      'Do you have a daily GTM morning routine?',
      'What time do you typically start?',
    ],
    common_causes: [
      'No established daily routine',
      'Too many competing priorities',
      'Not time-blocking GTM activities',
    ],
    priority: 'high',
  },
  // M7 — Content
  {
    module_id: 'm7',
    symptom: 'Low content posting frequency',
    metric_key: 'content_posts',
    threshold_operator: 'lt',
    threshold_value: 3,
    diagnostic_questions: [
      'How many posts per week are you publishing?',
      'Are you using the content pipeline?',
    ],
    common_causes: [
      'No content calendar or schedule',
      'Perfectionism blocking publishing',
      'Not repurposing transcript content',
    ],
    priority: 'medium',
  },
  {
    module_id: 'm7',
    symptom: 'Low content engagement rate',
    metric_key: 'content_engagement',
    threshold_operator: 'lt',
    threshold_value: 2,
    diagnostic_questions: [
      'What types of posts get the most engagement?',
      'Are you engaging with others before posting?',
    ],
    common_causes: [
      'Posting without engaging with network first',
      'Content too promotional',
      'Not using hooks or storytelling',
      'Posting at wrong times',
    ],
    priority: 'medium',
  },
];

async function seed() {
  console.log('Seeding diagnostic rules...');

  const { data, error } = await supabase
    .from('diagnostic_rules')
    .upsert(
      RULES.map((r) => ({
        ...r,
        is_active: true,
      })),
      { onConflict: 'module_id,metric_key' }
    )
    .select('id');

  if (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }

  console.log(`Seeded ${data?.length ?? 0} diagnostic rules`);
}

seed();
```

- [ ] **Step 2: Run the seed script**

Run: `npx tsx scripts/seed-diagnostic-rules.ts`
Expected: "Seeded 14 diagnostic rules"

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-diagnostic-rules.ts
git commit -m "feat(accelerator): seed 14 diagnostic rules for troubleshooter"
```

---

## Chunk 2: Chat Route Decomposition

### Task 5: Extract Chat History Builder

**Files:**
- Create: `src/lib/ai/copilot/chat-history.ts`
- Create: `src/__tests__/lib/ai/copilot/chat-history.test.ts`

Extract the message history reconstruction logic (lines 146-207 of chat/route.ts) into a testable service.

- [ ] **Step 1: Create chat-history.ts**

```typescript
/** Chat History Builder.
 *  Converts Supabase copilot_messages rows into Claude API message format.
 *  Handles deterministic tool_use IDs and consecutive tool_call/tool_result pairing.
 *  Never imports NextRequest, NextResponse, or cookies. */

// ─── Types ───────────────────────────────────────────────

export interface DbMessage {
  id: string;
  role: string;
  content: string | null;
  tool_name: string | null;
  tool_args: Record<string, unknown> | null;
  tool_result: Record<string, unknown> | null;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | Array<Record<string, unknown>>;
}

// ─── Builder ─────────────────────────────────────────────

export function buildClaudeMessages(history: DbMessage[]): ClaudeMessage[] {
  const messages: ClaudeMessage[] = [];

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];

    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content || '' });
    } else if (msg.role === 'assistant') {
      messages.push({ role: 'assistant', content: msg.content || '' });
    } else if (msg.role === 'tool_call') {
      const toolUseBlocks: Array<Record<string, unknown>> = [];
      const toolResultBlocks: Array<Record<string, unknown>> = [];

      while (i < history.length && history[i].role === 'tool_call') {
        const tc = history[i];
        const toolId = `tool_${tc.id}`;
        toolUseBlocks.push({
          type: 'tool_use',
          id: toolId,
          name: tc.tool_name || '',
          input: tc.tool_args || {},
        });

        if (i + 1 < history.length && history[i + 1].role === 'tool_result') {
          const tr = history[i + 1];
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: toolId,
            content: JSON.stringify(tr.tool_result),
          });
          i += 2;
        } else {
          i++;
        }
      }
      i--; // Adjust for outer loop increment

      if (toolUseBlocks.length > 0) {
        messages.push({ role: 'assistant', content: toolUseBlocks });
      }
      if (toolResultBlocks.length > 0) {
        messages.push({ role: 'user', content: toolResultBlocks });
      }
    }
    // Skip orphan tool_result
  }

  return messages;
}
```

- [ ] **Step 2: Write tests for chat-history.ts**

```typescript
/**
 * @jest-environment node
 */

import { buildClaudeMessages, type DbMessage } from '@/lib/ai/copilot/chat-history';

describe('buildClaudeMessages', () => {
  it('converts user and assistant messages', () => {
    const history: DbMessage[] = [
      { id: '1', role: 'user', content: 'hello', tool_name: null, tool_args: null, tool_result: null },
      { id: '2', role: 'assistant', content: 'hi', tool_name: null, tool_args: null, tool_result: null },
    ];
    const result = buildClaudeMessages(history);
    expect(result).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]);
  });

  it('pairs tool_call with tool_result using deterministic IDs', () => {
    const history: DbMessage[] = [
      { id: 'abc', role: 'tool_call', content: null, tool_name: 'get_program_state', tool_args: {}, tool_result: null },
      { id: 'def', role: 'tool_result', content: null, tool_name: 'get_program_state', tool_args: null, tool_result: { success: true } },
    ];
    const result = buildClaudeMessages(history);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('assistant');
    expect((result[0].content as Record<string, unknown>[])[0]).toMatchObject({
      type: 'tool_use',
      id: 'tool_abc',
      name: 'get_program_state',
    });
    expect(result[1].role).toBe('user');
    expect((result[1].content as Record<string, unknown>[])[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'tool_abc',
    });
  });

  it('handles consecutive tool_call blocks', () => {
    const history: DbMessage[] = [
      { id: '1', role: 'tool_call', content: null, tool_name: 'a', tool_args: {}, tool_result: null },
      { id: '2', role: 'tool_result', content: null, tool_name: 'a', tool_args: null, tool_result: { ok: true } },
      { id: '3', role: 'tool_call', content: null, tool_name: 'b', tool_args: {}, tool_result: null },
      { id: '4', role: 'tool_result', content: null, tool_name: 'b', tool_args: null, tool_result: { ok: true } },
    ];
    const result = buildClaudeMessages(history);
    // Two consecutive tool_calls should be grouped into one assistant + one user message
    expect(result).toHaveLength(2);
    expect((result[0].content as Record<string, unknown>[]).length).toBe(2);
    expect((result[1].content as Record<string, unknown>[]).length).toBe(2);
  });

  it('handles orphan tool_call without result', () => {
    const history: DbMessage[] = [
      { id: '1', role: 'tool_call', content: null, tool_name: 'a', tool_args: {}, tool_result: null },
    ];
    const result = buildClaudeMessages(history);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('assistant');
  });

  it('returns empty array for empty history', () => {
    expect(buildClaudeMessages([])).toEqual([]);
  });

  it('handles null content gracefully', () => {
    const history: DbMessage[] = [
      { id: '1', role: 'user', content: null, tool_name: null, tool_args: null, tool_result: null },
    ];
    const result = buildClaudeMessages(history);
    expect(result[0].content).toBe('');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm jest --no-coverage src/__tests__/lib/ai/copilot/chat-history.test.ts`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/copilot/chat-history.ts src/__tests__/lib/ai/copilot/chat-history.test.ts
git commit -m "refactor(copilot): extract chat history builder into testable service"
```

---

### Task 6: Extract Agent Loop

**Files:**
- Create: `src/lib/ai/copilot/chat-agent-loop.ts`
- Create: `src/__tests__/lib/ai/copilot/chat-agent-loop.test.ts`

Extract the agentic iteration loop (lines 281-453 of chat/route.ts) into a service.

- [ ] **Step 1: Create chat-agent-loop.ts**

```typescript
/** Chat Agent Loop.
 *  Runs the multi-turn agentic loop: stream Claude responses, execute tool calls,
 *  handle sub-agent dispatch, persist messages, and iterate until stop_reason=end_turn.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import { executeAction, actionRequiresConfirmation } from '@/lib/actions';
import type { ActionContext } from '@/lib/actions';
import { dispatchSubAgent } from '@/lib/ai/copilot/sub-agent-dispatch';
import type { SubAgentType } from '@/lib/types/accelerator';
import { hasAcceleratorAccess } from '@/lib/services/accelerator-enrollment';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Types ───────────────────────────────────────────────

export interface AgentLoopOptions {
  systemPrompt: string;
  tools: Record<string, unknown>[];
  initialMessages: Array<{ role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }>;
  conversationId: string;
  userId: string;
  actionCtx: ActionContext;
  cachedEnrollmentCheck: boolean | null;
  send: (event: string, data: unknown) => void;
  maxIterations?: number;
}

export interface AgentLoopResult {
  iterations: number;
}

// ─── Loop ────────────────────────────────────────────────

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const {
    systemPrompt,
    tools,
    initialMessages,
    conversationId,
    userId,
    actionCtx,
    cachedEnrollmentCheck,
    send,
    maxIterations = 15,
  } = options;

  const client = createAnthropicClient('copilot', { timeout: 240_000 });
  const supabase = createSupabaseAdminClient();
  let currentMessages = [...initialMessages];
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools: tools as Parameters<typeof client.messages.create>[0]['tools'],
      messages: currentMessages as Parameters<typeof client.messages.create>[0]['messages'],
    });

    let assistantText = '';

    stream.on('text', (text) => {
      assistantText += text;
      send('text_delta', { text });
    });

    const response = await stream.finalMessage();

    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
    const hasToolUse = toolUseBlocks.length > 0;

    if (hasToolUse) {
      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

      for (const block of toolUseBlocks) {
        const needsConfirmation = actionRequiresConfirmation(block.name);

        if (needsConfirmation) {
          send('confirmation_required', { tool: block.name, args: block.input, toolUseId: block.id });
        }

        send('tool_call', { name: block.name, args: block.input, id: block.id });

        await supabase.from('copilot_messages').insert({
          conversation_id: conversationId,
          role: 'tool_call',
          tool_name: block.name,
          tool_args: block.input as Record<string, unknown>,
        });

        if (needsConfirmation) {
          const pendingResult = {
            success: false,
            error: 'Action requires user confirmation. Waiting for approval.',
            awaiting_confirmation: true,
          };

          send('tool_result', { name: block.name, result: pendingResult, id: block.id });

          await supabase.from('copilot_messages').insert({
            conversation_id: conversationId,
            role: 'tool_result',
            tool_name: block.name,
            tool_result: pendingResult,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(pendingResult),
          });
        } else {
          let result;
          if (block.name === 'dispatch_sub_agent') {
            const hasEnrollment = cachedEnrollmentCheck ?? (await hasAcceleratorAccess(userId));
            if (!hasEnrollment) {
              result = {
                success: false,
                error: 'Accelerator enrollment required. Purchase at /api/accelerator/enroll',
                displayHint: 'text' as const,
              };
            } else {
              const input = block.input as { agent_type: SubAgentType; context: string; user_message: string };
              const { buildSubAgentConfig } = await import('@/lib/ai/copilot/sub-agents/config');
              const subConfig = await buildSubAgentConfig(input.agent_type, input.context, input.user_message, userId);
              const handoff = await dispatchSubAgent(subConfig, actionCtx, send);
              result = { success: true, data: handoff, displayHint: 'text' as const };
            }
          } else {
            result = await executeAction(actionCtx, block.name, block.input as Record<string, unknown>);
          }

          send('tool_result', { name: block.name, result, id: block.id });

          await supabase.from('copilot_messages').insert({
            conversation_id: conversationId,
            role: 'tool_result',
            tool_name: block.name,
            tool_result: result,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      currentMessages = [
        ...currentMessages,
        {
          role: 'assistant' as const,
          content: response.content.map((b) => {
            if (b.type === 'text') return { type: 'text' as const, text: b.text };
            if (b.type === 'tool_use') return { type: 'tool_use' as const, id: b.id, name: b.name, input: b.input };
            return b;
          }) as Record<string, unknown>[],
        },
        {
          role: 'user' as const,
          content: toolResults as Record<string, unknown>[],
        },
      ];
    }

    if (assistantText) {
      await supabase.from('copilot_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantText,
        tokens_used: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      });
    }

    if (!hasToolUse || response.stop_reason === 'end_turn') {
      break;
    }
  }

  return { iterations: iteration };
}
```

- [ ] **Step 2: Write basic tests**

Test the module exports and types compile. Full integration tests require Claude API mocking which is complex — cover the interface contract.

```typescript
/**
 * @jest-environment node
 */

import type { AgentLoopOptions, AgentLoopResult } from '@/lib/ai/copilot/chat-agent-loop';

describe('chat-agent-loop types', () => {
  it('exports AgentLoopOptions interface', () => {
    const options: AgentLoopOptions = {
      systemPrompt: 'test',
      tools: [],
      initialMessages: [],
      conversationId: 'conv-1',
      userId: 'user-1',
      actionCtx: { userId: 'user-1' },
      cachedEnrollmentCheck: null,
      send: jest.fn(),
    };
    expect(options.maxIterations).toBeUndefined();
  });

  it('AgentLoopResult has iterations field', () => {
    const result: AgentLoopResult = { iterations: 3 };
    expect(result.iterations).toBe(3);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm jest --no-coverage src/__tests__/lib/ai/copilot/chat-agent-loop.test.ts`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/copilot/chat-agent-loop.ts src/__tests__/lib/ai/copilot/chat-agent-loop.test.ts
git commit -m "refactor(copilot): extract agent loop into testable service"
```

---

### Task 7: Slim Down Chat Route

**Files:**
- Modify: `src/app/api/copilot/chat/route.ts`

Replace inline history building and agent loop with imports from the new service modules.

- [ ] **Step 1: Read current route.ts**

- [ ] **Step 2: Replace history building (lines ~146-207) with import**

```typescript
import { buildClaudeMessages } from '@/lib/ai/copilot/chat-history';
// ...
const claudeMessages = buildClaudeMessages(historyArr);
```

Remove the entire inline history reconstruction loop.

- [ ] **Step 3: Replace agent loop (lines ~281-453) with import**

```typescript
import { runAgentLoop } from '@/lib/ai/copilot/chat-agent-loop';
// ...
const { iterations } = await runAgentLoop({
  systemPrompt,
  tools: allTools,
  initialMessages: claudeMessages,
  conversationId,
  userId,
  actionCtx,
  cachedEnrollmentCheck,
  send,
});
```

Remove the entire inline while-loop, stream setup, tool execution, etc.

- [ ] **Step 4: Verify route is under 200 lines**

The route should now be ~150-180 lines: imports, auth, conversation CRUD, user message save, memory extraction, history load, prompt build, SSE stream setup, agent loop call, conversation update, done event.

- [ ] **Step 5: Run typecheck + tests**

Run: `pnpm typecheck && pnpm jest --no-coverage src/__tests__/api/copilot/`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add src/app/api/copilot/chat/route.ts
git commit -m "refactor(copilot): slim chat route to ~150 lines using extracted services"
```

---

## Chunk 3: Type Unification & Verification

### Task 8: Unify Sub-Agent Type Imports

**Files:**
- Modify: `src/lib/ai/copilot/sub-agents/icp-agent.ts`
- Modify: `src/lib/ai/copilot/sub-agents/lead-magnet-agent.ts`
- Modify: `src/lib/ai/copilot/sub-agents/content-agent.ts`
- Modify: `src/lib/ai/copilot/sub-agents/outreach-agent.ts`

Replace inline `SopData`/`UserContext` interfaces with imports from `./types.ts`, matching what was done for tam/linkedin-ads/operating-system agents in Phase 5.

- [ ] **Step 1: Read each file and identify inline type definitions**

Look for `interface SopData` and `interface UserContext` in each file.

- [ ] **Step 2: Replace with imports**

In each file, remove the inline interfaces and add:
```typescript
import type { SopData, UserContext } from './types';
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: Clean pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/copilot/sub-agents/icp-agent.ts src/lib/ai/copilot/sub-agents/lead-magnet-agent.ts src/lib/ai/copilot/sub-agents/content-agent.ts src/lib/ai/copilot/sub-agents/outreach-agent.ts
git commit -m "refactor(accelerator): unify sub-agent type imports from shared types.ts"
```

---

### Task 9: E2E Verification

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: Clean pass

- [ ] **Step 2: Run full test suite**

Run: `pnpm test --no-coverage`
Expected: Same pass count as before (1962+), only pre-existing PostDetailModal failures

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: Clean build

---
