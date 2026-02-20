// Per-Funnel Integration Delete API
// DELETE /api/funnels/[id]/integrations/[provider]
// Removes a specific provider mapping from a funnel page

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isEmailMarketingProvider } from '@/lib/integrations/email-marketing';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ id: string; provider: string }>;
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: funnelPageId, provider } = await params;

    if (!isValidUUID(funnelPageId)) {
      return ApiErrors.validationError('Invalid funnel page ID');
    }

    if (!isEmailMarketingProvider(provider)) {
      return ApiErrors.validationError(`Invalid provider: ${provider}`);
    }

    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('funnel_integrations')
      .delete()
      .eq('funnel_page_id', funnelPageId)
      .eq('user_id', session.user.id)
      .eq('provider', provider);

    if (error) {
      logApiError('funnels/integrations/delete', error);
      return ApiErrors.databaseError('Failed to delete funnel integration');
    }

    return NextResponse.json({ message: 'Integration removed' });
  } catch (error) {
    logApiError('funnels/integrations/delete', error);
    return ApiErrors.internalError('Failed to delete funnel integration');
  }
}
