# Copilot-First Homepage Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sidebar copilot with a full-page Attio-style conversation experience, centered homepage with dynamic suggestions, and Cmd+K command bar.

**Architecture:** Backend stays mostly untouched — one new API endpoint, minor chat route modification, shared briefing service. Frontend is the bulk: new conversation page, new homepage, CopilotProvider refactored to CopilotNavigator, command bar overlay, old sidebar removed.

**Tech Stack:** Next.js 15 App Router, React 18, @magnetlab/magnetui (Radix + CVA + Tailwind), Supabase, SSE streaming, @anthropic-ai/sdk

**Spec:** `docs/superpowers/specs/2026-03-19-copilot-homepage-redesign.md`

---

## Task 1: Briefing Data Service

Build the shared `fetchBriefingData()` function that powers both the homepage-data API and the system prompt briefing section.

**Files:**
- Create: `src/server/services/copilot-briefing.service.ts`
- Test: `src/__tests__/server/services/copilot-briefing.service.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/__tests__/server/services/copilot-briefing.service.test.ts
import { fetchBriefingData, formatBriefingPrompt } from '@/server/services/copilot-briefing.service';

// Mock supabase
const mockFrom = jest.fn();
const mockSupabase = { from: mockFrom } as any;

function mockQuery(data: any) {
  return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), lt: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(), single: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data, error: null }), then: jest.fn() };
}

describe('fetchBriefingData', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns typed briefing data with all fields', async () => {
    // Mock all 6 queries that fetchBriefingData makes
    const queueQuery = mockQuery([{ id: '1' }, { id: '2' }, { id: '3' }]);
    const postsQuery = mockQuery([{ id: '1' }]);
    const leadsQuery = mockQuery([{ id: '1', source: 'organic' }]);
    const ideasQuery = mockQuery([{ id: '1' }]);
    const campaignsQuery = mockQuery([{ id: '1', status: 'active' }]);
    const magnetsQuery = mockQuery([{ id: '1', status: 'published' }]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'cp_pipeline_posts') return queueQuery;
      if (table === 'cp_posting_slots') return postsQuery;
      if (table === 'funnel_leads') return leadsQuery;
      if (table === 'cp_content_ideas') return ideasQuery;
      if (table === 'post_campaigns') return campaignsQuery;
      if (table === 'lead_magnets') return magnetsQuery;
      return mockQuery([]);
    });

    const result = await fetchBriefingData(mockSupabase, { type: 'user', userId: 'u1' });

    expect(result).toHaveProperty('queueCount');
    expect(result).toHaveProperty('autopilotStatus');
    expect(result).toHaveProperty('newLeadsCount');
    expect(result).toHaveProperty('activeCampaigns');
    expect(result).toHaveProperty('magnetCount');
    expect(typeof result.queueCount).toBe('number');
  });
});

describe('formatBriefingPrompt', () => {
  it('formats briefing data into readable prompt section', () => {
    const data = {
      queueCount: 3, scheduledThisWeek: 2,
      autopilotStatus: 'running' as const, ideasRemaining: 8,
      nextScheduledPost: '2026-03-20T09:00:00Z',
      newLeadsCount: 12, newLeadsBySource: [{ source: 'organic', count: 5 }],
      activeCampaigns: { postCampaigns: 2, outreachSequences: 1 },
      magnetCount: 5, publishedMagnetCount: 2,
    };

    const prompt = formatBriefingPrompt(data);
    expect(prompt).toContain('## Current Status Briefing');
    expect(prompt).toContain('3 posts pending review');
    expect(prompt).toContain('12');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern="copilot-briefing" --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the briefing service**

Create `src/server/services/copilot-briefing.service.ts` with:
- `BriefingData` interface (matching spec)
- `fetchBriefingData(supabase, scope)` — runs parallel queries against `cp_pipeline_posts` (queue count), `cp_posting_slots` (scheduled), `cp_content_ideas` (ideas remaining), `funnel_leads` (new leads by source), `post_campaigns` + `outreach_campaigns` (active counts), `lead_magnets` (total + published)
- `formatBriefingPrompt(data)` — converts BriefingData to the markdown section for the system prompt
- Use `applyScope()` from `@/lib/utils/team-context` on all queries
- Use `Promise.all()` for parallel queries (6 independent queries)

Reference: `src/app/(dashboard)/page.tsx` lines 53-178 for existing query patterns against these same tables.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern="copilot-briefing" --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/copilot-briefing.service.ts src/__tests__/lib/services/copilot-briefing.test.ts
git commit -m "feat(copilot): add briefing data service for homepage + system prompt"
```

---

## Task 2: Homepage Data API Endpoint

Single endpoint returning suggestions, stats, and recent conversations.

**Files:**
- Create: `src/app/api/copilot/homepage-data/route.ts`
- Test: `src/__tests__/api/copilot/homepage-data.test.ts`

- [ ] **Step 1: Write the test**

Test GET handler: auth check (401 without session), returns suggestions/stats/conversations shape. Mock `fetchBriefingData` and Supabase queries. Verify response matches spec shape.

- [ ] **Step 2: Run test — verify FAIL**

- [ ] **Step 3: Implement the route**

Create `src/app/api/copilot/homepage-data/route.ts`:
- Auth via `auth()` session check
- Get scope via `getDataScope(session.user.id)`
- Call `fetchBriefingData(supabase, scope)` for suggestions + stats
- Query `copilot_conversations` for recent conversations (limit 5, ordered by `updated_at` desc)
- Transform briefing data into `suggestions[]` array (map queue count → suggestion, leads → suggestion, etc.)
- Transform briefing data into `stats[]` array (posts, views, leads, magnets with trends)
- Return combined `{ suggestions, stats, recentConversations }`

Reference: Spec lines 212-242 for response shape.

- [ ] **Step 4: Run test — verify PASS**

- [ ] **Step 5: Commit**

```bash
git add src/app/api/copilot/homepage-data/route.ts src/__tests__/api/copilot/homepage-data.test.ts
git commit -m "feat(copilot): add homepage-data API endpoint"
```

---

## Task 3: System Prompt Briefing Integration

Wire briefing data into the existing system prompt builder.

**Files:**
- Modify: `src/lib/ai/copilot/system-prompt.ts`
- Modify: `src/app/api/copilot/chat/route.ts`

- [ ] **Step 1: Add briefing to system prompt builder**

Modify `buildCopilotSystemPrompt()` signature to accept optional `briefing?: boolean` parameter. When true, call `fetchBriefingData()` and append `formatBriefingPrompt()` output to the sections array. Add it after the voice profile section (section 2) and before memories (section 3).

Add `sourceContext?: PageContext` parameter — when provided, use it instead of the `pageContext` parameter for the page context section. This supports Cmd+K conversations that carry context from the originating page.

**IMPORTANT:** Update the prompt cache key (line 82 of system-prompt.ts) to include `briefing` flag: `const cacheKey = \`${scopeKey}:${pageContext?.page || 'none'}:${pageContext?.entityId || 'none'}:${briefing ? 'briefed' : 'standard'}\``. Without this, a cached non-briefing prompt could be returned for a briefing request.

- [ ] **Step 2: Update chat route to pass briefing flag**

In `src/app/api/copilot/chat/route.ts`, add `briefing` and `sourceContext` to the request body parsing. Pass them through to `buildCopilotSystemPrompt()`.

- [ ] **Step 3: Run existing copilot tests to verify no regressions**

Run: `pnpm test -- --testPathPattern="copilot" --no-coverage`
Expected: All existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/copilot/system-prompt.ts src/app/api/copilot/chat/route.ts
git commit -m "feat(copilot): add briefing injection to system prompt"
```

---

## Task 4: CopilotNavigator Provider

Lightweight replacement for CopilotProvider — navigation + page context only, no sidebar state or streaming.

**Files:**
- Create: `src/components/copilot/CopilotNavigator.tsx`
- Test: `src/__tests__/components/copilot/copilot-navigator.test.ts`

- [ ] **Step 1: Write test**

Test `useCopilotNavigator()` hook:
- `startConversation(message)` calls `router.push('/copilot/new?message=...')`
- `startConversation(message, context)` includes encoded context in URL
- `pageContext` is null by default
- `setPageContext(ctx)` updates `pageContext`

- [ ] **Step 2: Run test — verify FAIL**

- [ ] **Step 3: Implement CopilotNavigator**

Create `src/components/copilot/CopilotNavigator.tsx`:
```typescript
// Exports:
// - CopilotNavigatorProvider — wraps children with context
// - useCopilotNavigator() — returns { startConversation, pageContext, setPageContext }
// - useCopilotPageContext(context) — hook that registers page context (drop-in replacement for existing useCopilotContext)
```

Key implementation:
- `startConversation(message: string, context?: PageContext)` → `router.push(`/copilot/new?message=${encodeURIComponent(message)}${context ? `&context=${encodeURIComponent(JSON.stringify(context))}` : ''}`)`
- `pageContext` state managed via `useState<PageContext | null>(null)`
- `useCopilotPageContext(ctx)` wraps `useEffect` to set/clear context (same as current `useCopilotContext`)

This is ~60 lines. No streaming, no message state, no sidebar.

- [ ] **Step 4: Run test — verify PASS**

- [ ] **Step 5: Commit**

```bash
git add src/components/copilot/CopilotNavigator.tsx src/__tests__/components/copilot/copilot-navigator.test.ts
git commit -m "feat(copilot): add CopilotNavigator provider (navigation-only)"
```

---

## Task 5: Full-Page Conversation View

The core UI — full-page chat with SSE streaming, message rendering, and tool confirmation.

**Files:**
- Create: `src/app/(dashboard)/copilot/[id]/page.tsx`
- Create: `src/components/copilot/CopilotConversation.tsx`
- Create: `src/components/copilot/PromptInput.tsx`
- Create: `src/components/copilot/MessageList.tsx`

- [ ] **Step 1: Create the route page**

Create `src/app/(dashboard)/copilot/[id]/page.tsx`:
- Server component that passes `params.id` to `<CopilotConversation />`
- Also handles `id === 'new'` — reads `searchParams.message` and `searchParams.context`

- [ ] **Step 2: Create PromptInput component**

Create `src/components/copilot/PromptInput.tsx`:
- Textarea with auto-resize
- Enter to send (Shift+Enter for newline) — same behavior as current `ConversationInput.tsx`
- Cancel button when streaming
- Disabled state during streaming
- Props: `onSubmit(text)`, `onCancel()`, `isStreaming`, `disabled`

Port from existing `src/components/copilot/ConversationInput.tsx` but adjust for full-width layout.

- [ ] **Step 3: Create MessageList component**

Create `src/components/copilot/MessageList.tsx`:
- Renders array of messages
- User messages: right-aligned dark bubbles (max-width ~70%)
- Assistant messages: left-aligned, full-width, no bubble, markdown rendered
- Tool indicators: inline pill (`"Searched call recordings: 7 results"`)
- Rich cards: reuse existing `PostPreviewCard`, `KnowledgeResultCard`, `IdeaListCard`
- Action confirmation: inline confirm/cancel (reuse `ConfirmationDialog` logic)
- Auto-scroll to bottom on new messages
- Replace `applyToPage` buttons with "Copy to clipboard" (per spec — `applyToPage` deferred)

Port rendering logic from existing `CopilotMessage.tsx` but adjust layout. Key difference: messages are centered in a `max-w-3xl mx-auto` container, not cramped into 400px.

- [ ] **Step 4: Create CopilotConversation component**

Create `src/components/copilot/CopilotConversation.tsx` — the main conversation container:

```typescript
// Props: { conversationId: string, initialMessage?: string, sourceContext?: PageContext }
```

This component contains the SSE streaming logic. Port from `CopilotProvider.tsx` lines 200-350 (the `sendMessage` function and SSE parsing). Key pieces:
- `messages` state array
- `isStreaming` state
- `sendMessage(text)` → POST `/api/copilot/chat` with SSE
- `parseSSELines()` from Provider (move to shared util or inline)
- `confirmAction(toolUseId, approved)` → POST `/api/copilot/confirm-action`
- `conversationId` state (starts as prop, updated when API returns new ID)
- `useEffect` on mount: if `initialMessage`, auto-send it
- `useEffect` on mount: if existing conversation, load messages from `/api/copilot/conversations/[id]`
- Error state: show inline error message with retry button
- Cleanup: abort SSE on unmount

Header: back button (→ `/`), conversation title, delete button.

Reference files:
- `src/components/copilot/CopilotProvider.tsx` lines 200-350 for SSE logic
- `src/components/copilot/CopilotSidebar.tsx` for rendering structure
- `src/components/copilot/ConversationHeader.tsx` for header layout

- [ ] **Step 5: Test manually**

Navigate to `/copilot/new?message=hello` in browser. Verify:
- Message streams in
- Tool calls render inline
- Confirmation dialogs work
- URL updates to `/copilot/[id]` after conversation created
- Back button returns to homepage

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/copilot/ src/components/copilot/CopilotConversation.tsx src/components/copilot/PromptInput.tsx src/components/copilot/MessageList.tsx
git commit -m "feat(copilot): full-page conversation view with SSE streaming"
```

---

## Task 6: Homepage Data Hook

Client-side hook for the homepage to fetch suggestions, stats, and recent conversations.

**Files:**
- Create: `src/frontend/hooks/api/useHomepageData.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/frontend/hooks/api/useHomepageData.ts
import useSWR from 'swr';

interface Suggestion { label: string; action: string; priority: number; }
interface StatCard { key: string; label: string; value: number; change: string | null; changeType: 'positive' | 'negative' | 'neutral'; period: string; sublabel?: string; }
interface RecentConversation { id: string; title: string; updatedAt: string; }
interface HomepageData { suggestions: Suggestion[]; stats: StatCard[]; recentConversations: RecentConversation[]; }

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useHomepageData() {
  return useSWR<HomepageData>('/api/copilot/homepage-data', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,  // 60s SWR cache
  });
}
```

NOTE: Do NOT use `apiClient.get` as the SWR fetcher — it prepends `/api` to paths, causing double-prefix (`/api/api/...`). Use a plain fetch wrapper instead.

- [ ] **Step 2: Commit**

```bash
git add src/frontend/hooks/api/useHomepageData.ts
git commit -m "feat(copilot): add useHomepageData hook"
```

---

## Task 7: Homepage UI Components

Build the copilot-centered homepage: greeting, prompt box, suggestion chips, stat cards, recent conversations.

**Files:**
- Create: `src/components/copilot/CopilotHomepage.tsx`
- Create: `src/components/copilot/SuggestionChips.tsx`
- Create: `src/components/copilot/StatsCards.tsx`
- Create: `src/components/copilot/ConversationList.tsx`
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Create SuggestionChips**

`src/components/copilot/SuggestionChips.tsx`:
- Renders array of `Suggestion` objects as clickable chips
- Click → calls `onSelect(suggestion.action)` (which will trigger `startConversation`)
- Style: `bg-card border border-border rounded-full px-4 py-2 text-sm text-muted-foreground hover:bg-accent cursor-pointer`
- Wrap in flex container with `flex-wrap gap-2 justify-center`

- [ ] **Step 2: Create StatsCards**

`src/components/copilot/StatsCards.tsx`:
- Renders array of `StatCard` objects in a 4-column grid
- Each card: label (uppercase muted), value (large bold), change indicator (green/red/gray)
- Style: `bg-card border border-border rounded-lg p-4` per card
- Grid: `grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto`

- [ ] **Step 3: Create ConversationList**

`src/components/copilot/ConversationList.tsx`:
- Shared component used by both homepage and command bar
- Renders array of `RecentConversation` as clickable rows
- Each row: title + relative timestamp ("2h ago", "Yesterday")
- Click → `router.push('/copilot/[id]')`
- Props: `conversations[]`, `onSelect(id)`, `maxItems?`

- [ ] **Step 4: Create CopilotHomepage**

`src/components/copilot/CopilotHomepage.tsx`:
- Uses `useHomepageData()` hook
- Uses `useCopilotNavigator()` for `startConversation`
- Layout: vertically centered content, max-width ~640px
- Sections in order:
  1. Greeting: "Good afternoon, {name}" + summary line from suggestions
  2. Prompt box: large input, submit calls `startConversation(text)`
  3. SuggestionChips: from `data.suggestions`, click fills prompt + submits
  4. StatsCards: from `data.stats`
  5. ConversationList: from `data.recentConversations`
- Loading state: skeleton placeholders
- Error state: "Unable to load dashboard data" with retry

Reference: Attio's centered prompt layout. Use time-of-day greeting (`getHours()` < 12 → morning, < 17 → afternoon, else evening).

- [ ] **Step 5: Replace homepage content**

Modify `src/app/(dashboard)/page.tsx`:
- Replace ALL existing content (the welcome page, onboarding, stats)
- Import and render `<CopilotHomepage />`
- **NOTE:** Current page is a Server Component (no `'use client'`). The new page needs to be a Client Component (uses hooks). Add `'use client'` directive.
- Remove `export const metadata` and `export const dynamic` (not valid in Client Components)
- Remove old imports, query functions, Suspense wrappers, and `fetchDashboardStats()`

- [ ] **Step 6: Test manually**

Visit `/` in browser. Verify:
- Greeting shows with correct time of day
- Prompt box is centered and large
- Suggestion chips load dynamically
- Stats cards show with trends
- Recent conversations list loads
- Clicking a suggestion starts a conversation
- Typing in prompt and hitting enter navigates to conversation page

- [ ] **Step 7: Commit**

```bash
git add src/components/copilot/CopilotHomepage.tsx src/components/copilot/SuggestionChips.tsx src/components/copilot/StatsCards.tsx src/components/copilot/ConversationList.tsx src/app/\(dashboard\)/page.tsx
git commit -m "feat(copilot): copilot-centered homepage with suggestions, stats, and conversations"
```

---

## Task 8: Command Bar (Cmd+K)

Global overlay for quick copilot access from any page.

**Files:**
- Create: `src/components/copilot/CommandBar.tsx`

- [ ] **Step 1: Implement CommandBar**

`src/components/copilot/CommandBar.tsx`:
- Portal-rendered modal overlay (use `@magnetlab/magnetui` Dialog or custom)
- Global `Cmd+K` / `Ctrl+K` listener via `useEffect` with `keydown` handler
- State: `isOpen`, `query` (input text)
- On open: capture current `pageContext` from `useCopilotNavigator()`
- Renders:
  - Backdrop (semi-transparent black)
  - Centered card (~500px wide) with:
    - Input field (auto-focused, placeholder "Ask copilot...")
    - Below input: `<ConversationList />` showing recent conversations
- Submit (Enter): `startConversation(query, capturedContext)`, close overlay
- Click recent conversation: `router.push('/copilot/[id]')`, close overlay
- Escape: close overlay
- Click backdrop: close overlay

Keyboard handling:
- `Cmd+K` / `Ctrl+K` → toggle open
- Input captures all keys when open (no propagation)
- Arrow keys to navigate recent list (optional, can defer)

- [ ] **Step 2: Test manually**

From any page (e.g., `/posts`), press `Cmd+K`. Verify:
- Overlay appears with input focused
- Recent conversations show
- Typing + Enter creates conversation and navigates
- Escape closes
- Page context is captured (verify in conversation system prompt)

- [ ] **Step 3: Commit**

```bash
git add src/components/copilot/CommandBar.tsx
git commit -m "feat(copilot): Cmd+K command bar overlay"
```

---

## Task 9: Add CopilotNavigator to Layout + Migrate Consumers

**IMPORTANT ordering:** CopilotNavigatorProvider MUST be in the component tree BEFORE any consumer uses `useCopilotNavigator()`. We temporarily nest it inside the existing CopilotShell, then Task 10 removes CopilotShell.

**Files:**
- Modify: `src/components/magnets/MagnetsListClient.tsx`
- Modify: `src/components/content-pipeline/IdeasTab.tsx`
- Modify: `src/app/(dashboard)/campaigns/page.tsx`
- Modify: `src/app/(dashboard)/campaigns/[id]/page.tsx`
- Modify: `src/app/(dashboard)/post-campaigns/page.tsx`
- Modify: `src/app/(dashboard)/post-campaigns/new/page.tsx`
- Modify: `src/app/(dashboard)/post-campaigns/[id]/page.tsx`
- Modify: `src/app/(dashboard)/signals/page.tsx`
- Modify: Any other files found via grep for `useCopilot\b` or `useCopilotContext`

- [ ] **Step 1: Add CopilotNavigatorProvider to layout (temporarily alongside CopilotShell)**

In `src/app/(dashboard)/layout.tsx`, wrap children with BOTH providers temporarily:
```tsx
<CopilotShell>
  <CopilotNavigatorProvider>
    <div id="main-content">...</div>
  </CopilotNavigatorProvider>
</CopilotShell>
```

This ensures both old (`useCopilot()`) and new (`useCopilotNavigator()`) hooks work during migration.

- [ ] **Step 2: Find all consumers**

Run: `grep -rn "useCopilot\b\|useCopilotContext" src/ --include="*.tsx" --include="*.ts" | grep -v "copilot/" | grep -v "__tests__" | grep -v "node_modules"`

This finds every file outside the copilot directory that imports these hooks. Known consumers include: `MagnetsListClient.tsx`, `IdeasTab.tsx`, `WizardContainer.tsx`, `AnalyticsOverview.tsx`, `ContentPipelineContent.tsx`, `KnowledgeDashboard.tsx`, campaigns pages, post-campaigns pages, signals page.

- [ ] **Step 3: Migrate MagnetsListClient.tsx**

Replace:
```typescript
const { open, sendMessage } = useCopilot();
// ... later:
open(); sendMessage(`Generate posts for ${magnetName}`);
```

With:
```typescript
const { startConversation } = useCopilotNavigator();
// ... later:
startConversation(`Generate posts for ${magnetName}`);
```

Update import from `./CopilotProvider` to `./CopilotNavigator`.

- [ ] **Step 4: Migrate IdeasTab.tsx**

Same pattern as MagnetsListClient. Replace `open()` + `sendMessage()` calls with `startConversation()`.

- [ ] **Step 5: Migrate context-only pages**

For pages that only use `useCopilotContext()` (campaigns, post-campaigns, signals, WizardContainer, AnalyticsOverview, ContentPipelineContent, KnowledgeDashboard):
- Replace `import { useCopilotContext } from '@/components/copilot/useCopilotContext'`
- With `import { useCopilotPageContext } from '@/components/copilot/CopilotNavigator'`
- The hook signature is identical — no logic changes needed.

- [ ] **Step 6: Verify no remaining references**

Run: `grep -rn "from.*CopilotProvider\|from.*useCopilotContext\b" src/ --include="*.tsx" --include="*.ts" | grep -v "__tests__" | grep -v "node_modules" | grep -v "copilot/"`

Should return zero results (all consumers migrated).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(copilot): migrate consumers from useCopilot to useCopilotNavigator"
```

---

## Task 10: Wire Up Layout + Remove Sidebar

Replace CopilotShell in layout with CopilotNavigator + CommandBar. Remove old sidebar components.

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/components/dashboard/AppSidebar.tsx`
- Delete: `src/components/copilot/CopilotSidebar.tsx`
- Delete: `src/components/copilot/CopilotShell.tsx`
- Delete: `src/components/copilot/CopilotToggleButton.tsx`
- Delete: `src/components/copilot/useCopilotContext.tsx`
- Delete: `src/components/copilot/CopilotProvider.tsx`

- [ ] **Step 1: Update layout.tsx**

Replace:
```tsx
import { CopilotShell } from '@/components/copilot/CopilotShell';
// ...
<CopilotShell>
  <div id="main-content">...</div>
</CopilotShell>
```

With:
```tsx
import { CopilotNavigatorProvider } from '@/components/copilot/CopilotNavigator';
import { CommandBar } from '@/components/copilot/CommandBar';
// ...
<CopilotNavigatorProvider>
  <div id="main-content">...</div>
  <CommandBar />
</CopilotNavigatorProvider>
```

- [ ] **Step 2: Add Copilot to sidebar nav**

In `src/components/dashboard/AppSidebar.tsx`, add a nav item in `mainNav` array:
```typescript
{ href: '/', label: 'Home', icon: Home },
// Add after Home:
{ href: '/copilot/new', label: 'New Chat', icon: MessageSquare },
```

Or add it in `bottomNav` if preferred. Import `MessageSquare` from `lucide-react`.

- [ ] **Step 3: Delete old sidebar components**

Delete these files:
- `src/components/copilot/CopilotSidebar.tsx`
- `src/components/copilot/CopilotShell.tsx`
- `src/components/copilot/CopilotToggleButton.tsx`
- `src/components/copilot/CopilotProvider.tsx`

Keep these files (still used by full-page conversation):
- `src/components/copilot/CopilotMessage.tsx` (or MessageList if refactored)
- `src/components/copilot/ConversationHeader.tsx`
- `src/components/copilot/ConversationInput.tsx` (or PromptInput if refactored)
- `src/components/copilot/ConfirmationDialog.tsx`
- `src/components/copilot/FeedbackWidget.tsx`
- `src/components/copilot/PostPreviewCard.tsx`
- `src/components/copilot/KnowledgeResultCard.tsx`
- `src/components/copilot/IdeaListCard.tsx`
- `src/components/copilot/ContentReviewPanel.tsx`
- (useCopilotContext.tsx is deleted — all consumers migrated in Task 9)

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: No errors. If any remain, they're leftover imports of deleted files — fix them.

- [ ] **Step 5: Run all tests**

Run: `pnpm test --no-coverage`
Expected: All pass. Fix any that reference removed components.

- [ ] **Step 6: Test manually — full flow**

1. Visit `/` — see copilot homepage with suggestions + stats
2. Type a prompt → navigates to `/copilot/new?message=...` → streams response
3. Press `Cmd+K` from `/posts` page → overlay opens → type prompt → navigates to conversation
4. Click a recent conversation → resumes it
5. Verify old floating button is gone
6. Verify no console errors on any page

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(copilot): wire layout, remove sidebar, complete migration"
```

---

## Task 11: Content Review Inline Adaptation

Adapt ContentReviewPanel to render inline in the message stream instead of as a full-screen overlay.

**Files:**
- Modify: `src/components/copilot/ContentReviewPanel.tsx`
- Modify: `src/components/copilot/CopilotConversation.tsx`

- [ ] **Step 1: Adapt ContentReviewPanel**

The current panel is a full-screen overlay (657 lines). For inline rendering:
- Remove the portal/overlay wrapper
- Remove backdrop and z-index
- Keep all editing logic (sections, inline editing, approve/request changes)
- Wrap in a card container: `bg-card border border-border rounded-lg p-6 my-4`
- Change `onApprove` to call `sendMessage('Content approved...')` directly (no more going through Provider)
- Change `onRequestChanges` to call `sendMessage('Changes requested: ...')` directly

This is a refactor of the wrapper, not the editing logic. The 600+ lines of section editing stay the same.

- [ ] **Step 2: Wire into CopilotConversation**

In CopilotConversation, when a tool result has `displayHint: 'content_review'`, render `<ContentReviewPanel content={data} />` inline in the message stream instead of triggering the overlay.

- [ ] **Step 3: Test manually**

Start a conversation about creating a lead magnet. When the copilot returns content for review, verify:
- Content review renders inline (not overlay)
- Edit fields work
- Approve sends follow-up message
- Request changes sends feedback

- [ ] **Step 4: Commit**

```bash
git add src/components/copilot/ContentReviewPanel.tsx src/components/copilot/CopilotConversation.tsx
git commit -m "refactor(copilot): render content review inline in conversation"
```

---

## Task 12: Final Cleanup + Tests

Clean up dead code, verify all existing tests pass, add missing test coverage.

**Files:**
- Various cleanup across copilot directory
- Test files

- [ ] **Step 1: Remove dead imports and unused code**

Search for any remaining imports of deleted files:
```bash
grep -rn "CopilotShell\|CopilotSidebar\|CopilotToggleButton\|CopilotButton\|CopilotProvider" src/ --include="*.tsx" --include="*.ts" | grep -v "__tests__" | grep -v "node_modules"
```

Fix any that remain.

- [ ] **Step 2: Update existing copilot tests**

Tests in `src/__tests__/api/copilot/` may reference old Provider patterns. Update mocks and assertions to match the new CopilotNavigator patterns.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test --no-coverage`
Expected: All pass

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: Clean

- [ ] **Step 5: Run build**

Run: `pnpm build`
Expected: Clean build with no errors

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore(copilot): cleanup dead code and fix tests after homepage redesign"
```
