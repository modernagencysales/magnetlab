import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KajabiClient } from '@/lib/integrations/kajabi/client';
import { upsertUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { api_key, site_id } = body;

    if (!api_key || typeof api_key !== 'string') {
      return ApiErrors.validationError('API key is required');
    }

    if (!site_id || typeof site_id !== 'string') {
      return ApiErrors.validationError('Site ID is required');
    }

    const client = new KajabiClient(api_key, site_id);
    const valid = await client.testConnection();

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid credentials. Please check your Kajabi API key and Site ID.', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    const integration = await upsertUserIntegration({
      userId: session.user.id,
      service: 'kajabi',
      apiKey: api_key,
      isActive: true,
      metadata: { site_id },
    });

    return NextResponse.json({
      integration,
      message: 'Connected successfully',
    });
  } catch (error) {
    logApiError('kajabi/connect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to connect Kajabi'
    );
  }
}
