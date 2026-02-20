// Email Marketing Verify API
// POST /api/integrations/email-marketing/verify
// Re-validates stored credentials for a provider

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isEmailMarketingProvider, getEmailMarketingProvider } from '@/lib/integrations/email-marketing';
import { getUserIntegration, updateIntegrationVerified } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

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

    // Get stored credentials
    const integration = await getUserIntegration(session.user.id, provider);
    if (!integration?.api_key) {
      return ApiErrors.notFound('Integration');
    }

    // Validate credentials against the provider
    const providerInstance = getEmailMarketingProvider(provider, {
      apiKey: integration.api_key,
      metadata: (integration.metadata ?? {}) as Record<string, string>,
    });

    const verified = await providerInstance.validateCredentials();

    // Update verification timestamp on success
    if (verified) {
      await updateIntegrationVerified(session.user.id, provider);
    }

    return NextResponse.json({ verified });
  } catch (error) {
    logApiError('email-marketing/verify', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to verify credentials'
    );
  }
}
