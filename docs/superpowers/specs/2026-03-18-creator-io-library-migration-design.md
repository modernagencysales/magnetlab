# Creator.io Library Migration to Magnetlab

**Date:** 2026-03-18
**Status:** Draft
**Scope:** Scrape 37 resources from Creator.io, transform into magnetlab lead magnets, assemble into a library, publish as live replacement.

## Context

Tim's "Gemini 3: Agency Sales System (5M Dollar Swipefile)" library is currently hosted on Creator.io at `app.getcreator.io/resources?id=695c1c7cbfd0842c2b9349fa`. It contains 37 resources — structured frameworks, SOPs, guides, and templates for agency sales. The goal is to migrate all content into magnetlab as a published library of lead magnets, replacing Creator.io entirely.

## Source Data

**Library metadata:**
- Title: "Gemini 3: Agency Sales System"
- Subtitle: "(5M Dollar Swipefile)"
- 6 featured ("New") resources, 31 regular resources
- Each resource has: emoji icon, title, read time, rich long-form content

**Individual resource structure (verified via scraping):**
- H3-level numbered sections (typically 4-6 per resource)
- Rich formatting: tables, bullet lists, ordered lists, blockquotes with callout icons, checkboxes, bold/italic, scripts in quotes
- Comparison tables, case studies, checklists
- CTA section at bottom (not migrated — magnetlab has its own funnel system)

**Resource IDs (Creator.io):**

| # | Title | Creator.io ID | Featured |
|---|-------|---------------|----------|
| 1 | The 'No-Pitch' Teardown Framework | 695cda48a4cd5c57a94d95f7 | Yes |
| 2 | The $100k Case Study Breakdown | 695cd98cb3b4cbb9f9863d85 | Yes |
| 3 | The Agency Founder's 'Sales-Led' Roadmap | 695cd9f5b1cee85669d6b01e | Yes |
| 4 | The 'Agency Sales' Red Flag Guide | 695cda480b1c93bdea089112 | Yes |
| 5 | The 'Human' LinkedIn Automation SOP | 695cda34da68a299864b2094 | Yes |
| 6 | The 'Agency Deal' Closing Checklist | 695cda34d61559b0a8362db2 | Yes |
| 7 | The 'Safe to Pay' Brand Blueprint | 695cda1d1c2f72d78f05a186 | No |
| 8 | The 'Incisive' Audit Template | 695cda0a5ffce4fd70776ab1 | No |
| 9 | The 'Zero-to-Owned' Pipeline Checklist | 695cda0a46957c861aad0f28 | No |
| 10 | The 'Smart' Agency Hiring Kit | 695cda0a818c65689384d687 | No |
| 11 | The 'Authority' Content Calendar | 695cd9f5b1960dd4dbb9c8db | No |
| 12 | The 'Referral-Free' Revenue Calculator | 695cda1de1cc3bd0c39ccaa5 | No |
| 13 | The 'Operator's' Guide to Clay | 695cda1e4d4631d8589a2c4f | No |
| 14 | The 'Founder-Led' Content Vault | 695cda489d0dc1e97e394d4e | No |
| 15 | The 'Referral to Pipeline' Transition Case Study | 695cda346169e7a5dbf94ea8 | No |
| 16 | The 'Complete' Sales Onboarding Kit | 695cda72e4f856d362cdcfa6 | No |
| 17 | The 'Operator to Owner' Time Audit | 695cda5cb6e61538649cfbb6 | No |
| 18 | The 'Irresistible' Agency Offer Framework | 695cda5c29c1f6f9333ab90e | No |
| 19 | The 'Agency Sales' Year-in-Review | 695cda5c77b2fef5bfda311e | No |
| 20 | The 'High-Ticket' LinkedIn Ad Blueprint | 695cd9f569568151f89e614b | No |
| 21 | The 'Inbound Momentum' Tracker | 695cd9e22576ffaf36fa72c1 | No |
| 22 | The 6-Figure LinkedIn Profile Audit | 695cd9e2e1a505efd60e042e | No |
| 23 | The 'Stalled Deal' Hail Mary Kit | 695cd9e270cea8b44898294e | No |
| 24 | The 'Price Objection' Annihilator | 695cd9cc65a523664cf68835 | No |
| 25 | The 'No-Guru' Sales Call Script | 695cd9cc13408bfe42f99c8e | No |
| 26 | The 'Lying on the Couch' Proposal Fix | 695cd9ccf08846c7fc0fb20b | No |
| 27 | The ROI of 'Smarter' Cold Email Kit | 695cd9b83bc405769c490041 | No |
| 28 | The 'Always-On' Market Alerting Framework | 695cd9b8474b43bb38cf2b49 | No |
| 29 | The Agency Sales 'Tightrope' Audit | 695cd9b846957c861aad0ef5 | No |
| 30 | The 'One Question' DM Closing Script | 695cd9a2f08846c7fc0fb1f3 | No |
| 31 | The 'Ghost-Proof' Qualification Scorecard | 695cd9a2a0bb52ed1d4fd8aa | No |
| 32 | The 7-Figure Agency Sale Post-Mortem | 695cd9a2bfefe5b67f4cdc24 | No |
| 33 | The 'Always-On' Email Nurture System | 695cd98c7b6063439d430724 | No |
| 34 | The 'No-Fluff' Agency Sales Stack | 695cd98c0ef57bd42431dafa | No |
| 35 | The LinkedIn Lead Magnet OS | 695cd9757d45f2afd37b92ce | No |
| 36 | The 'Referral Trap' Escape Blueprint | 695cd97447a75394f23e8397 | No |
| 37 | The 20-Minute 'Incisive' Proposal Template | 695cd97461e951e2d359c65b | No |

## Target Schema

All 37 resources use the `single-system` archetype with this content structure:

```typescript
interface SingleSystemContent {
  headline: string;           // From title/opening — names the pain or outcome
  subheadline?: string;       // Optional supporting line
  problem_statement: string;  // 2-3 sentences from intro paragraphs
  proof_points?: string[];    // Quantified proof if present in source
  call_to_action: string;     // Clear next step for the reader
  sections: Array<{
    title: string;            // Section heading (from H3)
    body: string;             // Rich text as markdown — tables, lists, blockquotes preserved
    component_name: string;   // Memorable name for this component (AI-generated)
    how_it_connects: string;  // What this feeds into or receives from (AI-generated)
    key_insight?: string;     // The design decision that makes this work (AI-generated)
  }>;
}
```

## Design

### Phase 1: Scrape (Playwright script)

A Node.js script using Playwright programmatically (not the CLI) to:

1. Navigate to each of the 37 resource URLs: `https://app.getcreator.io/library-resource?id={id}`
2. Wait for JS rendering to complete
3. Extract the content DOM: title, emoji, read time, all section content
4. Convert rich HTML content to markdown per section (preserving tables, lists, blockquotes, checkboxes, bold/italic)
5. Write intermediate JSON to `scripts/data/creator-scraped.json`

**Intermediate format:**
```typescript
interface ScrapedResource {
  creatorId: string;
  title: string;
  emoji: string;
  readTime: string;
  isFeatured: boolean;
  sortOrder: number;
  sections: Array<{
    heading: string;
    htmlContent: string;  // Raw HTML of section
    markdown: string;     // Converted markdown
  }>;
  introContent: string;  // Content before first H3 (intro paragraphs)
}
```

### Phase 2: Transform (AI)

For each scraped resource, call Claude API to generate the `single-system` schema fields:

**Input:** The scraped resource JSON (title, intro, sections with markdown body)

**AI generates:**
- `headline` — derived from the title and opening
- `problem_statement` — extracted/synthesized from intro paragraphs
- `call_to_action` — contextually appropriate CTA
- Per section: `component_name`, `how_it_connects`, `key_insight`
- `proof_points` — if quantified claims exist in the source

**AI preserves (does not rewrite):**
- Section `title` — kept from source H3 headings
- Section `body` — original markdown content, faithfully preserved

**Output:** `scripts/data/creator-transformed.json` — array of 37 schema-compliant objects

**Validation gate:** Before proceeding to import, run each transformed resource against the `single-system` Zod publish schema (`src/lib/schemas/archetypes/single-system.ts`) to catch issues. The `body` field has a 50-character minimum — if any section body falls below this after markdown conversion, pad with surrounding context or merge with an adjacent section.

### Phase 3: Import (API calls + new MCP tools)

#### Step 3a: Add Library MCP tools

The library API exists (`/api/libraries/*`) but has no MCP tool exposure. Add these tools to `packages/mcp/src/tools/libraries.ts`:

| Tool | Parameters | Description |
|------|-----------|-------------|
| `magnetlab_create_library` | name, description?, icon?, slug?, auto_feature_days? | Create a new library |
| `magnetlab_list_libraries` | limit?, offset? | List user's libraries |
| `magnetlab_get_library` | id | Get library with items |
| `magnetlab_update_library` | id, name?, description?, icon?, slug?, auto_feature_days? | Update library metadata |
| `magnetlab_delete_library` | id | Delete library |
| `magnetlab_add_library_item` | library_id, asset_type, lead_magnet_id?, external_resource_id?, icon_override?, sort_order?, is_featured? | Add item to library |
| `magnetlab_remove_library_item` | library_id, item_id | Remove item from library |
| `magnetlab_reorder_library_items` | library_id, items: Array<{id, sort_order}> | Batch reorder items |

These follow the existing MCP tool patterns in `packages/mcp/src/tools/lead-magnets.ts` and `funnels.ts`. The handlers must map MCP `snake_case` parameter names to the API's `camelCase` (e.g., `asset_type` → `assetType`), consistent with how `handleFunnelTools` does it.

**Files to create:**
- `packages/mcp/src/tools/libraries.ts` — tool definitions (schemas)
- `packages/mcp/src/handlers/libraries.ts` — tool handlers

**Files to modify:**
- `packages/mcp/src/tools/index.ts` — import and spread `libraryTools`
- `packages/mcp/src/handlers/index.ts` — import `handleLibraryTools` and register in `handlerMap`
- `packages/mcp/src/client.ts` — add client methods for library CRUD

#### Step 3b: Import script

**Authentication:** The script uses the MCP tools (which authenticate via API key) for lead magnet operations, and calls the magnetlab API directly with the same API key for library operations (using the new library MCP tools once they exist).

**Content field:** All content writes use the MCP v2 unified `content` JSONB field via `PATCH /api/lead-magnet/{id}` (deep-merge with `content_version` optimistic locking) — NOT the legacy `polished_content` field or `PUT` endpoint.

**Idempotency:** Each created lead magnet stores `creator_io_id` in its concept metadata. Before creating, the script checks if a lead magnet with that `creator_io_id` already exists and skips it. This allows safe re-runs if the script fails partway through.

The migration script:

1. **Create library first** — `POST /api/libraries` with name "Gemini 3: Agency Sales System", description "(5M Dollar Swipefile)"
2. **Create 37 lead magnets** — `POST /api/lead-magnet` for each with title + archetype `single-system` + concept containing `creator_io_id`
3. **Update content** — `PATCH /api/lead-magnet/{id}` with the transformed content for each (writes to `content` JSONB field)
4. **Add library items** — `POST /api/libraries/{id}/items` for each lead magnet with correct `sort_order`, `is_featured` (for the 6 featured items), and `icon_override` (emoji)
5. **Create funnel** — `POST /api/funnel` with `{ slug, targetType: 'library', libraryId }` (no `leadMagnetId` — the funnel targets the library)
6. **Publish funnel** — call funnel publish endpoint
7. **Set lead magnets to published** — update each to `status: 'published'` (done AFTER library + funnel setup so the library page is ready when content goes live)

**Note on featured items:** The 6 "New resources" from Creator.io use `is_featured = true` (manual pin) rather than relying on `added_at` + `auto_feature_days`, since all 37 items will have the same `added_at` timestamp. The `auto_feature_days` can be set to 0 to disable auto-featuring.

**Note on viewability:** Lead magnets are viewable ONLY through the library page (one funnel targeting the library). Individual lead magnets do NOT get their own funnel pages — the library IS the access point.

### Data Mapping

| Creator.io | Magnetlab Field | Method |
|---|---|---|
| Library title | `libraries.name` | Direct copy |
| "(5M Dollar Swipefile)" | `libraries.description` | Direct copy |
| Resource emoji | `library_items.icon_override` | Direct copy |
| "New resources" section | `library_items.is_featured = true` | Map 6 featured items |
| Resource order on page | `library_items.sort_order` | Preserve order (1-37) |
| Resource title | `lead_magnets.title` | Direct copy |
| Intro paragraphs | `content.problem_statement` | AI extraction |
| Resource title | `content.headline` | AI derivation |
| H3 sections | `content.sections` | Parse + AI metadata |
| Section rich text | `content.sections[].body` | HTML → markdown conversion |
| N/A | `content.sections[].component_name` | AI generation |
| N/A | `content.sections[].how_it_connects` | AI generation |
| Bottom CTA | Not migrated | Magnetlab funnel handles this |

## File Locations

| File | Purpose |
|------|---------|
| `scripts/migrate-creator-library.ts` | Main migration script (scrape + transform + import) |
| `scripts/data/creator-scraped.json` | Intermediate scraped data (gitignored) |
| `scripts/data/creator-transformed.json` | Transformed data ready for import (gitignored) |
| `packages/mcp/src/tools/libraries.ts` | New MCP tool definitions |
| `packages/mcp/src/handlers/libraries.ts` | New MCP tool handlers |
| `packages/mcp/src/tools/index.ts` | Modified — register library tools |
| `packages/mcp/src/handlers/index.ts` | Modified — register library handlers |
| `packages/mcp/src/client.ts` | Modified — add library client methods |

## Out of Scope

- CTA/opt-in form migration (magnetlab funnel system replaces this)
- Analytics/click count migration from Creator.io
- Email sequences tied to the old library
- Creator.io account deletion or redirect setup
- Individual funnel pages per lead magnet (library page is the only access point)
