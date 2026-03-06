import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpPlannerService from '@/server/services/cp-planner.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const result = await cpPlannerService.getById(session.user.id, id);
    if (!result.success) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    return NextResponse.json({ plan: result.plan });
  } catch (error) {
    logApiError('cp/planner', error);
    return ApiErrors.internalError('Failed to fetch plan');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const body = await request.json();
    const result = await cpPlannerService.update(session.user.id, id, body);
    if (!result.success) {
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'No valid fields to update');
      return ApiErrors.databaseError(result.message ?? 'Failed to update plan');
    }
    return NextResponse.json({ plan: result.plan });
  } catch (error) {
    logApiError('cp/planner', error);
    return ApiErrors.internalError('Failed to update plan');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const result = await cpPlannerService.deletePlan(session.user.id, id);
    if (!result.success) return ApiErrors.databaseError('Failed to delete plan');
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('cp/planner', error);
    return ApiErrors.internalError('Failed to delete plan');
  }
}
