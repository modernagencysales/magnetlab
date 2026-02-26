import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

import { logError } from '@/lib/utils/logger';

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

    // Read team_id from query param, fall back to server-side cookie
    let teamId = searchParams.get('team_id');
    if (!teamId) {
      const cookieStore = await cookies();
      teamId = cookieStore.get('ml-team-context')?.value || null;
    }

    // Resolve team profile scope
    let teamProfileScope: string[] | null = null;
    if (teamId) {
      const { data: profiles } = await supabase
        .from('team_profiles')
        .select('id')
        .eq('team_id', teamId)
        .eq('status', 'active');
      if (profiles && profiles.length > 0) {
        teamProfileScope = profiles.map(p => p.id);
      }
    }

    let query = supabase
      .from('cp_pipeline_posts')
      .select('id, user_id, idea_id, template_id, style_id, draft_content, final_content, dm_template, cta_word, variations, status, hook_score, polish_status, polish_notes, scheduled_time, auto_publish_after, is_buffer, buffer_position, linkedin_post_id, publish_provider, lead_magnet_id, published_at, engagement_stats, review_data, team_profile_id, created_at, updated_at')
      .not('scheduled_time', 'is', null)
      .gte('scheduled_time', start)
      .lte('scheduled_time', end)
      .order('scheduled_time', { ascending: true });

    if (teamProfileScope) {
      query = query.in('team_profile_id', teamProfileScope);
    } else {
      query = query.eq('user_id', session.user.id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    logError('cp/posts', error, { step: 'posts_by_date_range_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
