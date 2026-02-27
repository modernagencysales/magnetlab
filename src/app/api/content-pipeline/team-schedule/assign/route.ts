import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { post_id, scheduled_time, team_profile_id } = body;

    if (!post_id || !scheduled_time) {
      return NextResponse.json(
        { error: 'post_id and scheduled_time are required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Verify post exists
    const { data: post, error: postError } = await supabase
      .from('cp_pipeline_posts')
      .select('id')
      .eq('id', post_id)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      scheduled_time,
      status: 'scheduled',
      is_buffer: false,
    };

    if (team_profile_id) {
      updatePayload.team_profile_id = team_profile_id;
    }

    const { error: updateError } = await supabase
      .from('cp_pipeline_posts')
      .update(updatePayload)
      .eq('id', post_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('cp/team-schedule/assign', error, { step: 'assign_post_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
