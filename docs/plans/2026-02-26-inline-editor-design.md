# Inline Notion-Style Content Editor — Design

**Date**: 2026-02-26
**Status**: Approved
**Approach**: Hybrid (TipTap for text blocks, custom styled editors for structured blocks)

## Problem

The current content editor is a batch section editor in the funnel builder's left panel. Users edit text in `<textarea>` fields with dashed borders, separate from the actual rendered page. This forces constant mental mapping between the editor and the preview. The user wants to edit directly on the live page — Notion-style inline editing.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Edit UX | Subtle hover hints (faint outline + drag handle on hover) |
| Rich text | Bold + italic + links (extending current bold-only markdown) |
| Content tab | Replace with redirect to inline editor (no dual editor) |
| Block creation | Slash command (/) menu |
| Library | TipTap (ProseMirror-based) for text blocks only |

## Architecture

### Component Hierarchy (Edit Mode)

```
ContentPageClient (existing, unchanged)
  └── InlineContentEditor (new, replaces EditablePolishedContentRenderer)
       ├── InlineHeroEditor (contentEditable title + TipTap heroSummary)
       ├── InlineSectionEditor[] (one per section)
       │    ├── SectionHeading (contentEditable h2)
       │    ├── SectionIntro (TipTap, italic)
       │    ├── InlineBlockEditor[] (per block, type-dispatched)
       │    │    ├── TipTapTextBlock (paragraph, callout, list, quote)
       │    │    ├── StructuredBlockOverlay (table, code, image, embed, etc.)
       │    │    └── BlockHoverControls (drag handle, move, delete, type label)
       │    ├── SlashCommandMenu (TipTap Suggestion plugin)
       │    └── SectionKeyTakeaway (TipTap)
       └── FloatingToolbar (bold/italic/link on text selection)
```

### Data Flow (Unchanged)

```
PolishedContent JSON → InlineContentEditor → edit in place
  → serialize back to PolishedContent → PUT /api/lead-magnet/[id]/content
```

No DB changes. No new API routes. No schema migrations.

## TipTap Integration

### Dependencies

- `@tiptap/react` — React bindings
- `@tiptap/starter-kit` — Bold, italic, history, paragraph, headings, lists
- `@tiptap/extension-link` — Links with URL input
- `@tiptap/extension-placeholder` — Ghost text in empty blocks
- `@tiptap/suggestion` — Slash command menu

### Block Type → Editor Mapping

**TipTap text blocks** (inline rich text editing):
- `paragraph` — TipTap with bold/italic/link marks
- `callout` — TipTap inside callout wrapper (icon + colored border)
- `list` — TipTap BulletList extension (real `<ul>`)
- `quote` — TipTap inside blockquote wrapper
- Section `introduction` and `keyTakeaway` fields

**Custom styled editors** (structured blocks, hover popover):
- `table` — Rendered as final table; gear icon → popover for add row/column
- `code` — Rendered with syntax highlighting; gear → popover for language + content
- `numbered-item` — Rendered as final card; gear → popover for title/number/category/detail
- `stat-card` — Rendered as final card; gear → popover for value/style/description
- `accordion` — Rendered as final accordion; gear → popover for title/content
- `image` — Rendered as final image; gear → popover for URL/alt/caption
- `embed` — Rendered as final embed; gear → popover for URL
- `divider` — No editing needed

### Serialization (TipTap JSON ↔ PolishedContent)

`PolishedBlock.content` stores plain text with markdown formatting. Bidirectional converter:

- **Deserialize** (load): `**bold**` → TipTap bold mark, `*italic*` → italic mark, `[text](url)` → link mark
- **Serialize** (save): TipTap marks → markdown back into `content` string

Schema stays unchanged. Existing content renders without migration. New italic/link marks are additive — old content with only `**bold**` works fine.

## Visual Design

### Hover Controls

- Block hover: faint left gutter with `⋮⋮` drag handle + muted type label
- Block gets subtle border/highlight on hover
- Drag handle click → context menu: Move Up, Move Down, Delete, Change Type
- Between sections: faint `+ Add section` divider on hover

### Structured Block Editing

- Hover → gear icon in top-right corner
- Click gear → floating popover with form fields (same as current, restyled)
- Block always renders in published form
- Tables: cells directly editable (contentEditable in `<td>`)

### Floating Text Toolbar

- Select text in any TipTap block → toolbar floats above selection
- Buttons: **B** (bold), *I* (italic), link icon (URL input)
- TipTap BubbleMenu component

### Slash Command Menu

- Type `/` at start of empty block → filterable dropdown
- All 14 block types listed with icons
- Select → inserts new block
- TipTap Suggestion plugin

## Entry Points

1. **Content page** (primary): Edit pencil button in ContentHeader toggles edit mode (existing behavior, now with inline editor)
2. **Funnel builder** (redirect): Content tab shows status + "Edit Content" button → navigates to `/p/username/slug/content?edit=true`
3. **Direct URL**: `?edit=true` query param auto-enters edit mode (team members only)

## Content Tab Replacement

The funnel builder's Content tab becomes simplified:
- Content status (word count, last edited)
- "Generate with AI" button (for initial generation)
- "Write Your Own" blank content creation
- "Edit Content" button → redirect to live page

`EditablePolishedContentRenderer` is removed from the funnel builder.

## What Doesn't Change

- Database schema (zero migrations)
- Save API (`PUT /api/lead-magnet/[id]/content`)
- Public page rendering (`PolishedContentRenderer` untouched)
- AI content generation pipeline
- Edit tracking (`captureAndClassifyEdit`)
- Block type definitions (all 14 stay)
- TOC sidebar (hidden during edit, same as today)
- Theme, sections, opt-in, thank-you page editors

## Files Modified

| File | Change |
|------|--------|
| `src/components/content/InlineContentEditor.tsx` | **NEW** — main inline editor |
| `src/components/content/TipTapTextBlock.tsx` | **NEW** — TipTap wrapper for text blocks |
| `src/components/content/StructuredBlockOverlay.tsx` | **NEW** — hover popover for structured blocks |
| `src/components/content/BlockHoverControls.tsx` | **NEW** — hover gutter controls |
| `src/components/content/FloatingToolbar.tsx` | **NEW** — text selection toolbar |
| `src/components/content/SlashCommandMenu.tsx` | **NEW** — block type picker |
| `src/lib/utils/tiptap-serializer.ts` | **NEW** — PolishedContent ↔ TipTap converter |
| `src/components/content/ContentPageClient.tsx` | Edit mode renders InlineContentEditor |
| `src/components/funnel/ContentPageTab.tsx` | Simplified to status + redirect button |
| `src/components/content/EditablePolishedContentRenderer.tsx` | Deprecated (kept for reference) |
| `package.json` | Add TipTap dependencies |
