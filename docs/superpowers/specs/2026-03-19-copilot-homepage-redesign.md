# Copilot-First Homepage Redesign

> Replace the current welcome/onboarding dashboard with a copilot-centered homepage inspired by Attio's AI interface. The copilot becomes the primary way users interact with MagnetLab — full-page conversations, a `Cmd+K` command bar for quick access, and the sidebar panel is removed entirely.

## Problem

The current homepage is a static welcome page with onboarding checklists and stat cards. The copilot is a 400px sidebar that slides in from a floating button — it feels like a helpdesk widget, not a core product feature. Users don't discover it, and when they do, the cramped sidebar limits what it can display (post previews, knowledge cards, content review panels all fight for space).

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Layout | Copilot-centered (greeting + prompt + suggestions + stats) | AI is the primary interface, not a sidebar add-on |
| Conversation UX | Full-page chat (like Attio) | Centered messages, inline tool indicators, room for rich content |
| Copilot access from other pages | `Cmd+K` command bar overlay | Quick access without helpdesk sidebar feel |
| Sidebar panel | Remove entirely | Replaced by full-page conversations + command bar |
| Suggestion chips | Dynamic based on actual state | Static chips become invisible; "3 posts need review" is actionable |
| Stats section | Cards with week-over-week trends | Glanceable "how am I doing" without asking the copilot |
| Homepage system prompt | Full briefing (queue, leads, autopilot, campaigns) | Homepage copilot should feel like an assistant who read your morning report |

## Architecture

### Page Structure

```
/(dashboard)/page.tsx (homepage)
├── CopilotHomepage (new component)
│   ├── GreetingSection — "Good afternoon, Tim" + status summary line
│   ├── PromptBox — large centered input, submit creates conversation
│   ├── SuggestionChips — dynamic chips from homepage data
│   ├── StatsCards — 4 metric cards with week-over-week trends
│   └── RecentConversations — clickable list to resume past conversations
│
/(dashboard)/copilot/[id]/page.tsx (conversation page — NEW)
├── CopilotConversation (new component)
│   ├── ConversationHeader — title, back button, conversation menu
│   ├── MessageList — centered messages (user right-aligned, assistant left)
│   │   ├── UserMessage
│   │   ├── AssistantMessage — with inline ToolIndicator, rich cards
│   │   └── ActionConfirmation — inline confirm/cancel for tool calls
│   └── PromptInput — persistent bottom input with streaming state
│
CommandBar (global overlay — NEW)
├── Triggered by Cmd+K from any page
├── Captures current page context before opening
├── Single input field with recent conversations
└── Submit → navigate to /copilot/new?message=... (chat API creates conversation)
```

### Conversation Creation Flow

The existing `/api/copilot/chat` endpoint already creates a conversation when `conversationId` is `'new'` or missing. We use this — no separate creation step.

```
User types prompt (homepage or Cmd+K):
  → Navigate to /copilot/new?message=<encoded>&context=<encoded>
  → Conversation page mounts, reads query params
  → POST /api/copilot/chat with conversationId='new' + initial message
  → Chat API creates conversation, streams response
  → URL updates to /copilot/[newId] via router.replace()
```

No race condition, no wasted API calls. The `new` page state shows a loading indicator until the first SSE event arrives.

### CopilotProvider Migration

CopilotProvider **cannot be simply removed** — 11+ files depend on `useCopilot()` and `useCopilotContext()`. The migration:

**Refactor CopilotProvider** into two pieces:
1. **`CopilotNavigator`** (new) — lightweight provider that replaces `useCopilot().open/sendMessage` with `startConversation(message, pageContext?)` which navigates to `/copilot/new?message=...&context=...`. No sidebar state, no streaming, no message rendering.
2. **`useCopilotPageContext()`** (keep) — pages continue registering their context. The context is captured by `Cmd+K` and passed to the conversation page. No changes needed to consumer pages.

**Consumer migration:**

| File | Current Usage | New Usage |
|------|--------------|-----------|
| `MagnetsListClient.tsx` | `useCopilot().open(); sendMessage("Generate posts for...")` | `useCopilotNavigator().startConversation("Generate posts for...", pageContext)` |
| `IdeasTab.tsx` | `useCopilot().open(); sendMessage("Write a post based on...")` | `useCopilotNavigator().startConversation("Write a post...", pageContext)` |
| `WizardContainer.tsx` | `useCopilotContext()` for page context | `useCopilotPageContext()` — unchanged |
| 8 other pages | `useCopilotContext()` for page context | `useCopilotPageContext()` — unchanged |

**`applyToPage` capability**: Currently, some copilot cards have an "Apply" button that writes content back into the current page's editor. This breaks when the conversation is on a separate page. **Deferred** — replace with "Copy to clipboard" in MVP. Full `applyToPage` requires cross-page messaging (future).

### Data Flow

```
Homepage Load:
  → GET /api/copilot/homepage-data
    → Returns: suggestions[], stats[], recentConversations[]
    → Single endpoint, single round-trip

Prompt Submit (homepage or Cmd+K):
  → Capture page context (if Cmd+K)
  → Navigate to /copilot/new?message=<encoded>&context=<encoded>
  → Conversation page: POST /api/copilot/chat (conversationId='new')
  → Chat API creates conversation, returns ID in first SSE event
  → router.replace(/copilot/[id]) to update URL
  → SSE stream continues → render messages

Full-Page Conversation:
  → Same /api/copilot/chat endpoint (unchanged)
  → Same action system (unchanged)
  → Same tool confirmation flow (unchanged)
  → New rendering surface (full-width instead of 400px sidebar)
```

### Components to Build

#### 1. CopilotHomepage

Replaces the current `/(dashboard)/page.tsx` content.

```
┌─────────────────────────────────────────────┐
│                                             │
│         Good afternoon, Tim                 │
│   3 posts ready for review · 12 new leads   │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  What would you like to work on?    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [Review content queue] [Draft posts]       │
│  [Check new leads] [Create lead magnet]     │
│                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───┐ │
│  │ Posts    │ │ Views   │ │ Leads   │ │ M │ │
│  │ 24      │ │ 847     │ │ 38      │ │ 5 │ │
│  │ +3/wk   │ │ -5%     │ │ +12/wk  │ │   │ │
│  └─────────┘ └─────────┘ └─────────┘ └───┘ │
│                                             │
│         Recent conversations                │
│  ┌─ Draft LinkedIn posts ─── 2h ago ──────┐ │
│  ┌─ Create lead magnet ──── Yesterday ────┐ │
│  ┌─ Analyze top content ─── 2 days ago ──┐ │
│                                             │
└─────────────────────────────────────────────┘
```

#### 2. CopilotConversation (full-page)

New page at `/(dashboard)/copilot/[id]/page.tsx`. Also handles `/copilot/new` for new conversations.

```
┌─────────────────────────────────────────────┐
│  ← Back   Jeffrey Nolte call transcript   ⋮ │
│─────────────────────────────────────────────│
│                                             │
│         ┌──────────────────────────┐        │
│         │ is there a transcript... │  (user) │
│         └──────────────────────────┘        │
│                                             │
│  Let me search for a call recording...      │
│  ◎ Searched call recordings: 7 results      │
│                                             │
│  The results show calls involving both...   │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Ask anything...              ▲     │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

Key rendering elements:
- **User messages**: Right-aligned bubbles (dark background)
- **Assistant messages**: Left-aligned, full-width text (no bubble)
- **Tool indicators**: Inline pill showing tool name + result count
- **Rich cards**: Inline rendered cards for tool results (post previews, knowledge entries, lead cards)
- **Action confirmations**: Inline confirmation UI (same logic as current sidebar, wider layout)
- **Content review**: Rendered inline in the message stream (full-width). No overlay needed — the conversation page has enough space. Approve/request changes send a follow-up message in the conversation.

**Edge cases:**
- Invalid/deleted conversation ID → redirect to homepage with toast
- Streaming error (500) → show error message inline with "Retry" button
- Navigate away during stream → abort SSE connection in cleanup
- New conversation (no messages yet) → show centered prompt, no message list

#### 3. CommandBar (Cmd+K)

Global overlay accessible from any page.

```
┌─────────────────────────────────────────────┐
│  (dimmed page behind)                       │
│                                             │
│       ┌────────────────────────────┐        │
│       │ Ask copilot...             │        │
│       │                            │        │
│       │  Recent:                   │        │
│       │  ↳ Draft LinkedIn posts    │        │
│       │  ↳ Create lead magnet      │        │
│       │  ↳ Analyze top content     │        │
│       └────────────────────────────┘        │
│                                             │
└─────────────────────────────────────────────┘
```

Behavior:
- `Cmd+K` (Mac) / `Ctrl+K` (Windows) opens overlay
- `Escape` closes
- On open: captures current page context from `useCopilotPageContext()`
- Shows recent conversations as quick-resume options (shared component with homepage)
- Typing + Enter → navigate to `/copilot/new?message=...&context=...`
- Clicking a recent conversation → navigate to `/copilot/[id]`

### API Changes

#### New: GET /api/copilot/homepage-data

Combined endpoint returning suggestions, stats, and recent conversations in one response.

```typescript
// Response
{
  suggestions: [
    { label: "3 posts need review", action: "Review my content queue", priority: 1 },
    { label: "12 new leads this week", action: "Show me this week's new leads", priority: 2 },
    { label: "Autopilot running", action: "How is autopilot performing?", priority: 3 },
  ],
  stats: [
    { key: "posts", label: "Posts", value: 24, change: "+3", changeType: "positive", period: "this week" },
    { key: "views", label: "Views", value: 847, change: "-5%", changeType: "negative", period: "vs last week" },
    { key: "leads", label: "Leads", value: 38, change: "+12", changeType: "positive", period: "this week" },
    { key: "magnets", label: "Magnets", value: 5, change: null, changeType: "neutral", sublabel: "2 published" },
  ],
  recentConversations: [
    { id: "uuid", title: "Draft LinkedIn posts", updatedAt: "2026-03-19T12:00:00Z" },
  ]
}
```

Data sources:
- **Posts count + trend**: `cp_pipeline_posts` count with 7-day comparison
- **Views**: `page_views` from funnel pages, 7-day comparison
- **Leads count + trend**: `funnel_leads` created in last 7 days vs prior 7
- **Magnets count**: `lead_magnets` total + published count
- **Content queue**: `cp_pipeline_posts` with `status = 'pending_review'`
- **Autopilot**: `cp_posting_slots` next scheduled + `cp_content_ideas` available count
- **Campaigns**: Active `post_campaigns` + `outreach_campaigns` count
- **Recent conversations**: `copilot_conversations` ordered by `updated_at` limit 5

Uses `getDataScope()` for all queries. Client-side: 60-second SWR stale-while-revalidate.

#### Modified: POST /api/copilot/chat

Add optional `briefing: boolean` and `sourceContext: PageContext` to request body.

When `briefing: true` (set by conversations started from homepage), the system prompt includes the full status briefing. The briefing data is fetched by a shared `fetchBriefingData(supabase, scope)` function that both the homepage-data endpoint and the system prompt builder use.

When `sourceContext` is provided (set by conversations started via Cmd+K), it's injected as the page context in the system prompt even though the user is now on the `/copilot/[id]` page.

### System Prompt Briefing

`fetchBriefingData(supabase, scope)` → shared function returning:

```typescript
interface BriefingData {
  queueCount: number;
  scheduledThisWeek: number;
  autopilotStatus: 'running' | 'paused' | 'no_ideas';
  ideasRemaining: number;
  nextScheduledPost: string | null;
  newLeadsCount: number;
  newLeadsBySource: { source: string; count: number }[];
  activeCampaigns: { postCampaigns: number; outreachSequences: number };
  magnetCount: number;
  publishedMagnetCount: number;
}
```

Injected into system prompt as:

```
## Current Status Briefing

Content Queue: 3 posts pending review, 2 scheduled for this week
Autopilot: Running — 8 ideas remaining, next post scheduled tomorrow 9am
New Leads: 12 this week
  - 5 from "Agency Growth Guide" (lead magnet)
  - 4 from LinkedIn post campaigns
  - 3 from organic opt-in
Active Campaigns: 2 post campaigns, 1 outreach sequence
Lead Magnets: 5 total (2 published with funnels, 3 drafts)

The user is on the homepage and may ask about any of these. Proactively
reference relevant status when it's useful context for their question.
```

### What Changes

#### Remove
- `src/components/copilot/CopilotSidebar.tsx` — the 400px slide-in panel
- `src/components/copilot/CopilotButton.tsx` — floating trigger button
- `src/components/copilot/CopilotShell.tsx` — wrapper mounting Provider + Sidebar + Toggle
- Current homepage content in `/(dashboard)/page.tsx` — replaced entirely

#### Refactor (not remove)
- `src/components/copilot/CopilotProvider.tsx` → split into `CopilotNavigator` (navigation-only, no sidebar state) + keep `useCopilotPageContext()` for page context registration
- `src/components/copilot/ContentReviewPanel.tsx` → adapt to render inline in message stream instead of as full-screen overlay
- Message rendering components → adjust widths/layout for full-page (currently sized for 400px)

#### Keep (unchanged)
- `POST /api/copilot/chat` — streaming chat endpoint (minor: add `briefing` + `sourceContext` fields)
- `POST /api/copilot/conversations` — conversation CRUD
- `POST /api/copilot/confirm-action` — tool confirmation
- `src/lib/actions/*` — all action handlers

#### Modify
- `src/lib/ai/copilot/system-prompt.ts` — add briefing section, use shared `fetchBriefingData()`
- `src/app/(dashboard)/layout.tsx` — replace CopilotShell with CopilotNavigator + CommandBar
- `src/components/dashboard/AppSidebar.tsx` — add "Copilot" nav item linking to homepage
- `src/components/magnets/MagnetsListClient.tsx` — replace `useCopilot().open/sendMessage` with `useCopilotNavigator().startConversation()`
- `src/components/content-pipeline/IdeasTab.tsx` — same migration

#### Add
- `src/components/copilot/CopilotHomepage.tsx` — homepage component
- `src/components/copilot/CopilotConversation.tsx` — full-page conversation
- `src/components/copilot/CopilotNavigator.tsx` — lightweight provider (navigation + context only)
- `src/components/copilot/CommandBar.tsx` — Cmd+K overlay
- `src/components/copilot/SuggestionChips.tsx` — dynamic suggestion chips
- `src/components/copilot/StatsCards.tsx` — metric cards with trends
- `src/components/copilot/ConversationList.tsx` — recent conversations (shared: homepage + command bar)
- `src/app/(dashboard)/copilot/[id]/page.tsx` — conversation route
- `src/app/api/copilot/homepage-data/route.ts` — combined homepage data endpoint
- `src/server/services/copilot-briefing.service.ts` — shared briefing data fetcher
- `src/frontend/hooks/api/useHomepageData.ts` — combined hook for homepage data

### Migration Path

1. Build `fetchBriefingData()` shared service + homepage-data API endpoint
2. Build `CopilotNavigator` provider (extract from CopilotProvider, navigation-only)
3. Build full-page conversation view, reusing message rendering components at full width
4. Build CopilotHomepage (prompt + suggestions + stats + recent conversations)
5. Build CommandBar (Cmd+K overlay)
6. Migrate consumer pages (`MagnetsListClient`, `IdeasTab`, etc.) from `useCopilot()` to `useCopilotNavigator()`
7. Replace CopilotShell with CopilotNavigator + CommandBar in layout
8. Remove old sidebar components (CopilotSidebar, CopilotButton, CopilotShell)
9. Test all pages that used `useCopilotContext()`

### Scope Boundaries

**In scope:**
- New homepage layout (prompt + suggestions + stats + recent conversations)
- Full-page conversation view with inline content review
- `Cmd+K` command bar with page context capture
- Combined homepage-data API endpoint
- System prompt briefing injection via shared service
- CopilotProvider → CopilotNavigator refactor
- Consumer migration (MagnetsListClient, IdeasTab)
- Remove sidebar copilot

**Out of scope (future):**
- Follow-up suggestions below assistant messages (requires SSE protocol changes or prompt engineering)
- Conversation search/filtering
- Conversation sharing between team members
- Conversation pinning/starring
- `applyToPage` cross-page messaging (replaced with "copy to clipboard" for MVP)
- Mobile-specific layouts (responsive but not mobile-first)
- Conversation branching/forking
- Voice input
