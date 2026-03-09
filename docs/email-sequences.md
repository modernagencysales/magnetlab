<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## Email Sequences & Resource Delivery

### Resource Delivery Email

Auto-sends a "here is your resource" email on opt-in, with a per-funnel toggle (default ON).

#### Priority Rules

| Active sequence? | Toggle ON | Result |
|---|---|---|
| Yes | Any | Sequence handles delivery (default email skipped) |
| No | ON | System sends fixed-template resource email |
| No | OFF | Resource shown directly on thank-you page |

#### Data Model

- `funnel_pages.send_resource_email` BOOLEAN NOT NULL DEFAULT true — per-funnel toggle
- Fixed system template (no customization) — subject: "Your [Title] is ready"

#### How It Works

1. Lead opts in → `POST /api/public/lead` creates lead, fires webhooks
2. Calls `triggerEmailSequenceIfActive()` — if sequence handles it, done
3. If no sequence: checks `send_resource_email` toggle
4. Toggle ON + content exists → triggers `send-resource-email` Trigger.dev task
5. Toggle OFF → thank-you page shows resource link/button directly

#### Key Files

- `src/trigger/send-resource-email.ts` — Trigger.dev task (fixed HTML template via Resend)
- `src/app/api/public/lead/route.ts` — conditional trigger (sequence > resource email > nothing)
- `src/lib/services/email-sequence-trigger.ts` — exported `getSenderInfo()` + `getUserResendConfig()`
- `src/components/funnel/ThankyouPageEditor.tsx` — toggle UI (Resource Delivery section)
- `src/components/funnel/public/ThankyouPage.tsx` — conditional banner + resource button
- `src/app/p/[username]/[slug]/thankyou/page.tsx` — computes `showResourceOnPage` from toggle + sequence state

### Email Sequence System

Email sequences are drip campaigns attached to funnels. Defined in `email_sequences` table, triggered on lead capture.

#### Key Files

- `src/trigger/email-sequence.ts` — Trigger.dev task for sending scheduled sequence emails
- `src/lib/services/email-sequence-trigger.ts` — `triggerEmailSequenceIfActive()`, `getSenderInfo()`, `getUserResendConfig()`
- `src/app/api/email-sequence/` — CRUD API routes for sequence management

#### Sender Resolution

Priority order in `getSenderInfo()`:
1. User's own Resend account (from `user_integrations`)
2. Team verified email domain + `custom_from_email` (from `team_email_domains` + `teams`)
3. Default: `hello@sends.magnetlab.app`

### Daily Newsletter Email (Content Production)

Distinct from drip sequences. 300-500 words, subheadings, actionable takeaways, soft CTA. Uses today's approved LinkedIn post for topic consistency.

- `src/lib/ai/content-pipeline/email-writer.ts` — `writeNewsletterEmail()` (Claude Sonnet, voice-injected)
- `src/app/api/email/generate-daily/route.ts` — POST: generates draft broadcast from today's post + knowledge brief
