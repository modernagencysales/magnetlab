// API Route: Lead Magnets List and Create
// GET /api/lead-magnet - List all
// POST /api/lead-magnet - Create new

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { validateBody, createLeadMagnetSchema } from '@/lib/validations/api';
import { getPostHogServerClient } from '@/lib/posthog';
import { checkResourceLimit } from '@/lib/auth/plan-limits';

// GET - List all lead magnets for current user
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('lead_magnets')
      .select('*', { count: 'exact' })
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      logApiError('lead-magnet/list', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch lead magnets');
    }

    return NextResponse.json({
      leadMagnets: data,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    logApiError('lead-magnet/list', error);
    return ApiErrors.internalError('Failed to fetch lead magnets');
  }
}

// POST - Create a new lead magnet
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Check plan-based resource limit
    const limitCheck = await checkResourceLimit(session.user.id, 'lead_magnets');
    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: 'Plan limit reached',
        current: limitCheck.current,
        limit: limitCheck.limit,
        upgrade: '/settings#billing',
      }, { status: 403 });
    }

    const body = await request.json();
    const validation = validateBody(body, createLeadMagnetSchema);
    if (!validation.success) {
      return ApiErrors.validationError(validation.error, validation.details);
    }

    const supabase = createSupabaseAdminClient();

    // Check usage limits (legacy RPC-based check)
    try {
      const { data: canCreate, error: rpcError } = await supabase.rpc('check_usage_limit', {
        p_user_id: session.user.id,
        p_limit_type: 'lead_magnets',
      });

      if (rpcError) {
        logApiError('lead-magnet/usage-check', rpcError, { userId: session.user.id });
      } else if (canCreate === false) {
        return ApiErrors.usageLimitExceeded('Monthly lead magnet limit reached. Upgrade your plan for more.');
      }
    } catch (err) {
      logApiError('lead-magnet/usage-check', err, { userId: session.user.id, note: 'RPC unavailable' });
    }

    // Create the lead magnet
    const validated = validation.data;
    const { data, error } = await supabase
      .from('lead_magnets')
      .insert({
        user_id: session.user.id,
        title: validated.title,
        archetype: validated.archetype,
        concept: validated.concept,
        extracted_content: validated.extractedContent,
        linkedin_post: validated.linkedinPost,
        post_variations: validated.postVariations,
        dm_template: validated.dmTemplate,
        cta_word: validated.ctaWord,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      logApiError('lead-magnet/create', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to create lead magnet');
    }

    // Increment usage (gracefully handle if RPC doesn't exist)
    try {
      const { error: incrementError } = await supabase.rpc('increment_usage', {
        p_user_id: session.user.id,
        p_limit_type: 'lead_magnets',
      });
      if (incrementError) {
        logApiError('lead-magnet/usage-increment', incrementError, { userId: session.user.id });
      }
    } catch (err) {
      logApiError('lead-magnet/usage-increment', err, { userId: session.user.id, note: 'RPC unavailable' });
    }

    try { getPostHogServerClient()?.capture({ distinctId: session.user.id, event: 'lead_magnet_created', properties: { lead_magnet_id: data.id, title: validated.title, archetype: validated.archetype } }); } catch {}

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    logApiError('lead-magnet/create', error);
    return ApiErrors.internalError('Failed to create lead magnet');
  }
}
