// GoHighLevel Connect API
// POST /api/integrations/gohighlevel/connect
// Validates API key against GHL, then saves integration

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { GoHighLevelClient } from '@/lib/integrations/gohighlevel/client';
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

    // Validate the API key against GoHighLevel
    const client = new GoHighLevelClient(api_key);
    const valid = await client.testConnection();

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your GoHighLevel Location API key and try again.', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    // Credentials are valid — save the integration
    const integration = await upsertUserIntegration({
      userId: session.user.id,
      service: 'gohighlevel',
      apiKey: api_key,
      isActive: true,
    });

    return NextResponse.json({
      integration,
      message: 'Connected successfully',
    });
  } catch (error) {
    logApiError('gohighlevel/connect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to connect GoHighLevel'
    );
  }
}
