# AI Co-pilot Phase 2b: Rich Interactions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the co-pilot from a basic chat to a multi-action, richly-rendered assistant with entity-scoped conversations, confirmation dialogs, and "Apply" buttons that push output into the current page.

**Architecture:** Phase 2a built 13 actions + basic text/tool rendering + SSE streaming. Phase 2b adds ~15 more actions (lead magnets, funnels, email), rich result cards with specialized rendering per `displayHint`, a confirmation dialog for destructive actions (currently sends event but executes immediately), markdown rendering in messages, entity-scoped conversation auto-loading, and `useCopilotContext` on all major dashboard pages. The "Apply" pattern lets users push co-pilot output directly into their current editor/page.

**Tech Stack:** Next.js 15, React 18, Tailwind CSS, shadcn/ui, `react-markdown` + `remark-gfm` for markdown rendering, Supabase, Claude Sonnet via Anthropic SDK.

**Existing key files:**
- `src/lib/actions/` — registry.ts, executor.ts, types.ts, index.ts barrel + 5 action modules
- `src/components/copilot/` — CopilotProvider.tsx, CopilotSidebar.tsx, CopilotMessage.tsx, ConversationInput.tsx, CopilotShell.tsx, CopilotToggleButton.tsx, useCopilotContext.tsx
- `src/app/api/copilot/chat/route.ts` — streaming agent loop
- `src/app/api/copilot/conversations/` — CRUD + feedback routes
- `src/lib/ai/copilot/system-prompt.ts` — buildCopilotSystemPrompt()

---

### Task 1: Install react-markdown + remark-gfm

**Files:**
- Modify: `package.json`

**Step 1: Install dependencies**

Run: `npm install react-markdown remark-gfm`

**Step 2: Verify installation**

Run: `npm ls react-markdown remark-gfm`
Expected: Both packages listed with versions.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown + remark-gfm for copilot message rendering"
```

---

### Task 2: Add Markdown Rendering to CopilotMessage

**Files:**
- Modify: `src/components/copilot/CopilotMessage.tsx`
- Test: `src/__tests__/components/copilot/CopilotComponents.test.tsx`

**Step 1: Write the failing test**

Add tests to `CopilotComponents.test.tsx`:

```typescript
it('renders markdown in assistant messages', () => {
  render(<CopilotMessage message={{
    id: '1', role: 'assistant',
    content: '**bold** and *italic* text\n\n- bullet one\n- bullet two',
  }} />);
  expect(screen.getByText('bold')).toBeInTheDocument();
  // Verify it's rendered as HTML, not raw markdown
  expect(screen.getByText('bold').tagName).toBe('STRONG');
});

it('renders code blocks in assistant messages', () => {
  render(<CopilotMessage message={{
    id: '1', role: 'assistant',
    content: '```javascript\nconst x = 1;\n```',
  }} />);
  expect(screen.getByText('const x = 1;')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage src/__tests__/components/copilot/CopilotComponents.test.tsx -t "renders markdown"`
Expected: FAIL — currently renders raw text, not HTML elements.

**Step 3: Implement markdown rendering**

In `CopilotMessage.tsx`, import `ReactMarkdown` from `react-markdown` and `remarkGfm` from `remark-gfm`. Replace the plain text rendering for assistant messages with:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// In the assistant message branch:
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
    li: ({ children }) => <li className="mb-0.5">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    code: ({ children, className }) => {
      const isBlock = className?.includes('language-');
      return isBlock
        ? <pre className="bg-gray-800 text-gray-100 rounded p-2 text-xs overflow-x-auto mb-2"><code>{children}</code></pre>
        : <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">{children}</code>;
    },
    a: ({ href, children }) => <a href={href} className="text-violet-600 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
    h3: ({ children }) => <h3 className="font-semibold text-sm mt-2 mb-1">{children}</h3>,
  }}
>
  {message.content}
</ReactMarkdown>
```

Keep user messages as plain text (no markdown rendering for user input).

**Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage src/__tests__/components/copilot/CopilotComponents.test.tsx`
Expected: ALL tests PASS including new markdown tests.

**Step 5: Commit**

```bash
git add src/components/copilot/CopilotMessage.tsx src/__tests__/components/copilot/CopilotComponents.test.tsx
git commit -m "feat: add markdown rendering in copilot assistant messages"
```

---

### Task 3: Lead Magnet Actions Module

**Files:**
- Create: `src/lib/actions/lead-magnets.ts`
- Modify: `src/lib/actions/index.ts` (add import)
- Test: `src/__tests__/lib/actions/lead-magnets.test.ts`

**Step 1: Write the failing tests**

Create `src/__tests__/lib/actions/lead-magnets.test.ts` with tests for 4 actions:
- `list_lead_magnets` — returns user's lead magnets with id, title, status, archetype
- `get_lead_magnet` — returns a specific lead magnet by ID (scoped to user_id)
- `create_lead_magnet` — creates a new lead magnet (requiresConfirmation: true)
- `suggest_lead_magnet_topics` — uses AI to suggest topics based on knowledge base

Mock supabase (same pattern as `supporting.test.ts`). Mock `suggestLeadMagnetTopics` from trigger task.

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-coverage src/__tests__/lib/actions/lead-magnets.test.ts`
Expected: FAIL — module doesn't exist.

**Step 3: Implement lead-magnets.ts**

```typescript
import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

registerAction({
  name: 'list_lead_magnets',
  description: 'List the user\'s lead magnets with their status, archetype, and creation date.',
  parameters: {
    properties: {
      status: { type: 'string', enum: ['draft', 'published', 'scheduled', 'archived'], description: 'Filter by status' },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
  },
  handler: async (ctx: ActionContext, params: { status?: string; limit?: number }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('lead_magnets')
      .select('id, title, status, archetype, created_at, updated_at')
      .eq('user_id', ctx.userId)
      .order('updated_at', { ascending: false })
      .limit(params.limit || 10);

    if (params.status) query = query.eq('status', params.status);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data, displayHint: 'text' };
  },
});

registerAction({
  name: 'get_lead_magnet',
  description: 'Get details of a specific lead magnet by ID. Returns title, archetype, content blocks, status.',
  parameters: {
    properties: {
      lead_magnet_id: { type: 'string', description: 'The lead magnet ID' },
    },
    required: ['lead_magnet_id'],
  },
  handler: async (ctx: ActionContext, params: { lead_magnet_id: string }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('lead_magnets')
      .select('id, title, archetype, status, content_blocks, extraction_data, created_at')
      .eq('id', params.lead_magnet_id)
      .eq('user_id', ctx.userId)
      .single();

    if (error || !data) return { success: false, error: 'Lead magnet not found' };
    return { success: true, data, displayHint: 'text' };
  },
});

registerAction({
  name: 'create_lead_magnet',
  description: 'Create a new lead magnet from a topic/title. Returns the new lead magnet ID.',
  parameters: {
    properties: {
      title: { type: 'string', description: 'Title for the lead magnet' },
      archetype: {
        type: 'string',
        enum: ['checklist', 'playbook', 'toolkit', 'blueprint', 'framework', 'guide', 'swipe-file', 'quiz', 'assessment'],
        description: 'Content archetype (default: guide)',
      },
    },
    required: ['title'],
  },
  requiresConfirmation: true,
  handler: async (ctx: ActionContext, params: { title: string; archetype?: string }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('lead_magnets')
      .insert({
        user_id: ctx.userId,
        title: params.title,
        archetype: params.archetype || 'guide',
        status: 'draft',
      })
      .select('id, title, archetype, status')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data, displayHint: 'text' };
  },
});
```

**Step 4: Add import in index.ts**

Add `import './lead-magnets';` to `src/lib/actions/index.ts`.

**Step 5: Run tests to verify they pass**

Run: `npx jest --no-coverage src/__tests__/lib/actions/lead-magnets.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/actions/lead-magnets.ts src/lib/actions/index.ts src/__tests__/lib/actions/lead-magnets.test.ts
git commit -m "feat: add lead magnet actions to copilot action layer"
```

---

### Task 4: Funnel Actions Module

**Files:**
- Create: `src/lib/actions/funnels.ts`
- Modify: `src/lib/actions/index.ts` (add import)
- Test: `src/__tests__/lib/actions/funnels.test.ts`

**Step 1: Write the failing tests**

Create `src/__tests__/lib/actions/funnels.test.ts` with tests for 3 actions:
- `list_funnels` — returns user's funnel pages with id, slug, title, status, views/leads counts
- `get_funnel` — returns a specific funnel page by ID with sections
- `publish_funnel` — toggles a funnel to published status (requiresConfirmation: true)

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-coverage src/__tests__/lib/actions/funnels.test.ts`
Expected: FAIL

**Step 3: Implement funnels.ts**

Register 3 actions:
- `list_funnels`: Query `funnel_pages` WHERE `user_id = ctx.userId AND is_variant = false`, select id/slug/title/status/views/leads, order by updated_at DESC.
- `get_funnel`: Query `funnel_pages` with sections join. Scope to user_id.
- `publish_funnel`: Update `funnel_pages.status = 'published'`. requiresConfirmation: true.

**Step 4: Add import in index.ts**

Add `import './funnels';` to barrel.

**Step 5: Run tests**

Run: `npx jest --no-coverage src/__tests__/lib/actions/funnels.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/actions/funnels.ts src/lib/actions/index.ts src/__tests__/lib/actions/funnels.test.ts
git commit -m "feat: add funnel actions to copilot action layer"
```

---

### Task 5: Email Actions Module

**Files:**
- Create: `src/lib/actions/email.ts`
- Modify: `src/lib/actions/index.ts` (add import)
- Test: `src/__tests__/lib/actions/email.test.ts`

**Step 1: Write the failing tests**

Create `src/__tests__/lib/actions/email.test.ts` with tests for 3 actions:
- `list_email_sequences` — returns user's email sequences with id, name, status, email count
- `get_subscriber_count` — returns total subscriber count for the user
- `generate_newsletter_email` — generates a newsletter draft from a topic (wraps `writeNewsletterEmail`)

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-coverage src/__tests__/lib/actions/email.test.ts`
Expected: FAIL

**Step 3: Implement email.ts**

Register 3 actions:
- `list_email_sequences`: Query `email_sequences` WHERE user_id, select id/name/status/created_at + count of emails.
- `get_subscriber_count`: Query `SELECT count(*) FROM email_subscribers WHERE user_id = ctx.userId AND status = 'active'`.
- `generate_newsletter_email`: Calls `writeNewsletterEmail()` from `src/lib/ai/content-pipeline/email-writer.ts`. Input: topic string. Returns generated email content.

**Step 4: Add import in index.ts**

Add `import './email';` to barrel.

**Step 5: Run tests**

Run: `npx jest --no-coverage src/__tests__/lib/actions/email.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/actions/email.ts src/lib/actions/index.ts src/__tests__/lib/actions/email.test.ts
git commit -m "feat: add email actions to copilot action layer"
```

---

### Task 6: Confirmation Dialog — Provider Extension

**Files:**
- Modify: `src/components/copilot/CopilotProvider.tsx`
- Test: `src/__tests__/components/copilot/CopilotProvider.test.tsx`

**Step 1: Write the failing tests**

Create `src/__tests__/components/copilot/CopilotProvider.test.tsx`:

```typescript
// Test 1: pendingConfirmation starts as null
// Test 2: confirmation_required SSE event sets pendingConfirmation state
// Test 3: confirmAction(toolUseId, true) sends POST to /api/copilot/confirm-action and clears state
// Test 4: confirmAction(toolUseId, false) sends POST with approved: false and clears state
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-coverage src/__tests__/components/copilot/CopilotProvider.test.tsx`
Expected: FAIL — no pendingConfirmation state exists.

**Step 3: Extend CopilotProvider**

Add to state:
```typescript
pendingConfirmation: {
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolUseId: string;
} | null;
```

Add to context interface:
```typescript
pendingConfirmation: PendingConfirmation | null;
confirmAction: (toolUseId: string, approved: boolean) => Promise<void>;
applyToPage: ((type: string, data: unknown) => void) | null;
registerApplyHandler: (handler: (type: string, data: unknown) => void) => void;
```

In `sendMessage()` SSE handler, when event is `confirmation_required`:
```typescript
case 'confirmation_required':
  setPendingConfirmation({
    toolName: parsed.tool,
    toolArgs: parsed.args,
    toolUseId: parsed.toolUseId,
  });
  break;
```

`confirmAction()` method:
```typescript
const confirmAction = async (toolUseId: string, approved: boolean) => {
  await fetch('/api/copilot/confirm-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: activeConversationId, toolUseId, approved }),
  });
  setPendingConfirmation(null);
};
```

**Step 4: Run tests**

Run: `npx jest --no-coverage src/__tests__/components/copilot/CopilotProvider.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/copilot/CopilotProvider.tsx src/__tests__/components/copilot/CopilotProvider.test.tsx
git commit -m "feat: add confirmation state + applyToPage callback to CopilotProvider"
```

---

### Task 7: Confirmation Dialog Component

**Files:**
- Create: `src/components/copilot/ConfirmationDialog.tsx`
- Modify: `src/components/copilot/CopilotSidebar.tsx` (render dialog)
- Test: `src/__tests__/components/copilot/ConfirmationDialog.test.tsx`

**Step 1: Write the failing tests**

Create `src/__tests__/components/copilot/ConfirmationDialog.test.tsx`:

```typescript
// Test 1: Renders nothing when pendingConfirmation is null
// Test 2: Shows dialog with tool name and formatted args when pendingConfirmation is set
// Test 3: Confirm button calls confirmAction(id, true)
// Test 4: Cancel button calls confirmAction(id, false)
// Test 5: Shows human-readable description for schedule_post
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-coverage src/__tests__/components/copilot/ConfirmationDialog.test.tsx`
Expected: FAIL — component doesn't exist.

**Step 3: Implement ConfirmationDialog.tsx**

```tsx
'use client';

import { AlertTriangle, Check, X } from 'lucide-react';

interface Props {
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolUseId: string;
  onConfirm: (toolUseId: string, approved: boolean) => void;
}

// Human-readable descriptions per action
const ACTION_DESCRIPTIONS: Record<string, string> = {
  schedule_post: 'Schedule this post for publishing',
  publish_funnel: 'Publish this funnel page (makes it publicly accessible)',
  create_lead_magnet: 'Create a new lead magnet',
};

function formatArgs(toolName: string, args: Record<string, unknown>): string {
  // Per-action formatting for clearer display
  switch (toolName) {
    case 'schedule_post':
      return `Post: ${(args.post_id as string)?.slice(0, 8)}...\nTime: ${args.scheduled_time || 'next available slot'}`;
    case 'publish_funnel':
      return `Funnel: ${args.funnel_id}`;
    case 'create_lead_magnet':
      return `Title: ${args.title}\nArchetype: ${args.archetype || 'guide'}`;
    default:
      return Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  }
}

export default function ConfirmationDialog({ toolName, toolArgs, toolUseId, onConfirm }: Props) {
  const description = ACTION_DESCRIPTIONS[toolName] || `Execute ${toolName}`;
  const formattedArgs = formatArgs(toolName, toolArgs);

  return (
    <div className="mx-3 mb-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium text-amber-800">Confirmation Required</span>
      </div>
      <p className="text-sm text-amber-700 mb-2">{description}</p>
      <pre className="text-xs bg-white rounded p-2 mb-3 whitespace-pre-wrap text-gray-700">
        {formattedArgs}
      </pre>
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(toolUseId, true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700"
        >
          <Check className="h-3.5 w-3.5" /> Confirm
        </button>
        <button
          onClick={() => onConfirm(toolUseId, false)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Wire into CopilotSidebar.tsx**

In CopilotSidebar, render `ConfirmationDialog` above the `ConversationInput` when `pendingConfirmation` is set:

```tsx
{pendingConfirmation && (
  <ConfirmationDialog
    toolName={pendingConfirmation.toolName}
    toolArgs={pendingConfirmation.toolArgs}
    toolUseId={pendingConfirmation.toolUseId}
    onConfirm={confirmAction}
  />
)}
```

**Step 5: Run tests**

Run: `npx jest --no-coverage src/__tests__/components/copilot/ConfirmationDialog.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/copilot/ConfirmationDialog.tsx src/components/copilot/CopilotSidebar.tsx src/__tests__/components/copilot/ConfirmationDialog.test.tsx
git commit -m "feat: add confirmation dialog for destructive copilot actions"
```

---

### Task 8: Confirmation API Endpoint + Chat Route Blocking

**Files:**
- Create: `src/app/api/copilot/confirm-action/route.ts`
- Modify: `src/app/api/copilot/chat/route.ts` (pause for confirmation)
- Test: `src/__tests__/api/copilot/confirm-action.test.ts`

**Step 1: Write the failing tests**

Tests for `POST /api/copilot/confirm-action`:
```typescript
// Test 1: Returns 401 when unauthenticated
// Test 2: Returns 400 when missing required fields
// Test 3: Returns 200 and saves confirmation result to copilot_messages
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-coverage src/__tests__/api/copilot/confirm-action.test.ts`
Expected: FAIL

**Step 3: Implement confirm-action route**

The confirmation flow works as follows:
1. When the agent loop hits a `requiresConfirmation` action, it sends `confirmation_required` SSE event and **skips execution** (returns a tool_result with `{ awaiting_confirmation: true }` to Claude).
2. The user clicks Confirm/Cancel in the UI.
3. `POST /api/copilot/confirm-action` saves the decision and stores a `tool_confirmation` message.
4. If approved, a new mini agent loop runs that re-executes just that action and lets Claude continue.
5. If cancelled, a user message "User cancelled {action}" is appended and Claude responds.

Modify `chat/route.ts`:
- When `actionRequiresConfirmation(block.name)` is true, **do NOT** execute the action immediately.
- Instead: send `confirmation_required` event, push a tool_result with `{ status: 'awaiting_confirmation', tool: block.name }` to Claude, and break the loop.
- The confirmation API endpoint handles resuming.

Create `confirm-action/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { executeAction } from '@/lib/actions';
import type { ActionContext } from '@/lib/actions';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await req.json();
  const { conversationId, toolUseId, approved } = body;

  if (!conversationId || !toolUseId || typeof approved !== 'boolean') {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const userId = session.user.id;

  // Verify conversation ownership
  const { data: conv } = await supabase
    .from('copilot_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (!conv) {
    return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 });
  }

  // Save confirmation decision
  await supabase.from('copilot_messages').insert({
    conversation_id: conversationId,
    role: 'tool_result',
    tool_name: '_confirmation',
    tool_result: { toolUseId, approved },
  });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
```

**Step 4: Update chat/route.ts to skip confirmed actions**

In the tool execution loop, when `actionRequiresConfirmation(block.name)`:
```typescript
if (actionRequiresConfirmation(block.name)) {
  send('confirmation_required', {
    tool: block.name,
    args: block.input,
    toolUseId: block.id,
  });

  // Don't execute — push pending result to Claude
  toolResults.push({
    type: 'tool_result',
    tool_use_id: block.id,
    content: JSON.stringify({
      success: false,
      error: 'Action requires user confirmation. Waiting for approval.',
      awaiting_confirmation: true,
    }),
  });

  // Save pending tool call
  await supabase.from('copilot_messages').insert({
    conversation_id: conversationId,
    role: 'tool_call',
    tool_name: block.name,
    tool_args: block.input as Record<string, unknown>,
  });

  continue; // Skip execution, let other non-confirmation tools proceed
}
```

**Step 5: Run tests**

Run: `npx jest --no-coverage src/__tests__/api/copilot/confirm-action.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/app/api/copilot/confirm-action/route.ts src/app/api/copilot/chat/route.ts src/__tests__/api/copilot/confirm-action.test.ts
git commit -m "feat: add confirmation API + blocking for destructive copilot actions"
```

---

### Task 9: Rich Result Cards — PostPreviewCard

**Files:**
- Create: `src/components/copilot/PostPreviewCard.tsx`
- Modify: `src/components/copilot/CopilotMessage.tsx` (render card for post_preview displayHint)
- Test: `src/__tests__/components/copilot/PostPreviewCard.test.tsx`

**Step 1: Write the failing tests**

```typescript
// Test 1: Renders post content preview (first 300 chars)
// Test 2: Shows "Apply to editor" button when applyToPage is available
// Test 3: Hides "Apply" button when applyToPage is null
// Test 4: Clicking "Apply" calls applyToPage('post_content', { content })
// Test 5: Shows post variations if present
```

**Step 2: Run tests to verify they fail**

Expected: FAIL — component doesn't exist.

**Step 3: Implement PostPreviewCard**

```tsx
'use client';

import { FileText, Copy, ArrowRight } from 'lucide-react';

interface Props {
  data: {
    content?: string;
    post?: { id: string; draft_content?: string; status?: string };
    variations?: Array<{ content: string }>;
  };
  onApply?: (type: string, data: unknown) => void;
}

export default function PostPreviewCard({ data, onApply }: Props) {
  const content = data.content || data.post?.draft_content || '';
  const preview = content.slice(0, 300);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 my-2">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-4 w-4 text-violet-600" />
        <span className="text-xs font-medium text-gray-500">Post Preview</span>
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
        {preview}{content.length > 300 ? '...' : ''}
      </p>
      {data.variations && data.variations.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          +{data.variations.length} variation{data.variations.length > 1 ? 's' : ''}
        </div>
      )}
      <div className="flex gap-2 mt-3">
        {onApply && (
          <button
            onClick={() => onApply('post_content', { content, postId: data.post?.id })}
            className="flex items-center gap-1 text-xs px-2.5 py-1 bg-violet-600 text-white rounded hover:bg-violet-700"
          >
            <ArrowRight className="h-3 w-3" /> Apply to editor
          </button>
        )}
        <button
          onClick={() => navigator.clipboard.writeText(content)}
          className="flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Wire into CopilotMessage**

In `CopilotMessage.tsx`, for tool_result messages where `message.toolResult?.displayHint === 'post_preview'`, render `PostPreviewCard` instead of the default JSON display.

**Step 5: Run tests**

Run: `npx jest --no-coverage src/__tests__/components/copilot/PostPreviewCard.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/copilot/PostPreviewCard.tsx src/components/copilot/CopilotMessage.tsx src/__tests__/components/copilot/PostPreviewCard.test.tsx
git commit -m "feat: add PostPreviewCard with Apply + Copy for copilot post results"
```

---

### Task 10: Rich Result Cards — KnowledgeResultCard

**Files:**
- Create: `src/components/copilot/KnowledgeResultCard.tsx`
- Modify: `src/components/copilot/CopilotMessage.tsx` (render for knowledge_list)
- Test: `src/__tests__/components/copilot/KnowledgeResultCard.test.tsx`

**Step 1: Write the failing tests**

```typescript
// Test 1: Renders list of knowledge entries with titles
// Test 2: Shows quality stars (1-5) for each entry
// Test 3: Shows knowledge_type badge (how_to, insight, story, etc.)
// Test 4: Entries are collapsible — shows excerpt by default, full on click
// Test 5: Shows "Use in post" button when applyToPage is available
```

**Step 2: Run tests to verify they fail**

Expected: FAIL

**Step 3: Implement KnowledgeResultCard**

Card that renders an array of knowledge entries:
- Each entry: knowledge_type badge (colored chip), quality stars, source info
- First 100 chars shown, click to expand
- "Use in post" button calls `applyToPage('knowledge_reference', { entryId, content })`

**Step 4: Wire into CopilotMessage for `knowledge_list` displayHint**

**Step 5: Run tests**

Run: `npx jest --no-coverage src/__tests__/components/copilot/KnowledgeResultCard.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/copilot/KnowledgeResultCard.tsx src/components/copilot/CopilotMessage.tsx src/__tests__/components/copilot/KnowledgeResultCard.test.tsx
git commit -m "feat: add KnowledgeResultCard with quality stars + collapsible entries"
```

---

### Task 11: Rich Result Cards — IdeaListCard

**Files:**
- Create: `src/components/copilot/IdeaListCard.tsx`
- Modify: `src/components/copilot/CopilotMessage.tsx` (render for idea_list)
- Test: `src/__tests__/components/copilot/IdeaListCard.test.tsx`

**Step 1: Write the failing tests**

```typescript
// Test 1: Renders list of ideas with titles
// Test 2: Shows content_type badge per idea
// Test 3: "Write this" button calls applyToPage('write_from_idea', { idea })
// Test 4: Shows hook preview if available
```

**Step 2: Run tests to verify they fail**

Expected: FAIL

**Step 3: Implement IdeaListCard**

Card that renders content ideas:
- Each idea: title, content_type badge, hook preview
- "Write this" button triggers the copilot to run `write_post` with the idea's topic
- Styled as selectable cards

**Step 4: Wire into CopilotMessage for `idea_list` displayHint**

**Step 5: Run tests**

Run: `npx jest --no-coverage src/__tests__/components/copilot/IdeaListCard.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/copilot/IdeaListCard.tsx src/components/copilot/CopilotMessage.tsx src/__tests__/components/copilot/IdeaListCard.test.tsx
git commit -m "feat: add IdeaListCard with selectable ideas + Write This action"
```

---

### Task 12: Entity-Scoped Conversation Auto-Loading

**Files:**
- Modify: `src/components/copilot/CopilotProvider.tsx` (auto-load entity conversation)
- Modify: `src/app/api/copilot/conversations/route.ts` (add entity filter to GET)
- Test: `src/__tests__/api/copilot/conversations.test.ts` (add entity filter test)

**Step 1: Write the failing test**

Add to conversations.test.ts:
```typescript
it('GET filters by entity_type and entity_id', async () => {
  // Mock request with ?entity_type=post&entity_id=abc
  // Expect supabase query includes .eq('entity_type', 'post').eq('entity_id', 'abc')
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage src/__tests__/api/copilot/conversations.test.ts -t "filters by entity"`
Expected: FAIL

**Step 3: Add entity filter to GET /api/copilot/conversations**

In `route.ts` GET handler, read `entity_type` and `entity_id` from query params. If both present, add `.eq('entity_type', ...)` and `.eq('entity_id', ...)` filters.

**Step 4: Auto-load in CopilotProvider**

When `pageContext` changes (via `useCopilotContext`), if `entityType` and `entityId` are set:
1. Fetch conversations filtered by entity
2. If one exists, auto-select it (load messages)
3. If none, the next `sendMessage()` will create one with entity binding

```typescript
useEffect(() => {
  if (pageContext?.entityType && pageContext?.entityId && isOpen) {
    loadEntityConversation(pageContext.entityType, pageContext.entityId);
  }
}, [pageContext?.entityType, pageContext?.entityId, isOpen]);
```

**Step 5: Run tests**

Run: `npx jest --no-coverage src/__tests__/api/copilot/conversations.test.ts`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/components/copilot/CopilotProvider.tsx src/app/api/copilot/conversations/route.ts src/__tests__/api/copilot/conversations.test.ts
git commit -m "feat: auto-load entity-scoped copilot conversations"
```

---

### Task 13: Register useCopilotContext on All Major Pages

**Files:**
- Modify: `src/app/(dashboard)/create/page.tsx` or its main component — register pipeline context
- Modify: knowledge dashboard component — register knowledge context
- Modify: funnel builder component — register funnel context
- Modify: library page component — register lead magnet context
- Modify: analytics page component — register analytics context

**Step 1: Identify the right components**

Read each page to find the correct client component to add the hook. The hook must be in a client component (has `'use client'`).

Pattern per page:
```typescript
import { useCopilotContext } from '@/components/copilot/useCopilotContext';

// Inside the component:
useCopilotContext({
  page: 'content-pipeline',
  entityType: 'pipeline',
});
```

For entity-specific pages (funnel/[id], library/[id]):
```typescript
useCopilotContext({
  page: 'funnel-builder',
  entityType: 'funnel',
  entityId: funnel.id,
  entityTitle: funnel.title,
});
```

**Step 2: Add hook to each page**

Add `useCopilotContext` to:
1. **Content Pipeline** (`src/components/content-pipeline/` main component) — page: 'content-pipeline'
2. **Knowledge Dashboard** (`src/components/content-pipeline/KnowledgeDashboard.tsx`) — page: 'knowledge'
3. **Funnel Builder** (`src/components/funnel/FunnelBuilder.tsx`) — page: 'funnel-builder', entityType: 'funnel', entityId: funnelId
4. **Library detail** (lead magnet detail page) — page: 'lead-magnet', entityType: 'lead_magnet', entityId
5. **Analytics** (analytics page component) — page: 'analytics'

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` (should be same count as before or fewer)

**Step 4: Commit**

```bash
git add -A src/components/ src/app/
git commit -m "feat: register useCopilotContext on all major dashboard pages"
```

---

### Task 14: Richer System Prompt — Performance Data + Feedback Patterns

**Files:**
- Modify: `src/lib/ai/copilot/system-prompt.ts`
- Test: `src/__tests__/lib/ai/copilot/system-prompt.test.ts`

**Step 1: Write the failing tests**

Add to system-prompt.test.ts:
```typescript
it('includes recent performance data in system prompt', async () => {
  // Mock cp_pipeline_posts with engagement_stats
  // Verify prompt includes "Top performing:" section
});

it('includes negative feedback patterns in system prompt', async () => {
  // Mock copilot_messages with feedback.rating = 'down'
  // Verify prompt includes "Common corrections:" section
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest --no-coverage src/__tests__/lib/ai/copilot/system-prompt.test.ts`
Expected: FAIL — current prompt doesn't include performance or feedback sections.

**Step 3: Add performance data section**

In `buildCopilotSystemPrompt()`, after fetching voice profile and memories, add two more parallel queries:

```typescript
// Recent performance (last 30 days)
const { data: topPosts } = await supabase
  .from('cp_pipeline_posts')
  .select('draft_content, final_content, engagement_stats, published_at')
  .eq('user_id', userId)
  .eq('status', 'published')
  .not('engagement_stats', 'is', null)
  .order('published_at', { ascending: false })
  .limit(5);

// Negative feedback patterns (last 30 days)
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
const { data: negFeedback } = await supabase
  .from('copilot_messages')
  .select('feedback')
  .eq('conversation_id', conversationId) // Actually need to join through conversations for user_id
  .not('feedback', 'is', null)
  .gte('created_at', thirtyDaysAgo);
```

Build prompt sections:
- Performance: "Top post: '[first 50 chars]...' — X impressions, Y comments"
- Feedback: Aggregate negative notes, e.g. "Common corrections: 'too formal' (3x), 'too long' (2x)"

**Step 4: Run tests**

Run: `npx jest --no-coverage src/__tests__/lib/ai/copilot/system-prompt.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/copilot/system-prompt.ts src/__tests__/lib/ai/copilot/system-prompt.test.ts
git commit -m "feat: enrich copilot system prompt with performance data + feedback patterns"
```

---

### Task 15: Conversation Header + Entity Badge

**Files:**
- Create: `src/components/copilot/ConversationHeader.tsx`
- Modify: `src/components/copilot/CopilotSidebar.tsx` (use new header)
- Test: `src/__tests__/components/copilot/ConversationHeader.test.tsx`

**Step 1: Write the failing tests**

```typescript
// Test 1: Shows conversation title
// Test 2: Shows entity badge when entity_type is set (e.g., "Post: Pricing objections")
// Test 3: New Thread button calls startNewConversation()
// Test 4: Back button returns to conversation list
```

**Step 2: Run tests to verify they fail**

Expected: FAIL

**Step 3: Implement ConversationHeader**

```tsx
'use client';

import { ArrowLeft, Plus, FileText, Megaphone, BookOpen, Lightbulb } from 'lucide-react';

const ENTITY_ICONS: Record<string, typeof FileText> = {
  post: FileText,
  funnel: Megaphone,
  lead_magnet: BookOpen,
  idea: Lightbulb,
};

interface Props {
  title?: string;
  entityType?: string;
  entityTitle?: string;
  onBack: () => void;
  onNewThread: () => void;
}

export default function ConversationHeader({ title, entityType, entityTitle, onBack, onNewThread }: Props) {
  const Icon = entityType ? ENTITY_ICONS[entityType] || FileText : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b">
      <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{title || 'New conversation'}</div>
        {entityType && entityTitle && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {Icon && <Icon className="h-3 w-3" />}
            <span className="truncate">{entityTitle}</span>
          </div>
        )}
      </div>
      <button onClick={onNewThread} className="p-1 hover:bg-gray-100 rounded" title="New thread">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
```

**Step 4: Replace inline header in CopilotSidebar**

Replace the existing header section in CopilotSidebar with `<ConversationHeader />`.

**Step 5: Run tests**

Run: `npx jest --no-coverage src/__tests__/components/copilot/ConversationHeader.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/copilot/ConversationHeader.tsx src/components/copilot/CopilotSidebar.tsx src/__tests__/components/copilot/ConversationHeader.test.tsx
git commit -m "feat: add ConversationHeader with entity badge + new thread button"
```

---

### Task 16: displayHint Propagation — Tool Results to Frontend

**Files:**
- Modify: `src/app/api/copilot/chat/route.ts` (include displayHint in tool_result SSE event)
- Modify: `src/components/copilot/CopilotProvider.tsx` (store displayHint on messages)
- Modify: `src/components/copilot/CopilotMessage.tsx` (route rendering by displayHint)

**Step 1: Verify current tool_result SSE event shape**

Read `chat/route.ts` line 216: `send('tool_result', { name: block.name, result, id: block.id })`.

The `result` is an `ActionResult` which already has `displayHint`. Verify it's included in the SSE data.

**Step 2: Update CopilotProvider to store displayHint**

In the SSE handler for `tool_result`, extract `displayHint` from the result and store it on the message:

```typescript
case 'tool_result': {
  const resultData = parsed.result;
  setMessages(prev => [...prev, {
    id: crypto.randomUUID(),
    role: 'tool_result',
    toolName: parsed.name,
    toolResult: resultData,
    displayHint: resultData?.displayHint,
  }]);
  break;
}
```

**Step 3: Route rendering in CopilotMessage**

```tsx
// For tool_result messages:
if (message.role === 'tool_result') {
  switch (message.displayHint) {
    case 'post_preview':
      return <PostPreviewCard data={message.toolResult?.data} onApply={applyToPage} />;
    case 'knowledge_list':
      return <KnowledgeResultCard data={message.toolResult?.data} onApply={applyToPage} />;
    case 'idea_list':
      return <IdeaListCard data={message.toolResult?.data} onApply={applyToPage} />;
    default:
      // Existing JSON/text rendering
  }
}
```

**Step 4: Run all copilot tests**

Run: `npx jest --no-coverage src/__tests__/components/copilot/ src/__tests__/api/copilot/`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/app/api/copilot/chat/route.ts src/components/copilot/CopilotProvider.tsx src/components/copilot/CopilotMessage.tsx
git commit -m "feat: route tool result rendering by displayHint to rich cards"
```

---

### Task 17: Smoke Test All Tests + TypeScript Check

**Files:**
- No new files

**Step 1: Run all copilot tests**

Run: `npx jest --no-coverage src/__tests__/lib/actions/ src/__tests__/api/copilot/ src/__tests__/lib/ai/copilot/ src/__tests__/components/copilot/`
Expected: ALL tests PASS (should be ~120+ tests now).

**Step 2: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | head -20`
Expected: No new errors in copilot files.

**Step 3: Fix any issues found**

If tests fail or TS errors exist in copilot files, fix them.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve Phase 2b test failures and TS errors"
```

---

### Task 18: Update CLAUDE.md with Phase 2b Documentation

**Files:**
- Modify: `CLAUDE.md` (update AI Co-pilot section)

**Step 1: Update the AI Co-pilot section**

Add to the existing "AI Co-pilot (Phase 2a)" section, expanding it to cover Phase 2b:

- Update action count from 13 to ~22 (add lead-magnets, funnels, email modules)
- Document new action modules: lead-magnets.ts (3 actions), funnels.ts (3 actions), email.ts (3 actions)
- Document confirmation flow: ConfirmationDialog + confirm-action API + blocking in chat route
- Document rich result cards: PostPreviewCard, KnowledgeResultCard, IdeaListCard
- Document entity-scoped conversation auto-loading
- Document useCopilotContext registrations on all major pages
- Document richer system prompt (performance data, feedback patterns)
- Update test count

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Phase 2b copilot features"
```

---

## Summary

| Task | Description | New Files | Tests |
|------|-------------|-----------|-------|
| 1 | Install react-markdown + remark-gfm | 0 | 0 |
| 2 | Markdown rendering in CopilotMessage | 0 | 2 |
| 3 | Lead magnet actions module | 2 | ~4 |
| 4 | Funnel actions module | 2 | ~3 |
| 5 | Email actions module | 2 | ~3 |
| 6 | Provider extension (confirmation + apply state) | 1 | ~4 |
| 7 | ConfirmationDialog component | 2 | ~5 |
| 8 | Confirmation API + chat route blocking | 2 | ~3 |
| 9 | PostPreviewCard | 2 | ~5 |
| 10 | KnowledgeResultCard | 2 | ~5 |
| 11 | IdeaListCard | 2 | ~4 |
| 12 | Entity-scoped conversation auto-loading | 0 | ~2 |
| 13 | useCopilotContext on all major pages | 0 | 0 |
| 14 | Richer system prompt | 0 | ~2 |
| 15 | ConversationHeader + entity badge | 2 | ~4 |
| 16 | displayHint routing to rich cards | 0 | 0 |
| 17 | Smoke test + TypeScript check | 0 | 0 |
| 18 | CLAUDE.md update | 0 | 0 |

**Total: ~18 tasks, ~15 new files, ~46 new tests**
