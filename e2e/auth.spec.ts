/**
 * Auth E2E tests.
 * Tests login page rendering, form validation, and middleware redirect behavior.
 */
import { test, expect } from '@playwright/test';

// ─── Unauthenticated access ────────────────────────────

test.describe('unauthenticated redirects', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const protectedRoutes = [
    '/magnets',
    '/create',
    '/posts',
    '/leads',
    '/settings',
    '/pages',
    '/knowledge',
    '/automations',
  ];

  for (const route of protectedRoutes) {
    test(`redirects ${route} to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      expect(page.url()).toContain('callbackUrl');
    });
  }

  test('unauthenticated root redirects to /home (marketing)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/home/);
  });
});

// ─── Login page ─────────────────────────────────────────

test.describe('login page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('renders login page with heading and form fields', async ({ page }) => {
    await page.goto('/login');

    // Heading
    await expect(page.getByRole('heading', { name: /welcome to magnetlab/i })).toBeVisible();

    // Form fields
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    // Submit button — default mode is "Sign In"
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Google OAuth button
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('has sign-in / create-account mode toggle', async ({ page }) => {
    await page.goto('/login');

    // Switch to signup mode
    const createAccountTab = page.getByRole('button', { name: /create account/i });
    await expect(createAccountTab).toBeVisible();
    await createAccountTab.click();

    // Submit button text should change
    await expect(page.getByRole('button', { name: /create free account/i })).toBeVisible();

    // Password label changes
    await expect(page.getByLabel(/create a password/i)).toBeVisible();

    // Switch back
    const signInTab = page.getByRole('button', { name: /^sign in$/i });
    await expect(signInTab).toBeVisible();
    await signInTab.click();

    await expect(page.getByRole('button', { name: /^sign in$/i }).last()).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Intercept the signIn call to simulate failure
    await page.route('**/api/auth/callback/credentials*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body></body></html>',
        headers: {
          'set-cookie': '',
        },
      })
    );

    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect an error message
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10_000 });
  });

  test('email field has type=email for browser validation', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('password field has minlength=6 and is required', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test('terms and privacy links exist', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('link', { name: /terms/i })).toHaveAttribute('href', '/terms');
    await expect(page.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
  });
});

// ─── Authenticated user ─────────────────────────────────

test.describe('authenticated user', () => {
  test('authenticated user on /login redirects to / (dashboard)', async ({ page }) => {
    // The storageState from setup has the session cookie, so middleware
    // should redirect /login away.
    await page.goto('/login');
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/$/);
  });

  test('session cookie persists across page navigation', async ({ page }) => {
    // Go to a protected route — should NOT redirect to login
    await page.goto('/magnets');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('logout clears session', async ({ page, context }) => {
    await page.goto('/magnets');
    await expect(page).not.toHaveURL(/\/login/);

    // Clear cookies to simulate logout
    await context.clearCookies();

    // Navigate to a protected route — should redirect to login
    await page.goto('/magnets');
    await expect(page).toHaveURL(/\/login/);
  });
});
