# Lead Magnet Engagement → Cold Email Pipeline + Manual Comment Reply

**Date:** 2026-02-27
**Status:** Approved
**Approach:** Inline enrichment in magnetlab (no cross-repo API calls)

## Problem

When leads engage with lead magnet posts (comments/reactions), we can auto-like, reply, and push to HeyReach DM campaigns — but DMs are slow. We need a parallel cold email channel via PlusVibe to reach these leads faster. This requires email enrichment (they only have LinkedIn URLs from engagement data). Additionally, we need a quick way to manually reply to comments with the opt-in link without waiting for automations.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PlusVibe destination | Configurable per-automation | Different lead magnets → different email sequences |
| Enrichment providers | Full waterfall + validation | Maximize find rate (~85%+) |
| Automation trigger | Fully automatic | Same pattern as HeyReach push |
| Email CTA | Link to opt-in page | Captures lead properly in funnel |
| Manual reply UI | Button in events feed | Minimal new UI, keeps context |
| Architecture | Port to magnetlab directly | Aligns with architectural direction, avoids cross-origin issues |

## Data Model

### `linkedin_automations` — new columns

```sql
ALTER TABLE linkedin_automations
  ADD COLUMN plusvibe_campaign_id text,
  ADD COLUMN opt_in_url text;
```

- `plusvibe_campaign_id` — PlusVibe campaign to push enriched leads to (nullable, opt-in)
- `opt_in_url` — Lead magnet opt-in page URL (used in PlusVibe variables + manual replies)

### New table: `engagement_enrichments`

```sql
CREATE TABLE engagement_enrichments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  automation_id uuid NOT NULL REFERENCES linkedin_automations(id) ON DELETE CASCADE,
  linkedin_url text NOT NULL,
  first_name text,
  last_name text,
  headline text,
  company text,
  email text,
  email_provider text, -- leadmagic | prospeo | blitzapi
  email_validation_status text, -- valid | invalid | catch_all | spamtrap | etc
  plusvibe_campaign_id text,
  plusvibe_pushed_at timestamptz,
  plusvibe_error text,
  status text NOT NULL DEFAULT 'pending', -- pending | enriching | enriched | pushed | failed | no_email
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, automation_id, linkedin_url)
);

-- RLS
ALTER TABLE engagement_enrichments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_enrichments" ON engagement_enrichments
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "service_role_bypass" ON engagement_enrichments
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_engagement_enrichments_automation ON engagement_enrichments(automation_id);
CREATE INDEX idx_engagement_enrichments_status ON engagement_enrichments(status);
```

## New Files

### Enrichment Providers (ported from gtm-system)

```
src/lib/integrations/enrichment/
├── leadmagic.ts       -- Primary email finder
├── prospeo.ts         -- Fallback email finder
├── blitzapi.ts        -- Last resort email finder
├── zerobounce.ts      -- Primary email validator
├── bounceban.ts       -- Catch-all escalation validator
├── waterfall.ts       -- Orchestrator: waterfallEmailFind()
└── types.ts           -- Shared types
```

### PlusVibe Client

```
src/lib/integrations/plusvibe.ts  -- PlusVibe API client (ported from gtm-system)
```

### Trigger.dev Task

```
src/trigger/enrich-and-push-plusvibe.ts  -- On-demand enrichment + PlusVibe push
```

### API Route

```
src/app/api/linkedin/automations/[id]/reply/route.ts  -- Manual comment reply
```

## Pipeline Flow

```
Comment detected on lead magnet post
        ↓
process-linkedin-comment (existing task)
        ↓
Keyword match → Execute actions in parallel:
  1. Auto-like via Unipile (existing)
  2. Reply to comment via Unipile (existing)
  3. Push to HeyReach DM campaign (existing)
  4. NEW: Trigger enrich-and-push-plusvibe task
        ↓
enrich-and-push-plusvibe task:
  ├─ Check dedup (engagement_enrichments unique constraint)
  ├─ Upsert engagement_enrichments record (status: enriching)
  ├─ Get profile data via Harvest API (company, headline)
  ├─ waterfallEmailFind(linkedinUrl, firstName, lastName, company)
  │   ├─ Try LeadMagic
  │   ├─ Try Prospeo (if LeadMagic fails)
  │   ├─ Try BlitzAPI (if Prospeo fails)
  │   ├─ Validate with ZeroBounce
  │   └─ Escalate catch_all to BounceBan
  ├─ If no email → status: no_email, stop
  ├─ If email invalid → status: failed, stop
  ├─ Build PlusVibe payload:
  │     email, first_name, last_name, company_name,
  │     linkedin_person_url, custom_variables: { opt_in_url }
  ├─ addLeadsToCampaign(plusvibe_campaign_id, [lead])
  └─ Update: status=pushed, plusvibe_pushed_at=now()
```

## Manual Comment Reply

In the automation events feed, each `comment_detected`/`keyword_matched` event gets a "Reply with Link" button:

1. Button visible when automation has `opt_in_url` set
2. Click opens pre-filled reply: `"Thanks {{name}}! Here's the link: {{opt_in_url}}"`
3. User can edit before sending
4. Sends via Unipile `addComment()` (reply to specific comment)
5. Logs `manual_reply_sent` event

**API:** `POST /api/linkedin/automations/[id]/reply`
- Body: `{ commentSocialId, text, commenterName }`
- Auth: Supabase JWT
- Action: Send via Unipile, log event

## Environment Variables

All needed in both Vercel and Trigger.dev:

```
LEADMAGIC_API_KEY
PROSPEO_API_KEY
BLITZAPI_API_KEY
ZEROBOUNCE_API_KEY
BOUNCEBAN_API_KEY
PLUSVIBE_API_KEY
PLUSVIBE_WORKSPACE_ID
```

## Error Handling

- Enrichment failures → `engagement_enrichments.status = failed` with error details
- PlusVibe push failures → `plusvibe_error` recorded, retryable
- Dedup via unique constraint prevents double-enriching
- All AI/API calls route through Helicone for cost tracking
- Rate limiting: waterfall handles retries with exponential backoff per provider
