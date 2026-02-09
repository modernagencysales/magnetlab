import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const isBuffer = searchParams.get('is_buffer');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('cp_pipeline_posts')
      .select('id, user_id, idea_id, template_id, style_id, draft_content, final_content, dm_template, cta_word, variations, status, hook_score, polish_status, polish_notes, scheduled_time, auto_publish_after, is_buffer, buffer_position, leadshark_post_id, created_at, updated_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (isBuffer === 'true') query = query.eq('is_buffer', true);
    if (isBuffer === 'false') query = query.eq('is_buffer', false);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    console.error('Posts list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
