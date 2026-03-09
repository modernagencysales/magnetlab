<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## Engagement Cold Email Pipeline (Feb 2026)

Auto-enrich and push leads who engage with lead magnet posts to PlusVibe cold email campaigns. Also provides manual comment reply with opt-in link.

### Architecture

```
Comment detected on lead magnet post (Unipile scrape)
  → process-linkedin-comment (existing task)
  → Keyword match → parallel actions:
    1. Auto-like (existing)
    2. Reply to comment (existing)
    3. Push to HeyReach DM (existing)
    4. NEW: enrich-and-push-plusvibe Trigger.dev task
      → Harvest API (profile data)
      → Waterfall email find: LeadMagic → Prospeo → BlitzAPI
      → ZeroBounce validation (+ BounceBan catch-all escalation)
      → PlusVibe campaign push with opt_in_url variable
```

### Data Model

- `linkedin_automations` — added `plusvibe_campaign_id` (text) and `opt_in_url` (text) columns
- `engagement_enrichments` — tracks enrichment status per lead (pending → enriching → enriched → pushed | failed | no_email)
  - Unique constraint: `(user_id, automation_id, linkedin_url)` prevents double-enriching
  - RLS: user self-management + service role bypass

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/integrations/enrichment/types.ts` | Core interfaces (EmailFinderProvider, EmailValidatorProvider, WaterfallResult) |
| `src/lib/integrations/enrichment/leadmagic.ts` | Primary email finder |
| `src/lib/integrations/enrichment/prospeo.ts` | Fallback email finder |
| `src/lib/integrations/enrichment/blitzapi.ts` | Last resort email finder |
| `src/lib/integrations/enrichment/zerobounce.ts` | Primary email validator |
| `src/lib/integrations/enrichment/bounceban.ts` | Catch-all escalation validator |
| `src/lib/integrations/enrichment/waterfall.ts` | `waterfallEmailFind()` orchestrator |
| `src/lib/integrations/enrichment/index.ts` | Factory functions (getConfiguredFinders, getValidator) |
| `src/lib/integrations/plusvibe.ts` | `addLeadsToPlusVibeCampaign()` client |
| `src/trigger/enrich-and-push-plusvibe.ts` | Trigger.dev task (120s max, 2 retries) |
| `src/lib/services/linkedin-automation.ts` | Pipeline wiring (section 2b triggers enrichment) |
| `src/app/api/linkedin/automations/[id]/reply/route.ts` | Manual comment reply API |
| `src/components/automations/AutomationEventsDrawer.tsx` | Events timeline + "Reply with Link" button |
| `src/components/automations/AutomationEditor.tsx` | PlusVibe Campaign ID + Opt-In URL fields |
| `supabase/migrations/20260227300000_engagement_enrichment_plusvibe.sql` | Migration |

### PlusVibe Integration Notes

- **API base**: `https://api.plusvibe.ai/api/v1`, auth: `x-api-key` header
- **Variables**: Send WITHOUT `custom_` prefix — PlusVibe auto-prefixes. Templates use `{{custom_opt_in_url}}`
- Campaign ID is per-automation (different lead magnets → different email sequences)

### Manual Comment Reply

- "Reply with Link" button on `comment_detected`/`keyword_matched` events in AutomationEventsDrawer
- Pre-filled text: `Thanks {{name}}! Here's the link: {{opt_in_url}}`
- Sends via Unipile `addComment()`, logs `reply_sent` event
- API: `POST /api/linkedin/automations/[id]/reply` — body: `{ commentSocialId, text, commenterName }`

### Env Vars

Required in BOTH Vercel and Trigger.dev:

```
LEADMAGIC_API_KEY
PROSPEO_API_KEY
BLITZ_API_KEY
ZEROBOUNCE_API_KEY
BOUNCEBAN_API_KEY
PLUSVIBE_API_KEY
```
