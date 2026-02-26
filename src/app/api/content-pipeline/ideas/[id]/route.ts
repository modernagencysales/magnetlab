import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

import { logError } from '@/lib/utils/logger';

async function getTeamProfileScope(): Promise<string[] | null> {
  const cookieStore = await cookies();
  const teamId = cookieStore.get('ml-team-context')?.value;
  if (!teamId) return null;

  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id')
    .eq('team_id', teamId)
    .eq('status', 'active');

  return profiles && profiles.length > 0 ? profiles.map(p => p.id) : null;
}

export async function GET(
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
    const teamProfileScope = await getTeamProfileScope();

    let query = supabase
      .from('cp_content_ideas')
      .select('id, user_id, transcript_id, title, core_insight, why_post_worthy, full_context, content_type, content_pillar, relevance_score, composite_score, hook, key_points, source_quote, target_audience, status, team_profile_id, created_at, updated_at')
      .eq('id', id);

    if (teamProfileScope) {
      query = query.in('team_profile_id', teamProfileScope);
    } else {
      query = query.eq('user_id', session.user.id);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    return NextResponse.json({ idea: data });
  } catch (error) {
    logError('cp/ideas', error, { step: 'idea_get_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();
    const teamProfileScope = await getTeamProfileScope();

    // Whitelist allowed fields to prevent arbitrary column updates
    const ALLOWED_FIELDS = ['status', 'title', 'content_pillar', 'content_type', 'core_insight', 'why_post_worthy', 'full_context'] as const;
    const filtered: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body) {
        filtered[key] = body[key];
      }
    }

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    // First verify access
    let checkQuery = supabase
      .from('cp_content_ideas')
      .select('id')
      .eq('id', id);

    if (teamProfileScope) {
      checkQuery = checkQuery.in('team_profile_id', teamProfileScope);
    } else {
      checkQuery = checkQuery.eq('user_id', session.user.id);
    }

    const { data: accessible } = await checkQuery.single();
    if (!accessible) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('cp_content_ideas')
      .update(filtered)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ idea: data });
  } catch (error) {
    logError('cp/ideas', error, { step: 'idea_update_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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
    const teamProfileScope = await getTeamProfileScope();

    // Verify access first
    let checkQuery = supabase
      .from('cp_content_ideas')
      .select('id')
      .eq('id', id);

    if (teamProfileScope) {
      checkQuery = checkQuery.in('team_profile_id', teamProfileScope);
    } else {
      checkQuery = checkQuery.eq('user_id', session.user.id);
    }

    const { data: accessible } = await checkQuery.single();
    if (!accessible) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('cp_content_ideas')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('cp/ideas', error, { step: 'idea_delete_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
