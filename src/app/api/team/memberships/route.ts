import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getMergedMemberships } from '@/lib/utils/team-membership';
import { ApiErrors } from '@/lib/api/errors';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const allMemberships = await getMergedMemberships(session.user.id);

  // Return team-based memberships directly (getMergedMemberships now includes teamId/teamName)
  const memberships = allMemberships.map(m => ({
    id: m.id,
    teamId: m.teamId,
    teamName: m.teamName,
    ownerId: m.ownerId,
    role: m.role,
  }));

  return NextResponse.json(memberships);
}
