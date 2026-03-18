# Creator.io Library Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scrape 37 resources from Creator.io and import all content into magnetlab as a published library of `single-system` lead magnets.

**Architecture:** Three-phase pipeline — Playwright scraping → AI transformation → API import. Library client methods added to `packages/mcp/src/client.ts` for programmatic access to existing library API routes. No MCP tool registration (can be added later if agents need it).

**Tech Stack:** TypeScript, Playwright, Anthropic SDK (Claude), turndown (HTML→markdown)

**Spec:** `docs/superpowers/specs/2026-03-18-creator-io-library-migration-design.md`

---

## Overview (5 tasks)

| Task | What | Files |
|------|------|-------|
| 1 | Feature branch | git only |
| 2 | Library client methods | `packages/mcp/src/client.ts` |
| 3 | Scrape Creator.io | `scripts/migrate-creator-library.ts` |
| 4 | AI transform | `scripts/migrate-creator-library.ts` |
| 5 | Import + verify | `scripts/migrate-creator-library.ts` |

---

### Task 1: Create Feature Branch

**Files:** None (git only)

- [ ] **Step 1: Create branch from main**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git fetch origin
git checkout main
git pull origin main
git checkout -b feature/creator-migration
```

- [ ] **Step 2: Verify clean state**

```bash
pnpm install
pnpm typecheck
```

---

### Task 2: Library Client Methods

**Files:**
- Modify: `packages/mcp/src/client.ts`

Add methods to the `MagnetLabClient` class for calling the existing library API routes. These are internal client methods — no MCP tool definitions, handlers, or validation schemas needed.

- [ ] **Step 1: Add library client methods**

Add these methods to the `MagnetLabClient` class, after the existing funnel methods:

```typescript
  // ─── Libraries ──────────────────────────────────────────────────

  async createLibrary(params: {
    name: string;
    description?: string;
    icon?: string;
    slug?: string;
    autoFeatureDays?: number;
    teamId?: string;
  }) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId('/libraries', teamId);
    return this.request<{ library: unknown }>('POST', url, body);
  }

  async listLibraries(
    limit?: number,
    offset?: number,
    teamId?: string
  ) {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    const qs = params.toString();
    const path = qs ? `/libraries?${qs}` : '/libraries';
    const url = this.appendTeamId(path, teamId);
    return this.request<{ libraries: unknown[] }>('GET', url);
  }

  async getLibrary(id: string, teamId?: string) {
    const url = this.appendTeamId(`/libraries/${id}`, teamId);
    return this.request<{ library: unknown; items: unknown[] }>('GET', url);
  }

  async updateLibrary(
    id: string,
    params: {
      name?: string;
      description?: string | null;
      icon?: string;
      slug?: string;
      autoFeatureDays?: number;
      teamId?: string;
    }
  ) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId(`/libraries/${id}`, teamId);
    return this.request<{ library: unknown }>('PUT', url, body);
  }

  async deleteLibrary(id: string, teamId?: string) {
    const url = this.appendTeamId(`/libraries/${id}`, teamId);
    return this.request<{ success: boolean }>('DELETE', url);
  }

  async addLibraryItem(
    libraryId: string,
    params: {
      assetType: string;
      leadMagnetId?: string;
      externalResourceId?: string;
      iconOverride?: string;
      sortOrder?: number;
      isFeatured?: boolean;
      teamId?: string;
    }
  ) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId(`/libraries/${libraryId}/items`, teamId);
    return this.request<{ item: unknown }>('POST', url, body);
  }

  async removeLibraryItem(
    libraryId: string,
    itemId: string,
    teamId?: string
  ) {
    const url = this.appendTeamId(
      `/libraries/${libraryId}/items/${itemId}`,
      teamId
    );
    return this.request<{ success: boolean }>('DELETE', url);
  }

  async reorderLibraryItems(
    libraryId: string,
    items: Array<{ id: string; sortOrder: number }>,
    teamId?: string
  ) {
    const url = this.appendTeamId(
      `/libraries/${libraryId}/items/reorder`,
      teamId
    );
    return this.request<{ success: boolean }>('POST', url, { items });
  }
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsc --noEmit -p packages/mcp/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/client.ts
git commit -m "feat(mcp): add library client methods for programmatic API access"
```

---

### Task 3: Scrape Creator.io Resources

**Files:**
- Create: `scripts/migrate-creator-library.ts`
- Modify: `.gitignore` (add `scripts/data/`)

- [ ] **Step 1: Add `scripts/data/` to `.gitignore`**

```
scripts/data/
```

- [ ] **Step 2: Install turndown for HTML→markdown conversion**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
pnpm add -D turndown @types/turndown
```

- [ ] **Step 3: Create migration script with scraping phase**

Create `scripts/migrate-creator-library.ts`. The script accepts `--phase=scrape|transform|import` to run each phase independently.

**Resource list** (hardcoded):
```typescript
const RESOURCES = [
  { id: '695cda48a4cd5c57a94d95f7', title: "The 'No-Pitch' Teardown Framework", emoji: '🛠️', featured: true, order: 1 },
  { id: '695cd98cb3b4cbb9f9863d85', title: 'The $100k Case Study Breakdown', emoji: '📈', featured: true, order: 2 },
  { id: '695cd9f5b1cee85669d6b01e', title: "The Agency Founder's 'Sales-Led' Roadmap", emoji: '🗺️', featured: true, order: 3 },
  { id: '695cda480b1c93bdea089112', title: "The 'Agency Sales' Red Flag Guide", emoji: '🚩', featured: true, order: 4 },
  { id: '695cda34da68a299864b2094', title: "The 'Human' LinkedIn Automation SOP", emoji: '🤖', featured: true, order: 5 },
  { id: '695cda34d61559b0a8362db2', title: "The 'Agency Deal' Closing Checklist", emoji: '🏁', featured: true, order: 6 },
  { id: '695cda1d1c2f72d78f05a186', title: "The 'Safe to Pay' Brand Blueprint", emoji: '🛡️', featured: false, order: 7 },
  { id: '695cda0a5ffce4fd70776ab1', title: "The 'Incisive' Audit Template", emoji: '🔍', featured: false, order: 8 },
  { id: '695cda0a46957c861aad0f28', title: "The 'Zero-to-Owned' Pipeline Checklist", emoji: '✅', featured: false, order: 9 },
  { id: '695cda0a818c65689384d687', title: "The 'Smart' Agency Hiring Kit", emoji: '👥', featured: false, order: 10 },
  { id: '695cd9f5b1960dd4dbb9c8db', title: "The 'Authority' Content Calendar", emoji: '📅', featured: false, order: 11 },
  { id: '695cda1de1cc3bd0c39ccaa5', title: "The 'Referral-Free' Revenue Calculator", emoji: '🧮', featured: false, order: 12 },
  { id: '695cda1e4d4631d8589a2c4f', title: "The 'Operator's' Guide to Clay", emoji: '🧱', featured: false, order: 13 },
  { id: '695cda489d0dc1e97e394d4e', title: "The 'Founder-Led' Content Vault", emoji: '🔓', featured: false, order: 14 },
  { id: '695cda346169e7a5dbf94ea8', title: "The 'Referral to Pipeline' Transition Case Study", emoji: '📔', featured: false, order: 15 },
  { id: '695cda72e4f856d362cdcfa6', title: "The 'Complete' Sales Onboarding Kit", emoji: '📦', featured: false, order: 16 },
  { id: '695cda5cb6e61538649cfbb6', title: "The 'Operator to Owner' Time Audit", emoji: '⏳', featured: false, order: 17 },
  { id: '695cda5c29c1f6f9333ab90e', title: "The 'Irresistible' Agency Offer Framework", emoji: '💎', featured: false, order: 18 },
  { id: '695cda5c77b2fef5bfda311e', title: "The 'Agency Sales' Year-in-Review", emoji: '📅', featured: false, order: 19 },
  { id: '695cd9f569568151f89e614b', title: "The 'High-Ticket' LinkedIn Ad Blueprint", emoji: '🚀', featured: false, order: 20 },
  { id: '695cd9e22576ffaf36fa72c1', title: "The 'Inbound Momentum' Tracker", emoji: '📊', featured: false, order: 21 },
  { id: '695cd9e2e1a505efd60e042e', title: 'The 6-Figure LinkedIn Profile Audit', emoji: '🕵️', featured: false, order: 22 },
  { id: '695cd9e270cea8b44898294e', title: "The 'Stalled Deal' Hail Mary Kit", emoji: '⚡', featured: false, order: 23 },
  { id: '695cd9cc65a523664cf68835', title: "The 'Price Objection' Annihilator", emoji: '🛡️', featured: false, order: 24 },
  { id: '695cd9cc13408bfe42f99c8e', title: "The 'No-Guru' Sales Call Script", emoji: '🎙️', featured: false, order: 25 },
  { id: '695cd9ccf08846c7fc0fb20b', title: "The 'Lying on the Couch' Proposal Fix", emoji: '🛋️', featured: false, order: 26 },
  { id: '695cd9b83bc405769c490041', title: "The ROI of 'Smarter' Cold Email Kit", emoji: '🤖', featured: false, order: 27 },
  { id: '695cd9b8474b43bb38cf2b49', title: "The 'Always-On' Market Alerting Framework", emoji: '📢', featured: false, order: 28 },
  { id: '695cd9b846957c861aad0ef5', title: "The Agency Sales 'Tightrope' Audit", emoji: '⚖️', featured: false, order: 29 },
  { id: '695cd9a2f08846c7fc0fb1f3', title: "The 'One Question' DM Closing Script", emoji: '💬', featured: false, order: 30 },
  { id: '695cd9a2a0bb52ed1d4fd8aa', title: "The 'Ghost-Proof' Qualification Scorecard", emoji: '👻', featured: false, order: 31 },
  { id: '695cd9a2bfefe5b67f4cdc24', title: 'The 7-Figure Agency Sale Post-Mortem', emoji: '💰', featured: false, order: 32 },
  { id: '695cd98c7b6063439d430724', title: "The 'Always-On' Email Nurture System", emoji: '📧', featured: false, order: 33 },
  { id: '695cd98c0ef57bd42431dafa', title: "The 'No-Fluff' Agency Sales Stack", emoji: '🛠️', featured: false, order: 34 },
  { id: '695cd9757d45f2afd37b92ce', title: 'The LinkedIn Lead Magnet OS', emoji: '⚙️', featured: false, order: 35 },
  { id: '695cd97447a75394f23e8397', title: "The 'Referral Trap' Escape Blueprint", emoji: '⛓️', featured: false, order: 36 },
  { id: '695cd97461e951e2d359c65b', title: "The 20-Minute 'Incisive' Proposal Template", emoji: '📄', featured: false, order: 37 },
];
```

**Scraping approach:**
- Use `playwright` (already a dev dependency) to launch a headless browser
- For each resource: navigate to `https://app.getcreator.io/library-resource?id={id}`
- Wait for content to render (wait for `h1` element)
- Extract content using `page.evaluate()` to walk the DOM:
  - Find the main content container (the div after the title heading)
  - Find all H3 elements as section boundaries
  - For each section: collect all elements between that H3 and the next H3 (or end of content area)
  - Convert to markdown using turndown: tables, lists, blockquotes, checkboxes, bold/italic
  - Intro content = everything between the first decorative separator and the first H3
- Write JSON output to `scripts/data/creator-scraped.json`

**Intermediate format:**
```typescript
interface ScrapedResource {
  creatorId: string;
  title: string;
  emoji: string;
  readTime: string;
  isFeatured: boolean;
  sortOrder: number;
  introMarkdown: string;
  sections: Array<{
    heading: string;
    bodyMarkdown: string;
  }>;
}
```

- [ ] **Step 4: Run the scraping phase**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsx scripts/migrate-creator-library.ts --phase=scrape
```

Expected: `scripts/data/creator-scraped.json` with 37 entries.

- [ ] **Step 5: Spot-check scraped data**

Verify 2-3 resources: title matches, sections properly separated, markdown formatting preserved (tables, lists, bold, blockquotes), intro captured.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-creator-library.ts .gitignore package.json pnpm-lock.yaml
git commit -m "feat: add Creator.io migration script (scrape phase)"
```

---

### Task 4: AI Transform Phase

**Files:**
- Modify: `scripts/migrate-creator-library.ts`

- [ ] **Step 1: Add transform phase to the script**

The transform phase reads `creator-scraped.json` and for each resource:

1. Builds a prompt with the scraped content
2. Calls Claude API (`claude-sonnet-4-5-20250514` — fast and cheap for structured extraction)
3. AI generates the `single-system` schema fields that don't exist in the source:
   - `headline` — from the title, naming the pain or outcome
   - `subheadline` — optional supporting line
   - `problem_statement` — 2-3 sentences from intro paragraphs
   - `call_to_action` — clear next step
   - Per section: `component_name` (memorable name), `how_it_connects` (what it feeds into), `key_insight`
   - `proof_points` — quantified claims if present
4. Preserves original section `title` and `body` (markdown) faithfully — AI does NOT rewrite these
5. Validates: headline >= 10 chars, problem_statement >= 20 chars, call_to_action >= 5 chars, >= 3 sections, each body >= 50 chars
6. Saves to `scripts/data/creator-transformed.json`

**Prompt template:**
```
You are converting a scraped resource into a structured lead magnet format.

RESOURCE TITLE: {title}

INTRO CONTENT (before first section):
{introMarkdown}

SECTIONS:
{for each section: "### {heading}\n{markdown}"}

Generate a JSON object with these fields:
- headline: A compelling headline that names the pain or outcome (not the product name). Based on the title.
- subheadline: Optional one-line supporting text. null if not needed.
- problem_statement: 2-3 sentences making the reader feel understood. Extract from the intro content.
- proof_points: Array of quantified proof strings if any exist in the content. Empty array if none.
- call_to_action: A clear next step for the reader.
- sections: Array matching the source sections. For EACH section:
  - title: EXACTLY as provided (do not modify)
  - body: EXACTLY as provided (do not modify the markdown)
  - component_name: A memorable 2-4 word name for this component (not "Step 1")
  - how_it_connects: One sentence explaining what this component feeds into or receives from
  - key_insight: One sentence about the design decision that makes this work

RULES:
- Do NOT rewrite title or body fields — copy them EXACTLY from the input
- body must be at least 50 characters
- Minimum 3 sections required
- Return valid JSON only, no markdown code fences
```

- [ ] **Step 2: Run the transform phase**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsx scripts/migrate-creator-library.ts --phase=transform
```

Expected: `scripts/data/creator-transformed.json` with 37 entries conforming to the `single-system` content schema.

- [ ] **Step 3: Verify — check for validation failures**

The script should log any resources where validation fails (body too short, missing fields, etc.). Fix manually if needed.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-creator-library.ts
git commit -m "feat: add AI transform phase to migration script"
```

---

### Task 5: Import Phase + Run Migration

**Files:**
- Modify: `scripts/migrate-creator-library.ts`

- [ ] **Step 1: Add import phase to the script**

The import phase reads `creator-transformed.json` and uses the MCP client to call the existing magnetlab API:

```typescript
import { MagnetLabClient } from '../packages/mcp/src/client.js';

const client = new MagnetLabClient(
  process.env.MAGNETLAB_BASE_URL || 'https://magnetlab.app/api',
  process.env.MAGNETLAB_API_KEY!
);
```

**Import steps (in order):**

1. **Create library** — `client.createLibrary()`:
   - name: `"Gemini 3: Agency Sales System"`
   - description: `"(5M Dollar Swipefile)"`
   - icon: `"✨"`
   - autoFeatureDays: `0` (disabled — using manual is_featured)

2. **For each of the 37 resources** (sequentially):
   a. **Create lead magnet** — `client.request('POST', '/lead-magnet', { title, archetype: 'single-system', concept: { creatorIoId: resource.id } })`
   b. **Update content** — `client.request('PATCH', '/lead-magnet/${id}', { content: transformedContent, expected_version: 1 })`
   c. **Add to library** — `client.addLibraryItem(libraryId, { assetType: 'lead_magnet', leadMagnetId: id, iconOverride: emoji, sortOrder: order, isFeatured: featured })`

3. **Create funnel** — `client.request('POST', '/funnel', { slug: 'gemini-3-agency-sales-system', targetType: 'library', libraryId })`

4. **Publish funnel** — `client.request('POST', '/funnel/${funnelId}/publish', {})`

5. **Publish all lead magnets** — `client.request('PUT', '/lead-magnet/${id}', { status: 'published' })` for each

**Idempotency:** Before creating each lead magnet, list existing ones and skip any with matching title + archetype.

**Error handling:** Log each step. On failure, log the resource that failed and continue. Report success/failure counts at the end.

- [ ] **Step 2: Verify the script compiles**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsx --check scripts/migrate-creator-library.ts
```

- [ ] **Step 3: Commit import phase**

```bash
git add scripts/migrate-creator-library.ts
git commit -m "feat: add import phase to migration script"
```

- [ ] **Step 4: Run full migration**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
# Phase 1: Scrape (already done, skip if creator-scraped.json exists)
npx tsx scripts/migrate-creator-library.ts --phase=scrape

# Phase 2: Transform (already done, skip if creator-transformed.json exists)
npx tsx scripts/migrate-creator-library.ts --phase=transform

# Phase 3: Import
MAGNETLAB_API_KEY=<your-api-key> npx tsx scripts/migrate-creator-library.ts --phase=import
```

- [ ] **Step 5: Manual verification**

1. Open magnetlab dashboard → Library section → verify "Gemini 3: Agency Sales System" appears
2. Open 2-3 individual lead magnets → verify content renders with proper formatting (tables, lists, blockquotes)
3. Visit the public funnel page → verify library displays all 37 resources with correct icons and featured badges
4. Verify featured items (6) appear correctly

- [ ] **Step 6: Final commit**

```bash
git add scripts/migrate-creator-library.ts
git commit -m "feat: complete Creator.io library migration (37 resources imported)"
```

---

## Post-Migration

The feature branch contains:
1. Library client methods in `client.ts` (permanent — useful for future scripts/agents)
2. Migration script (keep for reference)
3. Scraped/transformed data files (gitignored)

Merge to main after verification.
