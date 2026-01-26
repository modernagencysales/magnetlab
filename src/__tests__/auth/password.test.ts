// Tests for password hashing and verification
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('Password Utilities', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'test-auth-secret-for-testing-purposes-only');
  });

  describe('hashPassword', () => {
    it('should hash a password consistently', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should produce different hashes for different passwords', async () => {
      const hash1 = await hashPassword('password1');
      const hash2 = await hashPassword('password2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce a valid hex string', async () => {
      const hash = await hashPassword('anyPassword');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('');

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle passwords with special characters', async () => {
      const password = 'p@$$w0rd!#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = await hashPassword(password);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle unicode passwords', async () => {
      const password = '密码テスト🔐';
      const hash = await hashPassword(password);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'correctPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'correctPassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should return false for null hash', async () => {
      const isValid = await verifyPassword('anyPassword', null);

      expect(isValid).toBe(false);
    });

    it('should return false for empty hash', async () => {
      const isValid = await verifyPassword('anyPassword', '');

      expect(isValid).toBe(false);
    });

    it('should handle case sensitivity correctly', async () => {
      const password = 'CaseSensitive';
      const hash = await hashPassword(password);

      const isValidExact = await verifyPassword('CaseSensitive', hash);
      const isValidLower = await verifyPassword('casesensitive', hash);
      const isValidUpper = await verifyPassword('CASESENSITIVE', hash);

      expect(isValidExact).toBe(true);
      expect(isValidLower).toBe(false);
      expect(isValidUpper).toBe(false);
    });

    it('should handle whitespace correctly', async () => {
      const password = 'password with spaces';
      const hash = await hashPassword(password);

      const isValidExact = await verifyPassword('password with spaces', hash);
      const isValidTrimmed = await verifyPassword('passwordwithspaces', hash);
      const isValidExtra = await verifyPassword('password  with  spaces', hash);

      expect(isValidExact).toBe(true);
      expect(isValidTrimmed).toBe(false);
      expect(isValidExtra).toBe(false);
    });
  });

  describe('Salt behavior', () => {
    it('should produce different hashes with different AUTH_SECRET', async () => {
      const password = 'testPassword';

      vi.stubEnv('AUTH_SECRET', 'secret1');
      const hash1 = await hashPassword(password);

      vi.stubEnv('AUTH_SECRET', 'secret2');
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should fail verification when AUTH_SECRET changes', async () => {
      const password = 'testPassword';

      vi.stubEnv('AUTH_SECRET', 'original-secret');
      const hash = await hashPassword(password);

      vi.stubEnv('AUTH_SECRET', 'different-secret');
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(false);
    });
  });
});
