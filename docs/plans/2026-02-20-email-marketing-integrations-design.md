# Email Marketing Integrations — Design

**Date**: 2026-02-20
**Status**: Approved

## Goal

Native email marketing integrations so leads captured through magnetlab funnels are automatically subscribed to the user's ESP (email service provider). Four providers in this batch: **Kit (ConvertKit)**, **MailerLite**, **Mailchimp**, **ActiveCampaign**.

## Requirements

- **Subscribe to list + optional tag** on lead opt-in (fire-and-forget, non-blocking)
- **Global connection** in Settings (API key for Kit/MailerLite/AC, OAuth for Mailchimp)
- **Per-funnel mapping** — user picks which list and optional tag per funnel per provider
- A funnel can connect to multiple providers simultaneously
- One list per provider per funnel

## Data Model

### Existing: `user_integrations`

Reused for storing provider credentials. New service values: `kit`, `mailerlite`, `mailchimp`, `activecampaign`.

For Mailchimp (OAuth): `api_key` stores access token, `metadata` stores `{ server_prefix, ... }`.

### New: `funnel_integrations`

```sql
CREATE TABLE funnel_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_page_id UUID NOT NULL REFERENCES funnel_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,          -- 'kit' | 'mailerlite' | 'mailchimp' | 'activecampaign'
  list_id TEXT NOT NULL,           -- provider's list/form ID
  list_name TEXT,                  -- cached display name
  tag_id TEXT,                     -- optional tag ID
  tag_name TEXT,                   -- cached display name
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(funnel_page_id, provider)
);

ALTER TABLE funnel_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own funnel integrations"
  ON funnel_integrations FOR ALL USING (user_id = auth.uid());
```

## Provider Interface

```ts
interface EmailMarketingProvider {
  validateCredentials(): Promise<boolean>
  getLists(): Promise<{ id: string; name: string }[]>
  getTags(): Promise<{ id: string; name: string }[]>
  subscribe(params: {
    listId: string
    email: string
    firstName?: string
    tagId?: string
  }): Promise<{ success: boolean; error?: string }>
}
```

### Provider Details

| Provider | Auth | Base URL | Lists | Tags | Subscribe |
|----------|------|----------|-------|------|-----------|
| Kit | `Authorization: Bearer {key}` | `https://api.kit.com/v4` | `GET /v4/forms` | `GET /v4/tags` | `POST /v4/forms/{id}/subscribers` |
| MailerLite | `Authorization: Bearer {key}` | `https://connect.mailerlite.com/api` | `GET /api/groups` | N/A (empty) | `POST /api/subscribers` + group |
| Mailchimp | `Bearer {token}`, server prefix | `https://{dc}.api.mailchimp.com` | `GET /3.0/lists` | `GET /3.0/lists/{id}/tag-search` | `POST /3.0/lists/{id}/members` |
| ActiveCampaign | `Api-Token: {key}` | `https://{account}.api-us1.com` | `GET /api/3/lists` | `GET /api/3/tags` | `POST /api/3/contacts` + contactLists |

Factory: `getEmailMarketingProvider(provider, credentials) → EmailMarketingProvider`

## API Routes

### Global connection (`/api/integrations/email-marketing/`)

| Route | Method | Purpose |
|-------|--------|---------|
| `connect` | POST | Save API key or initiate OAuth |
| `disconnect` | POST | Remove connection |
| `lists` | GET | Fetch lists (`?provider=kit`) |
| `tags` | GET | Fetch tags (`?provider=kit`) |
| `verify` | POST | Test credentials |

### Mailchimp OAuth

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/mailchimp/authorize` | GET | Redirect to Mailchimp OAuth |
| `/api/integrations/mailchimp/callback` | GET | Handle callback, store token |

### Per-funnel mapping

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/funnels/[id]/integrations` | GET | List funnel integrations |
| `/api/funnels/[id]/integrations` | POST | Save/update mapping |
| `/api/funnels/[id]/integrations/[provider]` | DELETE | Remove mapping |

## Lead Capture Hook

In `/api/public/lead` POST handler, after existing webhook/email-flow logic:

```ts
syncLeadToEmailProviders(funnelPageId, { email, name }).catch(console.error)
```

Flow:
1. Query `funnel_integrations` for active mappings
2. Fetch credentials from `user_integrations` per provider
3. Call `provider.subscribe()` for each
4. Log success/failure (no retry, fire-and-forget)

## Settings UI

### Global (Settings > Integrations)

`EmailMarketingSettings` component:
- Card per provider (logo, name, description)
- Connect: API key modal (Kit/MailerLite/AC) or OAuth redirect (Mailchimp)
- Connected state: green badge + disconnect + test connection

### Per-funnel (Funnel editor > Integrations tab)

- Only shows globally-connected providers
- List dropdown + optional tag dropdown per provider
- Enable/disable toggle
- Last sync status display

## File Structure

```
src/lib/integrations/email-marketing/
  types.ts              # EmailMarketingProvider interface, shared types
  index.ts              # factory, syncLeadToEmailProviders
  providers/
    kit.ts
    mailerlite.ts
    mailchimp.ts
    activecampaign.ts

src/app/api/integrations/email-marketing/
  connect/route.ts
  disconnect/route.ts
  lists/route.ts
  tags/route.ts
  verify/route.ts

src/app/api/integrations/mailchimp/
  authorize/route.ts
  callback/route.ts

src/app/api/funnels/[id]/integrations/
  route.ts              # GET + POST
  [provider]/route.ts   # DELETE

src/components/settings/
  EmailMarketingSettings.tsx

src/components/funnel-editor/
  FunnelIntegrationsTab.tsx
```
