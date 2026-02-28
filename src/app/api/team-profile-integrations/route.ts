import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getTeamProfilesWithConnections, verifyTeamMembership } from '@/lib/services/team-integrations';
import { logError } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const teamId = searchParams.get('team_id');

    if (!teamId) {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 });
    }

    // Verify user is team owner or active member
    const supabase = createSupabaseAdminClient();
    const memberCheck = await verifyTeamMembership(supabase, teamId, session.user.id);
    if (!memberCheck.authorized) {
      return NextResponse.json({ error: memberCheck.error }, { status: memberCheck.status });
    }

    const profiles = await getTeamProfilesWithConnections(teamId);

    return NextResponse.json({ profiles });
  } catch (error) {
    logError('team-profile-integrations', error, { step: 'list_integrations_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
