# Shadcn/UI Implementation Guide

This document maps our design system to shadcn/ui's theming system. Use this alongside the design system prompt when building or modifying components.

---

## 1. globals.css — Theme Variables

Replace your entire `globals.css` theme block with this. Shadcn uses HSL values in its CSS variables.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Backgrounds */
    --background: 0 0% 100%;            /* #FFFFFF */
    --foreground: 0 0% 7%;              /* #111111 */
    --card: 0 0% 100%;                  /* #FFFFFF */
    --card-foreground: 0 0% 7%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 7%;

    /* Surfaces */
    --muted: 0 0% 98%;                  /* #FAFAFA — sidebar, subtle bg */
    --muted-foreground: 220 9% 46%;     /* #6B7280 */
    --secondary: 0 0% 96%;             /* #F5F5F5 — hover, tertiary bg */
    --secondary-foreground: 0 0% 7%;

    /* Accent */
    --primary: 233 30% 63%;             /* #7B83C9 — pastel indigo */
    --primary-foreground: 0 0% 100%;
    --accent: 233 30% 97%;              /* #F2F2FC — subtle tint */
    --accent-foreground: 233 30% 63%;

    /* Semantic */
    --destructive: 355 30% 62%;         /* #C97B7F — pastel red */
    --destructive-foreground: 0 0% 100%;

    /* Borders & Inputs */
    --border: 0 0% 90%;                 /* #E5E5E5 */
    --input: 0 0% 90%;
    --ring: 233 30% 63%;                /* matches primary */

    /* Radius */
    --radius: 0.375rem;                 /* 6px — our radius-md */

    /* Sidebar (shadcn sidebar component) */
    --sidebar-background: 0 0% 98%;
    --sidebar-foreground: 220 9% 46%;
    --sidebar-primary: 233 30% 63%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 233 30% 97%;
    --sidebar-accent-foreground: 233 30% 63%;
    --sidebar-border: 0 0% 90%;
    --sidebar-ring: 233 30% 63%;

    /* Chart colors (pastel) */
    --chart-1: 233 30% 63%;             /* indigo — primary metric */
    --chart-2: 35 50% 56%;              /* #D4A86A — warm amber */
    --chart-3: 153 30% 55%;             /* #6BB895 — sage green */
    --chart-4: 260 30% 68%;             /* #9B8CCE — soft purple */
    --chart-5: 355 30% 62%;             /* #C08488 — dusty rose */
  }

  .dark {
    /* Backgrounds — deep navy, NOT pure black */
    --background: 235 33% 10%;          /* #111120 */
    --foreground: 240 10% 91%;          /* #E2E2EA */
    --card: 235 30% 12%;               /* #16162A */
    --card-foreground: 240 10% 91%;
    --popover: 235 30% 12%;
    --popover-foreground: 240 10% 91%;

    /* Surfaces */
    --muted: 235 33% 8%;               /* #0D0D1A — sidebar */
    --muted-foreground: 240 10% 58%;    /* #8888A0 */
    --secondary: 235 30% 15%;          /* #1A1A30 — hover */
    --secondary-foreground: 240 10% 91%;

    /* Accent */
    --primary: 233 40% 74%;             /* #9BA3E0 — lighter pastel for dark */
    --primary-foreground: 235 33% 10%;
    --accent: 235 30% 17%;              /* #1C1C38 — subtle tint */
    --accent-foreground: 233 40% 74%;

    /* Semantic */
    --destructive: 355 30% 68%;         /* #D98A8E */
    --destructive-foreground: 0 0% 100%;

    /* Borders & Inputs */
    --border: 235 28% 20%;              /* #232340 */
    --input: 235 28% 20%;
    --ring: 233 40% 74%;

    /* Sidebar */
    --sidebar-background: 235 33% 8%;
    --sidebar-foreground: 240 10% 58%;
    --sidebar-primary: 233 40% 74%;
    --sidebar-primary-foreground: 235 33% 10%;
    --sidebar-accent: 235 30% 17%;
    --sidebar-accent-foreground: 233 40% 74%;
    --sidebar-border: 235 28% 20%;
    --sidebar-ring: 233 40% 74%;

    /* Charts */
    --chart-1: 233 40% 74%;
    --chart-2: 35 50% 65%;
    --chart-3: 153 30% 64%;
    --chart-4: 260 30% 76%;
    --chart-5: 355 30% 72%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

---

## 2. tailwind.config.ts — Extended Theme

Add these custom values to your Tailwind config:

```ts
import type { Config } from "tailwindcss"

const config: Config = {
  // ... existing shadcn config
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        // Our typography scale
        "2xs": ["0.6875rem", { lineHeight: "1.2" }],   // 11px — tags, section labels
        xs: ["0.75rem", { lineHeight: "1.3" }],          // 12px — meta, timestamps
        sm: ["0.8125rem", { lineHeight: "1.4" }],        // 13px — body, nav, buttons
        base: ["0.875rem", { lineHeight: "1.5" }],       // 14px — detail body
        lg: ["0.9375rem", { lineHeight: "1.4" }],        // 15px — section headings
        xl: ["1.25rem", { lineHeight: "1.3" }],          // 20px — page titles
        "2xl": ["1.5rem", { lineHeight: "1.3" }],        // 24px — dashboard title
      },
      spacing: {
        // Dense spacing scale
        "nav-item": "2rem",       // 32px nav item height
        "btn": "2rem",            // 32px button height
        "row": "2.625rem",        // 42px list row height
        "topbar": "3rem",         // 48px top bar
        "sidebar": "13.75rem",    // 220px sidebar width
      },
      colors: {
        // Semantic status colors (pastel)
        status: {
          success: "hsl(153, 30%, 55%)",       // #6BB895
          warning: "hsl(35, 50%, 56%)",         // #D4A86A
          error: "hsl(355, 30%, 62%)",          // #C08488
          info: "hsl(210, 40%, 63%)",           // #7BAAD0
        },
        // Tag/label colors (pastel)
        tag: {
          orange: { bg: "rgba(210,155,70,0.12)", text: "#A07840", dot: "#C4975A" },
          blue: { bg: "rgba(107,159,212,0.12)", text: "#5A85AE", dot: "#7BAAD0" },
          green: { bg: "rgba(94,173,137,0.12)", text: "#4A8E6E", dot: "#6BB895" },
          red: { bg: "rgba(201,123,127,0.12)", text: "#9E5E62", dot: "#C08488" },
          purple: { bg: "rgba(148,130,206,0.12)", text: "#7A6BA8", dot: "#9B8CCE" },
          gray: { bg: "rgba(130,130,148,0.12)", text: "#7A7A8E", dot: "#9A9AAE" },
        },
        // Avatar background colors (pastel)
        avatar: {
          blue: "#7BAAD0",
          purple: "#9B8CCE",
          pink: "#C88BA8",
          amber: "#C4975A",
          teal: "#6DB5C4",
          red: "#C08488",
          green: "#6BB895",
        },
      },
    },
  },
}
export default config
```

---

## 3. Component Overrides — What to Change in Each Shadcn Component

### Button (`components/ui/button.tsx`)

Override the variants to match our compact sizing:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-background hover:bg-secondary hover:text-foreground",
        secondary: "bg-secondary text-foreground hover:bg-secondary/80",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3.5 text-sm",     /* 32px height */
        sm: "h-7 px-2.5 text-xs",           /* 28px */
        lg: "h-9 px-4 text-sm",             /* 36px — max size */
        icon: "h-8 w-8",                     /* 32px square */
        "icon-sm": "h-7 w-7",               /* 28px square */
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

### Badge / Tag (`components/ui/badge.tsx`)

Replace with our tag styling:

```tsx
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0 text-2xs font-medium h-[22px]",
  {
    variants: {
      variant: {
        default: "bg-[rgba(107,159,212,0.12)] text-[#5A85AE]",
        orange: "bg-[rgba(210,155,70,0.12)] text-[#A07840]",
        blue: "bg-[rgba(107,159,212,0.12)] text-[#5A85AE]",
        green: "bg-[rgba(94,173,137,0.12)] text-[#4A8E6E]",
        red: "bg-[rgba(201,123,127,0.12)] text-[#9E5E62]",
        purple: "bg-[rgba(148,130,206,0.12)] text-[#7A6BA8]",
        gray: "bg-[rgba(130,130,148,0.12)] text-[#7A7A8E]",
        // Nav badge (count)
        count: "bg-secondary text-muted-foreground text-2xs min-w-[20px] h-5 justify-center rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Usage: <Badge variant="green"><span className="w-2 h-2 rounded-full bg-[#6BB895]" />Qualified</Badge>
```

### Avatar (`components/ui/avatar.tsx`)

Keep shadcn's Avatar but use these size classes:

```tsx
// Size classes to apply to <Avatar>
// avatar-xs: "h-5 w-5 text-[9px]"
// avatar-sm: "h-6 w-6 text-[10px]"
// avatar-md: "h-8 w-8 text-xs"
// avatar-lg: "h-10 w-10 text-[15px]"
// avatar-xl: "h-16 w-16 text-[22px]"

// Fallback colors — pick deterministically from user ID:
const AVATAR_COLORS = [
  "#7BAAD0", "#9B8CCE", "#C88BA8", "#C4975A",
  "#6DB5C4", "#C08488", "#6BB895", "#9B8CCE"
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
```

### Tabs (`components/ui/tabs.tsx`)

Two variants needed:

```tsx
// Underline tabs (default — for page sections)
<TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 gap-0">
  <TabsTrigger className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground text-muted-foreground px-4 py-2.5 text-sm font-medium bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none">
    Tab Name
  </TabsTrigger>
</TabsList>

// Pill tabs (for view switchers like "For me | Popular | Recent")
<TabsList className="bg-transparent h-auto p-0 gap-0.5">
  <TabsTrigger className="border border-border rounded-md px-2.5 py-1 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground data-[state=active]:shadow-none">
    Tab Name
  </TabsTrigger>
</TabsList>
```

### Table (`components/ui/table.tsx`)

Override styles:

```tsx
const Table = forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table ref={ref} className={cn("w-full caption-bottom", className)} {...props} />
  )
)

const TableHeader = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
  )
)

const TableHead = forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th ref={ref} className={cn(
      "text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2 text-left whitespace-nowrap [&:has([role=checkbox])]:pr-0",
      className
    )} {...props} />
  )
)

const TableCell = forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn(
      "text-sm px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] [&:has([role=checkbox])]:pr-0",
      className
    )} {...props} />
  )
)

const TableRow = forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn(
      "border-b border-border/50 transition-colors hover:bg-secondary/50 data-[state=selected]:bg-accent",
      className
    )} {...props} />
  )
)
```

### Toggle / Switch (`components/ui/switch.tsx`)

No changes needed — shadcn's Switch already looks correct. Just ensure the primary color variable is set.

### Card (`components/ui/card.tsx`)

Remove shadow, ensure border only:

```tsx
const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground", className)} {...props} />
    // NOTE: no shadow-sm — that's the key difference
  )
)
```

### Input (`components/ui/input.tsx`)

Compact height:

```tsx
const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(
      "flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      className
    )} {...props} />
  )
)
```

### Select (`components/ui/select.tsx`)

Match 32px height:

```tsx
// SelectTrigger override
className="h-8 text-sm px-2.5"
```

### Dialog / Modal

Keep shadcn default but override the overlay to be more subtle in dark mode:

```tsx
// DialogOverlay
className="bg-black/40 dark:bg-black/60"
```

### Separator

Use as-is — it maps to `--border`.

### Tooltip

Use as-is — already dark bg + white text.

---

## 4. Custom Components to Build

These don't exist in shadcn and need to be created:

### NavItem

```tsx
interface NavItemProps {
  icon: React.ReactNode
  label: string
  badge?: number
  active?: boolean
  indented?: boolean
  onClick?: () => void
}

function NavItem({ icon, label, badge, active, indented, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 h-8 w-full rounded-md text-sm font-medium transition-colors",
        indented ? "pl-9 pr-3" : "px-3",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <span className={cn("w-4 h-4 flex-shrink-0", active && "text-accent-foreground")}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {badge !== undefined && (
        <Badge variant="count" className="ml-auto">{badge}</Badge>
      )}
    </button>
  )
}
```

### SectionLabel

```tsx
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-2xs font-medium uppercase tracking-wider text-muted-foreground px-3 pt-4 pb-1">
      {children}
    </div>
  )
}
```

### ListRow

```tsx
interface ListRowProps {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
}

function ListRow({ children, active, onClick }: ListRowProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-6 min-h-[42px] py-2 border-b border-border/50 cursor-pointer transition-colors hover:bg-secondary/50",
        active && "bg-accent"
      )}
    >
      {children}
    </div>
  )
}
```

### PropertyGroup (detail sidebar)

```tsx
function PropertyGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-2xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-sm flex items-center gap-1.5">{children}</div>
    </div>
  )
}
```

### EmptyState

```tsx
function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-12">
      <div className="w-[120px] h-[120px] text-muted-foreground/40 mb-4">{icon}</div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
```

### SettingRow

```tsx
function SettingRow({
  icon,
  title,
  description,
  children, // control (toggle, button, etc.)
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-4 px-6 py-[18px] border-b border-border/50 last:border-b-0">
      <span className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="flex-shrink-0 ml-auto">{children}</div>
    </div>
  )
}
```

---

## 5. Layout Shell

```tsx
// app/layout.tsx or your root layout
function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-[220px] min-w-[220px] h-screen overflow-y-auto border-r bg-muted p-2 flex flex-col">
        {/* Sidebar content */}
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </main>
    </div>
  )
}

// Top bar
function TopBar({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center h-12 px-6 border-b flex-shrink-0 gap-3">
      <h1 className="text-sm font-semibold">{title}</h1>
      <div className="ml-auto flex items-center gap-1">{children}</div>
    </div>
  )
}
```

---

## 6. Icon Library

Use **Lucide React** (shadcn's default). Always apply these classes:

```tsx
<SomeIcon className="w-4 h-4" strokeWidth={1.5} />
```

- Size: `w-4 h-4` (16px) for nav/inline, `w-5 h-5` (20px) for settings icons
- Stroke: `strokeWidth={1.5}` — thinner than Lucide's default 2
- Color: inherit from parent (uses `currentColor`)

---

## 7. Dark Mode Setup

Use `next-themes` (shadcn's recommended approach):

```tsx
// app/layout.tsx
import { ThemeProvider } from "next-themes"

<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
  {children}
</ThemeProvider>
```

The `.dark` class in globals.css handles all variable swaps automatically.

---

## 8. Key Tailwind Classes Reference

Quick reference for the most common patterns:

| Pattern | Classes |
|---------|---------|
| Page title | `text-xl font-semibold` |
| Section heading | `text-sm font-semibold` |
| Section label | `text-2xs font-medium uppercase tracking-wider text-muted-foreground` |
| Body text | `text-sm` |
| Meta/timestamp | `text-xs text-muted-foreground` |
| Card | `border rounded-lg bg-card` (NO shadow) |
| List row hover | `hover:bg-secondary/50` |
| Active nav | `bg-accent text-accent-foreground` |
| Truncate text | `truncate` or `overflow-hidden text-ellipsis whitespace-nowrap` |
| Dense list row | `flex items-center gap-2 px-6 min-h-[42px] py-2 border-b border-border/50` |
| Sidebar width | `w-[220px] min-w-[220px]` |
| Top bar | `h-12 px-6 border-b flex items-center` |
| Tag with dot | `inline-flex items-center gap-1 rounded-full px-2 h-[22px] text-2xs font-medium` |

---

## 9. Anti-Patterns in Shadcn Context

Things to actively REMOVE or AVOID from shadcn defaults:

1. **Remove `shadow-sm` from Card** — shadcn adds it by default
2. **Remove `shadow-sm` from Popover/DropdownMenu** — use `shadow-md` border combo instead
3. **Don't use `size="lg"` buttons** — max is `size="default"` (32px)
4. **Don't use shadcn's default `text-sm`** — our base is 13px (between xs and sm)
5. **Don't use `ring-2`** — use `ring-1` for focus states
6. **Don't use Sonner/toast defaults** — customize to bottom-right, compact styling
7. **Don't use AlertDialog for confirmations** — prefer inline actions
8. **Never use `bg-gray-*` directly** — always use semantic variables

---

## 10. Checklist Before Each Component

- [ ] Uses semantic color variables (not hardcoded hex)
- [ ] 32px button heights max
- [ ] Cards have border, NO shadow
- [ ] Tags use pastel palette with dot indicators
- [ ] Text follows typography scale (no arbitrary sizes)
- [ ] Dense spacing (8-12px padding on interactive elements)
- [ ] Hover states use `bg-secondary/50` only
- [ ] Icons are 16px with 1.5 stroke weight
- [ ] Timestamps use relative format
- [ ] Looks correct in both light and dark mode
