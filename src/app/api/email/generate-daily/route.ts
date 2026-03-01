// API Route: Generate Daily Newsletter Email
// POST — Generate an AI newsletter email draft and save as broadcast

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as emailService from '@/server/services/email.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    let requestTopic: string | undefined;
    let requestProfileId: string | undefined;
    try {
      const body = await request.json();
      requestTopic = body?.topic;
      requestProfileId = body?.profileId;
    } catch {
      // Empty body is fine — all fields are optional
    }

    const result = await emailService.generateDaily(session.user.id, scope.teamId, {
      topic: requestTopic,
      profileId: requestProfileId,
    });
    if (!result.success) return ApiErrors.databaseError('Failed to generate daily email');
    return NextResponse.json({ broadcast: result.broadcast }, { status: 201 });
  } catch (error) {
    logApiError('email/generate-daily', error);
    return ApiErrors.internalError('Failed to generate daily email');
  }
}
