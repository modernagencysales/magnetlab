# Kajabi Integration Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow MagnetLab users to push leads captured from funnels into Kajabi as contacts with tags.

**Architecture:** Two-tier integration (account-level credentials + funnel-level toggle) following the existing GoHighLevel/HeyReach pattern. Fire-and-forget sync on lead capture.

**Tech Stack:** Kajabi REST API v1 (JSON:API spec), Next.js API routes, Supabase (`user_integrations` + `funnel_integrations` tables)

---

## Context

A MagnetLab user runs her business on Kajabi and wants leads from MagnetLab funnels pushed into Kajabi automatically. Kajabi has a full REST API (requires Pro plan) with endpoints for creating contacts, managing tags, and granting offers.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth method | API Key + Site ID | Simplest auth model, matches existing HeyReach/GoHighLevel pattern. No OAuth token refresh complexity. |
| Sync behavior | Create contact + apply tags | Simple and lets the user leverage Kajabi automations from tags. No form submission or offer granting needed initially. |
| Scope | All users | Built as a proper integration in Settings > Integrations, not a one-off. |
| Trigger | Lead capture (fire-and-forget) | Sync runs after HTTP response, never blocks lead capture. Matches existing pattern. |

## Architecture

### Two-Tier Integration

**Account Level** (Settings > Integrations):
- User enters Kajabi API key + Site ID
- Connection validated by calling `GET /v1/contacts?page[size]=1`
- Stored in `user_integrations` table:
  - `service = 'kajabi'`
  - `api_key` = Kajabi API key
  - `metadata = { site_id: '...' }`

**Funnel Level** (Funnel > Integrations tab):
- Per-funnel toggle to enable/disable Kajabi sync
- Optional multi-select tag picker (tags fetched from `GET /v1/contact_tags`)
- Stored in `funnel_integrations` table:
  - `provider = 'kajabi'`
  - `settings = { tag_ids: ['tag-1', 'tag-2'] }`

### Data Flow

```
Lead opts in → POST /api/public/lead → save lead → respond 200
  → after() fire-and-forget:
    → syncLeadToKajabi(userId, funnelPageId, lead)
      → GET user_integrations WHERE service='kajabi'
      → skip if not active
      → GET funnel_integrations WHERE provider='kajabi'
      → skip if not active
      → POST https://api.kajabi.com/v1/contacts (create contact)
      → POST https://api.kajabi.com/v1/contacts/{id}/relationships/tags (apply tags)
      → log result (success or error)
```

## Kajabi API Client

**File:** `src/lib/integrations/kajabi/client.ts`

```typescript
class KajabiClient {
  private apiKey: string;
  private siteId: string;
  private baseUrl = 'https://api.kajabi.com/v1';

  constructor(apiKey: string, siteId: string)

  // Validates credentials by fetching one contact
  testConnection(): Promise<boolean>
  // GET /v1/contacts?page[size]=1 with Bearer auth

  // Creates a contact in Kajabi
  createContact(email: string, name?: string): Promise<{ id: string }>
  // POST /v1/contacts with JSON:API body including site relationship
  // Handles duplicate emails gracefully

  // Applies tags to a contact
  addTagsToContact(contactId: string, tagIds: string[]): Promise<void>
  // POST /v1/contacts/{id}/relationships/tags

  // Lists available tags for the tag picker
  listTags(): Promise<{ id: string; name: string }[]>
  // GET /v1/contact_tags
}
```

**Headers:**
- `Authorization: Bearer {apiKey}`
- `Content-Type: application/vnd.api+json`
- `Accept: application/vnd.api+json`

**JSON:API request format** (create contact):
```json
{
  "data": {
    "type": "contacts",
    "attributes": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "subscribed": true
    },
    "relationships": {
      "site": {
        "data": { "type": "sites", "id": "SITE_ID" }
      }
    }
  }
}
```

## Settings UI

**File:** `src/components/settings/integrations/KajabiSettings.tsx`

Follows the exact GoHighLevelSettings pattern:

**Disconnected state:**
- Card with Kajabi logo/name, description, "Connect" button
- Expanded form: API Key input (password w/ show/hide) + Site ID input (text)
- Link to Kajabi docs: "Find your API key in Kajabi Admin > User API Keys"
- "Connect" button validates credentials then saves

**Connected state:**
- "Connected" badge with last verified timestamp
- "Test Connection" button
- "Disconnect" button (with confirmation dialog)

**Category:** Added alongside GoHighLevel in the "CRM" section of integrations grid.

## Funnel-Level Integration

**Provider added to:** `funnel_integrations` provider validation list (add `'kajabi'`).

**UI in funnel integrations tab:**
- Toggle: Enable/disable Kajabi sync for this funnel
- Tag picker: Multi-select dropdown of Kajabi tags (fetched from `/api/integrations/kajabi/tags`)
- Tags stored in `funnel_integrations.settings.tag_ids`

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/kajabi/connect` | POST | Validate + save Kajabi credentials |
| `/api/integrations/kajabi/verify` | POST | Test existing connection |
| `/api/integrations/kajabi/disconnect` | POST | Remove Kajabi integration |
| `/api/integrations/kajabi/tags` | GET | Fetch available Kajabi tags (for funnel picker) |

All routes follow existing patterns: auth check, fetch/validate credentials, call KajabiClient method, return result.

## Lead Sync

**File:** `src/lib/integrations/kajabi/sync.ts`

```typescript
async function syncLeadToKajabi(
  userId: string,
  funnelPageId: string,
  lead: { email: string; full_name?: string }
): Promise<void>
```

1. Fetch account integration (`getUserIntegration(userId, 'kajabi')`)
2. Return early if not active or no API key
3. Fetch funnel integration (`funnel_integrations` where provider='kajabi')
4. Return early if not active
5. Create KajabiClient with apiKey + siteId from metadata
6. Create contact (email + name)
7. If `settings.tag_ids` configured, apply tags
8. Log errors, never throw

**Called from:** `/api/public/lead` POST handler, alongside `syncLeadToGoHighLevel()` and `syncLeadToHeyReach()`.

## Error Handling

- **Invalid credentials**: 422 on connect, logged on sync
- **Duplicate contact**: Kajabi handles gracefully (returns existing)
- **Network errors**: Logged, never block lead capture
- **Missing site_id**: Caught at connection time (validation requires both fields)
- **Expired/revoked key**: Sync logs error; user can re-test from settings

## Testing

- Unit tests for KajabiClient (mock HTTP responses)
- API route tests (auth, validation, error handling)
- Sync function tests (fire-and-forget, error logging, early returns)
