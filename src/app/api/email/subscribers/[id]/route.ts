// API Route: Email Subscriber by ID
// DELETE — Unsubscribe a subscriber (soft delete: sets status + unsubscribed_at)

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as emailService from '@/server/services/email.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid subscriber ID format');

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.unsubscribeSubscriberById(scope.teamId, id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Subscriber');
      return ApiErrors.databaseError('Failed to unsubscribe');
    }
    if (result.already) {
      return NextResponse.json({ message: 'Subscriber already unsubscribed' });
    }
    return NextResponse.json({ message: 'Subscriber unsubscribed' });
  } catch (error) {
    logApiError('email/subscribers/delete', error);
    return ApiErrors.internalError('Failed to unsubscribe');
  }
}
