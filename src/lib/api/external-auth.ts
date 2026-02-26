// Shared authentication for external API routes.
// All /api/external/* routes use Bearer token auth with timing-safe comparison.

import { timingSafeEqual } from 'crypto';
import { logApiError } from '@/lib/api/errors';

/**
 * Authenticates an external API request using Bearer token.
 * Compares the provided token against EXTERNAL_API_KEY env var
 * using timing-safe comparison to prevent timing attacks.
 */
export function authenticateExternalRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;

  if (!expectedKey) {
    logApiError('external-auth', new Error('EXTERNAL_API_KEY env var is not set'));
    return false;
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}
