# MagnetLab Master Plan — UI Overhaul + Information Architecture Restructure

> **Target audience:** A developer who will execute this step-by-step
> **Repo:** `/Users/timlife/Documents/claude code/magnetlab`
> **Live mockup:** https://ui-mockup-six.vercel.app (toggle dark mode with bottom-right button)

### Reference Docs (read before starting)

| Doc | Location | What it provides |
|-----|----------|-----------------|
| `DESIGN_SYSTEM_PROMPT.md` | `/Users/timlife/Documents/ui-mockup/` | Visual spec: colors, spacing, typography, patterns, anti-patterns |
| `SHADCN_IMPLEMENTATION_GUIDE.md` | `/Users/timlife/Documents/ui-mockup/` | Technical translation: exact CSS values, tailwind config, component override code |
| `DEVELOPER_BRIEF.md` | `/Users/timlife/Documents/ui-mockup/` | Migration strategy, what's installed, QA checklist |
| `information-architecture.md` | `/docs/` (in repo) | Nav restructure: 10→7 items, section specs, route mapping |
| `wizard-redesign.md` | `/docs/` (in repo) | Wizard→Workspace: design principles, component disposition |
| `creation-flows.md` | `/docs/` (in repo) | Intent-based flows: 3 paths, CreationDialog spec, draft migration |

**Paste `DESIGN_SYSTEM_PROMPT.md` + `SHADCN_IMPLEMENTATION_GUIDE.md` into every AI session when working on UI.**

---

## Why This Order

The IA restructure (10→7 nav items, new sections, wizard→workspace) and the design system overhaul (Linear/Clarify-class styling) are done **together** because:

1. **Design system foundation first** — Replace CSS variables and shadcn overrides. The entire app auto-shifts colors/fonts because everything uses CSS variables. After this, the palette is correct even before restructuring.
2. **Build new things right the first time** — Every new component (BrainContent, ContentHub, AudienceContent, CreationDialog, workspace tabs) gets built with the new design system from the start. No restyling later.
3. **Restyle existing pages as you touch them** — When reorganizing components into new section containers, apply the new styling simultaneously. One pass, not two.

### Quick-Scan: All 8 Phases

| # | Phase | What Changes | Ship As |
|---|-------|-------------|---------|
| 1 | **Design System Foundation** | globals.css, tailwind.config, 9 shadcn overrides, 7 new UI primitives, 2 layout components | Ship with Phase 2 |
| 2 | **Navigation + Layout + Routes** | 220px sidebar, 10→7 nav items, route stubs, 10 redirects | "New look + simplified nav" |
| 3 | **Section Containers** | Brain (5 tabs), Posts (5 tabs), Pages (list), Audience (3 tabs), LM filters, Email update | "Unified sections" |
| 4 | **Workspace Enhancement** | Writable Content/Posts tabs, WhatsNext banner, tab indicators on MagnetDetail | Ship with Phase 5 |
| 5 | **Creation Flows** | CreationDialog, IdeationOverlay, feature-flagged wizard | "Wizard replacement" |
| 6 | **Page Restyling** | Settings, Email, Team, Help, funnel builder, global cleanup | "Full polish" (parallel with 3-5) |
| 7 | **Dashboard Refresh** | Brain Health, Recent Assets, Activity Feed | "Full polish" (after Phase 3) |
| 8 | **Migration + Cleanup + Polish** | Wizard draft migration, dead code removal, empty states, dark mode QA, responsive | "Cleanup" |

---

## Current Codebase State (Verified)

| Item | Status |
|------|--------|
| `/brain` route | Does NOT exist |
| `/content` route | EXISTS — redirects to `/knowledge` (will redirect to `/posts`) |
| `/pages` route | Does NOT exist |
| `/posts` route | Does NOT exist (old `/posts` redirected to `/content`) |
| `/audience` route | Does NOT exist |
| MagnetDetail tabs | 5: Overview, Funnel, Post (read-only), Leads, Analytics |
| PostsContent tabs | 5: Pipeline, Calendar, Ideas, Library, Autopilot |
| KnowledgeContent tabs | 2: AI Brain, Transcripts |
| DashboardNav | 10 main items |
| Email layout tabs | 3: Flows, Broadcasts, Subscribers |
| `lead_magnets.extraction_answers` | EXISTS (JSONB, initial schema) |
| CreationDialog | Does NOT exist |
| Sidebar width | 256px (needs → 220px) |

---

## Phase 1: Design System Foundation

**Goal:** Replace theme variables + override all shadcn components. After this, the entire app auto-shifts to the new palette/typography. No structural changes.

**Why first:** Everything else builds on this. CSS variables cascade everywhere.

### 1A. Replace `src/app/globals.css`

Replace the entire theme block with the values from `SHADCN_IMPLEMENTATION_GUIDE.md` §1:

**Light mode key values:**
- `--background: 0 0% 100%` (#FFFFFF)
- `--primary: 233 30% 63%` (#7B83C9 — pastel indigo accent)
- `--muted: 0 0% 98%` (#FAFAFA — sidebar)
- `--border: 0 0% 90%` (#E5E5E5)
- `--radius: 0.375rem` (6px)

**Dark mode key values:**
- `--background: 235 33% 10%` (#111120 — deep navy, NOT gray)
- `--primary: 233 40% 74%` (#9BA3E0)
- `--muted: 235 33% 8%` (#0D0D1A)
- `--border: 235 28% 20%` (#232340)

Add body styles:
```css
body {
  font-feature-settings: "rlig" 1, "calt" 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

Full replacement values are in `SHADCN_IMPLEMENTATION_GUIDE.md` §1.

### 1B. Update `tailwind.config.ts`

Add to `theme.extend`:

```ts
fontFamily: { sans: ["Inter", "system-ui", "-apple-system", "sans-serif"] },
fontSize: {
  "2xs": ["0.6875rem", { lineHeight: "1.2" }],   // 11px — tags, section labels
  xs: ["0.75rem", { lineHeight: "1.3" }],          // 12px — meta, timestamps
  sm: ["0.8125rem", { lineHeight: "1.4" }],        // 13px — body, nav, buttons (BASE)
  base: ["0.875rem", { lineHeight: "1.5" }],       // 14px — detail body
  lg: ["0.9375rem", { lineHeight: "1.4" }],        // 15px — section headings
  xl: ["1.25rem", { lineHeight: "1.3" }],          // 20px — page titles
  "2xl": ["1.5rem", { lineHeight: "1.3" }],        // 24px — dashboard title
},
spacing: {
  "nav-item": "2rem",       // 32px
  "btn": "2rem",            // 32px
  "row": "2.625rem",        // 42px
  "topbar": "3rem",         // 48px
  "sidebar": "13.75rem",    // 220px
},
colors: {
  status: { success: "hsl(153,30%,55%)", warning: "hsl(35,50%,56%)", error: "hsl(355,30%,62%)", info: "hsl(210,40%,63%)" },
  tag: {
    orange: { bg: "rgba(210,155,70,0.12)", text: "#A07840", dot: "#C4975A" },
    blue:   { bg: "rgba(107,159,212,0.12)", text: "#5A85AE", dot: "#7BAAD0" },
    green:  { bg: "rgba(94,173,137,0.12)", text: "#4A8E6E", dot: "#6BB895" },
    red:    { bg: "rgba(201,123,127,0.12)", text: "#9E5E62", dot: "#C08488" },
    purple: { bg: "rgba(148,130,206,0.12)", text: "#7A6BA8", dot: "#9B8CCE" },
    gray:   { bg: "rgba(130,130,148,0.12)", text: "#7A7A8E", dot: "#9A9AAE" },
  },
  avatar: {
    blue: "#7BAAD0", purple: "#9B8CCE", pink: "#C88BA8", amber: "#C4975A",
    teal: "#6DB5C4", red: "#C08488", green: "#6BB895",
  },
},
```

Remove/replace the existing `brand` purple palette.

Full values in `SHADCN_IMPLEMENTATION_GUIDE.md` §2.

### 1C. Override shadcn components in `src/components/ui/`

Override these files with the exact code from `SHADCN_IMPLEMENTATION_GUIDE.md` §3:

| File | Key Changes |
|------|-------------|
| `button.tsx` | `h-8` (32px), `gap-1.5`, `text-sm`. Sizes: default h-8, sm h-7, lg h-9, icon h-8. Remove large variants. |
| `card.tsx` | Remove `shadow-sm`. Border only: `rounded-lg border bg-card text-card-foreground`. |
| `badge.tsx` | Complete rewrite → tag system. Pastel colors with dot indicators, `h-[22px]`, `rounded-full`, `text-2xs`. 7 variants (default, orange, blue, green, red, purple, gray) + count variant. |
| `tabs.tsx` | Two variants: underline (default, for sections) + pill (for view switchers). |
| `table.tsx` | NO vertical borders, uppercase headers (`text-xs font-medium uppercase tracking-wider`), truncated cells (`max-w-[200px]`). |
| `input.tsx` | `h-8` (32px), `px-2.5`, `text-sm`. |
| `select.tsx` | SelectTrigger: `h-8 text-sm px-2.5`. |
| `dialog.tsx` | Overlay: `bg-black/40 dark:bg-black/60`. |
| `skeleton.tsx` | Keep as-is — inherits new colors. |

### 1D. Create custom UI primitives in `src/components/ui/`

Create these new files with the exact code from `SHADCN_IMPLEMENTATION_GUIDE.md` §4:

| File | Component | Purpose |
|------|-----------|---------|
| `nav-item.tsx` | `NavItem` | Sidebar nav item (icon, label, badge, active state, 32px height) |
| `section-label.tsx` | `SectionLabel` | 11px uppercase muted header for sidebar/lists |
| `list-row.tsx` | `ListRow` | Dense clickable row (42px, hover, active, border-bottom) |
| `property-group.tsx` | `PropertyGroup` | Label + value pair for detail sidebars |
| `empty-state.tsx` | `EmptyState` | Centered illustration + message (120px icon, 40% opacity) |
| `setting-row.tsx` | `SettingRow` | Icon + title + description + control (for settings pages) |
| `status-dot.tsx` | `StatusDot` | 8px colored circle for status indicators |

### 1E. Create layout components

**`src/components/layout/top-bar.tsx`** — 48px page header:
```tsx
function TopBar({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center h-12 px-6 border-b flex-shrink-0 gap-3">
      <h1 className="text-sm font-semibold">{title}</h1>
      <div className="ml-auto flex items-center gap-1">{children}</div>
    </div>
  )
}
```

**`src/components/layout/master-detail.tsx`** — Two-panel layout (list 320-400px + detail fills remaining).

### 1F. Global icon rule

Search and update all Lucide icon usage across the app:
- Default: `className="w-4 h-4" strokeWidth={1.5}`
- Settings/larger: `className="w-5 h-5" strokeWidth={1.5}`
- Current Lucide default strokeWidth is 2 — must be 1.5 everywhere.

**Verification:**
1. `npm run typecheck` passes
2. `npm run build` succeeds
3. Load any page — palette is correct in both light and dark mode
4. Dark mode background is navy (#111120), not gray/black
5. Cards have no shadows
6. Buttons are 32px height
7. Base text is 13px

---

## Phase 2: Navigation + Layout Shell + Routes

**Goal:** Replace the 10-item sidebar with 7 items, rebuild the sidebar to 220px spec, create route stubs and redirects.

### 2A. Rebuild sidebar in `DashboardNav.tsx`

Restyle the sidebar to match the design system:
- Width: `w-[220px] min-w-[220px]` (from current 256px)
- Background: `bg-muted` (#FAFAFA light / #0D0D1A dark)
- Use `NavItem` component (from Phase 1D)
- Use `SectionLabel` for group headers
- Padding: `p-2`

Replace `mainNav` array:
```typescript
const mainNav = [
  { href: '/',         label: 'Home',         icon: Home },
  { href: '/brain',    label: 'Brain',        icon: Brain },
  { href: '/magnets',  label: 'Lead Magnets', icon: Magnet },
  { href: '/pages',    label: 'Pages',        icon: Globe },
  { href: '/posts',    label: 'Posts',        icon: PenTool },
  { href: '/email/flows', label: 'Email',     icon: Mail, activePrefix: '/email' },
  { href: '/audience', label: 'Audience',      icon: Users },
];
```

Bottom nav:
```typescript
const bottomNav = [
  { href: '/team',     label: 'Team',     icon: UsersRound },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help',     label: 'Help',     icon: HelpCircle },
];
```

Update "Create New" dropdown to 6 items:
```typescript
const createItems = [
  { label: 'Lead Magnet', icon: Magnet,    route: '/magnets?create=1',              color: 'violet' },
  { label: 'Post',        icon: PenTool,   route: '/posts?quick_write=1',           color: 'blue' },
  { label: 'Page',        icon: Globe,     route: '/pages?create=1',                color: 'amber' },
  { label: 'Transcript',  icon: FileAudio, route: '/brain?tab=transcripts&upload=1', color: 'emerald' },
  // separator
  { label: 'Library',     icon: BookOpen,  route: '/magnets?create=library',        color: 'gray' },
];
```

**Key file:** `src/components/dashboard/DashboardNav.tsx`

### 2B. Update dashboard layout

Apply the AppShell pattern to the dashboard layout:
```tsx
<div className="flex h-screen overflow-hidden">
  <aside className="w-[220px] min-w-[220px] h-screen overflow-y-auto border-r bg-muted p-2 flex flex-col">
    {/* Sidebar */}
  </aside>
  <main className="flex-1 flex flex-col overflow-hidden min-w-0">
    {children}
  </main>
</div>
```

**Key file:** `src/app/(dashboard)/layout.tsx`

### 2C. Create route stubs

```
src/app/(dashboard)/brain/page.tsx     → temporary passthrough rendering KnowledgeContent
src/app/(dashboard)/posts/page.tsx     → render PostsContent (moved from /content)
src/app/(dashboard)/pages/page.tsx     → landing pages/funnels list
src/app/(dashboard)/audience/page.tsx  → placeholder with basic tabs shell
```

### 2D. Add redirects for old routes

In `src/middleware.ts` or `next.config.js` redirects array:

| Old Route | New Route |
|-----------|-----------|
| `/knowledge` | `/brain` |
| `/content` | `/posts` |
| `/posts?tab=ideas` | `/brain?tab=ideas` |
| `/leads` | `/audience?tab=leads` |
| `/signals` | `/audience?tab=signals` |
| `/automations` | `/audience?tab=signals` |
| `/create` | `/magnets?create=1` |
| `/assets` | `/magnets?filter=all` |
| `/email/subscribers` | `/audience?tab=contacts` |

**Key files:** `src/middleware.ts`, `next.config.js`

**Verification:**
1. Sidebar shows 7 main items + 3 bottom items
2. Sidebar is 220px wide
3. Nav items are 32px height with thin-stroke icons
4. Every old URL redirects correctly (no 404s)
5. `/brain`, `/posts`, `/pages`, `/audience` all load (even if temporary passthrough)
6. `npm run typecheck` passes

---

## Phase 3: Section Containers

**Goal:** Build the tabbed section containers for Brain, Content, and Audience. Each new component uses the new design system from the start.

### 3A. Build Brain section (`/brain`)

Create `src/components/brain/BrainContent.tsx` — 5 tabs using underline tab variant:

| Tab ID | Label | Component | Source |
|--------|-------|-----------|--------|
| `overview` | Overview | `KnowledgeOverview` | KnowledgeDashboard > Overview subtab |
| `transcripts` | Transcripts | Transcript list | KnowledgeContent "Transcripts" tab |
| `knowledge` | Knowledge | `KnowledgeSearch` | KnowledgeDashboard > Search subtab |
| `topics` | Topics | `TopicBrowser` + `GapAnalysis` | KnowledgeDashboard subtabs |
| `ideas` | Ideas | `IdeasTab` | PostsContent "Ideas" tab |

Use `TopBar` component for the page header. Reuse existing components — don't rewrite.

Add action buttons to idea cards (if missing on `IdeasTab`):
- "Create Lead Magnet" → `/magnets?create=1&fromIdea={ideaId}`
- "Write Post" → triggers `write-post-from-idea`, navigates to `/posts?tab=pipeline`

**Key files:**
- Create: `src/components/brain/BrainContent.tsx`
- Update: `src/app/(dashboard)/brain/page.tsx` (replace stub)
- Modify: `src/components/content-pipeline/IdeasTab.tsx` (add action buttons if missing)
- Reuse: `KnowledgeOverview`, `KnowledgeSearch`, `TopicBrowser`, `GapAnalysis`, transcript list

### 3B. Build Posts section (`/posts`)

Create `src/components/posts/PostsHub.tsx` — 5 tabs:

| Tab ID | Label | Component | Source |
|--------|-------|-----------|--------|
| `command-center` | Command Center | `TeamCommandCenter` | Currently buried in old Posts |
| `pipeline` | Pipeline | Pipeline view | Old `/posts?tab=pipeline` |
| `calendar` | Calendar | Calendar view | Old `/posts?tab=calendar` |
| `autopilot` | Autopilot | Autopilot view | Old `/posts?tab=autopilot` |
| `library` | Library | Library view | Old `/posts?tab=library` |

**Command Center is the first tab** (per IA doc — daily driver for teams).

Handle `?quick_write=1` URL param → opens QuickWriteModal.

**Key files:**
- Create: `src/components/posts/PostsHub.tsx`
- Update: `src/app/(dashboard)/posts/page.tsx` (render PostsHub)
- Reuse: `TeamCommandCenter`, Pipeline/Calendar/Autopilot/Library from `PostsContent`

### 3B2. Build Pages section (`/pages`)

Create `src/components/pages/PagesContent.tsx` — 3 filter tabs (pill variant):

| Tab | Filter | Source |
|-----|--------|--------|
| All Pages | All landing pages + funnels | Existing page/funnel data |
| Landing Pages | Standalone opt-in pages | Filter by type |
| Funnels | Multi-step funnels | Filter by type |

Each row shows: status dot, page title, Published/Draft badge, visit count, conversion rate, last updated.

Action button: "+ New Page" → opens page creation flow.

**Key files:**
- Create: `src/components/pages/PagesContent.tsx`
- Update: `src/app/(dashboard)/pages/page.tsx` (render PagesContent)
- Reuse: existing funnel/page data from `lead_magnets` where applicable

### 3C. Build Audience section (`/audience`)

Create `src/components/audience/AudienceContent.tsx` — 3 tabs:

| Tab ID | Label | Component | Source |
|--------|-------|-----------|--------|
| `contacts` | Contacts | `SubscriberTable` (initial — unified view later) | `/email/subscribers` |
| `leads` | Leads | `LeadsTable` | `/leads` |
| `signals` | Signals | `SignalLeadsTable` + inline monitor config | `/signals` + `/automations` + `/settings/signals` |

**Signals tab:** Merge `SignalLeadsTable` + `AutomationEditor` + `KeywordMonitors` + `CompanyMonitors`. Add "Configure Monitors" button/panel for inline monitor config (currently in `/settings/signals`).

**Key files:**
- Create: `src/components/audience/AudienceContent.tsx`
- Update: `src/app/(dashboard)/audience/page.tsx` (replace stub)
- Reuse: `SubscriberTable`, `LeadsTable`, `SignalLeadsTable`, `AutomationEditor`, monitor editors

### 3D. Update Lead Magnets list

Add filter tabs to `MagnetsListClient.tsx`:
```
┌─ All ─┬─ Lead Magnets ─┬─ Libraries ─┬─ External ─┐
```

Use pill tab variant. Query libraries from `/api/libraries`, external resources from `/api/external-resources`. Show type badge per row using the new `Badge` component.

**Key files:** `src/components/magnets/MagnetsListClient.tsx`, `src/app/(dashboard)/magnets/page.tsx`

### 3E. Update Email layout

Remove "Subscribers" tab from Email layout. Email becomes 2 tabs: Flows, Broadcasts.

**Key file:** `src/app/(dashboard)/email/layout.tsx`

### 3F. Restyle touched components

As you reorganize each component into its new container, apply the design system simultaneously:
- Replace hardcoded colors with CSS variables
- Apply `text-sm` (13px) base, `text-xs` (12px) meta, `text-2xs` (11px) tags
- Apply dense spacing (32px buttons, 42px list rows)
- Remove card shadows
- Use `Badge` variants for status indicators
- Apply `ListRow` for list items where applicable
- Icons: `w-4 h-4 strokeWidth={1.5}`

**Verification:**
1. `/brain` shows 5 tabs, all content renders correctly
2. `/posts` shows 5 tabs, Command Center is first
3. `/pages` shows landing pages and funnels list with filter tabs
4. `/audience` shows 3 tabs
5. `/magnets` list shows filter tabs for asset types
6. `/email` has 2 tabs (no Subscribers)
6. All components use new design system (no old styling)
7. Light and dark mode both look correct
8. `npm run test` passes
9. `npm run typecheck` passes

---

## Phase 4: Workspace Enhancement

**Goal:** Transform lead magnet detail page (`/magnets/[id]`) into a full workspace with writable Content and Posts tabs. Apply design system styling.

**Why before creation flows:** Creation flows land users on this workspace. It must be ready first.

### 4A. Add Content tab to MagnetDetail

Add `content` tab to `TABS` array in `MagnetDetail.tsx`, positioned first:

```typescript
const TABS = [
  { id: 'content',   label: 'Content',   icon: FileText },
  { id: 'overview',  label: 'Overview',  icon: Sparkles },
  { id: 'funnel',    label: 'Funnel',    icon: Globe },
  { id: 'post',      label: 'Posts',     icon: PenSquare },  // renamed
  { id: 'leads',     label: 'Leads',     icon: Users },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];
```

Use underline tab variant. Apply `TopBar` for the page header.

### 4B. Build writable Content tab

Create `src/components/magnets/workspace/ContentTab.tsx` with 3 states:

**State A: Empty** (no `extracted_content`) — Show 3 options:
- "Extract from your expertise" → opens extraction Q&A
- "Write it yourself" → blank editor
- "Import existing content" → paste/upload

Use `EmptyState` component for the empty view.

**State B: Extraction in progress** — Refactor `ExtractionStep.tsx` into standalone `ContentExtractor.tsx`:
- Chat-like Q&A, answers persist to `lead_magnets.extraction_answers` via debounced PUT
- **Knowledge Base pre-fill**: `searchKnowledgeV2()` shows top 2-3 suggestions per question
- User can switch tabs and return (answers persisted)

**State C: Content ready** (`extracted_content` exists) — Refactor `ContentStep.tsx` into standalone `ContentEditor.tsx`:
- Section-by-section inline editor, add/remove/reorder
- "Regenerate" button, interactive archetype editors inline
- Auto-saves to `lead_magnets.extracted_content`

**Key files to create:**
- `src/components/magnets/workspace/ContentTab.tsx`
- `src/components/magnets/workspace/ContentExtractor.tsx` (from `ExtractionStep.tsx`)
- `src/components/magnets/workspace/ContentEditor.tsx` (from `ContentStep.tsx`)

**Key files to reference:** `ExtractionStep.tsx`, `ContentStep.tsx`, `InteractiveContentStep.tsx`, `knowledge-brain.ts`

### 4C. Enhance Posts tab (make writable)

Create `src/components/magnets/workspace/PostsTab.tsx`:

**State A: No posts** — Two actions:
- "Generate Promotional Posts" (requires `extracted_content`) → calls `POST /api/lead-magnet/write-post`, non-blocking
- "Write Teaser Post" (always available) → opens `QuickWriteModal` pre-filled, creates `cp_pipeline_posts` record

**State B: Posts generated** — Show ALL variations:
- Post text with hook type labels, quality badges
- **"Send to Content Pipeline" button** → `POST /api/content-pipeline/posts { draft_content, content_type: 'lead_magnet', lead_magnet_id, status: 'draft' }`
- Copy, Regenerate All, DM template display

**Key files:** Create `PostsTab.tsx`. Reference `PostStep.tsx`, `QuickWriteModal.tsx`.

### 4D. WhatsNext banner

Create `src/components/magnets/workspace/WhatsNextBanner.tsx`:

| State | Banner | Action |
|-------|--------|--------|
| No content/posts/funnel | "Create your content →" | Switch to Content tab |
| Has content, no posts | "Generate posts →" | Switch to Posts tab |
| Has content + posts, no funnel | "Build landing page →" | Switch to Funnel tab |
| Everything done | Hidden | — |
| Dismissed | Hidden (localStorage per-magnet) | — |

### 4E. Tab status indicators

- `•` = in progress, `✓` = complete, (blank) = not started
- Content: `extractedContent` → ✓, `extraction_answers` has entries → •
- Posts: `post_variations` exists → ✓
- Funnel: published → ✓, draft → •
- Leads: count > 0 → count badge

### 4F. Simplify Overview tab

- DM template moves to Posts tab
- Concept details become collapsible
- Keep: editable title, pain point, archetype badge, quick stats, status

### 4G. Restyle entire MagnetDetail

Apply design system to the workspace:
- 48px `TopBar` with lead magnet title + status badge
- Underline tabs
- Dense spacing throughout
- Cards with border, no shadow
- All text follows typography scale

**Verification:**
1. New lead magnets show Content tab with empty state
2. Extraction Q&A works standalone, KB pre-fill shows suggestions
3. Content editor renders and edits `extracted_content`
4. Posts tab generates and shows all variations
5. "Send to Pipeline" creates `cp_pipeline_posts` visible at `/posts?tab=pipeline`
6. WhatsNext banner shows/dismisses correctly
7. Tab indicators reflect state
8. Existing wizard-created lead magnets still render correctly
9. Design system applied (no old styling)
10. `npm run test` passes

---

## Phase 5: Creation Flows

**Goal:** Replace the 6-step wizard with intent-based creation flows. Feature-flag the old wizard.

### 5A. Feature-flag the old wizard

Add `NEXT_PUBLIC_LEGACY_WIZARD=true` env variable.

In `DashboardNav.tsx` "Lead Magnet" create action:
- `LEGACY_WIZARD=true` → `/create` (old wizard)
- Otherwise → `/magnets?create=1` (new flow)

Keep all wizard code intact.

### 5B. Build CreationDialog

Create `src/components/magnets/CreationDialog.tsx` — dialog on `/magnets` page.

Opens when: `?create=1` URL param, "+ New" button, "Create New > Lead Magnet" from sidebar.

**Returning user** (has `brand_kits.business_description`):
- AI Suggestions from `cp_content_ideas` where `content_type = 'lead_magnet'` and `status = 'extracted'`
- Manual entry: Title + Archetype dropdown + Create button
- "Generate more ideas..." link

**First-time user** (no brand kit):
- 3 quick fields: business description, type, top 3 pains → saves to `brand_kits`
- Then "Generate Ideas" → IdeationOverlay
- Manual "I know what I want" path always available

**From Brain idea** (`?create=1&fromIdea={ideaId}`):
- Pre-fills title + pain from `cp_content_ideas`
- User MUST select archetype (ideas have NO archetype column)

On Create: `POST /api/lead-magnet { title, archetype }` → navigate to `/magnets/[id]`

Style the dialog with the new design system — compact inputs, 32px buttons, no card shadows.

### 5C. Build IdeationOverlay

Create `src/components/magnets/IdeationOverlay.tsx` — full-page overlay (not modal).

Refactor concept cards from `IdeationStep.tsx`:
- 10 concepts with viral check scores, recommendation badges
- "Create from This Idea" button per card
- Non-blocking: if user closes during generation, it continues in background (saves to `brand_kits.saved_ideation_result`)
- Banner on `/magnets` when generation completes

Use `ListRow` or card patterns with design system styling.

### 5D. Wire Create New dropdown actions

| Dropdown Item | Action |
|---------------|--------|
| Lead Magnet | `/magnets?create=1` |
| Post | `/posts?quick_write=1` (opens QuickWriteModal) |
| Page | `/pages?create=1` (opens page creation flow) |
| Transcript | `/brain?tab=transcripts&upload=1` (auto-opens upload) |
| Library | `/magnets?create=library` |

### 5E. Wire Brain → Creation bridge

On Ideas tab (`BrainContent` > Ideas):
- "Create Lead Magnet" on idea cards → `/magnets?create=1&fromIdea={ideaId}`
- "Write Post" on idea cards → triggers `write-post-from-idea`, navigates to `/posts?tab=pipeline`
- "Create Page" on idea cards → `/pages?create=1&fromIdea={ideaId}`

**Key files:**
- Create: `src/components/magnets/CreationDialog.tsx`
- Create: `src/components/magnets/IdeationOverlay.tsx`
- Refactor from: `src/components/wizard/steps/IdeationStep.tsx`
- Modify: `src/app/(dashboard)/magnets/page.tsx`, `MagnetsListClient.tsx`

**Verification:**
1. Creation dialog opens from sidebar, list page, and `?create=1`
2. First-time user: 3 fields → generate → ideation overlay → pick → workspace
3. Returning user: suggestions + manual entry + generate more
4. Brain idea → Create Lead Magnet pre-fills correctly
5. Non-blocking ideation works (close during generation, banner on completion)
6. Old wizard accessible via feature flag
7. `npm run test` passes

---

## Phase 6: Existing Page Restyling

**Goal:** Apply the design system to all pages not touched in Phases 2-5.

### 6A. Settings pages

Apply `SettingRow` component throughout settings:
- `AccountSettings.tsx` — use SettingRow for profile, username, subscription sections
- `BrandingSettings.tsx` — use SettingRow for each branding card
- `IntegrationsSettings.tsx` — use SettingRow for each integration
- `CopilotMemorySettings.tsx` — use SettingRow for memory list
- `DeveloperSettings.tsx` — use SettingRow for API keys, webhooks
- Settings sidebar (`SettingsNav.tsx`): use NavItem component, 180px width, section labels

Also:
- Remove Team Members section from `AccountSettings.tsx` (canonical at `/team`, add "Manage your team →" link)
- Remove/redirect Settings > Signals page (`/settings/signals` → `/audience?tab=signals`)

### 6B. Email section

Restyle `/email/flows` and `/email/broadcasts`:
- Use `TopBar` for page headers
- Use `Table` overrides for list views (no vertical borders, uppercase headers)
- Use `Badge` variants for flow/broadcast status
- Cards: border only, no shadow
- Dense spacing throughout

### 6C. Team page

- Use `TopBar`, `ListRow` for member list
- Dense member cards with avatar colors from design system
- 32px action buttons

### 6D. Help page

- Use `TopBar`
- Apply typography scale to guide content

### 6E. Funnel builder

Apply design system to the funnel builder UI:
- Dense controls, 32px buttons
- Card sections with border, no shadow
- Apply typography scale

### 6F. Global cleanup pass

Search the entire codebase for:
- `shadow-sm`, `shadow-md` on non-floating elements → remove
- Hardcoded color hex values → replace with CSS variables
- `strokeWidth={2}` on Lucide icons → change to `1.5`
- Font sizes outside the scale → standardize
- Buttons larger than 36px → reduce to 32px max
- `ring-2` focus states → change to `ring-1`
- Card shadows → remove (keep only on dropdowns/popovers/modals)

**Verification:**
1. Every page matches the design system
2. Settings pages use SettingRow pattern
3. No card shadows anywhere except floating elements
4. Dark mode correct on all pages (navy bg, not gray)
5. One accent color throughout
6. Side-by-side compare with mockup (https://ui-mockup-six.vercel.app)

---

## Phase 7: Dashboard Refresh

**Goal:** Transform home dashboard into actionable guide. Can be done in parallel with Phase 6.

### 7A. Brain Health section (top)

Create `src/components/dashboard/BrainHealthCard.tsx`:
- Knowledge entry count, topic count, last updated
- Strong topics list
- Contextual CTA based on state:
  - Brain empty → "Add a transcript to get started"
  - Brain thin (<10 entries) → "Add more knowledge"
  - Brain rich, no lead magnets → "Create a lead magnet"
  - Has assets, not published → "Publish your lead magnet"
  - Everything live → "Check performance"

Data from: `cp_knowledge_entries`, `cp_knowledge_topics`, `cp_call_transcripts`

### 7B. Recent Assets section (middle)

Create `src/components/dashboard/RecentAssetsCard.tsx`:
- Last 3-4 lead magnets: title, archetype badge, status, conversion rate, lead count
- "Open workspace →" quick action
- "Create lead magnet" CTA button

### 7C. Activity Feed (bottom)

Create `src/components/dashboard/ActivityFeed.tsx`:
- New leads captured (which lead magnet)
- Posts published (engagement if available)
- Transcripts processed
- Funnels published/updated

Use `ListRow` for feed items, relative timestamps.

### 7D. De-emphasize vanity metrics

Remove or collapse current stat tiles (27 Lead Magnets, 588 Page Views, etc.). Replace with Brain Health + Recent Assets + Activity Feed.

Apply design system: `TopBar`, card borders (no shadow), `Badge` variants, dense spacing, pastel colors.

**Key files:** `src/app/(dashboard)/page.tsx` + 3 new dashboard components

**Verification:**
1. Dashboard shows Brain Health with accurate stats
2. CTA adapts based on user state
3. Recent Assets shows correct data
4. Activity feed shows recent events
5. No vanity metric tiles dominating the view

---

## Phase 8: Migration + Cleanup + Polish

**Goal:** Migrate wizard drafts, remove dead code, final polish pass.

### 8A. Migrate wizard drafts

Write SQL migration processing `extraction_sessions`:
- Skip Step 1-only sessions (no `selectedConceptIndex` AND no `customConcept`)
- Promote Step 2+: create `lead_magnets` record with concept data
- Bridge Step 5 posts: create `cp_pipeline_posts` records
- Edge cases: duplicate titles (append " (Draft)"), NULL team_id (lookup from `team_memberships`)

See `/docs/creation-flows.md` §Migration for pseudocode.

Keep `extraction_sessions` as backup for 30 days.

### 8B. Remove wizard components (when feature flag off)

**Delete:**
- `WizardContainer.tsx`, `WizardProgress.tsx`, `GeneratingScreen.tsx`
- `PublishStep.tsx`, `ContextStep.tsx`, `CustomIdeaStep.tsx`
- `DraftPicker.tsx`, `useWizardAutoSave.ts`
- `src/app/api/wizard-draft/route.ts`
- `src/app/(dashboard)/create/page.tsx` → redirect to `/magnets?create=1`

**Keep until workspace components are stable:**
- `ExtractionStep.tsx`, `ContentStep.tsx`, `InteractiveContentStep.tsx`, `PostStep.tsx`, `IdeationStep.tsx`
- Then delete once workspace equivalents are confirmed stable.

### 8C. Clean up dead routes

**Delete:** `/library/`, `/swipe-file/`, `/catalog/`, `/analytics/` (all have redirects)

### 8D. Empty states

Create sketch-style illustrations (monochrome, 40% opacity, ~120px) for:
- Brain with no transcripts
- Lead Magnets with no magnets
- Posts with no posts
- Pages with no pages
- Audience with no contacts/leads
- Email with no flows

Use `EmptyState` component from Phase 1D.

### 8E. Loading states

Add subtle skeleton loading (inherits design system colors) to:
- Dashboard cards
- List views
- Tab content loading

### 8F. Dark mode QA pass

Test every page in dark mode. Check:
- Background is navy (#111120), not gray/black
- Borders have blue tint
- Tag colors are slightly brighter (higher opacity backgrounds)
- Text colors are warm, readable
- Charts use dark mode chart palette
- No white flashes on navigation

### 8G. Responsive check

- Sidebar collapses at narrow widths
- Tables scroll horizontally
- Master-detail stacks to single panel
- Dashboard single column on mobile

**Verification:**
1. All wizard drafts migrated (verify in DB)
2. No broken imports after deletion
3. All old URLs redirect correctly
4. Empty states render on fresh accounts
5. Loading skeletons appear during data fetch
6. Dark mode correct on every page
7. `npm run test` passes
8. `npm run build` succeeds

---

## Phase Dependencies

```
Phase 1 (Design System Foundation)
  │
  ▼
Phase 2 (Nav + Layout + Routes)
  │
  ├──────────────────────┐
  ▼                      ▼
Phase 3 (Sections)    Phase 6 (Page Restyling) ← can run in parallel
  │                      │
  ▼                      │
Phase 4 (Workspace)      │
  │                      │
  ▼                      │
Phase 5 (Creation Flows) │
  │                      │
  ├──────────────────────┘
  ▼
Phase 7 (Dashboard) ← can start after Phase 3
  │
  ▼
Phase 8 (Migration + Cleanup + Polish)
```

**Shippable releases:**
- Phases 1+2: "New look + simplified nav" — immediate visual impact
- Phase 3: "Unified sections" — Brain, Content, Audience
- Phases 4+5: "Wizard replacement" — workspace + creation flows
- Phases 6+7: "Full polish" — restyled pages + new dashboard
- Phase 8: "Cleanup" — migration + dead code removal

---

## Critical Rules (Reference During Every Phase)

### Colors
- **ONE accent color**: pastel indigo (#7B83C9 light / #9BA3E0 dark)
- **All status/tag colors are pastel** — desaturated, mixed with gray
- **Dark mode background is navy** (#111120), NOT gray, NOT black

### Spacing & Density
- Nav items: 32px height | Buttons: 32px (36px max) | List rows: 40-48px | Top bar: 48px | Sidebar: 220px

### Shadows
- Cards: NO shadow (border only) | Dropdowns/popovers/modals: shadow OK

### Typography
- Base: 13px (text-sm) | Section labels: 11px uppercase (text-2xs) | Page titles: 20px (text-xl) | Meta: 12px (text-xs)

### Icons
- Always: `className="w-4 h-4" strokeWidth={1.5}` | Settings: `w-5 h-5 strokeWidth={1.5}`

### Anti-Patterns (Never Do)
1. Card shadows on non-floating elements
2. Gradients on backgrounds/buttons/surfaces
3. Rounded corners > 12px
4. Buttons > 36px height
5. Saturated primary colors (#FF0000 etc.)
6. Pure black (#000000) for dark mode
7. More than ONE accent color
8. Vertical borders in tables
9. Modals when inline editing works

---

## Files Summary

### New Files (by phase)

| Phase | Files |
|-------|-------|
| 1 | `nav-item.tsx`, `section-label.tsx`, `list-row.tsx`, `property-group.tsx`, `empty-state.tsx`, `setting-row.tsx`, `status-dot.tsx`, `top-bar.tsx`, `master-detail.tsx` |
| 2 | `brain/page.tsx`, `posts/page.tsx`, `pages/page.tsx`, `audience/page.tsx` |
| 3 | `BrainContent.tsx`, `PostsHub.tsx`, `PagesContent.tsx`, `AudienceContent.tsx` |
| 4 | `workspace/ContentTab.tsx`, `workspace/ContentExtractor.tsx`, `workspace/ContentEditor.tsx`, `workspace/PostsTab.tsx`, `workspace/WhatsNextBanner.tsx` |
| 5 | `CreationDialog.tsx`, `IdeationOverlay.tsx` |
| 7 | `BrainHealthCard.tsx`, `RecentAssetsCard.tsx`, `ActivityFeed.tsx` |

### Modified Files (key ones)

| File | Phase | Change |
|------|-------|--------|
| `globals.css` | 1 | Replace all theme variables |
| `tailwind.config.ts` | 1 | Add fontSize, spacing, colors |
| `button.tsx`, `card.tsx`, `badge.tsx`, `tabs.tsx`, `table.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx` | 1 | Override to design system |
| `DashboardNav.tsx` | 2 | 7-item nav + 220px sidebar + Create New dropdown |
| `layout.tsx` (dashboard) | 2 | AppShell pattern |
| `middleware.ts` | 2 | Route redirects |
| `MagnetDetail.tsx` | 4 | Add Content tab, enhance Posts, add banner, restyle |
| `MagnetsListClient.tsx` | 3+5 | Filter tabs + creation dialog trigger |
| `email/layout.tsx` | 3 | Remove Subscribers tab |
| `IdeasTab.tsx` | 3 | Add action buttons |
| `AccountSettings.tsx` | 6 | Remove team members section, apply SettingRow |
| `page.tsx` (dashboard) | 7 | Dashboard redesign |

### Deleted Files (Phase 8, after feature flag period)

`WizardContainer.tsx`, `WizardProgress.tsx`, `GeneratingScreen.tsx`, `PublishStep.tsx`, `ContextStep.tsx`, `CustomIdeaStep.tsx`, `DraftPicker.tsx`, `useWizardAutoSave.ts`, `wizard-draft/route.ts`

---

## What Does NOT Change

- All API routes (same paths, same behavior)
- Public pages (`/p/[username]/[slug]`)
- Database schema (no new tables, only wizard draft migration)
- External API routes (`/api/external/*`)
- Funnel builder logic (restyled only)
- Email sequence builder (restyled only)
- Stripe billing
- Webhook handlers
- AI modules (reused, not rewritten)

---

## Testing Strategy

After each phase:
1. `npm run typecheck` — no type errors
2. `npm run test` — all 225+ tests pass
3. `npm run build` — production build succeeds
4. Manual: every page reachable, no 404s
5. Manual: old bookmarked URLs redirect
6. Manual: dark mode looks correct (navy bg)
7. Manual: side-by-side compare with mockup

Per-phase QA checklist (from DEVELOPER_BRIEF.md):
- [ ] Matches mockup visual feel
- [ ] Light mode correct
- [ ] Dark mode correct (navy bg)
- [ ] Only ONE accent color visible
- [ ] No card shadows
- [ ] All buttons 32px height
- [ ] Tags use pastel palette with dot indicators
- [ ] Text truncates properly
- [ ] Hover states subtle (bg change only)
- [ ] Icons 16px with thin strokes
- [ ] Timestamps relative
- [ ] No regressions on existing functionality
