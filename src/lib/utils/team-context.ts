import { cookies } from 'next/headers';
import { checkTeamRole } from '@/lib/auth/rbac';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export interface DataScope {
  type: 'user' | 'team';
  userId: string;
  teamId?: string;
}

/**
 * Get the current data scope based on session and team context.
 * The ml-team-context cookie stores an owner's user ID, so we look up
 * the actual team ID from the teams table before checking membership.
 * Falls back to user scope if no team context or membership check fails.
 */
export async function getDataScope(userId: string): Promise<DataScope> {
  const cookieStore = await cookies();
  const contextOwnerId = cookieStore.get('ml-team-context')?.value;

  if (contextOwnerId) {
    // Cookie stores the owner's user ID — resolve to actual team ID
    const supabase = createSupabaseAdminClient();
    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('owner_id', contextOwnerId)
      .single();

    if (team) {
      const role = await checkTeamRole(userId, team.id);
      if (role) {
        return { type: 'team', userId, teamId: team.id };
      }
    }
  }

  return { type: 'user', userId };
}
