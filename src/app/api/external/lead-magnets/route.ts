// API Route: External Lead Magnets List and Create
// GET /api/external/lead-magnets - List all lead magnets for user
// POST /api/external/lead-magnets - Create new lead magnet
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as externalService from '@/server/services/external.service';

async function handleGet(request: NextRequest, context: ExternalAuthContext): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await externalService.listLeadMagnets(context.userId, {
      status: status || undefined,
      limit,
      offset,
    });

    if (!result.success) {
      if (result.error === 'database') return ApiErrors.databaseError('Failed to fetch lead magnets');
      return ApiErrors.databaseError('Failed to fetch lead magnets');
    }

    return NextResponse.json({
      leadMagnets: result.leadMagnets,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (error) {
    logApiError('external/lead-magnets/list', error);
    return ApiErrors.internalError('Failed to fetch lead magnets');
  }
}

async function handlePost(
  _request: NextRequest,
  context: ExternalAuthContext,
  body: unknown
): Promise<NextResponse> {
  try {
    const reqBody = body as Record<string, unknown>;
    const result = await externalService.createLeadMagnetExternal(context.userId, reqBody);

    if (!result.success) {
      if (result.error === 'usage_limit') {
        return ApiErrors.usageLimitExceeded(
          'Monthly lead magnet limit reached. Upgrade your plan for more.'
        );
      }
      return ApiErrors.databaseError('Failed to create lead magnet');
    }

    return NextResponse.json(result.leadMagnet, { status: 201 });
  } catch (error) {
    logApiError('external/lead-magnets/create', error);
    return ApiErrors.internalError('Failed to create lead magnet');
  }
}

export const GET = withExternalAuth(async (request, context) => {
  return handleGet(request, context);
});

export const POST = withExternalAuth(async (request, context, body) => {
  return handlePost(request, context, body);
});
