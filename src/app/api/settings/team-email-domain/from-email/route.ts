// API Route: Custom From Email
// POST /api/settings/team-email-domain/from-email

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as settingsService from '@/server/services/settings.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { fromEmail } = body;
    if (!fromEmail || typeof fromEmail !== 'string') return ApiErrors.validationError('fromEmail is required');
    if (!fromEmail.includes('@')) return ApiErrors.validationError('fromEmail must be a valid email address');

    const result = await settingsService.setTeamFromEmail(session.user.id, fromEmail);
    if (!result.success) {
      if (result.error === 'forbidden') {
        return NextResponse.json({ error: result.message, upgrade: '/settings#billing' }, { status: 403 });
      }
      if (result.error === 'not_found') return ApiErrors.notFound('Team');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Invalid');
      return ApiErrors.databaseError(result.message ?? 'Failed to save from email');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('team-email-domain/from-email', error);
    return ApiErrors.internalError('Failed to set from email');
  }
}
