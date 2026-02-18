# Whitelabel Email Domains Design

**Date:** 2026-02-18
**Status:** Approved

## Problem

Users who want to send transactional emails from their own domain (e.g., `hello@clientbrand.com` instead of `hello@sends.magnetlab.app`) currently need to connect their own Resend account and verify the domain in Resend's dashboard externally. We want to bring domain verification in-app so users never leave MagnetLab.

## Decisions

- One email domain per team (not per-user or per-funnel)
- Domain verified on MagnetLab's platform Resend account — users don't need their own Resend account
- Gated to Pro+ plan (same as custom page domains)
- Resend Domains API handles SPF, DKIM, MX verification
- Remove Loops integration (dead code, never used, causes confusion)

## Database Schema

### New table: `team_email_domains`

```sql
CREATE TABLE team_email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  resend_domain_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | verified | failed
  dns_records JSONB,                        -- SPF, DKIM, MX records from Resend
  region TEXT NOT NULL DEFAULT 'us-east-1',
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_email_domains_team_id UNIQUE (team_id),
  CONSTRAINT uq_team_email_domains_domain UNIQUE (domain)
);
```

### New column on `teams`

```sql
ALTER TABLE teams ADD COLUMN IF NOT EXISTS custom_from_email TEXT;
```

Stores the full sender address (e.g., `hello@clientbrand.com`). Combined with existing `custom_email_sender_name`, gives `"ClientName" <hello@clientbrand.com>`.

### RLS

- `team_email_domains`: owner CRUD (no public read needed — no middleware lookup unlike page domains)

## Resend API Client

New file: `src/lib/integrations/resend-domains.ts`

Uses the platform `RESEND_API_KEY` (not user accounts). Four functions:

| Function | Resend Endpoint | Purpose |
|----------|----------------|---------|
| `createResendDomain(domain)` | `POST /domains` | Register domain, get DNS records |
| `verifyResendDomain(resendDomainId)` | `POST /domains/{id}/verify` | Trigger async verification |
| `getResendDomain(resendDomainId)` | `GET /domains/{id}` | Get current status + per-record status |
| `deleteResendDomain(resendDomainId)` | `DELETE /domains/{id}` | Remove domain |

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/settings/team-email-domain` | GET | Get team's email domain + status + DNS records |
| `/api/settings/team-email-domain` | POST | Add domain to Resend, store DNS records |
| `/api/settings/team-email-domain` | DELETE | Remove domain from Resend + DB |
| `/api/settings/team-email-domain/verify` | POST | Trigger Resend verification, poll status |

### POST flow

1. Auth + plan check (Pro+)
2. Validate domain format
3. `createResendDomain(domain)` → DNS records (SPF, DKIM, MX)
4. Insert `team_email_domains` with status `pending`
5. Return DNS records for UI display

### Verify flow

1. `verifyResendDomain(resendDomainId)` → trigger async check
2. `getResendDomain(resendDomainId)` → current status + per-record statuses
3. Update DB — `verified` if all records pass, else stay `pending`
4. Return status + record-level statuses

### DELETE flow

1. `deleteResendDomain(resendDomainId)` → remove from Resend
2. Delete DB row
3. Clear `custom_from_email` on teams table

## Settings UI

Extend existing `WhiteLabelSettings.tsx` — add "Email Domain" card below the branding section:

- **No domain**: Domain input + "Add Domain" button
- **Pending**: Domain name + amber badge + expandable DNS panel (SPF, DKIM, MX with per-record status + copy buttons) + Verify button + auto-poll (10s × 12)
- **Verified**: Domain name + green badge + trash button with confirmation
- **From email input**: Shown when domain is verified. Validated to match verified domain suffix.

DNS records from Resend are richer than Vercel's — SPF (TXT), DKIM (TXT), and optionally MX. Each row shows Type, Name, Value, Status indicator.

## Email Sending Wire-Up

### Sender resolution priority (in `email-sequence-trigger.ts` → `getSenderInfo()`)

1. User's own connected Resend account (explicit opt-in, they manage everything)
2. Team's verified email domain + `custom_from_email` + `custom_email_sender_name` (platform account, client's domain)
3. Default `hello@sends.magnetlab.app` / `MagnetLab` (platform account, MagnetLab domain)

No changes to `sendEmail()` itself — it already accepts `fromName`/`fromEmail` params. The resolution happens upstream in `getSenderInfo()`.

## Loops Removal

Remove all Loops integration code:
- `src/lib/integrations/loops.ts`
- Loops verification path in `/api/integrations/verify`
- Loops types in `src/lib/types/`
- Any Loops references in settings UI, email trigger service, or types
- `LOOPS_API_KEY` env var references

## Env Vars

No new env vars needed — uses existing `RESEND_API_KEY` on the platform account.
