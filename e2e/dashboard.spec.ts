/**
 * Dashboard smoke tests.
 * Verifies key pages load without crashing. These tests rely on the session
 * cookie from auth.setup.ts to pass middleware, but server components that
 * call auth() may return null (no real session). The pages should still render
 * their loading/empty states without throwing.
 */
import { test, expect } from '@playwright/test';

// ─── Dashboard home ─────────────────────────────────────

test.describe('dashboard home', () => {
  test('loads the home page', async ({ page }) => {
    await page.goto('/');
    // The page should render — either the full dashboard or a loading skeleton
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
  });

  test('displays the MagnetLab logo in sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('MagnetLab').first()).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Route smoke tests ──────────────────────────────────

test.describe('route smoke tests', () => {
  const routes = [
    { path: '/magnets', titlePattern: /lead magnets/i },
    { path: '/pages', titlePattern: /pages/i },
    { path: '/leads', titlePattern: /leads/i },
    { path: '/posts', titlePattern: /posts/i },
    { path: '/create', titlePattern: /create/i },
    { path: '/settings', titlePattern: /settings/i },
    { path: '/knowledge', titlePattern: /knowledge/i },
  ];

  for (const { path, titlePattern } of routes) {
    test(`${path} loads without crashing`, async ({ page }) => {
      const response = await page.goto(path);

      // Should not get a 500 server error
      expect(response?.status()).not.toBe(500);

      // Should not redirect to /login (we have the session cookie)
      await expect(page).not.toHaveURL(/\/login/);

      // Page title should match expected pattern
      const title = await page.title();
      expect(title.toLowerCase()).toMatch(titlePattern);
    });
  }
});

// ─── Legacy route redirects ─────────────────────────────

test.describe('legacy route redirects', () => {
  test('/library redirects to /magnets', async ({ page }) => {
    await page.goto('/library');
    await expect(page).toHaveURL(/\/magnets/);
  });

  test('/swipe-file redirects to /posts?tab=inspiration', async ({ page }) => {
    await page.goto('/swipe-file');
    await expect(page).toHaveURL(/\/posts/);
  });
});

// ─── Settings sub-routes ────────────────────────────────

test.describe('settings sub-routes', () => {
  test('/settings redirects to /settings/account', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings\/account/);
  });

  const settingsRoutes = [
    '/settings/account',
    '/settings/integrations',
    '/settings/branding',
    '/settings/developer',
  ];

  for (const path of settingsRoutes) {
    test(`${path} loads without crashing`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).not.toBe(500);
      await expect(page).not.toHaveURL(/\/login/);
    });
  }
});
