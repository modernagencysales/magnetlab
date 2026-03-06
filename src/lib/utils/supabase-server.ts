// Supabase Server Client for Server Components and API Routes

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Handle cookies in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.delete({ name, ...options });
          } catch {
            // Handle cookies in Server Components
          }
        },
      },
    }
  );
}

// Singleton admin client — one instance per process (reused across repos/routes)
let adminClientInstance: ReturnType<typeof createServerClient> | null = null;

/**
 * Returns the Supabase admin (service role) client. Creates once per process and reuses.
 * Use this everywhere instead of creating a new connection per call.
 * Supports both Next.js env var names and Trigger.dev env var names.
 */
export function getSupabaseAdminClient(): ReturnType<typeof createServerClient> {
  if (adminClientInstance !== null) {
    return adminClientInstance;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  adminClientInstance = createServerClient(supabaseUrl, serviceKey, {
    cookies: {
      get: () => undefined,
      set: () => {},
      remove: () => {},
    },
  });
  return adminClientInstance;
}

/**
 * @deprecated Use getSupabaseAdminClient() for a shared instance. This name is kept for backward compatibility and returns the same singleton.
 */
export function createSupabaseAdminClient() {
  return getSupabaseAdminClient();
}
