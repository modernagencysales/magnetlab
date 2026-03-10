import { funnelPageSectionFromRow, type FunnelPageSectionRow } from '@/lib/types/funnel';

describe('funnelPageSectionFromRow', () => {
  const mockRow: FunnelPageSectionRow = {
    id: 'sec-123',
    funnel_page_id: 'funnel-456',
    section_type: 'testimonial',
    page_location: 'optin',
    sort_order: 10,
    is_visible: true,
    variant: 'quote-card',
    config: { quote: 'Great product!', author: 'Jane', role: 'CEO' },
    created_at: '2026-01-29T00:00:00Z',
    updated_at: '2026-01-29T00:00:00Z',
  };

  it('should convert snake_case row to camelCase object', () => {
    const result = funnelPageSectionFromRow(mockRow);

    expect(result).toEqual({
      id: 'sec-123',
      funnelPageId: 'funnel-456',
      sectionType: 'testimonial',
      pageLocation: 'optin',
      sortOrder: 10,
      isVisible: true,
      variant: 'quote-card',
      config: { quote: 'Great product!', author: 'Jane', role: 'CEO' },
      createdAt: '2026-01-29T00:00:00Z',
      updatedAt: '2026-01-29T00:00:00Z',
    });
  });

  it('should handle all section types', () => {
    const types = [
      'logo_bar',
      'steps',
      'testimonial',
      'marketing_block',
      'section_bridge',
      'hero',
      'stats_bar',
      'feature_grid',
      'social_proof_wall',
    ] as const;

    types.forEach((sectionType) => {
      const row: FunnelPageSectionRow = { ...mockRow, section_type: sectionType };
      const result = funnelPageSectionFromRow(row);
      expect(result.sectionType).toBe(sectionType);
    });
  });

  it('should handle all page locations', () => {
    const locations = ['optin', 'thankyou', 'content'] as const;

    locations.forEach((pageLocation) => {
      const row: FunnelPageSectionRow = { ...mockRow, page_location: pageLocation };
      const result = funnelPageSectionFromRow(row);
      expect(result.pageLocation).toBe(pageLocation);
    });
  });

  it('should handle invisible sections', () => {
    const row: FunnelPageSectionRow = { ...mockRow, is_visible: false };
    const result = funnelPageSectionFromRow(row);
    expect(result.isVisible).toBe(false);
  });

  it('should preserve complex config objects', () => {
    const complexConfig = {
      blockType: 'faq' as const,
      title: 'FAQ',
      content: 'Q: What? | A: This\nQ: How? | A: That',
    };
    const row: FunnelPageSectionRow = {
      ...mockRow,
      section_type: 'marketing_block',
      config: complexConfig,
    };
    const result = funnelPageSectionFromRow(row);
    expect(result.config).toEqual(complexConfig);
  });

  it('should handle empty config', () => {
    const row: FunnelPageSectionRow = { ...mockRow, config: { quote: '' } };
    const result = funnelPageSectionFromRow(row);
    expect(result.config).toEqual({ quote: '' });
  });
});
