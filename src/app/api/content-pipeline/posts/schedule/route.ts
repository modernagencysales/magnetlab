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
    const { post_id, scheduled_time } = body;

    if (!post_id) {
      return NextResponse.json({ error: 'post_id is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Get the post
    const { data: post, error: postError } = await supabase
      .from('cp_pipeline_posts')
      .select('id, user_id, draft_content, final_content, status, scheduled_time')
      .eq('id', post_id)
      .eq('user_id', session.user.id)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const content = post.final_content || post.draft_content;
    if (!content) {
      return NextResponse.json({ error: 'Post has no content to schedule' }, { status: 400 });
    }

    // Use provided scheduled_time, post's existing time, or default to now
    const scheduleTime = scheduled_time || post.scheduled_time || new Date().toISOString();

    // Save to DB — the auto-publish-check cron will handle actual publishing
    const { error: updateError } = await supabase
      .from('cp_pipeline_posts')
      .update({
        status: 'scheduled',
        scheduled_time: scheduleTime,
      })
      .eq('id', post_id)
      .eq('user_id', session.user.id);

    if (updateError) {
      logError('cp/posts/schedule', new Error(String(updateError.message)), { step: 'db_update_failed_for_schedule' });
      return NextResponse.json({ error: 'Failed to update post status' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      scheduled_via: 'pending',
    });
  } catch (error) {
    logError('cp/posts/schedule', error, { step: 'post_schedule_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
