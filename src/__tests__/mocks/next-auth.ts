// NextAuth mock for testing
import { vi } from 'vitest';
import type { Session } from 'next-auth';

// Mock session
export const mockSession: Session = {
  user: {
    id: 'test-user-id-123',
    email: 'test@example.com',
    name: 'Test User',
    image: null,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

// Mock auth function that returns a session
export const mockAuth = vi.fn().mockResolvedValue(mockSession);

// Mock auth function that returns null (unauthenticated)
export const mockAuthUnauthenticated = vi.fn().mockResolvedValue(null);

// Mock signIn function
export const mockSignIn = vi.fn().mockResolvedValue({ ok: true, error: null });

// Mock signOut function
export const mockSignOut = vi.fn().mockResolvedValue(undefined);

// Helper to create a custom session
export const createMockSession = (overrides?: Partial<Session['user']>): Session => ({
  user: {
    id: overrides?.id || 'test-user-id-123',
    email: overrides?.email || 'test@example.com',
    name: overrides?.name || 'Test User',
    image: overrides?.image || null,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
});

// Helper to reset all auth mocks
export const resetAuthMocks = () => {
  mockAuth.mockReset().mockResolvedValue(mockSession);
  mockSignIn.mockReset().mockResolvedValue({ ok: true, error: null });
  mockSignOut.mockReset().mockResolvedValue(undefined);
};
