import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRecentKnowledgeDigest, verifyTeamMembership } from '@/lib/services/knowledge-brain';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const days = parseInt(searchParams.get('days') || '7', 10);
    const teamId = searchParams.get('team_id') || undefined;

    if (teamId) {
      const isMember = await verifyTeamMembership(session.user.id, teamId);
      if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const digest = await getRecentKnowledgeDigest(session.user.id, Math.min(days, 90), teamId);
    return NextResponse.json(digest);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
