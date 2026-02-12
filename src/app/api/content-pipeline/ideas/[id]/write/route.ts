import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { writePostFromIdea } from '@/trigger/write-post-from-idea';

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

    // Verify idea exists and belongs to user
    const { data: idea, error: ideaError } = await supabase
      .from('cp_content_ideas')
      .select('id, status, team_profile_id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

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

      await tasks.trigger<typeof writePostFromIdea>('write-post-from-idea', {
        userId: session.user.id,
        ideaId: id,
        teamId,
        profileId: resolvedProfileId,
      });
    } catch (triggerError) {
      console.error('Failed to trigger write task:', triggerError);
      // Revert status on trigger failure
      await supabase
        .from('cp_content_ideas')
        .update({ status: 'extracted' })
        .eq('id', id);
      return NextResponse.json({ error: 'Failed to start writing' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: 'writing' });
  } catch (error) {
    console.error('Write post from idea error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
