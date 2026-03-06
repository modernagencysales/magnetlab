<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## Team Command Center (Feb 2026)

Unified weekly calendar view for managing LinkedIn posts across all team members from one screen. Includes broadcast-to-team with AI voice-adapted variations and content collision detection.

### Data Model

- `team_profile_integrations` — per-profile LinkedIn connection (service, metadata with unipile_account_id, connected_by)
- `cp_pipeline_posts.broadcast_group_id` — UUID linking broadcast siblings

### Architecture

```
Team Command Center (weekly grid) → team-schedule API → Supabase
  ↓ right-click "Broadcast"
  → broadcast API → Trigger.dev `broadcast-post-variations` task
    → Claude AI rewrites in each member's voice
    → Creates variation posts (status: reviewing)
    → Auto-staggers across 2-3 days
  ↓ collision check (Haiku)
  → Detects same-day topic overlap → suggests rescheduling
```

### Key Files

| File | Purpose |
|------|---------|
| `src/components/content-pipeline/TeamCommandCenter.tsx` | Main container (week nav, grid, buffer dock) |
| `src/components/content-pipeline/WeeklyGrid.tsx` | Calendar grid (profiles × days) |
| `src/components/content-pipeline/GridCell.tsx` | Individual day cell (post preview, empty slot) |
| `src/components/content-pipeline/BroadcastModal.tsx` | Profile picker + stagger config |
| `src/components/content-pipeline/GridContextMenu.tsx` | Right-click actions (broadcast, reschedule, etc.) |
| `src/components/content-pipeline/TeamLinkedInConnect.tsx` | Connection status banner |
| `src/lib/services/team-integrations.ts` | Team profile LinkedIn account resolution |
| `src/lib/ai/content-pipeline/collision-detector.ts` | Same-day topic overlap detection (Haiku) |
| `src/trigger/broadcast-post-variations.ts` | AI voice rewriting + stagger scheduling |
| `src/app/api/content-pipeline/team-schedule/route.ts` | GET: weekly data for all profiles |
| `src/app/api/content-pipeline/team-schedule/assign/route.ts` | POST: assign buffer post to slot |
| `src/app/api/content-pipeline/broadcast/route.ts` | POST: trigger broadcast task |
| `supabase/migrations/20260226200000_team_command_center.sql` | DB migration |

### LinkedIn Connection

`team_profile_integrations` table decouples LinkedIn connections from user accounts. Connect flow: `/api/linkedin/connect?team_profile_id=X` → Unipile OAuth → webhook stores account ID against the profile. Falls back to `user_integrations` for backward compat.

### Publishing

`getTeamProfileLinkedInPublisher(profileId)` resolves the Unipile account ID from `team_profile_integrations` first, then `user_integrations` fallback.
