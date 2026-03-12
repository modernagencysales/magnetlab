/**
 * Public pages smoke tests.
 * Tests that public opt-in pages at /p/[username]/[slug] render.
 * These pages don't require auth but do require a real funnel in the DB,
 * so we can only test that the route handler doesn't 500.
 */
import { test, expect } from '@playwright/test';

test.describe('public page routes', () => {
  // Using a non-existent username/slug — should get a 404 or empty state, not a 500
  test('/p/nonexistent/fake-slug returns 404 or renders gracefully', async ({ page }) => {
    const response = await page.goto('/p/nonexistent/fake-slug');
    const status = response?.status() ?? 0;

    // Should be 404 (not found) or 200 (renders empty state) — not 500
    expect(status).not.toBe(500);
    expect([200, 404]).toContain(status);
  });

  test('/p/nonexistent/fake-slug/thankyou returns 404 or renders gracefully', async ({ page }) => {
    const response = await page.goto('/p/nonexistent/fake-slug/thankyou');
    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
  });

  test('/p/nonexistent/fake-slug/content returns 404 or renders gracefully', async ({ page }) => {
    const response = await page.goto('/p/nonexistent/fake-slug/content');
    const status = response?.status() ?? 0;
    expect(status).not.toBe(500);
  });
});
