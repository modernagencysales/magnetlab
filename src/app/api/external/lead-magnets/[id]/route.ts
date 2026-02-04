// API Route: External Lead Magnet Get Single
// GET /api/external/lead-magnets/[id] - Get a single lead magnet
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

async function handleGet(
  request: NextRequest,
  context: ExternalAuthContext
): Promise<NextResponse> {
  try {
    // Extract ID from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const idIndex = pathParts.indexOf('lead-magnets') + 1;
    const id = pathParts[idIndex];

    if (!id) {
      return ApiErrors.validationError('Lead magnet ID is required');
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('lead_magnets')
      .select('*')
      .eq('id', id)
      .eq('user_id', context.userId)
      .single();

    if (error || !data) {
      return ApiErrors.notFound('Lead magnet');
    }

    return NextResponse.json(data);
  } catch (error) {
    logApiError('external/lead-magnets/get', error);
    return ApiErrors.internalError('Failed to get lead magnet');
  }
}

export const GET = withExternalAuth(async (request, context) => {
  return handleGet(request, context);
});
