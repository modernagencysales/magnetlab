# MagnetLab Design System — Component Catalog

> Full API reference for every component in the design system.
> Each component includes: purpose, props, variants, usage examples, and do/don't rules.

---

## Table of Contents

1. [Base Components (shadcn overrides)](#1-base-components)
2. [Custom Primitives](#2-custom-primitives)
3. [Composite Components](#3-composite-components)
4. [Layout Components](#4-layout-components)

---

## 1. Base Components

### Button

**File:** `src/components/ui/button.tsx`
**Purpose:** All clickable actions.

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm'
  asChild?: boolean
}
```

| Variant | Use When |
|---------|----------|
| `default` | Primary action (1 per section max) |
| `secondary` | Secondary actions |
| `outline` | Tertiary actions, form cancel |
| `ghost` | Toolbar buttons, inline actions |
| `destructive` | Delete, remove, disconnect |
| `link` | Inline text links |

| Size | Height | Use When |
|------|--------|----------|
| `default` | 32px | Standard buttons |
| `sm` | 28px | Compact contexts (table rows, cards) |
| `lg` | 36px | RARE — form submit in wide layouts |
| `icon` | 32x32px | Icon-only buttons |
| `icon-sm` | 28x28px | Compact icon-only buttons |

**Usage:**
```tsx
<Button>Save Changes</Button>
<Button variant="ghost" size="icon"><Plus className="w-4 h-4" strokeWidth={1.5} /></Button>
<Button variant="destructive" size="sm">Delete</Button>
```

**Don't:**
- Use `lg` size for standard actions
- Put shadows on buttons
- Use more than one `default` variant per section

---

### Badge (Tag)

**File:** `src/components/ui/badge.tsx`
**Purpose:** Status labels, tags, categories, counts.

```tsx
interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'orange' | 'blue' | 'green' | 'red' | 'purple' | 'gray' | 'count'
}
```

| Variant | Use For |
|---------|---------|
| `default` (blue) | Default status |
| `orange` | Warning, pending, in-progress |
| `blue` | Info, selected, active |
| `green` | Success, published, qualified |
| `red` | Error, failed, overdue |
| `purple` | Featured, premium, special |
| `gray` | Archived, disabled, draft |
| `count` | Numeric counts (sidebar, tabs) |

**Usage with dot indicator:**
```tsx
<Badge variant="green">
  <span className="w-2 h-2 rounded-full bg-tag-green-dot" />
  Published
</Badge>
```

**Usage as count:**
```tsx
<Badge variant="count">12</Badge>
```

---

### Card

**File:** `src/components/ui/card.tsx`
**Purpose:** Content containers. NEVER has shadow.

```tsx
// Subcomponents: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
```

**Key rule:** `rounded-lg border bg-card text-card-foreground` — NO shadow classes.

**Usage:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description text</CardDescription>
  </CardHeader>
  <CardContent>Content here</CardContent>
</Card>
```

---

### Input

**File:** `src/components/ui/input.tsx`
**Purpose:** Single-line text input.

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
```

**Key specs:**
- Height: 32px (h-8)
- Padding: px-2.5
- Font: text-sm (13px)
- Focus: ring-1 ring-ring
- Placeholder: text-muted-foreground

**Usage:**
```tsx
<Input placeholder="Search..." type="text" />
<Input type="email" disabled />
```

---

### Select

**File:** `src/components/ui/select.tsx`
**Purpose:** Single-value dropdown selection.

**Key specs:**
- Trigger height: 32px (h-8)
- Font: text-sm
- Padding: px-2.5
- Chevron icon: w-4 h-4

**Usage:**
```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="Choose option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="a">Option A</SelectItem>
    <SelectItem value="b">Option B</SelectItem>
  </SelectContent>
</Select>
```

---

### Textarea

**File:** `src/components/ui/textarea.tsx`
**Purpose:** Multi-line text input.

```tsx
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
```

**Key specs:**
- Min height: 80px
- Padding: px-2.5 py-2
- Font: text-sm
- Focus: ring-1 ring-ring

---

### Tabs

**File:** `src/components/ui/tabs.tsx`
**Purpose:** Content section switching.

**Two variants:**

| Variant | Use When | Visual |
|---------|----------|--------|
| `underline` (default) | Page sections (Brain, Posts) | 2px bottom border on active |
| `pill` | View switchers (All / Active / Draft) | Border-based pills, active has fill |

**Usage (underline):**
```tsx
<Tabs value={tab} onValueChange={setTab}>
  <TabsList variant="underline">
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="details">Details</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
  <TabsContent value="details">...</TabsContent>
</Tabs>
```

**Usage (pill):**
```tsx
<TabsList variant="pill">
  <TabsTrigger value="all">All</TabsTrigger>
  <TabsTrigger value="active">Active</TabsTrigger>
</TabsList>
```

---

### Table

**File:** `src/components/ui/table.tsx`
**Purpose:** Data tables. NO vertical borders.

**Key specs:**
- Headers: text-xs, uppercase, tracking-wider, font-medium, muted
- Cells: text-sm, truncated at max-w-[200px]
- Rows: border-b border-border/50, hover:bg-secondary/50
- NO vertical borders

**Usage:**
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Date</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>John Doe</TableCell>
      <TableCell><Badge variant="green">Active</Badge></TableCell>
      <TableCell><RelativeTime date="2024-01-15" /></TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

### Dialog

**File:** `src/components/ui/dialog.tsx`
**Purpose:** Modal dialogs for focused tasks.

**Key specs:**
- Overlay: bg-black/40 dark:bg-black/60
- Content: rounded-lg, shadow-lg (floating — shadow OK)
- Max width: sm (400px), md (500px), lg (640px)
- Padding: p-6

**Don't:** Use for simple confirmations — use ConfirmDialog composite instead.

---

### Avatar

**File:** `src/components/ui/avatar.tsx`
**Purpose:** User/team avatars.

**Sizes:**

| Size | Dimensions | Font | Use When |
|------|-----------|------|----------|
| `xs` | 20x20px | 9px | Inline mentions |
| `sm` | 24x24px | 10px | Compact lists |
| `md` | 32x32px | 12px | Standard (default) |
| `lg` | 40x40px | 15px | Profile headers |
| `xl` | 64x64px | 22px | Profile pages |

**Fallback colors:** Hash user name/ID to deterministically pick from:
`#7BAAD0, #9B8CCE, #C88BA8, #C4975A, #6DB5C4, #C08488, #6BB895`

**Usage:**
```tsx
<Avatar size="md">
  <AvatarImage src={user.avatar} alt={user.name} />
  <AvatarFallback style={{ backgroundColor: getAvatarColor(user.name) }}>
    {user.name.charAt(0)}
  </AvatarFallback>
</Avatar>
```

---

### Checkbox

**File:** `src/components/ui/checkbox.tsx`
**Purpose:** Boolean selection.

**Key specs:**
- Size: 16x16px
- Border radius: rounded-sm (2px)
- Checked: accent color bg
- Focus: ring-1 ring-ring

---

### Switch

**File:** `src/components/ui/switch.tsx`
**Purpose:** Toggle on/off settings.

**Key specs:**
- Width: 40px
- Height: 22px
- Checked: accent color bg
- Unchecked: muted bg

**Use When:** Binary settings (enable/disable notifications, dark mode, etc.)
**Don't:** Use for form selections — use Checkbox or Radio instead.

---

### Progress

**File:** `src/components/ui/progress.tsx`
**Purpose:** Progress indicators.

**Key specs:**
- Height: 4px
- Track: bg-secondary
- Fill: bg-primary (accent)
- Border radius: rounded-full

---

### Accordion

**File:** `src/components/ui/accordion.tsx`
**Purpose:** Collapsible content sections.

**Key specs:**
- No outer border on container
- Items separated by border-b
- Trigger: text-sm font-medium, py-3
- Chevron: w-4 h-4 strokeWidth 1.5
- Content: text-sm, pt-0 pb-3

---

### Alert

**File:** `src/components/ui/alert.tsx`
**Purpose:** Contextual notifications/banners.

```tsx
interface AlertProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
}
```

**Key specs:**
- Border-l-2 with status color
- Background: subtle tint (status color at 8% opacity)
- Icon: status-specific Lucide icon
- Text: text-sm
- Dismissible: optional X button

---

## 2. Custom Primitives

### NavItem

**File:** `src/components/ui/nav-item.tsx`
**Purpose:** Sidebar navigation link.

```tsx
interface NavItemProps {
  icon: LucideIcon
  label: string
  href: string
  badge?: number
  active?: boolean
  indented?: boolean
}
```

**Key specs:**
- Height: 32px (h-8)
- Padding: px-3 (indented: pl-9 pr-3)
- Active: bg-accent text-accent-foreground
- Inactive: text-muted-foreground hover:bg-secondary hover:text-foreground
- Icon: w-4 h-4 strokeWidth={1.5}, inherits text color
- Badge: uses Badge count variant, positioned ml-auto
- Font: text-sm font-medium

---

### SectionLabel

**File:** `src/components/ui/section-label.tsx`
**Purpose:** Group headers in sidebar and lists.

```tsx
interface SectionLabelProps {
  children: React.ReactNode
  className?: string
}
```

**Key specs:**
- Font: text-2xs (11px) font-medium uppercase tracking-wider
- Color: text-muted-foreground
- Padding: px-3 pt-4 pb-1

---

### ListRow

**File:** `src/components/ui/list-row.tsx`
**Purpose:** Dense clickable row for all list views.

```tsx
interface ListRowProps {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
  href?: string
}
```

**Key specs:**
- Min height: 42px (min-h-row)
- Padding: px-6 py-2
- Border: border-b border-border/50
- Hover: bg-secondary/50
- Active: bg-accent
- Cursor: pointer when onClick provided
- Layout: flex items-center gap-2

---

### PropertyGroup

**File:** `src/components/ui/property-group.tsx`
**Purpose:** Label + value pair for detail sidebars.

```tsx
interface PropertyGroupProps {
  label: string
  children: React.ReactNode
  className?: string
}
```

**Key specs:**
- Label: text-2xs uppercase tracking-wider text-muted-foreground mb-1
- Value: text-sm flex items-center gap-1.5
- Spacing: mb-4 between groups

---

### EmptyState

**File:** `src/components/ui/empty-state.tsx`
**Purpose:** Centered placeholder when no data exists.

```tsx
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: ButtonProps['variant']
  }
}
```

**Key specs:**
- Centered vertically + horizontally
- Icon area: w-[120px] h-[120px] text-muted-foreground/40
- Title: text-sm font-medium mt-4
- Description: text-xs text-muted-foreground mt-1 max-w-sm text-center
- Action: Button component, mt-4
- Min container height: 300px
- **No colorful illustrations** — monochrome, sketch-style only

---

### SettingRow

**File:** `src/components/ui/setting-row.tsx`
**Purpose:** Settings page row with icon, title, description, and control.

```tsx
interface SettingRowProps {
  icon: LucideIcon
  title: string
  description: string
  children: React.ReactNode  // control slot (Switch, Button, etc.)
}
```

**Key specs:**
- Layout: flex items-start gap-4
- Padding: px-6 py-[18px]
- Border: border-b border-border/50 last:border-b-0
- Icon: w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0
- Title: text-sm font-medium
- Description: text-xs text-muted-foreground
- Control: flex-shrink-0 ml-auto

---

### StatusDot

**File:** `src/components/ui/status-dot.tsx`
**Purpose:** Colored status indicator circle.

```tsx
interface StatusDotProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  pulse?: boolean
  size?: 'sm' | 'md'
  className?: string
}
```

**Key specs:**
- sm: w-1.5 h-1.5 (6px)
- md: w-2 h-2 (8px, default)
- Colors: maps to status.* palette
- Optional pulse animation for "active" states
- rounded-full

---

### PageTitle

**File:** `src/components/ui/page-title.tsx`
**Purpose:** Consistent page heading.

```tsx
interface PageTitleProps {
  children: React.ReactNode
  className?: string
}
```

**Key specs:**
- Font: text-xl font-semibold (20px)
- Color: text-foreground

---

### Kbd

**File:** `src/components/ui/kbd.tsx`
**Purpose:** Keyboard shortcut display.

```tsx
interface KbdProps {
  children: React.ReactNode
}
```

**Key specs:**
- Font: text-2xs font-medium font-mono
- Background: bg-muted
- Border: border rounded-sm
- Padding: px-1.5 py-0.5
- Height: inline

**Usage:** `Press <Kbd>⌘K</Kbd> to search`

---

### Spinner

**File:** `src/components/ui/spinner.tsx`
**Purpose:** Loading indicator.

```tsx
interface SpinnerProps {
  size?: 'sm' | 'md'
  className?: string
}
```

**Key specs:**
- sm: w-3.5 h-3.5 (14px)
- md: w-4 h-4 (16px, default)
- **Max 20px** — never larger
- Animation: spin, 0.6s, linear
- Color: text-muted-foreground
- Uses a ring/arc shape, not dots

---

### RelativeTime

**File:** `src/components/ui/relative-time.tsx`
**Purpose:** Display timestamps in relative format.

```tsx
interface RelativeTimeProps {
  date: Date | string | number
  className?: string
}
```

**Key specs:**
- Rendering rules:
  - < 1 min: "just now"
  - < 60 min: "Xm"
  - < 24 hours: "Xh"
  - < 7 days: "Xd"
  - < 30 days: "X days ago"
  - < 1 year: "Mon DD" (e.g., "Feb 23")
  - >= 1 year: "Mon DD, YYYY"
- Font: text-xs text-muted-foreground
- Tooltip: shows full ISO date on hover
- Auto-updates every 60s for times < 1h old

---

### Truncate

**File:** `src/components/ui/truncate.tsx`
**Purpose:** Text that truncates with ellipsis and shows full text on hover.

```tsx
interface TruncateProps {
  children: string
  maxWidth?: number | string  // default: 100%
  className?: string
}
```

**Key specs:**
- Applies: truncate (overflow-hidden text-ellipsis whitespace-nowrap)
- Wraps with Tooltip showing full text
- Only shows tooltip if text is actually truncated

---

### IconWrapper

**File:** `src/components/ui/icon-wrapper.tsx`
**Purpose:** Standardized icon rendering with correct defaults.

```tsx
interface IconWrapperProps {
  icon: LucideIcon
  size?: 'sm' | 'md' | 'lg'
  className?: string
}
```

**Key specs:**
- sm: w-3.5 h-3.5 (14px)
- md: w-4 h-4 (16px, default)
- lg: w-5 h-5 (20px, for settings)
- Always: strokeWidth={1.5}
- Color: inherits from parent (currentColor)

---

### DotSeparator

**File:** `src/components/ui/dot-separator.tsx`
**Purpose:** Inline separator between metadata items.

```tsx
interface DotSeparatorProps {
  className?: string
}
```

**Key specs:**
- Renders: `·` (middle dot)
- Color: text-muted-foreground
- Margins: mx-1.5

**Usage:** `<span>John Doe</span><DotSeparator /><span>2h ago</span>`

---

## 3. Composite Components

### FormField

**File:** `src/components/ui/form-field.tsx`
**Purpose:** Label + input + validation pattern.

```tsx
interface FormFieldProps {
  label: string
  name: string
  error?: string
  description?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}
```

**Layout:**
```
Label (text-sm font-medium)     * (if required, text-destructive)
[Input / Select / Textarea]
Error message (text-xs text-destructive)  OR
Description (text-xs text-muted-foreground)
```

**Spacing:** gap-1.5 between label and input, gap-1 between input and error/description.

---

### DataTable

**File:** `src/components/ui/data-table.tsx`
**Purpose:** Full-featured sortable, filterable table.

```tsx
interface ColumnDef<T> {
  id: string
  header: string
  accessorKey: keyof T
  cell?: (row: T) => React.ReactNode
  sortable?: boolean
  maxWidth?: number
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  loading?: boolean
  searchKey?: keyof T
  searchPlaceholder?: string
  filters?: { id: string, label: string, count?: number }[]
  activeFilter?: string
  onFilterChange?: (id: string) => void
  onRowClick?: (row: T) => void
  emptyState?: EmptyStateProps
  pageSize?: number
  className?: string
}
```

**Features:**
- Click column header to sort (asc → desc → none)
- Search input above table (debounced)
- Filter tabs (pill variant) above search
- Loading state: skeleton rows
- Empty state: EmptyState component
- Row click handler
- Pagination (prev/next) when data > pageSize

---

### SearchInput

**File:** `src/components/ui/search-input.tsx`
**Purpose:** Search field with icon and clear button.

```tsx
interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounce?: number  // default: 300ms
  className?: string
}
```

**Layout:** Search icon (left) + Input + X button (right, when value non-empty)

---

### ConfirmDialog

**File:** `src/components/ui/confirm-dialog.tsx`
**Purpose:** Confirmation for destructive actions.

```tsx
interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel?: string   // default: "Delete"
  cancelLabel?: string    // default: "Cancel"
  variant?: 'destructive' | 'default'
  onConfirm: () => void | Promise<void>
  trigger: React.ReactNode
  loading?: boolean
}
```

---

### FilterBar

**File:** `src/components/ui/filter-bar.tsx`
**Purpose:** Horizontal filter + search controls.

```tsx
interface FilterBarProps {
  filters: { id: string, label: string, count?: number }[]
  activeFilter: string
  onFilterChange: (id: string) => void
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  actions?: React.ReactNode
}
```

**Layout:** `[Pill Tabs] [SearchInput] [Actions]` — all in a single row.

---

### StatCard

**File:** `src/components/ui/stat-card.tsx`
**Purpose:** Metric display card.

```tsx
interface StatCardProps {
  label: string
  value: string | number
  trend?: {
    value: number
    direction: 'up' | 'down' | 'flat'
  }
  icon?: LucideIcon
  className?: string
}
```

**Layout:**
```
[Icon]  Label (text-xs uppercase muted)
        Value (text-2xl font-semibold)
        Trend: +12% ↑ (text-xs, green/red/gray)
```

---

### AvatarGroup

**File:** `src/components/ui/avatar-group.tsx`
**Purpose:** Overlapping avatar stack.

```tsx
interface AvatarGroupProps {
  users: { name: string, avatar?: string }[]
  max?: number      // default: 4
  size?: 'sm' | 'md'
}
```

**Key specs:**
- Avatars overlap by -8px (negative margin)
- Overflow: "+3" badge after max
- Border: 2px ring-background (white/navy ring around each avatar)

---

### ActionMenu

**File:** `src/components/ui/action-menu.tsx`
**Purpose:** Three-dot context menu.

```tsx
interface ActionMenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  align?: 'start' | 'end'
}
```

**Trigger:** Ghost button with MoreHorizontal icon (w-4 h-4)

---

### LoadingRow

**File:** `src/components/ui/loading-row.tsx`
**Purpose:** Skeleton loading state for list views.

```tsx
interface LoadingRowProps {
  columns?: number  // default: 3
  count?: number    // default: 5
}
```

**Renders:** N rows of skeleton bars matching ListRow layout.

---

### LoadingCard

**File:** `src/components/ui/loading-card.tsx`
**Purpose:** Skeleton loading state for cards.

```tsx
interface LoadingCardProps {
  count?: number  // default: 3
  className?: string
}
```

**Renders:** N Card skeletons with header + body skeleton bars.

---

### TagInput

**File:** `src/components/ui/tag-input.tsx`
**Purpose:** Multi-value input that renders values as badges.

```tsx
interface TagInputProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  maxTags?: number
  suggestions?: string[]
  className?: string
}
```

**Behavior:**
- Type + Enter to add tag
- Click X on badge to remove
- Backspace removes last tag
- Optional suggestion dropdown (Combobox-like)

---

### Combobox

**File:** `src/components/ui/combobox.tsx`
**Purpose:** Searchable select dropdown.

```tsx
interface ComboboxOption {
  value: string
  label: string
  description?: string
  icon?: React.ReactNode
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
}
```

**Built from:** Command + Popover

---

## 4. Layout Components

### TopBar

**File:** `src/components/layout/top-bar.tsx`

```tsx
interface TopBarProps {
  title: string
  description?: string
  children?: React.ReactNode   // action buttons
  breadcrumb?: { label: string, href: string }[]
}
```

**Key specs:**
- Height: 48px (h-12)
- Padding: px-6
- Border: border-b
- Title: text-sm font-semibold
- Actions: ml-auto flex items-center gap-1
- Flex-shrink-0 (doesn't scroll)

---

### MasterDetail

**File:** `src/components/layout/master-detail.tsx`

```tsx
interface MasterDetailProps {
  list: React.ReactNode
  detail: React.ReactNode
  listWidth?: number      // default: 360
  showDetail?: boolean    // for responsive collapse, default: true
}
```

**Key specs:**
- List panel: fixed width, border-r, overflow-y-auto, h-full
- Detail panel: flex-1, overflow-y-auto, h-full
- Both scroll independently
- Responsive: stacks to single panel at narrow widths

---

### PageContainer

**File:** `src/components/layout/page-container.tsx`

```tsx
interface PageContainerProps {
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  padding?: boolean
  className?: string
}
```

| Width | Max | Use When |
|-------|-----|----------|
| `sm` | 576px | Focused forms, auth pages |
| `md` | 768px | Settings, forms |
| `lg` | 1024px | Content pages |
| `xl` | 1280px | Wide dashboards |
| `full` | 100% | Default — list views, tables |

---

### SettingsLayout

**File:** `src/components/layout/settings-layout.tsx`

```tsx
interface SettingsLayoutProps {
  nav: { label: string, href: string, icon: LucideIcon }[]
  children: React.ReactNode
}
```

**Key specs:**
- Sidebar nav: 180px wide, uses NavItem component
- Content: centered, max-w-3xl (720px)
- Padding: p-6

---

### SectionContainer

**File:** `src/components/layout/section-container.tsx`

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
```

**Layout:**
```
┌────────────────────────────────────────────┐
│ TopBar: Title                    [Actions] │
├────────────────────────────────────────────┤
│ [Tab1] [Tab2] [Tab3]                       │
├────────────────────────────────────────────┤
│                                            │
│  Children (tab content, scrollable)        │
│                                            │
└────────────────────────────────────────────┘
```

---

## Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Component files | kebab-case | `search-input.tsx` |
| Component names | PascalCase | `SearchInput` |
| Props interfaces | PascalCase + Props | `SearchInputProps` |
| CSS variables | kebab-case | `--bg-primary` |
| Tailwind tokens | kebab-case | `text-tag-orange`, `bg-status-success` |
| Variant names | lowercase | `variant="destructive"` |
| Size names | lowercase | `size="sm"` |

---

## Import Patterns

```tsx
// Base components
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

// Custom primitives
import { NavItem } from '@/components/ui/nav-item'
import { ListRow } from '@/components/ui/list-row'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusDot } from '@/components/ui/status-dot'
import { RelativeTime } from '@/components/ui/relative-time'

// Composites
import { DataTable } from '@/components/ui/data-table'
import { FormField } from '@/components/ui/form-field'
import { SearchInput } from '@/components/ui/search-input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// Layouts
import { TopBar } from '@/components/layout/top-bar'
import { MasterDetail } from '@/components/layout/master-detail'
import { PageContainer } from '@/components/layout/page-container'
import { SectionContainer } from '@/components/layout/section-container'

// Icons (always with strokeWidth 1.5)
import { Search, Plus, MoreHorizontal } from 'lucide-react'
// Usage: <Search className="w-4 h-4" strokeWidth={1.5} />
```
