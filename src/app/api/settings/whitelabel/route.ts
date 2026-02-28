// API Route: White-Label Settings
// GET, PATCH /api/settings/whitelabel

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as settingsService from '@/server/services/settings.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await settingsService.getWhitelabel(session.user.id);
    if (!result.success) return ApiErrors.databaseError('Failed to fetch white-label settings');
    return NextResponse.json({ whitelabel: result.whitelabel });
  } catch (error) {
    logApiError('whitelabel/get', error);
    return ApiErrors.internalError('Failed to fetch white-label settings');
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { hideBranding, customFaviconUrl, customSiteName, customEmailSenderName } = body;

    const result = await settingsService.updateWhitelabel(session.user.id, {
      hideBranding,
      customFaviconUrl,
      customSiteName,
      customEmailSenderName,
    });
    if (!result.success) {
      if (result.error === 'forbidden') {
        return NextResponse.json({ error: result.message, upgrade: '/settings#billing' }, { status: 403 });
      }
      if (result.error === 'not_found') return ApiErrors.notFound('Team');
      return ApiErrors.databaseError('Failed to update white-label settings');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('whitelabel/patch', error);
    return ApiErrors.internalError('Failed to update white-label settings');
  }
}
