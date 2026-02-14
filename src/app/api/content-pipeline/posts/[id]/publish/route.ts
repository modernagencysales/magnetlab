import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUserLinkedInPublisher } from '@/lib/integrations/linkedin-publisher';

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
      .select('id, user_id, draft_content, final_content, scheduled_time, status, lead_magnet_id')
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

    // Get publisher (Unipile)
    const publisher = await getUserLinkedInPublisher(session.user.id);
    if (!publisher) {
      return NextResponse.json(
        { error: 'No LinkedIn publisher configured. Go to Settings → Integrations to connect your account.' },
        { status: 400 }
      );
    }

    const result = await publisher.publishNow(content);

    const publishedAt = new Date().toISOString();

    // Update post status
    const { error: updateError } = await supabase
      .from('cp_pipeline_posts')
      .update({
        status: 'published',
        linkedin_post_id: result.postId || null,
        publish_provider: result.provider,
        published_at: publishedAt,
      })
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (updateError) {
      console.error('Failed to update post after publish:', updateError.message);
      return NextResponse.json({ error: 'Published but failed to update status' }, { status: 500 });
    }

    // If linked to a lead magnet, update that too
    if (post.lead_magnet_id) {
      await supabase
        .from('lead_magnets')
        .update({
          linkedin_post_id: result.postId || null,
          publish_provider: result.provider,
          status: 'published',
        })
        .eq('id', post.lead_magnet_id)
        .eq('user_id', session.user.id);
    }

    return NextResponse.json({
      success: true,
      linkedin_post_id: result.postId || null,
      provider: result.provider,
    });
  } catch (error) {
    console.error('Publish post error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
