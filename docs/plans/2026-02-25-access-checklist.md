# New Developer Access Checklist

**Date:** 2026-02-25
**Purpose:** Everything a new dev needs access to before day 1. Get these set up BEFORE they start so they're not blocked.

---

## Critical (Blocks all development)

| Service | What They Need | How to Grant | Used By |
|---------|---------------|--------------|---------|
| **GitHub** | Collaborator on `modernagencysales` org | GitHub org settings → invite | All repos |
| **Supabase** | Member of project `qvawbxpijxlwdkolmjrs` | Supabase dashboard → Settings → Members | All repos (shared DB) |
| **Vercel** | Team member on Vercel account | Vercel dashboard → Settings → Members | magnetlab, copy-of-gtm-os, leadmagnet-admin, dwy-playbook |
| **Railway** | Team member on Railway workspace | Railway dashboard → Settings → Members | gtm-system, leadmagnet-backend |

## Important (Blocks specific features)

| Service | What They Need | How to Grant | Used By |
|---------|---------------|--------------|---------|
| **Trigger.dev** | Access to all 3 projects | Trigger.dev dashboard → Team → invite | magnetlab, gtm-system, leadmagnet-backend |
| **Anthropic (Claude API)** | API key (or shared team key) | console.anthropic.com → API Keys | AI features across all repos |
| **OpenAI** | API key | platform.openai.com → API Keys | Embeddings (magnetlab) |
| **Stripe** | Dashboard access (read at minimum) | Stripe dashboard → Settings → Team | magnetlab, gtm-system, copy-of-gtm-os |

## Nice to Have (Can add later as needed)

| Service | What They Need | Used By | Notes |
|---------|---------------|---------|-------|
| **Resend** | Dashboard access | magnetlab, leadmagnet-backend | Transactional email monitoring |
| **PlusVibe** | Dashboard access | gtm-system | Cold email campaign monitoring |
| **HeyReach** | Dashboard access | gtm-system | LinkedIn outreach monitoring |
| **Attio** | Workspace member | gtm-system | CRM (bidirectional sync) |
| **Apify** | Account access | magnetlab, leadmagnet-backend | LinkedIn scraping |
| **Zapmail** | Dashboard access | gtm-system | Email infrastructure provisioning |
| **Linear** | Workspace member | gtm-system | DFY project management |
| **PostHog** | Project access | magnetlab | Product analytics |
| **Sentry** | Project access | leadmagnet-backend | Error monitoring |

## Environment Variables to Share

These need to be shared securely (1Password, encrypted message, etc.):

**Shared across repos:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Per-repo secrets:**
- magnetlab: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `STRIPE_*` keys, `TRIGGER_SECRET_KEY`
- gtm-system: `TRIGGER_SECRET_KEY`, `ANTHROPIC_API_KEY`, all integration API keys
- leadmagnet-backend: `ANTHROPIC_API_KEY`, `APIFY_API_KEY`, `ADMIN_API_KEY`, `TRIGGER_SECRET_KEY`
- leadmagnet-admin: `ADMIN_PASSWORD`, `RAILWAY_URL`, `ADMIN_API_KEY`

**Recommendation:** Set up a shared 1Password vault with all env vars organized by repo. This eliminates the "ask Tim for the key" bottleneck.

## Git Access Verification

After granting GitHub access, have them verify they can clone all repos:

```bash
git clone git@github.com:modernagencysales/magnetlab.git
git clone git@github.com:modernagencysales/gtm-system.git
git clone git@github.com:modernagencysales/copy-of-gtm-os.git
git clone git@github.com:modernagencysales/leadmagnet-backend.git
git clone git@github.com:modernagencysales/leadmagnet-admin.git
git clone git@github.com:modernagencysales/dwy-playbook.git
```

## macOS Keychain Note

The Supabase CLI token is stored in the macOS Keychain under "Supabase CLI" service. The new dev will get their own token when they run `supabase login`. They do NOT need your token — they'll get project access via the Supabase team membership above.
