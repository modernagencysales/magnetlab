# AI Co-pilot

In-app conversational AI assistant. Claude tool_use loop, 22 actions, confirmation dialogs for destructive ops, entity-scoped conversations, self-learning memory.

## Architecture

```
User message → POST /api/copilot/chat → buildCopilotSystemPrompt() → Claude Sonnet tool_use loop
  → executeAction() → ConfirmationDialog (schedule, publish, create) → SSE events
  → Persist: copilot_conversations + copilot_messages
```

## Actions (22 across 8 modules)

`knowledge` (search, topics, brief) | `content` (write, polish, list) | `templates`, `analytics`, `scheduling` | `lead-magnets`, `funnels`, `email`

## API Routes

`/api/copilot/chat` (POST, SSE) | `conversations` (GET/POST) | `conversations/[id]` (GET/DELETE) | `conversations/[id]/feedback` | `confirm-action` | `memories` (CRUD)

## Memory System

Auto-extracts preferences from corrections + negative feedback → `copilot_memories` → injected into system prompt. Categories: `tone`, `structure`, `vocabulary`, `content`, `general`.

## Key Files

- `src/lib/actions/` — registry, executor, 8 action modules
- `src/app/api/copilot/chat/route.ts` — streaming agent loop
- `src/lib/ai/copilot/memory-extractor.ts` — preference extraction
- `src/components/copilot/` — Provider, Sidebar, Message, ConfirmationDialog, FeedbackWidget, result cards
