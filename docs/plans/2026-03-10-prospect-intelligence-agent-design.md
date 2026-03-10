# Prospect Intelligence Agent — Design

## Goal

Activate magnetlab's signal engine for 2,000+ Blueprint prospects. Add custom variable scoring so users can weight any imported data. Surface daily outreach recommendations via Slack, MCP, and leadmagnet-admin.

## Architecture

Blueprint prospects flow into magnetlab's `signal_leads` table as the single source of truth for "who should I talk to." The signal engine monitors their LinkedIn activity, scores them with a compound formula that includes user-defined custom variables, and surfaces prioritized outreach recommendations.

```
leadmagnet-backend (prospect complete)
        │
        ▼ webhook
magnetlab (signal_leads + custom_data)
        │
        ├── Harvest API: monitor LinkedIn activity (existing crons)
        ├── ICP filter + compound scoring (existing + custom variables)
        ├── Daily Slack digest (new cron)
        ├── MCP tool: magnetlab_prospect_intelligence (new)
        └── leadmagnet-admin: signal score on Delivered page (new column)
```

## Data Model

### New table: `signal_custom_variables`

```sql
CREATE TABLE signal_custom_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,              -- "revenue", "authority_score"
  field_type TEXT NOT NULL,        -- "number", "text", "boolean"
  scoring_rule JSONB NOT NULL,     -- declarative scoring config
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);
```

Scoring rules (declarative, per type):
- **number**: `{ "ranges": [{ "min": 100000, "weight": 25 }, { "min": 50000, "weight": 15 }] }`
- **boolean**: `{ "when_true": 15, "when_false": 0 }`
- **text**: `{ "contains": { "agency": 10 }, "default": 0 }`

### Modified: `signal_leads`

Add `custom_data JSONB` column for user-defined variable values:

```json
{
  "authority_score": 85,
  "monthly_income": 100000,
  "has_viewed_blueprint": true,
  "blueprint_views": 3,
  "blueprint_slug": "chaddebolt-3p7g",
  "prospect_id": "40d6df91-..."
}
```

### Scoring engine update

Compound score formula adds custom variable weights alongside existing signal weights. Custom variable scoring rules are evaluated dynamically from `signal_custom_variables` definitions.

## Components

### 1. Custom Variables System (magnetlab)
- `signal_custom_variables` table + migration
- `custom_data` JSONB column on `signal_leads`
- Scoring engine reads variable definitions, applies rules to `custom_data` values
- API routes for CRUD on custom variables

### 2. Blueprint Import (magnetlab)
- API endpoint: `POST /api/signals/import` — accepts batch of prospects with custom variable mapping
- Maps Blueprint fields to custom variables (authority_score, monthly_income, etc.)
- Creates `signal_leads` entries with `profile_data` (LinkedIn info) + `custom_data` (Blueprint enrichment)
- Dedup by `linkedin_url` per user

### 3. Ongoing Sync (leadmagnet-backend → magnetlab)
- When prospect completes: webhook to magnetlab creates signal lead
- When `first_viewed_at` or `view_count` changes: sync to `custom_data`
- Lightweight — only fires on status transitions

### 4. Daily Digest (magnetlab, Trigger.dev cron)
- Runs 8 AM UTC daily
- Queries top-scored signal leads with recent activity
- Groups by suggested action (comment, DM, follow-up, cold re-engage)
- Posts to Slack channel

### 5. MCP Tool (magnetlab)
- `magnetlab_prospect_intelligence` — "who should I talk to today?"
- Returns ranked prospects with signal context and suggested action template
- Filterable by score threshold, signal type, recency

### 6. Leadmagnet-admin View (leadmagnet-admin)
- Signal score column on Delivered page, pulled from `signal_leads` via shared Supabase
- Cross-referenced by `prospect_id` stored in `custom_data`

## Integration Points

| From | To | Mechanism | When |
|------|-----|-----------|------|
| prospects (initial 2k) | signal_leads | Batch import script | One-time |
| leadmagnet-backend | magnetlab | Webhook on prospect complete | Ongoing |
| copy-of-gtm-os | prospects | Client-side view tracking | Ongoing |
| prospects.first_viewed_at | signal_leads.custom_data | Sync on change | Ongoing |
| signal_leads | Slack | Daily digest cron | Daily 8 AM |
| signal_leads | MCP | magnetlab_prospect_intelligence tool | On demand |
| signal_leads | leadmagnet-admin | Direct Supabase read | On page load |

## Not Building (YAGNI)

- AI-drafted messages (template suggestions sufficient)
- Real-time push notifications (daily digest sufficient)
- Bi-directional sync back to prospects table
- Custom UI for variable management (API + MCP first, UI later)
- Extrovert-style comment approval queue (manual for now)

## Success Criteria

- 2,000 prospects imported into signal_leads with custom variable data
- Compound scores reflect revenue + authority + LinkedIn signals
- Daily Slack digest surfaces top 5 prospects with suggested actions
- MCP tool answers "who should I talk to?" with ranked, contextualized results
- Signal scores visible on leadmagnet-admin Delivered page
