import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { scoreHook } from '@/lib/ai/content-pipeline/hook-scorer';
import { logError } from '@/lib/utils/logger';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    // Fetch the post (scoped to user)
    const { data: post, error: fetchError } = await supabase
      .from('cp_pipeline_posts')
      .select('id, final_content, draft_content')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const content = post.final_content || post.draft_content;
    if (!content) {
      return NextResponse.json({ error: 'Post has no content to score' }, { status: 400 });
    }

    // Score the hook via AI
    const result = await scoreHook(content);

    // Save hook_score back to the post
    const { error: updateError } = await supabase
      .from('cp_pipeline_posts')
      .update({ hook_score: result.score })
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (updateError) {
      logError('cp/hook-score', updateError, { step: 'update_hook_score', postId: id });
    }

    return NextResponse.json(result);
  } catch (error) {
    logError('cp/hook-score', error, { step: 'hook_score_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
