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
      .select('*')
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

    const scheduleTime = scheduled_time || post.scheduled_time;
    if (!scheduleTime) {
      return NextResponse.json({ error: 'scheduled_time is required' }, { status: 400 });
    }

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
      await supabase
        .from('cp_pipeline_posts')
        .update({
          status: 'scheduled',
          scheduled_time: scheduleTime,
          leadshark_post_id: result.data?.id || null,
        })
        .eq('id', post_id)
        .eq('user_id', session.user.id);

      return NextResponse.json({
        success: true,
        scheduled_via: 'leadshark',
        leadshark_post_id: result.data?.id,
      });
    }

    // No LeadShark — just update status locally
    await supabase
      .from('cp_pipeline_posts')
      .update({
        status: 'scheduled',
        scheduled_time: scheduleTime,
      })
      .eq('id', post_id)
      .eq('user_id', session.user.id);

    return NextResponse.json({
      success: true,
      scheduled_via: 'local',
    });
  } catch (error) {
    console.error('Post schedule error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
