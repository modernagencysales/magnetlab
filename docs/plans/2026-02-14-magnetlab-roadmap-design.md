# MagnetLab Roadmap Design

**Date:** 2026-02-14
**Status:** Approved

## Context

Full product and code audit of MagnetLab identified the complete feature landscape, code quality gaps, and growth opportunities. This design captures the agreed roadmap with two key modifications from the original analysis:

1. **PDF export replaced** by rich content blocks + screenshot generation for LinkedIn post images
2. **Notion integration removed entirely** — self-hosted content pages are the delivery mechanism

## Phase 0 — Stabilization & Cleanup

Remove risk and dead code before building new features.

### Actions
1. Delete `/api/auth/debug/route.ts` (debug endpoint marked "remove in production")
2. Delete all LeadShark code: `lib/integrations/leadshark.ts`, all `/api/leadshark/` routes, component references
3. Replace ~212 `console.log/error` calls with structured logging via existing `lib/utils/logger.ts`
4. Sanitize pixel IDs in `PixelScripts.tsx` — validate numeric-only before `dangerouslySetInnerHTML`
5. Add React error boundaries to dashboard layout and wizard container

## Phase 1 — Notion Removal

Clean removal of unused Notion scaffolding.

### Database Migration
```sql
DROP VIEW IF EXISTS notion_connections_secure;
DROP FUNCTION IF EXISTS upsert_notion_connection;
DROP FUNCTION IF EXISTS get_notion_connection;
DROP TABLE IF EXISTS notion_connections CASCADE;
ALTER TABLE lead_magnets
  DROP COLUMN IF EXISTS notion_page_id,
  DROP COLUMN IF EXISTS notion_page_url;
```

### File Deletions
- `scripts/scrape-notion-pages.js`
- `scripts/push-notion-content.js`

### Documentation Updates
- CLAUDE.md — remove 3 Notion references
- README.md — remove 3 Notion references
- e2e/settings.spec.ts — remove Notion mock data and button test

### Risk: Near-zero
Table is empty, no active code references it.

## Phase 2 — Rich Content Block Types

Extend the content page with 5 new block types for richer lead magnets.

### New Block Types

| Type | Renders As | AI Generates? |
|------|-----------|--------------|
| `image` | `<img>` with caption, alt text | AI provides description; user uploads image |
| `embed` | iframe (YouTube/Loom/Vimeo auto-detect) | User adds manually via editor |
| `code` | Syntax-highlighted block (Shiki) | Yes — technical magnets |
| `table` | HTML table with headers + rows | Yes — comparisons, matrices |
| `accordion` | Expandable section | Yes — FAQ-style content |

### Data Shape

```typescript
type PolishedBlock =
  | { type: 'paragraph'; content: string; style?: string }
  | { type: 'callout'; content: string; style: 'info'|'warning'|'success' }
  | { type: 'list'; content: string }
  | { type: 'quote'; content: string }
  | { type: 'divider' }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'embed'; url: string; provider?: string }
  | { type: 'code'; content: string; language?: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'accordion'; title: string; content: string }
```

### Files Modified
- `src/lib/types/lead-magnet.ts` — extend PolishedBlock union
- `src/components/content/ContentBlocks.tsx` — new renderer cases
- `src/components/content/EditablePolishedContentRenderer.tsx` — new editor block types
- `src/lib/ai/lead-magnet-generator.ts` — update polish prompt with new block type instructions

## Phase 3 — Screenshot Generation for LinkedIn Posts

Auto-generate appealing preview images of content pages for LinkedIn post attachments.

### Architecture
- **Technology:** Playwright (already a production dependency)
- **Trigger:** On-demand from magnet detail page ("Generate Post Images" button)
- **Process:**
  1. Navigate headless browser to published content page URL
  2. Screenshot at multiple scroll positions:
     - Hero shot (top of page — title, summary, first section)
     - Section shots (one per content section — heading + first blocks)
  3. Crop to 1200x627 (LinkedIn single image) and 1080x1080 (carousel)
  4. Upload to Supabase Storage: `screenshots/{user_id}/{leadMagnetId}/hero.png`, `section-N.png`
  5. Return URLs to frontend

### Storage
- New JSONB column on `lead_magnets`: `screenshot_urls`
- Shape: `Array<{ type: 'hero'|'section'; sectionIndex?: number; url1200x627: string; url1080x1080: string }>`

### UI
- Gallery picker on magnet detail page — thumbnail grid of available screenshots
- Click to preview at LinkedIn dimensions
- Select image(s) when composing LinkedIn post (Step 5 of wizard or from content pipeline)

### API
- `POST /api/lead-magnet/[id]/screenshots` — triggers generation, returns URLs
- Auth required, rate-limited (Playwright is resource-intensive)

## Phase 4 — Analytics Dashboard

Build the analytics page that currently redirects to dashboard home.

### Metrics
- **Funnel analytics:** views, opt-ins, conversion rate by funnel (from `page_views` + `funnel_leads`)
- **Lead analytics:** leads over time, UTM source breakdown, qualification rate
- **Lead magnet performance:** which magnets drive the most leads
- **Content pipeline stats:** posts created/published/engagement

### Dashboard Home Redesign
- Replace placeholder cards with real metrics
- Show trends (this week vs last week)
- Quick action cards with contextual suggestions

## Phase 5 — Complete Unipile Migration

LeadShark is shutting down. Unipile replaces it.

### Actions
1. Verify Phase 1 (publishing via Unipile) in production
2. Build scheduling layer — Trigger.dev cron checks `cp_posting_slots`, publishes at scheduled times
3. Build comment monitoring engine — poll for comments, match automation rules, trigger DMs
4. Remove all LeadShark code (already started in Phase 0)
5. Simplify LinkedIn account connection UX in settings

## Phase 6 — Email Sequence Analytics

### Actions
1. Resend webhook handler — process delivered/opened/clicked/bounced events
2. Sequence analytics UI — open rate, click rate, bounce rate per email
3. Pre-built sequence templates (3-email, 5-email nurture flows)
4. Conditional emails based on qualification status

## Phase 7 — Testing & CI/CD

### Coverage Targets
- Critical path tests: Stripe webhook, lead capture, auth middleware, funnel publishing
- AI module tests: mock Anthropic/OpenAI, test prompt construction + response parsing
- Content pipeline tests: autopilot service, knowledge extraction, post writer
- E2E tests: wizard flow, funnel builder flow (Playwright already configured)
- GitHub Actions CI: lint + typecheck + tests on PR (branch mod-40 already started)

## Phase 8 — Team Permissions (RBAC)

### Actions
1. Admin vs Member role enforcement
2. Team-scoped content visibility
3. Activity log (who did what, when)
4. Invite flow polish — email invite, accept/decline, onboarding

## Phase 9 — Dependency Updates

### Priority Order
1. Anthropic SDK 0.30 → 0.74 (likely backward-compatible)
2. Stripe SDK 17.5 → 20.3 (test payment flows)
3. Next.js 15 → 16 (test App Router changes)
4. React 18 → 19 (dedicated sprint — useEffect changes, new hooks)
5. Tailwind 3 → 4 (separate project, major rewrite)

## Phase 10 — Polish & Growth

- Accessibility audit (ARIA labels, keyboard nav, focus traps, screen readers)
- Libraries feature completion
- Onboarding optimization (interactive tour)
- Billing enforcement (turn on usage_tracking gates when ready to monetize)
- Custom domains for funnel pages

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Playwright over @vercel/og for screenshots | Need real page screenshots, not generic cards. Playwright already installed. |
| Extend PolishedBlock over full block editor | Content is AI-generated, not hand-authored. Simple union extension is cleaner. |
| Remove Notion entirely | Self-hosted pages replace Notion. Zero active code to maintain. |
| Phase 0 before features | Can't build on shaky foundation — 212 console.logs, debug endpoint, dead code. |
