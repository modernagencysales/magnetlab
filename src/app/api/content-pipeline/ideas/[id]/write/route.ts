import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as ideasService from '@/server/services/ideas.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    let profileId: string | undefined;
    try {
      const body = await request.json();
      profileId = body.profileId;
    } catch {
      // Body is optional
    }

    const cookieStore = await cookies();
    const teamId = cookieStore.get('ml-team-context')?.value || null;

    const scope = teamId
      ? { type: 'team' as const, userId: session.user.id, teamId }
      : { type: 'user' as const, userId: session.user.id };

    await ideasService.triggerWritePost(scope, id, profileId);
    return NextResponse.json({ success: true, status: 'writing' });
  } catch (error) {
    logError('cp/ideas/write', error, { step: 'write_post_from_idea_error' });
    const status = ideasService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
