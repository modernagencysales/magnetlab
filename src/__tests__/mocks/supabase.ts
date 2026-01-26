// Supabase mock for testing
import { vi } from 'vitest';

export type MockSupabaseResponse<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

export const createMockSupabaseClient = () => {
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
  });

  const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });

  return {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  };
};

// Helper to create successful response
export const mockSuccessResponse = <T>(data: T): MockSupabaseResponse<T> => ({
  data,
  error: null,
});

// Helper to create error response
export const mockErrorResponse = (message: string, code?: string): MockSupabaseResponse<null> => ({
  data: null,
  error: { message, code },
});

// Mock user data
export const mockUser = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  name: 'Test User',
  avatar_url: null,
  password_hash: '5e884898da28047d9a8dbf69d24f22b9c8bf1b8c3a0d8b5e9d0c7e6f5a4b3c2d1',
};

// Mock subscription data
export const mockSubscription = {
  id: 'sub-123',
  user_id: 'test-user-id-123',
  stripe_customer_id: 'cus_test123',
  stripe_subscription_id: 'sub_test123',
  plan: 'pro' as const,
  status: 'active' as const,
  current_period_start: new Date().toISOString(),
  current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  cancel_at_period_end: false,
};

// Mock usage tracking data
export const mockUsageTracking = {
  id: 'usage-123',
  user_id: 'test-user-id-123',
  month_year: new Date().toISOString().slice(0, 7),
  lead_magnets_created: 1,
  posts_scheduled: 0,
};
