import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export interface Membership {
  id: string;
  teamId: string;
  teamName: string;
  ownerId: string;
  role: 'owner' | 'member';
  /** @deprecated Use ownerId — kept for backward compat during migration */
  owner_id: string;
  /** @deprecated Kept for backward compat */
  status: string;
}

/**
 * Get all team memberships for a user — both teams they own and teams
 * they are a member of. Returns team-based memberships with teamId/teamName.
 */
export async function getMergedMemberships(userId: string): Promise<Membership[]> {
  const supabase = createSupabaseAdminClient();
  const memberships: Membership[] = [];
  const seenTeamIds = new Set<string>();

  // 1. Teams the user owns
  const { data: ownedTeams } = await supabase
    .from('teams')
    .select('id, name, owner_id')
    .eq('owner_id', userId);

  if (ownedTeams?.length) {
    for (const t of ownedTeams) {
      memberships.push({
        id: t.id,
        teamId: t.id,
        teamName: t.name,
        ownerId: t.owner_id,
        role: 'owner',
        owner_id: t.owner_id,
        status: 'active',
      });
      seenTeamIds.add(t.id);
    }
  }

  // 2. V2: team_profiles where user is a member (not owner)
  const { data: profileMemberships } = await supabase
    .from('team_profiles')
    .select('id, team_id, role, teams(id, name, owner_id)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (profileMemberships?.length) {
    for (const pm of profileMemberships) {
      const team = pm.teams as unknown as { id: string; name: string; owner_id: string } | null;
      if (team && !seenTeamIds.has(team.id)) {
        memberships.push({
          id: pm.id,
          teamId: team.id,
          teamName: team.name,
          ownerId: team.owner_id,
          role: pm.role === 'owner' ? 'owner' : 'member',
          owner_id: team.owner_id,
          status: 'active',
        });
        seenTeamIds.add(team.id);
      }
    }
  }

  // 3. V1: legacy team_members (resolve to team)
  const { data: v1Members } = await supabase
    .from('team_members')
    .select('id, owner_id, status')
    .eq('member_id', userId)
    .eq('status', 'active');

  if (v1Members?.length) {
    for (const m of v1Members) {
      // Look up the team for this owner
      const { data: ownerTeam } = await supabase
        .from('teams')
        .select('id, name, owner_id')
        .eq('owner_id', m.owner_id)
        .limit(1)
        .single();

      if (ownerTeam && !seenTeamIds.has(ownerTeam.id)) {
        memberships.push({
          id: m.id,
          teamId: ownerTeam.id,
          teamName: ownerTeam.name,
          ownerId: ownerTeam.owner_id,
          role: 'member',
          owner_id: ownerTeam.owner_id,
          status: 'active',
        });
        seenTeamIds.add(ownerTeam.id);
      }
    }
  }

  return memberships;
}

/**
 * Extract owner_id from a Supabase team_profiles row that joins teams.
 * Handles the Supabase join shape safely.
 */
export function getTeamOwnerFromProfile(
  profile: { teams?: unknown }
): string | null {
  const teams = profile.teams as { owner_id?: string } | null;
  return teams?.owner_id ?? null;
}
