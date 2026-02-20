// Per-Funnel Integrations API
// GET /api/funnels/[id]/integrations - List integrations for a funnel page
// POST /api/funnels/[id]/integrations - Add/update a funnel integration mapping

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isEmailMarketingProvider } from '@/lib/integrations/email-marketing';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - List all integrations for this funnel page
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: funnelPageId } = await params;
    if (!isValidUUID(funnelPageId)) {
      return ApiErrors.validationError('Invalid funnel page ID');
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('funnel_integrations')
      .select('id, provider, list_id, list_name, tag_id, tag_name, is_active, created_at, updated_at')
      .eq('funnel_page_id', funnelPageId)
      .eq('user_id', session.user.id);

    if (error) {
      logApiError('funnels/integrations/list', error);
      return ApiErrors.databaseError('Failed to list funnel integrations');
    }

    return NextResponse.json({ integrations: data ?? [] });
  } catch (error) {
    logApiError('funnels/integrations/list', error);
    return ApiErrors.internalError('Failed to list funnel integrations');
  }
}

// POST - Add or update a funnel integration mapping
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: funnelPageId } = await params;
    if (!isValidUUID(funnelPageId)) {
      return ApiErrors.validationError('Invalid funnel page ID');
    }

    const body = await request.json();
    const { provider, list_id, list_name, tag_id, tag_name, is_active } = body;

    if (!provider || typeof provider !== 'string') {
      return ApiErrors.validationError('Provider is required');
    }

    if (!isEmailMarketingProvider(provider)) {
      return ApiErrors.validationError(`Invalid provider: ${provider}`);
    }

    if (!list_id || typeof list_id !== 'string') {
      return ApiErrors.validationError('List ID is required');
    }

    const supabase = createSupabaseAdminClient();

    // Verify user owns this funnel page
    const { data: funnelPage, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('id', funnelPageId)
      .eq('user_id', session.user.id)
      .single();

    if (funnelError || !funnelPage) {
      return ApiErrors.notFound('Funnel page');
    }

    // Upsert the mapping (unique on funnel_page_id + provider)
    const { data, error } = await supabase
      .from('funnel_integrations')
      .upsert(
        {
          funnel_page_id: funnelPageId,
          user_id: session.user.id,
          provider,
          list_id,
          list_name: list_name ?? null,
          tag_id: tag_id ?? null,
          tag_name: tag_name ?? null,
          is_active: is_active ?? true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'funnel_page_id,provider' }
      )
      .select('id, provider, list_id, list_name, tag_id, tag_name, is_active, created_at, updated_at')
      .single();

    if (error) {
      logApiError('funnels/integrations/upsert', error);
      return ApiErrors.databaseError('Failed to save funnel integration');
    }

    return NextResponse.json({ integration: data });
  } catch (error) {
    logApiError('funnels/integrations/upsert', error);
    return ApiErrors.internalError('Failed to save funnel integration');
  }
}
