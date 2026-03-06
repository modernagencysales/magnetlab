<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## GoHighLevel CRM Integration

Push leads to GoHighLevel as contacts on capture. Account-level API key auth, per-funnel toggle with custom tags.

### Data Flow

```
User connects GHL in Settings → API key validated → stored in user_integrations (service: 'gohighlevel')
User enables GHL per-funnel → toggle stored in funnel_integrations (provider: 'gohighlevel', settings: { custom_tags })
Lead opts in → POST /api/public/lead → syncLeadToGoHighLevel() [fire-and-forget with retry]
  → checks account + funnel toggles
  → builds payload with auto-tags + custom tags + UTMs + qualification data
  → POST /contacts/ to GHL API v1 (https://rest.gohighlevel.com/v1)
  → 3 retries with exponential backoff, errors logged only (never blocks lead capture)
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/gohighlevel/connect` | POST | Validate API key + save integration |
| `/api/integrations/gohighlevel/verify` | POST | Re-validate stored API key |
| `/api/integrations/gohighlevel/disconnect` | POST | Remove key + deactivate funnel toggles |
| `/api/integrations/gohighlevel/status` | GET | Check if GHL is connected (used by funnel builder) |

### Key Files

- `src/lib/integrations/gohighlevel/client.ts` -- GHL API client (createContact with retry, testConnection)
- `src/lib/integrations/gohighlevel/sync.ts` -- `syncLeadToGoHighLevel()` called from lead capture route
- `src/lib/integrations/gohighlevel/types.ts` -- GHL API types (GHLContactPayload, GHLSyncParams)
- `src/components/settings/GoHighLevelSettings.tsx` -- Settings UI (connect/verify/disconnect)
- `src/components/funnel/FunnelIntegrationsTab.tsx` -- Per-funnel toggle (GHLFunnelToggle component)

### Tags Strategy

Auto-tags (always applied): lead magnet title, funnel slug, `"magnetlab"`
Custom tags (optional): configured per-funnel via comma-separated input, stored in `funnel_integrations.settings.custom_tags`

### Database

No new tables. Uses existing:
- `user_integrations` -- `service: 'gohighlevel'`, stores API key
- `funnel_integrations` -- `provider: 'gohighlevel'`, `settings` JSONB for custom_tags, `is_active` toggle
- Migration: `20260225100000_funnel_integrations_settings.sql` -- adds `settings` column + GHL provider to constraint

## Kajabi CRM Integration

Push leads to Kajabi as contacts on capture with optional tag assignment. Account-level API key + Site ID auth, per-funnel toggle with multi-select tag picker.

### Data Flow

```
User connects Kajabi in Settings → API key + Site ID validated → stored in user_integrations (service: 'kajabi', metadata: { site_id })
User enables Kajabi per-funnel → toggle + tag_ids stored in funnel_integrations (provider: 'kajabi', settings: { tag_ids })
Lead opts in → POST /api/public/lead → syncLeadToKajabi() [fire-and-forget]
  → checks account integration (api_key + site_id from metadata)
  → checks funnel integration (is_active)
  → POST /v1/contacts (JSON:API format with site relationship)
  → POST /v1/contacts/{id}/relationships/tags (if tag_ids configured)
  → errors logged, never blocks lead capture
```

### Kajabi API

- **Base URL**: `https://api.kajabi.com/v1`
- **Auth**: `Authorization: Bearer {apiKey}`
- **Content-Type**: `application/vnd.api+json` (JSON:API spec)
- **Key endpoints**: `GET /v1/contacts` (list/test), `POST /v1/contacts` (create), `POST /v1/contacts/{id}/relationships/tags` (apply tags), `GET /v1/contact_tags` (list tags)
- **Contact creation requires site relationship**: `relationships: { site: { data: { type: 'sites', id: SITE_ID } } }`

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/kajabi/connect` | POST | Validate API key + Site ID, save integration |
| `/api/integrations/kajabi/verify` | POST | Re-validate stored credentials |
| `/api/integrations/kajabi/disconnect` | POST | Remove key + deactivate funnel toggles |
| `/api/integrations/kajabi/status` | GET | Check if Kajabi is connected (used by funnel builder) |
| `/api/integrations/kajabi/tags` | GET | Fetch available Kajabi tags (for funnel tag picker) |

### Key Files

- `src/lib/integrations/kajabi/client.ts` -- KajabiClient (testConnection, createContact, addTagsToContact, listTags)
- `src/lib/integrations/kajabi/sync.ts` -- `syncLeadToKajabi()` fire-and-forget, called from lead capture route
- `src/lib/integrations/kajabi/types.ts` -- Kajabi JSON:API types (KajabiSyncParams, payloads, responses)
- `src/components/settings/KajabiSettings.tsx` -- Settings UI (connect/verify/disconnect with API Key + Site ID inputs)
- `src/components/funnel/FunnelIntegrationsTab.tsx` -- Per-funnel toggle (KajabiFunnelToggle with multi-select tag picker)

### Database

No new tables. Uses existing:
- `user_integrations` -- `service: 'kajabi'`, stores API key, `metadata: { site_id }`
- `funnel_integrations` -- `provider: 'kajabi'`, `settings: { tag_ids: [...] }` JSONB, `is_active` toggle

## HeyReach LinkedIn Delivery Integration

Deliver lead magnets to opt-in leads via HeyReach LinkedIn DM campaigns. Account-level API key, per-funnel campaign selector, LinkedIn URL captured from `?li=` query param.

### Data Flow

```
HeyReach campaign sends DM with link: magnetlab.app/p/user/slug?li={linkedinUrl}
  → Prospect clicks → opt-in page reads ?li= param
  → POST /api/public/lead (stores linkedin_url on funnel_leads)
  → after() fires syncLeadToHeyReach() [fire-and-forget]
    → checks user_integrations (api_key) + funnel_integrations (campaign_id, is_active)
    → HeyReach addContactsToCampaign with customFields:
        lead_magnet_title, lead_magnet_url, utm_source, utm_medium, utm_campaign
    → updates funnel_leads.heyreach_delivery_status
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/heyreach/connect` | POST | Validate API key + save integration |
| `/api/integrations/heyreach/verify` | POST | Re-validate stored API key |
| `/api/integrations/heyreach/disconnect` | POST | Remove key + deactivate funnel toggles |
| `/api/integrations/heyreach/status` | GET | Check if HeyReach is connected |
| `/api/integrations/heyreach/campaigns` | GET | Fetch campaigns for dropdown selector |
| `/api/integrations/heyreach/accounts` | GET | Fetch LinkedIn accounts |

### Key Files

- `src/lib/integrations/heyreach/client.ts` -- HeyReach API client (addContactsToCampaign with retry, listCampaigns, listLinkedInAccounts, testConnection)
- `src/lib/integrations/heyreach/sync.ts` -- `syncLeadToHeyReach()` fire-and-forget, called from lead capture route
- `src/lib/integrations/heyreach/types.ts` -- HeyReach API types (HeyReachSyncParams, HeyReachContact, HeyReachCampaign)
- `src/components/settings/HeyReachSettings.tsx` -- Settings UI (connect/verify/disconnect + variable reference)
- `src/components/funnel/FunnelIntegrationsTab.tsx` -- Per-funnel toggle (HeyReachFunnelToggle with campaign dropdown)
- `src/components/funnel/public/OptinPage.tsx` -- Reads `?li=` param, passes as `linkedinUrl` in form submission

### Custom Variables (for HeyReach campaign templates)

| Variable | Source |
|----------|--------|
| `{lead_magnet_title}` | Lead magnet title |
| `{lead_magnet_url}` | Content delivery URL |
| `{utm_source}` | UTM source param |
| `{utm_medium}` | UTM medium param |
| `{utm_campaign}` | UTM campaign param |

### Database

- `funnel_leads` -- added `linkedin_url TEXT` and `heyreach_delivery_status TEXT` columns
- `user_integrations` -- `service: 'heyreach'`, stores API key
- `funnel_integrations` -- `provider: 'heyreach'`, `settings: { campaign_id }` JSONB, `is_active` toggle
- Migration: `20260227100000_heyreach_funnel_delivery.sql`
