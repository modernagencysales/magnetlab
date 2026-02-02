# Bulk Page Creation API — Design

## Problem

Importing pages from a previous page builder requires creating lead magnets and funnel pages one at a time through the UI. We need an API-driven bulk creation flow, with API key auth, and in-app documentation.

## Scope

1. **Data model changes** — User-level theme defaults, external URL for lead magnets
2. **API key system** — Generate/revoke bearer tokens for API access
3. **Bulk create endpoint** — Single POST to create N pages with lead magnets
4. **In-app API docs** — Dashboard docs page with auth, endpoints, examples

## Data Model Changes

### `profiles` table — new columns

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `default_theme` | text ('dark','light','custom') | 'dark' | Theme inherited by new pages |
| `default_primary_color` | text | '#8b5cf6' | Color inherited by new pages |
| `default_background_style` | text ('solid','gradient','pattern') | 'solid' | Background inherited by new pages |
| `default_logo_url` | text (nullable) | null | Logo inherited by new pages |

### `lead_magnets` table — new column

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `external_url` | text (nullable) | null | Link to externally-hosted lead magnet |

### New `api_keys` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK to profiles, cascade delete |
| `key_hash` | text | SHA-256 hash of the key |
| `key_prefix` | text | Last 4 chars for display |
| `name` | text | User-provided label |
| `created_at` | timestamptz | |
| `last_used_at` | timestamptz | nullable |
| `is_active` | boolean | default true |

RLS: users can only manage their own keys.

## API Endpoints

### Authentication

All API endpoints accept either:
- Session cookie (existing dashboard auth)
- `Authorization: Bearer <api_key>` header

### `POST /api/keys`

Create an API key. Returns the raw key exactly once.

**Response:**
```json
{
  "id": "uuid",
  "key": "ml_live_abc123...",
  "name": "My import script",
  "prefix": "...f8a2",
  "createdAt": "2025-02-01T..."
}
```

### `DELETE /api/keys/[id]`

Revoke an API key.

### `GET /api/keys`

List active API keys (prefix + name + last used, never the full key).

### `POST /api/funnel/bulk`

Create multiple pages in one request.

**Request:**
```json
{
  "pages": [
    {
      "title": "LinkedIn Growth Playbook",
      "slug": "linkedin-growth-playbook",
      "optinHeadline": "Get the Playbook",
      "optinSubline": "10 steps to 10k followers",
      "optinButtonText": "Download Now",
      "leadMagnetUrl": "https://example.com/playbook.pdf",
      "thankyouHeadline": "Check your inbox!",
      "thankyouSubline": "Here's what to do next",
      "autoPublish": false
    }
  ]
}
```

**Field requirements:**
- Required: `title`, `optinHeadline`, `leadMagnetUrl`
- Optional with defaults: `slug` (from title), `optinButtonText` ("Get It Now"), `autoPublish` (false)
- Optional nullable: `optinSubline`, `thankyouHeadline`, `thankyouSubline`

**Response:**
```json
{
  "created": 12,
  "failed": 1,
  "results": [
    { "index": 0, "status": "created", "id": "uuid", "slug": "linkedin-growth-playbook" },
    { "index": 5, "status": "failed", "error": "Slug already exists" }
  ]
}
```

**Behavior:**
- Creates a lightweight `lead_magnet` per item (title + external_url, no AI generation)
- Creates a `funnel_page` linked to it, inheriting theme from user profile defaults
- Slug collisions reported as errors (not silently auto-incremented)
- Per-item atomicity: one failure does not roll back others
- If `autoPublish: true`, sets `is_published` and `published_at`

### `GET /api/funnel/bulk/template`

Returns example payload with field descriptions for scripting convenience.

## In-App Documentation

- Route: `/(dashboard)/docs`
- Static MDX page in the dashboard layout
- Sections: Authentication, API Keys, Bulk Create, Error Reference
- Includes curl examples and JSON templates

## Theme Default Inheritance

When creating a funnel page (bulk or single) without explicit theme fields, the system reads from `profiles.default_theme`, `default_primary_color`, `default_background_style`, `default_logo_url`. The existing single-page creation flow also benefits from this.

## Future Direction

The API will expand to trigger flows at various stages (AI enrichment, content generation, publishing) so the entire end-to-end can be automated. This bulk create endpoint is the foundation for that.
