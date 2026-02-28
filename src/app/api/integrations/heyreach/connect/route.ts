// HeyReach Connect API
// POST /api/integrations/heyreach/connect
// Validates API key against HeyReach, then saves integration

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { HeyReachClient } from '@/lib/integrations/heyreach/client';
import { upsertUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { api_key } = body;

    if (!api_key || typeof api_key !== 'string') {
      return ApiErrors.validationError('API key is required');
    }

    // Validate the API key against HeyReach
    const client = new HeyReachClient(api_key);
    const valid = await client.testConnection();

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your HeyReach API key and try again.', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    // Credentials are valid -- save the integration
    const integration = await upsertUserIntegration({
      userId: session.user.id,
      service: 'heyreach',
      apiKey: api_key,
      isActive: true,
    });

    return NextResponse.json({
      integration,
      message: 'Connected successfully',
    });
  } catch (error) {
    logApiError('heyreach/connect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to connect HeyReach'
    );
  }
}
