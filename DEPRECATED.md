# DEPRECATED — Do Not Develop Here

**As of 2026-03-25, this repository is frozen.**

All new development happens in the monorepo at `apps/app/` (`@maestro/app`):
- GitHub: `modernagencysales/porto`
- Local: `/Users/timlife/conductor/workspaces/mas-platform/porto/apps/app/`

## What's happening

MagnetLab is being renamed to **Maestro** and migrated into the monorepo. This repo stays deployed at `magnetlab.app` until the domain cutover to `maestrogtm.com` is complete.

## Emergency hotfix protocol

If a critical production bug is found:
1. Fix it here on a `hotfix/*` branch
2. Merge to `main` and deploy
3. **Immediately** cherry-pick the fix into the monorepo's `apps/app/`

Do NOT start new feature work here.
