/** Position Rules Engine. Enforces where sections can be placed. Never imports DB or request objects. */

import type { SectionType, PageLocation, FunnelPageSection } from '@/lib/types/funnel';

// ─── Types ─────────────────────────────────────────────────────────

interface SectionRule {
  allowedPages: PageLocation[];
  maxPerPage: number;
}

export interface PlacementResult {
  valid: boolean;
  reason?: string;
}

// ─── Rules ─────────────────────────────────────────────────────────

export const SECTION_RULES: Record<SectionType, SectionRule> = {
  hero: { allowedPages: ['optin'], maxPerPage: 1 },
  logo_bar: { allowedPages: ['optin'], maxPerPage: 1 },
  stats_bar: { allowedPages: ['optin', 'thankyou'], maxPerPage: 1 },
  steps: { allowedPages: ['optin', 'thankyou', 'content'], maxPerPage: 1 },
  feature_grid: { allowedPages: ['optin', 'content'], maxPerPage: 1 },
  testimonial: { allowedPages: ['optin', 'thankyou', 'content'], maxPerPage: 2 },
  social_proof_wall: { allowedPages: ['optin', 'thankyou', 'content'], maxPerPage: 1 },
  section_bridge: { allowedPages: ['optin', 'thankyou', 'content'], maxPerPage: 3 },
  marketing_block: { allowedPages: ['optin', 'thankyou', 'content'], maxPerPage: 3 },
};

// ─── Validation ────────────────────────────────────────────────────

export function validateSectionPlacement(
  sectionType: SectionType,
  pageLocation: PageLocation,
  existingSections: FunnelPageSection[]
): PlacementResult {
  const rule = SECTION_RULES[sectionType];
  if (!rule) {
    return { valid: false, reason: `Unknown section type: ${sectionType}` };
  }

  if (!rule.allowedPages.includes(pageLocation)) {
    return {
      valid: false,
      reason: `${sectionType} is not allowed on ${pageLocation} page. Allowed: ${rule.allowedPages.join(', ')}`,
    };
  }

  const countOnPage = existingSections.filter(
    (s) => s.sectionType === sectionType && s.pageLocation === pageLocation
  ).length;

  if (countOnPage >= rule.maxPerPage) {
    return {
      valid: false,
      reason: `${sectionType} has reached max of ${rule.maxPerPage} on ${pageLocation} page`,
    };
  }

  return { valid: true };
}
