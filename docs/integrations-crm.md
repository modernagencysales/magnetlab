# CRM Integrations

## GoHighLevel

Push leads on capture. Account API key, per-funnel toggle + custom tags. `syncLeadToGoHighLevel()` fire-and-forget from lead capture.

**Routes:** `gohighlevel/connect`, `verify`, `disconnect`, `status`

## Kajabi

Push leads with optional tag assignment. API key + Site ID. Per-funnel tag picker.

**Routes:** `kajabi/connect`, `verify`, `disconnect`, `status`, `tags`

## HeyReach

Deliver lead magnets via LinkedIn DM campaigns. Capture `?li=` param from opt-in. `syncLeadToHeyReach()` after lead creation.

**Routes:** `heyreach/connect`, `verify`, `disconnect`, `status`, `campaigns`, `accounts`

**Custom vars:** `{lead_magnet_title}`, `{lead_magnet_url}`, `{utm_*}`
