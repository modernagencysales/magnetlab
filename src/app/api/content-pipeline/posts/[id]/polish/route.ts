import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { polishPost } from '@/lib/ai/content-pipeline/post-polish';

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

    const { data: post, error: fetchError } = await supabase
      .from('cp_pipeline_posts')
      .select('draft_content, final_content')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const content = post.final_content || post.draft_content;
    if (!content) {
      return NextResponse.json({ error: 'No content to polish' }, { status: 400 });
    }

    const result = await polishPost(content);

    const { data: updated, error: updateError } = await supabase
      .from('cp_pipeline_posts')
      .update({
        final_content: result.polished,
        hook_score: result.hookScore.score,
        polish_status: result.changes.length > 0 ? 'polished' : 'skipped',
        polish_notes: result.changes.length > 0 ? result.changes.join('; ') : 'No changes needed',
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id')
      .maybeSingle();

    if (updateError) {
      console.error('Failed to update polished post:', updateError.message);
      return NextResponse.json({ error: 'Failed to save polish result' }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: 'Post not found or not updated' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      polishResult: {
        aiPatternsFound: result.aiPatternsFound,
        hookScore: result.hookScore,
        changes: result.changes,
      },
    });
  } catch (error) {
    console.error('Polish post error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
