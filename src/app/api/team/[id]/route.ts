import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as teamService from '@/server/services/team.service';

// GET /api/team/[id] — fetch team by ID (requires membership)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid team ID');

    const result = await teamService.getTeam(id, session.user.id);
    if (!result) return ApiErrors.forbidden();
    return NextResponse.json(result);
  } catch (error) {
    logApiError('team-get', error);
    return ApiErrors.internalError();
  }
}

// DELETE /api/team/[id] — remove a team member (id = member row id)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid member ID');

    const result = await teamService.removeMember(id, session.user.id);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') return ApiErrors.notFound('Team member');
      if (result.error === 'FORBIDDEN') return ApiErrors.forbidden();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('team-remove', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError();
  }
}
