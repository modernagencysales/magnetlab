# Hosted Lead Magnet Content Page

## Overview

Public, Notion-like content page that renders lead magnet content at `/p/[username]/[slug]/content`. Transforms raw extracted content into a polished reading experience with structured blocks, dark/light mode, sticky TOC, and optional video/Calendly embeds.

## User Flow

```
Wizard → Extract Content → Funnel Builder → Content Tab → "Polish with AI"
                                                           ↓
                                                     Polished content saved
                                                           ↓
                              Published funnel auto-polishes if not yet polished
                                                           ↓
                              Thank You page → "Access Your [Title]" button
                                                           ↓
                              /p/[username]/[slug]/content?leadId=xxx
                                                           ↓
                              Public content page (Calendly gated to qualified leads)
```

## Architecture

### Database

Two columns added to `lead_magnets` table:

| Column | Type | Description |
|--------|------|-------------|
| `polished_content` | `JSONB` | AI-polished block-based content |
| `polished_at` | `TIMESTAMPTZ` | When content was last polished |

Migration: `supabase/migrations/20250128_polished_content.sql`

### Data Model

```typescript
interface PolishedContent {
  version: number;              // Schema version (currently 1)
  polishedAt: string;           // ISO timestamp
  sections: PolishedSection[];  // Ordered content sections
  heroSummary: string;          // 1-2 sentence hook for page top
  metadata: {
    readingTimeMinutes: number; // Based on 200 wpm
    wordCount: number;
  };
}

interface PolishedSection {
  id: string;           // URL-safe slug for anchor linking
  sectionName: string;  // Section heading (h2)
  introduction: string; // 2-3 sentence section intro (italic)
  blocks: PolishedBlock[];
  keyTakeaway: string;  // Rendered as success callout
}

interface PolishedBlock {
  type: 'paragraph' | 'callout' | 'list' | 'quote' | 'divider';
  content: string;             // Text content (**bold** supported in paragraphs)
  style?: 'info' | 'warning' | 'success'; // Callout-only
}
```

### Block Types

| Type | Rendering | Notes |
|------|-----------|-------|
| `paragraph` | Rich text with `**bold**` parsing | 1.125rem, 1.875rem line-height |
| `callout` | Notion-style box with left border accent + icon | 3 styles: info (blue), warning (amber), success (green) |
| `list` | Bullet list | Items separated by `\n`, `- ` prefix stripped |
| `quote` | Left-border blockquote in italic | Uses primaryColor for border |
| `divider` | Subtle horizontal rule | Content should be empty string |

## API

### POST /api/lead-magnet/[id]/polish

Triggers AI polishing of extracted content.

- **Auth**: Required (session user must own the lead magnet)
- **Prerequisites**: Lead magnet must have `extracted_content` and `concept`
- **Response**: `{ polishedContent: PolishedContent, polishedAt: string }`
- **Side effect**: Saves to `polished_content` and `polished_at` columns

### Auto-Polish on Publish

When publishing a funnel page (`POST /api/funnel/[id]/publish` with `{ publish: true }`), if the associated lead magnet has `extracted_content` but no `polished_content`, the system automatically triggers polishing. This is non-blocking — if AI polish fails, the funnel still publishes successfully.

## Pages

### Content Page `/p/[username]/[slug]/content`

- **Access**: Public (anyone with the link)
- **ISR**: Revalidates every 300 seconds
- **SEO**: `generateMetadata()` sets title, description (heroSummary), og:image (thumbnail)
- **Fallback**: If no polished content exists, renders raw extracted content sections as plain paragraphs
- **Page views**: Tracked with `page_type: 'content'` in `page_views` table

### Calendly Gating

Calendly embed on the content page is gated to qualified leads only:

1. Thank you page includes `?leadId=xxx` in the content page link
2. Content page server component checks `funnel_leads.is_qualified` for that leadId
3. Only passes `calendlyUrl` to the client component if the lead is qualified
4. If no leadId or lead is not qualified, Calendly is hidden

This matches the thank you page behavior where Calendly only shows for qualified leads.

## Components

All in `src/components/content/`:

| Component | Purpose |
|-----------|---------|
| `ContentPageClient` | Main layout: header + hero + video + [content \| TOC sidebar] + calendly + footer |
| `ContentHeader` | Sticky header with logo (left) and sun/moon theme toggle (right), backdrop blur |
| `ContentHero` | Large title, hero summary, reading time + word count metadata, divider |
| `TableOfContents` | Desktop: sticky sidebar (220px, top: 5rem). Mobile: FAB button → bottom drawer |
| `PolishedContentRenderer` | Maps sections to heading + intro + blocks + key takeaway callout |
| `ContentBlocks` | Individual block components: Callout, RichParagraph, BulletList, BlockQuote, SectionDivider |
| `ExtractedContentRenderer` | Fallback: renders raw extracted_content sections as simple paragraphs |
| `ContentFooter` | "Powered by MagnetLab" link |

### TOC Behavior

- Uses `IntersectionObserver` with `rootMargin: '-80px 0px -60% 0px'` to highlight current section
- Active section gets left border accent + primaryColor text
- Smooth scroll on click
- Mobile: fixed FAB (bottom-right) opens a bottom sheet drawer with section list

## Funnel Builder Integration

### Content Tab

Located between "Theme" and "Email" tabs in `FunnelBuilder.tsx`.

**States:**
- No extracted content → "Generate content first in the wizard" message
- Has extracted but not polished → "Polish Content with AI" button
- Has polished content → Shows polish date, section count, word count, reading time + "Re-polish" and "Preview" buttons

Component: `src/components/funnel/ContentPageTab.tsx`

### Thank You Page Link

`ThankyouPage.tsx` shows an "Access Your [Title]" button linking to `/p/[username]/[slug]/content?leadId=xxx`. Only appears when the lead magnet has content (polished or extracted).

## Theme / Style Guide

```
Dark mode:  bg=#09090B  card=#18181B  text=#FAFAFA  body=#E4E4E7  muted=#A1A1AA  border=#27272A
Light mode: bg=#FAFAFA   card=#FFFFFF  text=#09090B  body=#27272A  muted=#71717A  border=#E4E4E7

Typography:
  Headings: 2rem, weight 600, letter-spacing -0.02em, line-height 2.5rem
  Body: 1.125rem, weight 400, letter-spacing -0.01em, line-height 1.875rem
  Muted: 0.875rem

Callout colors (dark/light):
  info:    bg=blue/10  border=#3b82f6  text=#93c5fd / #1e40af
  warning: bg=amber/10 border=#f59e0b  text=#fcd34d / #92400e
  success: bg=green/10 border=#22c55e  text=#86efac / #166534
```

All styling uses inline styles (no Tailwind classes) for the public content page to ensure consistent rendering regardless of the host app's CSS configuration.

## Tests

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `__tests__/lib/types/lead-magnet.test.ts` | 15 | PolishedContent structure, block types, callout styles, section IDs |
| `__tests__/api/lead-magnet/polish.test.ts` | 6 | Auth, 404, missing content/concept, success, DB save |
| `__tests__/components/content/content-blocks.test.ts` | 21 | Bold parsing, list parsing, TOC generation, theme colors |
| `__tests__/api/funnel/publish-polish.test.ts` | 7 | Auto-polish triggers, skip conditions, failure resilience |

Run: `npm test`

## Files

### Created
- `supabase/migrations/20250128_polished_content.sql`
- `src/app/api/lead-magnet/[id]/polish/route.ts`
- `src/app/p/[username]/[slug]/content/page.tsx`
- `src/components/content/ContentPageClient.tsx`
- `src/components/content/ContentHeader.tsx`
- `src/components/content/ContentHero.tsx`
- `src/components/content/TableOfContents.tsx`
- `src/components/content/PolishedContentRenderer.tsx`
- `src/components/content/ContentBlocks.tsx`
- `src/components/content/ExtractedContentRenderer.tsx`
- `src/components/content/ContentFooter.tsx`
- `src/components/content/index.ts`
- `src/components/funnel/ContentPageTab.tsx`
- `src/__tests__/lib/types/lead-magnet.test.ts`
- `src/__tests__/api/lead-magnet/polish.test.ts`
- `src/__tests__/components/content/content-blocks.test.ts`
- `src/__tests__/api/funnel/publish-polish.test.ts`

### Modified
- `src/lib/types/lead-magnet.ts` — Added PolishedContent types, updated LeadMagnet interface
- `src/lib/ai/lead-magnet-generator.ts` — Added `polishLeadMagnetContent()`
- `src/components/funnel/FunnelBuilder.tsx` — Added Content tab
- `src/components/funnel/public/ThankyouPage.tsx` — Added content page link with leadId
- `src/app/p/[username]/[slug]/thankyou/page.tsx` — Pass content URL + title props
- `src/app/api/funnel/[id]/publish/route.ts` — Auto-polish on first publish
- `src/app/(dashboard)/library/[id]/funnel/page.tsx` — Include polishedContent/polishedAt in LeadMagnet
