/**
 * AI Section Generation. Builds prompts for generating funnel page sections.
 * Never imports NextRequest/NextResponse.
 */

import { SECTION_VARIANTS, type SectionType, type PageLocation } from '@/lib/types/funnel';

// ─── Types ──────────────────────────────────────────────────────────

export interface GenerationContext {
  leadMagnetTitle: string;
  leadMagnetFormat?: string;
  targetAudience?: string;
  brandKit?: { primaryColor?: string; theme?: string };
}

export interface SectionPlanItem {
  sectionType: SectionType;
  variant: string;
  pageLocation: PageLocation;
  sortOrder: number;
  config: Record<string, unknown>;
}

export interface SectionPlan {
  sections: SectionPlanItem[];
}

// ─── Constants ──────────────────────────────────────────────────────

const VALID_SECTION_TYPES = new Set<string>(Object.keys(SECTION_VARIANTS));

/** Which section types are allowed on each page location.
 *  Keep in sync with the authoritative rules in src/lib/validations/section-rules.ts. */
const PAGE_LOCATION_RULES: Record<PageLocation, SectionType[]> = {
  optin: [
    'hero',
    'logo_bar',
    'steps',
    'testimonial',
    'marketing_block',
    'section_bridge',
    'stats_bar',
    'feature_grid',
    'social_proof_wall',
  ],
  thankyou: [
    'steps',
    'testimonial',
    'marketing_block',
    'section_bridge',
    'stats_bar',
    'social_proof_wall',
  ],
  content: [
    'steps',
    'testimonial',
    'marketing_block',
    'section_bridge',
    'feature_grid',
    'social_proof_wall',
  ],
};

/** Max instances of each section type per page */
const MAX_SECTION_COUNTS: Partial<Record<SectionType, number>> = {
  hero: 1,
  logo_bar: 1,
  stats_bar: 1,
};

const SECTION_DESCRIPTIONS: Record<SectionType, string> = {
  hero: 'Main headline block with CTA — the first thing visitors see',
  logo_bar: 'Row of client/partner logos for social proof',
  steps: 'Numbered steps explaining what the visitor gets or what happens next',
  testimonial: 'Customer quote with author name and result',
  marketing_block: 'Flexible content block (feature, benefit, FAQ, case study, CTA)',
  section_bridge: 'Transition text between sections with optional step number',
  stats_bar: 'Key metrics or statistics displayed prominently',
  feature_grid: 'Grid of features or benefits with icons',
  social_proof_wall: 'Wall of multiple testimonials or social proof items',
};

// ─── Prompt Builder ─────────────────────────────────────────────────

/**
 * Builds a prompt for Claude to generate a section plan for a funnel page.
 * Includes all available section types, their variants, position rules,
 * and lead magnet context.
 */
export function buildSectionGenerationPrompt(context: GenerationContext): string {
  const { leadMagnetTitle, leadMagnetFormat, targetAudience, brandKit } = context;

  // Build section type + variant reference
  const sectionTypeList = Object.entries(SECTION_VARIANTS)
    .map(([type, variants]) => {
      const desc = SECTION_DESCRIPTIONS[type as SectionType] ?? '';
      const variantNames = (variants as readonly string[]).join(', ');
      return `  - ${type} (${desc})\n    Variants: ${variantNames}`;
    })
    .join('\n');

  // Build position rules
  const positionRules = Object.entries(PAGE_LOCATION_RULES)
    .map(([location, types]) => `  - ${location}: ${types.join(', ')}`)
    .join('\n');

  // Build max count rules
  const maxCountRules = Object.entries(MAX_SECTION_COUNTS)
    .map(([type, max]) => `  - ${type}: max ${max} per page`)
    .join('\n');

  // Build context section
  const contextLines: string[] = [`Lead Magnet Title: ${leadMagnetTitle}`];
  if (leadMagnetFormat) {
    contextLines.push(`Format: ${leadMagnetFormat}`);
  }
  if (targetAudience) {
    contextLines.push(`Target Audience: ${targetAudience}`);
  }
  if (brandKit?.primaryColor) {
    contextLines.push(`Brand Primary Color: ${brandKit.primaryColor}`);
  }
  if (brandKit?.theme) {
    contextLines.push(`Brand Theme: ${brandKit.theme}`);
  }

  return `You are a conversion-optimized funnel page designer. Generate a section plan for an opt-in funnel page.

## Lead Magnet Context
${contextLines.join('\n')}

## Available Section Types and Variants
${sectionTypeList}

## Position Rules (which sections are allowed where)
${positionRules}

## Max Section Counts
${maxCountRules}

## Rules
1. Generate 3-6 sections for the optin page.
2. Always include a "hero" section as the first section (sortOrder: 0).
3. Generate realistic, compelling content in each section's config that matches the lead magnet topic.
4. Use appropriate variants for each section type — pick the one that best fits the content.
5. Set sortOrder as sequential integers starting from 0.
6. Only use section types from the available list above.
7. Only place sections on page locations where they are allowed.
8. Respect max section counts per type.

## Output Format
Respond with a single JSON object (no markdown, no explanation):
{
  "sections": [
    {
      "sectionType": "hero",
      "variant": "centered",
      "pageLocation": "optin",
      "sortOrder": 0,
      "config": { "headline": "...", "subline": "...", "ctaText": "..." }
    }
  ]
}`;
}

// ─── Parser ─────────────────────────────────────────────────────────

/**
 * Parses a raw AI response (possibly markdown-fenced JSON) into a validated SectionPlan.
 * Filters out sections with invalid types. Defaults variant to 'default' if missing.
 * Throws on invalid JSON or missing sections array.
 */
export function parseSectionPlan(response: string): SectionPlan {
  // Strip markdown code fences if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Invalid section plan: response is not valid JSON');
  }

  const obj = parsed as Record<string, unknown>;

  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.sections)) {
    throw new Error('Invalid section plan: missing sections array');
  }

  const validSections: SectionPlanItem[] = [];

  for (const raw of obj.sections) {
    if (!raw || typeof raw !== 'object') continue;

    const item = raw as Record<string, unknown>;

    // Must have sectionType, config, and pageLocation
    if (typeof item.sectionType !== 'string') continue;
    if (!item.config || typeof item.config !== 'object') continue;
    if (typeof item.pageLocation !== 'string') continue;

    // Filter out invalid section types
    if (!VALID_SECTION_TYPES.has(item.sectionType)) continue;

    validSections.push({
      sectionType: item.sectionType as SectionType,
      variant: typeof item.variant === 'string' ? item.variant : 'default',
      pageLocation: item.pageLocation as PageLocation,
      sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
      config: item.config as Record<string, unknown>,
    });
  }

  return { sections: validSections };
}
