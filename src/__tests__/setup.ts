// Vitest test setup
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect method with testing-library matchers
expect.extend(matchers);

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock environment variables
vi.stubEnv('AUTH_SECRET', 'test-auth-secret-for-testing-purposes-only');
vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-api-key');
vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake_key');
vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_fake_webhook_secret');
vi.stubEnv('STRIPE_PRO_PRICE_ID', 'price_pro_test');
vi.stubEnv('STRIPE_UNLIMITED_PRICE_ID', 'price_unlimited_test');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// Suppress console.error during tests (optional - can be removed for debugging)
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});
