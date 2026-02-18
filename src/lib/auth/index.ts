// Auth exports for MagnetLab

import { handlers, signIn, signOut, auth as nextAuth } from './config';
import { headers } from 'next/headers';
import { hashApiKey } from './api-key';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

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

        const { data } = await supabase
          .from('api_keys')
          .select('id, user_id, users!inner(email, name)')
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

          // Return session-compatible object
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const user = data.users as any;
          return {
            user: {
              id: data.user_id,
              email: user?.email ?? null,
              name: user?.name ?? null,
              image: null,
            },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any;
        }
        // Invalid API key — don't fall through to session auth
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
