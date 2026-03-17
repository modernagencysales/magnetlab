# Hosted Content Page

Public Notion-like page at `/p/[username]/[slug]/content`. Renders polished lead magnet content with TOC, dark/light mode, video/Calendly embeds.

## Flow

Wizard → Extract → Funnel Content Tab → "Polish with AI" → Thank-you "Access Your [Title]" → `/p/.../content?leadId=xxx`

## Data

`lead_magnets.polished_content` (JSONB), `polished_at`. Block types: `paragraph`, `callout`, `list`, `quote`, `divider`.

## API

`POST /api/lead-magnet/[id]/polish` — AI polish, saves to DB. Auto-polish on first funnel publish if not yet polished.

## Calendly Gating

Calendly shown only for qualified leads (`funnel_leads.is_qualified`). Pass `leadId` in URL.

## Key Files

`src/components/content/` — ContentPageClient, PolishedContentRenderer, ContentBlocks, TableOfContents
