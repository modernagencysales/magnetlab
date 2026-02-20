// Email Marketing Disconnect API
// POST /api/integrations/email-marketing/disconnect
// Deletes integration and deactivates all funnel mappings for the provider

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isEmailMarketingProvider } from '@/lib/integrations/email-marketing';
import { deleteUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
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

    // Delete the integration credentials
    await deleteUserIntegration(session.user.id, provider);

    // Deactivate all funnel mappings for this provider
    const supabase = createSupabaseAdminClient();
    await supabase
      .from('funnel_integrations')
      .update({ is_active: false })
      .eq('user_id', session.user.id)
      .eq('provider', provider);

    return NextResponse.json({
      message: 'Disconnected successfully',
    });
  } catch (error) {
    logApiError('email-marketing/disconnect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to disconnect provider'
    );
  }
}
