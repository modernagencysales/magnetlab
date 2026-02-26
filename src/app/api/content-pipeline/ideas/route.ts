import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

import { logError } from '@/lib/utils/logger';

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ideaId, status } = body;

    if (!ideaId || typeof ideaId !== 'string') {
      return NextResponse.json({ error: 'ideaId is required' }, { status: 400 });
    }

    const VALID_STATUSES = ['extracted', 'selected', 'writing', 'written', 'scheduled', 'published', 'archived'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Read team context from cookie for team-scoped access
    const cookieStore = await cookies();
    const teamContextId = cookieStore.get('ml-team-context')?.value;

    let teamProfileScope: string[] | null = null;
    if (teamContextId) {
      const { data: profiles } = await supabase
        .from('team_profiles')
        .select('id')
        .eq('team_id', teamContextId)
        .eq('status', 'active');
      if (profiles && profiles.length > 0) {
        teamProfileScope = profiles.map(p => p.id);
      }
    }

    // Verify access then update
    let updateQuery = supabase
      .from('cp_content_ideas')
      .update({ status })
      .eq('id', ideaId);

    if (teamProfileScope) {
      updateQuery = updateQuery.in('team_profile_id', teamProfileScope);
    } else {
      updateQuery = updateQuery.eq('user_id', session.user.id);
    }

    const { data, error } = await updateQuery.select().single();

    if (error || !data) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    return NextResponse.json({ idea: data });
  } catch (error) {
    logError('cp/ideas', error, { step: 'idea_update_error' });
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
    const pillar = searchParams.get('pillar');
    const contentType = searchParams.get('content_type');
    const teamProfileId = searchParams.get('team_profile_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Read team_id from query param, fall back to server-side cookie
    let teamId = searchParams.get('team_id');
    if (!teamId) {
      const cookieStore = await cookies();
      teamId = cookieStore.get('ml-team-context')?.value || null;
    }

    const VALID_STATUSES = ['extracted', 'selected', 'writing', 'written', 'scheduled', 'published', 'archived'];
    const VALID_PILLARS = ['moments_that_matter', 'teaching_promotion', 'human_personal', 'collaboration_social_proof'];
    const VALID_CONTENT_TYPES = ['story', 'insight', 'tip', 'framework', 'case_study', 'question', 'listicle', 'contrarian'];

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }
    if (pillar && !VALID_PILLARS.includes(pillar)) {
      return NextResponse.json({ error: 'Invalid pillar value' }, { status: 400 });
    }
    if (contentType && !VALID_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json({ error: 'Invalid content_type value' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // If team_id is provided, scope to ideas created for this team (by team_profile_id)
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
      .from('cp_content_ideas')
      .select('id, user_id, transcript_id, title, core_insight, why_post_worthy, full_context, content_type, content_pillar, relevance_score, composite_score, hook, key_points, source_quote, target_audience, status, team_profile_id, created_at, updated_at');

    if (teamProfileScope) {
      query = query.in('team_profile_id', teamProfileScope);
    } else {
      query = query.eq('user_id', session.user.id);
    }

    query = query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (pillar) query = query.eq('content_pillar', pillar);
    if (contentType) query = query.eq('content_type', contentType);
    if (teamProfileId) query = query.eq('team_profile_id', teamProfileId);

    const { data, error } = await query;

    if (error) {
      logError('cp/ideas', new Error(error.message), { step: 'failed_to_fetch_ideas' });
      return NextResponse.json({ error: 'Failed to fetch ideas' }, { status: 500 });
    }

    // Enrich with profile names
    const ideas = data || [];
    const profileIds = [...new Set(ideas.map(i => i.team_profile_id).filter(Boolean))] as string[];
    let profileMap: Record<string, string> = {};

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('team_profiles')
        .select('id, full_name')
        .in('id', profileIds);
      if (profiles) {
        profileMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));
      }
    }

    const enrichedIdeas = ideas.map(i => ({
      ...i,
      profile_name: i.team_profile_id ? profileMap[i.team_profile_id] || null : null,
    }));

    return NextResponse.json({ ideas: enrichedIdeas });
  } catch (error) {
    logError('cp/ideas', error, { step: 'ideas_list_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
