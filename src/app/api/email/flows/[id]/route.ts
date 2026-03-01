// API Route: Single Email Flow
// GET — Get flow with steps
// PUT — Update flow
// DELETE — Delete flow (draft or paused only)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { updateFlowSchema } from '@/lib/types/email-system';
import * as emailService from '@/server/services/email.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid flow ID');

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.getFlowWithSteps(scope.teamId, id);
    if (!result.success) return ApiErrors.notFound('Flow');
    return NextResponse.json({ flow: result.flow });
  } catch (error) {
    logApiError('email/flows/get', error);
    return ApiErrors.internalError('Failed to fetch flow');
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid flow ID');

    const body = await request.json();
    const parsed = updateFlowSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid flow data',
        parsed.error.issues
      );
    }

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) return ApiErrors.validationError('No fields to update');

    const result = await emailService.updateFlow(scope.teamId, id, session.user.id, updates);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Flow');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Validation failed');
      return ApiErrors.databaseError('Failed to update flow');
    }
    return NextResponse.json({ flow: result.flow });
  } catch (error) {
    logApiError('email/flows/update', error);
    return ApiErrors.internalError('Failed to update flow');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid flow ID');

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.deleteFlow(scope.teamId, id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Flow');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Validation failed');
      return ApiErrors.databaseError('Failed to delete flow');
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logApiError('email/flows/delete', error);
    return ApiErrors.internalError('Failed to delete flow');
  }
}
