// Mock auth for testing

export const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

export const mockUnauthenticatedSession = null;

let currentSession: typeof mockSession | null = mockSession;

export const setMockSession = (session: typeof mockSession | null) => {
  currentSession = session;
};

export const getMockSession = () => currentSession;

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve(currentSession)),
}));
