# Team-Level Branding & Conversion Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend brand kit with visual branding (logos, fonts, colors, testimonials, steps), auto-populate new funnels from brand kit defaults, add Google Fonts + custom font upload, and surface conversion funnel metrics (views → leads → qualification).

**Architecture:** Add new JSONB/text columns to `brand_kits` and `funnel_pages` tables via Supabase migration. Extend the brand kit API to accept new fields. Build a Branding settings UI with logo upload, font picker, and section defaults. Modify funnel creation to merge brand kit content into template sections. Add `page_type` column to `page_views` for thank-you tracking. Update analytics API to surface conversion funnel metrics.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL), Supabase Storage (file uploads), Google Fonts API, React, TypeScript, Tailwind CSS

---

### Task 1: Database Migration — Brand Kit + Funnel Pages + Page Views

**Files:**
- Create: `supabase/migrations/20260217200000_brand_kit_branding.sql`

**Step 1: Write the migration SQL**

```sql
-- Add visual branding fields to brand_kits
ALTER TABLE brand_kits
  ADD COLUMN IF NOT EXISTS logos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS default_testimonial JSONB,
  ADD COLUMN IF NOT EXISTS default_steps JSONB,
  ADD COLUMN IF NOT EXISTS default_theme TEXT DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS default_primary_color TEXT DEFAULT '#8b5cf6',
  ADD COLUMN IF NOT EXISTS default_background_style TEXT DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS font_family TEXT,
  ADD COLUMN IF NOT EXISTS font_url TEXT;

-- Add font fields to funnel_pages (snapshot from brand kit at creation)
ALTER TABLE funnel_pages
  ADD COLUMN IF NOT EXISTS font_family TEXT,
  ADD COLUMN IF NOT EXISTS font_url TEXT;

-- Add page_type to page_views for opt-in vs thank-you tracking
ALTER TABLE page_views
  ADD COLUMN IF NOT EXISTS page_type TEXT DEFAULT 'optin';

-- Update unique constraint to include page_type
-- First drop the old constraint, then create new one
ALTER TABLE page_views
  DROP CONSTRAINT IF EXISTS page_views_funnel_page_id_visitor_hash_view_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS page_views_funnel_visitor_date_type_key
  ON page_views (funnel_page_id, visitor_hash, view_date, page_type);

-- Backfill: copy user-level defaults into brand kit for users who have them set
UPDATE brand_kits bk
SET
  default_theme = COALESCE(u.default_theme, bk.default_theme),
  default_primary_color = COALESCE(u.default_primary_color, bk.default_primary_color),
  default_background_style = COALESCE(u.default_background_style, bk.default_background_style),
  logo_url = COALESCE(u.default_logo_url, bk.logo_url)
FROM users u
WHERE u.id = bk.user_id
  AND (u.default_theme IS NOT NULL
    OR u.default_primary_color IS NOT NULL
    OR u.default_background_style IS NOT NULL
    OR u.default_logo_url IS NOT NULL);
```

**Step 2: Run the migration**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260217200000_brand_kit_branding.sql
git commit -m "feat: add branding columns to brand_kits, funnel_pages, page_views"
```

---

### Task 2: Brand Kit API — Accept New Fields

**Files:**
- Modify: `src/app/api/brand-kit/route.ts` (GET handler line 24 select list, POST handler lines 60-76)

**Step 1: Update GET handler to select new columns**

In the GET handler, add the new columns to the `.select()` call (line 24). Add these to the existing select string:
- `logos, default_testimonial, default_steps, default_theme, default_primary_color, default_background_style, logo_url, font_family, font_url`

**Step 2: Update POST handler to accept new fields**

In the POST handler, add the new fields to the upsert data object (lines 60-76). Read from request body:

```typescript
const {
  // existing fields...
  business_description, business_type, credibilityMarkers,
  urgent_pains, templates, processes, tools, frequent_questions,
  results, success_example, audience_tools, preferred_tone, style_profile,
  // new branding fields
  logos, default_testimonial, default_steps,
  default_theme, default_primary_color, default_background_style,
  logo_url, font_family, font_url,
} = await request.json();
```

Add to the upsert object:

```typescript
...(logos !== undefined && { logos }),
...(default_testimonial !== undefined && { default_testimonial }),
...(default_steps !== undefined && { default_steps }),
...(default_theme !== undefined && { default_theme }),
...(default_primary_color !== undefined && { default_primary_color }),
...(default_background_style !== undefined && { default_background_style }),
...(logo_url !== undefined && { logo_url }),
...(font_family !== undefined && { font_family }),
...(font_url !== undefined && { font_url }),
```

**Step 3: Verify**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/api/brand-kit/route.ts
git commit -m "feat: extend brand-kit API with visual branding fields"
```

---

### Task 3: Logo Upload API Endpoint

**Files:**
- Create: `src/app/api/brand-kit/upload/route.ts`

**Step 1: Create the upload endpoint**

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors } from '@/lib/api/errors';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const ALLOWED_FONT_TYPES = ['font/woff2', 'application/font-woff2', 'application/octet-stream'];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_FONT_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string; // 'logo' or 'font'

  if (!file) return ApiErrors.validationError('No file provided');

  const isFont = type === 'font';
  const allowedTypes = isFont ? ALLOWED_FONT_TYPES : ALLOWED_IMAGE_TYPES;
  const maxSize = isFont ? MAX_FONT_SIZE : MAX_IMAGE_SIZE;

  if (!allowedTypes.includes(file.type) && !(isFont && file.name.endsWith('.woff2'))) {
    return ApiErrors.validationError(`Invalid file type: ${file.type}`);
  }
  if (file.size > maxSize) {
    return ApiErrors.validationError(`File too large. Max ${maxSize / 1024 / 1024}MB`);
  }

  const supabase = createSupabaseAdminClient();
  const ext = file.name.split('.').pop() || (isFont ? 'woff2' : 'png');
  const path = `branding/${session.user.id}/${type}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('public-assets')
    .upload(path, file, { contentType: file.type, upsert: true });

  if (error) {
    return ApiErrors.databaseError('Upload failed: ' + error.message);
  }

  const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}
```

**Step 2: Verify Supabase Storage bucket exists**

Check if `public-assets` bucket exists. If not, create it via Supabase dashboard or migration. The bucket must be public (for serving logos/fonts on public pages).

**Step 3: Commit**

```bash
git add src/app/api/brand-kit/upload/route.ts
git commit -m "feat: add logo and font upload endpoint for brand kit"
```

---

### Task 4: Branding Settings UI Component

**Files:**
- Create: `src/components/settings/BrandingSettings.tsx`
- Modify: `src/components/dashboard/SettingsContent.tsx` (add BrandingSettings to render, ~line 130)

**Step 1: Build the BrandingSettings component**

This is a large client component with 5 cards. Key structure:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, Plus, X, Type, Palette, Image as ImageIcon, MessageSquareQuote, ListOrdered } from 'lucide-react';

// Google Fonts list — popular options
const GOOGLE_FONTS = [
  'Inter', 'DM Sans', 'Poppins', 'Lato', 'Montserrat', 'Open Sans',
  'Raleway', 'Playfair Display', 'Roboto', 'Nunito', 'Source Sans 3',
  'Work Sans', 'Outfit', 'Plus Jakarta Sans', 'Space Grotesk',
  'Manrope', 'Sora', 'Lexend', 'Figtree', 'Geist',
];

interface BrandingSettingsProps {
  brandKit: {
    logos?: Array<{ name: string; imageUrl: string }>;
    default_testimonial?: { quote: string; author?: string; role?: string; result?: string };
    default_steps?: { heading?: string; steps: Array<{ title: string; description: string }> };
    default_theme?: string;
    default_primary_color?: string;
    default_background_style?: string;
    logo_url?: string;
    font_family?: string;
    font_url?: string;
  } | null;
}
```

**Card 1 — Logo & Identity:**
- Main logo: drag-drop area → uploads to `/api/brand-kit/upload` with `type=logo` → saves URL to `logo_url`
- Logo bar: list of `{name, imageUrl}` with add/remove → each logo uploads then appends to `logos` array
- Auto-saves via debounced PATCH to `/api/brand-kit`

**Card 2 — Theme & Colors:**
- 3 theme cards (dark/light/custom) — same style as FunnelTemplateSettings
- Color picker input (hex) for `default_primary_color`
- Background style radio buttons (solid/gradient/pattern)

**Card 3 — Font:**
- Dropdown select of GOOGLE_FONTS with live preview (inject Google Fonts link for preview)
- "Upload custom font (.woff2)" button at bottom → uploads to `/api/brand-kit/upload` with `type=font`
- Preview text in selected font

**Card 4 — Default Testimonial:**
- Quote textarea, Author input, Role input, Result input
- Preview card showing the rendered testimonial

**Card 5 — Default Next Steps:**
- Heading input
- List of steps with title + description, add/remove buttons, drag to reorder (optional — simple up/down arrows)
- Preview

**Auto-save pattern:** Each card's onChange debounces 1s then calls:
```typescript
const saveBranding = async (updates: Record<string, unknown>) => {
  await fetch('/api/brand-kit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
};
```

**Step 2: Add to SettingsContent**

In `src/components/dashboard/SettingsContent.tsx`, import and render `<BrandingSettings>` after the FunnelTemplateSettings section. Pass `brandKit` prop.

**Step 3: Update settings server component**

In `src/app/(dashboard)/settings/page.tsx`, add the new brand kit columns to the select list (line ~24) so the new fields are passed to SettingsContent → BrandingSettings.

**Step 4: Verify**

```bash
npx tsc --noEmit
npm run dev  # manually check Settings page renders
```

**Step 5: Commit**

```bash
git add src/components/settings/BrandingSettings.tsx src/components/dashboard/SettingsContent.tsx src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add Branding settings UI with logos, fonts, colors, testimonial, steps"
```

---

### Task 5: Funnel Creation — Merge Brand Kit Into Template Sections

**Files:**
- Modify: `src/app/api/funnel/route.ts` (POST handler, lines 283-308)

**Step 1: Fetch brand kit during funnel creation**

After the funnel page is inserted (line ~265) and before template sections are inserted (line ~283), fetch the brand kit for the current scope:

```typescript
import { getDataScope, applyScope } from '@/lib/utils/team-context';

// Inside the POST handler, after funnel page is created:
const scope = await getDataScope(session.user.id);
const { data: brandKit } = await applyScope(
  supabase.from('brand_kits').select('logos, default_testimonial, default_steps, default_theme, default_primary_color, default_background_style, logo_url, font_family, font_url'),
  scope
).single();
```

**Step 2: Merge brand kit content into template section configs**

Replace the section mapping (lines 288-295) with:

```typescript
const sectionRows = template.sections.map(s => {
  let config = { ...s.config };

  // Merge brand kit content into sections
  if (brandKit) {
    if (s.sectionType === 'logo_bar' && brandKit.logos?.length > 0) {
      config = { logos: brandKit.logos };
    }
    if (s.sectionType === 'testimonial' && brandKit.default_testimonial?.quote) {
      config = { ...brandKit.default_testimonial };
    }
    if (s.sectionType === 'steps' && brandKit.default_steps?.steps?.length > 0) {
      config = { ...brandKit.default_steps };
    }
  }

  return {
    funnel_page_id: data.id,
    section_type: s.sectionType,
    page_location: s.pageLocation,
    sort_order: s.sortOrder,
    is_visible: true,
    config,
  };
});
```

**Step 3: Set funnel-level fields from brand kit**

When building the funnel page insert object, use brand kit defaults as fallbacks:

```typescript
theme: body.theme || brandKit?.default_theme || 'dark',
primary_color: body.primaryColor || brandKit?.default_primary_color || '#8b5cf6',
background_style: body.backgroundStyle || brandKit?.default_background_style || 'solid',
logo_url: body.logoUrl || brandKit?.logo_url || null,
font_family: brandKit?.font_family || null,
font_url: brandKit?.font_url || null,
```

**Step 4: Verify**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/api/funnel/route.ts
git commit -m "feat: merge brand kit defaults into new funnel sections and theme"
```

---

### Task 6: Font Rendering on Public Pages

**Files:**
- Modify: `src/app/p/[username]/[slug]/page.tsx` (add font_family, font_url to select, ~line 72)
- Modify: `src/components/funnel/public/OptinPage.tsx` (accept font props, render font link/style)
- Modify: `src/app/p/[username]/[slug]/thankyou/page.tsx` (add font_family, font_url to select)
- Modify: `src/components/funnel/public/ThankyouPage.tsx` (accept font props, render font link/style)
- Create: `src/components/funnel/public/FontLoader.tsx` (shared component)

**Step 1: Create FontLoader component**

```typescript
'use client';

const GOOGLE_FONTS = [
  'Inter', 'DM Sans', 'Poppins', 'Lato', 'Montserrat', 'Open Sans',
  'Raleway', 'Playfair Display', 'Roboto', 'Nunito', 'Source Sans 3',
  'Work Sans', 'Outfit', 'Plus Jakarta Sans', 'Space Grotesk',
  'Manrope', 'Sora', 'Lexend', 'Figtree', 'Geist',
];

interface FontLoaderProps {
  fontFamily: string | null;
  fontUrl: string | null;
}

export function FontLoader({ fontFamily, fontUrl }: FontLoaderProps) {
  if (!fontFamily) return null;

  // Custom font via uploaded woff2
  if (fontFamily === 'custom' && fontUrl) {
    return (
      <style dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'CustomFont';
          src: url('${fontUrl}') format('woff2');
          font-display: swap;
        }
      `}} />
    );
  }

  // Google Font
  if (GOOGLE_FONTS.includes(fontFamily)) {
    const encoded = fontFamily.replace(/ /g, '+');
    return (
      // eslint-disable-next-line @next/next/no-page-custom-font
      <link
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700&display=swap`}
      />
    );
  }

  return null;
}

export function getFontStyle(fontFamily: string | null): React.CSSProperties {
  if (!fontFamily) return {};
  if (fontFamily === 'custom') return { fontFamily: "'CustomFont', sans-serif" };
  return { fontFamily: `'${fontFamily}', sans-serif` };
}
```

**Step 2: Update public page server components**

In both `src/app/p/[username]/[slug]/page.tsx` (line ~72) and `src/app/p/[username]/[slug]/thankyou/page.tsx` (line ~67), add `font_family, font_url` to the funnel page select query.

Pass as props: `fontFamily={funnel.font_family}` and `fontUrl={funnel.font_url}`.

**Step 3: Update OptinPage and ThankyouPage client components**

Add `fontFamily?: string | null` and `fontUrl?: string | null` to both Props interfaces.

In both components, import and render:

```typescript
import { FontLoader, getFontStyle } from './FontLoader';

// In the JSX, wrap the main div:
<div style={getFontStyle(fontFamily)}>
  <FontLoader fontFamily={fontFamily} fontUrl={fontUrl} />
  {/* existing content */}
</div>
```

Also update the content page (`/p/[username]/[slug]/content`) the same way.

**Step 4: Verify**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/funnel/public/FontLoader.tsx src/app/p/ src/components/funnel/public/OptinPage.tsx src/components/funnel/public/ThankyouPage.tsx
git commit -m "feat: render custom fonts on public funnel pages"
```

---

### Task 7: Thank-You Page View Tracking

**Files:**
- Modify: `src/app/api/public/view/route.ts` (accept `pageType` param)
- Modify: `src/components/funnel/public/ThankyouPage.tsx` (add view tracking call on mount)

**Step 1: Update view tracking API**

In `src/app/api/public/view/route.ts`, accept optional `pageType` from request body:

```typescript
const { funnelPageId, pageType } = await request.json();
// ...
const { error } = await supabase
  .from('page_views')
  .upsert(
    {
      funnel_page_id: funnelPageId,
      visitor_hash: visitorHash,
      view_date: today,
      page_type: pageType || 'optin',
    },
    { onConflict: 'funnel_page_id,visitor_hash,view_date,page_type', ignoreDuplicates: true }
  );
```

**Step 2: Add view tracking to ThankyouPage**

In `src/components/funnel/public/ThankyouPage.tsx`, add a useEffect to track the thank-you page view:

```typescript
useEffect(() => {
  fetch('/api/public/view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ funnelPageId, pageType: 'thankyou' }),
  }).catch(() => {});
}, [funnelPageId]);
```

The ThankyouPage needs `funnelPageId` as a prop — add it to the Props interface and pass it from the server component.

**Step 3: Verify**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/api/public/view/route.ts src/components/funnel/public/ThankyouPage.tsx src/app/p/
git commit -m "feat: track thank-you page views with page_type column"
```

---

### Task 8: Analytics API — Conversion Funnel Metrics

**Files:**
- Modify: `src/app/api/analytics/funnel/[id]/route.ts`

**Step 1: Add thank-you views and qualification counts**

Add queries for:
- Thank-you page views: `.from('page_views').select('id', { count: 'exact', head: true }).eq('funnel_page_id', funnelId).eq('page_type', 'thankyou').gte('view_date', startDate)`
- Qualified leads: `.from('funnel_leads').select('id', { count: 'exact', head: true }).eq('...').not('qualification_answers', 'is', null).gte('created_at', startDate)` (leads who completed the form)

Update the response `totals` to include:

```typescript
totals: {
  views,           // optin page views (existing)
  thankyouViews,   // thank-you page views (new)
  leads,           // total leads (existing)
  qualified,       // qualified leads (existing)
  responded,       // leads who submitted qualification answers (new)
  conversionRate,  // leads / views (existing)
  qualificationRate, // qualified / leads (existing)
  responseRate,    // responded / thankyouViews (new)
}
```

**Step 2: Verify**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/analytics/funnel/\[id\]/route.ts
git commit -m "feat: add thank-you views and qualification response rate to analytics"
```

---

### Task 9: Surface Conversion Rate on Funnel Cards

**Files:**
- Modify: `src/app/(dashboard)/magnets/page.tsx` (add conversion rate to cards)

**Step 1: Fetch conversion data alongside funnels**

After fetching lead magnets and funnels, also fetch:
- `page_views` count per funnel (grouped)
- `funnel_leads` count per funnel (grouped)

Add to the card display:

```typescript
// Show conversion rate badge if funnel exists and has views
{funnel && views > 0 && (
  <span className="text-xs text-muted-foreground">
    {((leadCount / views) * 100).toFixed(1)}% conversion
  </span>
)}
```

**Step 2: Verify**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/magnets/page.tsx
git commit -m "feat: show conversion rate on funnel cards"
```

---

### Task 10: Typecheck, Build, Deploy

**Step 1: Full typecheck**

```bash
npx tsc --noEmit
```

**Step 2: Build**

```bash
npm run build
```

Fix any lint/build errors.

**Step 3: Push and deploy**

```bash
git push origin main
vercel --prod
```

**Step 4: Deploy Trigger.dev (if any tasks were modified)**

```bash
TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy
```

---

## File Summary

| Task | Files Modified/Created |
|------|----------------------|
| 1. Migration | `supabase/migrations/20260217200000_brand_kit_branding.sql` |
| 2. Brand Kit API | `src/app/api/brand-kit/route.ts` |
| 3. Upload API | `src/app/api/brand-kit/upload/route.ts` |
| 4. Branding UI | `src/components/settings/BrandingSettings.tsx`, `SettingsContent.tsx`, `settings/page.tsx` |
| 5. Funnel Creation | `src/app/api/funnel/route.ts` |
| 6. Font Rendering | `FontLoader.tsx`, `OptinPage.tsx`, `ThankyouPage.tsx`, public page server components |
| 7. TY View Tracking | `public/view/route.ts`, `ThankyouPage.tsx` |
| 8. Analytics API | `analytics/funnel/[id]/route.ts` |
| 9. Conversion Cards | `magnets/page.tsx` |
| 10. Deploy | Build + Vercel + Trigger.dev |
