import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import { verifyTeamMembership } from '@/lib/services/team-integrations';

const assignSchema = z.object({
  post_id: z.string().uuid(),
  scheduled_time: z.string().datetime(),
  team_profile_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = assignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { post_id, scheduled_time, team_profile_id } = parsed.data;

    const supabase = createSupabaseAdminClient();

    // Verify post exists and get its team_profile_id for auth check
    const { data: post, error: postError } = await supabase
      .from('cp_pipeline_posts')
      .select('id, team_profile_id')
      .eq('id', post_id)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Derive team_id from the post's team_profile_id (or the provided one)
    const profileIdForAuth = team_profile_id || post.team_profile_id;
    if (profileIdForAuth) {
      const { data: profile } = await supabase
        .from('team_profiles')
        .select('team_id')
        .eq('id', profileIdForAuth)
        .single();

      if (profile?.team_id) {
        const memberCheck = await verifyTeamMembership(supabase, profile.team_id, session.user.id);
        if (!memberCheck.authorized) {
          return NextResponse.json({ error: memberCheck.error }, { status: memberCheck.status });
        }
      }
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      scheduled_time,
      status: 'scheduled',
      is_buffer: false,
    };

    if (team_profile_id) {
      updatePayload.team_profile_id = team_profile_id;
    }

    const { error: updateError } = await supabase
      .from('cp_pipeline_posts')
      .update(updatePayload)
      .eq('id', post_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('cp/team-schedule/assign', error, { step: 'assign_post_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
