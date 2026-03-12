/**
 * Lead Magnet Creation Wizard E2E tests.
 * Tests the /create page loads and the API contract for saving lead magnets.
 */
import { test, expect } from '@playwright/test';

// ─── Wizard page smoke tests ────────────────────────────

test.describe('wizard page', () => {
  test('/create loads the wizard', async ({ page }) => {
    await page.goto('/create');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });

    // The page title should indicate creation
    const title = await page.title();
    expect(title.toLowerCase()).toContain('create');
  });

  test('/create does not redirect to login', async ({ page }) => {
    await page.goto('/create');
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ─── Save to Library API contract tests ─────────────────
//
// These tests send payloads directly to POST /api/lead-magnet and validate
// the Zod schema accepts the exact shape the wizard sends. This catches
// type mismatches (e.g. sending objects where strings are expected) without
// needing to walk through all 6 wizard steps.

test.describe('save to library API contract', () => {
  const postVariation = {
    hookType: 'contrarian',
    post: "Most freelancers waste 40+ hours finding clients.\n\nHere's a calculator that shows exactly how many leads you need.",
    whyThisAngle: 'Challenges the assumption that more proposals = more clients',
    evaluation: {
      hookStrength: 'strong',
      credibilityClear: true,
      problemResonance: 'high',
      contentsSpecific: true,
      toneMatch: 'aligned',
      aiClicheFree: true,
    },
  };

  const calculatorPayload = {
    title: 'The Upwork Lead Volume Calculator',
    archetype: 'single-calculator',
    concept: {
      title: 'The Upwork Lead Volume Calculator',
      painSolved: "Freelancers don't know how many proposals to send",
      deliveryFormat: 'Interactive calculator',
    },
    interactiveConfig: {
      type: 'calculator',
      headline: 'How Many Leads Do You Need?',
      description: 'Calculate your required lead volume.',
      inputs: [
        { id: 'goal', label: 'Monthly Revenue Goal', type: 'number', defaultValue: 5000 },
        {
          id: 'rate',
          label: 'Win Rate',
          type: 'slider',
          min: 1,
          max: 100,
          step: 1,
          defaultValue: 10,
        },
      ],
      formula: 'Math.ceil(goal / (rate / 100))',
      resultLabel: 'Proposals Needed',
      resultFormat: 'number',
      resultInterpretation: [
        {
          range: [0, 20],
          label: 'Achievable',
          description: 'Fewer than 20/month.',
          color: 'green',
        },
        {
          range: [21, 100],
          label: 'High Volume',
          description: 'Consider raising rates.',
          color: 'red',
        },
      ],
    },
    linkedinPost: postVariation.post,
    postVariations: [postVariation],
    dmTemplate: 'Hey {{name}}, I built a calculator for Upwork lead volume.',
    ctaWord: 'calculator',
  };

  const assessmentPayload = {
    title: 'LinkedIn Profile Score',
    archetype: 'assessment',
    concept: {
      title: 'LinkedIn Profile Score',
      painSolved: "People don't know if their LinkedIn profile is effective",
      deliveryFormat: 'Interactive assessment',
    },
    interactiveConfig: {
      type: 'assessment',
      headline: 'Score Your LinkedIn Profile',
      description: 'Find out how effective your profile is.',
      questions: [
        {
          id: 'q1',
          text: 'Does your headline mention your audience?',
          type: 'single_choice',
          options: [
            { label: 'Yes', value: 3 },
            { label: 'No', value: 0 },
          ],
        },
      ],
      scoring: {
        method: 'sum',
        ranges: [
          {
            min: 0,
            max: 1,
            label: 'Needs Work',
            description: 'Improve your profile.',
            recommendations: ['Update headline'],
          },
          {
            min: 2,
            max: 3,
            label: 'Good',
            description: 'Solid foundation.',
            recommendations: ['Add testimonials'],
          },
        ],
      },
    },
    linkedinPost: postVariation.post,
    postVariations: [postVariation],
    dmTemplate: 'Hey {{name}}, check out this LinkedIn profile scorer.',
    ctaWord: 'assessment',
  };

  const textPayload = {
    title: 'The 5-Step LinkedIn Growth Framework',
    archetype: 'single-breakdown',
    concept: {
      title: 'The 5-Step LinkedIn Growth Framework',
      painSolved: 'People struggle to grow on LinkedIn',
      deliveryFormat: 'PDF guide',
    },
    extractedContent: {
      title: 'The 5-Step LinkedIn Growth Framework',
      format: 'guide',
      nonObviousInsight: 'Commenting strategy matters more than posting frequency.',
      differentiation: 'Data-backed approach from 500+ profiles analyzed.',
      structure: [
        { sectionName: 'Step 1', contents: ['Define your ICP'] },
        { sectionName: 'Step 2', contents: ['Craft your hook'] },
      ],
    },
    linkedinPost: postVariation.post,
    postVariations: [postVariation],
    dmTemplate: 'Hey {{name}}, grab the LinkedIn growth framework.',
    ctaWord: 'framework',
  };

  for (const [name, payload] of [
    ['calculator', calculatorPayload],
    ['assessment', assessmentPayload],
    ['text lead magnet', textPayload],
  ] as const) {
    test(`POST /api/lead-magnet accepts valid ${name} payload`, async ({ request }) => {
      const response = await request.post('/api/lead-magnet', {
        data: payload,
      });

      // We expect either 201 (success) or 401 (no real auth session in test)
      // A 400 means the Zod schema rejected our payload shape — that's a bug
      const status = response.status();
      if (status === 400) {
        const body = await response.json();
        throw new Error(
          `Schema validation failed for ${name}: ${body.error}\n` +
            `Details: ${JSON.stringify(body.details, null, 2)}`
        );
      }

      expect([201, 401]).toContain(status);
    });
  }

  test('POST /api/lead-magnet rejects postVariations as plain strings', async ({ request }) => {
    const badPayload = {
      ...textPayload,
      postVariations: ['just a string', 'another string'],
    };

    const response = await request.post('/api/lead-magnet', {
      data: badPayload,
    });

    // Should get 400 (validation error) or 401 (no auth) — never 201
    const status = response.status();
    if (status !== 401) {
      expect(status).toBe(400);
    }
  });
});
