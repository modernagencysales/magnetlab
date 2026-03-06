# MagnetLab UI Redesign — Developer Brief

## What We're Doing

Redesigning MagnetLab's frontend to match the Linear/Clarify/Kondo design language: dense, professional, pastel color palette, no shadows on cards, compact spacing.

**Live mockup**: https://ui-mockup-six.vercel.app (toggle dark mode with bottom-right button)

## Reference Documents

You have two design docs — use both as context for EVERY UI task:

1. **`DESIGN_SYSTEM_PROMPT.md`** — Visual spec: colors, spacing, typography, patterns, anti-patterns. Paste this into any AI session when working on UI.
2. **`SHADCN_IMPLEMENTATION_GUIDE.md`** — Technical translation: exact globals.css values, tailwind.config.ts extensions, component override code, custom component templates.

---

## What's Already Installed (no new deps needed)

| Package | Version | Status |
|---------|---------|--------|
| shadcn/ui (Radix primitives) | 14 components | Already installed |
| Tailwind CSS | 3.4.11 | Already installed |
| next-themes | 0.4.6 | Already installed, dark mode works |
| Lucide React | 0.469.0 | Already installed |
| Recharts | 2.15.4 | Already installed |
| Framer Motion | 3.31 | Already installed |
| Inter font | Google Fonts | Already configured in layout.tsx |
| Sonner (toasts) | 2.0.7 | Already installed |

**You should NOT need to `npm install` anything for this redesign.**

---

## Migration Strategy: Incremental, Not Big Bang

Do NOT rewrite the entire app at once. Work page by page:

### Phase 1 — Foundation (do this first, everything else depends on it)
1. Replace `src/app/globals.css` theme variables (light + dark) with the values from `SHADCN_IMPLEMENTATION_GUIDE.md`
2. Update `tailwind.config.ts` with extended fontSize, spacing, and color scales
3. Override the 15 existing shadcn components in `src/components/ui/` — apply the compact sizing, remove shadows, update radii

After Phase 1, the entire app will shift colors/fonts automatically because everything uses CSS variables. Some things will look off (spacing, custom components) but the palette will be correct.

### Phase 2 — Layout Shell
4. Rebuild the sidebar navigation to match spec (220px fixed, section labels, nav items, badges)
5. Rebuild the top bar (48px, page title, action buttons)
6. Set up the master-detail layout pattern as a reusable component

### Phase 3 — Page by Page
Work through each page, transforming to the new patterns:
- Dashboard / Home
- Lead magnets list
- Lead magnet detail / wizard
- Content pipeline
- Knowledge base
- Settings
- Any remaining pages

### Phase 4 — Polish
- Empty states (sketch-style illustrations)
- Loading states (subtle skeletons)
- Responsive breakpoints
- Dark mode QA pass

---

## Key Files to Modify

### Must Change (Phase 1)
| File | What to do |
|------|-----------|
| `src/app/globals.css` | Replace ALL HSL values with new palette. Dark mode bg goes from neutral gray to navy (#111120). |
| `tailwind.config.ts` | Add custom fontSize scale (2xs through 2xl), spacing tokens, pastel color palette, avatar colors. Remove/replace the `brand` purple palette. |
| `src/components/ui/button.tsx` | Height 32px, padding 0 14px, text-sm. Remove any large variants. |
| `src/components/ui/card.tsx` | Remove `shadow-sm`. Border only. |
| `src/components/ui/badge.tsx` | Rework to tag system with dot indicators + pastel colors. |
| `src/components/ui/tabs.tsx` | Add underline variant + pill variant. |
| `src/components/ui/input.tsx` | Height 32px. |
| `src/components/ui/dialog.tsx` | Reduce overlay opacity, compact padding. |
| `src/components/ui/skeleton.tsx` | Keep as-is, just inherits new colors. |
| `src/components/ui/sidebar.tsx` | Major rework — match 220px spec with section labels, compact nav items. |

### Must Create (Phase 2-3)
| Component | Location | Purpose |
|-----------|----------|---------|
| `NavItem` | `src/components/ui/nav-item.tsx` | Sidebar navigation item with icon, label, badge, active state |
| `SectionLabel` | `src/components/ui/section-label.tsx` | Uppercase muted section header for sidebar/lists |
| `ListRow` | `src/components/ui/list-row.tsx` | Dense clickable row for issue lists, inbox, etc. |
| `PropertyGroup` | `src/components/ui/property-group.tsx` | Label + value pair for detail sidebars |
| `SettingRow` | `src/components/ui/setting-row.tsx` | Icon + title + description + control row |
| `EmptyState` | `src/components/ui/empty-state.tsx` | Centered illustration + message |
| `StatusDot` | `src/components/ui/status-dot.tsx` | Small colored circle for issue/lead status |
| `TopBar` | `src/components/layout/top-bar.tsx` | 48px page header with title + actions |
| `MasterDetail` | `src/components/layout/master-detail.tsx` | Two-panel layout with list + detail |

---

## Critical Rules

### Colors
- **ONE accent color**: pastel indigo (`#7B83C9` light / `#9BA3E0` dark). No other accent.
- **All status/tag colors are pastel** — desaturated, mixed with gray. See the tag color table in the design doc.
- **Dark mode background is navy** (`#111120`), NOT gray, NOT black. Must have blue/purple undertone.
- The existing `brand` purple palette in tailwind.config.ts should be replaced with the new accent colors.

### Spacing & Density
- This is a power-user tool. **Dense is correct.** Don't add padding "to make it breathe."
- Nav items: 32px height
- Buttons: 32px height (36px absolute max)
- List rows: 40-48px height
- Top bar: 48px height
- Sidebar: 220px wide

### Shadows
- Cards: NO shadow. Border only.
- Dropdowns/popovers/modals: shadow is OK (they float).
- Everything else: NO shadow.

### Typography
- Base font size: 13px (not 14px, not 16px)
- Use the exact typography scale from the design doc
- Sidebar section labels: 11px uppercase with letter-spacing
- Never use font sizes outside the scale

### Icons
- Lucide React (already installed)
- Always: `className="w-4 h-4" strokeWidth={1.5}`
- Settings/larger contexts: `className="w-5 h-5" strokeWidth={1.5}`
- The default Lucide strokeWidth is 2 — we want 1.5 (thinner)

---

## Dark Mode

Already works via next-themes + `class` attribute. Current default theme is `dark`. The globals.css `.dark` block handles all variable swaps.

**Key dark mode changes from current:**
- Background shifts from neutral gray to deep navy with blue undertone
- Borders get more blue (from gray to navy-tinted)
- Tag colors get slightly brighter (higher opacity backgrounds)
- Text colors stay similar but slightly warmer

**Test dark mode on every component.** The mockup shows both modes — use it as reference.

---

## Existing Component Directories

Don't restructure these — just restyle in place:
- `src/components/ui/` — shadcn base components (modify these)
- `src/components/ds/` — custom design system components (modify these)
- `src/components/wizard/` — lead magnet wizard (restyle)
- `src/components/dashboard/` — dashboard layouts (restyle)
- `src/components/content/` — content pipeline UI (restyle)
- `src/components/settings/` — settings pages (restyle)
- `src/components/leads/` — lead management (restyle)
- `src/components/funnel/` — funnel builder (restyle)

---

## What NOT to Change

- **No backend changes.** This is purely frontend.
- **No route changes.** Same URLs, same page structure.
- **No data model changes.** Components consume the same props/data.
- **Don't remove Framer Motion** — still used for transitions.
- **Don't remove Tiptap** — still used for rich text editing.
- **Don't change the font** — Inter is correct.
- **Don't add new npm packages** unless absolutely necessary.

---

## QA Checklist Per Page

Before marking any page as done:

- [ ] Matches mockup visual feel (side-by-side compare)
- [ ] Light mode looks correct
- [ ] Dark mode looks correct (navy bg, not gray/black)
- [ ] Only ONE accent color visible
- [ ] No card shadows
- [ ] All buttons are 32px height
- [ ] Tags use pastel palette with dot indicators
- [ ] Text truncates properly (no overflow/wrapping in lists)
- [ ] Hover states are subtle (bg change only, no color shifts)
- [ ] Icons are 16px with thin strokes
- [ ] Timestamps show relative time
- [ ] No regressions on existing functionality
- [ ] Accessible (keyboard navigation still works, contrast ratios OK)
