# Deployment Standards

## Branch → Environment Mapping

| Branch | Environment | Trigger |
|--------|-------------|---------|
| `main` | Dev (preview) | Push to main, after CI passes |
| `release/**` | Production | Push to release branch (e.g. `release/1.0.0`), after CI passes |

## Workflow

1. **CI** runs on push/PR to `main` or `release/**` (typecheck, lint, tests, build, E2E).
2. **Deploy** runs when CI completes successfully:
   - `main` → Vercel preview deployment (dev environment)
   - `release/*` → Vercel production deployment

## Release Process

To release to production:

1. Create and push a release branch: `release/1.0.0` (or `release/2.0.0`, etc.)
2. CI runs automatically; Deploy runs after CI succeeds
3. Production is updated via Vercel

## GitHub Environments

- **dev**: Used for main branch deployments. Create in Settings → Environments if missing.
- **production**: Used for release branch deployments. Requires approval if configured.

## Vercel Configuration

- Dev uses `environment=preview` (Vercel preview env vars)
- Production uses `environment=production` (Vercel production env vars)

Ensure Vercel project has both environments configured with appropriate env vars.
