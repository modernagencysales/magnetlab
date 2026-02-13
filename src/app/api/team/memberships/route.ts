import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getMergedMemberships } from '@/lib/utils/team-membership';
import { ApiErrors } from '@/lib/api/errors';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const allMemberships = await getMergedMemberships(session.user.id);

  if (allMemberships.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch owner details
  const supabase = createSupabaseAdminClient();
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
