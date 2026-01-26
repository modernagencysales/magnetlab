// Password utilities for MagnetLab authentication
// Extracted for testability

/**
 * Hash a password using SHA-256 with AUTH_SECRET salt
 * Note: For production, consider using bcrypt instead
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.AUTH_SECRET);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}
