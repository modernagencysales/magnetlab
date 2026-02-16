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
        interactive_config: validated.interactiveConfig,
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

    try { getPostHogServerClient()?.capture({ distinctId: session.user.id, event: 'lead_magnet_created', properties: { lead_magnet_id: data.id, title: validated.title, archetype: validated.archetype } }); } catch {}

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    logApiError('lead-magnet/create', error);
    return ApiErrors.internalError('Failed to create lead magnet');
  }
}
