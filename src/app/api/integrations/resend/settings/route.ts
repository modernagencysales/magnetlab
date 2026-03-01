// Resend Settings API
// PUT /api/integrations/resend/settings - Update Resend sender settings

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as integrationsService from '@/server/services/integrations.service';

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { fromEmail, fromName } = body;

    const result = await integrationsService.updateResendSettings(session.user.id, {
      fromEmail: fromEmail ?? null,
      fromName: fromName ?? null,
    });

    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Resend integration');
      return ApiErrors.databaseError('Failed to update settings');
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    logApiError('integrations/resend/settings', error);
    return ApiErrors.internalError('Failed to update settings');
  }
}
