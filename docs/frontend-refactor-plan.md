# Frontend Architecture Refactor Plan

**Goal:** Refactor to SOLID, separate UI from business logic. No behavior change. Execute in steps.

## Target: `src/frontend/`

```
frontend/
├── api/          # client.ts, errors.ts, domain modules (ideas, posts, funnel, ...)
├── hooks/api/    # useIdeas, useFunnel, usePosts, ...
└── stores/      # Zustand slices (content-pipeline, funnel, ...)
```

Components import from `@/frontend/*`. No direct `fetch('/api/...')`.

## Phases

1. **Foundation** — API client, first domain module (ideas), one Zustand store
2. **Hooks** — useIdeas, useIdeasMutations; refactor IdeasTab, KanbanBoard
3. **Expand** — Funnel, posts, knowledge, settings API modules + hooks
4. **Decompose** — Split FunnelIntegrationsTab, PostDetailModal, etc.
5. **Polish** — Conventions, error/loading UX

## Scope

~111 client files with direct fetch. Domain batches: content-pipeline (33), funnel (14), settings (22), email (9), etc.

## Rules

- No backend changes. No new features. Step-by-step deployable.
- Add `zustand`. Optional later: react-query.
