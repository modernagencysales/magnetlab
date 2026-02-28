# Team Command Center — Multi-Account Scheduling

**Date**: 2026-02-26
**Status**: Approved
**Repo**: magnetlab

## Problem

Modern Agency Sales needs to post lead magnets daily across ~5 LinkedIn accounts on one team. Currently, you must switch profiles one-at-a-time via the ProfileSwitcher to manage each person's schedule. There's no unified view to see gaps, schedule all accounts, or distribute content across voices.

## Solution

A dedicated **Team Command Center** page (`/content/team-scheduler`) with a weekly calendar grid showing all team profiles as rows, plus a "Broadcast" feature to distribute content across accounts with AI-generated voice variations.

## Core View: Weekly Calendar Grid

**Page**: `/content/team-scheduler` — new tab in content pipeline navigation

### Layout
- **Top bar**: Team selector, week navigation (< Prev | This Week | Next >)
- **Grid**: Rows = team profiles (avatar, name, LinkedIn status). Columns = days of week.
- **Right sidebar**: Appears on cell click — full post preview, inline edit, reschedule
- **Bottom dock**: Collapsible unscheduled buffer posts per member, draggable onto slots

### Cell States
| State | Visual | Interaction |
|-------|--------|-------------|
| Scheduled (approved) | Green badge, content type, hook preview, time | Click → sidebar preview |
| Draft/Reviewing | Yellow badge, dimmer | Click → sidebar, can approve |
| Empty slot | Dotted outline | Click → assign from buffer or write new |
| No slot | Blank | No posting slot configured for that day |

### Key Interactions
- Click empty slot → dropdown of buffer posts + "Write new" option
- Click filled cell → sidebar with post preview, edit, reschedule, delete
- Right-click any post → "Broadcast to team..." action
- Drag from buffer dock onto empty cell to schedule

## Broadcast Feature

### Flow
1. Right-click any post → "Broadcast to team"
2. **Member picker**: Checkboxes for each team profile (pre-selects all active except source)
3. **AI generates variations**: Trigger.dev task `broadcast-post-variations` rewrites in each member's `TeamVoiceProfile`
4. **Preview & edit**: Side-by-side modal showing all variations, each editable inline
5. **Schedule All**: One-click assigns each variation to next available slot per member

### Stagger Logic
Broadcast posts auto-stagger across 2-3 days rather than same day to avoid LinkedIn detecting coordinated posting. Configurable.

### Data Model
- New column: `cp_pipeline_posts.broadcast_group_id` (UUID, nullable)
- Posts in the same broadcast group are siblings — prevents double-broadcasting same content
- Source post gets the same `broadcast_group_id` for traceability

### Trigger.dev Task: `broadcast-post-variations`
```
Input: { sourcePostId, targetProfileIds[], staggerDays? }
Process:
  1. Fetch source post content + each target profile's TeamVoiceProfile
  2. For each target: AI rewrite preserving core message but adapting voice
  3. Create cp_pipeline_posts for each (status: 'reviewing', broadcast_group_id)
  4. Auto-schedule to next available slot per member (with stagger)
Output: { variations: { profileId, postId, scheduledTime }[] }
```

## Multi-Account LinkedIn Connection

### New Table: `team_profile_integrations`
```sql
CREATE TABLE team_profile_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_profile_id UUID NOT NULL REFERENCES team_profiles(id) ON DELETE CASCADE,
  service TEXT NOT NULL DEFAULT 'unipile',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',  -- { unipile_account_id: string }
  connected_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_profile_id, service)
);
```

### Connection Flows
- **Team owner connects for managed profiles**: Unipile OAuth flow passes `team_profile_id` param → callback stores `unipile_account_id` in `team_profile_integrations`
- **Team member connects their own**: Normal OAuth flow, but also writes to `team_profile_integrations` for their profile
- **Publishing**: New `getTeamProfileLinkedInPublisher(teamProfileId)` checks `team_profile_integrations` first, falls back to `user_integrations`

### LinkedIn Status in Grid
Each row shows connection status:
- 🟢 Connected — ready to auto-publish
- 🔴 Not connected — can schedule but won't auto-publish
- ⚠️ Connection expired — needs reconnect

## Next-Level Features

### 1. Content Collision Detection
When scheduling a broadcast or during autopilot, AI checks if two team members would post about the same topic on the same day. Flags overlaps and suggests swapping days or diversifying topics to maximize team reach.

### 2. Engagement Cascade Automation
After Member A posts, auto-queue Members B and C to like/comment on A's post within 30-60 minutes via Unipile. Creates organic-looking engagement within the team. Configurable per-post via `enable_automation` + `automation_config`.

### 3. "Fill My Week" — Team Content Calendar AI
One button generates a full week of content across all accounts:
- Analyzes team knowledge base, each member's voice profile, and posting slots
- Ensures optimal content pillar distribution across the team (not just per-member)
- Avoids topic duplication between members on the same day
- Generates posts, assigns to slots, puts in "reviewing" status for batch approval

### 4. Cross-Account Analytics Dashboard
Aggregate engagement metrics across all team accounts:
- Total reach, engagement rate, best-performing content types
- Per-member breakdown: which voice resonates with which content type
- Recommendations: "Tim's stories get 3x more engagement than his tips"

### 5. Smart Slot Optimization
Track engagement by posting time per member. Over time, suggest slot time adjustments:
- "Sarah's 10am posts get 40% more views than 8am — move her slot?"
- Auto-adjust after N data points with user confirmation

## Architecture Decisions

1. **New page, not refactor** — Keeps existing single-user flow intact. Team Command Center is additive.
2. **`team_profile_integrations` table** — Decouples LinkedIn connections from user accounts. Supports both owner-managed and self-connected profiles.
3. **`broadcast_group_id` on posts** — Simple UUID linking without a separate broadcast table. Lightweight.
4. **Stagger logic in Trigger.dev** — Server-side scheduling avoids client complexity and ensures stagger even if browser closes.
5. **Existing autopilot unchanged** — Nightly batch still runs per-profile. Team Command Center is a scheduling/visibility layer, not a replacement for autopilot.

## V1 Scope vs Future

### V1 (Build Now)
- Team Command Center weekly grid page
- Cell interactions (preview, assign from buffer, write new)
- Broadcast to team action + AI voice variations
- `team_profile_integrations` table + connection flow
- Stagger logic for broadcasts
- Content collision detection (basic)

### V2 (Future)
- Drag-and-drop reorder in grid
- Engagement cascade automation
- "Fill My Week" AI
- Cross-account analytics dashboard
- Smart slot optimization
- Multi-week view / month view
