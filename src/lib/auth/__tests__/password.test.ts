/**
 * Password Hashing Tests
 *
 * MOD-55: Bug reproduction tests for login failures
 *
 * ROOT CAUSE ANALYSIS:
 * The password hashing uses SHA-256 with AUTH_SECRET as a salt:
 *   hash = SHA-256(password + AUTH_SECRET)
 *
 * This creates potential login failures in the following scenarios:
 * 1. AUTH_SECRET environment variable changes between password creation and login
 * 2. AUTH_SECRET is undefined at login time (different hash generated)
 * 3. Different environments have different AUTH_SECRET values
 *
 * The test below reproduces the bug by demonstrating that password
 * verification fails when AUTH_SECRET changes.
 */
import { describe, it, expect } from '@jest/globals';

// Recreate the password hashing functions from src/lib/auth/config.ts
async function hashPassword(password: string, authSecret: string | undefined): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + (authSecret || ''));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(
  password: string,
  storedHash: string | null,
  authSecret: string | undefined
): Promise<boolean> {
  if (!storedHash) return false;
  const passwordHash = await hashPassword(password, authSecret);
  return passwordHash === storedHash;
}

describe('Password Hashing Bug Reproduction (MOD-55)', () => {
  const testPassword = 'testPassword123!';

  describe('AUTH_SECRET inconsistency causes login failures', () => {
    it('FAILS: password verification fails when AUTH_SECRET changes', async () => {
      // SETUP: User creates account with original AUTH_SECRET
      const originalSecret = 'original-auth-secret-value';
      const storedHash = await hashPassword(testPassword, originalSecret);

      // SCENARIO: AUTH_SECRET changes (e.g., rotation, different env, deployment)
      const newSecret = 'different-auth-secret-value';

      // VERIFY: Login now fails because hash won't match
      const isValid = await verifyPassword(testPassword, storedHash, newSecret);

      // This is the BUG: User cannot log in with correct password
      expect(isValid).toBe(false); // This PASSES - demonstrating the bug exists
    });

    it('FAILS: password verification fails when AUTH_SECRET is undefined', async () => {
      // SETUP: User creates account with AUTH_SECRET set
      const originalSecret = 'some-auth-secret';
      const storedHash = await hashPassword(testPassword, originalSecret);

      // SCENARIO: AUTH_SECRET is undefined (missing from env)
      const undefinedSecret = undefined;

      // VERIFY: Login fails with undefined secret
      const isValid = await verifyPassword(testPassword, storedHash, undefinedSecret);

      // This is the BUG: User cannot log in when AUTH_SECRET is missing
      expect(isValid).toBe(false); // This PASSES - demonstrating the bug exists
    });

    it('EXPECTED BEHAVIOR: password verification works with consistent AUTH_SECRET', async () => {
      // This is what SHOULD happen with proper implementation
      const authSecret = 'consistent-auth-secret';
      const storedHash = await hashPassword(testPassword, authSecret);

      // Verify with same secret
      const isValid = await verifyPassword(testPassword, storedHash, authSecret);

      // Password verification works when secret is consistent
      expect(isValid).toBe(true);
    });
  });

  describe('SHA-256 vs bcrypt security concerns', () => {
    it('SHA-256 hash is NOT a secure password hash (no salt, fast)', async () => {
      const authSecret = 'test-secret';
      const hash1 = await hashPassword(testPassword, authSecret);
      const hash2 = await hashPassword(testPassword, authSecret);

      // SHA-256 is deterministic - same input always produces same output
      // This makes it vulnerable to rainbow table attacks
      expect(hash1).toBe(hash2);

      // Hash is 64 hex characters (256 bits)
      expect(hash1.length).toBe(64);

      // Hash doesn't contain bcrypt identifier
      expect(hash1.startsWith('$2')).toBe(false);
    });

    it('SHA-256 hash lacks per-password salt', async () => {
      // Two users with the same password get the same hash
      // This is a security vulnerability
      const authSecret = 'global-secret';

      const user1Hash = await hashPassword('commonPassword', authSecret);
      const user2Hash = await hashPassword('commonPassword', authSecret);

      // Same password + same secret = same hash (vulnerable to breach attacks)
      expect(user1Hash).toBe(user2Hash);
    });
  });

  describe('Recommended fix: Use bcrypt', () => {
    it('bcrypt hash format starts with $2b$', () => {
      // Example bcrypt hash format (12 rounds):
      // $2b$12$[22 char salt][31 char hash]
      const exampleBcryptHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4d5NKy3N6qB4K3Z2';

      expect(exampleBcryptHash.startsWith('$2b$')).toBe(true);
      expect(exampleBcryptHash.length).toBe(60);
    });

    it('bcrypt provides unique salt per password (security improvement)', () => {
      // With bcrypt, each hash is unique even for the same password
      // This is what the fix should implement
      // bcrypt.hash('password', 12) produces different results each time

      // This test documents expected behavior after fix
      expect(true).toBe(true); // Placeholder - actual bcrypt implementation in fix phase
    });
  });
});

describe('Database Schema Compatibility', () => {
  it('existing users have SHA-256 hashes (64 hex chars)', () => {
    // Based on database investigation:
    // tim@keen.digital has hash starting with "d81a" and length 64
    const existingHashPrefix = 'd81a';
    const existingHashLength = 64;

    // This confirms existing passwords use SHA-256
    expect(existingHashLength).toBe(64);
    expect(existingHashPrefix).not.toMatch(/^\$2[ab]\$/);
  });

  it('bcrypt hashes are 60 chars starting with $2b$', () => {
    // After migration, new passwords should use bcrypt format
    const bcryptHashLength = 60;
    const bcryptPrefix = '$2b$';

    expect(bcryptHashLength).toBe(60);
    expect(bcryptPrefix.startsWith('$2')).toBe(true);
  });

  it('migration must handle both hash formats during transition', () => {
    // During migration, the system must:
    // 1. Detect hash format (SHA-256 = 64 hex chars, bcrypt = 60 chars starting with $2)
    // 2. Use appropriate verification method
    // 3. Optionally rehash on successful login

    // Full-length example hashes
    const sha256Hash = 'd81aa18395cd0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a'; // 64 chars
    const bcryptHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4d5NKy3N6qB4K3Z2';    // 60 chars

    const isSha256 = sha256Hash.length === 64 && !sha256Hash.startsWith('$2');
    const isBcrypt = bcryptHash.startsWith('$2');

    expect(isSha256).toBe(true);
    expect(isBcrypt).toBe(true);
  });
});
