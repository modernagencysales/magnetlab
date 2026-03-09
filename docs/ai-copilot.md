<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## AI Co-pilot (Phase 2a+2b+2c -- Feb 2026)

In-app conversational AI assistant with a shared action layer, Claude tool_use agent loop, rich result cards, confirmation dialogs, entity-scoped conversations, global sidebar UI, and self-learning memory system.

### Architecture

```
User message → CopilotProvider (SSE fetch) → POST /api/copilot/chat
  → buildCopilotSystemPrompt(userId, pageContext)
    → base prompt (admin-editable: copilot-system slug)
    → voice profile (team_profiles.voice_profile)
    → learned preferences (copilot_memories)
    → recent post performance (last 30 days engagement)
    → negative feedback patterns (aggregated corrections)
    → page context (entity type/id)
  → Claude Sonnet tool_use loop (max 15 iterations)
    → getToolDefinitions() → 22 actions as Claude tools
    → executeAction(ctx, name, args) → ActionResult
    → Confirmation dialog for destructive actions (schedule, publish, create)
    → SSE events: text_delta, tool_call, tool_result, confirmation_required, done, error
  → Persist: copilot_conversations + copilot_messages
  → Rich result cards: PostPreviewCard, KnowledgeResultCard, IdeaListCard
  → Memory extraction (fire-and-forget on correction signals + negative feedback)
```

### Shared Action Layer

Pure async functions in `src/lib/actions/` callable by both co-pilot and MCP. 22 registered actions across 8 modules:

| Module | Actions |
|--------|---------|
| `knowledge.ts` | `search_knowledge`, `list_topics`, `build_content_brief` |
| `content.ts` | `write_post`, `polish_post`, `list_posts`, `update_post_content` |
| `templates.ts` | `list_templates`, `list_writing_styles` |
| `analytics.ts` | `get_post_performance`, `get_top_posts` |
| `scheduling.ts` | `schedule_post` (confirmation), `get_autopilot_status` |
| `lead-magnets.ts` | `list_lead_magnets`, `get_lead_magnet`, `create_lead_magnet` (confirmation) |
| `funnels.ts` | `list_funnels`, `get_funnel`, `publish_funnel` (confirmation) |
| `email.ts` | `list_email_sequences`, `get_subscriber_count`, `generate_newsletter_email` |

### Confirmation Dialog System

Actions with `requiresConfirmation: true` (schedule_post, publish_funnel, create_lead_magnet):
1. Chat route sends `confirmation_required` SSE event but does NOT execute the action
2. CopilotProvider sets `pendingConfirmation` state, ConfirmationDialog renders inline
3. User clicks Confirm/Cancel → `POST /api/copilot/confirm-action`
4. If approved: API executes the action via `executeAction()`, updates stale DB row with real result, returns result to Provider
5. Provider updates local messages, auto-sends "Confirmed." to resume conversation
6. If denied: saves denial message, Provider sends "The user declined the action."

### Rich Result Cards

Tool results render specialized cards based on `displayHint`:
- `post_preview` → **PostPreviewCard**: content preview, Apply to editor + Copy buttons, variation count
- `knowledge_list` → **KnowledgeResultCard**: quality stars, knowledge_type badges, collapsible entries, Use in post
- `idea_list` → **IdeaListCard**: selectable ideas, content_type badges, hook previews, Write This action

### Entity-Scoped Conversations

Conversations optionally bind to entities via `entity_type`/`entity_id`. When the sidebar opens on a page with registered context (e.g., funnel builder), it auto-loads the matching conversation. GET `/api/copilot/conversations` supports `?entity_type=&entity_id=` filtering.

### Page Context Registration

`useCopilotContext` registered on: content pipeline, knowledge dashboard, funnel builder (entity-scoped), analytics, signals, and post editor (entity-scoped).

### Database Tables

- `copilot_conversations` — user_id, entity_type/id binding, title, model, RLS
- `copilot_messages` — conversation_id, role (user/assistant/tool_call/tool_result), content, tool_name/args/result, feedback JSONB, tokens_used
- `copilot_memories` — auto-extracted preferences (rule, category, confidence, source, active)
- Migration: `supabase/migrations/20260227500000_copilot_tables.sql`

### Admin-Editable Prompts

3 prompt slugs registered in `prompt-defaults.ts`, editable at `/admin/prompts`:
- `copilot-system` — base identity prompt (Sonnet, temp 0.7)
- `copilot-memory-extractor` — preference extraction from corrections (Haiku, temp 0.3)
- `copilot-plan-generator` — multi-step task planning (Haiku, temp 0.3)

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/copilot/chat` | POST | SSE streaming agent loop |
| `/api/copilot/conversations` | GET/POST | List (with entity filter) + create |
| `/api/copilot/conversations/[id]` | GET/DELETE | Get with messages + delete |
| `/api/copilot/conversations/[id]/feedback` | POST | Message feedback (positive/negative + optional note) |
| `/api/copilot/confirm-action` | POST | Confirmation decision + action execution |
| `/api/copilot/memories` | GET/POST | List + create learned preferences |
| `/api/copilot/memories/[id]` | PATCH/DELETE | Update (toggle active) + delete preferences |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `CopilotProvider` | React context — state, SSE, conversations, confirmation, applyToPage |
| `CopilotShell` | Client wrapper mounted in dashboard layout |
| `CopilotSidebar` | 400px slide-in panel (conversation list + chat view) |
| `CopilotToggleButton` | Floating button (bottom-right) |
| `CopilotMessage` | Markdown rendering + displayHint routing to rich cards |
| `ConversationInput` | Textarea + send/stop button |
| `ConversationHeader` | Title + entity badge (icon + entity name) + nav buttons |
| `ConfirmationDialog` | Inline amber card for destructive action approval |
| `PostPreviewCard` | Post content preview + Apply/Copy buttons |
| `KnowledgeResultCard` | Knowledge entries with quality stars + collapsible |
| `IdeaListCard` | Selectable ideas with Write This action |
| `FeedbackWidget` | Thumbs up/down with expandable note input on negative feedback |
| `useCopilotContext` | Hook for page context registration |
| `CopilotMemorySettings` | Settings UI for managing learned preferences (list, add, toggle, delete) |

### Key Files

- `src/lib/actions/` — types, registry, executor, 8 action modules, barrel import
- `src/lib/ai/copilot/system-prompt.ts` — `buildCopilotSystemPrompt()` (5-min cache, performance + feedback sections)
- `src/app/api/copilot/chat/route.ts` — streaming agent loop with confirmation blocking
- `src/app/api/copilot/conversations/` — CRUD + feedback + entity filtering
- `src/app/api/copilot/confirm-action/` — confirmation decision endpoint
- `src/lib/ai/copilot/memory-extractor.ts` — `detectCorrectionSignal()` + `extractMemories()` (Haiku)
- `src/components/copilot/` — 14 components (Provider, Shell, Sidebar, Toggle, Message, Input, Header, ConfirmationDialog, FeedbackWidget, PostPreviewCard, KnowledgeResultCard, IdeaListCard, useCopilotContext)
- `src/components/settings/CopilotMemorySettings.tsx` — memory management UI
- `src/app/(dashboard)/settings/copilot/page.tsx` — settings page
- `src/lib/ai/content-pipeline/prompt-defaults.ts` — 3 copilot prompt slugs
- `src/app/(dashboard)/layout.tsx` — CopilotShell integration

### Learning & Memory (Phase 2c)

Auto-extracts user preferences from corrections and feedback, stores them in `copilot_memories`, and injects active memories into the system prompt.

**Memory Extraction Flow:**
```
User correction ("Don't use bullet points") → detectCorrectionSignal() (5 regex patterns)
  → extractMemories() (Claude Haiku, fire-and-forget)
  → INSERT copilot_memories (source: 'conversation', category, confidence)
  → buildCopilotSystemPrompt() injects active memories

Negative feedback + note → FeedbackWidget → POST /feedback
  → extractMemories() (fire-and-forget)
  → INSERT copilot_memories (source: 'feedback')

Manual entry → Settings UI → POST /api/copilot/memories
  → INSERT copilot_memories (source: 'manual')
```

**Memory Categories:** `tone`, `structure`, `vocabulary`, `content`, `general`

**Correction Signal Detection:** 5 patterns — negation ("don't use"), preference ("I prefer"), tone complaint ("too formal"), comparative ("more like"), voice complaint ("sounds too")

**Settings UI:** `/settings/copilot` — list with category badges, source labels, toggle active/inactive, add new, delete. Nav item under "AI Co-pilot" group in SettingsNav.

**Edit Tracking:** `EditRecordInput.source` optional field (`'manual' | 'copilot'`) tags co-pilot-generated content so `evolve-writing-style` can learn from AI-generated edits.

### Tests (225 passing)

- `src/__tests__/lib/actions/` — executor (5), knowledge (3), content (4), supporting (25), lead-magnets (14), funnels (13), email (17)
- `src/__tests__/api/copilot/` — chat (6), conversations (23), confirm-action (7), memories (19)
- `src/__tests__/lib/ai/copilot/` — system-prompt (7), memory-extractor (10)
- `src/__tests__/components/copilot/` — CopilotMessage (13), ConversationInput (10), ConfirmationDialog (8), ConversationHeader (12), PostPreviewCard (10), KnowledgeResultCard (12), IdeaListCard (12), FeedbackWidget (9)
- `src/__tests__/components/settings/` — CopilotMemorySettings (6)
- `src/__tests__/lib/services/` — edit-capture (31)
