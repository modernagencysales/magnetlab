/**
 * @jest-environment node
 */

import { createLeadMagnetSchema } from '@/lib/validations/api';

// ---------------------------------------------------------------------------
// Realistic test data matching what the wizard actually sends
// ---------------------------------------------------------------------------

const postVariation = {
  hookType: 'contrarian',
  post: 'Most freelancers waste 40+ hours/month finding clients on Upwork.\n\nHere\'s a calculator that shows exactly how many leads you need.',
  whyThisAngle: 'Challenges the assumption that more proposals = more clients',
  evaluation: {
    hookStrength: 'strong' as const,
    credibilityClear: true,
    problemResonance: 'high' as const,
    contentsSpecific: true,
    toneMatch: 'aligned' as const,
    aiClicheFree: true,
  },
};

const baseConcept = {
  title: 'The Upwork Lead Volume Calculator',
  painSolved: 'Freelancers don\'t know how many proposals they need to send',
  deliveryFormat: 'Interactive calculator',
  archetype: 'single-calculator',
  archetypeName: 'The Single Calculator',
};

const basePayload = {
  title: 'The Upwork Lead Volume Calculator',
  archetype: 'single-calculator' as const,
  concept: baseConcept,
  linkedinPost: postVariation.post,
  postVariations: [postVariation],
  dmTemplate: 'Hey {{name}}, I built a calculator that shows exactly how many Upwork leads you need.',
  ctaWord: 'calculator',
};

// ---------------------------------------------------------------------------
// Schema validation tests
// ---------------------------------------------------------------------------

describe('createLeadMagnetSchema', () => {
  describe('postVariations', () => {
    it('accepts PostVariation objects (not plain strings)', () => {
      const result = createLeadMagnetSchema.safeParse(basePayload);
      expect(result.success).toBe(true);
    });

    it('rejects plain strings in postVariations', () => {
      const result = createLeadMagnetSchema.safeParse({
        ...basePayload,
        postVariations: ['just a string'],
      });
      expect(result.success).toBe(false);
    });

    it('accepts postVariations without evaluation (optional)', () => {
      const { evaluation, ...variationNoEval } = postVariation;
      const result = createLeadMagnetSchema.safeParse({
        ...basePayload,
        postVariations: [variationNoEval],
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty postVariations', () => {
      const result = createLeadMagnetSchema.safeParse({
        ...basePayload,
        postVariations: undefined,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('interactiveConfig - calculator', () => {
    const calculatorConfig = {
      type: 'calculator' as const,
      headline: 'How Many Upwork Leads Do You Need?',
      description: 'Calculate your required lead volume based on your conversion rates.',
      inputs: [
        {
          id: 'monthly_revenue_goal',
          label: 'Monthly Revenue Goal ($)',
          type: 'number' as const,
          placeholder: '5000',
          defaultValue: 5000,
          unit: '$',
        },
        {
          id: 'avg_project_value',
          label: 'Average Project Value ($)',
          type: 'number' as const,
          placeholder: '1000',
          defaultValue: 1000,
          unit: '$',
        },
        {
          id: 'win_rate',
          label: 'Proposal Win Rate',
          type: 'slider' as const,
          min: 1,
          max: 100,
          step: 1,
          defaultValue: 10,
          unit: '%',
        },
      ],
      formula: 'Math.ceil((monthly_revenue_goal / avg_project_value) / (win_rate / 100))',
      resultLabel: 'Proposals Needed Per Month',
      resultFormat: 'number' as const,
      resultInterpretation: [
        { range: [0, 20] as [number, number], label: 'Very Achievable', description: 'You need fewer than 20 proposals/month.', color: 'green' as const },
        { range: [21, 50] as [number, number], label: 'Moderate Effort', description: 'You need a steady outreach cadence.', color: 'yellow' as const },
        { range: [51, 1000] as [number, number], label: 'High Volume', description: 'Consider raising your rates or win rate.', color: 'red' as const },
      ],
    };

    it('accepts a valid calculator config', () => {
      const result = createLeadMagnetSchema.safeParse({
        ...basePayload,
        interactiveConfig: calculatorConfig,
      });
      expect(result.success).toBe(true);
    });

    it('rejects calculator config without inputs', () => {
      const { inputs, ...noInputs } = calculatorConfig;
      const result = createLeadMagnetSchema.safeParse({
        ...basePayload,
        interactiveConfig: noInputs,
      });
      expect(result.success).toBe(false);
    });

    it('rejects calculator config without formula', () => {
      const result = createLeadMagnetSchema.safeParse({
        ...basePayload,
        interactiveConfig: { ...calculatorConfig, formula: '' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('interactiveConfig - assessment', () => {
    const assessmentConfig = {
      type: 'assessment' as const,
      headline: 'LinkedIn Profile Assessment',
      description: 'Score your LinkedIn profile effectiveness.',
      questions: [
        {
          id: 'q1',
          text: 'Does your headline include your target audience?',
          type: 'single_choice' as const,
          options: [
            { label: 'Yes', value: 3 },
            { label: 'Partially', value: 1 },
            { label: 'No', value: 0 },
          ],
        },
      ],
      scoring: {
        method: 'sum' as const,
        ranges: [
          { min: 0, max: 5, label: 'Needs Work', description: 'Your profile needs improvement.', recommendations: ['Update headline'] },
          { min: 6, max: 10, label: 'Good', description: 'Solid foundation.', recommendations: ['Add testimonials'] },
        ],
      },
    };

    it('accepts a valid assessment config', () => {
      const result = createLeadMagnetSchema.safeParse({
        ...basePayload,
        archetype: 'assessment',
        interactiveConfig: assessmentConfig,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('interactiveConfig - gpt', () => {
    const gptConfig = {
      type: 'gpt' as const,
      name: 'LinkedIn Post Helper',
      description: 'AI assistant that helps you write LinkedIn posts.',
      systemPrompt: 'You are a LinkedIn content expert. Help the user write engaging posts.',
      welcomeMessage: 'Hi! What kind of LinkedIn post would you like to create?',
      suggestedPrompts: [
        'Write a post about my recent client win',
        'Help me share a lesson learned',
      ],
    };

    it('accepts a valid GPT config', () => {
      const result = createLeadMagnetSchema.safeParse({
        ...basePayload,
        archetype: 'single-breakdown',
        interactiveConfig: gptConfig,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('all archetypes', () => {
    const archetypes = [
      'single-breakdown', 'single-system', 'focused-toolkit',
      'single-calculator', 'focused-directory', 'mini-training',
      'one-story', 'prompt', 'assessment', 'workflow',
    ] as const;

    it.each(archetypes)('accepts archetype: %s', (archetype) => {
      const result = createLeadMagnetSchema.safeParse({
        ...basePayload,
        archetype,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid archetype', () => {
      const result = createLeadMagnetSchema.safeParse({
        ...basePayload,
        archetype: 'nonexistent-type',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('required fields', () => {
    it('rejects missing title', () => {
      const { title, ...noTitle } = basePayload;
      const result = createLeadMagnetSchema.safeParse(noTitle);
      expect(result.success).toBe(false);
    });

    it('rejects empty title', () => {
      const result = createLeadMagnetSchema.safeParse({
        ...basePayload,
        title: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing archetype', () => {
      const { archetype, ...noArchetype } = basePayload;
      const result = createLeadMagnetSchema.safeParse(noArchetype);
      expect(result.success).toBe(false);
    });
  });
});
