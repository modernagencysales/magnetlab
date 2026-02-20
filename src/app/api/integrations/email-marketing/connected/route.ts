// Email Marketing Connected Providers API
// GET /api/integrations/email-marketing/connected
// Returns list of connected (active) email marketing provider service names

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { EMAIL_MARKETING_PROVIDERS } from '@/lib/integrations/email-marketing';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('user_integrations')
      .select('service')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .in('service', [...EMAIL_MARKETING_PROVIDERS]);

    if (error) {
      logApiError('email-marketing/connected', error);
      return ApiErrors.databaseError('Failed to fetch connected providers');
    }

    const providers = (data || []).map((r) => r.service);

    return NextResponse.json({ providers });
  } catch (error) {
    logApiError('email-marketing/connected', error);
    return ApiErrors.internalError('Failed to fetch connected providers');
  }
}
