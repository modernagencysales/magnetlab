/** E2E test helpers. Provides route interception and mock data factories. */
import type { Page, Route } from '@playwright/test';

// ─── Page helpers ───────────────────────────────────────

/** Wait until the page reaches network-idle state. */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

// ─── NextAuth session mock ──────────────────────────────

/**
 * Intercept the NextAuth session endpoint with a mock authenticated session.
 * Use this in tests that need the client-side session (e.g. signOut, session display).
 */
export async function mockAuthSession(page: Page) {
  await page.route('**/api/auth/session', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'test-user-id',
          name: 'Test User',
          email: 'test@magnetlab.io',
          image: null,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    })
  );
}

// ─── AI endpoint mock ───────────────────────────────────

/**
 * Intercept AI content-generation endpoints so tests don't call Claude/OpenAI.
 */
export async function mockAIEndpoints(page: Page) {
  await page.route('**/api/lead-magnet/content*', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: mockLeadMagnetContent(), success: true }),
    })
  );

  await page.route('**/api/lead-magnet/polish*', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ polished: 'Polished content from AI mock.', success: true }),
    })
  );

  await page.route('**/api/lead-magnet/ideation*', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ideas: [
          { title: 'Mock Idea 1', description: 'First test idea' },
          { title: 'Mock Idea 2', description: 'Second test idea' },
        ],
        success: true,
      }),
    })
  );

  await page.route('**/api/brand-kit*', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        brandKit: { primaryColor: '#6366f1', tone: 'professional' },
        success: true,
      }),
    })
  );
}

// ─── Stripe mock ────────────────────────────────────────

/** Intercept Stripe checkout/portal API endpoints. */
export async function mockStripeCheckout(page: Page) {
  await page.route('**/api/stripe/checkout*', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'http://localhost:3000/settings?session_id=mock_sess' }),
    })
  );

  await page.route('**/api/stripe/portal*', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'http://localhost:3000/settings' }),
    })
  );
}

// ─── Mock data factories ────────────────────────────────

export function mockLeadMagnet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lm-test-001',
    user_id: 'test-user-id',
    title: 'The 5-Step LinkedIn Growth Framework',
    archetype: 'single-breakdown',
    status: 'published',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function mockFunnel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'funnel-test-001',
    lead_magnet_id: 'lm-test-001',
    user_id: 'test-user-id',
    slug: 'linkedin-growth',
    username: 'testuser',
    is_published: true,
    optin_headline: 'Get the Free LinkedIn Growth Framework',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function mockLeadMagnetContent() {
  return {
    title: 'The 5-Step LinkedIn Growth Framework',
    sections: [
      { heading: 'Introduction', body: 'This is the introduction.' },
      { heading: 'Step 1', body: 'Define your ideal customer profile.' },
      { heading: 'Step 2', body: 'Craft a compelling hook.' },
      { heading: 'Conclusion', body: 'Now go implement these steps.' },
    ],
  };
}
