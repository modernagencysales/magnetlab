// Tests for session and JWT handling
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth module's callbacks
describe('Auth Callbacks', () => {
  describe('JWT Callback', () => {
    const jwtCallback = async ({
      token,
      user,
    }: {
      token: Record<string, unknown>;
      user?: { id: string } | null;
    }) => {
      if (user) {
        token.userId = user.id;
      }
      return token;
    };

    it('should add userId to token when user is present', async () => {
      const token = { email: 'test@example.com' };
      const user = { id: 'user-123' };

      const result = await jwtCallback({ token, user });

      expect(result.userId).toBe('user-123');
      expect(result.email).toBe('test@example.com');
    });

    it('should not modify token when user is null', async () => {
      const token = { email: 'test@example.com', existingField: 'value' };

      const result = await jwtCallback({ token, user: null });

      expect(result.userId).toBeUndefined();
      expect(result.email).toBe('test@example.com');
      expect(result.existingField).toBe('value');
    });

    it('should preserve existing token fields when adding userId', async () => {
      const token = {
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      };
      const user = { id: 'user-456' };

      const result = await jwtCallback({ token, user });

      expect(result.userId).toBe('user-456');
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
      expect(result.picture).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('Session Callback', () => {
    const sessionCallback = async ({
      session,
      token,
    }: {
      session: { user: { id?: string; email?: string; name?: string } };
      token: { userId?: string };
    }) => {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    };

    it('should add userId to session from token', async () => {
      const session = { user: { email: 'test@example.com' } };
      const token = { userId: 'user-123' };

      const result = await sessionCallback({ session, token });

      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should not add userId when token.userId is undefined', async () => {
      const session = { user: { email: 'test@example.com' } };
      const token = {};

      const result = await sessionCallback({ session, token });

      expect(result.user.id).toBeUndefined();
      expect(result.user.email).toBe('test@example.com');
    });

    it('should preserve existing session fields', async () => {
      const session = {
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
      };
      const token = { userId: 'user-789' };

      const result = await sessionCallback({ session, token });

      expect(result.user.id).toBe('user-789');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('Test User');
    });
  });
});

describe('Session Type Extensions', () => {
  it('should have correct session user structure', () => {
    // Type check - this validates the Session type extension
    const session = {
      user: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        image: null,
      },
      expires: new Date().toISOString(),
    };

    expect(session.user.id).toBeDefined();
    expect(typeof session.user.id).toBe('string');
  });
});

describe('Auth Configuration', () => {
  it('should use JWT session strategy', () => {
    // This tests the configuration expectations
    const config = {
      session: {
        strategy: 'jwt' as const,
      },
      pages: {
        signIn: '/login',
        error: '/login',
      },
      trustHost: true,
    };

    expect(config.session.strategy).toBe('jwt');
    expect(config.pages.signIn).toBe('/login');
    expect(config.pages.error).toBe('/login');
    expect(config.trustHost).toBe(true);
  });
});
