import { cookies } from 'next/headers';
import { checkTeamRole } from '@/lib/auth/rbac';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
export interface DataScope {
  type: 'user' | 'team';
  userId: string;       // Always the logged-in user
  teamId?: string;      // Set when in team context
  ownerId?: string;     // Team owner's user_id (for billing lookups)
}

/**
 * Get the current data scope based on session and team context.
 * The ml-team-context cookie now stores a **team ID** directly.
 * Falls back to user scope if no team context or membership check fails.
 */
export async function getDataScope(userId: string): Promise<DataScope> {
  const cookieStore = await cookies();
  const contextTeamId = cookieStore.get('ml-team-context')?.value;

  if (contextTeamId) {
    const supabase = createSupabaseAdminClient();
    const { data: team } = await supabase
      .from('teams')
      .select('id, owner_id')
      .eq('id', contextTeamId)
      .single();

    if (team) {
      const role = await checkTeamRole(userId, team.id);
      if (role) {
        return { type: 'team', userId, teamId: team.id, ownerId: team.owner_id };
      }
    }
  }

  return { type: 'user', userId };
}

/**
 * Apply the current data scope to a Supabase query builder.
 * - Team mode: filter by team_id
 * - Personal mode: filter by user_id where team_id is null
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyScope(query: any, scope: DataScope): any {
  if (scope.type === 'team' && scope.teamId) {
    return query.eq('team_id', scope.teamId);
  }
  return query.eq('user_id', scope.userId).is('team_id', null);
}
