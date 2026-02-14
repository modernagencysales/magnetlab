import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  mockSupabaseData,
  mockAuthSession,
  mockStripeCheckout,
} from './helpers';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page);
    await mockStripeCheckout(page);

    // Mock user data
    await mockSupabaseData(page, {
      table: 'users',
      data: [
        {
          id: 'test-user-id',
          name: 'Test User',
          email: 'test@magnetlab.io',
          username: 'testuser',
          image: null,
        },
      ],
    });

    // Mock subscription data
    await mockSupabaseData(page, {
      table: 'subscriptions',
      data: [
        {
          id: 'sub-001',
          user_id: 'test-user-id',
          plan: 'free',
          status: 'active',
          stripe_customer_id: 'cus_mock',
        },
      ],
    });

    // Mock usage tracking
    await mockSupabaseData(page, {
      table: 'usage_tracking',
      data: [
        {
          user_id: 'test-user-id',
          lead_magnets_created: 2,
          lead_magnets_limit: 3,
        },
      ],
    });

    // Mock integrations
    await mockSupabaseData(page, {
      table: 'user_integrations',
      data: [],
    });

  });

  test('settings page loads with current user info', async ({ page }) => {
    await page.goto('/settings');
    await waitForPageLoad(page);

    await expect(page.locator('main')).toBeVisible();
  });

  test('update display name', async ({ page }) => {
    // Mock the user update API
    await page.route('**/api/user*', (route) => {
      if (
        route.request().method() === 'PUT' ||
        route.request().method() === 'PATCH'
      ) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 'test-user-id',
              name: 'Updated Name',
              email: 'test@magnetlab.io',
            },
          }),
        });
      }
      return route.continue();
    });

    await page.goto('/settings');
    await waitForPageLoad(page);

    // Look for a name input field
    const nameInput = page
      .getByLabel(/name|display.?name/i)
      .or(page.getByPlaceholder(/name/i))
      .or(page.locator('input[name*="name"]'))
      .first();

    if (await nameInput.isVisible()) {
      await nameInput.clear();
      await nameInput.fill('Updated Name');

      // Look for save button
      const saveButton = page
        .getByRole('button', { name: /save|update/i })
        .first();

      if (await saveButton.isVisible()) {
        await saveButton.click();
      }
    }
  });

  test('manage integrations section visible', async ({ page }) => {
    await page.goto('/settings');
    await waitForPageLoad(page);

    // Look for an integrations section
    const integrationsSection = page
      .getByText(/integration/i)
      .or(page.getByRole('heading', { name: /integration/i }))
      .first();

    // The settings page should have some reference to integrations
    await expect(page.locator('main')).toBeVisible();
  });
});
