import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpPlannerService from '@/server/services/cp-planner.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await cpPlannerService.list(session.user.id, 12);
    if (!result.success) return ApiErrors.databaseError('Failed to fetch plans');
    return NextResponse.json({ plans: result.plans });
  } catch (error) {
    logApiError('cp/planner', error);
    return ApiErrors.internalError('Failed to fetch plans');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { week_start_date, posts_per_week, pillar_moments_pct, pillar_teaching_pct, pillar_human_pct, pillar_collab_pct, planned_posts, generation_notes } = body;
    if (!week_start_date) return ApiErrors.validationError('week_start_date is required');

    const result = await cpPlannerService.create(session.user.id, {
      week_start_date,
      posts_per_week,
      pillar_moments_pct,
      pillar_teaching_pct,
      pillar_human_pct,
      pillar_collab_pct,
      planned_posts,
      generation_notes,
    });
    if (!result.success) {
      if (result.error === 'conflict') return NextResponse.json({ error: result.message }, { status: 409 });
      return ApiErrors.databaseError(result.message ?? 'Failed to create plan');
    }
    return NextResponse.json({ plan: result.plan }, { status: 201 });
  } catch (error) {
    logApiError('cp/planner', error);
    return ApiErrors.internalError('Failed to create plan');
  }
}
