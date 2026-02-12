import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUserLeadSharkClient } from '@/lib/integrations/leadshark';

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
      .select('id, user_id, idea_id, template_id, style_id, draft_content, final_content, dm_template, cta_word, variations, status, hook_score, polish_status, polish_notes, scheduled_time, auto_publish_after, is_buffer, buffer_position, leadshark_post_id, created_at, updated_at')
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

    // LeadShark requires scheduled_time at least 15 minutes in the future
    const minTime = new Date(Date.now() + 16 * 60 * 1000);
    const candidate = scheduled_time || post.scheduled_time;
    const candidateDate = candidate ? new Date(candidate) : null;
    const scheduleTime = (candidateDate && candidateDate > minTime)
      ? candidate
      : minTime.toISOString();

    // Try to schedule via LeadShark
    const leadshark = await getUserLeadSharkClient(session.user.id);

    if (leadshark) {
      const result = await leadshark.createScheduledPost({
        content,
        scheduled_time: scheduleTime,
      });

      if (result.error) {
        return NextResponse.json({ error: `LeadShark error: ${result.error}` }, { status: 502 });
      }

      // Update post with LeadShark post ID
      const { error: updateError } = await supabase
        .from('cp_pipeline_posts')
        .update({
          status: 'scheduled',
          scheduled_time: scheduleTime,
          leadshark_post_id: result.data?.id || null,
        })
        .eq('id', post_id)
        .eq('user_id', session.user.id);

      if (updateError) {
        console.error('DB update failed after LeadShark schedule:', updateError.message);
        return NextResponse.json({ error: 'Scheduled in LeadShark but failed to update local status' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        scheduled_via: 'leadshark',
        leadshark_post_id: result.data?.id,
      });
    }

    // No LeadShark — just update status locally
    const { error: localUpdateError } = await supabase
      .from('cp_pipeline_posts')
      .update({
        status: 'scheduled',
        scheduled_time: scheduleTime,
      })
      .eq('id', post_id)
      .eq('user_id', session.user.id);

    if (localUpdateError) {
      console.error('DB update failed for local schedule:', localUpdateError.message);
      return NextResponse.json({ error: 'Failed to update post status' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      scheduled_via: 'local',
    });
  } catch (error) {
    console.error('Post schedule error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
