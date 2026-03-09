# UI Design System: Linear/Clarify-Class SaaS Application

You are redesigning an existing SaaS application to match the design language of Linear, Clarify, and Kondo — professional, dense, power-user-focused tools. Follow every specification below precisely. When modifying existing components, transform them to match this system exactly. Do not preserve old styling patterns.

The color palette uses **muted, pastel tones** — never saturated primaries. The overall feel is sophisticated and calm, like a precision instrument.

---

## 1. GLOBAL FOUNDATION

### Font Stack
```css
font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```
If Inter is not available, use the system stack. Never use serif, monospace (except for code), or decorative fonts anywhere in the UI.

### Base Font Size & Rendering
```css
html {
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

### Typography Scale (exact sizes)
| Role | Size | Weight | Color (light) | Color (dark) | Line-height | Letter-spacing |
|------|------|--------|---------------|--------------|-------------|----------------|
| Page title | 20px | 600 | #111111 | #E2E2EA | 1.3 | -0.01em |
| Section heading | 14px | 600 | #111111 | #E2E2EA | 1.4 | -0.005em |
| Sidebar section label | 11px | 500 | #9CA3AF | #555568 | 1.2 | 0.05em (uppercase) |
| Nav item | 13px | 500 | #374151 | #8888A0 | 1.4 | 0 |
| Body / list primary | 13px | 400 | #1F2937 | #D4D4DD | 1.5 | 0 |
| Body secondary / meta | 12px | 400 | #6B7280 | #8888A0 | 1.4 | 0 |
| Small / timestamp | 12px | 400 | #9CA3AF | #555568 | 1.3 | 0 |
| Tag text | 11px | 500 | varies | varies | 1.2 | 0.01em |
| Table header | 12px | 500 | #9CA3AF | #555568 | 1.3 | 0.04em (uppercase) |
| Button text | 13px | 500 | varies | varies | 1 | 0 |
| Tooltip | 12px | 400 | #FFFFFF | #E2E2EA | 1.3 | 0 |

### Color Palette

**Light Mode:**
```css
--bg-primary: #FFFFFF;
--bg-secondary: #FAFAFA;          /* sidebar, subtle backgrounds */
--bg-tertiary: #F5F5F5;           /* hover states, input backgrounds */
--bg-elevated: #FFFFFF;            /* cards, popovers */
--border-primary: #E5E5E5;        /* card borders, dividers */
--border-secondary: #EBEBEB;      /* subtle dividers */
--border-focus: #7B83C9;          /* focus rings */
--text-primary: #111111;
--text-secondary: #6B7280;
--text-tertiary: #9CA3AF;
--text-link: #7B83C9;
--accent: #7B83C9;                /* pastel indigo — ONE accent color only */
--accent-hover: #6B74BE;
--accent-subtle: #F2F2FC;         /* tinted backgrounds */
--success: #5EAD89;               /* pastel sage green */
--warning: #D4A24C;               /* pastel warm amber */
--error: #C97B7F;                 /* pastel dusty rose */
--info: #6B9FD4;                  /* pastel steel blue */
```

**Dark Mode:**
```css
--bg-primary: #111120;            /* deep navy — darker than typical */
--bg-secondary: #0D0D1A;          /* sidebar — near-black navy */
--bg-tertiary: #1A1A30;           /* hover, elevated surfaces */
--bg-elevated: #16162A;           /* cards, popovers */
--border-primary: #232340;
--border-secondary: #2A2A45;
--border-focus: #8B93D6;
--text-primary: #E2E2EA;
--text-secondary: #8888A0;
--text-tertiary: #555568;
--text-link: #9BA3E0;
--accent: #9BA3E0;                /* lighter pastel for dark backgrounds */
--accent-hover: #A8AFE8;
--accent-subtle: #1C1C38;
--success: #6BC99A;
--warning: #E8B95A;
--error: #D98A8E;
--info: #7FAEE0;
```

**CRITICAL dark mode rule**: Background must have a blue/purple undertone (hsl 235, 30-35%, 8-12%). Never use neutral gray (#1a1a1a) or pure black (#000000). This gives the distinctive rich-dark feel.

**CRITICAL color rule**: All status/tag/label colors use muted, desaturated pastels. Never use saturated primaries (#FF0000, #00FF00, #0000FF). Every color should feel like it's been mixed with gray.

### Tag / Label Color Palette (Pastel)

| Name | Background (light) | Text (light) | Dot color | Bg (dark) | Text (dark) |
|------|-------------------|-------------|-----------|-----------|-------------|
| Orange | rgba(210,155,70,0.12) | #A07840 | #C4975A | rgba(210,155,70,0.15) | #D4B07A |
| Blue | rgba(107,159,212,0.12) | #5A85AE | #7BAAD0 | rgba(107,159,212,0.15) | #8DB8E0 |
| Green | rgba(94,173,137,0.12) | #4A8E6E | #6BB895 | rgba(94,173,137,0.15) | #7ECAA8 |
| Red | rgba(201,123,127,0.12) | #9E5E62 | #C08488 | rgba(201,123,127,0.15) | #D4999C |
| Purple | rgba(148,130,206,0.12) | #7A6BA8 | #9B8CCE | rgba(148,130,206,0.15) | #B0A0DA |
| Gray | rgba(130,130,148,0.12) | #7A7A8E | #9A9AAE | rgba(130,130,148,0.12) | #9A9AAE |

### Avatar Background Colors (Pastel)
```
#7BAAD0 (steel blue)
#9B8CCE (soft purple)
#C88BA8 (dusty pink)
#C4975A (warm amber)
#6DB5C4 (muted teal)
#C08488 (dusty rose)
#6BB895 (sage green)
```
Pick deterministically from user ID/name hash.

### Border Radius Scale
```css
--radius-sm: 4px;    /* tags, small elements */
--radius-md: 6px;    /* buttons, inputs, cards */
--radius-lg: 8px;    /* larger cards, modals */
--radius-xl: 12px;   /* major containers */
--radius-full: 9999px; /* pills, avatars, badges */
```

### Shadow (used sparingly — only for floating elements)
```css
--shadow-popover: 0 4px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
--shadow-dropdown: 0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);
--shadow-modal: 0 16px 48px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04);
/* Dark mode shadows use higher opacity: 0.4-0.6 */
```
**Rule**: Cards, containers, list items, and page sections NEVER have shadows. Only floating elements (dropdowns, popovers, modals, tooltips) use shadows. All non-floating containers use borders instead.

### Transitions
```css
--transition-fast: 120ms ease;     /* color changes, opacity */
--transition-normal: 200ms ease;   /* layout shifts, transforms */
--transition-slow: 300ms ease;     /* modals, panels */
```

---

## 2. LAYOUT ARCHITECTURE

### Page Shell
```
┌──────────────────────────────────────────────────────────┐
│ ┌─────────┐ ┌─────────────────────────────────────────┐  │
│ │         │ │  Top Bar (optional, 48px)               │  │
│ │ Sidebar │ ├─────────────────────────────────────────┤  │
│ │ 220px   │ │                                         │  │
│ │ fixed   │ │  Main Content Area                      │  │
│ │         │ │  (scrolls independently)                │  │
│ │         │ │                                         │  │
│ └─────────┘ └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Master-Detail Pattern (Inbox, Conversations)
```
┌─────────┬──────────────────┬────────────────────────┐
│ Sidebar │  List Panel      │  Detail Panel          │
│ 220px   │  320-400px       │  fills remaining       │
│         │  scrolls         │  scrolls independently │
│         │  border-right    │                        │
└─────────┴──────────────────┴────────────────────────┘
```

### Settings / Forms
Content max-width 720px, centered with auto margins.

---

## 3. SIDEBAR (220px fixed)

- Nav items: 32px height, 12px horizontal padding, 6px border-radius
- Active item: subtle tinted background (`--accent-subtle`) + accent text color
- Section labels: 11px uppercase, muted, 0.05em letter-spacing
- Badge counts: 11px text in 20px-height pill, muted background
- Child items: 36px left padding (12px base + 24px indent)
- Icons: 16px, 1.5px stroke weight, monochrome (inherits text color)

---

## 4. TOP BAR (48px height)

- Page title: 14px semibold
- Actions aligned right
- Border-bottom only

### Tabs
**Underline tabs**: 2px bottom border on active, text-primary color
**Pill tabs**: border-based, active has subtle fill

---

## 5. LIST VIEWS

- Row height: 40-48px
- Padding: 8px 24px
- Border-bottom: 1px subtle divider
- Hover: subtle background change only
- Text truncation with ellipsis on all primary text
- Metadata (tags, avatars, dates) right-aligned, flowing horizontally
- Group headers: 13px medium weight, muted color, NO background

---

## 6. TABLES

- NO vertical borders ever
- Horizontal dividers only
- Headers: 12px uppercase, medium weight, muted, sticky
- Cells: 13px, truncate with ellipsis, max-width 200px
- Row hover: subtle background

---

## 7. DETAIL VIEW

- Content area: 32px 48px padding, max-width 780px
- H1: 20-24px semibold
- H2: 15-16px semibold, 28px top margin
- Body: 14px, 1.6 line-height
- Properties sidebar: 260-280px, border-left

---

## 8. CARDS

- Border: 1px solid border-primary
- Border-radius: 8px
- NO shadow, NO gradient
- Padding: 16-20px
- Cards for drafts/widgets only — primary data uses lists/tables

---

## 9. SETTINGS PAGES

- Sidebar nav (180px) + centered content (720px max)
- Settings grouped in bordered sections with 8px border-radius
- Each row: icon + title + description left, control right
- Controls: toggle switches, segmented controls, buttons
- Row separator: 1px bottom border

---

## 10. BUTTONS

- Max height: 32px (36px for large, rarely used)
- Padding: 0 14px
- Border-radius: 6px
- Font: 13px medium weight
- Primary: accent background, white text
- Secondary: transparent + border
- Ghost: no border, text-secondary, hover shows background
- Icon buttons: 32px square
- NEVER use large/hero-sized buttons

---

## 11. FORM CONTROLS

- Inputs: 32px height, 1px border, 6px radius
- Selects: 32px height, subtle border
- Toggle switches: 40px wide, 22px tall
- Segmented controls: border-based pills, active has inverted fill
- Focus: 1px ring in accent color + subtle glow

---

## 12. ICONS

- Lucide or similar thin-stroke icon set
- Default: 16px, strokeWidth 1.5
- Settings: 20px
- Color: inherit from parent text color
- Status dots: 8px circles, colored per status

---

## 13. EMPTY STATES

- Centered vertically and horizontally
- Hand-drawn / sketch-style line illustration (~120px)
- Monochrome, 40% opacity
- Short descriptive text below (14px muted)
- NO corporate/colorful illustrations

---

## 14. TIMESTAMPS

Always relative: "2h", "3d", "9 days ago", "Feb 23"
Font: 12px, muted color, right-aligned

---

## 15. CHARTS & ANALYTICS

- Charts inside bordered cards (no shadow)
- Thin lines (2px stroke), small circle markers
- Grid lines: dashed, very subtle
- Max 2-3 colors per chart, all from pastel palette
- Legend: 12px, centered above chart

---

## 16. RESPONSIVE

Desktop-first. Minimum 1024px assumed.
- Sidebar collapses at narrow widths
- Tables scroll horizontally
- Master-detail stacks to single panel

---

## 17. ANTI-PATTERNS — NEVER DO THESE

1. Never use card shadows for non-floating elements
2. Never use gradients on backgrounds, buttons, or surfaces
3. Never use rounded corners larger than 12px
4. Never use colored/gradient page section backgrounds
5. Never use buttons taller than 36px
6. Never use centered layouts for list/table content
7. Never use colorful empty state illustrations
8. Never use more than ONE accent color
9. Never use thick borders (max 1px, except 2px active tab underline)
10. Never use letter-spacing on body text
11. Never use animated loaders larger than 20px
12. Never use decorative dividers or ornaments
13. Never use saturated primary colors (#FF0000, #00FF00, etc.) — always pastel
14. Never use pure black (#000000) for dark mode backgrounds
15. Never use vertical borders in tables
16. Never use card grids for primary data — use lists/tables
17. Never use modals when inline editing would work

---

## 18. IMPLEMENTATION CHECKLIST

When modifying each component/page:

- [ ] Replace all colors with design system variables (no hardcoded hex outside the palette)
- [ ] All tag/label colors use the pastel palette table above
- [ ] Avatar colors use the pastel avatar palette
- [ ] Remove all box-shadows from cards and containers
- [ ] Replace shadows with 1px borders
- [ ] Reduce padding/margins to match dense spacing
- [ ] Buttons are 32px height max
- [ ] Cards have border + no shadow
- [ ] Text truncates with ellipsis where appropriate
- [ ] Hover states are subtle background changes only
- [ ] Sidebar matches 220px fixed spec
- [ ] Dark mode uses deep navy (#111120 base), not gray or black
- [ ] Only ONE accent color used throughout
- [ ] No decorative elements, gradients, or illustrations
- [ ] Icons are 16px with 1.5 stroke weight
- [ ] Timestamps use relative format
- [ ] Tested in both light and dark mode
