# AI Co-pilot Design — Agentic Chat with Shared Action Layer

**Date:** 2026-02-27
**Context:** Phase 2 of Kleo competitive parity roadmap
**Goal:** Build a global AI co-pilot that can act across every surface of magnetlab — writing posts, searching knowledge, creating lead magnets, scheduling content — through a conversational interface powered by Claude tool_use and a shared action layer that also backs the MCP.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Shared Action Layer                        │
│  src/lib/actions/                                            │
│  Pure async functions: (userId, params) → ActionResult        │
│  Calls Supabase + AI modules directly (no HTTP)              │
│                                                              │
│  knowledge.ts | content.ts | scheduling.ts | lead-magnets.ts │
│  funnels.ts   | email.ts   | analytics.ts  | templates.ts   │
├──────────────┬───────────────────────────────────────────────┤
│  MCP Server  │  In-App Co-pilot                              │
│  (external)  │  (global sidebar)                             │
│              │                                                │
│  Calls       │  Claude tool_use loop                         │
│  actions     │  + streaming SSE                              │
│  via tool    │  + page context awareness                     │
│  dispatch    │  + conversation persistence                   │
│              │  + feedback → style evolution                  │
│              │  + memory extraction                           │
│              │  + rich UI result cards                        │
└──────────────┴───────────────────────────────────────────────┘
```

**Key differentiator vs Kleo:** Every co-pilot response is grounded in the user's actual knowledge base (pgvector semantic search over transcripts), voice profile (learned from edits), and post performance data. Kleo's chat is generic Claude. Ours has context.

---

## 1. Shared Action Layer

### Purpose

Extract ~30 key actions from the MCP's 108 tools into `src/lib/actions/`. Pure TypeScript functions that call Supabase + AI modules directly — no HTTP, no auth overhead. Both the MCP and co-pilot call the same code path.

### File Structure

```
src/lib/actions/
├── types.ts              # ActionContext, ActionResult, ActionDefinition types
├── registry.ts           # Tool definitions for Claude (name, description, parameters)
├── executor.ts           # Executes action by name → returns structured result
├── knowledge.ts          # searchKnowledge, askKnowledge, getGaps, getReadiness, getRecentDigest
├── content.ts            # writePost, polishPost, quickWrite, writeFromIdea, getPostsByStatus
├── scheduling.ts         # schedulePost, getAutopilotStatus, triggerAutopilot, getBuffer, getPlan
├── lead-magnets.ts       # createLeadMagnet, generateContent, ideateTopics, getLeadMagnet
├── funnels.ts            # createFunnel, publishFunnel, generateFunnelContent
├── email.ts              # generateEmailSequence, createBroadcast, sendBroadcast
├── analytics.ts          # getPostPerformance, getTopPerformingPosts, getEngagementTrends
└── templates.ts          # listTemplates, matchTemplate, listWritingStyles
```

### Action Signature

```typescript
interface ActionContext {
  userId: string;
  teamId?: string;
}

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  displayHint?: 'post_preview' | 'knowledge_list' | 'plan' | 'idea_list' | 'calendar' | 'text';
}

// Each action:
async function writePost(ctx: ActionContext, params: WritePostParams): Promise<ActionResult<WrittenPost>>
```

### Action Registry

The registry exports tool definitions in Claude's tool_use format — name, description, input_schema (JSON Schema). The co-pilot's system prompt includes these. The executor maps tool name → function call.

```typescript
// registry.ts
export const COPILOT_TOOLS: Tool[] = [
  {
    name: 'search_knowledge',
    description: 'Search the AI Brain knowledge base using semantic search. Always call this before writing content to ground it in real expertise.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Semantic search query' },
        knowledge_type: { type: 'string', enum: ['how_to', 'insight', 'story', 'question', 'objection', 'mistake', 'decision', 'market_intel'] },
        topic: { type: 'string', description: 'Filter by topic slug' },
        min_quality: { type: 'number', description: 'Minimum quality score 1-5' },
        limit: { type: 'number', default: 10 },
      },
      required: ['query'],
    },
  },
  // ... ~30 tools total
];
```

### MCP Integration

The MCP package (`packages/mcp/`) continues making HTTP calls externally. But a new `packages/mcp/src/internal.ts` can optionally import the shared action layer for local execution, keeping both in sync.

---

## 2. AI Agent Engine

### API Route: `POST /api/copilot/chat`

Streaming endpoint that runs a Claude tool_use loop server-side.

**Request:**
```typescript
{
  conversationId?: string;   // Resume existing thread (null = new)
  message: string;           // User's message
  pageContext?: {             // Current page state from frontend
    pageType: string;        // 'post-editor' | 'content-pipeline' | 'knowledge' | 'dashboard' | ...
    entityType?: string;     // 'post' | 'lead_magnet' | 'funnel' | 'idea'
    entityId?: string;
    entityData?: Record<string, unknown>;  // Current content, status, etc.
  };
}
```

**Response:** Server-Sent Events stream

```
event: text_delta     data: {"text": "I'll search your knowledge..."}
event: tool_call      data: {"name": "search_knowledge", "args": {"query": "pricing"}}
event: tool_result    data: {"name": "search_knowledge", "result": {...}, "displayHint": "knowledge_list"}
event: plan           data: {"steps": [{"label": "Search knowledge", "status": "complete"}, ...]}
event: done           data: {"conversationId": "uuid", "tokensUsed": 1234}
event: error          data: {"message": "..."}
```

### Agent Loop

```typescript
async function runAgentLoop(userId, conversationId, message, pageContext) {
  // 1. Load/create conversation
  // 2. Build system prompt (voice + memories + context + tools)
  // 3. Load message history from copilot_messages
  // 4. Append user message

  const client = getAnthropicClient('copilot'); // Helicone-routed

  let iterations = 0;
  const MAX_ITERATIONS = 15;

  while (iterations < MAX_ITERATIONS) {
    const stream = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: conversationMessages,
      tools: COPILOT_TOOLS,
      stream: true,
    });

    for await (const event of stream) {
      // Stream text deltas to frontend
      // When tool_use block complete → execute action → stream result
      // Feed tool result back into messages for next iteration
    }

    if (noMoreToolCalls) break;
    iterations++;
  }

  // Persist all messages to copilot_messages table
}
```

### Guardrails

- **Max 15 iterations** per user turn (prevents runaway loops)
- **Confirmation required** for destructive/visible actions: `publish_post`, `send_broadcast`, `delete_*`, `create_lead_magnet` (co-pilot asks "Should I proceed?" before executing)
- **Cost cap**: Track tokens per conversation, alert if approaching plan limit
- **Helicone tracking**: All calls via `getAnthropicClient('copilot')` with automatic cost attribution

---

## 3. System Prompt Assembly

### Function: `buildCopilotSystemPrompt(userId, pageContext)`

Assembled fresh per conversation turn from live data. Makes parallel Supabase queries, cached for 5 minutes.

**Structure:**

```
1. Base identity (from prompt registry: 'copilot-system')
   "You are magnetlab's AI co-pilot for {{authorName}}..."
   Editable in admin panel at /admin/prompts

2. Voice profile (from team_profiles.voice_profile)
   buildVoicePromptSection(profile, 'linkedin')
   — tone, signature phrases, banned phrases, storytelling style

3. Active memories (from copilot_memories WHERE active = true)
   "User preferences:
    - Never use 'leverage' or 'game-changer'
    - Keep posts under 200 words
    - Always end with a question"

4. Knowledge readiness (from gap analysis, cached daily)
   "Strong topics: pricing (0.9), onboarding (0.85)
    Weak topics: hiring (0.3)"

5. Recent performance (last 30 days from cp_pipeline_posts)
   "Top post: 'I lost a $50K deal...' — 847 impressions
    Best format: personal story hooks"

6. Negative feedback patterns (aggregated from copilot_messages.feedback)
   "Common corrections: 'too formal' (3x), 'too long' (2x)"

7. Page context (from frontend)
   "User is on: Post Editor, Post ID: abc-123, Status: draft
    Content: 'First draft about pricing...'"

8. Available tools (from action registry — dynamic)
   {COPILOT_TOOLS definitions}
```

Sections 1 and prompt framing are editable via admin panel. Sections 2-8 are assembled programmatically.

### Admin Prompt Templates

| Slug | Purpose | Variables |
|------|---------|-----------|
| `copilot-system` | Base identity, rules, behavior guidelines | `{{authorName}}`, `{{voiceSection}}`, `{{memoriesSection}}`, `{{knowledgeSection}}`, `{{performanceSection}}`, `{{feedbackSection}}`, `{{pageContextSection}}` |
| `copilot-memory-extractor` | Haiku prompt for extracting preferences from corrections | `{{userMessage}}`, `{{previousAssistantMessage}}` |
| `copilot-plan-generator` | How to present multi-step plans | `{{userRequest}}`, `{{availableTools}}` |

Registered in `prompt-defaults.ts` as hardcoded fallbacks. Active templates in `ai_prompt_templates` override them (existing registry pattern).

---

## 4. Feedback & Learning Loop

### Three Feedback Channels

**1. Inline edits (implicit)**
When the co-pilot generates content and the user edits it, `captureAndClassifyEdit()` fires with additional context:
- `source: 'copilot'`
- `conversation_id` reference
- Claude Haiku classifies the edit pattern
- Patterns feed into weekly `evolve-writing-style` task

**2. Explicit feedback (thumbs up/down)**
Each assistant message gets a feedback widget:
- Thumbs up → positive example (increases confidence in current style)
- Thumbs down + optional note → stored in `copilot_messages.feedback`
- Aggregated into negative feedback patterns section of system prompt

**3. Correction messages (conversational)**
When user says "no, make it shorter" or "I never say that":
- Detect correction signals: negation + preference keywords
- Call Haiku with `copilot-memory-extractor` prompt
- Extract as memory: `{ rule, category, confidence: 0.8, source: 'conversation' }`
- Save to `copilot_memories`, injected into future system prompts

### Data Flow

```
User edits co-pilot output → captureAndClassifyEdit(source: 'copilot')
User thumbs-down + note   → copilot_messages.feedback → pattern aggregation
User correction message    → Haiku extraction → copilot_memories table
                                    ↓
         Weekly evolve-writing-style task aggregates ALL signals
                                    ↓
              voice_profile updated → injected into ALL future prompts
```

### Memory Management

Users can view, edit, and delete memories in Settings. Auto-extracted memories start at `confidence: 0.8`. User-created memories are `confidence: 1.0`. Low-confidence memories that get contradicted are auto-deactivated.

---

## 5. Chat UI & Frontend

### Global Sidebar

Mounted at dashboard layout level. Slides in from right edge, persists across page navigations.

**Component tree:**
```
CopilotProvider (React context — state, SSE connection, page context)
├── CopilotToggleButton (floating button, bottom-right)
└── CopilotSidebar (400px slide-in panel)
    ├── ConversationHeader
    │   ├── Title (auto-generated or entity name)
    │   ├── EntityBadge (if entity-scoped: "Post: Pricing objections")
    │   ├── NewThreadButton
    │   └── CloseButton
    ├── MessageList (scrollable, auto-scroll on new messages)
    │   ├── UserMessage
    │   ├── AssistantMessage
    │   │   ├── StreamingText (markdown rendered)
    │   │   ├── ToolCallCard (action name + spinner while executing)
    │   │   ├── PostPreviewCard (LinkedIn preview + "Apply" button)
    │   │   ├── KnowledgeResultCard (entries with quality stars, collapsible)
    │   │   ├── PlanCard (step checklist with live progress)
    │   │   ├── IdeaListCard (selectable ideas)
    │   │   └── FeedbackWidget (thumbs up/down + note input)
    │   └── SystemMessage (errors, status)
    ├── ConversationInput
    │   ├── TextArea (auto-resize, Shift+Enter newline, Enter send)
    │   └── SendButton
    └── ConversationListDrawer (previous threads, search)
```

### Page Context Hook

```typescript
// Any page can register its context:
useCopilotContext({
  pageType: 'post-editor',
  entityType: 'post',
  entityId: post.id,
  entityData: { content: editContent, status: post.status },
});

// CopilotProvider reads this and:
// 1. Auto-loads entity-scoped conversation (if exists)
// 2. Includes entityData in system prompt
// 3. Enables "Apply" buttons that push content to the page
```

### "Apply" Pattern

When the co-pilot generates content, result cards include action buttons:
- **PostPreviewCard**: "Apply to editor" → pushes content into TipTap editor via context callback
- **IdeaListCard**: "Write this one" → triggers writePost action in co-pilot
- **PlanCard**: "Start" / "Edit plan" → controls agent execution flow
- **KnowledgeResultCard**: "Use in post" → appends entry to current draft as reference

The CopilotProvider exposes an `applyToPage(type, data)` callback that registered pages implement.

### Streaming

Frontend uses EventSource (SSE) to consume the stream:
```typescript
const eventSource = new EventSource('/api/copilot/chat', { /* POST via fetch */ });
// Actually: fetch() with ReadableStream, parsed as SSE events
// Each event type → dispatch to appropriate message/card renderer
```

---

## 6. Data Model

### `copilot_conversations`

```sql
CREATE TABLE copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT,  -- 'post' | 'lead_magnet' | 'funnel' | 'idea' | null
  entity_id UUID,
  title TEXT,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  system_context JSONB,  -- snapshot of context at conversation start
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_conv_user ON copilot_conversations(user_id, updated_at DESC);
CREATE INDEX idx_copilot_conv_entity ON copilot_conversations(user_id, entity_type, entity_id);
```

### `copilot_messages`

```sql
CREATE TABLE copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- 'user' | 'assistant' | 'tool_call' | 'tool_result'
  content TEXT,
  tool_name TEXT,
  tool_args JSONB,
  tool_result JSONB,
  feedback JSONB,  -- {rating: 'up'|'down', note?: string}
  tokens_used INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_msg_conv ON copilot_messages(conversation_id, created_at);
```

### `copilot_memories`

```sql
CREATE TABLE copilot_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  category TEXT,  -- 'tone' | 'structure' | 'vocabulary' | 'content' | 'general'
  confidence FLOAT NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL,  -- 'conversation' | 'feedback' | 'manual'
  conversation_id UUID REFERENCES copilot_conversations(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_mem_user ON copilot_memories(user_id, active, category);
```

**RLS:** All three tables: `user_id = auth.uid()` for SELECT/INSERT/UPDATE/DELETE. Service role bypass for server-side co-pilot route.

---

## 7. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/copilot/chat` | POST | Main agent loop — streaming SSE response |
| `/api/copilot/conversations` | GET | List conversations (optional entity filter) |
| `/api/copilot/conversations/[id]` | GET | Get conversation with messages |
| `/api/copilot/conversations/[id]` | DELETE | Delete conversation |
| `/api/copilot/conversations/[id]/feedback` | POST | Submit message feedback (thumbs up/down) |
| `/api/copilot/memories` | GET | List active memories |
| `/api/copilot/memories` | POST | Create manual memory |
| `/api/copilot/memories/[id]` | DELETE | Deactivate memory |

---

## 8. Phasing

### Phase 2a: Foundation

**Goal:** Working conversational AI that can write posts and search knowledge.

- Shared action layer (~15 key actions: knowledge search, write post, polish, list posts, quick write, get performance, list templates, match template, get writing styles, get business context)
- `POST /api/copilot/chat` with streaming agent loop via `getAnthropicClient('copilot')` (Helicone-routed)
- `copilot_conversations` + `copilot_messages` tables + migration
- CopilotProvider + CopilotSidebar + basic message rendering (streaming text + tool call spinners)
- System prompt with voice profile + page context
- 3 admin prompt templates registered (`copilot-system`, `copilot-memory-extractor`, `copilot-plan-generator`)
- `useCopilotContext` hook registered on post editor page

### Phase 2b: Rich Interactions

**Goal:** Multi-step workflows with rich result rendering and entity-scoped conversations.

- Expand to all ~30 actions (funnels, lead magnets, email, scheduling, analytics)
- Rich tool result cards (PostPreviewCard, KnowledgeResultCard, PlanCard, IdeaListCard)
- "Apply" button pattern → push co-pilot output into editor/page state
- Entity-scoped conversations (auto-load when opening a post/lead-magnet)
- Conversation list + history drawer
- Multi-step plan display with live progress checkboxes
- `useCopilotContext` registered on all major pages (pipeline, knowledge, funnels, lead magnets)

### Phase 2c: Learning & Memory

**Goal:** Co-pilot gets measurably better every week.

- `copilot_memories` table + auto-extraction via Haiku (`copilot-memory-extractor` prompt)
- Feedback widget on every assistant message (thumbs up/down + note)
- Memory management UI in settings (view/edit/delete)
- Negative feedback pattern aggregation into system prompt
- Edit tracking with `source: 'copilot'` tag → feeds weekly `evolve-writing-style` task
- Correction signal detection in conversation messages

---

## 9. Key Files (New)

| File | Purpose |
|------|---------|
| `src/lib/actions/types.ts` | ActionContext, ActionResult, ActionDefinition |
| `src/lib/actions/registry.ts` | COPILOT_TOOLS definitions + executor dispatch |
| `src/lib/actions/executor.ts` | Run action by name, return structured result |
| `src/lib/actions/knowledge.ts` | Knowledge search, ask, gaps, readiness, digest |
| `src/lib/actions/content.ts` | Write, polish, quick-write, list posts |
| `src/lib/actions/scheduling.ts` | Schedule, autopilot, buffer, plan |
| `src/lib/actions/lead-magnets.ts` | Create, generate, ideate |
| `src/lib/actions/funnels.ts` | Create, publish, generate content |
| `src/lib/actions/email.ts` | Sequences, broadcasts, subscribers |
| `src/lib/actions/analytics.ts` | Performance, trends, top posts |
| `src/lib/actions/templates.ts` | List, match, styles |
| `src/lib/copilot/system-prompt.ts` | buildCopilotSystemPrompt() |
| `src/lib/copilot/memory-extractor.ts` | Haiku-based preference extraction |
| `src/lib/copilot/stream.ts` | SSE streaming utilities |
| `src/app/api/copilot/chat/route.ts` | Main agent loop endpoint |
| `src/app/api/copilot/conversations/route.ts` | List conversations |
| `src/app/api/copilot/conversations/[id]/route.ts` | Get/delete conversation |
| `src/app/api/copilot/conversations/[id]/feedback/route.ts` | Message feedback |
| `src/app/api/copilot/memories/route.ts` | List/create memories |
| `src/app/api/copilot/memories/[id]/route.ts` | Delete memory |
| `src/components/copilot/CopilotProvider.tsx` | React context + SSE + state |
| `src/components/copilot/CopilotSidebar.tsx` | Slide-in panel container |
| `src/components/copilot/CopilotToggleButton.tsx` | Floating trigger button |
| `src/components/copilot/ConversationHeader.tsx` | Title, entity badge, controls |
| `src/components/copilot/MessageList.tsx` | Scrollable message container |
| `src/components/copilot/UserMessage.tsx` | User message bubble |
| `src/components/copilot/AssistantMessage.tsx` | Assistant message with tool cards |
| `src/components/copilot/ToolCallCard.tsx` | Action execution spinner |
| `src/components/copilot/PostPreviewCard.tsx` | Post result with Apply button |
| `src/components/copilot/KnowledgeResultCard.tsx` | Knowledge entries display |
| `src/components/copilot/PlanCard.tsx` | Multi-step plan with progress |
| `src/components/copilot/FeedbackWidget.tsx` | Thumbs up/down + note |
| `src/components/copilot/ConversationInput.tsx` | Text input + send |
| `src/components/copilot/ConversationListDrawer.tsx` | Thread history |
| `src/hooks/useCopilotContext.ts` | Page context registration hook |
| `supabase/migrations/YYYYMMDD_copilot_tables.sql` | DB migration |
| `src/lib/ai/content-pipeline/prompt-defaults.ts` | Add 3 copilot prompt defaults |

---

## 10. Success Metrics

| Metric | Target (90 days) |
|--------|-------------------|
| Daily co-pilot users | 40% of DAU |
| Messages per session | 5+ average |
| "Apply" button usage | 60%+ of generated content applied |
| Thumbs-up rate | 70%+ |
| Posts written via co-pilot | 30% of all posts |
| Memory count per user | 5+ after 2 weeks |
| Weekly style improvement | Measurable reduction in edit distance |
