// API Route: External Funnel Publish/Unpublish
// POST /api/external/funnels/[id]/publish - Toggle publish status
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { publishFunnel } from '@/server/services/external.service';

async function handlePost(
  request: NextRequest,
  context: ExternalAuthContext,
  body: unknown
): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const idIndex = pathParts.indexOf('funnels') + 1;
    const id = pathParts[idIndex];
    if (!id) return ApiErrors.validationError('Funnel ID is required');

    const { publish } = body as { publish?: boolean };
    if (typeof publish !== 'boolean') return ApiErrors.validationError('publish must be a boolean');

    const result = await publishFunnel(id, context.userId, publish);
    if (!result.success) {
      if (result.error === 'funnel_not_found') return ApiErrors.notFound('Funnel page');
      if (result.error === 'username_required') return ApiErrors.validationError('You must set a username before publishing. Go to Settings to set your username.');
      if (result.error === 'optin_headline_required') return ApiErrors.validationError('Opt-in headline is required before publishing');
      return ApiErrors.databaseError('Failed to update publish status');
    }
    return NextResponse.json({ funnel: result.funnel, publicUrl: result.publicUrl });
  } catch (error) {
    logApiError('external/funnels/publish', error);
    return ApiErrors.internalError('Failed to update publish status');
  }
}

export const POST = withExternalAuth(async (request, context, body) => handlePost(request, context, body));
