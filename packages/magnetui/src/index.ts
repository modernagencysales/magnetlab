// ─── MagnetUI Design System ──────────────────────────────────────────────────
// @magnetlab/magnetui
//
// A design system built on shadcn/ui for MagnetLab.
// Design language: Linear / Clarify / Kondo — dense, professional, pastel.
// ─────────────────────────────────────────────────────────────────────────────

// Tokens
export {
  // Colors
  accent,
  backgrounds,
  borders,
  text,
  status,
  statusColors,
  tagColors,
  avatarColors,
  getAvatarColor,
  chartColors,
  type TagColor,
  type TagColorValue,
  // Typography
  fontFamily,
  fontSize,
  fontWeight,
  typographyRoles,
  type TypographyRole,
  // Spacing
  heights,
  widths,
  spacingTokens,
  radius,
  shadows,
  transitions,
  iconSize,
  iconStrokeWidth,
} from './tokens';

// Utilities
export { cn } from './utils';

// Hooks
export { useIsMobile } from './hooks/use-mobile';

// Components
export * from './components';
