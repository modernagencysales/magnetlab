# HeyReach Lead Magnet Delivery Integration

**Date:** 2026-02-26
**Status:** Approved
**Approach:** Direct integration (Approach A) — port simplified HeyReach client into magnetlab

## Problem

magnetlab users run LinkedIn outreach via HeyReach. When prospects click through to a funnel opt-in page, we need to deliver the lead magnet back through HeyReach (adding the lead to a delivery campaign with custom variables like title and URL).

## Data Flow

```
LinkedIn DM (HeyReach campaign with {linkedinUrl} variable in link)
  → Prospect clicks: magnetlab.app/p/user/slug?li={linkedinUrl}
  → Opt-in page captures email + reads `li` param from URL
  → POST /api/public/lead (stores linkedin_url on funnel_leads)
  → after() fires syncLeadToHeyReach()
    → Checks user_integrations for heyreach API key
    → Checks funnel_integrations for heyreach config (campaign_id, is_active)
    → Calls HeyReach addContactsToCampaign with:
        - linkedinUrl (from li param)
        - firstName, email
        - customFields: { lead_magnet_title, lead_magnet_url }
    → Updates funnel_leads.heyreach_delivery_status
```

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/lib/integrations/heyreach/client.ts` | Simplified HeyReach API client (ported from gtm-system) |
| `src/lib/integrations/heyreach/sync.ts` | `syncLeadToHeyReach()` fire-and-forget delivery |
| `src/lib/integrations/heyreach/types.ts` | TypeScript types |
| `src/app/api/integrations/heyreach/campaigns/route.ts` | Fetch user's campaigns (for dropdown) |
| `src/app/api/integrations/heyreach/verify/route.ts` | Verify API key |
| `src/app/api/integrations/heyreach/accounts/route.ts` | Fetch LinkedIn accounts (for selector) |

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/public/lead/route.ts` | Read `li` URL param, store on lead, add `syncLeadToHeyReach()` to after() |
| `src/app/api/funnels/[id]/integrations/route.ts` | Add `heyreach` to VALID_FUNNEL_PROVIDERS |
| DB: `funnel_leads` table | Add `linkedin_url` TEXT, `heyreach_delivery_status` TEXT columns |

### HeyReach Client (Simplified from gtm-system)

```typescript
class HeyReachClient {
  constructor(apiKey: string)
  listCampaigns(): Promise<Campaign[]>
  addContactsToCampaign(campaignId: number, contacts: HeyReachContact[]): Promise<void>
  listLinkedInAccounts(): Promise<LinkedInAccount[]>
  verifyConnection(): Promise<boolean>
}
```

Only delivery-related methods. No webhooks, no conversations, no management API.

### Custom Variables Sent to HeyReach

| Variable | Source | Always available |
|----------|--------|-----------------|
| `lead_magnet_title` | lead_magnets.title | Yes |
| `lead_magnet_url` | Constructed from funnel slug | Yes |
| `first_name` | Form submission | Yes |
| `email` | Form submission | Yes |
| `linkedin_url` | URL `li` param | When present |

### Database Changes

Add columns to `funnel_leads`:
- `linkedin_url TEXT` — captured from URL `li` param
- `heyreach_delivery_status TEXT` — 'sent', 'failed', 'skipped', 'duplicate'

No new tables. Uses existing `user_integrations` + `funnel_integrations`.

### LinkedIn URL Capture

HeyReach campaign template uses:
```
Check out this guide: https://magnetlab.app/p/username/slug?li={linkedinUrl}
```

HeyReach substitutes `{linkedinUrl}` per prospect. The `li` param is URL-encoded. magnetlab reads it from query params on page load and includes it in the form submission payload.

### UI Integration Points

- **Settings > Integrations** — Connect HeyReach (API key + verify)
- **Funnel Settings > Integrations** — Toggle on/off, campaign dropdown, LinkedIn account selector
- **Variable reference** — Show available {variables} for HeyReach templates
- **Funnel Leads table** — HeyReach delivery status column

### Error Handling

- No API key → skip silently
- Invalid API key → log, status = 'failed'
- Campaign not found → log, status = 'failed'
- No LinkedIn URL → attempt email-only (HeyReach may match)
- Duplicate → HeyReach handles internally, status = 'duplicate' if detected
- Never blocks lead capture response

### Integration Pattern

Follows magnetlab's existing two-layer model:
1. **Account-level** (`user_integrations`): API key stored per user
2. **Funnel-level** (`funnel_integrations`): campaign_id, linkedin_account_id, is_active per funnel

Delivery function matches GoHighLevel pattern: check account connection → check funnel toggle → call API → log result. Fire-and-forget in after() block.
