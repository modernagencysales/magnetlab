// ─── Component Heights (px) ──────────────────────────────────────────────────
export const heights = {
  navItem: 32,
  button: 32,
  buttonSm: 28,
  buttonLg: 36, // absolute max
  input: 32,
  listRow: 42,
  topBar: 48,
  tag: 22,
  iconButton: 32,
  iconButtonSm: 28,
} as const;

// ─── Component Widths (px) ───────────────────────────────────────────────────
export const widths = {
  sidebar: 220,
  settingsNav: 180,
  masterDetailList: 360,
  settingsContent: 720,
  detailPropertySidebar: 280,
} as const;

// ─── Tailwind Spacing Tokens ─────────────────────────────────────────────────
// These map to rem values in the Tailwind preset.
export const spacingTokens = {
  'nav-item': '2rem', // 32px
  btn: '2rem', // 32px
  'btn-sm': '1.75rem', // 28px
  'btn-lg': '2.25rem', // 36px
  row: '2.625rem', // 42px
  topbar: '3rem', // 48px
  sidebar: '13.75rem', // 220px
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────
export const radius = {
  sm: '4px', // tags, small elements
  md: '6px', // buttons, inputs, cards (DEFAULT)
  lg: '8px', // larger cards, modals
  xl: '12px', // major containers (max for non-pill elements)
  full: '9999px', // pills, avatars, badges
} as const;

// ─── Shadows (floating elements ONLY) ────────────────────────────────────────
export const shadows = {
  popover: '0 4px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
  dropdown: '0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)',
  modal: '0 16px 48px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04)',
  popoverDark: '0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06)',
  dropdownDark: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06)',
  modalDark: '0 16px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.06)',
} as const;

// ─── Transitions ─────────────────────────────────────────────────────────────
export const transitions = {
  fast: '120ms ease', // color changes, opacity
  normal: '200ms ease', // layout shifts, transforms
  slow: '300ms ease', // modals, panels
} as const;

// ─── Icon Sizes ──────────────────────────────────────────────────────────────
export const iconSize = {
  sm: 14, // compact inline
  md: 16, // default (nav, buttons, lists)
  lg: 20, // settings, larger contexts
} as const;

export const iconStrokeWidth = 1.5;
