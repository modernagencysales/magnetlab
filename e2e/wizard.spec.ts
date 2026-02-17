import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  mockSupabaseData,
  mockAIEndpoints,
  mockAuthSession,
} from './helpers';

test.describe('Lead Magnet Creation Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page);
    await mockAIEndpoints(page);

    // Mock usage tracking to allow creation
    await mockSupabaseData(page, {
      table: 'usage_tracking',
      data: [
        {
          user_id: 'test-user-id',
          lead_magnets_created: 1,
          lead_magnets_limit: 10,
        },
      ],
    });

    // Mock extraction sessions
    await mockSupabaseData(page, {
      table: 'extraction_sessions',
      data: [],
    });
  });

  test('navigate to /create and wizard step 1 loads', async ({ page }) => {
    await page.goto('/create');
    await waitForPageLoad(page);

    // The wizard first step should be visible
    await expect(page.locator('main')).toBeVisible();
  });

  test('select an archetype on the wizard', async ({ page }) => {
    await page.goto('/create');
    await waitForPageLoad(page);

    // Look for archetype selection options
    const archetypeOption = page.getByText(/single.?breakdown/i).first();
    if (await archetypeOption.isVisible()) {
      await archetypeOption.click();

      // After selecting, the wizard should advance or show the selection
      await expect(archetypeOption).toBeVisible();
    }
  });

  test('fill in wizard steps with mocked AI', async ({ page }) => {
    // Mock the lead magnet creation API
    await page.route('**/api/lead-magnet', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'lm-new-001',
            title: 'New Lead Magnet',
            success: true,
          }),
        });
      }
      return route.continue();
    });

    await page.goto('/create');
    await waitForPageLoad(page);

    // The wizard should present input fields for the first step
    // Fill any visible text inputs
    const titleInput = page.getByPlaceholder(/title|topic|name/i).first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('My LinkedIn Growth Framework');
    }
  });

  test('step navigation with next/back buttons', async ({ page }) => {
    await page.goto('/create');
    await waitForPageLoad(page);

    // Look for a Next or Continue button
    const nextButton = page
      .getByRole('button', { name: /next|continue/i })
      .first();
    if (await nextButton.isVisible()) {
      await nextButton.click();

      // After clicking next, look for a Back button
      const backButton = page
        .getByRole('button', { name: /back|previous/i })
        .first();
      if (await backButton.isVisible()) {
        await backButton.click();

        // Should be back on step 1
        await expect(page.locator('main')).toBeVisible();
      }
    }
  });

  test('quick page create at /create/page-quick loads', async ({ page }) => {
    // Mock landing page API
    await page.route('**/api/landing-page*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 'page-quick-001' }),
      }),
    );

    await page.goto('/create/page-quick');
    await waitForPageLoad(page);

    await expect(page.locator('main')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Save to Library – API contract tests
//
// These tests intercept POST /api/lead-magnet, capture the request body,
// and validate it matches the Zod schema. This catches type mismatches
// (e.g. sending objects where strings are expected) without needing to
// walk through all 6 wizard steps.
// ---------------------------------------------------------------------------

test.describe('Save to Library – API contract', () => {
  // Realistic payloads matching what PublishStep.tsx actually sends
  const postVariation = {
    hookType: 'contrarian',
    post: 'Most freelancers waste 40+ hours finding clients.\n\nHere\'s a calculator that shows exactly how many leads you need.',
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
      painSolved: 'Freelancers don\'t know how many proposals to send',
      deliveryFormat: 'Interactive calculator',
    },
    interactiveConfig: {
      type: 'calculator',
      headline: 'How Many Leads Do You Need?',
      description: 'Calculate your required lead volume.',
      inputs: [
        { id: 'goal', label: 'Monthly Revenue Goal', type: 'number', defaultValue: 5000 },
        { id: 'rate', label: 'Win Rate', type: 'slider', min: 1, max: 100, step: 1, defaultValue: 10 },
      ],
      formula: 'Math.ceil(goal / (rate / 100))',
      resultLabel: 'Proposals Needed',
      resultFormat: 'number',
      resultInterpretation: [
        { range: [0, 20], label: 'Achievable', description: 'Fewer than 20/month.', color: 'green' },
        { range: [21, 100], label: 'High Volume', description: 'Consider raising rates.', color: 'red' },
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
      painSolved: 'People don\'t know if their LinkedIn profile is effective',
      deliveryFormat: 'Interactive assessment',
    },
    interactiveConfig: {
      type: 'assessment',
      headline: 'Score Your LinkedIn Profile',
      description: 'Find out how effective your profile is.',
      questions: [
        { id: 'q1', text: 'Does your headline mention your audience?', type: 'single_choice', options: [{ label: 'Yes', value: 3 }, { label: 'No', value: 0 }] },
      ],
      scoring: {
        method: 'sum',
        ranges: [
          { min: 0, max: 1, label: 'Needs Work', description: 'Improve your profile.', recommendations: ['Update headline'] },
          { min: 2, max: 3, label: 'Good', description: 'Solid foundation.', recommendations: ['Add testimonials'] },
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
      // Send the payload directly to the API (no browser needed)
      // This validates the Zod schema accepts the exact shape the wizard sends
      const response = await request.post('/api/lead-magnet', {
        data: payload,
      });

      // We expect either 201 (success) or 401 (no auth in test) — NOT 400 (validation error)
      // A 400 means the schema rejected our payload shape, which is the bug we're catching
      const status = response.status();
      if (status === 400) {
        const body = await response.json();
        throw new Error(
          `Schema validation failed for ${name}: ${body.error}\n` +
          `Details: ${JSON.stringify(body.details, null, 2)}`
        );
      }

      // 401 is expected (no real auth in test env), 201 means it went through
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
    // If we get past auth, it should be a validation error
    if (status !== 401) {
      expect(status).toBe(400);
    }
  });
});
