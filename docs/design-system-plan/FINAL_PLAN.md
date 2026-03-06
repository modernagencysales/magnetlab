# MagnetLab Design System — Final Implementation Plan

> **Purpose:** Pure design system build — tokens, components, patterns, enforcement.
> **Scope:** Everything needed to make the UI consistent before any IA/route restructure.
> **Reference mockup:** https://ui-mockup-six.vercel.app
> **Design language:** Linear / Clarify / Kondo — dense, professional, pastel, power-user

---

## Current State (Problems)

| Problem | Severity | Evidence |
|---------|----------|----------|
| Saturated purple accent (#8b5cf6) | CRITICAL | globals.css `--primary: 258 90% 66%` |
| Dark mode is neutral gray, not navy | CRITICAL | `.dark --background: 240 10% 3.9%` |
| Card shadows everywhere | HIGH | `shadow`, `shadow-sm` in button, card, outline variants |
| No typography scale (13px base missing) | HIGH | No custom fontSize in tailwind.config.ts |
| 729+ buttons with mixed styling | HIGH | Raw `<button>` with inline classes + `<Button>` component |
| 167 hardcoded hex colors | HIGH | Scattered `#XXXX` and `bg-[...]` across components |
| 132+ raw `<input>` elements | MEDIUM | Some use `Input` component, others raw HTML |
| No tag/badge color system | MEDIUM | Default shadcn badge, no pastel variants |
| No density tokens (spacing) | MEDIUM | No spacing constants for nav-item, row, btn heights |
| Icons at default strokeWidth 2 | LOW | Lucide default, should be 1.5 |
| Missing components | HIGH | No select, textarea, switch, checkbox, popover, scroll-area overrides |
| No composite patterns | HIGH | No form-field, data-table, combobox, command components |
| No a11y enforcement | MEDIUM | No focus-visible strategy, no ARIA patterns documented |
| No component documentation | LOW | No storybook, no usage examples |

---

## What We're Building

### Layer 1: Design Tokens
CSS variables (globals.css) + Tailwind config extensions = the foundation everything inherits.

### Layer 2: Base Components (shadcn overrides)
Override every shadcn primitive to match the spec. These are the atoms.

### Layer 3: Custom Primitives
New components that don't exist in shadcn but are needed everywhere.

### Layer 4: Composite Components
Higher-level patterns built from base + primitives (form fields, data tables, etc.).

### Layer 5: Layout Components
Page-level layout patterns (app shell, top bar, master-detail).

### Layer 6: Enforcement
ESLint rules + Tailwind plugin to prevent regression.

---

## Phase 1: Design Tokens

**Goal:** Replace CSS variables and extend Tailwind. After this, every existing component using CSS variables auto-shifts to the new palette.

### 1A. Replace `src/app/globals.css`

Replace the entire `:root` and `.dark` blocks. Keep utility classes (scrollbar-hide, animate-slide-in).

**Light mode key changes:**
```
--background: 0 0% 100%          (unchanged)
--primary: 233 30% 63%           (#7B83C9 pastel indigo — was 258 90% 66%)
--muted: 0 0% 98%                (#FAFAFA)
--border: 0 0% 90%               (#E5E5E5)
--radius: 0.375rem               (6px — was 0.5rem/8px)
--card: 0 0% 100%                (#FFFFFF — was gray-tinted)
--destructive: 355 30% 62%       (#C97B7F pastel — was 0 84% 60%)
```

**Dark mode key changes:**
```
--background: 235 33% 10%        (#111120 deep navy — was 240 10% 3.9% gray)
--primary: 233 40% 74%           (#9BA3E0 — was same saturated purple)
--muted: 235 33% 8%              (#0D0D1A — was neutral gray)
--border: 235 28% 20%            (#232340 blue-tinted — was neutral)
--card: 235 30% 12%              (#16162A — was neutral)
--secondary: 235 30% 15%         (#1A1A30 — was neutral)
```

**Add body styles:**
```css
body {
  font-feature-settings: "rlig" 1, "calt" 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

Full CSS: see `SHADCN_IMPLEMENTATION_GUIDE.md` §1.

### 1B. Update `tailwind.config.ts`

Add to `theme.extend`:

```ts
fontSize: {
  "2xs": ["0.6875rem", { lineHeight: "1.2" }],   // 11px — tags, section labels
  xs:    ["0.75rem",   { lineHeight: "1.3" }],    // 12px — meta, timestamps
  sm:    ["0.8125rem", { lineHeight: "1.4" }],    // 13px — body, nav, buttons (BASE)
  base:  ["0.875rem",  { lineHeight: "1.5" }],    // 14px — detail body
  lg:    ["0.9375rem", { lineHeight: "1.4" }],    // 15px — section headings
  xl:    ["1.25rem",   { lineHeight: "1.3" }],    // 20px — page titles
  "2xl": ["1.5rem",    { lineHeight: "1.3" }],    // 24px — dashboard title
},
spacing: {
  "nav-item": "2rem",       // 32px
  "btn": "2rem",            // 32px
  "row": "2.625rem",        // 42px
  "topbar": "3rem",         // 48px
  "sidebar": "13.75rem",    // 220px
},
colors: {
  status: {
    success: "hsl(153, 30%, 55%)",
    warning: "hsl(35, 50%, 56%)",
    error: "hsl(355, 30%, 62%)",
    info: "hsl(210, 40%, 63%)",
  },
  tag: {
    orange: { bg: "rgba(210,155,70,0.12)", text: "#A07840", dot: "#C4975A" },
    blue:   { bg: "rgba(107,159,212,0.12)", text: "#5A85AE", dot: "#7BAAD0" },
    green:  { bg: "rgba(94,173,137,0.12)",  text: "#4A8E6E", dot: "#6BB895" },
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

**Remove:** the existing `brand` purple palette (50-900).

### 1C. Verification

1. `npm run typecheck` passes
2. `npm run build` succeeds
3. Load any page — palette shifts automatically (colors correct even if spacing/components off)
4. Dark mode background is navy (#111120), not gray
5. Accent color is pastel indigo, not saturated purple

---

## Phase 2: Base Component Overrides (shadcn)

**Goal:** Override every shadcn component to match the design system. Each override is a self-contained file edit.

### Component Override Inventory

| # | Component | File | Key Changes | Priority |
|---|-----------|------|-------------|----------|
| 1 | **Button** | `ui/button.tsx` | h-8 (32px), gap-1.5, remove all `shadow`/`shadow-sm`, add `icon-sm` size | P0 |
| 2 | **Card** | `ui/card.tsx` | Remove `shadow-sm`, border-only | P0 |
| 3 | **Input** | `ui/input.tsx` | h-8 (32px), px-2.5, text-sm, ring-1 focus | P0 |
| 4 | **Badge** | `ui/badge.tsx` | Complete rewrite → tag system with 7 pastel variants + dot + count | P0 |
| 5 | **Tabs** | `ui/tabs.tsx` | Two variants: underline (default) + pill | P0 |
| 6 | **Dialog** | `ui/dialog.tsx` | Overlay bg-black/40 dark:bg-black/60, compact padding | P1 |
| 7 | **Table** | `ui/table.tsx` | No vertical borders, uppercase headers, truncated cells | P1 |
| 8 | **Dropdown Menu** | `ui/dropdown-menu.tsx` | Compact items (h-8), text-sm, shadow-md on content | P1 |
| 9 | **Separator** | `ui/separator.tsx` | Keep as-is (inherits --border) | P2 |
| 10 | **Skeleton** | `ui/skeleton.tsx` | Keep as-is (inherits new colors) | P2 |
| 11 | **Tooltip** | `ui/tooltip.tsx` | Keep as-is | P2 |
| 12 | **Sheet** | `ui/sheet.tsx` | Compact padding, overlay opacity | P1 |
| 13 | **Sonner** | `ui/sonner.tsx` | Bottom-right, compact styling | P2 |
| 14 | **Sidebar** | `ui/sidebar.tsx` | 220px width, section labels, compact nav | P0 |

### New shadcn Components to Install

These don't exist yet and need to be added via `npx shadcn@latest add`:

| # | Component | File | Purpose | Priority |
|---|-----------|------|---------|----------|
| 1 | **Select** | `ui/select.tsx` | h-8 trigger, text-sm, px-2.5 | P0 |
| 2 | **Textarea** | `ui/textarea.tsx` | text-sm, px-2.5, min-h-[80px] | P0 |
| 3 | **Checkbox** | `ui/checkbox.tsx` | 16px, rounded-sm, accent color | P1 |
| 4 | **Radio Group** | `ui/radio-group.tsx` | 16px, accent color | P1 |
| 5 | **Switch** | `ui/switch.tsx` | 40px wide, 22px tall, accent color | P1 |
| 6 | **Popover** | `ui/popover.tsx` | shadow-md, border, compact padding | P1 |
| 7 | **Scroll Area** | `ui/scroll-area.tsx` | Thin scrollbar, subtle track | P2 |
| 8 | **Avatar** | `ui/avatar.tsx` | 5 sizes (xs-xl), pastel fallback colors, hash-based | P1 |
| 9 | **Toggle** | `ui/toggle.tsx` | h-8, text-sm | P2 |
| 10 | **Toggle Group** | `ui/toggle-group.tsx` | Segmented control pattern | P2 |
| 11 | **Command** | `ui/command.tsx` | Command palette / combobox base | P2 |
| 12 | **Progress** | `ui/progress.tsx` | 4px height, accent color | P2 |
| 13 | **Accordion** | `ui/accordion.tsx` | Compact, no outer border | P2 |
| 14 | **Alert** | `ui/alert.tsx` | Pastel status colors, border-l-2 | P2 |
| 15 | **Breadcrumb** | `ui/breadcrumb.tsx` | text-xs, muted, chevron separator | P2 |

### Detailed Override Specs

#### Button
```
- Remove: shadow, shadow-sm from all variants
- Default size: h-8 px-3.5 text-sm (was h-9 px-4)
- sm size: h-7 px-2.5 text-xs
- lg size: h-9 px-4 text-sm (cap at 36px)
- icon size: h-8 w-8 (was h-9 w-9)
- Add: icon-sm size: h-7 w-7
- Change gap: gap-1.5 (was gap-2)
- Ghost variant: text-muted-foreground hover:bg-secondary hover:text-foreground
- Outline variant: remove shadow-sm
```

#### Badge (Tag System)
```
- Base: inline-flex items-center gap-1 rounded-full px-2 py-0 text-2xs font-medium h-[22px]
- 7 color variants: default (blue), orange, blue, green, red, purple, gray
- Each: pastel bg (12% opacity) + desaturated text color
- count variant: bg-secondary text-muted-foreground min-w-[20px] h-5 justify-center
- Usage with dot: <Badge variant="green"><span className="w-2 h-2 rounded-full bg-tag-green-dot" />Active</Badge>
```

#### Tabs (Dual Variant)
```
Underline (default):
- TabsList: bg-transparent border-b rounded-none h-auto p-0 gap-0
- TabsTrigger: border-b-2 border-transparent active:border-foreground text-sm font-medium

Pill (for view switchers):
- TabsList: bg-transparent h-auto p-0 gap-0.5
- TabsTrigger: border rounded-md px-2.5 py-1 text-sm active:bg-background
```

#### Table
```
- TableHead: text-xs font-medium uppercase tracking-wider px-3 py-2 text-muted-foreground
- TableCell: text-sm px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]
- TableRow: border-b border-border/50 hover:bg-secondary/50
- NO vertical borders anywhere
```

### Verification

1. Every shadcn component matches the spec
2. `npm run typecheck` passes
3. Button height is 32px, no shadows
4. Cards have no shadows
5. Badge shows pastel tags with dot indicators
6. Tabs have both underline and pill variants
7. Tables have no vertical borders, uppercase headers

---

## Phase 3: Custom Primitives

**Goal:** Build reusable atomic components that don't exist in shadcn. These are the building blocks for every page.

### Primitive Inventory

| # | Component | File | Purpose | Props |
|---|-----------|------|---------|-------|
| 1 | **NavItem** | `ui/nav-item.tsx` | Sidebar nav link | `icon, label, badge?, active?, indented?, href, onClick?` |
| 2 | **SectionLabel** | `ui/section-label.tsx` | Uppercase muted group header | `children, className?` |
| 3 | **ListRow** | `ui/list-row.tsx` | Dense clickable row (42px) | `children, active?, onClick?, className?` |
| 4 | **PropertyGroup** | `ui/property-group.tsx` | Label + value pair | `label, children, className?` |
| 5 | **EmptyState** | `ui/empty-state.tsx` | Centered illustration + CTA | `icon, title, description?, action?` |
| 6 | **SettingRow** | `ui/setting-row.tsx` | Icon + title + desc + control | `icon, title, description, children` |
| 7 | **StatusDot** | `ui/status-dot.tsx` | 8px colored circle | `status: 'success' \| 'warning' \| 'error' \| 'info' \| 'neutral'` |
| 8 | **PageTitle** | `ui/page-title.tsx` | Consistent page heading | `children, className?` |
| 9 | **Kbd** | `ui/kbd.tsx` | Keyboard shortcut indicator | `children` |
| 10 | **Spinner** | `ui/spinner.tsx` | Loading indicator (max 20px) | `size?: 'sm' \| 'md', className?` |
| 11 | **Truncate** | `ui/truncate.tsx` | Text truncation with tooltip | `children, maxWidth?, className?` |
| 12 | **RelativeTime** | `ui/relative-time.tsx` | Relative timestamp display | `date: Date \| string, className?` |
| 13 | **DotSeparator** | `ui/dot-separator.tsx` | Inline dot between items | `className?` |
| 14 | **IconWrapper** | `ui/icon-wrapper.tsx` | Standardized icon container | `icon: LucideIcon, size?: 'sm' \| 'md' \| 'lg'` |

### Detailed Specs

#### NavItem
```tsx
// 32px height, icon + label + optional badge
// Active: bg-accent text-accent-foreground
// Inactive: text-muted-foreground hover:bg-secondary hover:text-foreground
// Indented: pl-9 (for child items)
// Icon: w-4 h-4 strokeWidth={1.5}, inherits color
// Badge: uses Badge count variant, ml-auto
```

#### ListRow
```tsx
// 42px min-height, border-bottom, hover:bg-secondary/50
// Active: bg-accent
// Cursor pointer
// px-6 py-2
// Children layout: flex items-center gap-2
```

#### EmptyState
```tsx
// Centered vertically + horizontally
// Icon area: 120px, text-muted-foreground/40
// Title: text-sm font-medium mt-4
// Description: text-xs text-muted-foreground mt-1
// Action: optional Button, mt-4
// Min height: 300px
```

#### SettingRow
```tsx
// Flex row with icon (w-5 h-5), title+desc, and control slot
// px-6 py-[18px] border-b border-border/50 last:border-b-0
// Title: text-sm font-medium
// Description: text-xs text-muted-foreground
// Control: flex-shrink-0 ml-auto
```

#### StatusDot
```tsx
// 8px circle (w-2 h-2 rounded-full)
// Colors from status.* palette
// Optional pulse animation for "active" states
```

#### RelativeTime
```tsx
// Renders: "2h", "3d", "9 days ago", "Feb 23", "Nov 12, 2024"
// text-xs text-muted-foreground
// Tooltip shows full date on hover
// Auto-updates every minute for recent times
```

### Verification

1. All 14 primitives exported from their respective files
2. Each has TypeScript props interface
3. Each works in both light and dark mode
4. `npm run typecheck` passes

---

## Phase 4: Composite Components

**Goal:** Build higher-level patterns from base + primitive components. These reduce duplication across pages.

### Composite Inventory

| # | Component | File | Purpose | Built From |
|---|-----------|------|---------|------------|
| 1 | **FormField** | `ui/form-field.tsx` | Label + input + error + description | Input/Select/Textarea + label + error text |
| 2 | **DataTable** | `ui/data-table.tsx` | Sortable, filterable table wrapper | Table + TableHead sorting + pagination |
| 3 | **SearchInput** | `ui/search-input.tsx` | Input with search icon + clear button | Input + Search icon + X icon |
| 4 | **ConfirmDialog** | `ui/confirm-dialog.tsx` | Destructive action confirmation | Dialog + Button (cancel/confirm) |
| 5 | **FilterBar** | `ui/filter-bar.tsx` | Horizontal filter controls | Tabs (pill) + SearchInput + Button |
| 6 | **StatCard** | `ui/stat-card.tsx` | Metric display card | Card + number + label + trend |
| 7 | **AvatarGroup** | `ui/avatar-group.tsx` | Overlapping avatars | Avatar + count overflow |
| 8 | **ActionMenu** | `ui/action-menu.tsx` | Three-dot menu with actions | DropdownMenu + MoreHorizontal icon |
| 9 | **DateDisplay** | `ui/date-display.tsx` | Formatted date with relative tooltip | RelativeTime + Tooltip |
| 10 | **LoadingRow** | `ui/loading-row.tsx` | Skeleton row for lists | Skeleton + ListRow layout |
| 11 | **LoadingCard** | `ui/loading-card.tsx` | Skeleton card | Skeleton + Card layout |
| 12 | **InfoRow** | `ui/info-row.tsx` | Key-value pair for detail views | PropertyGroup + copy button |
| 13 | **TagInput** | `ui/tag-input.tsx` | Multi-value input with badges | Input + Badge + X button |
| 14 | **Combobox** | `ui/combobox.tsx` | Searchable select dropdown | Command + Popover + Input |

### Detailed Specs

#### FormField
```tsx
interface FormFieldProps {
  label: string
  name: string
  error?: string
  description?: string
  required?: boolean
  children: React.ReactNode // Input, Select, Textarea, etc.
}

// Layout:
// Label (text-sm font-medium) + optional required asterisk
// Input slot (children)
// Error (text-xs text-destructive) OR Description (text-xs text-muted-foreground)
// Spacing: gap-1.5 between label and input, gap-1 between input and error/desc
```

#### DataTable
```tsx
interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  searchKey?: string
  searchPlaceholder?: string
  filters?: FilterDef[]
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyState?: { icon: ReactNode, title: string, description?: string }
  pagination?: boolean
}

// Features:
// - Column sorting (click header to toggle asc/desc/none)
// - Text search (SearchInput above table)
// - Filter tabs (FilterBar)
// - Row click handler
// - Loading state (LoadingRow skeleton)
// - Empty state (EmptyState component)
// - Optional pagination (prev/next buttons)
// - Uses Table components underneath
```

#### SearchInput
```tsx
interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

// Search icon (w-4 h-4) left side
// Input (h-8, text-sm)
// Clear button (X icon) when value is non-empty
// Debounced onChange (300ms)
```

#### ConfirmDialog
```tsx
interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel?: string  // default: "Delete"
  cancelLabel?: string   // default: "Cancel"
  variant?: 'destructive' | 'default'
  onConfirm: () => void | Promise<void>
  trigger: React.ReactNode
  loading?: boolean
}

// Uses Dialog + two Buttons
// Destructive variant: red confirm button
// Loading state on confirm
```

#### StatCard
```tsx
interface StatCardProps {
  label: string
  value: string | number
  trend?: { value: number, direction: 'up' | 'down' | 'flat' }
  icon?: React.ReactNode
  className?: string
}

// Card (border, no shadow)
// Label: text-xs text-muted-foreground uppercase tracking-wider
// Value: text-2xl font-semibold
// Trend: text-xs, green up / red down / gray flat, with arrow icon
```

### Verification

1. All composites export clean TypeScript interfaces
2. DataTable handles sorting, search, empty, loading states
3. FormField correctly positions label/error/description
4. SearchInput debounces and clears properly
5. All composites work in light + dark mode

---

## Phase 5: Layout Components

**Goal:** Standardize page-level layouts so every page feels consistent.

### Layout Inventory

| # | Component | File | Purpose |
|---|-----------|------|---------|
| 1 | **TopBar** | `layout/top-bar.tsx` | 48px page header with title + actions |
| 2 | **MasterDetail** | `layout/master-detail.tsx` | Two-panel layout (list + detail) |
| 3 | **PageContainer** | `layout/page-container.tsx` | Standard page wrapper with padding |
| 4 | **SettingsLayout** | `layout/settings-layout.tsx` | Settings nav (180px) + centered content (720px max) |
| 5 | **SectionContainer** | `layout/section-container.tsx` | Tabbed section wrapper (TopBar + Tabs + content) |

### Detailed Specs

#### TopBar
```tsx
interface TopBarProps {
  title: string
  description?: string
  children?: React.ReactNode  // action buttons
  breadcrumb?: { label: string, href: string }[]
}

// h-12 px-6 border-b flex-shrink-0
// Title: text-sm font-semibold
// Actions: ml-auto flex items-center gap-1
// Optional breadcrumb above title
```

#### MasterDetail
```tsx
interface MasterDetailProps {
  list: React.ReactNode
  detail: React.ReactNode
  listWidth?: number  // default 360
  showDetail?: boolean  // for responsive collapse
}

// List panel: fixed width, border-right, scrolls independently
// Detail panel: flex-1, scrolls independently
// Both: overflow-y-auto, h-full
```

#### PageContainer
```tsx
interface PageContainerProps {
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full'  // default: full
  padding?: boolean  // default: true
}

// sm: max-w-xl, md: max-w-3xl, lg: max-w-5xl, xl: max-w-7xl
// Padding: p-6
// Scrollable: overflow-y-auto flex-1
```

#### SectionContainer
```tsx
interface SectionContainerProps {
  title: string
  tabs: { id: string, label: string, count?: number }[]
  activeTab: string
  onTabChange: (id: string) => void
  tabVariant?: 'underline' | 'pill'
  actions?: React.ReactNode
  children: React.ReactNode
}

// TopBar with title + actions
// Tabs (underline or pill) below top bar
// Content area (children) fills remaining space
```

### Verification

1. TopBar renders at exactly 48px height
2. MasterDetail panels scroll independently
3. SettingsLayout centers content at max 720px
4. All layouts work in both light and dark mode

---

## Phase 6: Global Cleanup Pass

**Goal:** Sweep the entire codebase to eliminate inconsistencies.

### 6A. Shadow Removal
```
Search: shadow-sm, shadow-md, shadow-lg on non-floating elements
Action: Remove from cards, containers, list items, page sections
Keep: On dropdown-menu, popover, dialog, tooltip, sheet ONLY
```

### 6B. Hardcoded Color Replacement
```
Search: #XXXX hex codes, bg-[#...], text-[#...] in components
Action: Replace with CSS variable equivalents (text-foreground, bg-muted, etc.)
Exception: Public page components (/p/[username]) use dynamic theming — leave those
```

### 6C. Icon Standardization
```
Search: strokeWidth={2} on Lucide icons, or missing strokeWidth
Action: Add strokeWidth={1.5} to all Lucide icon usage
Size: w-4 h-4 default, w-5 h-5 for settings/larger contexts
```

### 6D. Button Standardization
```
Search: Raw <button> with inline className styling
Action: Replace with <Button> component + appropriate variant/size
Pattern: Any <button className="...bg-primary...px-4..."> → <Button>
```

### 6E. Input Standardization
```
Search: Raw <input> with inline className styling
Action: Replace with <Input> component
Pattern: Any <input className="...rounded-lg border..."> → <Input>
```

### 6F. Typography Standardization
```
Search: text-[14px], text-[16px], text-base (14px), text-lg (18px+)
Action: Map to typography scale: text-2xs(11), text-xs(12), text-sm(13), text-base(14), text-lg(15), text-xl(20), text-2xl(24)
```

### 6G. Focus Ring Standardization
```
Search: ring-2, focus:ring-2
Action: Replace with ring-1, focus-visible:ring-1
```

### 6H. Border Radius Standardization
```
Search: rounded-xl, rounded-2xl, rounded-3xl
Action: Cap at rounded-lg (8px) for cards/modals, rounded-md (6px) for buttons/inputs
Exception: rounded-full for pills, avatars, badges (OK)
```

### Verification

1. `grep -r "shadow-sm" src/components/ --include="*.tsx"` returns only floating elements
2. No hardcoded hex colors in component files (except public pages)
3. All icons have strokeWidth={1.5}
4. No raw `<button>` with inline styling
5. No raw `<input>` with inline styling

---

## Phase 7: Enforcement

**Goal:** Prevent regression with automated rules.

### 7A. ESLint Rules

Create `eslint-rules/design-system.js`:

```
Rules:
1. no-shadow-on-cards: Warn when shadow-* classes appear on Card or div with border
2. no-hardcoded-colors: Warn on hex codes in className (except data-[state] selectors)
3. no-raw-button-styling: Warn on <button className="...bg-..."> (should use Button component)
4. no-raw-input-styling: Warn on <input className="...border..."> (should use Input component)
5. enforce-icon-stroke: Warn on Lucide icon usage without strokeWidth={1.5}
```

### 7B. Tailwind Plugin

Create `tailwind-plugins/design-system.js`:

```
1. Expose tag colors as utilities: bg-tag-orange, text-tag-orange, etc.
2. Expose status colors: text-status-success, bg-status-error, etc.
3. Expose avatar colors: bg-avatar-blue, bg-avatar-purple, etc.
4. Create component classes: .ds-list-row, .ds-setting-row, .ds-nav-item
```

### 7C. Import Restrictions

Add to ESLint config:
```
- Warn on importing from 'src/components/ds/' (old design system — migrate to ui/)
- Warn on direct fetch() calls in components (use frontend/api/* hooks)
```

### Verification

1. ESLint rules catch new violations
2. `npm run lint` reports design system warnings
3. No false positives on legitimate patterns

---

## File Inventory

### Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `src/app/globals.css` | 1A | Replace all CSS variables |
| `tailwind.config.ts` | 1B | Add fontSize, spacing, colors; remove brand palette |
| `src/components/ui/button.tsx` | 2 | Override to 32px, remove shadows |
| `src/components/ui/card.tsx` | 2 | Remove shadow-sm |
| `src/components/ui/badge.tsx` | 2 | Complete rewrite → pastel tag system |
| `src/components/ui/tabs.tsx` | 2 | Add underline + pill variants |
| `src/components/ui/input.tsx` | 2 | h-8, px-2.5, text-sm |
| `src/components/ui/dialog.tsx` | 2 | Overlay opacity |
| `src/components/ui/table.tsx` | 2 | No vertical borders, uppercase headers |
| `src/components/ui/dropdown-menu.tsx` | 2 | Compact items |
| `src/components/ui/sheet.tsx` | 2 | Compact padding |
| `src/components/ui/sidebar.tsx` | 2 | 220px, section labels |

### Files to Create

| File | Phase | Purpose |
|------|-------|---------|
| **Primitives (Phase 3)** | | |
| `src/components/ui/nav-item.tsx` | 3 | Sidebar nav item |
| `src/components/ui/section-label.tsx` | 3 | Uppercase section header |
| `src/components/ui/list-row.tsx` | 3 | Dense clickable row |
| `src/components/ui/property-group.tsx` | 3 | Label + value pair |
| `src/components/ui/empty-state.tsx` | 3 | Centered empty view |
| `src/components/ui/setting-row.tsx` | 3 | Settings row pattern |
| `src/components/ui/status-dot.tsx` | 3 | Colored status circle |
| `src/components/ui/page-title.tsx` | 3 | Consistent heading |
| `src/components/ui/kbd.tsx` | 3 | Keyboard shortcut |
| `src/components/ui/spinner.tsx` | 3 | Loading indicator |
| `src/components/ui/truncate.tsx` | 3 | Text truncation + tooltip |
| `src/components/ui/relative-time.tsx` | 3 | Relative timestamp |
| `src/components/ui/dot-separator.tsx` | 3 | Inline dot |
| `src/components/ui/icon-wrapper.tsx` | 3 | Standardized icon |
| **shadcn Additions (Phase 2)** | | |
| `src/components/ui/select.tsx` | 2 | Searchable dropdown |
| `src/components/ui/textarea.tsx` | 2 | Multi-line input |
| `src/components/ui/checkbox.tsx` | 2 | Checkmark toggle |
| `src/components/ui/radio-group.tsx` | 2 | Radio selection |
| `src/components/ui/switch.tsx` | 2 | Toggle switch |
| `src/components/ui/popover.tsx` | 2 | Floating panel |
| `src/components/ui/scroll-area.tsx` | 2 | Custom scrollbar |
| `src/components/ui/avatar.tsx` | 2 | User avatar |
| `src/components/ui/toggle.tsx` | 2 | Toggle button |
| `src/components/ui/toggle-group.tsx` | 2 | Segmented control |
| `src/components/ui/command.tsx` | 2 | Command palette |
| `src/components/ui/progress.tsx` | 2 | Progress bar |
| `src/components/ui/accordion.tsx` | 2 | Collapsible sections |
| `src/components/ui/alert.tsx` | 2 | Alert banner |
| `src/components/ui/breadcrumb.tsx` | 2 | Breadcrumb nav |
| **Composites (Phase 4)** | | |
| `src/components/ui/form-field.tsx` | 4 | Label + input + error |
| `src/components/ui/data-table.tsx` | 4 | Sortable/filterable table |
| `src/components/ui/search-input.tsx` | 4 | Search with icon + clear |
| `src/components/ui/confirm-dialog.tsx` | 4 | Destructive confirmation |
| `src/components/ui/filter-bar.tsx` | 4 | Horizontal filter controls |
| `src/components/ui/stat-card.tsx` | 4 | Metric display |
| `src/components/ui/avatar-group.tsx` | 4 | Overlapping avatars |
| `src/components/ui/action-menu.tsx` | 4 | Three-dot menu |
| `src/components/ui/date-display.tsx` | 4 | Formatted date |
| `src/components/ui/loading-row.tsx` | 4 | Skeleton list row |
| `src/components/ui/loading-card.tsx` | 4 | Skeleton card |
| `src/components/ui/info-row.tsx` | 4 | Key-value with copy |
| `src/components/ui/tag-input.tsx` | 4 | Multi-value input |
| `src/components/ui/combobox.tsx` | 4 | Searchable select |
| **Layouts (Phase 5)** | | |
| `src/components/layout/top-bar.tsx` | 5 | 48px page header |
| `src/components/layout/master-detail.tsx` | 5 | Two-panel layout |
| `src/components/layout/page-container.tsx` | 5 | Standard page wrapper |
| `src/components/layout/settings-layout.tsx` | 5 | Settings page layout |
| `src/components/layout/section-container.tsx` | 5 | Tabbed section wrapper |

### Files to Delete (after migration)

| File | When | Reason |
|------|------|--------|
| `src/components/ds/CTAButton.tsx` | After public page migration | Replaced by Button variants |
| `src/components/ds/LogoBar.tsx` | After public page migration | Move to public page components |
| `src/components/ds/MarketingBlock.tsx` | After public page migration | Move or keep for public pages |
| `src/components/ds/SectionBridge.tsx` | After public page migration | Move or keep for public pages |
| `src/components/ds/SectionRenderer.tsx` | After public page migration | Move or keep for public pages |
| `src/components/ds/SimpleSteps.tsx` | After public page migration | Move or keep for public pages |
| `src/components/ds/TestimonialQuote.tsx` | After public page migration | Move or keep for public pages |
| `src/components/ds/ThemeToggle.tsx` | After Phase 2 | Replaced by sidebar toggle |

**Note:** The `ds/` components are mostly for public pages (`/p/[username]/[slug]`). Those pages have their own dynamic theming system (`getThemeVars()`) and should NOT be migrated to the dashboard design system. Keep these files but move them to `src/components/public/` to clarify scope.

---

## Execution Order

```
Phase 1: Design Tokens (globals.css + tailwind.config.ts)
  ↓
Phase 2: Base Component Overrides (shadcn)
  ↓   ← Ship here: "palette + density shift" — entire app looks different
Phase 3: Custom Primitives (14 new components)
  ↓
Phase 4: Composite Components (14 patterns)
  ↓   ← Ship here: "full component library ready"
Phase 5: Layout Components (5 layouts)
  ↓
Phase 6: Global Cleanup Pass (shadows, colors, icons, buttons, inputs)
  ↓   ← Ship here: "all pages consistent"
Phase 7: Enforcement (ESLint + Tailwind plugin)
  ↓   ← Ship here: "regression-proof"
```

### Parallelization

- Phases 1-2 are sequential (2 depends on 1)
- Phase 3 can start immediately after Phase 1 (primitives don't need shadcn overrides)
- Phase 4 depends on Phase 2 + 3 (composites use both)
- Phase 5 can run in parallel with Phase 4
- Phase 6 should run after Phase 2 (uses the new components for replacement)
- Phase 7 runs last

### Per-Phase QA Checklist

After every phase:
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Light mode correct
- [ ] Dark mode correct (navy bg #111120, NOT gray)
- [ ] Only ONE accent color (pastel indigo)
- [ ] No card shadows (border only)
- [ ] Buttons 32px height max
- [ ] Base text 13px (text-sm)
- [ ] Icons 16px with strokeWidth 1.5
- [ ] Tags use pastel palette
- [ ] Hover states are subtle bg changes only
- [ ] No regressions on existing functionality

---

## Design Rules (Reference Card)

### Always Do
- Use CSS variables for colors (never hardcode hex in components)
- Use design token spacing (h-btn, h-row, h-topbar, w-sidebar)
- Keep buttons at 32px height (36px absolute max)
- Use border-only cards (no shadows)
- Use pastel colors for all tags/badges/status indicators
- Use strokeWidth={1.5} on all Lucide icons
- Use relative timestamps ("2h ago", "3d ago")
- Truncate text with ellipsis in lists/tables

### Never Do
1. Card shadows on non-floating elements
2. Gradients on backgrounds/buttons/surfaces
3. Rounded corners > 12px (except pills/avatars)
4. Buttons > 36px height
5. Saturated primary colors (#FF0000, #00FF00, etc.)
6. Pure black (#000000) for dark mode background
7. More than ONE accent color
8. Vertical borders in tables
9. Modals when inline editing works
10. Thick borders (max 1px, except 2px active tab underline)
11. Letter-spacing on body text
12. Animated loaders larger than 20px
13. Colorful empty state illustrations
14. Card grids for primary data (use lists/tables)

---

## Relationship to MASTER_PLAN.md

This plan covers **Phases 1 only** of the MASTER_PLAN — the pure design system foundation. The MASTER_PLAN also includes:

- **Navigation restructure** (10→7 nav items, route changes) → separate effort
- **Section containers** (Brain, Posts, Pages, Audience) → separate effort
- **Workspace enhancement** (Content/Posts tabs) → separate effort
- **Creation flows** (wizard replacement) → separate effort
- **Page restyling** (settings, email, funnel) → uses this design system
- **Dashboard refresh** → uses this design system

**Sequence:** Build the design system FIRST (this plan), then execute the MASTER_PLAN phases 2-8 which consume the design system components.

---

## Accessibility (a11y) Requirements

Every component must:
1. **Focus management:** All interactive elements focusable via keyboard (tab order)
2. **Focus visible:** Use `focus-visible:ring-1 focus-visible:ring-ring` (not `focus:`)
3. **ARIA labels:** All icon-only buttons need `aria-label`
4. **Color contrast:** Minimum 4.5:1 for body text, 3:1 for large text (verify pastel colors)
5. **Screen reader:** Status changes announced via `aria-live` regions
6. **Keyboard nav:** Escape closes modals/popovers, Enter activates buttons, Arrow keys navigate lists
7. **Reduced motion:** Respect `prefers-reduced-motion` for animations

### Contrast Verification Needed

| Combination | Light Mode | Dark Mode | Target |
|-------------|-----------|-----------|--------|
| Body text on bg | #1F2937 on #FFFFFF | #D4D4DD on #111120 | 4.5:1 |
| Muted text on bg | #6B7280 on #FFFFFF | #8888A0 on #111120 | 4.5:1 |
| Accent on bg | #7B83C9 on #FFFFFF | #9BA3E0 on #111120 | 3:1 min |
| Tag text on tag bg | varies | varies | 4.5:1 |

---

## Testing Strategy

### Unit Tests
- Each primitive component: render test + prop variations
- Each composite component: interaction tests (click, type, select)
- Badge: all 7 variants render correctly
- Tabs: underline + pill variants switch correctly
- DataTable: sort, search, empty, loading states

### Visual Regression (future)
- Storybook + Chromatic or Percy for automated visual comparison
- One story per component variant
- Light + dark mode snapshots

### Manual QA
- Side-by-side with mockup (https://ui-mockup-six.vercel.app)
- Every page in light mode
- Every page in dark mode
- Keyboard-only navigation test
- Screen reader test (VoiceOver on Mac)
