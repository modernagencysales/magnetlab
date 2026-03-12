# Engagement Cold Email Pipeline

Comment on lead magnet post → enrich (Harvest + email waterfall) → push to PlusVibe campaign. Manual "Reply with Link" in AutomationEventsDrawer.

## Enrichment Waterfall

LeadMagic → Prospeo → BlitzAPI (email find). ZeroBounce → BounceBan (validation).

## Tables

`linkedin_automations` (+ `plusvibe_campaign_id`, `opt_in_url`) | `engagement_enrichments` (status: pending → enriched → pushed)

## Env Vars (Vercel + Trigger.dev)

`LEADMAGIC_API_KEY`, `PROSPEO_API_KEY`, `BLITZ_API_KEY`, `ZEROBOUNCE_API_KEY`, `BOUNCEBAN_API_KEY`, `PLUSVIBE_API_KEY`
