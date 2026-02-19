# TY Page Tweaks & External Resource UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three user feedback items: remove duplicate TY page headlines, add homepage link to TY page, and make external resources more discoverable in the funnel builder.

**Architecture:** Three independent changes that touch the TY page rendering, funnel builder editor, branding settings, and page creation flow. A DB migration adds `website_url` to `brand_kits` and `homepage_url`/`homepage_label` to `funnel_pages`.

**Tech Stack:** Next.js 15, React, Supabase, Zod validation, TypeScript

---

### Task 1: Remove Duplicate Survey Bridge Copy from TY Page

**Files:**
- Modify: `src/components/funnel/public/ThankyouPage.tsx:281-292`

**Step 1: Delete the hard-coded survey bridge section**

In `ThankyouPage.tsx`, remove the entire block at lines 281-292 (the `{/* 5. Survey bridge copy + incentive */}` section):

```tsx
// DELETE this entire block (lines 281-292):
        {/* 5. Survey bridge copy + incentive */}
        {hasQuestions && !qualificationComplete && (
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--ds-text)' }}>
              One quick step to personalize your experience
            </h2>
            <p className="text-sm" style={{ color: 'var(--ds-muted)' }}>
              Answer {questions.length} quick {questions.length === 1 ? 'question' : 'questions'} so we can tailor everything to your situation.
              {calendlyUrl && ' Complete the survey to book a strategy call.'}
            </p>
          </div>
        )}
```

The editable `headline` + `subline` (section 3, lines 258-272) already serves this purpose. The time-estimate pill ("30-second survey" / "2-minute survey") on the survey card provides enough context about what follows.

**Step 2: Verify the build compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/funnel/public/ThankyouPage.tsx
git commit -m "Remove duplicate survey bridge headline from TY page"
```

---

### Task 2: DB Migration for Homepage Link Fields

**Files:**
- Create: `supabase/migrations/20260218500000_homepage_link.sql`

**Step 1: Write the migration**

```sql
-- Add website_url to brand_kits (team-level default)
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Add homepage_url and homepage_label to funnel_pages (per-funnel override)
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS homepage_url TEXT;
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS homepage_label TEXT;
```

**Step 2: Push the migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run db:push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260218500000_homepage_link.sql
git commit -m "Add homepage_url columns to brand_kits and funnel_pages"
```

---

### Task 3: Add Homepage Link to TY Page Rendering

**Files:**
- Modify: `src/components/funnel/public/ThankyouPage.tsx` (add props + render link)
- Modify: `src/app/p/[username]/[slug]/thankyou/page.tsx` (fetch + pass data)

**Step 1: Add props to ThankyouPage component**

In `ThankyouPage.tsx`, add to the `ThankyouPageProps` interface (after line 51 `email`):

```tsx
  homepageUrl?: string | null;
  homepageLabel?: string | null;
```

Add to the function destructuring (after `email`):

```tsx
  homepageUrl,
  homepageLabel,
```

**Step 2: Render the homepage link**

After the qualification result section (after the closing `)}` of section 8, around line 532), add:

```tsx
        {/* Homepage link */}
        {homepageUrl && (
          <div className="text-center">
            <a
              href={homepageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: 'var(--ds-primary)' }}
            >
              {homepageLabel || 'Visit our website'}
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        )}
```

**Step 3: Update server page to fetch and pass homepage data**

In `src/app/p/[username]/[slug]/thankyou/page.tsx`, add `homepage_url` and `homepage_label` to the funnel select query (line 73-95):

Add these two columns to the select string:
```
homepage_url,
homepage_label,
```

After the brand_kits/whitelabel fetch (around line 105), fetch the brand kit website_url as fallback:

```tsx
  // Fetch brand kit website_url for homepage link fallback
  let brandWebsiteUrl: string | null = null;
  if (funnel.team_id) {
    const { data: brandKit } = await supabase
      .from('brand_kits')
      .select('website_url')
      .eq('team_id', funnel.team_id)
      .maybeSingle();
    brandWebsiteUrl = brandKit?.website_url || null;
  }
  if (!brandWebsiteUrl) {
    const { data: brandKit } = await supabase
      .from('brand_kits')
      .select('website_url')
      .eq('user_id', user.id)
      .maybeSingle();
    brandWebsiteUrl = brandKit?.website_url || null;
  }
```

Then pass the resolved values to the ThankyouPage component (add before the closing `/>` around line 257):

```tsx
      homepageUrl={funnel.homepage_url || brandWebsiteUrl}
      homepageLabel={funnel.homepage_label}
```

**Step 4: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/funnel/public/ThankyouPage.tsx src/app/p/\[username\]/\[slug\]/thankyou/page.tsx
git commit -m "Add homepage link to thank-you page with brand kit fallback"
```

---

### Task 4: Add Homepage Link Fields to Funnel Builder Editor

**Files:**
- Modify: `src/components/funnel/ThankyouPageEditor.tsx` (add URL + label inputs)
- Modify: `src/components/funnel/FunnelBuilder.tsx` (add state + pass props)
- Modify: `src/lib/validations/api.ts` (add to updateFunnelSchema)
- Modify: `src/app/api/funnel/[id]/route.ts` (add to update mapping)
- Modify: `src/lib/types/funnel.ts` (add to FunnelPage interface + fromRow)

**Step 1: Add to FunnelPage type and fromRow**

In `src/lib/types/funnel.ts`, add to the `FunnelPage` interface (after `redirectFailUrl`, around line 40):

```tsx
  // Homepage link
  homepageUrl: string | null;
  homepageLabel: string | null;
```

In `funnelPageFromRow()` (around line 462, after `redirectFailUrl`):

```tsx
    homepageUrl: row.homepage_url || null,
    homepageLabel: row.homepage_label || null,
```

Also add the columns to the `FunnelPageRow` interface (search for it — it lists the DB columns). Add:

```tsx
  homepage_url: string | null;
  homepage_label: string | null;
```

**Step 2: Add to Zod validation schema**

In `src/lib/validations/api.ts`, add to `updateFunnelSchema` (before the closing `});` at line 225):

```tsx
  homepageUrl: z.string().url().max(2000).nullable().optional(),
  homepageLabel: z.string().max(200).nullable().optional(),
```

**Step 3: Add to funnel update API mapping**

In `src/app/api/funnel/[id]/route.ts`, add after line 95 (the `redirectFailUrl` mapping):

```tsx
    if (validated.homepageUrl !== undefined) updateData.homepage_url = validated.homepageUrl;
    if (validated.homepageLabel !== undefined) updateData.homepage_label = validated.homepageLabel;
```

**Step 4: Add state to FunnelBuilder**

In `src/components/funnel/FunnelBuilder.tsx`, add state after `redirectFailUrl` state (around line 73):

```tsx
  const [homepageUrl, setHomepageUrl] = useState(existingFunnel?.homepageUrl || '');
  const [homepageLabel, setHomepageLabel] = useState(existingFunnel?.homepageLabel || '');
```

Add to the `handleSave` payload (around line 165, after the `redirectFailUrl` line):

```tsx
        homepageUrl: homepageUrl || null,
        homepageLabel: homepageLabel || null,
```

Pass new props to `ThankyouPageEditor` (inside the `activeTab === 'thankyou'` block, around line 321):

```tsx
                homepageUrl={homepageUrl}
                setHomepageUrl={setHomepageUrl}
                homepageLabel={homepageLabel}
                setHomepageLabel={setHomepageLabel}
```

**Step 5: Add UI to ThankyouPageEditor**

In `src/components/funnel/ThankyouPageEditor.tsx`, add the props to the interface (add `Home` to the lucide import):

```tsx
  homepageUrl: string;
  setHomepageUrl: (value: string) => void;
  homepageLabel: string;
  setHomepageLabel: (value: string) => void;
```

Add these to the function destructuring too.

Add a new "Homepage Link" section after the Qualification Messages section (before the closing `</>` of the `redirectTrigger !== 'immediate'` conditional, around line 238):

```tsx
          {/* Homepage Link */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Homepage Link (Optional)
              </h3>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                URL
              </label>
              <input
                type="url"
                value={homepageUrl}
                onChange={(e) => setHomepageUrl(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                placeholder="https://yourwebsite.com"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Shows a &quot;Visit our website&quot; link on the thank-you page. Overrides the team default if set.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Link Text
                <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={homepageLabel}
                onChange={(e) => setHomepageLabel(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                placeholder="Visit our website"
              />
            </div>
          </div>
```

**Step 6: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 7: Commit**

```bash
git add src/components/funnel/ThankyouPageEditor.tsx src/components/funnel/FunnelBuilder.tsx src/lib/validations/api.ts src/app/api/funnel/\[id\]/route.ts src/lib/types/funnel.ts
git commit -m "Add homepage link fields to funnel builder and API"
```

---

### Task 5: Add Website URL to Branding Settings

**Files:**
- Modify: `src/components/settings/BrandingSettings.tsx` (add website URL field)
- Modify: `src/app/api/brand-kit/route.ts` (accept websiteUrl field)

**Step 1: Add website URL field to BrandingSettings**

In `BrandingSettings.tsx`, add to the `BrandingSettingsProps.initialData` interface (after `font_url`):

```tsx
    website_url?: string | null;
```

Add state (after `fontUrl` state, around line 64):

```tsx
  const [websiteUrl, setWebsiteUrl] = useState(initialData.website_url || '');
```

Add handler (after `handleFontFamilyChange`, around line 227):

```tsx
  const handleWebsiteUrlChange = (url: string) => {
    setWebsiteUrl(url);
    saveBranding({ websiteUrl: url || null });
  };
```

Add a new section to the `openCards` default state — add `website: false` to the initial object (around line 73).

Add a new Card 6 after Card 5 (after the closing `</div>` of the "Default Next Steps" card, before the final closing `</div>`):

```tsx
      {/* Card 6: Website */}
      <div className="rounded-lg border bg-card p-6">
        <CardHeader
          icon={<Globe className="h-5 w-5" />}
          title="Website"
          cardKey="website"
        />
        {openCards.website && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Website URL</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => handleWebsiteUrlChange(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Default homepage link shown on thank-you pages. Can be overridden per funnel.
              </p>
            </div>
          </div>
        )}
      </div>
```

Add `Globe` to the lucide-react import at the top of the file (it's not currently imported — check first, add if missing).

**Step 2: Add websiteUrl to brand-kit API**

In `src/app/api/brand-kit/route.ts`, add to the update object mapping (find where other fields like `font_url` are mapped):

```tsx
  website_url: body.websiteUrl,
```

Make sure the field is only set if present in the request body (follow the existing pattern — the API uses a partial update, so only include it if the key exists):

```tsx
  ...(body.websiteUrl !== undefined ? { website_url: body.websiteUrl } : {}),
```

**Step 3: Pass website_url from the settings page**

Check that the settings page that renders `BrandingSettings` passes the `website_url` field from the brand_kit data. Look at `src/app/(dashboard)/settings/page.tsx` or wherever BrandingSettings is rendered — the brand kit query likely uses `select('*')`, which means `website_url` will be included automatically after the migration. Verify the `initialData` prop includes it.

**Step 4: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/settings/BrandingSettings.tsx src/app/api/brand-kit/route.ts
git commit -m "Add website URL to branding settings as TY page homepage default"
```

---

### Task 6: Add External URL Option to Pages Creation Flow

**Files:**
- Modify: `src/app/(dashboard)/pages/new/page.tsx` (replace redirect with page-type chooser)
- Modify: `src/app/(dashboard)/pages/page.tsx` (improve create button UX)

**Step 1: Replace pages/new redirect with type chooser**

Replace the entire content of `src/app/(dashboard)/pages/new/page.tsx` with a page-type chooser:

```tsx
'use client';

import Link from 'next/link';
import { Globe, ExternalLink, BookOpen } from 'lucide-react';

export default function PagesNew() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-center mb-2">Create a Page</h1>
      <p className="text-center text-muted-foreground mb-8">
        What kind of page do you want to build?
      </p>

      <div className="space-y-4">
        <Link
          href="/create/page-quick"
          className="flex items-start gap-4 rounded-xl border bg-card p-6 hover:border-primary/50 hover:bg-card/80 transition-all group"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium group-hover:text-primary transition-colors">
              Landing page for your lead magnet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an opt-in page with AI-generated copy for your content, guide, or tool.
            </p>
          </div>
        </Link>

        <Link
          href="/assets/external/new?createPage=true"
          className="flex items-start gap-4 rounded-xl border bg-card p-6 hover:border-primary/50 hover:bg-card/80 transition-all group"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
            <ExternalLink className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h3 className="font-medium group-hover:text-primary transition-colors">
              Landing page for an external resource
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Build a MagnetLab opt-in page even if your lead magnet is hosted elsewhere (Google Drive, Gumroad, your website, etc.)
            </p>
          </div>
        </Link>

        <Link
          href="/assets/libraries/new"
          className="flex items-start gap-4 rounded-xl border bg-card p-6 hover:border-primary/50 hover:bg-card/80 transition-all group"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
            <BookOpen className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-medium group-hover:text-primary transition-colors">
              Resource library page
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Bundle multiple resources into a single shareable page.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Remove the permanentRedirect import if present**

The old file imported `permanentRedirect` from `next/navigation`. The new file no longer needs it — it's a client component now.

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/pages/new/page.tsx
git commit -m "Replace pages/new redirect with page-type chooser"
```

---

### Task 7: Final Build + Typecheck

**Step 1: Run full typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

**Step 2: Run full build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 3: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test -- --passWithNoTests 2>&1 | tail -10`
Expected: All tests pass
