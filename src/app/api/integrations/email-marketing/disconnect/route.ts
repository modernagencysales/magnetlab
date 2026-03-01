// Email Marketing Disconnect API
// POST /api/integrations/email-marketing/disconnect

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isEmailMarketingProvider } from '@/lib/integrations/email-marketing';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as integrationsService from '@/server/services/integrations.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { provider } = body;

    if (!provider || typeof provider !== 'string') {
      return ApiErrors.validationError('Provider is required');
    }

    if (!isEmailMarketingProvider(provider)) {
      return ApiErrors.validationError(`Invalid provider: ${provider}`);
    }

    const result = await integrationsService.disconnectEmailMarketing(session.user.id, provider);
    if (!result.success) {
      return ApiErrors.databaseError('Failed to deactivate funnel mappings');
    }

    return NextResponse.json({
      message: 'Disconnected successfully',
    });
  } catch (error) {
    logApiError('email-marketing/disconnect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to disconnect provider'
    );
  }
}
