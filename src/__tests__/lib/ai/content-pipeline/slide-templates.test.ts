/**
 * @jest-environment node
 */
import { buildSlideHtml, SLIDE_DIMENSIONS } from '@/lib/ai/content-pipeline/slide-templates';

describe('buildSlideHtml', () => {
  const brandKit = {
    default_primary_color: '#8b5cf6',
    font_family: 'Inter',
    logo_url: 'https://example.com/logo.png',
  };

  it('renders title slide with heading and author', () => {
    const html = buildSlideHtml(
      { type: 'title', heading: 'Why AI Changes Everything', body: 'Tim Johnson \u2022 CEO', image_url: '' },
      brandKit
    );
    expect(html).toContain('Why AI Changes Everything');
    expect(html).toContain('Tim Johnson');
    expect(html).toContain('#8b5cf6');
    expect(html).toContain('Inter');
  });

  it('renders quote slide with quotation marks', () => {
    const html = buildSlideHtml(
      { type: 'quote', heading: '', body: 'The best time to start is now.', image_url: '' },
      brandKit
    );
    expect(html).toContain('The best time to start is now.');
    // Check for left double quotation mark (Unicode \u201C)
    expect(html).toContain('\u201C');
  });

  it('renders stat slide with large number', () => {
    const html = buildSlideHtml(
      { type: 'stat', heading: '3x', body: 'more engagement with carousels', image_url: '' },
      brandKit
    );
    expect(html).toContain('3x');
    expect(html).toContain('more engagement');
  });

  it('renders list slide with items', () => {
    const html = buildSlideHtml(
      { type: 'list', heading: 'Key Takeaways', body: '1. Be consistent\n2. Add value\n3. Stay authentic', image_url: '' },
      brandKit
    );
    expect(html).toContain('Key Takeaways');
    expect(html).toContain('Be consistent');
    expect(html).toContain('Add value');
  });

  it('renders cta slide with follow prompt', () => {
    const html = buildSlideHtml(
      { type: 'cta', heading: 'Want more?', body: 'Follow me for daily insights', image_url: '' },
      brandKit
    );
    expect(html).toContain('Want more?');
    expect(html).toContain('Follow me');
  });

  it('includes logo when provided', () => {
    const html = buildSlideHtml(
      { type: 'title', heading: 'Test', body: '', image_url: '' },
      brandKit
    );
    expect(html).toContain('logo.png');
  });

  it('uses fallback color when brand kit has no primary color', () => {
    const html = buildSlideHtml(
      { type: 'title', heading: 'Test', body: '', image_url: '' },
      { default_primary_color: null, font_family: null, logo_url: null }
    );
    expect(html).toContain('#8b5cf6');
  });

  it('exports correct slide dimensions', () => {
    expect(SLIDE_DIMENSIONS.width).toBe(1080);
    expect(SLIDE_DIMENSIONS.height).toBe(1350);
  });
});
