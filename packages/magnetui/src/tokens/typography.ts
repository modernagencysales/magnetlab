// ─── Font Family ─────────────────────────────────────────────────────────────
export const fontFamily = {
  sans: [
    'Inter',
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica',
    'Arial',
    'sans-serif',
  ],
} as const;

// ─── Font Size Scale ─────────────────────────────────────────────────────────
// Base font size is 13px (text-sm). This is denser than Tailwind's default 14px.
export const fontSize = {
  '2xs': { size: '0.6875rem', lineHeight: '1.2' }, // 11px — tags, section labels, uppercase
  xs: { size: '0.75rem', lineHeight: '1.3' }, // 12px — meta, timestamps, table headers
  sm: { size: '0.8125rem', lineHeight: '1.4' }, // 13px — body, nav, buttons (BASE)
  base: { size: '0.875rem', lineHeight: '1.5' }, // 14px — detail body, section headings
  lg: { size: '0.9375rem', lineHeight: '1.4' }, // 15px — section headings
  xl: { size: '1.25rem', lineHeight: '1.3' }, // 20px — page titles
  '2xl': { size: '1.5rem', lineHeight: '1.3' }, // 24px — dashboard title
} as const;

// ─── Font Weight ─────────────────────────────────────────────────────────────
export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

// ─── Typography Roles ────────────────────────────────────────────────────────
// Predefined roles mapping to size + weight + color combinations.
export const typographyRoles = {
  pageTitle: { size: 'xl', weight: 'semibold', letterSpacing: '-0.01em' },
  sectionHeading: { size: 'base', weight: 'semibold', letterSpacing: '-0.005em' },
  sectionLabel: {
    size: '2xs',
    weight: 'medium',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  },
  navItem: { size: 'sm', weight: 'medium', letterSpacing: '0' },
  body: { size: 'sm', weight: 'normal', letterSpacing: '0' },
  bodySecondary: { size: 'xs', weight: 'normal', letterSpacing: '0' },
  timestamp: { size: 'xs', weight: 'normal', letterSpacing: '0' },
  tagText: { size: '2xs', weight: 'medium', letterSpacing: '0.01em' },
  tableHeader: {
    size: 'xs',
    weight: 'medium',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  buttonText: { size: 'sm', weight: 'medium', letterSpacing: '0' },
  tooltip: { size: 'xs', weight: 'normal', letterSpacing: '0' },
} as const;

export type TypographyRole = keyof typeof typographyRoles;
