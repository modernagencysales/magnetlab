# Custom Domains & White-Label

Team-level custom domain (Pro+). One domain per team via CNAME → Vercel.

## Flow

1. Settings → enter domain → Vercel adds → DNS instructions
2. User configures CNAME → Verify → status `active`
3. `middleware.ts` reads Host → `lookupCustomDomain()` → rewrite to `/p/[username]/[slug]`
4. `getWhitelabelConfig(teamId)` → hide branding, custom favicon, site name

## Tables

`team_domains` (domain, status, dns_config) | `teams` (hide_branding, custom_favicon_url, custom_site_name, custom_email_sender_name)

## Email Domains

`team_email_domains` — verify sending domain via Resend. `custom_from_email` for transactional emails.
