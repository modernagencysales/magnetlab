# Team-Level Branding & Conversion Tracking Design

## Goal

Extend the brand kit to be the single source of truth for all visual branding (logos, fonts, colors, testimonials, next steps) at the team level. Auto-populate new funnels with these defaults. Add conversion funnel tracking (views → leads → qualification completion).

## Key Decisions

- **Approach A**: Extend existing `brand_kits` table (not a new table)
- **New funnels only**: Defaults populate new funnels; existing funnels untouched
- **Qualification = bonus form**: Track qualification completion rate on thank-you page
- **Settings → Branding tab**: New section in Settings for all visual branding
- **Multi-client safe**: Brand kit is team-scoped via `applyScope`; each team/client gets independent branding
- **Google Fonts + custom upload**: Dropdown of popular fonts + woff2 upload to Supabase Storage

---

## 1. Schema Changes

### `brand_kits` table — new columns

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `logos` | JSONB | `[]` | Array of `{name: string, imageUrl: string}` for logo bar sections |
| `default_testimonial` | JSONB | `null` | `{quote, author, role, result}` for testimonial sections |
| `default_steps` | JSONB | `null` | `{heading, steps: [{title, description}]}` for steps sections |
| `default_theme` | TEXT | `'dark'` | `dark` / `light` / `custom` |
| `default_primary_color` | TEXT | `'#8b5cf6'` | Hex color for buttons/accents |
| `default_background_style` | TEXT | `'solid'` | `solid` / `gradient` / `pattern` |
| `logo_url` | TEXT | `null` | Main logo URL (page header) |
| `font_family` | TEXT | `null` | Google Font name or `'custom'` |
| `font_url` | TEXT | `null` | Custom font woff2 URL (Supabase Storage) |

### `funnel_pages` table — new columns

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `font_family` | TEXT | `null` | Snapshot from brand kit at creation time |
| `font_url` | TEXT | `null` | Snapshot from brand kit at creation time |

### `page_views` table — new column

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `page_type` | TEXT | `'optin'` | Distinguishes `optin` vs `thankyou` page views |

Update unique constraint to include `page_type`: `(funnel_page_id, visitor_hash, view_date, page_type)`.

---

## 2. Settings UI — Branding Tab

New section in Settings, organized into cards:

**Card 1: Logo & Identity**
- Main logo upload (drag-drop, Supabase Storage)
- Logo bar: add/remove multiple logos (trust badges, client logos)
- Preview strip

**Card 2: Theme & Colors**
- Theme picker: Dark / Light / Custom
- Primary color picker (hex input)
- Background style: Solid / Gradient / Pattern

**Card 3: Font**
- Dropdown of ~20 popular Google Fonts with live preview
- "Upload custom font" option (accepts .woff2)
- Preview text showing selection

**Card 4: Default Testimonial**
- Quote (textarea), Author, Role, Result
- Preview card

**Card 5: Default Next Steps**
- Heading input
- Sortable step list (title + description), add/remove
- Preview

All fields auto-save (debounced PATCH to `/api/brand-kit`). Team-scoped.

---

## 3. Template Population Flow

When creating a new funnel:

1. Fetch brand kit for current scope (team or personal)
2. Fetch template definition (Minimal, Social Proof, etc.)
3. Merge brand kit defaults into template sections:
   - `logo_bar` → `brand_kit.logos`
   - `testimonial` → `brand_kit.default_testimonial`
   - `steps` → `brand_kit.default_steps`
4. Set funnel-level fields from brand kit:
   - `theme`, `primary_color`, `background_style`, `logo_url`
   - `font_family`, `font_url` (snapshot — independent after creation)
5. Insert populated sections into `funnel_page_sections`

Existing funnels are never modified.

---

## 4. Font Rendering on Public Pages

In the public page server component:

- Read `font_family` and `font_url` from the funnel page record
- If Google Font: inject `<link href="https://fonts.googleapis.com/css2?family={fontFamily}&display=swap" rel="stylesheet">`
- If custom: inject `<style>@font-face { font-family: 'CustomFont'; src: url({fontUrl}) format('woff2'); }</style>`
- Apply via CSS variable `--page-font` on the page wrapper
- All section components inherit via `font-family: var(--page-font, inherit)`

---

## 5. Conversion Tracking

### New tracking: Thank-you page views

- Thank-you page client component fires `/api/public/view` on mount with `pageType: 'thankyou'`
- `page_views` table stores both types, distinguished by `page_type` column

### Metrics computed

| Metric | Formula |
|--------|---------|
| Opt-in conversion rate | `funnel_leads / page_views(optin)` |
| Qualification completion rate | `leads with qualification_answers / page_views(thankyou)` |
| Overall funnel efficiency | `qualified_leads / page_views(optin)` |

### Where surfaced

- **Funnel cards** on magnets list: conversion rate badge
- **Analytics page**: funnel visualization (Views → Leads → Qualified) with drop-off percentages
- **Homepage stats**: overall conversion rate

### No new tables needed

Just the `page_type` column on `page_views` + better aggregation in the analytics API.

---

## 6. Multi-Client Safety

- Brand kit fetched via `applyScope` → returns active team's kit
- Funnel creation stamps `team_id` + reads brand kit for that team
- Font/color/logo on `funnel_pages` are snapshots (independent after creation)
- Switching teams via `ml-team-context` cookie switches everything
- No cross-contamination between clients

---

## 7. Migration from User Defaults

The `users` table currently has: `default_theme`, `default_primary_color`, `default_background_style`, `default_logo_url`, `default_funnel_template`.

Migration plan:
1. Add new columns to `brand_kits`
2. Backfill: copy user defaults into their brand kit (for users who have them set)
3. Update funnel creation to read from brand kit instead of users table
4. Keep `default_funnel_template` on users table (template selection is separate from branding)
5. Deprecate (but don't drop) the old user default columns
