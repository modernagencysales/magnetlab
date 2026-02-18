# Custom Domains & White-Label Design

**Date:** 2026-02-18
**Status:** Approved

## Problem

Clients need to host their pages and lead magnets on a custom subdomain for white-labeling. They also need the ability to remove "Powered by MagnetLab" branding. This must be configurable per team.

## Decisions

- One custom domain per team (not per-funnel)
- Client provides their own subdomain via CNAME (true white-label)
- Full white-label kit: remove badge, custom favicon, custom site_name, custom email sender name
- Gated to Pro+ plan
- Auto-verify via Vercel Domains API

## Database Schema

### New table: `team_domains`

```sql
CREATE TABLE team_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  vercel_domain_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending_dns',  -- pending_dns | verified | active | error
  dns_config JSONB,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_domains_team_id UNIQUE (team_id),
  CONSTRAINT uq_team_domains_domain UNIQUE (domain)
);
```

### New columns on `teams`

```sql
ALTER TABLE teams ADD COLUMN hide_branding BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE teams ADD COLUMN custom_favicon_url TEXT;
ALTER TABLE teams ADD COLUMN custom_site_name TEXT;
ALTER TABLE teams ADD COLUMN custom_email_sender_name TEXT;
ALTER TABLE teams ADD COLUMN whitelabel_enabled BOOLEAN NOT NULL DEFAULT false;
```

### Deprecation

`funnel_pages.custom_domain` column is ignored going forward. No immediate drop.

### RLS

- `team_domains`: team owner can CRUD. Public SELECT on domain + status + team_id (middleware lookup without auth).

## Middleware & Routing

### Request flow

```
Client browser → leads.clientbrand.com/my-funnel
  → Vercel edge (SSL terminated)
    → Next.js middleware reads Host header
      → Skip if host is magnetlab.app / localhost / *.vercel.app
      → Lookup team_domains WHERE domain = Host
        → Found + active: rewrite to /p/{team_owner_username}/{path}
        → Not found: 404
```

### Performance

- In-memory LRU cache in middleware, 60-second TTL
- Cache key = hostname, value = { teamId, username, status }
- Per-instance cache (Vercel edge is stateless per-region), acceptable at this scale

### Headers passed downstream

- `x-custom-domain: true`
- `x-team-id: {team_id}`

### Root path

`leads.clientbrand.com/` → 404 (no team landing page for now)

## White-Label Rendering

### Data flow

```
page.tsx (server component)
  → fetch funnel_page by username + slug
  → from funnel_page.team_id → fetch teams whitelabel config
  → pass config as props to client components
```

### Component changes

| Component | Change |
|-----------|--------|
| OptinPage.tsx | Conditional "Powered by" footer |
| ThankyouPage.tsx | Conditional "Powered by" footer |
| ContentFooter.tsx | Conditional "Powered by" footer |
| generateMetadata() (all 3 pages) | custom_site_name for og:site_name + title suffix |
| Layout/head | custom_favicon_url as link rel="icon" |

### Conditional rendering

```tsx
{!whitelabel?.hide_branding && (
  <a href="https://magnetlab.app" ...>Powered by MagnetLab</a>
)}
```

### Metadata

- Default: "Lead Magnet Title | MagnetLab"
- White-label: "Lead Magnet Title | ClientBrandName"
- No custom_site_name: just "Lead Magnet Title" (no suffix)

### Email sender name

Stored now, wired up when transactional emails reference sender name.

## Vercel Domain Provisioning

### Setup flow

```
User enters domain → POST /api/settings/team-domain
  → Validate format + plan check
  → Insert team_domains (status: pending_dns)
  → Vercel API: POST /v10/projects/{projectId}/domains { name: domain }
  → Store vercel_domain_id + dns_config
  → Return DNS instructions

User configures CNAME → clicks Verify → POST /api/settings/team-domain/verify
  → Vercel API: GET /v10/projects/{projectId}/domains/{domain}
  → Verified? → status = 'active'
  → Not yet? → return current status + what's missing
```

### API routes

| Route | Method | Purpose |
|-------|--------|---------|
| /api/settings/team-domain | GET | Get team's domain + status |
| /api/settings/team-domain | POST | Set domain, add to Vercel |
| /api/settings/team-domain | DELETE | Remove domain from Vercel + DB |
| /api/settings/team-domain/verify | POST | Check DNS verification |

### Env vars required

- `VERCEL_TOKEN` — Vercel API bearer token
- `VERCEL_PROJECT_ID` — magnetlab project ID

### Error handling

- Domain on another Vercel project → tell user
- Invalid format → reject before Vercel call
- Vercel API down → save as pending_dns, retry later
- DNS not propagated → "can take up to 48 hours"

## Settings UI

New "White Label" section in Settings (or dedicated tab).

### Layout

- **Custom Domain** card: domain input, save, status indicator, expandable DNS instructions with copy button, verify button
- **Branding** card: hide_branding checkbox, site_name input, favicon upload, email sender name input, single save button

### Plan gating

- Free users see section with Pro upgrade overlay
- Fields disabled with lock icon

### Favicon upload

- Reuse Supabase Storage upload pattern (same as brand kit logos)
- Accept .ico, .png, .svg — max 512KB

### Domain status

- After save: poll verify endpoint every 10s for 2 minutes
- Then show "check back later" message

## Deprecation

- `funnel_pages.custom_domain` column: stop reading, keep in DB
- `/api/settings/custom-domain` route: deprecate, new routes at `/api/settings/team-domain`
