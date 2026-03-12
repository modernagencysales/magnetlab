/**
 * Sidebar navigation tests.
 * Verifies that all sidebar links exist with correct hrefs.
 * Tests the AppSidebar component rendered in the dashboard layout.
 */
import { test, expect } from '@playwright/test';

test.describe('sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the sidebar to render
    await page.waitForLoadState('domcontentloaded');
  });

  // ─── Platform nav links ─────────────────────────────

  const platformLinks = [
    { label: 'Home', href: '/' },
    { label: 'Lead Magnets', href: '/magnets' },
    { label: 'Pages', href: '/pages' },
    { label: 'Knowledge', href: '/knowledge' },
    { label: 'Posts', href: '/posts' },
    { label: 'Automations', href: '/automations' },
    { label: 'Leads', href: '/leads' },
    { label: 'Signals', href: '/signals' },
    { label: 'Email', href: '/email/flows' },
    { label: 'Team', href: '/team' },
  ];

  for (const { label, href } of platformLinks) {
    test(`sidebar has "${label}" link pointing to ${href}`, async ({ page }) => {
      // The sidebar renders links — find the one matching this label
      const link = page
        .locator(`nav a, aside a, [role="navigation"] a`)
        .filter({
          hasText: new RegExp(`^${label}$`),
        })
        .first();

      // The link should exist (may be hidden on mobile viewport, but present in DOM)
      await expect(link).toHaveAttribute('href', href);
    });
  }

  // ─── Support nav links ──────────────────────────────

  const supportLinks = [
    { label: 'Docs', href: '/docs' },
    { label: 'Help', href: '/help' },
    { label: 'Settings', href: '/settings' },
  ];

  for (const { label, href } of supportLinks) {
    test(`sidebar has "${label}" link pointing to ${href}`, async ({ page }) => {
      const link = page
        .locator(`nav a, aside a, [role="navigation"] a`)
        .filter({
          hasText: new RegExp(`^${label}$`),
        })
        .first();

      await expect(link).toHaveAttribute('href', href);
    });
  }

  // ─── Create New dropdown ────────────────────────────

  test('Create New button exists in sidebar', async ({ page }) => {
    const createButton = page.getByText('Create New').first();
    await expect(createButton).toBeVisible();
  });

  // ─── Sign out button ────────────────────────────────

  test('sign out button exists', async ({ page }) => {
    const signOutButton = page.getByRole('button', { name: /sign out/i });
    await expect(signOutButton).toBeVisible();
  });

  // ─── Theme toggle ───────────────────────────────────

  test('theme toggle button exists', async ({ page }) => {
    const themeToggle = page.getByRole('button', { name: /switch to (light|dark) theme/i }).first();
    await expect(themeToggle).toBeVisible();
  });
});
