/**
 * Restyle Plan Generator
 * Builds AI prompts and parses structured branding plans.
 * Never imports Next.js HTTP layer.
 */

import type {
  RestylePlan,
  RestyleFieldChange,
  RestyleSectionChange,
  SectionType,
} from '@/lib/types/funnel';

// ─── Types ──────────────────────────────────────────────────────────

export interface CurrentFunnelState {
  theme: string;
  primaryColor: string;
  backgroundStyle: string;
  fontFamily: string | null;
  fontUrl: string | null;
  logoUrl: string | null;
}

export interface CurrentSectionState {
  sectionType: string;
  pageLocation: string;
  sortOrder: number;
}

export interface RestylePromptInput {
  stylePrompt: string;
  currentFunnel: CurrentFunnelState;
  currentSections: CurrentSectionState[];
  visionAnalysis?: string;
}

export interface RestylePromptOutput {
  systemMessage: string;
  userMessage: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const VALID_FIELDS: RestyleFieldChange['field'][] = [
  'theme',
  'primaryColor',
  'backgroundStyle',
  'fontFamily',
  'fontUrl',
];

const VALID_SECTION_TYPES: SectionType[] = [
  'logo_bar',
  'steps',
  'testimonial',
  'marketing_block',
  'section_bridge',
];

const VALID_ACTIONS: RestyleSectionChange['action'][] = ['add', 'remove', 'reorder'];

const PRESET_COLORS = [
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Navy', hex: '#1e3a5f' },
  { name: 'Slate', hex: '#475569' },
  { name: 'Charcoal', hex: '#1f2937' },
  { name: 'Forest', hex: '#166534' },
  { name: 'Burgundy', hex: '#881337' },
  { name: 'Teal', hex: '#0d9488' },
];

const GOOGLE_FONTS_SUGGESTIONS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Lato',
  'Poppins',
  'Playfair Display',
  'Merriweather',
  'Raleway',
  'Source Sans 3',
  'Nunito',
  'Work Sans',
  'DM Sans',
  'Space Grotesk',
  'Outfit',
];

// ─── Prompt Builders ────────────────────────────────────────────────

/**
 * Builds system + user messages for the restyle AI call.
 */
export function buildRestylePrompt(input: RestylePromptInput): RestylePromptOutput {
  const { stylePrompt, currentFunnel, currentSections, visionAnalysis } = input;

  const colorList = PRESET_COLORS.map((c) => `  - ${c.name}: ${c.hex}`).join('\n');
  const fontList = GOOGLE_FONTS_SUGGESTIONS.map((f) => `  - ${f}`).join('\n');

  const sectionDescriptions = [
    'logo_bar — Row of client/partner logos for social proof',
    'steps — Numbered steps explaining what happens next',
    'testimonial — Customer quote with author and result',
    'marketing_block — Flexible block (case study, feature, benefit, FAQ, pricing, CTA)',
    'section_bridge — Transition text between sections with optional step number',
  ]
    .map((s) => `  - ${s}`)
    .join('\n');

  const currentSectionsDesc =
    currentSections.length > 0
      ? currentSections
          .map((s) => `  - ${s.sectionType} on ${s.pageLocation} (order: ${s.sortOrder})`)
          .join('\n')
      : '  (none)';

  const systemMessage = `You are a funnel design expert. Given a user's style request, suggest changes to a funnel page's visual styling.

## Available Styling Options

### Theme
  - dark (dark background, light text)
  - light (light background, dark text)
  - custom (user-defined)

### Primary Colors (preset palette)
${colorList}
You may also suggest any valid hex color.

### Background Styles
  - solid
  - gradient
  - pattern

### Fonts (Google Fonts)
${fontList}
You may also suggest any Google Font by name.

## Available Section Types
${sectionDescriptions}

## Current Funnel State
  - theme: ${currentFunnel.theme}
  - primaryColor: ${currentFunnel.primaryColor}
  - backgroundStyle: ${currentFunnel.backgroundStyle}
  - fontFamily: ${currentFunnel.fontFamily ?? '(default)'}
  - fontUrl: ${currentFunnel.fontUrl ?? '(none)'}
  - logoUrl: ${currentFunnel.logoUrl ?? '(none)'}

## Current Sections
${currentSectionsDesc}

## Rules
1. Only suggest values that DIFFER from the current state.
2. Do NOT suggest content changes — only visual/structural changes.
3. Suggest at most 3 section changes (add, remove, or reorder).
4. For font changes, set fontFamily to the Google Font name and fontUrl to null (the system loads Google Fonts automatically).

## Output Format
Respond with a single JSON object (no markdown, no explanation):
{
  "styleDirection": "Short label for the style direction (e.g. 'Corporate Navy')",
  "reasoning": "1-2 sentence explanation of why these changes match the request",
  "changes": [
    { "field": "primaryColor", "from": "#8b5cf6", "to": "#1e3a5f", "reason": "Navy conveys trust" }
  ],
  "sectionChanges": [
    { "action": "add", "sectionType": "logo_bar", "pageLocation": "optin", "reason": "Adds credibility" }
  ]
}`;

  let userMessage = `Restyle this funnel: "${stylePrompt}"`;
  if (visionAnalysis) {
    userMessage += `\n\nVision analysis of reference image:\n${visionAnalysis}`;
  }

  return { systemMessage, userMessage };
}

/**
 * Returns the vision analysis prompt for analyzing a screenshot/reference image.
 */
export function buildVisionPrompt(): string {
  return `Analyze this image and describe:
1. Color palette — dominant colors, accent colors, hex values if possible
2. Typography feel — serif vs sans-serif, weight, spacing, formality
3. Layout density — spacious vs compact, whitespace usage
4. Visual tone — modern, classic, playful, corporate, minimal, bold
5. Section patterns — what types of content blocks are visible (hero, testimonials, steps, logos, CTAs)

Be concise and specific. Focus on attributes that can be translated into funnel page styling.`;
}

// ─── Parser ─────────────────────────────────────────────────────────

/**
 * Parses a raw JSON string (possibly wrapped in markdown code fences) into a validated RestylePlan.
 * Filters out changes with invalid fields or section types.
 */
export function parseRestylePlan(raw: string): RestylePlan {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  // Validate required fields
  if (typeof parsed.styleDirection !== 'string' || !parsed.styleDirection) {
    throw new Error('Invalid restyle plan: missing or invalid styleDirection');
  }
  if (typeof parsed.reasoning !== 'string' || !parsed.reasoning) {
    throw new Error('Invalid restyle plan: missing or invalid reasoning');
  }

  // Filter changes to only valid fields
  const validFieldSet = new Set<string>(VALID_FIELDS);
  const changes: RestyleFieldChange[] = Array.isArray(parsed.changes)
    ? parsed.changes.filter(
        (c: Record<string, unknown>) =>
          c && typeof c === 'object' && validFieldSet.has(c.field as string)
      )
    : [];

  // Filter section changes to only valid types and actions
  const validSectionTypeSet = new Set<string>(VALID_SECTION_TYPES);
  const validActionSet = new Set<string>(VALID_ACTIONS);
  const sectionChanges: RestyleSectionChange[] = Array.isArray(parsed.sectionChanges)
    ? parsed.sectionChanges.filter(
        (s: Record<string, unknown>) =>
          s &&
          typeof s === 'object' &&
          validSectionTypeSet.has(s.sectionType as string) &&
          validActionSet.has(s.action as string)
      )
    : [];

  return {
    styleDirection: parsed.styleDirection,
    reasoning: parsed.reasoning,
    changes,
    sectionChanges,
  };
}
