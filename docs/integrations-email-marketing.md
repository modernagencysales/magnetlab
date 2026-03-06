<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## Email Marketing Integrations

Native integrations with 4 email service providers. Users connect their ESP in Settings, map funnels to specific lists+tags, and leads are auto-subscribed on opt-in (fire-and-forget).

### Supported Providers

| Provider | Auth | Base URL | Subscribe pattern |
|----------|------|----------|-------------------|
| Kit (ConvertKit) | `X-Kit-Api-Key` header | `api.kit.com/v4` | Form subscribe + optional tag (2 calls) |
| MailerLite | `Bearer` token | `connect.mailerlite.com/api` | POST /subscribers with groups[] (1 call) |
| Mailchimp | OAuth 2.0 access token | `{dc}.api.mailchimp.com/3.0` | PUT member upsert + tag by name (2 calls) |
| ActiveCampaign | `Api-Token` header | `{account}.api-us1.com/api/3` | Create contact + add to list + tag (3 calls) |

### Data Model

- `user_integrations` -- stores encrypted API keys per service (existing table, new service values: `kit`, `mailerlite`, `mailchimp`, `activecampaign`)
- `funnel_integrations` -- per-funnel provider mappings (`funnel_page_id + provider` unique constraint, RLS on `user_id`)

### Data Flow

```
User connects ESP in Settings → credentials validated → stored in user_integrations
User maps funnel to list+tag → stored in funnel_integrations
Lead opts in → POST /api/public/lead → syncLeadToEmailProviders() [fire-and-forget]
  → queries funnel_integrations for active mappings
  → for each: gets credentials → provider.subscribe(list, email, tag)
  → errors logged, never blocks response
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/email-marketing/connect` | POST | Save API key + validate credentials |
| `/api/integrations/email-marketing/disconnect` | POST | Remove connection + deactivate funnel mappings |
| `/api/integrations/email-marketing/verify` | POST | Re-validate stored credentials |
| `/api/integrations/email-marketing/lists` | GET | Fetch lists from provider (`?provider=kit`) |
| `/api/integrations/email-marketing/tags` | GET | Fetch tags (`?provider=kit&listId=...`) |
| `/api/integrations/email-marketing/connected` | GET | List connected provider names |
| `/api/integrations/mailchimp/authorize` | GET | Start Mailchimp OAuth flow |
| `/api/integrations/mailchimp/callback` | GET | Handle Mailchimp OAuth callback |
| `/api/funnels/[id]/integrations` | GET/POST | List/upsert funnel integration mappings |
| `/api/funnels/[id]/integrations/[provider]` | DELETE | Remove mapping |

### Key Files

- `src/lib/integrations/email-marketing/types.ts` -- `EmailMarketingProvider` interface
- `src/lib/integrations/email-marketing/index.ts` -- factory, type guard, `syncLeadToEmailProviders()`
- `src/lib/integrations/email-marketing/providers/` -- kit.ts, mailerlite.ts, mailchimp.ts, activecampaign.ts
- `src/components/settings/EmailMarketingSettings.tsx` -- settings page UI
- `src/components/funnel/FunnelIntegrationsTab.tsx` -- per-funnel mapping UI

### Security Notes

- ActiveCampaign `base_url` validated against `https://<account>.api-us1.com` pattern (SSRF prevention)
- Mailchimp `server_prefix` validated against `^[a-z]{2}\d+$` pattern
- All provider API calls have 10-second fetch timeout
- Pagination loops capped at 50 pages
- Mailchimp OAuth uses CSRF state cookie (httpOnly, 10-min TTL)

### Env Vars

- `MAILCHIMP_CLIENT_ID` -- Mailchimp OAuth app client ID
- `MAILCHIMP_CLIENT_SECRET` -- Mailchimp OAuth app client secret
- OAuth redirect URI: `{NEXT_PUBLIC_APP_URL}/api/integrations/mailchimp/callback`
