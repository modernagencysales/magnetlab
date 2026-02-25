# GoHighLevel Integration — Design Doc

**Date**: 2026-02-25
**Repo**: magnetlab
**Status**: Approved

## Summary

Push leads from magnetlab to GoHighLevel on capture. Account-level API key auth, per-funnel toggle with auto-tags, retry on failure. No new tables — uses existing `user_integrations` + `funnel_integrations`.

## Data Flow

```
Lead captured → POST /api/public/lead
                  ↓ (parallel, fire-and-forget with retry)
                  ├─ syncLeadToEmailProviders()   ← existing
                  ├─ deliverWebhook()             ← existing
                  ├─ ...other existing events...
                  └─ syncLeadToGoHighLevel()       ← NEW
                       ↓
                  GHL API v1: POST /contacts/
                  + tags: [lead_magnet_name, funnel_name, "magnetlab"]
                  + custom fields: UTMs, qualification answers
```

## GHL API

- **Base URL**: `https://rest.gohighlevel.com/v1`
- **Auth**: `Authorization: Bearer {api_key}` (Location API key)
- **Create/upsert contact**: `POST /contacts/` — GHL deduplicates by email
- **Test connection**: `GET /contacts/?limit=1`

### Payload

```json
{
  "email": "lead@example.com",
  "name": "Jane Doe",
  "tags": ["My Lead Magnet", "my-funnel-slug", "magnetlab"],
  "source": "magnetlab",
  "customField": {
    "utm_source": "linkedin",
    "utm_medium": "social",
    "utm_campaign": "winter2026",
    "qualified": "yes",
    "qualification_answers": "{...json...}"
  }
}
```

## Database

No new tables. Uses existing:

1. **`user_integrations`** — `service: 'gohighlevel'`, `credentials: { api_key }` (encrypted via Vault)
2. **`funnel_integrations`** — `provider: 'gohighlevel'`, `enabled: boolean`, `settings: { custom_tags: [] }`

## New Files

| File | Purpose |
|------|---------|
| `src/lib/integrations/gohighlevel/client.ts` | GHL API client (createContact, testConnection) |
| `src/lib/integrations/gohighlevel/sync.ts` | `syncLeadToGoHighLevel()` — called from lead capture route |
| `src/lib/integrations/gohighlevel/types.ts` | GHL request/response types |
| `src/components/settings/GoHighLevelSettings.tsx` | Settings UI — API key, test, disconnect |
| Per-funnel toggle | Addition to existing funnel integration UI |

## Settings UI

Card in Settings page (same pattern as Kit/ActiveCampaign):
- API key input
- "Test Connection" button
- Connected/disconnected state
- Disconnect button

## Per-Funnel UI

In funnel integrations panel:
- "GoHighLevel" toggle (visible only if account connected)
- Optional custom tags input (merged with auto-tags)

## Error Handling

- 3 retries, exponential backoff (1s, 2s, 4s)
- Final failure: log only — never block lead capture
- Invalid API key: surface on "Test Connection", not during capture

## Tags Strategy

Auto-generated tags (always applied):
- Lead magnet title (e.g. "LinkedIn Profile Optimizer")
- Funnel slug (e.g. "linkedin-opt-in")
- `"magnetlab"` (source identifier)

User-defined custom tags (optional, configured per-funnel):
- Merged with auto-tags on push

## Out of Scope (v2)

- Bidirectional sync
- OAuth / GHL Marketplace app
- Opportunity/pipeline creation
- Bulk backfill of existing leads
- Custom field mapping UI
