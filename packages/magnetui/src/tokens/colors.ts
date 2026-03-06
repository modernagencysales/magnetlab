// ─── Accent ──────────────────────────────────────────────────────────────────
export const accent = {
  light: '#7B83C9',
  lightHover: '#6B74BE',
  lightSubtle: '#F2F2FC',
  dark: '#9BA3E0',
  darkHover: '#A8AFE8',
  darkSubtle: '#1C1C38',
} as const;

// ─── Backgrounds ─────────────────────────────────────────────────────────────
export const backgrounds = {
  light: {
    primary: '#FFFFFF',
    secondary: '#FAFAFA',
    tertiary: '#F5F5F5',
    elevated: '#FFFFFF',
  },
  dark: {
    primary: '#111120',
    secondary: '#0D0D1A',
    tertiary: '#1A1A30',
    elevated: '#16162A',
  },
} as const;

// ─── Borders ─────────────────────────────────────────────────────────────────
export const borders = {
  light: {
    primary: '#E5E5E5',
    secondary: '#EBEBEB',
    focus: '#7B83C9',
  },
  dark: {
    primary: '#232340',
    secondary: '#2A2A45',
    focus: '#8B93D6',
  },
} as const;

// ─── Text ────────────────────────────────────────────────────────────────────
export const text = {
  light: {
    primary: '#111111',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    link: '#7B83C9',
  },
  dark: {
    primary: '#E2E2EA',
    secondary: '#8888A0',
    tertiary: '#555568',
    link: '#9BA3E0',
  },
} as const;

// ─── Status (pastel) ────────────────────────────────────────────────────────
export const status = {
  success: { light: '#5EAD89', dark: '#6BC99A' },
  warning: { light: '#D4A24C', dark: '#E8B95A' },
  error: { light: '#C97B7F', dark: '#D98A8E' },
  info: { light: '#6B9FD4', dark: '#7FAEE0' },
} as const;

export const statusColors = {
  success: 'hsl(153, 30%, 55%)',
  warning: 'hsl(35, 50%, 56%)',
  error: 'hsl(355, 30%, 62%)',
  info: 'hsl(210, 40%, 63%)',
} as const;

// ─── Tag / Label Colors (pastel) ────────────────────────────────────────────
export type TagColor = 'orange' | 'blue' | 'green' | 'red' | 'purple' | 'gray';

export interface TagColorValue {
  bg: { light: string; dark: string };
  text: { light: string; dark: string };
  dot: string;
}

export const tagColors: Record<TagColor, TagColorValue> = {
  orange: {
    bg: { light: 'rgba(210,155,70,0.12)', dark: 'rgba(210,155,70,0.15)' },
    text: { light: '#A07840', dark: '#D4B07A' },
    dot: '#C4975A',
  },
  blue: {
    bg: { light: 'rgba(107,159,212,0.12)', dark: 'rgba(107,159,212,0.15)' },
    text: { light: '#5A85AE', dark: '#8DB8E0' },
    dot: '#7BAAD0',
  },
  green: {
    bg: { light: 'rgba(94,173,137,0.12)', dark: 'rgba(94,173,137,0.15)' },
    text: { light: '#4A8E6E', dark: '#7ECAA8' },
    dot: '#6BB895',
  },
  red: {
    bg: { light: 'rgba(201,123,127,0.12)', dark: 'rgba(201,123,127,0.15)' },
    text: { light: '#9E5E62', dark: '#D4999C' },
    dot: '#C08488',
  },
  purple: {
    bg: { light: 'rgba(148,130,206,0.12)', dark: 'rgba(148,130,206,0.15)' },
    text: { light: '#7A6BA8', dark: '#B0A0DA' },
    dot: '#9B8CCE',
  },
  gray: {
    bg: { light: 'rgba(130,130,148,0.12)', dark: 'rgba(130,130,148,0.12)' },
    text: { light: '#7A7A8E', dark: '#9A9AAE' },
    dot: '#9A9AAE',
  },
} as const;

// ─── Avatar Colors (pastel) ─────────────────────────────────────────────────
export const avatarColors = [
  '#7BAAD0', // steel blue
  '#9B8CCE', // soft purple
  '#C88BA8', // dusty pink
  '#C4975A', // warm amber
  '#6DB5C4', // muted teal
  '#C08488', // dusty rose
  '#6BB895', // sage green
] as const;

/**
 * Deterministically pick an avatar color from a user name or ID.
 */
export function getAvatarColor(nameOrId: string): string {
  let hash = 0;
  for (let i = 0; i < nameOrId.length; i++) {
    hash = nameOrId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

// ─── Chart Colors (pastel) ──────────────────────────────────────────────────
export const chartColors = {
  light: {
    1: 'hsl(233, 30%, 63%)', // indigo
    2: 'hsl(35, 50%, 56%)', // amber
    3: 'hsl(153, 30%, 55%)', // green
    4: 'hsl(260, 30%, 68%)', // purple
    5: 'hsl(355, 30%, 62%)', // rose
  },
  dark: {
    1: 'hsl(233, 40%, 74%)',
    2: 'hsl(35, 50%, 65%)',
    3: 'hsl(153, 30%, 64%)',
    4: 'hsl(260, 30%, 76%)',
    5: 'hsl(355, 30%, 72%)',
  },
} as const;
