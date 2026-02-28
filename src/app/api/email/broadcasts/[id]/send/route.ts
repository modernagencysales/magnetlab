// API Route: Send a Broadcast
// POST — Queue a draft broadcast for sending via Trigger.dev

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as emailService from '@/server/services/email.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid broadcast ID format');

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.sendBroadcast(scope.teamId, id, session.user.id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Broadcast');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Validation failed');
      return ApiErrors.databaseError('Failed to send broadcast');
    }
    return NextResponse.json({
      message: 'Broadcast queued for sending',
      recipient_count: result.recipient_count,
    });
  } catch (error) {
    logApiError('email/broadcasts/send', error);
    return ApiErrors.internalError('Failed to send broadcast');
  }
}
