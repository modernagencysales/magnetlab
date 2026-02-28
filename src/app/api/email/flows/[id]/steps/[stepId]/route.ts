// API Route: Single Email Flow Step
// PUT — Update a step
// DELETE — Remove a step (renumbers remaining)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { updateStepSchema } from '@/lib/types/email-system';
import * as emailService from '@/server/services/email.service';

interface RouteParams {
  params: Promise<{ id: string; stepId: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id: flowId, stepId } = await params;
    if (!isValidUUID(flowId) || !isValidUUID(stepId)) return ApiErrors.validationError('Invalid ID format');

    const body = await request.json();
    const parsed = updateStepSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid step data',
        parsed.error.issues
      );
    }

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) return ApiErrors.validationError('No fields to update');

    const result = await emailService.updateFlowStep(scope.teamId, flowId, stepId, updates);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Step');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Validation failed');
      return ApiErrors.databaseError('Failed to update step');
    }
    return NextResponse.json({ step: result.step });
  } catch (error) {
    logApiError('email/flows/steps/update', error);
    return ApiErrors.internalError('Failed to update step');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id: flowId, stepId } = await params;
    if (!isValidUUID(flowId) || !isValidUUID(stepId)) return ApiErrors.validationError('Invalid ID format');

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.deleteFlowStep(scope.teamId, flowId, stepId);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Step');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Validation failed');
      return ApiErrors.databaseError('Failed to delete step');
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logApiError('email/flows/steps/delete', error);
    return ApiErrors.internalError('Failed to delete step');
  }
}
