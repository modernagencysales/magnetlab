import { SECTION_RULES, validateSectionPlacement } from '@/lib/validations/section-rules';
import type { FunnelPageSection, SectionType } from '@/lib/types/funnel';

// ─── Helpers ───────────────────────────────────────────────────────

const makeSection = (overrides: Partial<FunnelPageSection>): FunnelPageSection => ({
  id: 'test-id',
  funnelPageId: 'funnel-123',
  sectionType: 'testimonial',
  pageLocation: 'optin',
  sortOrder: 50,
  isVisible: true,
  variant: 'default',
  config: { quote: 'Test testimonial quote here', author: 'Author' },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

// ─── Tests ─────────────────────────────────────────────────────────

describe('SECTION_RULES', () => {
  const ALL_SECTION_TYPES: SectionType[] = [
    'hero',
    'logo_bar',
    'stats_bar',
    'steps',
    'feature_grid',
    'testimonial',
    'social_proof_wall',
    'section_bridge',
    'marketing_block',
  ];

  it('defines rules for all 9 section types', () => {
    expect(Object.keys(SECTION_RULES)).toHaveLength(9);
    for (const type of ALL_SECTION_TYPES) {
      expect(SECTION_RULES[type]).toBeDefined();
      expect(SECTION_RULES[type].allowedPages.length).toBeGreaterThan(0);
      expect(SECTION_RULES[type].maxPerPage).toBeGreaterThan(0);
    }
  });
});

describe('validateSectionPlacement', () => {
  // ─── hero ────────────────────────────────────────────────────────

  it('allows hero on optin', () => {
    const result = validateSectionPlacement('hero', 'optin', []);
    expect(result).toEqual({ valid: true });
  });

  it('rejects hero on thankyou', () => {
    const result = validateSectionPlacement('hero', 'thankyou', []);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not allowed on thankyou');
  });

  it('rejects second hero on same page (max 1)', () => {
    const existing = [makeSection({ sectionType: 'hero', pageLocation: 'optin' })];
    const result = validateSectionPlacement('hero', 'optin', existing);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('max of 1');
  });

  // ─── testimonial (max 2) ────────────────────────────────────────

  it('allows first testimonial on optin', () => {
    const result = validateSectionPlacement('testimonial', 'optin', []);
    expect(result).toEqual({ valid: true });
  });

  it('allows second testimonial on optin', () => {
    const existing = [makeSection({ sectionType: 'testimonial', pageLocation: 'optin' })];
    const result = validateSectionPlacement('testimonial', 'optin', existing);
    expect(result).toEqual({ valid: true });
  });

  it('rejects 3rd testimonial on same page', () => {
    const existing = [
      makeSection({ id: 't-1', sectionType: 'testimonial', pageLocation: 'optin' }),
      makeSection({ id: 't-2', sectionType: 'testimonial', pageLocation: 'optin' }),
    ];
    const result = validateSectionPlacement('testimonial', 'optin', existing);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('max of 2');
  });

  // ─── marketing_block (max 3) ────────────────────────────────────

  it('allows up to 3 marketing_blocks', () => {
    const existing = [
      makeSection({ id: 'mb-1', sectionType: 'marketing_block', pageLocation: 'optin' }),
      makeSection({ id: 'mb-2', sectionType: 'marketing_block', pageLocation: 'optin' }),
    ];
    const result = validateSectionPlacement('marketing_block', 'optin', existing);
    expect(result).toEqual({ valid: true });
  });

  it('rejects 4th marketing_block on same page', () => {
    const existing = [
      makeSection({ id: 'mb-1', sectionType: 'marketing_block', pageLocation: 'optin' }),
      makeSection({ id: 'mb-2', sectionType: 'marketing_block', pageLocation: 'optin' }),
      makeSection({ id: 'mb-3', sectionType: 'marketing_block', pageLocation: 'optin' }),
    ];
    const result = validateSectionPlacement('marketing_block', 'optin', existing);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('max of 3');
  });

  // ─── logo_bar (optin only) ─────────────────────────────────────

  it('allows logo_bar on optin', () => {
    const result = validateSectionPlacement('logo_bar', 'optin', []);
    expect(result).toEqual({ valid: true });
  });

  it('rejects logo_bar on thankyou', () => {
    const result = validateSectionPlacement('logo_bar', 'thankyou', []);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not allowed on thankyou');
  });

  it('rejects logo_bar on content', () => {
    const result = validateSectionPlacement('logo_bar', 'content', []);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not allowed on content');
  });

  // ─── section_bridge (max 3) ─────────────────────────────────────

  it('allows up to 3 section_bridges', () => {
    const existing = [
      makeSection({ id: 'sb-1', sectionType: 'section_bridge', pageLocation: 'optin' }),
      makeSection({ id: 'sb-2', sectionType: 'section_bridge', pageLocation: 'optin' }),
    ];
    const result = validateSectionPlacement('section_bridge', 'optin', existing);
    expect(result).toEqual({ valid: true });
  });

  it('rejects 4th section_bridge on same page', () => {
    const existing = [
      makeSection({ id: 'sb-1', sectionType: 'section_bridge', pageLocation: 'optin' }),
      makeSection({ id: 'sb-2', sectionType: 'section_bridge', pageLocation: 'optin' }),
      makeSection({ id: 'sb-3', sectionType: 'section_bridge', pageLocation: 'optin' }),
    ];
    const result = validateSectionPlacement('section_bridge', 'optin', existing);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('max of 3');
  });

  // ─── Cross-page isolation ──────────────────────────────────────

  it('does not count sections from other pages toward the max', () => {
    const existing = [
      makeSection({ id: 't-1', sectionType: 'testimonial', pageLocation: 'thankyou' }),
      makeSection({ id: 't-2', sectionType: 'testimonial', pageLocation: 'thankyou' }),
    ];
    // optin has 0 testimonials even though thankyou has 2
    const result = validateSectionPlacement('testimonial', 'optin', existing);
    expect(result).toEqual({ valid: true });
  });
});
