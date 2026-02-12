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
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end query params are required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('cp_pipeline_posts')
      .select('id, user_id, idea_id, template_id, style_id, draft_content, final_content, dm_template, cta_word, variations, status, hook_score, polish_status, polish_notes, scheduled_time, auto_publish_after, is_buffer, buffer_position, leadshark_post_id, linkedin_post_id, publish_provider, lead_magnet_id, published_at, engagement_stats, created_at, updated_at')
      .eq('user_id', session.user.id)
      .not('scheduled_time', 'is', null)
      .gte('scheduled_time', start)
      .lte('scheduled_time', end)
      .order('scheduled_time', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    console.error('Posts by date range error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
