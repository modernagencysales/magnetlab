/** Auth fixtures for Playwright E2E tests. Cookie injection for middleware bypass. */
import { test as base, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '../../playwright/.auth/user.json');

/**
 * Auth setup that injects a session cookie to bypass the login UI.
 *
 * The middleware in src/middleware.ts checks for `authjs.session-token` or
 * `__Secure-authjs.session-token` cookies. We inject the non-secure variant
 * (localhost doesn't use __Secure- prefix) so protected routes pass the
 * isAuthenticated check.
 *
 * NOTE: This does NOT create a real NextAuth session — server components that
 * call `auth()` will still get null. This setup is sufficient for:
 * - Middleware redirect tests (cookie presence check)
 * - Client components that read session via /api/auth/session (mocked in helpers)
 * - Navigation / smoke tests on protected routes
 */
export async function authSetupViaCookie(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext
) {
  // Intercept the NextAuth session endpoint to return a mock session
  await page.route('**/api/auth/session', (route) =>
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

  // Set the session cookie that the middleware checks
  await context.addCookies([
    {
      name: 'authjs.session-token',
      value: 'mock-session-token-for-e2e-tests',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 86400,
    },
  ]);

  // Save state so browser projects can reuse
  await context.storageState({ path: AUTH_FILE });
}

export { expect };
