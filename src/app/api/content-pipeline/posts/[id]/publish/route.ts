import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUserLeadSharkClient } from '@/lib/integrations/leadshark';

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

    // Fetch the post and verify ownership
    const { data: post, error: fetchError } = await supabase
      .from('cp_pipeline_posts')
      .select('id, user_id, draft_content, final_content, scheduled_time, status')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const content = post.final_content || post.draft_content;
    if (!content) {
      return NextResponse.json({ error: 'No content to publish' }, { status: 400 });
    }

    // Get user's LeadShark client
    const leadshark = await getUserLeadSharkClient(session.user.id);
    if (!leadshark) {
      return NextResponse.json(
        { error: 'LeadShark not configured. Go to Settings \u2192 Integrations to add your API key.' },
        { status: 400 }
      );
    }

    // Use existing scheduled_time if it's far enough in the future, otherwise schedule 16 min from now
    // LeadShark requires scheduled_time to be at least 15 minutes in the future
    const minTime = new Date(Date.now() + 16 * 60 * 1000);
    const existingTime = post.scheduled_time ? new Date(post.scheduled_time) : null;
    const scheduledTime = (existingTime && existingTime > minTime)
      ? post.scheduled_time
      : minTime.toISOString();

    const result = await leadshark.createScheduledPost({
      content,
      scheduled_time: scheduledTime,
    });

    if (result.error) {
      console.error('LeadShark publish error:', result.error);
      return NextResponse.json(
        { error: `LeadShark error: ${result.error}` },
        { status: 502 }
      );
    }

    // Update post status and save LeadShark post ID
    const { error: updateError } = await supabase
      .from('cp_pipeline_posts')
      .update({
        status: 'scheduled',
        leadshark_post_id: result.data?.id || null,
      })
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (updateError) {
      console.error('Failed to update post after publish:', updateError.message);
      return NextResponse.json({ error: 'Published but failed to update status' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      leadshark_post_id: result.data?.id || null,
    });
  } catch (error) {
    console.error('Publish post error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
