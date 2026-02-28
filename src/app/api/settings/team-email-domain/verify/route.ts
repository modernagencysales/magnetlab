// API Route: Team Email Domain Verification
// POST /api/settings/team-email-domain/verify

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as settingsService from '@/server/services/settings.service';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await settingsService.verifyTeamEmailDomain(session.user.id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound(result.message === 'Email domain not found' ? 'Email domain' : 'Team');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Failed to verify');
      return ApiErrors.databaseError(result.message ?? 'Failed to update email domain status');
    }
    return NextResponse.json({
      status: result.status,
      verified: result.verified,
      records: result.records,
    });
  } catch (error) {
    logApiError('team-email-domain/verify', error);
    return ApiErrors.internalError('Failed to verify email domain');
  }
}
