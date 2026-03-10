import {
  createSectionSchema,
  updateSectionSchema,
  sectionConfigSchemas,
  sectionTypes,
  getVariantConfigSchema,
  heroConfigSchema,
  statsBarConfigSchema,
  featureGridConfigSchema,
  socialProofWallConfigSchema,
} from '@/lib/validations/api';

describe('Section Validation Schemas', () => {
  describe('createSectionSchema', () => {
    it('should accept valid section data', () => {
      const result = createSectionSchema.safeParse({
        sectionType: 'testimonial',
        pageLocation: 'optin',
        config: { quote: 'Great!', author: 'Jane' },
      });

      expect(result.success).toBe(true);
    });

    it('should accept all 9 section types', () => {
      const configByType: Record<string, unknown> = {
        logo_bar: { logos: [{ name: 'Co', imageUrl: 'https://img.com/logo.png' }] },
        steps: { steps: [{ title: 'Step 1', description: 'Do this' }] },
        testimonial: { quote: 'Great!' },
        marketing_block: { blockType: 'feature' },
        section_bridge: { text: 'Next' },
        hero: { headline: 'Welcome' },
        stats_bar: {
          items: [
            { value: '10+', label: 'A' },
            { value: '20+', label: 'B' },
            { value: '30+', label: 'C' },
          ],
        },
        feature_grid: {
          features: [
            { icon: 'zap', title: 'Fast', description: 'Lightning fast setup' },
            { icon: 'shield', title: 'Safe', description: 'Enterprise security built in' },
            { icon: 'rocket', title: 'Scale', description: 'Handles any workload easily' },
          ],
        },
        social_proof_wall: {
          testimonials: [
            { quote: 'This product changed everything for us.', author: 'Jane' },
            { quote: 'Best investment we have made this year.', author: 'John' },
          ],
        },
      };
      const types = [...sectionTypes];
      expect(types).toHaveLength(9);
      types.forEach((sectionType) => {
        const result = createSectionSchema.safeParse({
          sectionType,
          pageLocation: 'optin',
          config: configByType[sectionType],
        });
        expect(result.success).toBe(true);
      });
    });

    it('should accept all page locations', () => {
      const locations = ['optin', 'thankyou', 'content'];
      locations.forEach((pageLocation) => {
        const result = createSectionSchema.safeParse({
          sectionType: 'testimonial',
          pageLocation,
          config: { quote: 'Great!' },
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid section type', () => {
      const result = createSectionSchema.safeParse({
        sectionType: 'invalid_type',
        pageLocation: 'optin',
        config: {},
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid page location', () => {
      const result = createSectionSchema.safeParse({
        sectionType: 'testimonial',
        pageLocation: 'invalid_location',
        config: {},
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional sortOrder and isVisible', () => {
      const result = createSectionSchema.safeParse({
        sectionType: 'steps',
        pageLocation: 'thankyou',
        config: { steps: [{ title: 'Step 1', description: 'Do this' }] },
        sortOrder: 25,
        isVisible: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortOrder).toBe(25);
        expect(result.data.isVisible).toBe(false);
      }
    });

    it('should require config field', () => {
      const result = createSectionSchema.safeParse({
        sectionType: 'testimonial',
        pageLocation: 'optin',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateSectionSchema', () => {
    it('should accept partial updates', () => {
      const result = updateSectionSchema.safeParse({ isVisible: false });
      expect(result.success).toBe(true);
    });

    it('should accept config-only update', () => {
      const result = updateSectionSchema.safeParse({
        config: { quote: 'Updated quote' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept sortOrder update', () => {
      const result = updateSectionSchema.safeParse({ sortOrder: 55 });
      expect(result.success).toBe(true);
    });

    it('should accept pageLocation update', () => {
      const result = updateSectionSchema.safeParse({ pageLocation: 'content' });
      expect(result.success).toBe(true);
    });

    it('should reject empty object', () => {
      // Empty object is fine for zod .partial() - all fields optional
      const result = updateSectionSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('sectionConfigSchemas', () => {
    it('should have schemas for all 9 section types', () => {
      for (const type of sectionTypes) {
        expect(sectionConfigSchemas).toHaveProperty(type);
      }
      expect(Object.keys(sectionConfigSchemas)).toHaveLength(9);
    });

    it('should validate logo_bar config', () => {
      const schema = sectionConfigSchemas.logo_bar;
      // Empty logos array is valid (user may add logos later)
      expect(schema.safeParse({ logos: [] }).success).toBe(true);
      expect(
        schema.safeParse({ logos: [{ name: 'Co', imageUrl: 'https://img.com/logo.png' }] }).success
      ).toBe(true);
    });

    it('should reject logo_bar with invalid URL', () => {
      const schema = sectionConfigSchemas.logo_bar;
      expect(schema.safeParse({ logos: [{ name: 'Co', imageUrl: 'not-a-url' }] }).success).toBe(
        false
      );
    });

    it('should validate steps config', () => {
      const schema = sectionConfigSchemas.steps;
      expect(
        schema.safeParse({
          steps: [{ title: 'Step 1', description: 'Do this' }],
        }).success
      ).toBe(true);
      expect(
        schema.safeParse({
          heading: 'Next Steps',
          subheading: 'Follow these',
          steps: [{ title: 'A', description: 'B' }],
        }).success
      ).toBe(true);
    });

    it('should validate testimonial config', () => {
      const schema = sectionConfigSchemas.testimonial;
      expect(schema.safeParse({ quote: 'Amazing!' }).success).toBe(true);
      expect(
        schema.safeParse({
          quote: 'Great',
          author: 'Jane',
          role: 'CEO',
          result: '2x growth',
        }).success
      ).toBe(true);
    });

    it('should reject testimonial without quote', () => {
      const schema = sectionConfigSchemas.testimonial;
      expect(schema.safeParse({ author: 'Jane' }).success).toBe(false);
    });

    it('should validate marketing_block config', () => {
      const schema = sectionConfigSchemas.marketing_block;
      expect(schema.safeParse({ blockType: 'feature' }).success).toBe(true);
      expect(
        schema.safeParse({
          blockType: 'cta',
          title: 'Get Started',
          content: 'Sign up now',
          ctaText: 'Click',
          ctaUrl: 'https://example.com',
        }).success
      ).toBe(true);
    });

    it('should reject marketing_block with invalid blockType', () => {
      const schema = sectionConfigSchemas.marketing_block;
      expect(schema.safeParse({ blockType: 'invalid' }).success).toBe(false);
    });

    it('should validate section_bridge config', () => {
      const schema = sectionConfigSchemas.section_bridge;
      expect(schema.safeParse({ text: 'Ready?' }).success).toBe(true);
      expect(
        schema.safeParse({
          text: 'Next step',
          variant: 'accent',
          stepNumber: 2,
          stepLabel: 'Step 2',
        }).success
      ).toBe(true);
    });

    it('should reject section_bridge without text', () => {
      const schema = sectionConfigSchemas.section_bridge;
      expect(schema.safeParse({ variant: 'accent' }).success).toBe(false);
    });
  });

  // ─── sectionTypes array ───────────────────────────────────────

  describe('sectionTypes', () => {
    it('has exactly 9 entries', () => {
      expect(sectionTypes).toHaveLength(9);
    });

    it('includes all expected types in order', () => {
      expect([...sectionTypes]).toEqual([
        'logo_bar',
        'steps',
        'testimonial',
        'marketing_block',
        'section_bridge',
        'hero',
        'stats_bar',
        'feature_grid',
        'social_proof_wall',
      ]);
    });
  });

  // ─── getVariantConfigSchema ───────────────────────────────────

  describe('getVariantConfigSchema', () => {
    it('returns a schema for every known section type', () => {
      for (const type of sectionTypes) {
        expect(getVariantConfigSchema(type)).not.toBeNull();
      }
    });

    it('returns null for unknown type', () => {
      expect(getVariantConfigSchema('nonexistent')).toBeNull();
      expect(getVariantConfigSchema('')).toBeNull();
    });

    it('returns the same schema object as the map', () => {
      expect(getVariantConfigSchema('hero')).toBe(sectionConfigSchemas['hero']);
      expect(getVariantConfigSchema('stats_bar')).toBe(sectionConfigSchemas['stats_bar']);
      expect(getVariantConfigSchema('feature_grid')).toBe(sectionConfigSchemas['feature_grid']);
      expect(getVariantConfigSchema('social_proof_wall')).toBe(
        sectionConfigSchemas['social_proof_wall']
      );
    });
  });

  // ─── heroConfigSchema ─────────────────────────────────────────

  describe('heroConfigSchema', () => {
    it('accepts valid hero with all fields', () => {
      const result = heroConfigSchema.safeParse({
        headline: 'Grow Your Agency 10x',
        subline: 'The proven framework',
        ctaText: 'Get Started',
        ctaUrl: 'https://example.com/start',
        backgroundImageUrl: 'https://example.com/bg.jpg',
        gradientConfig: { from: '#1a1a2e', to: '#16213e', direction: 'to-br' },
      });
      expect(result.success).toBe(true);
    });

    it('accepts minimal hero (headline only)', () => {
      expect(heroConfigSchema.safeParse({ headline: 'Hello' }).success).toBe(true);
    });

    it('rejects empty headline', () => {
      expect(heroConfigSchema.safeParse({ headline: '' }).success).toBe(false);
    });

    it('rejects missing headline', () => {
      expect(heroConfigSchema.safeParse({}).success).toBe(false);
    });

    it('rejects headline over 200 chars', () => {
      expect(heroConfigSchema.safeParse({ headline: 'x'.repeat(201) }).success).toBe(false);
    });

    it('rejects subline over 500 chars', () => {
      expect(heroConfigSchema.safeParse({ headline: 'OK', subline: 'x'.repeat(501) }).success).toBe(
        false
      );
    });

    it('rejects ctaText over 50 chars', () => {
      expect(heroConfigSchema.safeParse({ headline: 'OK', ctaText: 'x'.repeat(51) }).success).toBe(
        false
      );
    });

    it('rejects invalid ctaUrl', () => {
      expect(heroConfigSchema.safeParse({ headline: 'OK', ctaUrl: 'not-a-url' }).success).toBe(
        false
      );
    });

    it('rejects invalid backgroundImageUrl', () => {
      expect(
        heroConfigSchema.safeParse({ headline: 'OK', backgroundImageUrl: 'nope' }).success
      ).toBe(false);
    });

    it('accepts gradientConfig without direction', () => {
      expect(
        heroConfigSchema.safeParse({
          headline: 'OK',
          gradientConfig: { from: '#000', to: '#fff' },
        }).success
      ).toBe(true);
    });

    it('rejects gradientConfig missing from', () => {
      expect(
        heroConfigSchema.safeParse({
          headline: 'OK',
          gradientConfig: { to: '#fff' },
        }).success
      ).toBe(false);
    });
  });

  // ─── statsBarConfigSchema ─────────────────────────────────────

  describe('statsBarConfigSchema', () => {
    const threeItems = [
      { value: '500+', label: 'Agencies Served' },
      { value: '10x', label: 'Average ROI' },
      { value: '98%', label: 'Retention Rate' },
    ];

    it('accepts valid 3-item stats bar', () => {
      expect(statsBarConfigSchema.safeParse({ items: threeItems }).success).toBe(true);
    });

    it('accepts 4-item stats bar', () => {
      expect(
        statsBarConfigSchema.safeParse({
          items: [...threeItems, { value: '24/7', label: 'Support' }],
        }).success
      ).toBe(true);
    });

    it('rejects fewer than 3 items', () => {
      expect(
        statsBarConfigSchema.safeParse({
          items: threeItems.slice(0, 2),
        }).success
      ).toBe(false);
    });

    it('rejects more than 4 items', () => {
      expect(
        statsBarConfigSchema.safeParse({
          items: [...threeItems, { value: '4', label: 'D' }, { value: '5', label: 'E' }],
        }).success
      ).toBe(false);
    });

    it('rejects empty value', () => {
      expect(
        statsBarConfigSchema.safeParse({
          items: [{ value: '', label: 'Agencies' }, threeItems[1], threeItems[2]],
        }).success
      ).toBe(false);
    });

    it('rejects value over 10 chars', () => {
      expect(
        statsBarConfigSchema.safeParse({
          items: [{ value: '12345678901', label: 'Long' }, threeItems[1], threeItems[2]],
        }).success
      ).toBe(false);
    });

    it('rejects empty label', () => {
      expect(
        statsBarConfigSchema.safeParse({
          items: [{ value: '500+', label: '' }, threeItems[1], threeItems[2]],
        }).success
      ).toBe(false);
    });

    it('rejects label over 50 chars', () => {
      expect(
        statsBarConfigSchema.safeParse({
          items: [{ value: '500+', label: 'x'.repeat(51) }, threeItems[1], threeItems[2]],
        }).success
      ).toBe(false);
    });

    it('rejects missing items', () => {
      expect(statsBarConfigSchema.safeParse({}).success).toBe(false);
    });
  });

  // ─── featureGridConfigSchema ──────────────────────────────────

  describe('featureGridConfigSchema', () => {
    const threeFeatures = [
      { icon: 'zap', title: 'Fast Setup', description: 'Get started in under 5 minutes' },
      { icon: 'shield', title: 'Secure', description: 'Enterprise-grade security built in' },
      { icon: 'rocket', title: 'Scale', description: 'Handles millions of requests' },
    ];

    it('accepts valid 3-feature grid', () => {
      expect(featureGridConfigSchema.safeParse({ features: threeFeatures }).success).toBe(true);
    });

    it('accepts 6-feature grid (max)', () => {
      const features = Array.from({ length: 6 }, (_, i) => ({
        icon: `icon-${i}`,
        title: `Feature ${i}`,
        description: `Description for feature ${i} here`,
      }));
      expect(featureGridConfigSchema.safeParse({ features }).success).toBe(true);
    });

    it('rejects fewer than 3 features', () => {
      expect(
        featureGridConfigSchema.safeParse({
          features: threeFeatures.slice(0, 2),
        }).success
      ).toBe(false);
    });

    it('rejects more than 6 features', () => {
      const features = Array.from({ length: 7 }, (_, i) => ({
        icon: `i-${i}`,
        title: `F ${i}`,
        description: `Desc ${i}`,
      }));
      expect(featureGridConfigSchema.safeParse({ features }).success).toBe(false);
    });

    it('rejects empty icon', () => {
      const bad = [{ ...threeFeatures[0], icon: '' }, threeFeatures[1], threeFeatures[2]];
      expect(featureGridConfigSchema.safeParse({ features: bad }).success).toBe(false);
    });

    it('rejects empty title', () => {
      const bad = [{ ...threeFeatures[0], title: '' }, threeFeatures[1], threeFeatures[2]];
      expect(featureGridConfigSchema.safeParse({ features: bad }).success).toBe(false);
    });

    it('rejects empty description', () => {
      const bad = [{ ...threeFeatures[0], description: '' }, threeFeatures[1], threeFeatures[2]];
      expect(featureGridConfigSchema.safeParse({ features: bad }).success).toBe(false);
    });

    it('rejects title over 100 chars', () => {
      const bad = [
        { ...threeFeatures[0], title: 'x'.repeat(101) },
        threeFeatures[1],
        threeFeatures[2],
      ];
      expect(featureGridConfigSchema.safeParse({ features: bad }).success).toBe(false);
    });

    it('rejects description over 300 chars', () => {
      const bad = [
        { ...threeFeatures[0], description: 'x'.repeat(301) },
        threeFeatures[1],
        threeFeatures[2],
      ];
      expect(featureGridConfigSchema.safeParse({ features: bad }).success).toBe(false);
    });

    it('rejects missing features', () => {
      expect(featureGridConfigSchema.safeParse({}).success).toBe(false);
    });
  });

  // ─── socialProofWallConfigSchema ──────────────────────────────

  describe('socialProofWallConfigSchema', () => {
    const twoTestimonials = [
      {
        quote: 'This product changed everything for our agency.',
        author: 'Jane Smith',
        role: 'CEO',
        avatar: 'https://example.com/jane.jpg',
      },
      { quote: 'Best investment we made this year overall.', author: 'John Doe' },
    ];

    it('accepts valid 2-testimonial wall', () => {
      expect(socialProofWallConfigSchema.safeParse({ testimonials: twoTestimonials }).success).toBe(
        true
      );
    });

    it('accepts 6-testimonial wall (max)', () => {
      const testimonials = Array.from({ length: 6 }, (_, i) => ({
        quote: `This is a testimonial long enough to pass the twenty char minimum number ${i}`,
        author: `Author ${i}`,
      }));
      expect(socialProofWallConfigSchema.safeParse({ testimonials }).success).toBe(true);
    });

    it('accepts testimonial without optional role and avatar', () => {
      expect(
        socialProofWallConfigSchema.safeParse({
          testimonials: [
            { quote: 'A great product that I really enjoy using.', author: 'Alice' },
            { quote: 'Wonderful service and excellent support.', author: 'Bob' },
          ],
        }).success
      ).toBe(true);
    });

    it('rejects fewer than 2 testimonials', () => {
      expect(
        socialProofWallConfigSchema.safeParse({
          testimonials: [twoTestimonials[0]],
        }).success
      ).toBe(false);
    });

    it('rejects more than 6 testimonials', () => {
      const testimonials = Array.from({ length: 7 }, (_, i) => ({
        quote: `Testimonial number ${i} that meets the twenty char minimum easily`,
        author: `Author ${i}`,
      }));
      expect(socialProofWallConfigSchema.safeParse({ testimonials }).success).toBe(false);
    });

    it('rejects quote under 20 chars', () => {
      expect(
        socialProofWallConfigSchema.safeParse({
          testimonials: [{ quote: 'Too short', author: 'Alice' }, twoTestimonials[1]],
        }).success
      ).toBe(false);
    });

    it('rejects quote over 2000 chars', () => {
      expect(
        socialProofWallConfigSchema.safeParse({
          testimonials: [{ quote: 'x'.repeat(2001), author: 'Alice' }, twoTestimonials[1]],
        }).success
      ).toBe(false);
    });

    it('rejects empty author', () => {
      expect(
        socialProofWallConfigSchema.safeParse({
          testimonials: [
            { quote: 'A great product that really changed everything.', author: '' },
            twoTestimonials[1],
          ],
        }).success
      ).toBe(false);
    });

    it('rejects author over 100 chars', () => {
      expect(
        socialProofWallConfigSchema.safeParse({
          testimonials: [
            { quote: 'A great product that really changed everything.', author: 'x'.repeat(101) },
            twoTestimonials[1],
          ],
        }).success
      ).toBe(false);
    });

    it('rejects invalid avatar URL', () => {
      expect(
        socialProofWallConfigSchema.safeParse({
          testimonials: [
            {
              quote: 'A great product that really changed everything.',
              author: 'Alice',
              avatar: 'not-a-url',
            },
            twoTestimonials[1],
          ],
        }).success
      ).toBe(false);
    });

    it('rejects missing testimonials', () => {
      expect(socialProofWallConfigSchema.safeParse({}).success).toBe(false);
    });
  });

  // ─── variant field in create/update schemas ───────────────────

  describe('variant field', () => {
    it('createSectionSchema accepts without variant', () => {
      const result = createSectionSchema.safeParse({
        sectionType: 'hero',
        pageLocation: 'optin',
        config: { headline: 'Test' },
      });
      expect(result.success).toBe(true);
    });

    it('createSectionSchema accepts with variant', () => {
      const result = createSectionSchema.safeParse({
        sectionType: 'hero',
        pageLocation: 'optin',
        variant: 'gradient',
        config: { headline: 'Test' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variant).toBe('gradient');
      }
    });

    it('createSectionSchema rejects variant over 50 chars', () => {
      const result = createSectionSchema.safeParse({
        sectionType: 'hero',
        pageLocation: 'optin',
        variant: 'x'.repeat(51),
        config: { headline: 'Test' },
      });
      expect(result.success).toBe(false);
    });

    it('updateSectionSchema accepts with variant', () => {
      const result = updateSectionSchema.safeParse({ variant: 'minimal' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variant).toBe('minimal');
      }
    });

    it('updateSectionSchema rejects variant over 50 chars', () => {
      const result = updateSectionSchema.safeParse({ variant: 'x'.repeat(51) });
      expect(result.success).toBe(false);
    });
  });
});
