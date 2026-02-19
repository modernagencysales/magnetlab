# Default Resource Delivery Email — Design

## Goal

Send a "here is your resource" email automatically when a lead opts in, with a per-funnel toggle (default ON). When toggled OFF, deliver the resource directly on the thank-you page instead.

## Requirements

- **Toggle ON (default):** System sends a fixed-template email with the resource link on opt-in. TY page says "Check your inbox."
- **Toggle OFF:** No email sent. TY page shows the resource link/button directly.
- **Overlap rule:** If the user has an active email sequence, it takes priority — default email is skipped regardless of toggle. The sequence handles delivery.
- **Fixed system template:** No customization. Subject: "Your [Title] is ready." Body: greeting + resource button link.

## Data Model

One new column on `funnel_pages`:

```sql
ALTER TABLE funnel_pages ADD COLUMN send_resource_email BOOLEAN NOT NULL DEFAULT true;
```

No subject/body columns — template is hardcoded in the Trigger.dev task.

## Lead Capture Flow

```
Lead opts in → POST /api/public/lead
  1. Create lead record (unchanged)
  2. Fire webhooks (unchanged)
  3. Call triggerEmailSequenceIfActive()
     → returns { triggered: true }  → done (sequence handles it)
     → returns { triggered: false } → check funnel.send_resource_email
       → true  → trigger send-resource-email task
       → false → do nothing
```

## Thank-You Page Behavior

| send_resource_email | Active sequence? | TY page copy | Email sent |
|---|---|---|---|
| ON | No | "Check your inbox for your resource" | Default email |
| ON | Yes | "Check your inbox for your resource" | Sequence email |
| OFF | No | "Your resource is ready" + prominent link | None |
| OFF | Yes | "Check your inbox for your resource" | Sequence email |

When `send_resource_email = false` AND no active sequence: the TY page shows a button linking to `/p/[username]/[slug]/content`.

## Email Template

```
Subject: Your [Lead Magnet Title] is ready

Hi [First Name],

Here's the resource you requested:

  [ View Your Resource → ]  (button → content page URL)

If you have any questions, just reply to this email.
```

Sender: resolved via existing `getSenderInfo()` (custom domain > team domain > default).

## Toggle UI

In ThankyouPageEditor, near the top: "Email resource to lead on opt-in" toggle with subtitle "(Skipped when an email sequence is active)".

## Files Touched

- Migration: add `send_resource_email` column
- `src/app/api/public/lead/route.ts` — conditional trigger
- `src/trigger/send-resource-email.ts` — new Trigger.dev task
- `src/lib/services/email-sequence-trigger.ts` — return triggered status
- `src/components/funnel/ThankyouPageEditor.tsx` — toggle UI
- `src/components/funnel/public/ThankyouPage.tsx` — conditional copy + resource button
- `src/app/p/[username]/[slug]/thankyou/page.tsx` — pass toggle + content URL
- `src/app/api/funnel/route.ts` — default on creation
- `src/app/api/funnel/[id]/route.ts` — PATCH support
