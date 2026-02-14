import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    // Verify ownership and status
    const { data: post } = await supabase
      .from('cp_pipeline_posts')
      .select('id, status, user_id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.status !== 'publish_failed') {
      return NextResponse.json(
        { error: 'Only failed posts can be retried' },
        { status: 400 }
      );
    }

    // Reset to scheduled with immediate publish time
    const { error: updateError } = await supabase
      .from('cp_pipeline_posts')
      .update({
        status: 'scheduled',
        error_log: null,
        scheduled_time: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      logApiError('posts/retry', updateError);
      return ApiErrors.databaseError('Failed to retry post');
    }

    return NextResponse.json({ success: true, message: 'Post queued for retry' });
  } catch (error) {
    logApiError('posts/retry', error);
    return ApiErrors.internalError('Failed to retry post');
  }
}
