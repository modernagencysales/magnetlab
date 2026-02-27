import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { startOfWeek, endOfWeek, parseISO, format } from 'date-fns';
import { logError } from '@/lib/utils/logger';
import { detectContentCollisions } from '@/lib/ai/content-pipeline/collision-detector';
import type { PostForCollision } from '@/lib/ai/content-pipeline/collision-detector';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const teamId = searchParams.get('team_id');

    if (!teamId) {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Verify team exists
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get active team profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('team_profiles')
      .select('id, full_name, title, avatar_url, role, linkedin_url, user_id')
      .eq('team_id', teamId)
      .eq('status', 'active')
      .order('is_default', { ascending: false });

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        profiles: [],
        posts: [],
        slots: [],
        buffer_posts: [],
        week_start: null,
        week_end: null,
      });
    }

    const profileIds = profiles.map(p => p.id);

    // Calculate week range
    const weekStartParam = searchParams.get('week_start');
    const baseDate = weekStartParam ? parseISO(weekStartParam) : new Date();
    const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });

    // Fetch posts for the week
    const { data: posts, error: postsError } = await supabase
      .from('cp_pipeline_posts')
      .select('id, team_profile_id, status, scheduled_time, draft_content, final_content, broadcast_group_id, is_buffer, buffer_position, auto_publish_after, created_at')
      .in('team_profile_id', profileIds)
      .in('status', ['draft', 'reviewing', 'approved', 'scheduled'])
      .gte('scheduled_time', weekStart.toISOString())
      .lte('scheduled_time', weekEnd.toISOString());

    if (postsError) {
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    // Fetch posting slots
    const { data: slots, error: slotsError } = await supabase
      .from('cp_posting_slots')
      .select('id, user_id, slot_number, day_of_week, time_of_day, timezone, is_active, team_profile_id')
      .in('team_profile_id', profileIds)
      .eq('is_active', true);

    if (slotsError) {
      return NextResponse.json({ error: slotsError.message }, { status: 500 });
    }

    // Fetch buffer posts
    const { data: bufferPosts, error: bufferError } = await supabase
      .from('cp_pipeline_posts')
      .select('id, team_profile_id, status, scheduled_time, draft_content, final_content, broadcast_group_id, is_buffer, buffer_position, auto_publish_after, created_at')
      .in('team_profile_id', profileIds)
      .eq('is_buffer', true)
      .in('status', ['approved', 'reviewing'])
      .order('buffer_position', { ascending: true })
      .limit(50);

    if (bufferError) {
      return NextResponse.json({ error: bufferError.message }, { status: 500 });
    }

    // Check LinkedIn connection status
    const { data: teamIntegrations } = await supabase
      .from('team_profile_integrations')
      .select('team_profile_id, is_active, metadata')
      .in('team_profile_id', profileIds)
      .eq('service', 'unipile');

    // Build integration map from team_profile_integrations
    const integrationMap = new Map<string, boolean>();
    if (teamIntegrations) {
      for (const ti of teamIntegrations) {
        if (ti.is_active) {
          const accountId = (ti.metadata as Record<string, unknown>)?.unipile_account_id;
          if (typeof accountId === 'string') {
            integrationMap.set(ti.team_profile_id, true);
          }
        }
      }
    }

    // Fallback: check user_integrations for profiles without team integration
    const userIds = profiles
      .filter(p => p.user_id && !integrationMap.has(p.id))
      .map(p => p.user_id as string);

    if (userIds.length > 0) {
      const { data: userIntegrations } = await supabase
        .from('user_integrations')
        .select('user_id, is_active, metadata')
        .in('user_id', userIds)
        .eq('service', 'unipile');

      if (userIntegrations) {
        const userIntegrationMap = new Map<string, boolean>();
        for (const ui of userIntegrations) {
          if (ui.is_active) {
            const accountId = (ui.metadata as Record<string, unknown>)?.unipile_account_id;
            if (typeof accountId === 'string') {
              userIntegrationMap.set(ui.user_id, true);
            }
          }
        }

        // Map user integrations back to profiles
        for (const profile of profiles) {
          if (profile.user_id && !integrationMap.has(profile.id) && userIntegrationMap.has(profile.user_id)) {
            integrationMap.set(profile.id, true);
          }
        }
      }
    }

    // Enrich profiles with linkedin_connected
    const enrichedProfiles = profiles.map(p => ({
      ...p,
      linkedin_connected: integrationMap.has(p.id),
    }));

    // Build profile name lookup for collision detection
    const profileNameMap = new Map<string, string>();
    for (const p of profiles) {
      profileNameMap.set(p.id, p.full_name || 'Unknown');
    }

    // Collision detection (optional, triggered by check_collisions=true)
    const checkCollisions = searchParams.get('check_collisions') === 'true';
    let collisions = null;

    if (checkCollisions && posts && posts.length >= 2) {
      try {
        const postsForCollision: PostForCollision[] = posts.map(p => ({
          id: p.id,
          profile_name: profileNameMap.get(p.team_profile_id) || 'Unknown',
          content: (p.final_content || p.draft_content || '').slice(0, 500),
          scheduled_date: p.scheduled_time
            ? format(new Date(p.scheduled_time), 'yyyy-MM-dd')
            : '',
        })).filter(p => p.scheduled_date && p.content);

        if (postsForCollision.length >= 2) {
          collisions = await detectContentCollisions(postsForCollision);
        }
      } catch (err) {
        logError('cp/team-schedule', err, { step: 'collision_detection_error' });
        // collisions stays null on error
      }
    }

    return NextResponse.json({
      profiles: enrichedProfiles,
      posts: posts || [],
      slots: slots || [],
      buffer_posts: bufferPosts || [],
      week_start: weekStart.toISOString(),
      week_end: weekEnd.toISOString(),
      collisions,
    });
  } catch (error) {
    logError('cp/team-schedule', error, { step: 'team_schedule_fetch_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
