# Magnetlab Email System Design

**Date:** 2026-02-19
**Status:** Approved

## Overview

Extend magnetlab's existing 5-email lead magnet flow into a full warm email system: multi-step flows, one-off broadcasts, subscriber management with CSV import, and audience segmentation. Built natively in magnetlab (not a shared service) using the existing Resend integration and whitelabeling infrastructure.

## Decision: Why Native, Not Shared

- magnetlab already has 80% of the infrastructure (Resend, domain whitelabeling, Trigger.dev, email rendering)
- Auth model differs from gtm-system (user_id/team_id vs tenant_id) — shared code would be awkward
- magnetlab's needs are simpler (no AI personalization blocks, review queue, or event triggers)
- ~200-300 lines of actual overlap doesn't justify a microservice or shared package
- gtm-system keeps its email suite for its own tenants; no migration needed

## Data Model

### email_flows

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| team_id | UUID FK (teams) | |
| user_id | UUID FK (auth.users) | |
| name | TEXT | |
| description | TEXT | |
| trigger_type | TEXT | 'lead_magnet' or 'manual' |
| trigger_lead_magnet_id | UUID nullable | FK lead_magnets, when trigger_type = lead_magnet |
| status | TEXT | 'draft', 'active', 'paused' |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### email_flow_steps

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| flow_id | UUID FK (email_flows) | |
| step_number | INTEGER | |
| subject | TEXT | |
| body | TEXT | Supports {{first_name}}, {{email}} |
| delay_days | INTEGER | 0 = immediate, 1+ = days after previous step |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

UNIQUE(flow_id, step_number)

### email_subscribers

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| team_id | UUID FK (teams) | |
| email | TEXT | |
| first_name | TEXT | |
| last_name | TEXT | |
| status | TEXT | 'active', 'unsubscribed', 'bounced' |
| source | TEXT | 'lead_magnet', 'manual', 'import' |
| source_id | UUID nullable | lead_magnet_id if from opt-in |
| subscribed_at | TIMESTAMPTZ | |
| unsubscribed_at | TIMESTAMPTZ nullable | |

UNIQUE(team_id, email)

### email_flow_contacts

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| team_id | UUID FK | |
| flow_id | UUID FK (email_flows) | |
| subscriber_id | UUID FK (email_subscribers) | |
| current_step | INTEGER | |
| status | TEXT | 'active', 'completed', 'paused', 'unsubscribed' |
| entered_at | TIMESTAMPTZ | |
| last_sent_at | TIMESTAMPTZ nullable | |
| trigger_task_id | TEXT | Trigger.dev run ID |

UNIQUE(flow_id, subscriber_id)

### email_broadcasts

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| team_id | UUID FK | |
| user_id | UUID FK | |
| subject | TEXT | |
| body | TEXT | |
| status | TEXT | 'draft', 'sending', 'sent', 'failed' |
| audience_filter | JSONB nullable | e.g. {"engagement": "opened_90d", "source": "lead_magnet"} |
| recipient_count | INTEGER | |
| sent_at | TIMESTAMPTZ nullable | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Existing tables (no changes)

- **email_events** — already tracks sent/delivered/opened/clicked/bounced per recipient
- **team_email_domains** — whitelabeling works for flows and broadcasts
- **email_sequences** — keeps working for existing lead magnets (coexistence)

## Flow Execution

### Trigger chain in /api/public/lead

1. Check for new `email_flow` (trigger_type = lead_magnet, status = active) -> new system
2. Else check for old `email_sequence` (status = active) -> old system
3. Else check `send_resource_email` toggle -> resource email
4. Else do nothing

New flows take priority. Old sequences keep working. No forced migration.

### Trigger.dev tasks

**execute-email-flow** — Single long-running task per contact:
1. Create/update email_flow_contact to 'active'
2. For each step (ordered by step_number):
   - Check subscriber status (stop if unsubscribed)
   - Personalize subject/body ({{first_name}}, {{email}})
   - Resolve sender (team whitelabel -> brand kit -> platform default)
   - Convert body to HTML
   - Send via Resend
   - Update current_step and last_sent_at
   - If not last step: wait.for({ days: next_step.delay_days })
3. Mark flow contact as 'completed'

**send-broadcast** — Batch send to filtered subscribers:
1. Query subscribers matching audience_filter
2. Update broadcast status to 'sending', set recipient_count
3. Send in batches via Resend
4. Update status to 'sent' with sent_at

### Subscriber auto-population

When /api/public/lead receives an opt-in, upsert into email_subscribers:
- Dedup on (team_id, email)
- source = 'lead_magnet', source_id = lead_magnet_id
- Don't overwrite existing names

### Unsubscribe

Each email includes List-Unsubscribe header + footer link:
- GET /api/email/unsubscribe?sid={subscriber_id}&token={hmac}
- Marks subscriber status = 'unsubscribed'
- Stops any active flow contacts for that subscriber

### Sender resolution (existing, no changes)

1. Team custom_from_email + verified domain (team_email_domains)
2. Brand kit sender_name + default domain
3. "MagnetLab" + hello@sends.magnetlab.app

## Broadcast Audience Filtering

Filters stored as JSONB on broadcast, combined with AND logic:

| Filter | Options |
|--------|---------|
| Engagement | opened_30d, opened_60d, opened_90d, clicked_30d, clicked_60d, clicked_90d, never_opened |
| Source | lead_magnet (any), lead_magnet:{id} (specific), manual, import |
| Subscribed | before:{date}, after:{date} |

"Opened in last 90 days" query: subscribers whose email appears in email_events with event_type = 'opened' and created_at > now() - 90 days.

Live recipient count updates as filters change in the UI.

## CSV Import

- Route: POST /api/email/subscribers/import
- Accepts CSV with columns: email, first_name, last_name
- Preview step before confirming (show parsed rows, flag invalid emails)
- Upserts into email_subscribers (dedup on team_id + email)
- Doesn't overwrite existing names unless blank
- Source = 'import'

## API Routes

### Flows
| Route | Method | Purpose |
|-------|--------|---------|
| /api/email/flows | GET | List flows for team |
| /api/email/flows | POST | Create flow |
| /api/email/flows/[id] | GET | Get flow + steps |
| /api/email/flows/[id] | PUT | Update flow (name, status, trigger) |
| /api/email/flows/[id] | DELETE | Delete flow (draft/paused only) |
| /api/email/flows/[id]/steps | POST | Add step |
| /api/email/flows/[id]/steps/[stepId] | PUT | Update step |
| /api/email/flows/[id]/steps/[stepId] | DELETE | Remove step |
| /api/email/flows/[id]/contacts | GET | List contacts in flow |
| /api/email/flows/[id]/generate | POST | AI-generate email sequence |

### Broadcasts
| Route | Method | Purpose |
|-------|--------|---------|
| /api/email/broadcasts | GET | List broadcasts |
| /api/email/broadcasts | POST | Create broadcast |
| /api/email/broadcasts/[id] | GET | Get broadcast |
| /api/email/broadcasts/[id] | PUT | Update broadcast |
| /api/email/broadcasts/[id] | DELETE | Delete broadcast |
| /api/email/broadcasts/[id]/send | POST | Send broadcast |
| /api/email/broadcasts/[id]/preview-count | GET | Live recipient count for filters |

### Subscribers
| Route | Method | Purpose |
|-------|--------|---------|
| /api/email/subscribers | GET | List subscribers (paginated, searchable) |
| /api/email/subscribers | POST | Add subscriber manually |
| /api/email/subscribers/[id] | DELETE | Remove subscriber |
| /api/email/subscribers/import | POST | CSV import with preview |
| /api/email/unsubscribe | GET | Public unsubscribe handler |

All routes auth via Supabase JWT, scoped to team_id.

## UI Pages

### Flows (/dashboard/email/flows)
- List view with status badges (draft/active/paused)
- Flow editor: step list with add/remove/reorder, edit subject/body/delay per step
- "Generate with AI" button (reuses Claude email generation, adapted for N steps)
- Activate/pause toggle
- Link flow to a lead magnet via dropdown

### Broadcasts (/dashboard/email/broadcasts)
- List view with status
- Editor: subject + body (markdown/rich text)
- Audience filter builder with live recipient count
- Preview before sending
- Send with confirmation modal

### Subscribers (/dashboard/email/subscribers)
- Table: email, name, status, source, subscribed date
- Search and filter
- Manual add button
- CSV import with preview/confirm step

### Changes to existing pages
- EmailSequenceTab in funnel editor: if a new flow is linked to this lead magnet, show link to flow editor instead
- Analytics page: extend to show per-flow and per-broadcast stats

## Out of Scope (Future)

- A/B testing on subject lines
- Per-step analytics (open/click rate per individual step)
- Flow branching / conditional logic
- AI personalization blocks with review queue
- Migration tool for old email_sequences -> new flows
- Webhook-based flow triggers
- Saved segment presets (filters are per-broadcast for now)
