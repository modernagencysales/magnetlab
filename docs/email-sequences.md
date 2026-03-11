# Email Sequences & Resource Delivery

## Resource Email

Per-funnel `send_resource_email` toggle. Priority: active sequence → resource email → show on page.

**Template:** "Your [Title] is ready" (fixed). `send-resource-email` Trigger task.

## Email Sequences

Drip campaigns on `email_sequences`. Triggered on lead capture via `triggerEmailSequenceIfActive()`.

**Sender priority:** User Resend > team verified domain > `hello@sends.magnetlab.app`

## Daily Newsletter (Content Production)

300-500 words, distinct from sequences. `writeNewsletterEmail()` uses today's post + knowledge brief. `POST /api/email/generate-daily`
