// Database-backed rate limiting for login attempts
// Uses Supabase to persist attempts across serverless cold starts

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if a login identifier (email or IP) is rate limited.
 * Returns true if the request should be allowed, false if blocked.
 */
export async function checkLoginRateLimit(identifier: string): Promise<boolean> {
  try {
    const supabase = createSupabaseAdminClient();
    const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

    const { count, error } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .gte('attempted_at', windowStart);

    if (error) {
      // If table doesn't exist or query fails, allow the request (fail open)
      logError('rate-limit', new Error('Check failed: ' + error.message));
      return true;
    }

    return (count ?? 0) < MAX_ATTEMPTS;
  } catch (err) {
    logError('rate-limit', err, { step: 'check' });
    return true; // fail open
  }
}

/**
 * Record a failed login attempt for the given identifier.
 */
export async function recordFailedLogin(identifier: string): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('login_attempts')
      .insert({ identifier, attempted_at: new Date().toISOString() });

    if (error) {
      logError('rate-limit', new Error('Record failed: ' + error.message));
    }
  } catch (err) {
    logError('rate-limit', err, { step: 'record' });
  }
}

/**
 * Clear all login attempts for the given identifier (on successful login).
 */
export async function clearLoginAttempts(identifier: string): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('login_attempts')
      .delete()
      .eq('identifier', identifier);

    if (error) {
      logError('rate-limit', new Error('Clear failed: ' + error.message));
    }
  } catch (err) {
    logError('rate-limit', err, { step: 'clear' });
  }
}

/**
 * Clean up expired login attempts (older than the rate limit window).
 * Call this periodically or on a cron to keep the table small.
 */
export async function cleanupExpiredAttempts(): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();

    const { error } = await supabase
      .from('login_attempts')
      .delete()
      .lt('attempted_at', cutoff);

    if (error) {
      logError('rate-limit', new Error('Cleanup failed: ' + error.message));
    }
  } catch (err) {
    logError('rate-limit', err, { step: 'cleanup' });
  }
}
