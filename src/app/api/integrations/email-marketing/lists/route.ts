// Email Marketing Lists API
// GET /api/integrations/email-marketing/lists?provider=kit
// Returns available lists/audiences for the connected provider

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isEmailMarketingProvider, getEmailMarketingProvider } from '@/lib/integrations/email-marketing';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const provider = request.nextUrl.searchParams.get('provider');

    if (!provider) {
      return ApiErrors.validationError('Provider query parameter is required');
    }

    if (!isEmailMarketingProvider(provider)) {
      return ApiErrors.validationError(`Invalid provider: ${provider}`);
    }

    // Get stored credentials
    const integration = await getUserIntegration(session.user.id, provider);
    if (!integration?.api_key) {
      return ApiErrors.notFound('Integration');
    }

    // Create provider instance and fetch lists
    const providerInstance = getEmailMarketingProvider(provider, {
      apiKey: integration.api_key,
      metadata: (integration.metadata ?? {}) as Record<string, string>,
    });

    const lists = await providerInstance.getLists();

    return NextResponse.json({ lists });
  } catch (error) {
    logApiError('email-marketing/lists', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to fetch lists'
    );
  }
}
