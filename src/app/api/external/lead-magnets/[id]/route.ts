// API Route: External Lead Magnet Get Single
// GET /api/external/lead-magnets/[id]
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as externalService from '@/server/services/external.service';

async function handleGet(
  request: NextRequest,
  context: ExternalAuthContext
): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const idIndex = pathParts.indexOf('lead-magnets') + 1;
    const id = pathParts[idIndex];

    if (!id) {
      return ApiErrors.validationError('Lead magnet ID is required');
    }

    const result = await externalService.getLeadMagnet(context.userId, id);

    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Lead magnet');
      return ApiErrors.databaseError('Failed to get lead magnet');
    }

    return NextResponse.json(result.leadMagnet);
  } catch (error) {
    logApiError('external/lead-magnets/get', error);
    return ApiErrors.internalError('Failed to get lead magnet');
  }
}

export const GET = withExternalAuth(async (request, context) => {
  return handleGet(request, context);
});
