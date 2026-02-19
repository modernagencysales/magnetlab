# Funnel Template System Design

**Date:** 2026-02-17
**Status:** Approved

## Problem

The current funnel page builder requires users to manually add design system sections one by one from a dropdown. This is confusing — users don't know what sections to add, where to place them, or what good defaults look like. The content page also requires a manual "Polish with AI" step that users often miss, leading to the "Generate content first" empty state even after completing the wizard.

## Solution

Static template presets that auto-populate sections for all three page types (opt-in, thank-you, content). Users set a default template at the account level; new funnels inherit it. Per-funnel customization via the existing section builder. Auto-polish content on publish.

## Template Definitions

4 hardcoded templates defined in code (`src/lib/constants/funnel-templates.ts`):

### Minimal
- **Opt-in:** No sections
- **Thank-you:** No sections
- **Content:** No sections (just polished content)
- **Best for:** Simple lead magnets where content speaks for itself

### Social Proof (Default)
- **Opt-in:** Logo bar (sort 0)
- **Thank-you:** Steps "What Happens Next" (sort 0)
- **Content:** Logo bar (sort 0), Testimonial quote (sort 50)
- **Best for:** Building trust with social proof elements

### Authority
- **Opt-in:** Steps "How It Works" (sort 0), Testimonial (sort 50)
- **Thank-you:** Steps "What's Next" (sort 0)
- **Content:** Steps "What You'll Learn" (sort 0), Testimonial + CTA bridge (sort 50, 51)
- **Best for:** Establishing expertise and guiding the reader

### Full Suite
- **Opt-in:** Logo bar (sort 0), Steps (sort 1), Testimonial (sort 50)
- **Thank-you:** Steps (sort 0), CTA bridge (sort 50)
- **Content:** Logo bar (sort 0), Steps (sort 1), Testimonial (sort 50), Marketing block (sort 51), CTA bridge (sort 52)
- **Best for:** Maximum persuasion with all available elements

## Account-Level Default

- New column: `users.default_funnel_template` (text, nullable, default `'social_proof'`)
- Migration: `ALTER TABLE users ADD COLUMN default_funnel_template text DEFAULT 'social_proof'`
- Settings page: New "Funnel Template" card showing 4 visual template options as selectable cards

## Funnel Creation Flow

When `POST /api/funnel` creates a new funnel:
1. Read user's `default_funnel_template` (fallback `'social_proof'`)
2. Look up template definition from constants
3. Bulk-insert `funnel_page_sections` rows for all 3 page types
4. Return the created funnel with sections

## Auto-Polish on Publish

When a funnel is published (`POST /api/funnel/[id]/publish` or status change to published):
1. Check if lead magnet has `extracted_content` but no `polished_content`
2. If so, auto-run polish in **formatting-only mode**
3. Formatting-only mode: Structure into clean blocks (headings, paragraphs, lists, callouts) but preserve the user's original wording verbatim. No rewriting, paraphrasing, or adding new content.
4. Set `polished_content` and `polished_at`

## Polish Prompt Change

Current polish prompt rewrites content for readability. New formatting-only mode:
- Structures raw extraction answers into PolishedContent blocks
- Adds proper headings matching section names
- Converts bullet lists to proper list blocks
- Wraps key insights in callout blocks
- Preserves original text exactly — no paraphrasing or rewording
- Calculates reading time and word count

## Per-Funnel Override

- Existing `SectionsManager` unchanged — users add/remove/edit sections after template application
- New "Reset to Template" button in SectionsManager:
  - Shows confirmation dialog
  - Deletes all sections for current page location
  - Re-creates from user's default template
  - Only resets the active tab's page location (not all pages)

## UI Changes

### Settings Page
- New card in settings: "Default Funnel Template"
- 4 template options as visual cards (name, description, mini icon preview)
- Selected template highlighted with primary color border
- Saves to `users.default_funnel_template` via `PUT /api/user/settings`

### SectionsManager
- Add "Reset to Template" button below the section list
- Confirmation: "This will replace all [Opt-in/Thank-you/Content] sections with the template defaults. Continue?"

### ContentPageTab
- Remove the "Generate content first" empty state
- If content exists but isn't polished, show "Content will be auto-formatted when you publish"
- If polished, show current polish status + edit buttons

### FunnelBuilder
- No changes to tab structure
- Template sections auto-appear after funnel creation

## Data Model

No new tables. Changes:
- `users` table: add `default_funnel_template text DEFAULT 'social_proof'`
- `funnel_page_sections`: unchanged (template sections become regular section rows)

## File Changes

| File | Change |
|------|--------|
| `src/lib/constants/funnel-templates.ts` | NEW: Template definitions |
| `src/app/api/funnel/route.ts` (POST) | Auto-create sections from template |
| `src/app/api/funnel/[id]/publish/route.ts` | Auto-polish on publish |
| `src/app/api/user/settings/route.ts` | Handle `default_funnel_template` |
| `src/lib/ai/lead-magnet-generator.ts` | Add formatting-only polish mode |
| `src/components/funnel/SectionsManager.tsx` | Add "Reset to Template" button |
| `src/components/funnel/ContentPageTab.tsx` | Update empty state messaging |
| `src/components/settings/FunnelTemplateSelector.tsx` | NEW: Template picker UI |
| Settings page | Add FunnelTemplateSelector card |
| Supabase migration | Add `default_funnel_template` column |
