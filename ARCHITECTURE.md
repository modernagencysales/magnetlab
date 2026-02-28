# MagnetLab Architecture Plan

> **Status**: Plan — pending review before execution
> **Scope**: Next.js application only (`src/`). MCP server is a future separate application.
> **Goal**: Proper separation of UI, business logic, and data access. Every layer has one job. Scalable by default.

---

## The Problem (Concrete)

The current codebase has no architectural boundary between layers. Everything bleeds into everything else:

```
// WHAT EXISTS TODAY — all in one route file (346 lines):
export async function POST(req: Request) {
  const session = await auth();                          // auth
  const cookieStore = await cookies();                   // team context (copy-pasted 40x)
  const teamId = cookieStore.get('ml-team-context')...  // team scoping (copy-pasted 40x)
  const supabase = createSupabaseAdminClient();          // direct DB
  const { data } = await supabase.from('funnel_pages')  // query inline
  // + 200 more lines of mixed business logic
}

// WHAT EXISTS TODAY — client component (PostsTab.tsx):
const fetchPosts = useCallback(async () => {
  const response = await fetch('/api/content-pipeline/posts?...')  // fetch in component
  setPosts(data.posts)
}, [statusFilter, profileId, teamId])

useEffect(() => { fetchPosts() }, [fetchPosts])  // data fetching in effect
```

**Numbers**:

- 191 API routes calling `createSupabaseAdminClient()` directly
- 96 client components with `fetch()` calls
- Team-scoping logic copy-pasted in 40+ files
- WizardContainer: 833 lines. PostDetailModal: 798 lines. KanbanBoard: 591 lines.

---

## Target Architecture

```
┌──────────────── PRESENTATION LAYER ─────────────────┐
│                                                      │
│  page.tsx (Server Component)                        │
│  → Async, fetches data, passes as props             │
│  → No useState, no useEffect, no fetch()            │
│                                                      │
│  Component.tsx (Client Component)                   │
│  → 'use client', manages interaction state          │
│  → Calls Server Actions / API routes for mutations  │
│  → Never fetches initial data                       │
│                                                      │
│  hooks/use-*.ts (Custom hooks)                      │
│  → Abstract mutation logic from components          │
│  → Handle loading/error/optimistic updates          │
│                                                      │
│  stores/*.store.ts (Zustand)                        │
│  → Complex multi-step UI state only                 │
│  → Wizard flow, kanban drag state                   │
│                                                      │
└──────────────────────┬──────────────────────────────┘
                       │ Server Actions / thin API routes
┌──────────────────────▼──────────────────────────────┐
│                  API / ACTION LAYER                  │
│                                                      │
│  app/api/**/route.ts   (for external/webhook calls) │
│  app/**/actions.ts     (Server Actions for UI)      │
│                                                      │
│  Job: auth → get scope → validate → call service    │
│  Max ~30 lines. Zero business logic. Zero Supabase. │
│                                                      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  SERVICE LAYER                       │
│                                                      │
│  server/services/posts.service.ts                   │
│  server/services/funnels.service.ts                 │
│  server/services/knowledge.service.ts               │
│  ...                                                │
│                                                      │
│  Job: business logic, orchestration, validation      │
│  Calls: repositories + lib/ai/ + lib/integrations/  │
│  Never: HTTP objects, cookies, NextResponse          │
│                                                      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                REPOSITORY LAYER                      │
│                                                      │
│  server/repositories/posts.repo.ts                  │
│  server/repositories/funnels.repo.ts                │
│  server/repositories/knowledge.repo.ts              │
│  ...                                                │
│                                                      │
│  Job: ALL Supabase queries live here and only here  │
│  Input: DataScope + query params                    │
│  Output: typed data or thrown error                 │
│  Never: business logic, auth, HTTP                  │
│                                                      │
└──────────────────────┬──────────────────────────────┘
                       │
                    Supabase
```

---

## Target Folder Structure

```
src/
├── app/                          # Next.js App Router — routes only
│   ├── (auth)/
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Server Component — auth, team context, nav data
│   │   ├── posts/
│   │   │   ├── page.tsx          # Server Component — fetches posts, passes as props
│   │   │   └── actions.ts        # Server Actions — create, update, delete
│   │   ├── pages/
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── actions.ts
│   │   └── ...
│   ├── api/                      # HTTP endpoints (webhooks, external consumers, Trigger.dev callbacks)
│   │   ├── content-pipeline/
│   │   │   └── posts/
│   │   │       └── route.ts      # ~25 lines: auth → scope → validate → service → json
│   │   └── webhooks/             # External webhooks (Stripe, Resend, etc.) — always API routes
│   └── p/                        # Public pages (funnel opt-ins, content)
│
├── server/                       # SERVER-ONLY code (never imported by 'use client' files)
│   ├── repositories/             # Data access — all Supabase queries live here
│   │   ├── posts.repo.ts
│   │   ├── ideas.repo.ts
│   │   ├── knowledge.repo.ts
│   │   ├── funnels.repo.ts
│   │   ├── lead-magnets.repo.ts
│   │   ├── email.repo.ts
│   │   ├── subscribers.repo.ts
│   │   ├── analytics.repo.ts
│   │   ├── team.repo.ts
│   │   ├── libraries.repo.ts
│   │   └── users.repo.ts
│   └── services/                 # Business logic — orchestration only
│       ├── posts.service.ts
│       ├── ideas.service.ts
│       ├── knowledge.service.ts
│       ├── funnels.service.ts
│       ├── lead-magnets.service.ts
│       ├── email.service.ts
│       ├── analytics.service.ts
│       └── team.service.ts
│
├── components/                   # UI components
│   ├── ui/                       # Primitives (shadcn — do not touch)
│   ├── content-pipeline/         # Feature components (client-side shells)
│   │   ├── PostsTab.tsx
│   │   ├── PostDetailModal.tsx
│   │   └── hooks/
│   │       └── use-post-actions.ts
│   ├── funnel/
│   │   ├── FunnelBuilder.tsx
│   │   └── hooks/
│   │       └── use-funnel-builder.ts
│   ├── wizard/
│   │   ├── WizardContainer.tsx
│   │   └── hooks/
│   │       └── use-wizard-state.ts
│   └── providers/
│
├── hooks/                        # Shared client-side hooks (used across features)
│   ├── use-background-job.ts     # (already exists in lib/hooks — move here)
│   └── use-team-context.ts
│
├── stores/                       # Zustand — complex UI state only
│   ├── wizard.store.ts
│   ├── kanban.store.ts
│   └── funnel-builder.store.ts
│
└── lib/                          # Isomorphic utilities (safe to import anywhere)
    ├── ai/                       # AI modules — keep as-is
    ├── integrations/             # Third-party clients — keep as-is
    ├── auth/                     # Auth config — keep as-is
    ├── types/                    # TypeScript types + Zod schemas
    ├── validations/              # Zod schemas for API inputs
    ├── utils/                    # Pure utilities (no DB, no HTTP)
    └── constants/                # App constants
```

**Hard rule**: Files inside `src/server/` are never imported by any file containing `'use client'`. TypeScript path aliases and a lint rule will enforce this.

---

## Layer Contracts — What Each Layer Does and Does Not Do

### Repository Layer (`src/server/repositories/`)

**Does:**

- All Supabase queries for a given domain
- Applies `DataScope` (team vs personal scoping)
- Returns typed data
- Throws on errors (services catch)

**Does NOT:**

- Auth (no `auth()` calls)
- Business logic
- AI or integrations
- Handle HTTP (no `NextRequest`, `NextResponse`)

```typescript
// src/server/repositories/posts.repo.ts

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import { applyScope } from "@/lib/utils/team-context";
import type { DataScope } from "@/lib/utils/team-context";
import type { PipelinePost } from "@/lib/types/content-pipeline";

export interface PostFilters {
  status?: string;
  isBuffer?: boolean;
  teamProfileId?: string;
  limit?: number;
}

export async function findPosts(
  scope: DataScope,
  filters: PostFilters = {},
): Promise<PipelinePost[]> {
  const supabase = createSupabaseAdminClient();
  const { limit = 50, status, isBuffer, teamProfileId } = filters;

  let query = supabase
    .from("cp_pipeline_posts")
    .select("id, user_id, draft_content, final_content, status, ...")
    .order("created_at", { ascending: false })
    .limit(limit);

  query = applyScope(query, scope);

  if (status) query = query.eq("status", status);
  if (isBuffer !== undefined) query = query.eq("is_buffer", isBuffer);
  if (teamProfileId) query = query.eq("team_profile_id", teamProfileId);

  const { data, error } = await query;
  if (error) throw new Error(`posts.findPosts: ${error.message}`);
  return data ?? [];
}

export async function findPostById(
  scope: DataScope,
  id: string,
): Promise<PipelinePost | null> {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("cp_pipeline_posts").select("*").eq("id", id);
  query = applyScope(query, scope);

  const { data, error } = await query.single();
  if (error) return null;
  return data;
}

export async function createPost(
  scope: DataScope,
  input: PostCreateInput,
): Promise<PipelinePost> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_pipeline_posts")
    .insert({ ...input, user_id: scope.userId, team_id: scope.teamId })
    .select()
    .single();
  if (error) throw new Error(`posts.createPost: ${error.message}`);
  return data;
}

export async function updatePost(
  id: string,
  updates: Partial<PostUpdateInput>,
): Promise<PipelinePost> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_pipeline_posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`posts.updatePost: ${error.message}`);
  return data;
}
```

---

### Service Layer (`src/server/services/`)

**Does:**

- Business logic and orchestration
- Calls repositories for data access
- Calls `lib/ai/` for AI generation
- Calls `lib/integrations/` for third-party services
- Enforces business rules (plan limits, ownership checks)
- Handles multi-step operations

**Does NOT:**

- Supabase (delegates to repo)
- HTTP (no `NextRequest`, `NextResponse`, `cookies()`)
- UI concerns
- Auth (receives pre-resolved `DataScope`)

```typescript
// src/server/services/posts.service.ts

import * as postsRepo from "@/server/repositories/posts.repo";
import { postPolish } from "@/lib/ai/content-pipeline/post-polish";
import { checkResourceLimit } from "@/lib/auth/plan-limits";
import type { DataScope } from "@/lib/utils/team-context";
import type { PostFilters } from "@/server/repositories/posts.repo";

export async function getPosts(scope: DataScope, filters: PostFilters) {
  const posts = await postsRepo.findPosts(scope, filters);
  // Enrich with profile names if team mode
  if (scope.type === "team") {
    return enrichWithProfileNames(posts);
  }
  return posts;
}

export async function polishPost(
  scope: DataScope,
  postId: string,
): Promise<{ jobId: string }> {
  const post = await postsRepo.findPostById(scope, postId);
  if (!post) throw new Error("Post not found");

  await checkResourceLimit(scope.userId, "post_polish");

  const jobId = await triggerPolishJob(post);
  await postsRepo.updatePost(postId, { polish_status: "pending" });

  return { jobId };
}

export async function publishPost(scope: DataScope, postId: string) {
  const post = await postsRepo.findPostById(scope, postId);
  if (!post) throw new Error("Post not found");
  if (!post.final_content)
    throw new Error("Post has no final content to publish");

  // Business rule: can only publish scheduled or reviewing posts
  if (!["scheduled", "reviewing"].includes(post.status)) {
    throw new Error(`Cannot publish a post with status: ${post.status}`);
  }

  // ... publish logic
  await postsRepo.updatePost(postId, {
    status: "published",
    published_at: new Date().toISOString(),
  });
}
```

---

### API Layer (`src/app/api/**/route.ts`)

**Does:**

- Authenticate the request (`auth()`)
- Get data scope (`getDataScope()`)
- Validate the request body (Zod)
- Call one service method
- Return JSON

**Does NOT:**

- Supabase
- Business logic
- More than ~30 lines

```typescript
// src/app/api/content-pipeline/posts/route.ts — AFTER refactor

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDataScope } from "@/lib/utils/team-context";
import { ApiErrors } from "@/lib/api/errors";
import { PostFiltersSchema } from "@/lib/validations/api";
import * as postsService from "@/server/services/posts.service";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const scope = await getDataScope(session.user.id);
  const filters = PostFiltersSchema.parse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  const posts = await postsService.getPosts(scope, filters);
  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const scope = await getDataScope(session.user.id);
  const body = PostCreateSchema.parse(await request.json());

  const post = await postsService.createPost(scope, body);
  return NextResponse.json({ post }, { status: 201 });
}
```

---

### Server Actions (`src/app/**/actions.ts`)

Used for UI-driven mutations (form submissions, button clicks in components). Preferred over API routes for anything that doesn't need to be an external HTTP endpoint.

```typescript
// src/app/(dashboard)/posts/actions.ts
"use server";

import { auth } from "@/lib/auth";
import { getDataScope } from "@/lib/utils/team-context";
import { revalidatePath } from "next/cache";
import * as postsService from "@/server/services/posts.service";

export async function deletePost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const scope = await getDataScope(session.user.id);
  await postsService.deletePost(scope, postId);
  revalidatePath("/posts");
}

export async function polishPost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const scope = await getDataScope(session.user.id);
  return postsService.polishPost(scope, postId);
}
```

---

### Server Components (`src/app/**/page.tsx`)

**Does:**

- `async` function — fetches all data for the page
- Calls service methods directly (no HTTP round-trip)
- Passes data as props to client components
- Wraps interactive sections in `<Suspense>`

**Does NOT:**

- `useState`, `useEffect`, `useCallback`
- `fetch()` or HTTP calls
- Event handlers

```typescript
// src/app/(dashboard)/posts/page.tsx — AFTER refactor
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { PostsContent } from '@/components/content-pipeline/PostsContent';
import { redirect } from 'next/navigation';
import * as postsService from '@/server/services/posts.service';

export default async function PostsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const scope = await getDataScope(session.user.id);
  const [posts, buffer] = await Promise.all([
    postsService.getPosts(scope, { isBuffer: false }),
    postsService.getBuffer(scope),
  ]);

  return <PostsContent initialPosts={posts} initialBuffer={buffer} scope={scope} />;
}
```

---

### Client Components (`src/components/**/*.tsx`)

**Does:**

- `'use client'` at the top
- Receives data as props (from server component)
- Manages interaction state: tabs, modals, selected items, form inputs
- Calls Server Actions or thin API routes for mutations via custom hooks
- Optimistic updates where needed

**Does NOT:**

- `fetch()` in `useEffect` for initial data load
- Direct Supabase calls
- Business logic

```typescript
// src/components/content-pipeline/PostsTab.tsx — AFTER refactor
'use client';

import { useState } from 'react';
import { usePostActions } from './hooks/use-post-actions';
import type { PipelinePost } from '@/lib/types/content-pipeline';

interface PostsTabProps {
  initialPosts: PipelinePost[];
  profileId?: string | null;
}

export function PostsTab({ initialPosts, profileId }: PostsTabProps) {
  const [posts, setPosts] = useState(initialPosts);  // initialised from server
  const [statusFilter, setStatusFilter] = useState<PostStatus | ''>('');
  const [selectedPost, setSelectedPost] = useState<PipelinePost | null>(null);

  const { deletePost, polishPost, isPolishing } = usePostActions({
    onPostUpdated: (updated) => setPosts(prev => prev.map(p => p.id === updated.id ? updated : p)),
    onPostDeleted: (id) => setPosts(prev => prev.filter(p => p.id !== id)),
  });

  // Filter is done client-side on the initialPosts data — or a server re-fetch via router.refresh()
  const filteredPosts = posts.filter(p => !statusFilter || p.status === statusFilter);

  return (
    // ... pure UI render, no fetch()
  );
}
```

---

### Custom Hooks (`src/components/[feature]/hooks/` and `src/hooks/`)

Custom hooks abstract mutation logic. They are the only place client-side code talks to the API/server actions.

```typescript
// src/components/content-pipeline/hooks/use-post-actions.ts
"use client";

import { useState, useTransition } from "react";
import { deletePost, polishPost } from "@/app/(dashboard)/posts/actions";
import type { PipelinePost } from "@/lib/types/content-pipeline";

interface UsePostActionsOptions {
  onPostUpdated?: (post: PipelinePost) => void;
  onPostDeleted?: (id: string) => void;
}

export function usePostActions({
  onPostUpdated,
  onPostDeleted,
}: UsePostActionsOptions = {}) {
  const [polishingId, setPolishingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (postId: string) => {
    startTransition(async () => {
      await deletePost(postId);
      onPostDeleted?.(postId);
    });
  };

  const handlePolish = async (postId: string) => {
    setPolishingId(postId);
    try {
      const result = await polishPost(postId);
      // start polling for job completion
      return result;
    } finally {
      setPolishingId(null);
    }
  };

  return {
    deletePost: handleDelete,
    polishPost: handlePolish,
    isPolishing: (id: string) => polishingId === id,
    isPending,
  };
}
```

---

### Zustand Stores (`src/stores/`)

Only for complex multi-step UI state that cannot live in a single component. **Not** for server data.

```typescript
// src/stores/wizard.store.ts
import { create } from "zustand";
import type { WizardState, WizardStep } from "@/lib/types/lead-magnet";

interface WizardStore {
  state: WizardState;
  currentStep: WizardStep;
  generating: "idle" | "ideas" | "extraction" | "posts";
  activeDraftId: string | null;

  setStep: (step: WizardStep) => void;
  setGenerating: (state: "idle" | "ideas" | "extraction" | "posts") => void;
  updateState: (updates: Partial<WizardState>) => void;
  reset: () => void;
}

export const useWizardStore = create<WizardStore>((set) => ({
  state: INITIAL_STATE,
  currentStep: 1,
  generating: "idle",
  activeDraftId: null,

  setStep: (step) => set({ currentStep: step }),
  setGenerating: (generating) => set({ generating }),
  updateState: (updates) => set((s) => ({ state: { ...s.state, ...updates } })),
  reset: () =>
    set({ state: INITIAL_STATE, currentStep: 1, generating: "idle" }),
}));
```

---

## Data Flow: Before and After

### Reading Data

```
BEFORE:
page.tsx (Server)
  renders PostsContent with no props
    PostsContent (client)
      useEffect → fetch('/api/posts') → loading state → setPosts
        → user sees blank screen → data arrives → render

AFTER:
page.tsx (Server, async)
  await postsService.getPosts(scope)    ← single server-side call
  <PostsContent initialPosts={posts} />  ← data ready on first render
    PostsContent (client)
      useState(initialPosts)            ← no loading, no flash, no fetch()
```

### Writing Data

```
BEFORE:
FunnelBuilder (client)
  handleSave → fetch('/api/funnel', { method: 'PATCH', body: ... })
    → route.ts → 300 lines of DB logic → response
    → refetch all state

AFTER:
FunnelBuilder (client)
  useFunnelBuilder hook → saveFunnel(data)
    → calls Server Action: actions.ts/updateFunnel(data)
      → funnelsService.update(scope, id, data)
        → funnelsRepo.updateFunnel(id, data)
    → router.refresh() invalidates server component cache
    → no manual refetch needed
```

---

## Naming Conventions

| File                            | Convention                                | Example                            |
| ------------------------------- | ----------------------------------------- | ---------------------------------- |
| Repository                      | `[domain].repo.ts`                        | `posts.repo.ts`                    |
| Service                         | `[domain].service.ts`                     | `posts.service.ts`                 |
| Server Action file              | `actions.ts` in route folder              | `app/(dashboard)/posts/actions.ts` |
| Client component                | `PascalCase.tsx`                          | `PostDetailModal.tsx`              |
| Feature hook (component-scoped) | `use-[action].ts` in component's `hooks/` | `hooks/use-post-actions.ts`        |
| Shared hook                     | `use-[name].ts` in `src/hooks/`           | `use-background-job.ts`            |
| Zustand store                   | `[feature].store.ts`                      | `wizard.store.ts`                  |
| Zod schema                      | `[Domain]Schema`                          | `PostCreateSchema`                 |

**Repository function naming**:

- `find[Entity]` — reads, never throw on empty
- `find[Entity]ById` — single record, returns null if not found
- `create[Entity]` — insert, throws on error
- `update[Entity]` — update, throws on error
- `delete[Entity]` — delete, throws on error

**Service function naming**:

- Domain verbs: `getPosts`, `publishPost`, `polishPost`, `generateIdeas`
- Never CRUD-speak in services unless the operation truly is just CRUD

---

## API Routes vs Server Actions — When to Use What

| Scenario                                             | Use                       |
| ---------------------------------------------------- | ------------------------- |
| User clicks "Delete post"                            | Server Action             |
| User submits a form                                  | Server Action             |
| Webhook from Stripe/Resend/Svix                      | API Route                 |
| Trigger.dev job callback                             | API Route                 |
| Public endpoint (lead capture)                       | API Route                 |
| External API consumer (API key auth)                 | API Route                 |
| Background job trigger from UI                       | API Route (returns jobId) |
| Any UI mutation that doesn't need to be a public URL | Server Action             |

---

## Zero-Break Execution Strategy

This is the most important section. Every step must leave the app fully functional. We use the **strangler fig pattern**: new code grows alongside old code, old code is only removed after the new code is verified working.

### The Golden Rules

1. **Never delete before verifying** — the old code path stays alive until the new one is confirmed working
2. **One route / one component at a time** — no batch migrations, no "refactor everything at once"
3. **New code is additive first** — create the repo function, then update the route to call it; never modify both in one step
4. **If it breaks, revert** — each change is a single git commit, easy to revert in isolation
5. **Trigger.dev jobs are untouched** — they keep their existing direct Supabase calls until a future dedicated phase

### Micro-Step Pattern for Each API Route (Phases 1+2)

Every route gets migrated in exactly this order. Never skip steps.

```
Step 1 — Write the repo function
  Create/add to posts.repo.ts: export async function findPosts(scope, filters)
  DO NOT touch the route yet
  ✓ Checkpoint: TypeScript compiles, repo file is self-contained

Step 2 — Update the route to call the repo
  Remove createSupabaseAdminClient() and inline query from route
  Replace with: const posts = await postsRepo.findPosts(scope, filters)
  Exact same response shape as before
  ✓ Checkpoint: curl the endpoint, response is identical

Step 3 — Write the service function
  Create/add to posts.service.ts: export async function getPosts(scope, filters)
  Service calls postsRepo.findPosts() + any enrichment logic
  DO NOT touch the route yet
  ✓ Checkpoint: TypeScript compiles

Step 4 — Update the route to call the service
  Replace postsRepo call with postsService.getPosts()
  Route is now: auth → scope → validate → service → json
  ✓ Checkpoint: curl the endpoint, response still identical

Step 5 — Commit
  git commit: "refactor(posts): posts GET route → service + repo layer"
```

### Micro-Step Pattern for Each Page/Component (Phase 3)

```
Step 1 — Add initialData prop (optional) to the client component
  interface PostsTabProps {
    initialPosts?: PipelinePost[]   // ← add, optional with undefined default
    ...existing props
  }
  If initialPosts is undefined, component still runs its useEffect fetch (old path)
  ✓ Checkpoint: page still works exactly as before (no server component changes yet)

Step 2 — Make page.tsx async, call service, pass initialData
  export default async function PostsPage() {
    const posts = await postsService.getPosts(scope, {})
    return <PostsContent initialPosts={posts} />
  }
  The component now has initialPosts, falls into the new path
  ✓ Checkpoint: page loads with data, no loading flash

Step 3 — Remove the useEffect fetch from the component
  Now that initialPosts is always provided, the useEffect fallback is dead code
  Remove it
  ✓ Checkpoint: page still works, no regression

Step 4 — Make the initialData prop required (remove optional marker)
  Forces future callers to always provide it
  ✓ Checkpoint: TypeScript catches any missed usages

Step 5 — Commit
  git commit: "feat(posts): server-side data fetch, eliminate client fetch waterfall"
```

### Micro-Step Pattern for God Components (Phase 4)

```
Step 1 — Extract state into a hook, keep component behavior identical
  Create hooks/use-post-detail.ts
  Move all useState/useCallback/useEffect into the hook
  Component calls the hook, renders the same JSX
  ✓ Checkpoint: component renders identically, all interactions work

Step 2 — Split sub-sections into sub-components
  Extract one section at a time (e.g. PostAIPanel)
  Pass necessary props down explicitly
  ✓ Checkpoint: one section extracted, no regression

Step 3 — Repeat for each section
  One commit per extracted sub-component

Step 4 — Final commit: parent component is now < 200 lines
```

---

## Migration Phases

Phases 1 and 2 are done together per domain (repo + service for a domain before moving to the next domain). Phases 3, 4, 5 follow after Phases 1+2 are complete across all domains.

### Domain Order

| Priority | Domain | API routes | Reason |
|----------|--------|-----------|--------|
| 1 | content-pipeline/posts | ~12 routes | Most used, most duplication |
| 2 | content-pipeline/ideas | ~8 routes | Tightly coupled to posts |
| 3 | content-pipeline/knowledge | ~10 routes | Complex, needs clean service boundary |
| 4 | funnels | ~15 routes | Core product, FunnelBuilder depends on this |
| 5 | lead-magnets | ~10 routes | Depends on funnels |
| 6 | email | ~12 routes | Self-contained, good isolation |
| 7 | analytics | ~8 routes | Read-only, lowest risk |
| 8 | team / users / settings | ~15 routes | Auth-heavy, careful |
| 9 | admin / webhooks / misc | ~30 routes | Last, least critical path |

Trigger.dev jobs: **deferred**. They keep direct Supabase calls. Addressed in a future standalone phase after the main refactor is complete.

---

### Phase 1+2 — Repository + Service Layer (per domain)

**Goal**: For each domain: create repo file → migrate API routes to repo → create service file → migrate routes to service.

**Risk**: None if micro-steps are followed. Each commit is a pure refactor — identical behavior.

**What changes**: API route files get shorter. Direct Supabase calls move to repos. Business logic moves to services.

**What does NOT change**: Response shapes, HTTP verbs, URL paths, authentication behavior, error codes. Zero client-side changes.

**Key win**: The 40x team-scoping boilerplate is eliminated. Every repo function calls `applyScope()` once. Done.

**Files created per domain**:
```
src/server/repositories/posts.repo.ts
src/server/services/posts.service.ts
```

**Route before** (93 lines, direct Supabase, inline team-scoping):
```typescript
// 93 lines, all mixed together
export async function GET(request: NextRequest) {
  const session = await auth()
  const cookieStore = await cookies()
  const teamId = cookieStore.get('ml-team-context')?.value  // boilerplate
  const supabase = createSupabaseAdminClient()               // direct DB
  let teamProfileScope: string[] | null = null               // boilerplate
  if (teamId) { /* 10 lines of team scoping */ }            // boilerplate
  let query = supabase.from('cp_pipeline_posts').select('...') // inline query
  // ...
}
```

**Route after** (22 lines):
```typescript
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return ApiErrors.unauthorized()
  const scope = await getDataScope(session.user.id)
  const filters = PostFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams))
  const posts = await postsService.getPosts(scope, filters)
  return NextResponse.json({ posts })
}
```

---

### Phase 3 — Server Components (per page)

**Goal**: Every `page.tsx` becomes an async Server Component that passes data as props. Client components stop fetching on mount.

**Risk**: Low-medium. The micro-step pattern keeps old fetch as fallback until server path is confirmed.

**Priority order**: posts → funnels → magnets → analytics → knowledge → email → admin

**For each page**:
1. Add optional `initialData` props to client component (no behavior change)
2. Make `page.tsx` async, call service, pass `initialData`
3. Verify page loads correctly with server data
4. Remove the `useEffect` fetch fallback from the component
5. Make prop required, commit

**Pages that carry the most pain** (fix these first):
- `PostsPage` — PostsTab, PostsContent, BufferQueueCard all fetch separately
- `FunnelBuilder` page — FunnelBuilder fetches sections on mount
- `MagnetsPage` — wizard fetches brand kit on mount
- `KnowledgeDashboard` — reads `document.cookie` directly (must fix)

---

### Phase 4 — Break Up God Components (per component)

**Goal**: No component file over 300 lines. State logic in hooks. Sub-sections in sub-components.

**Risk**: Medium — all behavior must be preserved. Unit tests run after each extraction.

**Priority order**:

| Component | Current | Target structure |
|-----------|---------|-----------------|
| `WizardContainer.tsx` | 833 lines | `WizardContainer` (~120) + `useWizardStore` (Zustand) + `useWizardJobs` hook |
| `PostDetailModal.tsx` | 798 lines | `PostDetailModal` (~100) + `PostEditor` + `PostEngagement` + `PostAIPanel` |
| `KanbanBoard.tsx` | 591 lines | `KanbanBoard` (~150) + `useKanbanDrag` hook + `KanbanColumnList` |
| `FunnelBuilder.tsx` | 496 lines | `FunnelBuilder` (~120) + `useFunnelBuilder` hook |
| `IdeasTab.tsx` | 446 lines | `IdeasList` + `IdeaFilters` + `useIdeasTab` hook |
| `AutopilotTab.tsx` | 400 lines | `AutopilotSettings` + `AutopilotStatus` + `useAutopilot` hook |

**Rule**: Extract state first (into a hook), then split rendering (into sub-components). Never do both in the same commit.

---

### Phase 5 — State Management Cleanup

**Goal**: All state follows the defined rules. No cookie reading in browser. No ad-hoc fetch patterns.

**Risk**: Low — mostly removal of now-dead code after Phases 3+4

**Actions**:
- Add `zustand` for `WizardContainer` and `KanbanBoard` (complex multi-step flows)
- Remove all `document.cookie` reads from client components (replace with prop from server)
- Standardize mutation hooks to use `useTransition` + Server Actions
- Remove orphaned `useEffect` fetch patterns that survived Phase 3

**State location rules**:

| State type | Lives in |
|------------|---------|
| Initial page data | Server Component → props |
| Mutation loading/error | Custom hook (`useTransition` + `useState`) |
| Complex multi-step UI flow | Zustand store |
| Form field values | Local `useState` or `useForm` |
| Active tab / URL filters | `useSearchParams` |
| Team context | Dashboard layout → passed as prop |
| One-off modal/toggle | Local `useState` |

---

## What We Are NOT Changing

- **Database schema** — zero migrations, this is a code reorganization
- **Next.js App Router** — correct choice, keeping it
- **Supabase** — keeping, just accessing it only through repos
- **Trigger.dev jobs** — deferred entirely. They keep their existing direct Supabase calls. A dedicated future phase will migrate them once the service layer is stable.
- **`lib/ai/`** — keeping as-is, services call into it
- **`lib/integrations/`** — keeping as-is, services call into it
- **`lib/auth/`** — keeping as-is, used by API routes and Server Actions
- **`components/ui/`** — shadcn primitives, never touched
- **All 224 API routes** — they stay, just become thin wrappers
- **Public pages** (`/p/[username]/[slug]`) — separate concern, lower priority

---

## Guardrails (Enforced Rules)

1. **No `createSupabaseAdminClient()` outside `src/server/repositories/`**
   Exception: legacy trigger jobs until they're updated

2. **No `fetch()` inside React components** (useEffect or otherwise)
   Exception: polling for background job status via `useBackgroundJob` hook

3. **No business logic in API routes or Server Actions**
   If it's more than 5 lines of logic, it goes in a service

4. **No `cookies()` or `headers()` in services or repositories**
   Auth context is resolved before calling services, passed as `DataScope`

5. **No imports from `src/server/` in `'use client'` files**
   ESLint rule will catch this

6. **No component over 300 lines**
   If it's longer, split it: state → hook, sub-sections → sub-components

7. **Server Actions for UI mutations, API routes for external HTTP**
   The distinction: does an external system need to call this URL? API route. Is it only called by our own UI? Server Action.

---

## Review Checklist — All Confirmed

- [✅] Add `zustand` as a dependency
- [✅] Server Actions preferred over API routes for UI mutations
- [✅] Domain-by-domain approach (Phases 1+2 together per domain, then Phases 3-5)
- [✅] ESLint rule enforcing no `src/server/` imports in `'use client'` files
- [✅] Trigger.dev jobs deferred — untouched until main refactor is complete
- [✅] `src/lib/hooks/` stays in `lib/` for now, shared hooks move to `src/hooks/` incrementally
