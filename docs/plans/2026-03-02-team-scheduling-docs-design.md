# Team Scheduling Documentation Design

**Date:** 2026-03-02
**Status:** Approved

## Context

MagnetLab has team scheduling features (Team Command Center, broadcast-to-team, collision detection, per-profile posting slots, voice profiles). No user-facing docs exist. The team (5+ people, mixed skill levels) needs documentation before scaling LinkedIn posting across accounts.

## Decision

Add 5 new guides to the existing `/docs` section under a new "Team Scheduling" sidebar section.

## Guides

| # | Slug | Title | Content |
|---|------|-------|---------|
| 1 | `team-setup` | Setting Up Your Team | Creating a team, inviting members, roles (owner/member), managing profiles |
| 2 | `team-command-center` | Using the Command Center | Weekly grid view, navigating weeks, layout, buffer dock |
| 3 | `team-broadcasting` | Broadcasting Posts to Your Team | Right-click broadcast, selecting profiles, stagger config, reviewing variations, collision detection |
| 4 | `team-posting-slots` | Managing Posting Slots | Per-profile schedules, assigning buffer posts, day/time config |
| 5 | `team-linkedin-voices` | LinkedIn Connections & Voice Profiles | Connecting LinkedIn via Unipile, voice profiles, how they evolve |

## Implementation

- 5 new React components in `src/components/docs/guides/`
- Register all in `guides/index.ts`
- Add "Team Scheduling" section to `DocsSidebar.tsx` (after Quick Start, Users icon)
- Follow existing guide patterns (client components, consistent typography, cross-linking)
