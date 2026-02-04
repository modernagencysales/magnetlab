// API Route: External Lead Magnets List and Create
// GET /api/external/lead-magnets - List all lead magnets for user
// POST /api/external/lead-magnets - Create new lead magnet
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

// GET - List all lead magnets for the authenticated user
async function handleGet(
  request: NextRequest,
  context: ExternalAuthContext
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('lead_magnets')
      .select('*', { count: 'exact' })
      .eq('user_id', context.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      logApiError('external/lead-magnets/list', error, { userId: context.userId });
      return ApiErrors.databaseError('Failed to fetch lead magnets');
    }

    return NextResponse.json({
      leadMagnets: data,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    logApiError('external/lead-magnets/list', error);
    return ApiErrors.internalError('Failed to fetch lead magnets');
  }
}

// POST - Create a new lead magnet
async function handlePost(
  _request: NextRequest,
  context: ExternalAuthContext,
  body: unknown
): Promise<NextResponse> {
  try {
    const reqBody = body as Record<string, unknown>;
    const supabase = createSupabaseAdminClient();

    // Check usage limits
    try {
      const { data: canCreate, error: rpcError } = await supabase.rpc('check_usage_limit', {
        p_user_id: context.userId,
        p_limit_type: 'lead_magnets',
      });

      if (rpcError) {
        logApiError('external/lead-magnets/usage-check', rpcError, { userId: context.userId });
      } else if (canCreate === false) {
        return ApiErrors.usageLimitExceeded('Monthly lead magnet limit reached. Upgrade your plan for more.');
      }
    } catch (err) {
      logApiError('external/lead-magnets/usage-check', err, { userId: context.userId, note: 'RPC unavailable' });
    }

    // Create the lead magnet
    const { data, error } = await supabase
      .from('lead_magnets')
      .insert({
        user_id: context.userId,
        title: reqBody.title as string,
        archetype: reqBody.archetype as string,
        concept: reqBody.concept,
        extracted_content: reqBody.extractedContent,
        linkedin_post: reqBody.linkedinPost,
        post_variations: reqBody.postVariations,
        dm_template: reqBody.dmTemplate,
        cta_word: reqBody.ctaWord,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      logApiError('external/lead-magnets/create', error, { userId: context.userId });
      return ApiErrors.databaseError('Failed to create lead magnet');
    }

    // Increment usage (gracefully handle if RPC doesn't exist)
    try {
      const { error: incrementError } = await supabase.rpc('increment_usage', {
        p_user_id: context.userId,
        p_limit_type: 'lead_magnets',
      });
      if (incrementError) {
        logApiError('external/lead-magnets/usage-increment', incrementError, { userId: context.userId });
      }
    } catch (err) {
      logApiError('external/lead-magnets/usage-increment', err, { userId: context.userId, note: 'RPC unavailable' });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    logApiError('external/lead-magnets/create', error);
    return ApiErrors.internalError('Failed to create lead magnet');
  }
}

export const GET = withExternalAuth(async (request, context) => {
  return handleGet(request, context);
});

export const POST = withExternalAuth(async (request, context, body) => {
  return handlePost(request, context, body);
});
