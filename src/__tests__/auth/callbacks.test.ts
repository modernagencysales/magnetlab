// Tests for auth callback functions
import { describe, it, expect } from 'vitest';
import type { JWT } from 'next-auth/jwt';
import type { Session, User } from 'next-auth';
import {
  jwtCallback,
  sessionCallback,
  validateCredentials,
  formatUserForSession,
  AUTH_CONFIG,
} from '@/lib/auth/callbacks';

describe('Auth Callbacks', () => {
  describe('jwtCallback', () => {
    it('should add userId to token when user is present', async () => {
      const token: JWT = { email: 'test@example.com' };
      const user: User = { id: 'user-123', email: 'test@example.com' };

      const result = await jwtCallback({ token, user });

      expect(result.userId).toBe('user-123');
      expect(result.email).toBe('test@example.com');
    });

    it('should not modify token when user is null', async () => {
      const token: JWT = { email: 'test@example.com', existingField: 'value' };

      const result = await jwtCallback({ token, user: null });

      expect(result.userId).toBeUndefined();
      expect(result.email).toBe('test@example.com');
      expect(result.existingField).toBe('value');
    });

    it('should not modify token when user is undefined', async () => {
      const token: JWT = { email: 'test@example.com' };

      const result = await jwtCallback({ token, user: undefined });

      expect(result.userId).toBeUndefined();
    });

    it('should preserve existing token fields when adding userId', async () => {
      const token: JWT = {
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      };
      const user: User = { id: 'user-456', email: 'test@example.com' };

      const result = await jwtCallback({ token, user });

      expect(result.userId).toBe('user-456');
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
      expect(result.picture).toBe('https://example.com/avatar.jpg');
    });

    it('should handle empty user id', async () => {
      const token: JWT = { email: 'test@example.com' };
      const user: User = { id: '', email: 'test@example.com' };

      const result = await jwtCallback({ token, user });

      expect(result.userId).toBe('');
    });
  });

  describe('sessionCallback', () => {
    it('should add userId to session from token', async () => {
      const session: Session = {
        user: { id: '', email: 'test@example.com' },
        expires: new Date().toISOString(),
      };
      const token: JWT = { userId: 'user-123' };

      const result = await sessionCallback({ session, token });

      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should not add userId when token.userId is undefined', async () => {
      const session: Session = {
        user: { id: '', email: 'test@example.com' },
        expires: new Date().toISOString(),
      };
      const token: JWT = {};

      const result = await sessionCallback({ session, token });

      expect(result.user.id).toBe('');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should preserve existing session fields', async () => {
      const session: Session = {
        user: {
          id: '',
          email: 'test@example.com',
          name: 'Test User',
          image: 'https://example.com/avatar.jpg',
        },
        expires: new Date().toISOString(),
      };
      const token: JWT = { userId: 'user-789' };

      const result = await sessionCallback({ session, token });

      expect(result.user.id).toBe('user-789');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('Test User');
      expect(result.user.image).toBe('https://example.com/avatar.jpg');
    });

    it('should handle null userId in token', async () => {
      const session: Session = {
        user: { id: 'existing-id', email: 'test@example.com' },
        expires: new Date().toISOString(),
      };
      const token: JWT = { userId: null };

      const result = await sessionCallback({ session, token });

      // userId is null/falsy, so session.user.id should remain unchanged
      expect(result.user.id).toBe('existing-id');
    });
  });

  describe('validateCredentials', () => {
    it('should return validated credentials for valid input', () => {
      const result = validateCredentials({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should return null when email is missing', () => {
      const result = validateCredentials({
        password: 'password123',
      });

      expect(result).toBeNull();
    });

    it('should return null when password is missing', () => {
      const result = validateCredentials({
        email: 'test@example.com',
      });

      expect(result).toBeNull();
    });

    it('should return null when both are missing', () => {
      const result = validateCredentials({});

      expect(result).toBeNull();
    });

    it('should return null when email is not a string', () => {
      const result = validateCredentials({
        email: 123,
        password: 'password123',
      });

      expect(result).toBeNull();
    });

    it('should return null when password is not a string', () => {
      const result = validateCredentials({
        email: 'test@example.com',
        password: 123,
      });

      expect(result).toBeNull();
    });

    it('should trim whitespace from email', () => {
      const result = validateCredentials({
        email: '  test@example.com  ',
        password: 'password123',
      });

      expect(result?.email).toBe('test@example.com');
    });

    it('should return null for empty email after trimming', () => {
      const result = validateCredentials({
        email: '   ',
        password: 'password123',
      });

      expect(result).toBeNull();
    });

    it('should return null for empty password', () => {
      const result = validateCredentials({
        email: 'test@example.com',
        password: '',
      });

      expect(result).toBeNull();
    });

    it('should return null for email without @', () => {
      const result = validateCredentials({
        email: 'invalidemail',
        password: 'password123',
      });

      expect(result).toBeNull();
    });

    it('should return null for email too short', () => {
      const result = validateCredentials({
        email: 'a@b',
        password: 'password123',
      });

      expect(result).toBeNull();
    });

    it('should accept valid short email', () => {
      const result = validateCredentials({
        email: 'a@b.c',
        password: 'password123',
      });

      expect(result).toEqual({
        email: 'a@b.c',
        password: 'password123',
      });
    });

    it('should handle null credentials', () => {
      const result = validateCredentials({
        email: null,
        password: null,
      } as { email?: unknown; password?: unknown });

      expect(result).toBeNull();
    });

    it('should handle undefined credentials object', () => {
      const result = validateCredentials(
        undefined as unknown as { email?: unknown; password?: unknown }
      );

      expect(result).toBeNull();
    });
  });

  describe('formatUserForSession', () => {
    it('should format user with all fields', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
      };

      const result = formatUserForSession(user);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
      });
    });

    it('should handle null name', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: null,
        avatar_url: 'https://example.com/avatar.jpg',
      };

      const result = formatUserForSession(user);

      expect(result.name).toBeNull();
    });

    it('should handle undefined name', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
      };

      const result = formatUserForSession(user);

      expect(result.name).toBeNull();
    });

    it('should handle null avatar_url', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: null,
      };

      const result = formatUserForSession(user);

      expect(result.image).toBeNull();
    });

    it('should handle undefined avatar_url', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const result = formatUserForSession(user);

      expect(result.image).toBeNull();
    });

    it('should handle minimal user data', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const result = formatUserForSession(user);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: null,
        image: null,
      });
    });
  });

  describe('AUTH_CONFIG', () => {
    it('should have correct page configuration', () => {
      expect(AUTH_CONFIG.pages.signIn).toBe('/login');
      expect(AUTH_CONFIG.pages.error).toBe('/login');
    });

    it('should use JWT session strategy', () => {
      expect(AUTH_CONFIG.session.strategy).toBe('jwt');
    });

    it('should trust host', () => {
      expect(AUTH_CONFIG.trustHost).toBe(true);
    });
  });
});
