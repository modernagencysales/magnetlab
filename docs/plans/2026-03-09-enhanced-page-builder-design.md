# Enhanced Page Builder — Design

## Problem

Funnel pages look generic and lack visual impact compared to tools like Perspective.co. Existing sections are too flexible — users put them in wrong places, upload weird logos, and create broken layouts. There's no structural enforcement of best practices.

## Solution

AI-generated pages that look like they came from a pro designer. No drag-and-drop builder. Pages are generated on creation and refined via natural language (extending the Funnel Restyler). Best practices are enforced structurally — users can't put sections in wrong places or create weird layouts.

## Core Principle

**NOT a page builder.** Pages are AI-generated and modified with natural language. Users should not have to think about placement or configuration — best practices are enforced structurally.

## Scope

**Changes:**
- Named layout variants per section type (AI picks, user can switch)
- 4 new section types: hero, stats_bar, feature_grid, social_proof_wall
- Tightened constraints on all 5 existing section types
- Position rules engine (sections declare where they're allowed)
- Animation layer (scroll-triggered, staggered, counters)
- Auto-generation on funnel creation
- Variant changes integrated into RestylePlan

**Does NOT change:**
- No drag-and-drop editor
- No custom CSS injection
- No arbitrary positioning
- No user-created section types
- No code editing
- No swipe/gesture interactions

## Section Variant System

Every section type gets **named layout variants** instead of freeform config. AI picks the variant; user can switch via prompt or UI dropdown.

### Existing Sections (Tightened)

| Section | Variants | Constraints Added |
|---------|----------|-------------------|
| `logo_bar` | `inline`, `grid` | Min 2 / max 8 logos. Auto-resize to uniform height. Reject non-image URLs. Only allowed on optin page, position: top. |
| `steps` | `numbered`, `timeline`, `icon-cards` | Exactly 3-5 steps. Each step requires title + description. Auto-numbered. Only after headline, before form. |
| `testimonial` | `quote-card`, `highlight`, `avatar` | Quote required (min 20 chars). Author required. Role optional. Result optional. Max 1 per page location. |
| `marketing_block` | `feature-card`, `benefit`, `faq-accordion`, `cta-banner` | Replaces the current 7-subtype chaos. Each variant has a strict schema. FAQ items: 3-8. |
| `section_bridge` | `divider`, `accent-bar`, `gradient-fade` | Text required (min 10 chars). No empty bridges. Position: only between other sections. |

### New Sections

| Section | Variants | Config |
|---------|----------|--------|
| `hero` | `centered`, `split-image`, `full-bleed-gradient` | Headline (required), subline, CTA button text/URL, background image URL or gradient config. Only position: page top. |
| `stats_bar` | `inline`, `cards`, `animated-counters` | 3-4 stat items, each: `{ value, label }`. Values must be short (< 10 chars). |
| `feature_grid` | `icon-top`, `icon-left`, `minimal` | 3-6 features, each: `{ icon (emoji or lucide name), title, description }`. Auto-grid: 3 cols desktop, 1 mobile. |
| `social_proof_wall` | `grid`, `carousel`, `stacked` | 2-6 testimonials, each: `{ quote, author, role?, avatar? }`. Auto-layout. |

## Position Rules Engine

Sections can't be placed anywhere. Each section type declares **where it's allowed**:

```
hero:              optin top ONLY (max 1)
logo_bar:          optin top, after hero (max 1)
stats_bar:         optin or thankyou, after headline (max 1)
steps:             any page, mid-section (max 1 per page)
feature_grid:      optin or content, mid-section (max 1)
testimonial:       any page, mid or bottom (max 2 per page)
social_proof_wall: any page, bottom half (max 1)
section_bridge:    any page, only between sections (max 3)
marketing_block:   any page, mid-section (max 3)
```

When AI generates or restyler suggests adding a section, the position rules are enforced automatically. Invalid placements are rejected.

## Animation Layer

CSS + Framer Motion animations applied per-section based on variant:

| Animation | Applied To | Implementation |
|-----------|-----------|----------------|
| Fade-in on scroll | All sections | Intersection Observer + opacity/translateY transition |
| Staggered reveal | Feature grid, stats bar, steps | Children animate in sequence (100ms delay each) |
| Counter animation | Stats bar `animated-counters` variant | Number counts up from 0 on scroll enter |
| Hover lift | Cards (feature grid, testimonial, marketing block) | translateY(-2px) + shadow on hover |
| Gradient shift | Hero `full-bleed-gradient` variant | Slow CSS gradient animation (background-position) |
| Smooth parallax | Hero with background image | translateY at 50% scroll speed |

All animations respect `prefers-reduced-motion` — disabled when user has motion sensitivity.

## Generation Flow

### On Funnel Creation

1. AI analyzes the lead magnet content + brand kit + target audience
2. Picks appropriate sections, variants, and positions
3. Generates config for each section (copy, stats, features)
4. Applies brand colors/fonts
5. Result: a complete, polished page on first render

### On Restyle/Refine (Extends Existing Restyler)

The `RestylePlan` gains a new field: `sectionVariantChanges`:

```json
{
  "changes": [...],
  "sectionChanges": [...],
  "sectionVariantChanges": [
    { "sectionId": "abc", "fromVariant": "numbered", "toVariant": "timeline", "reason": "More visual flow" },
    { "sectionId": "def", "fromVariant": "quote-card", "toVariant": "avatar", "reason": "More personal feel" }
  ]
}
```

### Via MCP/CLI

```
magnetlab_restyle_funnel({ funnel_id, prompt: "make it look more like a SaaS landing page with animated stats" })
-> plan includes variant changes + new sections with variants
```

## Data Model

Add `variant` column to `funnel_page_sections`:

```sql
ALTER TABLE funnel_page_sections
  ADD COLUMN variant TEXT NOT NULL DEFAULT 'default';
```

Section config schemas become **variant-specific** — each variant has its own Zod schema. The `config` JSON is validated against the variant's schema on write.

No new tables. Uses existing:
- `funnel_pages`: theme, primaryColor, backgroundStyle, fontFamily, fontUrl, logoUrl
- `funnel_page_sections`: type, position, config, page_type + new `variant` column

## Architecture

```
Section Types & Variants
  src/lib/types/section-variants.ts       — Type definitions, variant enums, config schemas
  src/lib/validations/section-rules.ts    — Position rules, config validation, constraint checking

Animation Layer
  src/components/funnel/animations/       — Scroll observer, stagger, counter, parallax hooks/components

Section Renderers (updated)
  src/components/funnel/sections/         — Each section type renders based on variant

Generation
  src/lib/ai/funnel-generation/           — AI prompt for auto-generating sections on creation
  src/server/services/restyle.service.ts  — Extended to handle sectionVariantChanges

Repository
  src/server/repositories/funnels.repo.ts — Updated for variant column
```

## Constraints

- Service must not import NextRequest/NextResponse (pure business logic)
- Route handlers stay under 30 lines
- Position rules enforced in service layer, not just UI
- Variant-specific Zod schemas for all section configs
- All animations respect `prefers-reduced-motion`
- Section renderers must handle `variant='default'` gracefully (backward compat)
- No component over 300 lines — extract animation hooks and sub-components
