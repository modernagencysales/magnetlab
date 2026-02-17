import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export type TeamRole = 'owner' | 'member' | null;

/**
 * Check a user's role in a specific team.
 * Returns 'owner' if the user owns the team, 'member' if they are an active
 * member, or null if they have no access.
 */
export async function checkTeamRole(userId: string, teamId: string): Promise<TeamRole> {
  const supabase = createSupabaseAdminClient();

  // Check if user is team owner
  const { data: team } = await supabase
    .from('teams')
    .select('owner_id')
    .eq('id', teamId)
    .single();

  if (!team) return null;
  if (team.owner_id === userId) return 'owner';

  // Check team_members table (V1 — has owner_id, not team_id/role)
  const { data: member } = await supabase
    .from('team_members')
    .select('id, status')
    .eq('owner_id', team.owner_id)
    .eq('member_id', userId)
    .eq('status', 'active')
    .single();

  if (member) {
    return 'member';
  }

  // Check team_profiles table (V2)
  const { data: profile } = await supabase
    .from('team_profiles')
    .select('role, status')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (profile) {
    return profile.role === 'owner' ? 'owner' : 'member';
  }

  return null;
}

/**
 * Check whether a role meets the minimum required level.
 * Role hierarchy: owner > member > null
 */
export function hasMinimumRole(actual: TeamRole, required: 'owner' | 'member'): boolean {
  if (!actual) return false;
  if (required === 'member') return true; // owner or member both pass
  return actual === 'owner';
}
