# Thank-You Page Tweaks & External Resource UX

Date: 2026-02-18

## Problem

Three user feedback items:

1. **Duplicate headlines on TY page** -- The page renders the editable headline/subline, then a hard-coded "One quick step to personalize your experience" + "Answer N quick questions..." above the survey card. Redundant and confusing.
2. **No homepage link on TY page** -- Users want a "Visit our website" link after the thank-you message so leads have somewhere to go.
3. **External resources not discoverable** -- Users with lead magnets hosted elsewhere don't realize they can use MagnetLab landing pages. The external resource flow is hidden.

## Design

### Change 1: Remove Duplicate Survey Bridge Copy

Delete the hard-coded survey bridge section (lines 282-292 of `ThankyouPage.tsx`):
```tsx
// DELETE THIS ENTIRE BLOCK:
{hasQuestions && !qualificationComplete && (
  <div className="text-center space-y-2">
    <h2>One quick step to personalize your experience</h2>
    <p>Answer N quick questions...</p>
  </div>
)}
```

The editable headline/subline already serves this purpose. The time-estimate pill on the survey card provides sufficient context. A/B testing already covers `headline` and `subline` fields.

**Files**: `ThankyouPage.tsx` only. No DB changes.

### Change 2: Homepage Link on TY Page

**DB changes**:
- `brand_kits` table: add `website_url TEXT` (team-level default)
- `funnel_pages` table: add `homepage_url TEXT`, `homepage_label TEXT` (per-funnel override)

**Editor** (`ThankyouPageEditor.tsx`):
- New "Homepage Link" section with URL input + optional label input
- Default label: "Visit our website"

**Rendering** (`ThankyouPage.tsx`):
- New prop: `homepageUrl`, `homepageLabel`
- Renders styled link after qualification result (or after headline if no questions)
- Only shows if URL is set

**Server page** (`thankyou/page.tsx`):
- Fetch `brand_kits.website_url` as fallback when `funnel_pages.homepage_url` is null
- Pass resolved URL + label to ThankyouPage component

**Branding settings** (`BrandingSettings.tsx`):
- Add "Website URL" field to team branding card

### Change 3: External Resources in Funnel Builder + Better Pages UX

**Part A: Inline external URL in funnel builder**

In the funnel builder, add a delivery source toggle:
- "On MagnetLab" (default) -- existing content editor
- "External URL" -- simple URL input field

When "External URL" is selected and a URL is entered, auto-create an external resource and link it to the funnel. This lets users build a MagnetLab landing page for content hosted anywhere.

**Part B: Better Pages list UX**

Update the "Create Page" flow on the Pages tab:
- Show clear options: "Create page for your lead magnet" vs "Create page for external resource"
- Add description under external option: "Use a MagnetLab landing page even if your resource is hosted elsewhere"

## Files Affected

| File | Change |
|------|--------|
| `ThankyouPage.tsx` | Remove survey bridge copy, add homepage link |
| `ThankyouPageEditor.tsx` | Add homepage URL + label fields |
| `thankyou/page.tsx` (server) | Fetch brand_kits fallback, pass homepage props |
| `BrandingSettings.tsx` | Add website URL field |
| `FunnelBuilder.tsx` | Add delivery source toggle for external URL |
| `pages/page.tsx` | Improve create-page UX with clear options |
| New migration | Add columns to brand_kits + funnel_pages |
