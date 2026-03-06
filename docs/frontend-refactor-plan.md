# Frontend Architecture Refactor Plan

**Goal:** Refactor the frontend to follow SOLID principles, separate UI from business logic, and make it highly scalable—**without changing behavior**. Execute in steps.

---

## 1. Current State Summary

### 1.1 What Exists Today

| Layer                 | Status           | Notes                                                                                                           |
| --------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| **UI primitives**     | ✅ Clear         | `src/components/ui/` (shadcn-style) + `src/components/ds/` (design system blocks)                               |
| **Global state**      | ❌ None          | No Zustand, Redux, or Jotai; state is local or props                                                            |
| **API / data layer**  | ❌ Ad hoc        | Components call `fetch('/api/...')` directly; no shared client                                                  |
| **Custom hooks**      | ⚠️ Few           | `useBackgroundJob`, `useWizardAutoSave`, `use-mobile`, `useProfileSelection`                                    |
| **Business logic**    | ❌ In components | Heavy logic and fetch logic live inside 50+ components                                                          |
| **Services (client)** | ❌ Minimal       | `src/lib/services/` is mostly **server-side** (Supabase service role, AI, etc.); only `screenshot.ts` uses HTTP |

### 1.2 Key Metrics

- **~90+ components** make direct `fetch('/api/...')` calls.
- **No SWR/react-query** — no caching, deduping, or loading/error conventions.
- **Duplicated API logic** — e.g. `/api/content-pipeline/ideas` called in both `IdeasTab` and `KanbanBoard` with similar params and response handling.
- **Very large components** (600–1,360 lines): `FunnelBuilder`, `FunnelIntegrationsTab`, `PostDetailModal`, `SwipeFileContent`, `WhiteLabelSettings`, `KanbanBoard`, `FlowEditor`, `BrandingSettings`, etc.
- **Many `useState` per screen** — e.g. FunnelBuilder has 25+ state slices; forms and lists are not normalized.

### 1.3 SOLID / Scalability Issues

| Principle                 | Current Issue                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| **S**ingle responsibility | Components handle data fetch, form state, validation, and UI; 600+ line files.                        |
| **O**pen/closed           | Adding a new API or filter often means editing a large component instead of extending a service/hook. |
| **L**iskov                | N/A (no shared abstractions for data layer).                                                          |
| **I**nterface segregation | Components depend on full API response shapes and inline fetch; no narrow contracts.                  |
| **D**ependency inversion  | UI depends on concrete `fetch()` and URL strings; no abstraction for “data source”.                   |

---

## 2. Target Architecture (After Refactor)

Use a dedicated **`src/frontend/`** folder for all client-side data/state layer code, mirroring **`src/server/`** (services + repositories). This keeps a clear boundary: **server** = backend logic, **frontend** = client-side API, hooks, and state. App and components stay at top level (Next.js convention; no mass move of component files).

```
src/
├── app/                    # Routes only; minimal logic (unchanged)
├── components/             # UI layer: primitives + feature components (unchanged location)
│   ├── ui/                 # Primitives (unchanged)
│   ├── ds/                 # Design system blocks (unchanged)
│   ├── content-pipeline/
│   ├── funnel/
│   ├── settings/
│   └── ...
├── frontend/               # NEW: client-side data + state layer (mirrors src/server/)
│   ├── api/                # API client + domain modules
│   │   ├── client.ts       # Base fetch wrapper (auth, errors, JSON)
│   │   ├── errors.ts       # Client-side ApiError (maps backend ErrorCodes)
│   │   ├── content-pipeline/
│   │   │   ├── ideas.ts
│   │   │   ├── posts.ts
│   │   │   └── knowledge.ts
│   │   ├── funnel/
│   │   ├── leads/
│   │   └── ...
│   ├── hooks/              # Data + UI hooks (client-only)
│   │   ├── api/            # useIdeas, useFunnel, usePosts, ...
│   │   └── ui/             # useIsMobile, useLocalStorage, ...
│   └── stores/             # Zustand stores (slices by domain)
│       ├── content-pipeline.ts
│       ├── funnel.ts
│       └── ...
├── lib/                    # Shared: types, utils, server-only services (unchanged)
│   ├── services/           # Server-side only (unchanged)
│   ├── types/
│   └── ...
└── server/                 # Backend: services + repositories (unchanged)
```

- **`frontend/`** = everything that runs in the browser for data and state: API client, domain API modules, hooks, Zustand stores. Components in `components/` import from `@/frontend/*`.
- **UI layer:** Components only render and delegate to `frontend/hooks` and `frontend/stores` (no direct `fetch`, no business rules).
- **Business logic:** In `frontend/hooks` + `frontend/stores` + `frontend/api` (validation, transformations, orchestration).
- **Data layer:** Single API client in `frontend/api/client.ts`; domain modules under `frontend/api/*` expose typed functions; hooks in `frontend/hooks/api/` wrap them and expose loading/error/data.

---

## 3. Issues to Fix (Checklist)

### 3.1 Data / API Layer

- [ ] **No shared API client** — Add `frontend/api/client.ts`: base URL, credentials (cookies/session), JSON parse, map to `ApiError` using backend `ErrorCodes`.
- [ ] **Duplicate fetch logic** — Same endpoints and response handling in multiple components (e.g. ideas in IdeasTab + KanbanBoard). Move to `frontend/api/content-pipeline/ideas.ts` (or similar) and reuse.
- [ ] **No loading/error contract** — Each component implements its own `loading`/`error`/`setData`. Standardize via hooks (e.g. `useIdeas()` returns `{ data, isLoading, error, refetch }`).
- [ ] **No request deduping or caching** — Optional: introduce a thin data layer (e.g. react-query or a small cache in hooks) so the same request isn’t fired repeatedly.

### 3.2 State Management

- [ ] **No global/store layer** — Add Zustand. Use for: cross-screen state (e.g. selected profile, team), shared form state where multiple components need it, or UI preferences.
- [ ] **Oversized local state** — Reduce 20+ `useState` in single components by: (1) moving server state into hooks, (2) moving form state into a store or `useReducer` / one `useState` (object), (3) extracting sub-views into smaller components with their own state.

### 3.3 Hooks

- [ ] **Too few domain hooks** — Add hooks per domain: e.g. `useIdeas`, `useFunnel`, `usePosts`, `useKnowledgeSearch`, `useIntegrations`, so components don’t call API or hold raw fetch logic.
- [ ] **No shared “async action” pattern** — Mutations (save, archive, write-from-idea) are inline in components. Extract to hooks (e.g. `useArchiveIdea()`, `useSaveFunnel()`) that return `{ mutate, isPending, error }`.

### 3.4 Components (SOLID)

- [ ] **SRP violations** — Large components do fetch + form + validation + UI. Split: presentational components + container that uses hooks/stores only.
- [ ] **Business logic in components** — Filtering, sorting, and “write from idea” logic live in UI files. Move to hooks or pure functions in `frontend/` or `lib/` (e.g. `filterIdeas()`, `sortIdeas()`).
- [ ] **Tight coupling to API shape** — Components assume response shape. API module should return typed DTOs; hooks map to view models if needed.

### 3.5 Consistency & DX

- [ ] **Error handling** — Backend has `ErrorCodes`; frontend doesn’t use them consistently. API client should parse error body and expose `code`/`message`; toasts or UI can branch on `code`.
- [ ] **Types** — Reuse `@/lib/types/*` everywhere; no duplicate interfaces for API responses. API modules should import from types and return those types.

---

## 4. Step-by-Step Refactor Plan

Execute in order. Each step is independently shippable and keeps the app working.

---

### Phase 1: Foundation (no UI behavior change)

**Step 1.1 — API client and error handling**

- Add `src/frontend/api/client.ts`:
  - `apiClient.get(url, options?)`, `apiClient.post(url, body?)`, etc.
  - Use `credentials: 'include'`, base path for `/api`, parse JSON, throw or return typed errors using backend `ErrorCodes`.
- Add `src/frontend/api/errors.ts` (client-side): map HTTP status + body to `ApiError { code, message }`.
- Do **not** change any component yet; only introduce the client.

**Step 1.2 — First domain API module (content-pipeline ideas)**

- Add `src/frontend/api/content-pipeline/ideas.ts`:
  - `getIdeas(params)`, `writeFromIdea(ideaId)`, `updateIdeaStatus(ideaId, status)`, etc., using `apiClient` and types from `@/lib/types/content-pipeline`.
- Optionally add a minimal `index.ts` that re-exports content-pipeline API modules.

**Step 1.3 — Zustand and first store**

- Add dependency: `zustand`.
- Add one store slice, e.g. `src/frontend/stores/content-pipeline.ts`: selected profile id, selected team id, maybe “ideas filter” if shared between IdeasTab and KanbanBoard. Keep it minimal.
- Use the store only where it clearly removes prop drilling or duplicate state (e.g. profile/team selection). Do not move all state into stores at once.

**Deliverable:** API client exists, one domain module (ideas) exists, one Zustand store exists. No component refactors yet (or one component switched to `frontend/api` as a pilot).

---

### Phase 2: Hooks and one feature slice

**Step 2.1 — Hooks for ideas**

- Add `src/frontend/hooks/api/useIdeas.ts`: calls `getIdeas` with params from args + store (profileId, teamId). Returns `{ ideas, allIdeas, isLoading, error, refetch }` and optionally `fetchWritingIdeas` for polling.
- Add `src/frontend/hooks/api/useIdeasMutations.ts` (or same file): `useWriteFromIdea()`, `useArchiveIdea()` returning `{ mutate, isPending, error }`.
- Refactor **IdeasTab** to use these hooks only (no direct `fetch`). Keep UI and layout as-is.

**Step 2.2 — KanbanBoard and DetailPane**

- Refactor KanbanBoard and any component that uses ideas API to use the same `frontend/api/content-pipeline/ideas` module and hooks. Remove duplicate fetch logic.

**Deliverable:** Ideas feature uses shared API module + hooks; IdeasTab and KanbanBoard no longer duplicate ideas fetch logic.

---

### Phase 3: Expand domain modules and hooks

**Step 3.1 — Funnel API module + hooks**

- Add `src/frontend/api/funnel/index.ts` (or per-resource files): get funnel, update funnel, publish, integrations, etc., using `apiClient` and `@/lib/types/funnel`.
- Add hooks: e.g. `useFunnel(funnelId)`, `useSaveFunnel()`, `useFunnelIntegrations(funnelPageId)` in `frontend/hooks/api/`.
- Refactor **FunnelBuilder** and **FunnelIntegrationsTab** to use these; extract form state into a reducer or a small funnel store if it simplifies (still no behavior change).

**Step 3.2 — Content-pipeline posts, knowledge, settings**

- Add API modules: `frontend/api/content-pipeline/posts.ts`, `knowledge.ts`, and for settings `frontend/api/settings/*` (or one settings module) for whitelabel, branding, integrations, etc.
- Add corresponding hooks: `usePosts`, `useKnowledgeSearch`, `useWhitelabel`, etc. in `frontend/hooks/api/`.
- Refactor **PostDetailModal**, **KnowledgeSearch**, **WhiteLabelSettings**, **BrandingSettings** to use hooks + API modules; remove inline fetch.

**Deliverable:** Major features (funnel, content-pipeline, key settings) go through API layer + hooks; components are thinner.

---

### Phase 4: Component decomposition and stores

**Step 4.1 — Break up largest components**

- Split **FunnelIntegrationsTab** into smaller components (e.g. per-provider card, shared list picker) that receive data and callbacks from a parent that uses `useFunnelIntegrations` and mutation hooks.
- Similarly split **PostDetailModal**, **SwipeFileContent**, **FlowEditor** into presentational + one container that uses hooks.

**Step 4.2 — Optional global UI / app state**

- If needed, add a small `appStore` or `uiStore` (Zustand) for sidebar state, theme, or other cross-cutting UI. Only if it removes prop drilling or duplication.

**Deliverable:** No 1000+ line components; clear separation of “container (hooks + store)” vs “presentational (props only)”.

---

### Phase 5: Polish and conventions

**Step 5.1 — Shared patterns**

- Document in CLAUDE.md or a short `docs/frontend-architecture.md`: (1) New API call → add to `frontend/api/<domain>`, (2) New screen state → hook in `frontend/hooks/api`, (3) Shared client state → Zustand slice in `frontend/stores`.
- Add a simple eslint rule or comment convention to discourage `fetch('/api/...')` inside `components/` (optional).

**Step 5.2 — Error and loading UX**

- Ensure API client and hooks expose errors in a consistent shape; use backend `ErrorCodes` for toasts or inline messages where applicable.

**Deliverable:** Conventions documented; errors and loading handled consistently across refactored areas.

---

## 5. What We Are Not Doing (Scope)

- **No backend or API route changes** — Only frontend consumption.
- **No new features** — Refactor only; behavior and UX stay the same.
- **No big-bang rewrite** — Step-by-step; each phase is deployable.
- **No mandatory react-query** — Optional later; Phase 1–2 use fetch + hooks only. Zustand is the only new dependency in the plan.
- **Server components** — Keep current split; refactor focuses on client components and their data flow.

---

## 6. Dependency Change

- **Add:** `zustand` (minimal, no middleware required for Phase 1).
- **Optional later:** `@tanstack/react-query` if you want caching/deduping (can be Phase 6).

---

## 7. Success Criteria

- No component contains direct `fetch('/api/...')` for refactored domains; all go through `frontend/api/*` and hooks.
- No 600+ line component in refactored areas; business logic lives in hooks/stores or pure functions.
- Single place per API surface (e.g. ideas: one module + one set of hooks); no duplicated fetch logic.
- Global or cross-screen state uses Zustand where it improves clarity and reduces props.
- Existing tests and manual flows still pass; no intentional behavior change.

---

## 8. Suggested First PR (Phase 1)

1. Add `src/frontend/api/client.ts` and `src/frontend/api/errors.ts` (client).
2. Add `src/frontend/api/content-pipeline/ideas.ts` using that client.
3. Add `zustand` and `src/frontend/stores/content-pipeline.ts` with minimal state (e.g. selectedProfileId, selectedTeamId).
4. (Optional) Wire **IdeasTab** to use `getIdeas` from the new module in one place to validate the client; then proceed to Phase 2 for full hook refactor of IdeasTab.

This plan keeps everything as-is from a user perspective while fixing architecture and preparing the frontend for scale and SOLID alignment.

---

## 9. Refactor Scope & Granular Migration Steps

### 9.1 Total Scope (Files to Touch)

| Location                           | Files with direct `fetch('/api/...')` |
| ---------------------------------- | ------------------------------------- |
| **Components** (`src/components/`) | **98**                                |
| **App pages** (`src/app/`)         | **11**                                |
| **Lib hooks** (`src/lib/hooks/`)   | **2**                                 |
| **Total client files**             | **111**                               |

No backend routes or `__tests__` are changed; only client-side consumers are refactored to use `frontend/api` + hooks (+ stores where useful).

### 9.2 Files by Domain (for batching)

| Domain                                     | Components | App pages | Lib | Total | Notes                                                                                                                                                         |
| ------------------------------------------ | ---------- | --------- | --- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Content-pipeline**                       | 33         | 0         | 0   | 33    | ideas, posts, knowledge, transcripts, schedule, styles, planner, broadcast, templates, etc.                                                                   |
| **Funnel** (funnel, AB, email-sequence)    | 10         | 4         | 0   | 14    | FunnelBuilder, FunnelIntegrationsTab, ABTestPanel, SectionsManager, EmailSequenceTab, etc. + library/external funnel pages                                    |
| **Settings / Signals / Integrations**      | 22         | 0         | 0   | 22    | WhiteLabel, Branding, SignalConfig, KeywordMonitors, CompanyMonitors, Resend, GHL, HeyReach, Webhooks, etc.                                                   |
| **Email** (broadcasts, flows, subscribers) | 9          | 0         | 0   | 9     | BroadcastList, BroadcastEditor, FlowEditor, FlowList, SubscriberTable, etc.                                                                                   |
| **Leads**                                  | 1          | 1         | 0   | 2     | LeadsTable, leads page                                                                                                                                        |
| **LinkedIn automations**                   | 4          | 0         | 0   | 4     | AutomationList, AutomationEditor, AutomationEventsDrawer, PostDetailModal (partial)                                                                           |
| **Public** (opt-in, thank-you, chat)       | 5          | 0         | 0   | 5     | OptinPage, ThankyouPage, GPTChatTool, LibraryGrid, BookCallDrawer                                                                                             |
| **Wizard / Create**                        | 5          | 2         | 2   | 9     | WizardContainer, DraftPicker, ExtractionStep, ContextStep, SmartImportTab, PublishStep; create page-quick, assets/import; useWizardAutoSave, useBackgroundJob |
| **Swipe file**                             | 2          | 0         | 0   | 2     | SwipeFileContent, SwipeFileInspiration                                                                                                                        |
| **Libraries / External / Team / Pages**    | 2          | 5         | 0   | 7     | CatalogCard, MagnetDetail; libraries new/[id]/funnel, external new/[id]/funnel, pages, team, team-select                                                      |
| **Analytics**                              | 4          | 0         | 0   | 4     | AnalyticsOverview, EngagementDashboard, FunnelDetail, EmailAnalytics                                                                                          |
| **Admin**                                  | 1          | 0         | 0   | 1     | PromptEditor                                                                                                                                                  |
| **Other** (content, feedback, profile)     | 4          | 0         | 0   | 4     | ContentPageClient, ProfileSwitcher, FeedbackWidget, StyleMixer                                                                                                |

_Some components call multiple domains (e.g. PostDetailModal: content-pipeline + linkedin). They are counted in the primary domain; they will be refactored when that domain is migrated._

### 9.3 Granular Migration Steps (reviewable chunks)

Each step is a small, reviewable unit. New files = under `src/frontend/`. “Refactor” = replace direct `fetch` with `frontend/api` + hooks; behavior unchanged.
