# External Thank-You Page Redirect — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow funnel owners to redirect leads to an external URL after opt-in, either immediately or after completing the qualification survey, with separate URLs for qualified/unqualified leads.

**Architecture:** Three new columns on `funnel_pages` (`redirect_trigger`, `redirect_url`, `redirect_fail_url`) flow through the existing save/fetch pipeline. OptinPage handles immediate redirects; ThankyouPage handles post-qualification redirects. The funnel builder's ThankyouPageEditor gets a new redirect section that conditionally hides irrelevant fields.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL), React, Zod, TypeScript

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260218300000_funnel_redirect.sql`

**Step 1: Write the migration**

```sql
-- Add external redirect support to funnel pages
ALTER TABLE funnel_pages
  ADD COLUMN redirect_trigger TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN redirect_url TEXT,
  ADD COLUMN redirect_fail_url TEXT;

-- Validate redirect_trigger values
ALTER TABLE funnel_pages
  ADD CONSTRAINT funnel_pages_redirect_trigger_check
  CHECK (redirect_trigger IN ('none', 'immediate', 'after_qualification'));

COMMENT ON COLUMN funnel_pages.redirect_trigger IS 'none = use built-in thank-you page, immediate = redirect right after opt-in, after_qualification = redirect after survey';
COMMENT ON COLUMN funnel_pages.redirect_url IS 'External redirect URL (immediate mode or qualified-lead URL in after_qualification mode)';
COMMENT ON COLUMN funnel_pages.redirect_fail_url IS 'Redirect URL for unqualified leads (only used when redirect_trigger = after_qualification)';
```

**Step 2: Apply migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260218300000_funnel_redirect.sql
git commit -m "feat: add redirect columns to funnel_pages"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/types/funnel.ts`

**Step 1: Add RedirectTrigger type and update FunnelPage interface**

Add after line 9 (after `FunnelTargetType`):
```typescript
export type RedirectTrigger = 'none' | 'immediate' | 'after_qualification';
```

Add to `FunnelPage` interface after line 34 (after `qualificationFailMessage`):
```typescript
  // Redirect configuration
  redirectTrigger: RedirectTrigger;
  redirectUrl: string | null;
  redirectFailUrl: string | null;
```

**Step 2: Update FunnelPageRow interface**

Add to `FunnelPageRow` after line 373 (after `qualification_fail_message`):
```typescript
  redirect_trigger: string;
  redirect_url: string | null;
  redirect_fail_url: string | null;
```

**Step 3: Update funnelPageFromRow mapper**

Add after line 447 (after `qualificationFailMessage`):
```typescript
    redirectTrigger: (row.redirect_trigger || 'none') as RedirectTrigger,
    redirectUrl: row.redirect_url || null,
    redirectFailUrl: row.redirect_fail_url || null,
```

**Step 4: Update UpdateFunnelPagePayload**

Add after line 224 (after `qualificationFailMessage`):
```typescript
  redirectTrigger?: RedirectTrigger;
  redirectUrl?: string | null;
  redirectFailUrl?: string | null;
```

**Step 5: Commit**

```bash
git add src/lib/types/funnel.ts
git commit -m "feat: add redirect types to FunnelPage"
```

---

### Task 3: Zod Validation

**Files:**
- Modify: `src/lib/validations/api.ts`

**Step 1: Add redirect fields to updateFunnelSchema**

Add after the `qualificationFormId` line (line 221) inside `updateFunnelSchema`:
```typescript
  redirectTrigger: z.enum(['none', 'immediate', 'after_qualification']).optional(),
  redirectUrl: z.string().url().max(2000).nullable().optional(),
  redirectFailUrl: z.string().url().max(2000).nullable().optional(),
```

**Step 2: Commit**

```bash
git add src/lib/validations/api.ts
git commit -m "feat: add redirect validation to funnel schema"
```

---

### Task 4: API Route — Save Redirect Fields

**Files:**
- Modify: `src/app/api/funnel/[id]/route.ts`

**Step 1: Update GET select to include redirect columns**

In the GET handler (line 35), add to the select string:
`, redirect_trigger, redirect_url, redirect_fail_url`

**Step 2: Update PUT handler to map redirect fields**

Add after line 92 (after `qualificationFormId` mapping):
```typescript
    if (validated.redirectTrigger !== undefined) updateData.redirect_trigger = validated.redirectTrigger;
    if (validated.redirectUrl !== undefined) updateData.redirect_url = validated.redirectUrl;
    if (validated.redirectFailUrl !== undefined) updateData.redirect_fail_url = validated.redirectFailUrl;
```

**Step 3: Commit**

```bash
git add src/app/api/funnel/[id]/route.ts
git commit -m "feat: persist redirect fields in funnel API"
```

---

### Task 5: FunnelBuilder State

**Files:**
- Modify: `src/components/funnel/FunnelBuilder.tsx`

**Step 1: Add redirect state variables**

Add after line 68 (after `qualificationFailMessage` state), import `RedirectTrigger` from types:
```typescript
  // Form state for redirect
  const [redirectTrigger, setRedirectTrigger] = useState<RedirectTrigger>(existingFunnel?.redirectTrigger || 'none');
  const [redirectUrl, setRedirectUrl] = useState(existingFunnel?.redirectUrl || '');
  const [redirectFailUrl, setRedirectFailUrl] = useState(existingFunnel?.redirectFailUrl || '');
```

Also add to the import on line 17:
```typescript
import type { ..., RedirectTrigger } from '@/lib/types/funnel';
```

**Step 2: Add redirect fields to save payload**

Add after `qualificationFailMessage` in the payload object (after line 154):
```typescript
        redirectTrigger,
        redirectUrl: redirectUrl || null,
        redirectFailUrl: redirectFailUrl || null,
```

**Step 3: Pass redirect props to ThankyouPageEditor**

Update the `<ThankyouPageEditor>` JSX (around line 295-308) to add:
```typescript
                redirectTrigger={redirectTrigger}
                setRedirectTrigger={setRedirectTrigger}
                redirectUrl={redirectUrl}
                setRedirectUrl={setRedirectUrl}
                redirectFailUrl={redirectFailUrl}
                setRedirectFailUrl={setRedirectFailUrl}
```

**Step 4: Commit**

```bash
git add src/components/funnel/FunnelBuilder.tsx
git commit -m "feat: wire redirect state through FunnelBuilder"
```

---

### Task 6: ThankyouPageEditor UI

**Files:**
- Modify: `src/components/funnel/ThankyouPageEditor.tsx`

**Step 1: Update props interface**

Add to `ThankyouPageEditorProps` (after `setFailMessage` on line 17):
```typescript
  redirectTrigger: 'none' | 'immediate' | 'after_qualification';
  setRedirectTrigger: (value: 'none' | 'immediate' | 'after_qualification') => void;
  redirectUrl: string;
  setRedirectUrl: (value: string) => void;
  redirectFailUrl: string;
  setRedirectFailUrl: (value: string) => void;
```

Add import at top:
```typescript
import { ExternalLink } from 'lucide-react';
```

**Step 2: Destructure new props**

Add to the destructuring (after `setFailMessage`):
```typescript
  redirectTrigger,
  setRedirectTrigger,
  redirectUrl,
  setRedirectUrl,
  redirectFailUrl,
  setRedirectFailUrl,
```

**Step 3: Add redirect section at top of return JSX**

Insert as the first child of the outer `<div className="space-y-6">` (before the "Thank-you Message" section):

```tsx
      {/* Redirect Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Redirect
          </h3>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            After opt-in, send leads to...
          </label>
          <select
            value={redirectTrigger}
            onChange={(e) => setRedirectTrigger(e.target.value as 'none' | 'immediate' | 'after_qualification')}
            className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          >
            <option value="none">Our thank-you page (default)</option>
            <option value="immediate">External URL immediately</option>
            <option value="after_qualification">External URL after qualification</option>
          </select>
        </div>

        {redirectTrigger !== 'none' && (
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {redirectTrigger === 'immediate' ? 'Redirect URL' : 'Qualified Lead Redirect URL'}
            </label>
            <input
              type="url"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              placeholder="https://example.com/thank-you"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              leadId and email will be appended as query parameters
            </p>
          </div>
        )}

        {redirectTrigger === 'after_qualification' && (
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Unqualified Lead Redirect URL
              <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={redirectFailUrl}
              onChange={(e) => setRedirectFailUrl(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              placeholder="https://example.com/not-a-fit"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              If blank, unqualified leads see the built-in fail message instead
            </p>
          </div>
        )}
      </div>
```

**Step 4: Conditionally hide irrelevant sections when immediate redirect**

Wrap the existing Thank-you Message, Video, Calendly, and Qualification Messages sections in a conditional:

```tsx
      {redirectTrigger !== 'immediate' && (
        <>
          {/* Thank-you Message */}
          ...existing headline/subline section...

          {/* Video Sales Letter */}
          ...existing video section...

          {/* Calendly */}
          ...existing calendly section...

          {/* Qualification Messages */}
          ...existing qualification messages section...
        </>
      )}

      {redirectTrigger === 'immediate' && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            With immediate redirect, leads skip the thank-you page entirely and go straight to your external URL.
          </p>
        </div>
      )}
```

**Step 5: Commit**

```bash
git add src/components/funnel/ThankyouPageEditor.tsx
git commit -m "feat: add redirect config UI to ThankyouPageEditor"
```

---

### Task 7: OptinPage — Immediate Redirect

**Files:**
- Modify: `src/components/funnel/public/OptinPage.tsx`
- Modify: `src/app/p/[username]/[slug]/page.tsx` (server component)

**Step 1: Add redirect props to OptinPage**

Add to `OptinPageProps` interface (after `hideBranding` on line 30):
```typescript
  redirectTrigger?: 'none' | 'immediate' | 'after_qualification';
  redirectUrl?: string | null;
```

Add to destructuring (after `hideBranding`):
```typescript
  redirectTrigger = 'none',
  redirectUrl,
```

**Step 2: Add redirect logic after lead creation**

Replace line 129 (`router.push(...)`) with:

```typescript
      // Redirect based on configuration
      if (redirectTrigger === 'immediate' && redirectUrl) {
        const url = new URL(redirectUrl);
        url.searchParams.set('leadId', leadId);
        url.searchParams.set('email', email);
        window.location.href = url.toString();
      } else {
        router.push(`/p/${username}/${slug}/thankyou?leadId=${leadId}`);
      }
```

**Step 3: Update optin server page to fetch and pass redirect fields**

In `src/app/p/[username]/[slug]/page.tsx`, add `redirect_trigger, redirect_url` to the select query (line 76-92):

Add to the select string after `team_id`:
```
,redirect_trigger,redirect_url
```

Add props to the `<OptinPage>` component (after `hideBranding`):
```tsx
      redirectTrigger={(funnel.redirect_trigger as 'none' | 'immediate' | 'after_qualification') || 'none'}
      redirectUrl={funnel.redirect_url}
```

**Step 4: Commit**

```bash
git add src/components/funnel/public/OptinPage.tsx src/app/p/[username]/[slug]/page.tsx
git commit -m "feat: implement immediate redirect on opt-in"
```

---

### Task 8: ThankyouPage — Post-Qualification Redirect

**Files:**
- Modify: `src/components/funnel/public/ThankyouPage.tsx`
- Modify: `src/app/p/[username]/[slug]/thankyou/page.tsx` (server component)

**Step 1: Add redirect props to ThankyouPage**

Add to `ThankyouPageProps` interface (after `hideBranding` on line 47):
```typescript
  redirectTrigger?: 'none' | 'immediate' | 'after_qualification';
  redirectUrl?: string | null;
  redirectFailUrl?: string | null;
  email?: string | null;
```

Add to destructuring (after `hideBranding`):
```typescript
  redirectTrigger = 'none',
  redirectUrl,
  redirectFailUrl,
  email,
```

**Step 2: Add redirect effect after qualification completes**

Add a new `useEffect` after the existing auto-scroll effect (after line 190):

```typescript
  // Redirect after qualification if configured
  useEffect(() => {
    if (redirectTrigger !== 'after_qualification') return;
    if (!qualificationComplete) return;

    const targetUrl = isQualified ? redirectUrl : redirectFailUrl;
    if (!targetUrl) return; // Fall through to built-in UI

    try {
      const url = new URL(targetUrl);
      if (leadId) url.searchParams.set('leadId', leadId);
      if (email) url.searchParams.set('email', email);
      window.location.href = url.toString();
    } catch {
      // Invalid URL — fall through to built-in UI
    }
  }, [qualificationComplete, isQualified, redirectTrigger, redirectUrl, redirectFailUrl, leadId, email]);
```

**Step 3: Update thankyou server page to fetch and pass redirect fields**

In `src/app/p/[username]/[slug]/thankyou/page.tsx`:

Add to the funnel select query (after `team_id` on line 91):
```
,redirect_trigger,redirect_url,redirect_fail_url
```

Fetch lead email for appending to redirect URL. After the `leadMagnet` query (line ~153), add:
```typescript
  // Fetch lead email for redirect URL params
  let leadEmail: string | null = null;
  if (leadId) {
    const { data: lead } = await supabase
      .from('funnel_leads')
      .select('email')
      .eq('id', leadId)
      .single();
    leadEmail = lead?.email || null;
  }
```

Add props to the `<ThankyouPage>` component (after `hideBranding`):
```tsx
      redirectTrigger={(funnel.redirect_trigger as 'none' | 'immediate' | 'after_qualification') || 'none'}
      redirectUrl={funnel.redirect_url}
      redirectFailUrl={funnel.redirect_fail_url}
      email={leadEmail}
```

**Step 4: Commit**

```bash
git add src/components/funnel/public/ThankyouPage.tsx src/app/p/[username]/[slug]/thankyou/page.tsx
git commit -m "feat: implement post-qualification redirect on thank-you page"
```

---

### Task 9: Build Verification

**Step 1: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run typecheck`
Expected: No type errors

**Step 2: Run build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run build`
Expected: Build succeeds

**Step 3: Fix any issues found, commit fixes**

---

### Task 10: Update CLAUDE.md

**Files:**
- Modify: `/Users/timlife/Documents/claude code/magnetlab/CLAUDE.md`

**Step 1: Add external redirect documentation**

Add a new section after the A/B Testing section:

```markdown
## External Thank-You Page Redirect

Funnel owners can redirect leads to an external URL instead of showing the built-in thank-you page.

### Configuration

Three modes via `redirect_trigger` column on `funnel_pages`:
- `none` (default): Built-in thank-you page
- `immediate`: Skip thank-you page, redirect right after opt-in
- `after_qualification`: Show survey first, then redirect based on result

### Data Model

- `redirect_trigger` TEXT NOT NULL DEFAULT 'none' — mode selector
- `redirect_url` TEXT — primary redirect URL (or qualified-lead URL)
- `redirect_fail_url` TEXT — unqualified-lead redirect URL (after_qualification only)

Both URLs get `?leadId=xxx&email=yyy` appended automatically.

### Key Files

- `src/components/funnel/ThankyouPageEditor.tsx` — redirect config UI (dropdown + URL inputs)
- `src/components/funnel/public/OptinPage.tsx` — immediate redirect logic (line ~129)
- `src/components/funnel/public/ThankyouPage.tsx` — post-qualification redirect effect
- `src/app/p/[username]/[slug]/page.tsx` — passes redirect config to OptinPage
- `src/app/p/[username]/[slug]/thankyou/page.tsx` — passes redirect config + lead email to ThankyouPage
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add external redirect feature to CLAUDE.md"
```
