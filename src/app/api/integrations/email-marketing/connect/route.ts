// Email Marketing Connect API
// POST /api/integrations/email-marketing/connect
// Validates credentials against provider, then saves integration

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isEmailMarketingProvider, getEmailMarketingProvider } from '@/lib/integrations/email-marketing';
import { upsertUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { provider, api_key, metadata } = body;

    if (!provider || typeof provider !== 'string') {
      return ApiErrors.validationError('Provider is required');
    }

    if (!isEmailMarketingProvider(provider)) {
      return ApiErrors.validationError(`Invalid provider: ${provider}`);
    }

    if (!api_key || typeof api_key !== 'string') {
      return ApiErrors.validationError('API key is required');
    }

    // Validate ActiveCampaign base_url before instantiating provider
    if (provider === 'activecampaign') {
      const baseUrl = metadata?.base_url;
      if (!baseUrl || !/^https:\/\/[\w-]+\.api-us1\.com\/?$/i.test(baseUrl)) {
        return NextResponse.json(
          { error: 'Invalid API URL. Expected format: https://<account>.api-us1.com' },
          { status: 400 }
        );
      }
    }

    // Validate credentials against the provider before saving
    const providerInstance = getEmailMarketingProvider(provider, {
      apiKey: api_key,
      metadata: metadata ?? {},
    });

    const valid = await providerInstance.validateCredentials();
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid credentials', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    // Credentials are valid — save the integration
    const integration = await upsertUserIntegration({
      userId: session.user.id,
      service: provider,
      apiKey: api_key,
      isActive: true,
      metadata: metadata ?? {},
    });

    return NextResponse.json({
      integration,
      message: 'Connected successfully',
    });
  } catch (error) {
    logApiError('email-marketing/connect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to connect provider'
    );
  }
}
