// Email Marketing Connected Providers API
// GET /api/integrations/email-marketing/connected

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as integrationsService from '@/server/services/integrations.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const result = await integrationsService.getConnectedEmailMarketingProviders(session.user.id);
    if (!result.success) {
      return ApiErrors.databaseError('Failed to fetch connected providers');
    }

    return NextResponse.json({ providers: result.providers });
  } catch (error) {
    logApiError('email-marketing/connected', error);
    return ApiErrors.internalError('Failed to fetch connected providers');
  }
}
