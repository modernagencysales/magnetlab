// API Route: External Funnels List and Create
// GET /api/external/funnels?leadMagnetId=xxx - Get funnel for lead magnet
// POST /api/external/funnels - Create new funnel page
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { funnelPageFromRow, type FunnelPageRow } from '@/lib/types/funnel';
import { normalizeImageUrl } from '@/lib/utils/normalize-image-url';
import { ApiErrors, logApiError } from '@/lib/api/errors';

// GET - Get funnel page for a lead magnet
async function handleGet(
  request: NextRequest,
  context: ExternalAuthContext
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const leadMagnetId = searchParams.get('leadMagnetId');

    if (!leadMagnetId) {
      return ApiErrors.validationError('leadMagnetId is required');
    }

    const supabase = createSupabaseAdminClient();

    // Verify lead magnet ownership
    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .select('id')
      .eq('id', leadMagnetId)
      .eq('user_id', context.userId)
      .single();

    if (lmError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    // Get funnel page
    const { data, error } = await supabase
      .from('funnel_pages')
      .select('id, lead_magnet_id, user_id, slug, target_type, library_id, external_resource_id, optin_headline, optin_subline, optin_button_text, optin_social_proof, thankyou_headline, thankyou_subline, vsl_url, calendly_url, qualification_pass_message, qualification_fail_message, theme, primary_color, background_style, logo_url, qualification_form_id, is_published, published_at, created_at, updated_at')
      .eq('lead_magnet_id', leadMagnetId)
      .eq('user_id', context.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      logApiError('external/funnels/get', error, { userId: context.userId, leadMagnetId });
      return ApiErrors.databaseError('Failed to fetch funnel page');
    }

    if (!data) {
      return NextResponse.json({ funnel: null });
    }

    return NextResponse.json({ funnel: funnelPageFromRow(data as FunnelPageRow) });
  } catch (error) {
    logApiError('external/funnels/get', error);
    return ApiErrors.internalError('Failed to fetch funnel page');
  }
}

// POST - Create a new funnel page
async function handlePost(
  _request: NextRequest,
  context: ExternalAuthContext,
  body: unknown
): Promise<NextResponse> {
  try {
    const reqBody = body as Record<string, unknown>;
    const { leadMagnetId, slug, ...funnelData } = reqBody;

    if (!leadMagnetId || !slug) {
      return ApiErrors.validationError('leadMagnetId and slug are required');
    }

    const supabase = createSupabaseAdminClient();

    // Verify lead magnet ownership
    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .select('id, title')
      .eq('id', leadMagnetId)
      .eq('user_id', context.userId)
      .single();

    if (lmError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    // Check if funnel already exists for this lead magnet
    const { data: existing } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('lead_magnet_id', leadMagnetId)
      .single();

    if (existing) {
      return ApiErrors.conflict('Funnel page already exists for this lead magnet');
    }

    // Fetch user theme defaults
    const { data: profile } = await supabase
      .from('users')
      .select('default_theme, default_primary_color, default_background_style, default_logo_url')
      .eq('id', context.userId)
      .single();

    // Check for slug collision and auto-increment if needed
    let finalSlug = slug as string;
    let slugSuffix = 0;

    while (true) {
      const { data: slugExists } = await supabase
        .from('funnel_pages')
        .select('id')
        .eq('user_id', context.userId)
        .eq('slug', finalSlug)
        .single();

      if (!slugExists) break;

      slugSuffix++;
      finalSlug = `${slug}-${slugSuffix}`;
    }

    // Create funnel page
    const funnelInsertData = {
      lead_magnet_id: leadMagnetId,
      user_id: context.userId,
      slug: finalSlug,
      optin_headline: (funnelData.optinHeadline as string) || leadMagnet.title,
      optin_subline: (funnelData.optinSubline as string) || null,
      optin_button_text: (funnelData.optinButtonText as string) || 'Get Free Access',
      optin_social_proof: (funnelData.optinSocialProof as string) || null,
      thankyou_headline: (funnelData.thankyouHeadline as string) || 'Thanks! Check your email.',
      thankyou_subline: (funnelData.thankyouSubline as string) || null,
      vsl_url: (funnelData.vslUrl as string) || null,
      calendly_url: (funnelData.calendlyUrl as string) || null,
      qualification_pass_message: (funnelData.qualificationPassMessage as string) || 'Great! Book a call below.',
      qualification_fail_message: (funnelData.qualificationFailMessage as string) || 'Thanks for your interest!',
      theme: (funnelData.theme as string) || profile?.default_theme || 'dark',
      primary_color: (funnelData.primaryColor as string) || profile?.default_primary_color || '#8b5cf6',
      background_style: (funnelData.backgroundStyle as string) || profile?.default_background_style || 'solid',
      logo_url: normalizeImageUrl((funnelData.logoUrl as string) || profile?.default_logo_url || '') || null,
    };

    let { data, error } = await supabase
      .from('funnel_pages')
      .insert(funnelInsertData)
      .select()
      .single();

    // Retry once with random suffix on unique constraint violation
    if (error?.code === '23505') {
      finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`;
      ({ data, error } = await supabase
        .from('funnel_pages')
        .insert({ ...funnelInsertData, slug: finalSlug })
        .select()
        .single());
    }

    if (error) {
      logApiError('external/funnels/create', error, { userId: context.userId, leadMagnetId });
      return ApiErrors.databaseError('Failed to create funnel page');
    }

    return NextResponse.json(
      { funnel: funnelPageFromRow(data as FunnelPageRow) },
      { status: 201 }
    );
  } catch (error) {
    logApiError('external/funnels/create', error);
    return ApiErrors.internalError('Failed to create funnel page');
  }
}

export const GET = withExternalAuth(async (request, context) => {
  return handleGet(request, context);
});

export const POST = withExternalAuth(async (request, context, body) => {
  return handlePost(request, context, body);
});
