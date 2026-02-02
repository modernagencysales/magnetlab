import { createHash, randomBytes } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const API_KEY_PREFIX = 'ml_live_';

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = API_KEY_PREFIX + randomBytes(32).toString('hex');
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(-4);
  return { rawKey, keyHash, keyPrefix };
}

/**
 * Resolve a user ID from an API request.
 * Checks for Bearer token first, then falls back to session auth.
 * Returns the user ID string or null if unauthenticated.
 */
export async function resolveUserId(request: Request): Promise<string | null> {
  // Check for Bearer token
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const keyHash = hashApiKey(token);
    const supabase = createSupabaseAdminClient();

    const { data } = await supabase
      .from('api_keys')
      .select('user_id, id')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (data) {
      // Update last_used_at (fire and forget)
      supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id)
        .then(() => {});
      return data.user_id;
    }
    return null;
  }

  // Fall back to session auth
  const { auth } = await import('@/lib/auth');
  const session = await auth();
  return session?.user?.id ?? null;
}
