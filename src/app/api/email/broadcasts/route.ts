// API Route: Email Broadcasts
// GET — List broadcasts for team
// POST — Create a draft broadcast

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { createBroadcastSchema } from '@/lib/types/email-system';
import * as emailService from '@/server/services/email.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.listBroadcasts(scope.teamId);
    if (!result.success) return ApiErrors.databaseError('Failed to list broadcasts');
    return NextResponse.json({ broadcasts: result.broadcasts });
  } catch (error) {
    logApiError('email/broadcasts/list', error);
    return ApiErrors.internalError('Failed to list broadcasts');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const parsed = createBroadcastSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid broadcast data',
        parsed.error.issues
      );
    }

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.createBroadcast(scope.teamId, session.user.id, {
      subject: parsed.data.subject,
      body: parsed.data.body,
    });
    if (!result.success) return ApiErrors.databaseError('Failed to create broadcast');
    return NextResponse.json({ broadcast: result.broadcast }, { status: 201 });
  } catch (error) {
    logApiError('email/broadcasts/create', error);
    return ApiErrors.internalError('Failed to create broadcast');
  }
}
