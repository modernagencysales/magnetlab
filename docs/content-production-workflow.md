# Content Production System

Edit-tracking + style learning, daily newsletter, weekly lead magnet suggestions. gtm-system pushes warm leads via webhook.

## Edit-Tracking Flow

```
Save → captureAndClassifyEdit() → cp_edit_history → classifyEditPatterns() (AI)
Weekly: evolve-writing-style → aggregateEditPatterns() → voice_profile on team_profiles
```

**Hooked into:** post save, email broadcast, email sequence, lead magnet content.

## Key Tasks

- `evolve-writing-style` — Sunday 3:30 AM UTC
- `suggest-lead-magnet-topics` — Monday 8 AM
- `nightly-autopilot-batch` — post generation

## Subscriber Sync

gtm-system webhook (`subscriber-sync`) — positive replies, meetings. `SUBSCRIBER_SYNC_WEBHOOK_SECRET`.

## Help

`/help` — CEO guide (Daily, Weekly, Troubleshoot, Style). See [troubleshooting-content-production.md](troubleshooting-content-production.md) for debug.
