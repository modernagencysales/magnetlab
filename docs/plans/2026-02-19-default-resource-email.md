# Default Resource Delivery Email — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-send a "here is your resource" email on opt-in (toggle ON by default), with resource shown directly on the TY page when toggle is OFF.

**Architecture:** Add `send_resource_email` boolean to `funnel_pages`. Modify `triggerEmailSequenceIfActive` to return whether a sequence was triggered. If not triggered and toggle is ON, fire a new `send-resource-email` Trigger.dev task. Update TY page to conditionally show resource link vs "check inbox" based on toggle + sequence state.

**Tech Stack:** Next.js 15, Supabase, Trigger.dev v4, Resend

---

### Task 1: DB Migration — add `send_resource_email` column

**Files:**
- Create: `supabase/migrations/20260219100000_default_resource_email.sql`

**Step 1: Write migration SQL**

```sql
-- Default resource delivery email toggle
-- When true (default), system sends a resource delivery email on opt-in
-- When false, resource is shown directly on the thank-you page
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS send_resource_email BOOLEAN NOT NULL DEFAULT true;
```

**Step 2: Apply migration**

Since `supabase db push` has ordering issues with this repo, apply directly via Supabase Management API:

```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w | sed 's/go-keyring-base64://' | base64 -D)
curl -s -X POST "https://api.supabase.com/v1/projects/qvawbxpijxlwdkolmjrs/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS send_resource_email BOOLEAN NOT NULL DEFAULT true;"}'
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260219100000_default_resource_email.sql
git commit -m "feat: add send_resource_email column to funnel_pages"
```

---

### Task 2: Create `send-resource-email` Trigger.dev task

**Files:**
- Create: `src/trigger/send-resource-email.ts`

This task sends a fixed-template "here is your resource" email via Resend. It reuses the existing `sendEmail` and `emailBodyToHtml` helpers.

**Step 1: Write the task**

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { sendEmail, type ResendConfig } from "@/lib/integrations/resend";

export interface SendResourceEmailPayload {
  leadEmail: string;
  leadName: string | null;
  leadMagnetTitle: string;
  resourceUrl: string;
  senderName: string;
  senderEmail?: string;
  resendConfig?: ResendConfig;
}

function buildResourceEmailHtml(
  firstName: string,
  leadMagnetTitle: string,
  resourceUrl: string,
  senderName: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding:40px 32px;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#1f2937;">
                Hi ${firstName},
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#1f2937;">
                Here's the resource you requested:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${resourceUrl}" style="display:inline-block;background-color:#8b5cf6;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
                      View Your Resource &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#6b7280;">
                ${leadMagnetTitle}
              </p>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#6b7280;">
                If you have any questions, just reply to this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                Sent by ${senderName}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const sendResourceEmail = task({
  id: "send-resource-email",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: SendResourceEmailPayload) => {
    const { leadEmail, leadName, leadMagnetTitle, resourceUrl, senderName, senderEmail, resendConfig } = payload;

    const firstName = leadName?.split(' ')[0] || 'there';

    console.log(`Sending resource delivery email to ${leadEmail} for "${leadMagnetTitle}"`);

    const html = buildResourceEmailHtml(firstName, leadMagnetTitle, resourceUrl, senderName);

    const result = await sendEmail({
      to: leadEmail,
      subject: `Your ${leadMagnetTitle} is ready`,
      html,
      fromName: senderName,
      fromEmail: senderEmail,
      replyTo: senderEmail,
      resendConfig,
    });

    if (!result.success) {
      console.error(`Failed to send resource email to ${leadEmail}:`, result.error);
      throw new Error(`Resource email send failed: ${result.error}`);
    }

    console.log(`Resource email sent to ${leadEmail}, id: ${result.id}`);

    return {
      success: true,
      emailId: result.id,
      leadEmail,
    };
  },
});
```

**Step 2: Verify typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/trigger/send-resource-email.ts
git commit -m "feat: add send-resource-email Trigger.dev task"
```

---

### Task 3: Modify `triggerEmailSequenceIfActive` to support resource email fallback

**Files:**
- Modify: `src/lib/services/email-sequence-trigger.ts`

The function already returns `{ triggered: boolean }`. We need to also export `getSenderInfo` and `getUserResendConfig` so the lead capture route can pass sender info to the resource email task.

**Step 1: Export the helper functions**

In `src/lib/services/email-sequence-trigger.ts`, change `async function getSenderInfo` (line 49) to `export async function getSenderInfo` and `async function getUserResendConfig` (line 96) to `export async function getUserResendConfig`.

That's it — no logic changes needed. The existing return value `{ triggered: false }` already tells the caller that no sequence was sent.

**Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/services/email-sequence-trigger.ts
git commit -m "refactor: export getSenderInfo and getUserResendConfig for reuse"
```

---

### Task 4: Modify lead capture to send resource email

**Files:**
- Modify: `src/app/api/public/lead/route.ts`

**Step 1: Add imports and modify the email trigger call**

At the top of the file (after line 9), add:

```typescript
import { getSenderInfo, getUserResendConfig } from '@/lib/services/email-sequence-trigger';
import { sendResourceEmail } from '@/trigger/send-resource-email';
```

Replace the email trigger block (lines 209-217) with:

```typescript
    // Trigger email sequence if active, or send default resource email
    triggerEmailSequenceIfActive({
      leadId: lead.id,
      userId: funnel.user_id,
      email: lead.email,
      name: lead.name,
      leadMagnetId: funnel.lead_magnet_id,
      leadMagnetTitle: leadMagnet?.title || '',
    }).then(async (result) => {
      // If sequence handled it, we're done
      if (result.triggered) return;

      // No active sequence — check if default resource email is enabled
      if (!funnel.send_resource_email || !resourceUrl) return;

      try {
        const [senderInfo, resendConfig] = await Promise.all([
          getSenderInfo(funnel.user_id),
          getUserResendConfig(funnel.user_id),
        ]);

        await sendResourceEmail.trigger({
          leadEmail: lead.email,
          leadName: lead.name,
          leadMagnetTitle: leadMagnet?.title || '',
          resourceUrl,
          senderName: resendConfig?.fromName || senderInfo.senderName,
          senderEmail: resendConfig?.fromEmail || senderInfo.senderEmail,
          resendConfig,
        });
      } catch (err) {
        logApiError('public/lead/resource-email', err, { leadId: lead.id });
      }
    }).catch((err) => logApiError('public/lead/email-sequence', err, { leadId: lead.id }));
```

Also update the funnel select query (line 108-111) to include `send_resource_email`:

```typescript
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id, user_id, lead_magnet_id, slug, is_published, team_id, send_resource_email')
      .eq('id', funnelPageId)
      .single();
```

**Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/public/lead/route.ts
git commit -m "feat: send default resource email when no sequence is active"
```

---

### Task 5: Update thank-you page server component

**Files:**
- Modify: `src/app/p/[username]/[slug]/thankyou/page.tsx`

We need to:
1. Fetch `send_resource_email` from the funnel query
2. Check if an active email sequence exists
3. Pass `showResourceOnPage` boolean to the client component

**Step 1: Add `send_resource_email` to the funnel select**

In the funnel select query (line 73-97), add `send_resource_email` to the select list (after `homepage_label`):

```
      homepage_label,
      send_resource_email
```

**Step 2: Check for active email sequence**

After the `leadEmail` fetch block (after line 185), add:

```typescript
  // Check if an active email sequence exists for this lead magnet
  const { data: activeSequence } = await supabase
    .from('email_sequences')
    .select('id')
    .eq('lead_magnet_id', funnel.lead_magnet_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  const hasActiveSequence = !!activeSequence;

  // Show resource on page when: no email being sent (toggle off AND no sequence)
  const showResourceOnPage = !funnel.send_resource_email && !hasActiveSequence;
```

**Step 3: Pass to ThankyouPage component**

Add two new props to the `<ThankyouPage>` JSX (after `homepageLabel`):

```
      homepageLabel={funnel.homepage_label}
      showResourceOnPage={showResourceOnPage}
      contentPageUrl={contentPageUrl}
```

Note: `contentPageUrl` is already passed (line 266), so just add `showResourceOnPage`.

**Step 4: Verify typecheck** (will fail — ThankyouPage doesn't accept the prop yet, that's Task 6)

**Step 5: Commit**

```bash
git add src/app/p/[username]/[slug]/thankyou/page.tsx
git commit -m "feat: pass showResourceOnPage to thank-you page"
```

---

### Task 6: Update thank-you page client component

**Files:**
- Modify: `src/components/funnel/public/ThankyouPage.tsx`

**Step 1: Add `showResourceOnPage` prop**

In `ThankyouPageProps` interface (line 27-54), add:

```typescript
  showResourceOnPage?: boolean;
```

In the destructured props (line 56-81), add:

```typescript
  showResourceOnPage,
```

**Step 2: Update the confirmation banner (line 243-251)**

Replace the static banner with conditional content:

```typescript
        {/* 1. Confirmation banner */}
        <div
          className="flex items-center gap-2 rounded-lg px-4 py-3"
          style={{ background: 'var(--ds-card)' }}
        >
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm" style={{ color: 'var(--ds-muted)' }}>
            {showResourceOnPage
              ? "You\u0027re in! Your resource is ready below."
              : "You\u0027re in! Check your inbox for your resource."}
          </p>
        </div>

        {/* Resource access button (when email is off) */}
        {showResourceOnPage && contentPageUrl && (
          <div className="text-center">
            <a
              href={contentPageUrl}
              className="inline-flex items-center gap-2 rounded-lg px-8 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--ds-primary)' }}
            >
              View Your Resource &rarr;
            </a>
          </div>
        )}
```

Note: Use `\u0027` for the apostrophe in JSX (or `&apos;` — match existing convention in the file which uses `&apos;`). Actually, looking at line 249, the existing code uses `&apos;`. So use:

```
            {showResourceOnPage
              ? "You&apos;re in! Your resource is ready below."
              : "You&apos;re in! Check your inbox for your resource."}
```

Wait — this is inside `{}` JSX expression, so we need raw strings. Use the approach:

```tsx
          <p className="text-sm" style={{ color: 'var(--ds-muted)' }}>
            {showResourceOnPage
              ? 'You\'re in! Your resource is ready below.'
              : 'You\'re in! Check your inbox for your resource.'}
          </p>
```

Or keep it as JSX text nodes like the original. Simplest: keep the pattern from the original file.

**Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/funnel/public/ThankyouPage.tsx
git commit -m "feat: show resource on TY page when email toggle is off"
```

---

### Task 7: Add toggle to ThankyouPageEditor

**Files:**
- Modify: `src/components/funnel/ThankyouPageEditor.tsx`

**Step 1: Add props**

Add to `ThankyouPageEditorProps` interface (line 5-28):

```typescript
  sendResourceEmail: boolean;
  setSendResourceEmail: (value: boolean) => void;
```

Add to the destructured params of the component function (line 30-53):

```typescript
  sendResourceEmail,
  setSendResourceEmail,
```

**Step 2: Add toggle UI**

Add at the very top of the `<div className="space-y-6">` (before the Redirect section, after line 55):

```tsx
      {/* Resource Email Delivery */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Resource Delivery
          </h3>
        </div>

        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Email resource to lead on opt-in</p>
            <p className="text-xs text-muted-foreground">
              Skipped when an email sequence is active
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={sendResourceEmail}
            onClick={() => setSendResourceEmail(!sendResourceEmail)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              sendResourceEmail ? 'bg-emerald-500' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                sendResourceEmail ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {!sendResourceEmail && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Resource will be shown directly on the thank-you page instead
          </p>
        )}
      </div>
```

Also add `Mail` to the lucide-react import (line 4):

```typescript
import { Video, Calendar, MessageCircle, ExternalLink, Home, Mail } from 'lucide-react';
```

**Step 3: Verify typecheck** (will fail if FunnelBuilder doesn't pass props yet — that's Task 8)

**Step 4: Commit**

```bash
git add src/components/funnel/ThankyouPageEditor.tsx
git commit -m "feat: add resource email toggle to ThankyouPageEditor"
```

---

### Task 8: Wire toggle into FunnelBuilder

**Files:**
- Modify: `src/components/funnel/FunnelBuilder.tsx`

This is the parent component that manages state for ThankyouPageEditor. We need to:
1. Add `sendResourceEmail` state
2. Load it from the funnel data
3. Pass it to ThankyouPageEditor
4. Save it on funnel update

**Step 1: Find the FunnelBuilder and understand its state**

Read `src/components/funnel/FunnelBuilder.tsx` to find:
- Where existing thankyou-related state is declared (look for `thankyouHeadline`, `redirectTrigger`, etc.)
- Where the state is loaded from API data
- Where `ThankyouPageEditor` is rendered and what props are passed
- Where the save/update function sends data to the API

**Step 2: Add state**

Add alongside the other thankyou state variables:

```typescript
const [sendResourceEmail, setSendResourceEmail] = useState(true);
```

**Step 3: Load from API response**

In the data loading effect (where `setThankyouHeadline` etc. are called), add:

```typescript
setSendResourceEmail(funnelData.send_resource_email ?? true);
```

**Step 4: Pass to ThankyouPageEditor**

Add to the ThankyouPageEditor JSX:

```tsx
sendResourceEmail={sendResourceEmail}
setSendResourceEmail={setSendResourceEmail}
```

**Step 5: Include in save payload**

In the save/update function that calls `PATCH /api/funnel/[id]`, add to the body:

```typescript
sendResourceEmail,
```

**Step 6: Verify typecheck**

```bash
npx tsc --noEmit
```

**Step 7: Commit**

```bash
git add src/components/funnel/FunnelBuilder.tsx
git commit -m "feat: wire send_resource_email toggle through FunnelBuilder"
```

---

### Task 9: Update funnel API routes

**Files:**
- Modify: `src/app/api/funnel/route.ts` (POST — funnel creation)
- Modify: `src/app/api/funnel/[id]/route.ts` (PATCH — funnel update)

**Step 1: Update POST handler (funnel creation)**

In `src/app/api/funnel/route.ts`, find where the insert object is built. Add:

```typescript
send_resource_email: true,
```

This ensures new funnels have the toggle ON by default (matching the DB default, but being explicit).

**Step 2: Update PATCH handler (funnel update)**

In `src/app/api/funnel/[id]/route.ts`, find where allowed update fields are processed. Add `send_resource_email` (or `sendResourceEmail` if camelCase is used in the request body) to the update object:

```typescript
if (body.sendResourceEmail !== undefined) {
  updates.send_resource_email = body.sendResourceEmail;
}
```

Or if the route uses an allowedFields pattern, add `'send_resource_email'` to the list.

**Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/api/funnel/route.ts src/app/api/funnel/\[id\]/route.ts
git commit -m "feat: support send_resource_email in funnel CRUD API"
```

---

### Task 10: Deploy

**Step 1: Final typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
```

**Step 2: Deploy Vercel**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && vercel --prod
```

**Step 3: Deploy Trigger.dev**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy
```

**Step 4: Verify** the new `send-resource-email` task appears in Trigger.dev dashboard.

---

### Task 11: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

Add a section about the default resource email feature under the Email Sequence section or as a subsection of Integration Points. Document:
- The toggle column (`send_resource_email` on `funnel_pages`)
- The priority: active sequence > default resource email > show on TY page
- The Trigger.dev task name (`send-resource-email`)
- Key files: `src/trigger/send-resource-email.ts`, the modified lead capture route, the TY page components
