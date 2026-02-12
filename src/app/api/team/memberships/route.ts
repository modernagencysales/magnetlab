import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const supabase = createSupabaseAdminClient();

  // Check legacy team_members
  const { data, error } = await supabase
    .from('team_members')
    .select('id, owner_id, status')
    .eq('member_id', session.user.id)
    .eq('status', 'active');

  if (error) {
    logApiError('team-memberships', error, { userId: session.user.id });
    return ApiErrors.databaseError();
  }

  // Also check team_profiles memberships
  const { data: profileMemberships } = await supabase
    .from('team_profiles')
    .select('id, team_id, teams!inner(owner_id)')
    .eq('user_id', session.user.id)
    .eq('status', 'active');

  // Merge: add any team_profiles owners not already in team_members
  const allMemberships = [...(data || [])];
  if (profileMemberships?.length) {
    const existingOwnerIds = new Set(allMemberships.map(m => m.owner_id));
    for (const pm of profileMemberships) {
      const ownerIdFromProfile = (pm as unknown as { teams: { owner_id: string } }).teams.owner_id;
      if (ownerIdFromProfile !== session.user.id && !existingOwnerIds.has(ownerIdFromProfile)) {
        allMemberships.push({ id: pm.id, owner_id: ownerIdFromProfile, status: 'active' });
        existingOwnerIds.add(ownerIdFromProfile);
      }
    }
  }

  if (allMemberships.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch owner details
  const ownerIds = allMemberships.map(m => m.owner_id);
  const { data: owners } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .in('id', ownerIds);

  const ownerMap = Object.fromEntries(
    (owners || []).map(o => [o.id, o])
  );

  const memberships = allMemberships.map(m => ({
    id: m.id,
    ownerId: m.owner_id,
    ownerName: ownerMap[m.owner_id]?.name || ownerMap[m.owner_id]?.email || 'Unknown',
    ownerEmail: ownerMap[m.owner_id]?.email,
    ownerAvatar: ownerMap[m.owner_id]?.avatar_url,
  }));

  return NextResponse.json(memberships);
}
