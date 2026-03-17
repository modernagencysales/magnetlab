# Team Command Center

Weekly calendar view for LinkedIn posts across team. Broadcast-to-team with AI voice-adapted variations, collision detection.

## Flow

Weekly grid → right-click "Broadcast" → `broadcast-post-variations` task → Claude rewrites per voice → variation posts (reviewing) → auto-stagger 2-3 days. Collision check (Haiku) for same-day topic overlap.

## Key Files

`TeamCommandCenter.tsx`, `WeeklyGrid.tsx`, `BroadcastModal.tsx`, `broadcast-post-variations.ts` | `team-schedule` API, `broadcast` API

## LinkedIn Connection

`team_profile_integrations` — per-profile Unipile account. Connect: `/api/linkedin/connect?team_profile_id=X`
