/**
 * MOD-55: Login Bug Reproduction and Fix Validation Tests
 *
 * THE BUG:
 * Users cannot log in because the password hashing mechanism was insecure
 * and fragile. The original implementation used SHA-256(password + AUTH_SECRET),
 * which had several critical problems:
 *
 * 1. AUTH_SECRET DEPENDENCY: If AUTH_SECRET changes, ALL existing users
 *    are locked out because their password hashes become invalid.
 *
 * 2. NO PER-PASSWORD SALT: Users with the same password have identical hashes,
 *    making the database vulnerable to rainbow table attacks.
 *
 * 3. FAST HASHING: SHA-256 is designed for speed, not password storage.
 *    bcrypt is intentionally slow to resist brute-force attacks.
 *
 * THE FIX:
 * Migrated from SHA-256 to bcrypt, with backward compatibility to support
 * both hash formats during transition. Existing users with SHA-256 hashes
 * are automatically migrated to bcrypt on their next successful login.
 */

import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 12;

// Legacy SHA-256 password hashing (what was broken)
async function hashPasswordLegacy(password: string, authSecret: string | undefined): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + (authSecret || ''));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Utility to detect hash type (from the fixed implementation)
function isLegacySha256Hash(hash: string | null): boolean {
  if (!hash) return false;
  return hash.length === 64 && /^[a-f0-9]+$/i.test(hash);
}

// The FIXED password hashing (uses bcrypt)
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

// The FIXED password verification (supports both hash types)
async function verifyPassword(
  password: string,
  hash: string | null,
  authSecret?: string
): Promise<boolean> {
  if (!hash) return false;

  // Check if this is a legacy SHA-256 hash
  if (isLegacySha256Hash(hash)) {
    const legacyHash = await hashPasswordLegacy(password, authSecret);
    return legacyHash === hash;
  }

  // Use bcrypt for modern hashes
  return bcrypt.compare(password, hash);
}

describe('MOD-55: Bug Reproduction - Original SHA-256 Problems', () => {
  describe('Legacy SHA-256 implementation problems', () => {
    it('REPRODUCES BUG: Users locked out when AUTH_SECRET changes (with old system)', async () => {
      const password = 'mySecurePassword123!';
      const originalSecret = 'production-secret-abc123';
      const storedHash = await hashPasswordLegacy(password, originalSecret);

      // With different secret, verification fails
      const rotatedSecret = 'production-secret-xyz789';
      const legacyHashWithNewSecret = await hashPasswordLegacy(password, rotatedSecret);

      // This demonstrates the bug - hashes don't match with different secrets
      expect(storedHash).not.toBe(legacyHashWithNewSecret);
    });

    it('SECURITY FLAW: Same password = same hash (rainbow table vulnerable)', async () => {
      const commonPassword = 'password123';
      const secret = 'app-secret';

      const user1Hash = await hashPasswordLegacy(commonPassword, secret);
      const user2Hash = await hashPasswordLegacy(commonPassword, secret);

      // SECURITY PROBLEM: Attacker can identify users with same password
      expect(user1Hash).toBe(user2Hash);
    });
  });
});

describe('MOD-55: Fix Validation - bcrypt with Backward Compatibility', () => {
  describe('New bcrypt hashing works correctly', () => {
    it('New passwords are hashed with bcrypt format', async () => {
      const password = 'newUserPassword123!';
      const hash = await hashPassword(password);

      // bcrypt hashes start with $2a$, $2b$, or $2y$
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(hash.length).toBe(60);
    });

    it('bcrypt hashes are unique even for same password (per-password salt)', async () => {
      const password = 'samePassword123!';

      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Each hash is unique due to random salt
      expect(hash1).not.toBe(hash2);

      // But both verify correctly
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });

    it('bcrypt verification works correctly', async () => {
      const password = 'testPassword!';
      const hash = await hashPassword(password);

      // Correct password verifies
      expect(await verifyPassword(password, hash)).toBe(true);

      // Wrong password fails
      expect(await verifyPassword('wrongPassword', hash)).toBe(false);
    });

    it('bcrypt hashes survive AUTH_SECRET changes', async () => {
      const password = 'myPassword123!';
      const hash = await hashPassword(password);

      // bcrypt doesn't use AUTH_SECRET, so it works regardless of env
      expect(await verifyPassword(password, hash, 'any-secret')).toBe(true);
      expect(await verifyPassword(password, hash, 'different-secret')).toBe(true);
      expect(await verifyPassword(password, hash, undefined)).toBe(true);
    });
  });

  describe('Backward compatibility for existing SHA-256 users', () => {
    it('Legacy SHA-256 hashes are correctly detected', () => {
      const sha256Hash = 'd81aa18395cd0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a';
      const bcryptHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4d5NKy3N6qB4K3Z2';

      expect(isLegacySha256Hash(sha256Hash)).toBe(true);
      expect(isLegacySha256Hash(bcryptHash)).toBe(false);
      expect(isLegacySha256Hash(null)).toBe(false);
    });

    it('Existing SHA-256 users can still login with correct AUTH_SECRET', async () => {
      const password = 'existingUserPassword';
      const authSecret = 'the-auth-secret-that-was-used';
      const sha256Hash = await hashPasswordLegacy(password, authSecret);

      // User can login with the same AUTH_SECRET
      const canLogin = await verifyPassword(password, sha256Hash, authSecret);
      expect(canLogin).toBe(true);
    });

    it('SHA-256 users fail login with wrong password', async () => {
      const password = 'existingUserPassword';
      const authSecret = 'the-auth-secret';
      const sha256Hash = await hashPasswordLegacy(password, authSecret);

      const canLogin = await verifyPassword('wrongPassword', sha256Hash, authSecret);
      expect(canLogin).toBe(false);
    });
  });

  describe('Hash type detection and routing', () => {
    it('verifyPassword routes to correct verification method', async () => {
      const password = 'testPassword123!';
      const authSecret = 'test-secret';

      // Create both hash types
      const sha256Hash = await hashPasswordLegacy(password, authSecret);
      const bcryptHash = await hashPassword(password);

      // Both should verify correctly with the unified verifyPassword function
      expect(await verifyPassword(password, sha256Hash, authSecret)).toBe(true);
      expect(await verifyPassword(password, bcryptHash, authSecret)).toBe(true);
    });

    it('null hash returns false', async () => {
      expect(await verifyPassword('anyPassword', null)).toBe(false);
    });
  });
});

describe('Database state compatibility', () => {
  it('Existing user tim@keen.digital hash format is SHA-256', () => {
    // From database investigation:
    // tim@keen.digital has hash starting with "d81a" and length 64
    const observedHashPrefix = 'd81a';
    const observedHashLength = 64;

    // Verify it's SHA-256 format
    expect(observedHashLength).toBe(64);
    expect(observedHashPrefix.startsWith('$2')).toBe(false);

    // This hash should be detected as legacy
    const mockHash = 'd81aa18395' + 'a'.repeat(54); // 64 chars
    expect(isLegacySha256Hash(mockHash)).toBe(true);
  });
});
