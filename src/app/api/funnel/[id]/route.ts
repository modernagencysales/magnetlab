// API Route: Funnel Page CRUD
// GET, PUT, DELETE /api/funnel/[id]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { funnelPageFromRow, type FunnelPageRow } from '@/lib/types/funnel';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a single funnel page
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid funnel page ID');
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('funnel_pages')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !data) {
      return ApiErrors.notFound('Funnel page');
    }

    return NextResponse.json({ funnel: funnelPageFromRow(data as FunnelPageRow) });
  } catch (error) {
    logApiError('funnel/get', error);
    return ApiErrors.internalError('Failed to get funnel page');
  }
}

// PUT - Update a funnel page
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid funnel page ID');
    }

    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    // Build update object with snake_case keys
    const updateData: Record<string, unknown> = {};

    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.optinHeadline !== undefined) updateData.optin_headline = body.optinHeadline;
    if (body.optinSubline !== undefined) updateData.optin_subline = body.optinSubline;
    if (body.optinButtonText !== undefined) updateData.optin_button_text = body.optinButtonText;
    if (body.optinSocialProof !== undefined) updateData.optin_social_proof = body.optinSocialProof;
    if (body.thankyouHeadline !== undefined) updateData.thankyou_headline = body.thankyouHeadline;
    if (body.thankyouSubline !== undefined) updateData.thankyou_subline = body.thankyouSubline;
    if (body.vslUrl !== undefined) updateData.vsl_url = body.vslUrl;
    if (body.calendlyUrl !== undefined) updateData.calendly_url = body.calendlyUrl;
    if (body.qualificationPassMessage !== undefined) updateData.qualification_pass_message = body.qualificationPassMessage;
    if (body.qualificationFailMessage !== undefined) updateData.qualification_fail_message = body.qualificationFailMessage;
    if (body.theme !== undefined) updateData.theme = body.theme;
    if (body.primaryColor !== undefined) updateData.primary_color = body.primaryColor;
    if (body.backgroundStyle !== undefined) updateData.background_style = body.backgroundStyle;
    if (body.logoUrl !== undefined) updateData.logo_url = body.logoUrl;
    if (body.qualificationFormId !== undefined) updateData.qualification_form_id = body.qualificationFormId;

    // Verify ownership of qualificationFormId if provided
    if (body.qualificationFormId) {
      const { data: qf } = await supabase
        .from('qualification_forms')
        .select('id')
        .eq('id', body.qualificationFormId)
        .eq('user_id', session.user.id)
        .single();

      if (!qf) {
        return ApiErrors.notFound('Qualification form');
      }
    }

    // Check for slug collision if updating slug
    if (body.slug) {
      const { data: existing } = await supabase
        .from('funnel_pages')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('slug', body.slug)
        .neq('id', id)
        .single();

      if (existing) {
        return ApiErrors.conflict('A funnel with this slug already exists');
      }
    }

    const { data, error } = await supabase
      .from('funnel_pages')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      logApiError('funnel/update', error, { userId: session.user.id, funnelId: id });
      return ApiErrors.databaseError('Failed to update funnel page');
    }

    if (!data) {
      return ApiErrors.notFound('Funnel page');
    }

    return NextResponse.json({ funnel: funnelPageFromRow(data as FunnelPageRow) });
  } catch (error) {
    logApiError('funnel/update', error);
    return ApiErrors.internalError('Failed to update funnel page');
  }
}

// DELETE - Delete a funnel page with cascade
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid funnel page ID');
    }

    const supabase = createSupabaseAdminClient();

    // First verify ownership
    const { data: funnel, error: findError } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (findError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    // Cascade delete related records in parallel (no FK dependencies between them)
    await Promise.all([
      supabase.from('qualification_questions').delete().eq('funnel_page_id', id),
      supabase.from('funnel_leads').delete().eq('funnel_page_id', id),
      supabase.from('page_views').delete().eq('funnel_page_id', id),
    ]);

    // Delete the funnel page (after child records are cleared)
    const { error } = await supabase
      .from('funnel_pages')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      logApiError('funnel/delete', error, { userId: session.user.id, funnelId: id });
      return ApiErrors.databaseError('Failed to delete funnel page');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('funnel/delete', error);
    return ApiErrors.internalError('Failed to delete funnel page');
  }
}
