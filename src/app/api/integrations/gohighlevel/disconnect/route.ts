// GoHighLevel Disconnect API
// POST /api/integrations/gohighlevel/disconnect

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as integrationsService from '@/server/services/integrations.service';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const result = await integrationsService.disconnectGohighlevel(session.user.id);
    if (!result.success) {
      return ApiErrors.databaseError('Failed to deactivate funnel mappings');
    }

    return NextResponse.json({
      message: 'Disconnected successfully',
    });
  } catch (error) {
    logApiError('gohighlevel/disconnect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to disconnect GoHighLevel'
    );
  }
}
