import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { broadcastPostVariations } from '@/trigger/broadcast-post-variations';
import { logError } from '@/lib/utils/logger';
import { verifyTeamMembership } from '@/lib/services/team-integrations';

const broadcastSchema = z.object({
  source_post_id: z.string().uuid(),
  target_profile_ids: z.array(z.string().uuid()).min(1),
  stagger_days: z.number().int().min(1).max(5).optional().default(2),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = broadcastSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { source_post_id, target_profile_ids, stagger_days: staggerDays } = parsed.data;

    const supabase = createSupabaseAdminClient();

    // Derive team_id from source post's team_profile_id for auth check
    const { data: sourcePost } = await supabase
      .from('cp_pipeline_posts')
      .select('team_profile_id')
      .eq('id', source_post_id)
      .single();

    if (sourcePost?.team_profile_id) {
      const { data: profile } = await supabase
        .from('team_profiles')
        .select('team_id')
        .eq('id', sourcePost.team_profile_id)
        .single();

      if (profile?.team_id) {
        const memberCheck = await verifyTeamMembership(supabase, profile.team_id, session.user.id);
        if (!memberCheck.authorized) {
          return NextResponse.json({ error: memberCheck.error }, { status: memberCheck.status });
        }
      }
    }

    // Trigger the broadcast task
    const handle = await tasks.trigger<typeof broadcastPostVariations>(
      'broadcast-post-variations',
      {
        sourcePostId: source_post_id,
        targetProfileIds: target_profile_ids,
        userId: session.user.id,
        staggerDays,
      }
    );

    return NextResponse.json({
      success: true,
      run_id: handle.id,
      message: `Broadcasting to ${target_profile_ids.length} team members`,
    });
  } catch (error) {
    logError('cp/broadcast', error, { step: 'broadcast_trigger_error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
