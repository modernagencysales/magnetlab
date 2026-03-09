<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## Custom Domains & White-Label

Team-level custom domain and white-label support. One domain per team via CNAME → Vercel. Pro+ plan only.

### Database

- `team_domains` table: `id, team_id, domain, vercel_domain_id, status, dns_config, last_checked_at, created_at, updated_at`
- `teams` table columns: `hide_branding`, `custom_favicon_url`, `custom_site_name`, `custom_email_sender_name`, `whitelabel_enabled`
- Status values: `pending_dns`, `verified`, `active`, `error`
- RLS: public SELECT (middleware needs unauthenticated lookup), owner CRUD

### How It Works

1. **Domain setup**: User enters domain in Settings → `POST /api/settings/team-domain` → Vercel Domains API adds domain → returns DNS instructions
2. **DNS verification**: User configures CNAME → clicks Verify (or auto-poll 10s×12) → `POST /api/settings/team-domain/verify` → Vercel API checks → status → `active`
3. **Request routing**: `middleware.ts` reads Host header → `lookupCustomDomain()` (LRU cached 60s, 500 entries) → rewrites to `/p/[username]/[slug]` → sets `x-custom-domain` + `x-team-id` headers
4. **White-label rendering**: Server components fetch `getWhitelabelConfig(teamId)` → pass `hideBranding` to client components → conditional "Powered by" footer
5. **Metadata**: `custom_site_name` replaces "MagnetLab" in `<title>` suffix and og:site_name; `custom_favicon_url` as `<link rel="icon">`

### Key Files

- `src/lib/utils/domain-lookup.ts` -- LRU-cached domain → team/username resolution
- `src/lib/utils/whitelabel.ts` -- `getWhitelabelConfig(teamId)` helper
- `src/lib/integrations/vercel-domains.ts` -- Vercel Domains API client (add, check, remove, config)
- `src/middleware.ts` -- Custom domain routing (Host header → rewrite)
- `src/app/api/settings/team-domain/route.ts` -- Domain CRUD (GET, POST, DELETE)
- `src/app/api/settings/team-domain/verify/route.ts` -- DNS verification
- `src/app/api/settings/whitelabel/route.ts` -- White-label settings (GET, PATCH)
- `src/components/settings/WhiteLabelSettings.tsx` -- Settings UI (domain + branding)
- `src/components/funnel/public/OptinPage.tsx` -- Conditional branding
- `src/components/funnel/public/ThankyouPage.tsx` -- Conditional branding
- `src/components/content/ContentFooter.tsx` -- Conditional branding
- `supabase/migrations/20260219000000_team_domains_whitelabel.sql` -- Migration

### Env Vars

- `VERCEL_TOKEN` -- Vercel API bearer token (required for domain provisioning)
- `VERCEL_PROJECT_ID` -- Vercel project ID for magnetlab
- `VERCEL_TEAM_ID` -- Vercel team ID (optional, for org accounts)

### Whitelabel Email Domains

Teams can verify their own email sending domain via Resend API (in-app), so transactional emails send from their domain instead of `sends.magnetlab.app`.

- `team_email_domains` table: `id, team_id, domain, resend_domain_id, status, dns_records, region, last_checked_at, created_at, updated_at`
- `teams.custom_from_email` column: full sender address (e.g., `hello@clientbrand.com`)
- Status values: `pending`, `verified`, `failed`
- DNS records from Resend include SPF (TXT), DKIM (TXT), and MX with per-record verification status
- Sender resolution priority in `getSenderInfo()`: user's own Resend account > team verified email domain + `custom_from_email` > default `hello@sends.magnetlab.app`

Key files:
- `src/lib/integrations/resend-domains.ts` -- Resend Domains API client (create, get, verify, delete)
- `src/app/api/settings/team-email-domain/route.ts` -- Email domain CRUD
- `src/app/api/settings/team-email-domain/verify/route.ts` -- DNS verification
- `src/app/api/settings/team-email-domain/from-email/route.ts` -- From-email with domain suffix validation
- `src/lib/services/email-sequence-trigger.ts` -- `getSenderInfo()` resolves team email domain

### Deprecation / Removed

- `funnel_pages.custom_domain` column is ignored — domain is now team-level via `team_domains`
- **Loops integration removed** — `src/lib/integrations/loops.ts` deleted, all Loops types and references cleaned from email types and API routes. DB columns `loops_synced_at` / `loops_transactional_ids` remain in `email_sequences` table (harmless).
