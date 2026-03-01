import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpPlannerService from '@/server/services/cp-planner.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { week_start_date, posts_per_week, pillar_distribution } = body;
    if (!week_start_date) return ApiErrors.validationError('week_start_date is required');

    const result = await cpPlannerService.generate(session.user.id, {
      week_start_date,
      posts_per_week,
      pillar_distribution,
    });
    if (!result.success) {
      if (result.error === 'validation') return NextResponse.json({ error: result.message }, { status: 400 });
      return ApiErrors.databaseError(result.message ?? 'Failed to generate plan');
    }
    return NextResponse.json({ plan: result.plan, notes: result.notes });
  } catch (error) {
    logApiError('cp/planner', error);
    return ApiErrors.internalError('Failed to generate plan');
  }
}
