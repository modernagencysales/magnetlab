import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { writePostFromIdea } from '@/trigger/write-post-from-idea';

import { logError } from '@/lib/utils/logger';

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
    const supabase = createSupabaseAdminClient();

    // Parse optional profileId from request body
    let profileId: string | undefined;
    try {
      const body = await request.json();
      profileId = body.profileId;
    } catch {
      // Body is optional
    }

    // Read team context from cookie
    const cookieStore = await cookies();
    const teamContextId = cookieStore.get('ml-team-context')?.value;

    // Resolve team profile scope for authorization
    let teamProfileScope: string[] | null = null;
    if (teamContextId) {
      const { data: profiles } = await supabase
        .from('team_profiles')
        .select('id')
        .eq('team_id', teamContextId)
        .eq('status', 'active');
      if (profiles && profiles.length > 0) {
        teamProfileScope = profiles.map(p => p.id);
      }
    }

    // Verify idea exists and user has access (own idea or team member's idea)
    let ideaQuery = supabase
      .from('cp_content_ideas')
      .select('id, user_id, status, team_profile_id')
      .eq('id', id);

    if (teamProfileScope) {
      ideaQuery = ideaQuery.in('team_profile_id', teamProfileScope);
    } else {
      ideaQuery = ideaQuery.eq('user_id', session.user.id);
    }

    const { data: idea, error: ideaError } = await ideaQuery.single();

    if (ideaError || !idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    // Set status to writing immediately
    await supabase
      .from('cp_content_ideas')
      .update({ status: 'writing' })
      .eq('id', id);

    // Fire-and-forget: trigger background task
    try {
      // Resolve team context
      let teamId: string | undefined;
      const resolvedProfileId = profileId || idea.team_profile_id || undefined;
      if (resolvedProfileId) {
        const { data: profile } = await supabase
          .from('team_profiles')
          .select('team_id')
          .eq('id', resolvedProfileId)
          .single();
        teamId = profile?.team_id || undefined;
      }

      // Use the idea owner's user_id (not session user) so the post is created under the right account
      await tasks.trigger<typeof writePostFromIdea>('write-post-from-idea', {
        userId: idea.user_id,
        ideaId: id,
        teamId,
        profileId: resolvedProfileId,
      });
    } catch (triggerError) {
      logError('cp/ideas/write', triggerError, { step: 'trigger_write_task' });
      // Revert status on trigger failure
      await supabase
        .from('cp_content_ideas')
        .update({ status: 'extracted' })
        .eq('id', id);
      return NextResponse.json({ error: 'Failed to start writing' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: 'writing' });
  } catch (error) {
    logError('cp/ideas/write', error, { step: 'write_post_from_idea_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
