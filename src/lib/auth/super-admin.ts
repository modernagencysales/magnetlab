import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/**
 * Check if a user is a super admin.
 * Used to gate access to /admin/* routes.
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', userId)
    .single();

  if (error || !data) return false;
  return data.is_super_admin === true;
}
