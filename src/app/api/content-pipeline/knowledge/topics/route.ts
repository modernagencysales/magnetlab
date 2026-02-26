import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { listKnowledgeTopics, verifyTeamMembership } from '@/lib/services/knowledge-brain';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Read team_id from query param, fall back to server-side cookie
    let teamId: string | undefined = searchParams.get('team_id') || undefined;
    if (!teamId) {
      const cookieStore = await cookies();
      teamId = cookieStore.get('ml-team-context')?.value || undefined;
    }

    if (teamId) {
      const isMember = await verifyTeamMembership(session.user.id, teamId);
      if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Resolve effective user ID for team-scoped queries (use team owner's user_id)
    let effectiveUserId = session.user.id;
    if (teamId) {
      const supabase = createSupabaseAdminClient();
      const { data: ownerProfile } = await supabase
        .from('team_profiles')
        .select('user_id')
        .eq('team_id', teamId)
        .eq('role', 'owner')
        .limit(1)
        .single();
      if (ownerProfile) {
        effectiveUserId = ownerProfile.user_id;
      }
    }

    const topics = await listKnowledgeTopics(effectiveUserId, { limit });
    return NextResponse.json({ topics });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
