import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export interface Membership {
  id: string;
  owner_id: string;
  status: string;
}

/**
 * Get all team memberships for a user, merging V1 (team_members) and V2 (team_profiles).
 * Deduplicates by owner_id, excludes self-ownership.
 */
export async function getMergedMemberships(userId: string): Promise<Membership[]> {
  const supabase = createSupabaseAdminClient();

  // V1: legacy team_members
  const { data: v1Members } = await supabase
    .from('team_members')
    .select('id, owner_id, status')
    .eq('member_id', userId)
    .eq('status', 'active');

  const memberships: Membership[] = [...(v1Members || [])];
  const existingOwnerIds = new Set(memberships.map(m => m.owner_id));

  // V2: team_profiles (join through teams to get owner_id)
  const { data: profileMemberships } = await supabase
    .from('team_profiles')
    .select('id, team_id, role, teams(owner_id)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (profileMemberships?.length) {
    for (const pm of profileMemberships) {
      // Supabase returns the joined `teams` as an object (single FK)
      const teams = pm.teams as unknown as { owner_id: string } | null;
      const ownerId = teams?.owner_id;
      if (ownerId && ownerId !== userId && !existingOwnerIds.has(ownerId)) {
        memberships.push({ id: pm.id, owner_id: ownerId, status: 'active' });
        existingOwnerIds.add(ownerId);
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
