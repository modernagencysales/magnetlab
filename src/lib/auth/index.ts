// Auth exports for MagnetLab

import type { Session } from 'next-auth';
import { handlers, signIn, signOut, auth as nextAuth } from './config';
import { headers } from 'next/headers';
import { hashApiKey } from './api-key';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logWarn } from '@/lib/utils/logger';

export { handlers, signIn, signOut };

/**
 * Enhanced auth() that supports both NextAuth sessions AND API key Bearer tokens.
 * This enables the MCP server (and any API key consumer) to authenticate with
 * `Authorization: Bearer ml_live_xxx` without changing any route handlers.
 */
export async function auth() {
  // Check for API key Bearer token first
  try {
    const headerList = await headers();
    const authHeader = headerList.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (token.startsWith('ml_live_')) {
        const keyHash = hashApiKey(token);
        const supabase = createSupabaseAdminClient();

        // Look up the API key
        const { data: keyData } = await supabase
          .from('api_keys')
          .select('id, user_id')
          .eq('key_hash', keyHash)
          .eq('is_active', true)
          .single();

        if (keyData) {
          // Update last_used_at (fire and forget)
          void supabase
            .from('api_keys')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', keyData.id)
            .then(() => {}, () => { /* last_used_at update is best-effort */ });

          // Fetch user details (separate query — no FK between api_keys and users)
          const { data: userData } = await supabase
            .from('users')
            .select('email, name')
            .eq('id', keyData.user_id)
            .single();

          return {
            user: {
              id: keyData.user_id,
              email: userData?.email ?? null,
              name: userData?.name ?? null,
              image: null,
            },
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          } as Session;
        }
        // Invalid API key — don't fall through to session auth
        logWarn('auth', 'Invalid API key attempt', { keyPrefix: `...${token.slice(-4)}` });
        return null;
      }
    }
  } catch {
    // headers() can throw outside request context (e.g., during build)
    // Fall through to NextAuth session check
  }

  // Fall back to NextAuth session
  return nextAuth();
}
