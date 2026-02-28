import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpPlannerService from '@/server/services/cp-planner.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { plan_id } = body;
    if (!plan_id) return ApiErrors.validationError('plan_id is required');

    const result = await cpPlannerService.approve(session.user.id, plan_id);
    if (!result.success) {
      if (result.error === 'not_found') return NextResponse.json({ error: result.message }, { status: 404 });
      if (result.error === 'validation') return NextResponse.json({ error: result.message }, { status: 400 });
      return ApiErrors.databaseError(result.message ?? 'Failed to approve plan');
    }
    return NextResponse.json({ success: true, posts_created: result.posts_created });
  } catch (error) {
    logApiError('cp/planner', error);
    return ApiErrors.internalError('Failed to approve plan');
  }
}
