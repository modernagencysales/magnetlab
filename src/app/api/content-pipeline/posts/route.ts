import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

import { logError } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { draft_content, status, profileId, scheduled_time } = body;

    if (!draft_content || typeof draft_content !== 'string' || !draft_content.trim()) {
      return NextResponse.json({ error: 'draft_content is required' }, { status: 400 });
    }

    const VALID_STATUSES = ['draft', 'reviewing', 'approved', 'scheduled'];
    const postStatus = status && VALID_STATUSES.includes(status) ? status : 'draft';

    const supabase = createSupabaseAdminClient();

    const insertData: Record<string, unknown> = {
      user_id: session.user.id,
      draft_content: draft_content.trim(),
      final_content: draft_content.trim(),
      status: postStatus,
    };

    if (profileId) {
      insertData.team_profile_id = profileId;
    }

    if (scheduled_time) {
      insertData.scheduled_time = scheduled_time;
      if (postStatus === 'draft') {
        insertData.status = 'scheduled';
      }
    }

    const { data, error } = await supabase
      .from('cp_pipeline_posts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      logError('cp/posts', new Error(error.message), { step: 'post_create_error' });
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
    }

    return NextResponse.json({ post: data }, { status: 201 });
  } catch (error) {
    logError('cp/posts', error, { step: 'post_create_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const isBuffer = searchParams.get('is_buffer');
    const teamProfileId = searchParams.get('team_profile_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Read team_id from query param, fall back to server-side cookie
    let teamId = searchParams.get('team_id');
    if (!teamId) {
      const cookieStore = await cookies();
      teamId = cookieStore.get('ml-team-context')?.value || null;
    }

    const supabase = createSupabaseAdminClient();

    // If team_id is provided, scope to posts created for this team (by team_profile_id)
    // Also include orphaned posts (team_profile_id IS NULL) owned by team members
    let teamProfileScope: string[] | null = null;
    let teamMemberUserIds: string[] = [];
    if (teamId) {
      const { data: profiles } = await supabase
        .from('team_profiles')
        .select('id, user_id')
        .eq('team_id', teamId)
        .eq('status', 'active');
      if (profiles && profiles.length > 0) {
        teamProfileScope = profiles.map(p => p.id);
        teamMemberUserIds = profiles.map(p => p.user_id).filter(Boolean);
      }
    }

    let query = supabase
      .from('cp_pipeline_posts')
      .select('id, user_id, idea_id, template_id, style_id, draft_content, final_content, dm_template, cta_word, variations, status, hook_score, polish_status, polish_notes, scheduled_time, auto_publish_after, is_buffer, buffer_position, linkedin_post_id, publish_provider, lead_magnet_id, published_at, engagement_stats, review_data, team_profile_id, image_urls, carousel_data, image_generation_status, created_at, updated_at');

    if (teamProfileScope) {
      // Include posts assigned to team profiles OR orphaned posts by team members
      query = query.or(
        `team_profile_id.in.(${teamProfileScope.join(',')}),and(team_profile_id.is.null,user_id.in.(${teamMemberUserIds.join(',')}))`
      );
    } else {
      query = query.eq('user_id', session.user.id);
    }

    query = query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (isBuffer === 'true') query = query.eq('is_buffer', true);
    if (isBuffer === 'false') query = query.eq('is_buffer', false);
    if (teamProfileId) query = query.eq('team_profile_id', teamProfileId);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with profile names
    const posts = data || [];
    const profileIds = [...new Set(posts.map(p => p.team_profile_id).filter(Boolean))] as string[];
    let profileMap: Record<string, { full_name: string; title: string | null }> = {};

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('team_profiles')
        .select('id, full_name, title')
        .in('id', profileIds);
      if (profiles) {
        profileMap = Object.fromEntries(profiles.map(p => [p.id, { full_name: p.full_name, title: p.title }]));
      }
    }

    const enrichedPosts = posts.map(p => ({
      ...p,
      profile_name: p.team_profile_id ? profileMap[p.team_profile_id]?.full_name || null : null,
    }));

    return NextResponse.json({ posts: enrichedPosts });
  } catch (error) {
    logError('cp/posts', error, { step: 'posts_list_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
