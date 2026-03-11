# Development Workflow

How development and releases work at MagnetLab.

## Branch Strategy

| Branch | Purpose | Deploys to |
|--------|---------|------------|
| `main` | Active development, all PRs merge here | Dev |
| `release/X.Y.Z` | Production releases (e.g. `release/1.0.0`) | Production |

## Daily Development

1. **Create a feature branch** from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feature/your-feature-name
   ```

2. **Develop** — make changes, run `pnpm typecheck` and `pnpm lint` locally.

3. **Open a PR** into `main`. CI runs automatically (typecheck, lint, tests, build, E2E).

4. **Merge** when CI passes and review is complete.

5. **main** auto-deploys to dev after CI succeeds.

## Release Process

1. **Create a release branch** from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b release/1.0.0
   git push -u origin release/1.0.0
   ```

2. **CI runs** on the release branch (same checks as main).

3. **Deploy runs** after CI succeeds → production is updated via Vercel.

4. **Optional:** Merge release branch back to main if you want release commits in history:
   ```bash
   git checkout main && git merge release/1.0.0
   git push
   ```

## Release Branch Rules

- **Naming:** `release/1.0.0`, `release/2.1.0`, etc. (semver).
- **Source:** Always branch from latest `main`.
- **Hotfixes:** Fix on release branch, push; or fix on main and cherry-pick to release.
- **One release per branch:** Each `release/X.Y.Z` branch deploys once. For the next release, create a new branch from main.

## Pre-Commit Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] New/changed Zod schemas have Jest tests
- [ ] New API routes have tests

## Post-Feature (from CLAUDE.md)

1. Write tests (Zod, API, utils)
2. Request code review
3. Resolve findings
4. Update docs in `docs/` if the feature is user-facing or architectural
