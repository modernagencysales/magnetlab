import { NextRequest, NextResponse } from 'next/server';
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
    const { plan_id } = body;

    if (!plan_id) {
      return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Get the plan
    const { data: plan, error: planError } = await supabase
      .from('cp_week_plans')
      .select('id, user_id, week_start_date, posts_per_week, pillar_moments_pct, pillar_teaching_pct, pillar_human_pct, pillar_collab_pct, planned_posts, status, created_at, updated_at')
      .eq('id', plan_id)
      .eq('user_id', session.user.id)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    if (plan.status !== 'draft') {
      return NextResponse.json({ error: 'Plan is not in draft status' }, { status: 400 });
    }

    const plannedPosts = plan.planned_posts as Array<{
      idea_id: string;
      template_id: string | null;
      day: number;
      time: string;
      pillar: string;
    }>;

    // Create pipeline posts one at a time to reliably map IDs back
    const updatedPlannedPosts = [];
    for (const pp of plannedPosts) {
      const { data: created, error: insertError } = await supabase
        .from('cp_pipeline_posts')
        .insert({
          user_id: session.user.id,
          idea_id: pp.idea_id,
          template_id: pp.template_id || null,
          status: 'draft',
          scheduled_time: null,
        })
        .select('id')
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      updatedPlannedPosts.push({
        ...pp,
        assigned_post_id: created?.id || null,
      });
    }

    if (updatedPlannedPosts.length === 0) {
      return NextResponse.json({ error: 'No posts to approve' }, { status: 400 });
    }

    // Update plan status to approved
    const { error: updateError } = await supabase
      .from('cp_week_plans')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: session.user.id,
        planned_posts: updatedPlannedPosts,
      })
      .eq('id', plan_id)
      .eq('user_id', session.user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update idea statuses to 'writing'
    const ideaIds = plannedPosts.map((pp) => pp.idea_id);
    await supabase
      .from('cp_content_ideas')
      .update({ status: 'writing' })
      .in('id', ideaIds)
      .eq('user_id', session.user.id);

    return NextResponse.json({
      success: true,
      posts_created: updatedPlannedPosts.length,
    });
  } catch (error) {
    logError('cp/planner', error, { step: 'planner_approve_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
