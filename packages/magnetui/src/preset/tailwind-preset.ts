import type { Config } from 'tailwindcss';

/**
 * MagnetUI Tailwind CSS Preset
 *
 * Apply this preset in your tailwind.config.ts:
 * ```ts
 * import { magnetuiPreset } from '@magnetlab/magnetui/preset'
 *
 * export default {
 *   presets: [magnetuiPreset],
 *   // ...your config
 * }
 * ```
 */
export const magnetuiPreset: Partial<Config> = {
  theme: {
    extend: {
      // ─── Font Family ─────────────────────────────────────────────────
      fontFamily: {
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
      },

      // ─── Typography Scale ────────────────────────────────────────────
      // Base = 13px (text-sm). Denser than Tailwind default 14px.
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1.2' }], // 11px — tags, section labels
        xs: ['0.75rem', { lineHeight: '1.3' }], // 12px — meta, timestamps
        sm: ['0.8125rem', { lineHeight: '1.4' }], // 13px — body, nav, buttons (BASE)
        base: ['0.875rem', { lineHeight: '1.5' }], // 14px — detail body
        lg: ['0.9375rem', { lineHeight: '1.4' }], // 15px — section headings
        xl: ['1.25rem', { lineHeight: '1.3' }], // 20px — page titles
        '2xl': ['1.5rem', { lineHeight: '1.3' }], // 24px — dashboard title
      },

      // ─── Spacing Tokens ──────────────────────────────────────────────
      spacing: {
        'nav-item': '2rem', // 32px nav item height
        btn: '2rem', // 32px button height
        'btn-sm': '1.75rem', // 28px small button
        'btn-lg': '2.25rem', // 36px large button (max)
        row: '2.625rem', // 42px list row height
        topbar: '3rem', // 48px top bar
        sidebar: '13.75rem', // 220px sidebar width
      },

      // ─── Colors ──────────────────────────────────────────────────────
      colors: {
        // Semantic status colors (pastel)
        status: {
          success: 'hsl(153, 30%, 55%)',
          warning: 'hsl(35, 50%, 56%)',
          error: 'hsl(355, 30%, 62%)',
          info: 'hsl(210, 40%, 63%)',
        },

        // Tag/label colors (pastel) — use with bg-tag-X-bg, text-tag-X-text
        tag: {
          orange: {
            bg: 'rgba(210, 155, 70, 0.12)',
            text: '#A07840',
            dot: '#C4975A',
          },
          blue: {
            bg: 'rgba(107, 159, 212, 0.12)',
            text: '#5A85AE',
            dot: '#7BAAD0',
          },
          green: {
            bg: 'rgba(94, 173, 137, 0.12)',
            text: '#4A8E6E',
            dot: '#6BB895',
          },
          red: {
            bg: 'rgba(201, 123, 127, 0.12)',
            text: '#9E5E62',
            dot: '#C08488',
          },
          purple: {
            bg: 'rgba(148, 130, 206, 0.12)',
            text: '#7A6BA8',
            dot: '#9B8CCE',
          },
          gray: {
            bg: 'rgba(130, 130, 148, 0.12)',
            text: '#7A7A8E',
            dot: '#9A9AAE',
          },
        },

        // Avatar background colors (pastel)
        avatar: {
          blue: '#7BAAD0',
          purple: '#9B8CCE',
          pink: '#C88BA8',
          amber: '#C4975A',
          teal: '#6DB5C4',
          red: '#C08488',
          green: '#6BB895',
        },
      },

      // ─── Border Radius ───────────────────────────────────────────────
      borderRadius: {
        sm: '4px', // tags, small elements
        md: '6px', // buttons, inputs (DEFAULT via --radius)
        lg: '8px', // cards, modals
        xl: '12px', // major containers
      },

      // ─── Box Shadow (floating elements ONLY) ────────────────────────
      boxShadow: {
        popover: '0 4px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
        dropdown: '0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)',
        modal: '0 16px 48px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04)',
      },
    },
  },
};

export default magnetuiPreset;
