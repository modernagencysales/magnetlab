/**
 * @jest-environment node
 */

import {
  buildSectionGenerationPrompt,
  parseSectionPlan,
} from '@/lib/ai/funnel-generation/section-generator';

import type { GenerationContext } from '@/lib/ai/funnel-generation/section-generator';

// ─── buildSectionGenerationPrompt ───────────────────────────────────

describe('buildSectionGenerationPrompt', () => {
  const baseContext: GenerationContext = {
    leadMagnetTitle: 'LinkedIn Growth Playbook',
  };

  it('should include lead magnet title in prompt', () => {
    const prompt = buildSectionGenerationPrompt(baseContext);
    expect(prompt).toContain('LinkedIn Growth Playbook');
  });

  it('should include format when provided', () => {
    const prompt = buildSectionGenerationPrompt({
      ...baseContext,
      leadMagnetFormat: 'PDF Guide',
    });
    expect(prompt).toContain('PDF Guide');
  });

  it('should include target audience when provided', () => {
    const prompt = buildSectionGenerationPrompt({
      ...baseContext,
      targetAudience: 'B2B SaaS founders',
    });
    expect(prompt).toContain('B2B SaaS founders');
  });

  it('should include brand kit color when provided', () => {
    const prompt = buildSectionGenerationPrompt({
      ...baseContext,
      brandKit: { primaryColor: '#3b82f6' },
    });
    expect(prompt).toContain('#3b82f6');
  });

  it('should include brand kit theme when provided', () => {
    const prompt = buildSectionGenerationPrompt({
      ...baseContext,
      brandKit: { theme: 'dark' },
    });
    expect(prompt).toContain('Brand Theme: dark');
  });

  it('should list all available section types', () => {
    const prompt = buildSectionGenerationPrompt(baseContext);
    expect(prompt).toContain('hero');
    expect(prompt).toContain('logo_bar');
    expect(prompt).toContain('steps');
    expect(prompt).toContain('testimonial');
    expect(prompt).toContain('marketing_block');
    expect(prompt).toContain('section_bridge');
    expect(prompt).toContain('stats_bar');
    expect(prompt).toContain('feature_grid');
    expect(prompt).toContain('social_proof_wall');
  });

  it('should list section variants', () => {
    const prompt = buildSectionGenerationPrompt(baseContext);
    // hero variants
    expect(prompt).toContain('centered');
    expect(prompt).toContain('split-image');
    expect(prompt).toContain('full-bleed-gradient');
    // stats_bar variants
    expect(prompt).toContain('animated-counters');
    // feature_grid variants
    expect(prompt).toContain('icon-top');
    expect(prompt).toContain('icon-left');
    expect(prompt).toContain('minimal');
  });

  it('should include position rules', () => {
    const prompt = buildSectionGenerationPrompt(baseContext);
    expect(prompt).toContain('Position Rules');
    expect(prompt).toContain('optin:');
    expect(prompt).toContain('thankyou:');
    expect(prompt).toContain('content:');
  });

  it('should include the rule to always have a hero section', () => {
    const prompt = buildSectionGenerationPrompt(baseContext);
    expect(prompt).toContain('Always include a "hero" section');
  });

  it('should instruct 3-6 sections for optin page', () => {
    const prompt = buildSectionGenerationPrompt(baseContext);
    expect(prompt).toContain('3-6 sections');
  });

  it('should specify JSON output format', () => {
    const prompt = buildSectionGenerationPrompt(baseContext);
    expect(prompt).toContain('"sectionType"');
    expect(prompt).toContain('"variant"');
    expect(prompt).toContain('"pageLocation"');
    expect(prompt).toContain('"sortOrder"');
    expect(prompt).toContain('"config"');
  });
});

// ─── parseSectionPlan ───────────────────────────────────────────────

describe('parseSectionPlan', () => {
  const validPlanJson = JSON.stringify({
    sections: [
      {
        sectionType: 'hero',
        variant: 'centered',
        pageLocation: 'optin',
        sortOrder: 0,
        config: { headline: 'Get the Playbook', subline: 'Free guide' },
      },
      {
        sectionType: 'stats_bar',
        variant: 'animated-counters',
        pageLocation: 'optin',
        sortOrder: 1,
        config: { items: [{ value: '10K+', label: 'Downloads' }] },
      },
    ],
  });

  it('should parse valid section plan JSON', () => {
    const plan = parseSectionPlan(validPlanJson);

    expect(plan.sections).toHaveLength(2);
    expect(plan.sections[0].sectionType).toBe('hero');
    expect(plan.sections[0].variant).toBe('centered');
    expect(plan.sections[0].pageLocation).toBe('optin');
    expect(plan.sections[0].sortOrder).toBe(0);
    expect(plan.sections[0].config).toEqual({
      headline: 'Get the Playbook',
      subline: 'Free guide',
    });
    expect(plan.sections[1].sectionType).toBe('stats_bar');
    expect(plan.sections[1].variant).toBe('animated-counters');
  });

  it('should strip markdown code fences', () => {
    const fenced = '```json\n' + validPlanJson + '\n```';
    const plan = parseSectionPlan(fenced);
    expect(plan.sections).toHaveLength(2);
  });

  it('should strip code fences without language hint', () => {
    const fenced = '```\n' + validPlanJson + '\n```';
    const plan = parseSectionPlan(fenced);
    expect(plan.sections).toHaveLength(2);
  });

  it('should filter out invalid section types', () => {
    const json = JSON.stringify({
      sections: [
        {
          sectionType: 'hero',
          variant: 'centered',
          pageLocation: 'optin',
          sortOrder: 0,
          config: { headline: 'Hello' },
        },
        {
          sectionType: 'invalid_type',
          variant: 'default',
          pageLocation: 'optin',
          sortOrder: 1,
          config: { text: 'Should be filtered' },
        },
        {
          sectionType: 'feature_grid',
          variant: 'icon-top',
          pageLocation: 'optin',
          sortOrder: 2,
          config: { features: [] },
        },
      ],
    });

    const plan = parseSectionPlan(json);
    expect(plan.sections).toHaveLength(2);
    expect(plan.sections[0].sectionType).toBe('hero');
    expect(plan.sections[1].sectionType).toBe('feature_grid');
  });

  it('should default variant to "default" when missing', () => {
    const json = JSON.stringify({
      sections: [
        {
          sectionType: 'hero',
          pageLocation: 'optin',
          sortOrder: 0,
          config: { headline: 'No variant specified' },
        },
      ],
    });

    const plan = parseSectionPlan(json);
    expect(plan.sections[0].variant).toBe('default');
  });

  it('should default sortOrder to 0 when missing', () => {
    const json = JSON.stringify({
      sections: [
        {
          sectionType: 'hero',
          variant: 'centered',
          pageLocation: 'optin',
          config: { headline: 'No sort order' },
        },
      ],
    });

    const plan = parseSectionPlan(json);
    expect(plan.sections[0].sortOrder).toBe(0);
  });

  it('should skip sections missing sectionType', () => {
    const json = JSON.stringify({
      sections: [
        {
          variant: 'centered',
          pageLocation: 'optin',
          sortOrder: 0,
          config: { headline: 'No type' },
        },
        {
          sectionType: 'hero',
          variant: 'centered',
          pageLocation: 'optin',
          sortOrder: 1,
          config: { headline: 'Has type' },
        },
      ],
    });

    const plan = parseSectionPlan(json);
    expect(plan.sections).toHaveLength(1);
    expect(plan.sections[0].sectionType).toBe('hero');
  });

  it('should skip sections missing config', () => {
    const json = JSON.stringify({
      sections: [
        {
          sectionType: 'hero',
          variant: 'centered',
          pageLocation: 'optin',
          sortOrder: 0,
        },
      ],
    });

    const plan = parseSectionPlan(json);
    expect(plan.sections).toHaveLength(0);
  });

  it('should skip sections missing pageLocation', () => {
    const json = JSON.stringify({
      sections: [
        {
          sectionType: 'hero',
          variant: 'centered',
          sortOrder: 0,
          config: { headline: 'No location' },
        },
      ],
    });

    const plan = parseSectionPlan(json);
    expect(plan.sections).toHaveLength(0);
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseSectionPlan('not json')).toThrow('not valid JSON');
  });

  it('should throw when sections array is missing', () => {
    expect(() => parseSectionPlan('{ "foo": "bar" }')).toThrow('missing sections array');
  });

  it('should throw when sections is not an array', () => {
    expect(() => parseSectionPlan('{ "sections": "not-array" }')).toThrow('missing sections array');
  });

  it('should return empty sections array when all items are invalid', () => {
    const json = JSON.stringify({
      sections: [{ sectionType: 'bogus_type', pageLocation: 'optin', config: {} }, null, 42],
    });

    const plan = parseSectionPlan(json);
    expect(plan.sections).toHaveLength(0);
  });
});
