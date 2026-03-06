// API Route: Email Broadcast by ID
// GET — Get a single broadcast
// PUT — Update a draft broadcast
// DELETE — Delete a draft broadcast

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { updateBroadcastSchema } from '@/lib/types/email-system';
import * as emailService from '@/server/services/email.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid broadcast ID format');

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.getBroadcast(scope.teamId, id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Broadcast');
      return ApiErrors.databaseError('Failed to get broadcast');
    }
    return NextResponse.json({ broadcast: result.broadcast });
  } catch (error) {
    logApiError('email/broadcasts/get', error);
    return ApiErrors.internalError('Failed to get broadcast');
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid broadcast ID format');

    const body = await request.json();
    const parsed = updateBroadcastSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid broadcast data',
        parsed.error.issues
      );
    }

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.updateBroadcast(
      scope.teamId,
      id,
      {
        subject: parsed.data.subject,
        body: parsed.data.body,
        audience_filter: parsed.data.audience_filter,
      },
      { captureEdits: true }
    );
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Broadcast');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Validation failed');
      return ApiErrors.databaseError('Failed to update broadcast');
    }
    return NextResponse.json({ broadcast: result.broadcast });
  } catch (error) {
    logApiError('email/broadcasts/update', error);
    return ApiErrors.internalError('Failed to update broadcast');
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid broadcast ID format');

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.deleteBroadcast(scope.teamId, id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Broadcast');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Validation failed');
      return ApiErrors.databaseError('Failed to delete broadcast');
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logApiError('email/broadcasts/delete', error);
    return ApiErrors.internalError('Failed to delete broadcast');
  }
}
