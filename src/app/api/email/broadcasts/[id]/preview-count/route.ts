// API Route: Broadcast Preview Count
// GET — Live recipient count preview for a broadcast's audience filter

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
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

    const result = await emailService.getBroadcastPreviewCount(scope.teamId, id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Broadcast');
      return ApiErrors.databaseError('Failed to get preview count');
    }
    return NextResponse.json({ count: result.count, total: result.total });
  } catch (error) {
    logApiError('email/broadcasts/preview-count', error);
    return ApiErrors.internalError('Failed to get preview count');
  }
}
