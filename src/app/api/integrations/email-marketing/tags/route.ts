// Email Marketing Tags API
// GET /api/integrations/email-marketing/tags?provider=kit&listId=abc
// Returns available tags for the connected provider (optionally scoped to a list)

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
    const listId = request.nextUrl.searchParams.get('listId') ?? undefined;

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

    // Create provider instance and fetch tags
    const providerInstance = getEmailMarketingProvider(provider, {
      apiKey: integration.api_key,
      metadata: (integration.metadata ?? {}) as Record<string, string>,
    });

    const tags = await providerInstance.getTags(listId);

    return NextResponse.json({ tags });
  } catch (error) {
    logApiError('email-marketing/tags', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to fetch tags'
    );
  }
}
