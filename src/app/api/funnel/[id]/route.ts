// API Route: Funnel Page CRUD
// GET, PUT, DELETE /api/funnel/[id]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { funnelPageFromRow, type FunnelPageRow } from '@/lib/types/funnel';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { validateBody, updateFunnelSchema } from '@/lib/validations/api';
import { getDataScope, applyScope } from '@/lib/utils/team-context';

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

    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    const { data, error } = await applyScope(
      supabase
        .from('funnel_pages')
        .select('id, lead_magnet_id, user_id, slug, target_type, library_id, external_resource_id, optin_headline, optin_subline, optin_button_text, optin_social_proof, thankyou_headline, thankyou_subline, vsl_url, calendly_url, qualification_pass_message, qualification_fail_message, theme, primary_color, background_style, logo_url, qualification_form_id, is_published, published_at, created_at, updated_at')
        .eq('id', id),
      scope
    ).single();

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
    const validation = validateBody(body, updateFunnelSchema);
    if (!validation.success) {
      return ApiErrors.validationError(validation.error, validation.details);
    }

    const validated = validation.data;
    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Build update object with snake_case keys
    const updateData: Record<string, unknown> = {};

    if (validated.slug !== undefined) updateData.slug = validated.slug;
    if (validated.optinHeadline !== undefined) updateData.optin_headline = validated.optinHeadline;
    if (validated.optinSubline !== undefined) updateData.optin_subline = validated.optinSubline;
    if (validated.optinButtonText !== undefined) updateData.optin_button_text = validated.optinButtonText;
    if (validated.optinSocialProof !== undefined) updateData.optin_social_proof = validated.optinSocialProof;
    if (validated.thankyouHeadline !== undefined) updateData.thankyou_headline = validated.thankyouHeadline;
    if (validated.thankyouSubline !== undefined) updateData.thankyou_subline = validated.thankyouSubline;
    if (validated.vslUrl !== undefined) updateData.vsl_url = validated.vslUrl;
    if (validated.calendlyUrl !== undefined) updateData.calendly_url = validated.calendlyUrl;
    if (validated.qualificationPassMessage !== undefined) updateData.qualification_pass_message = validated.qualificationPassMessage;
    if (validated.qualificationFailMessage !== undefined) updateData.qualification_fail_message = validated.qualificationFailMessage;
    if (validated.theme !== undefined) updateData.theme = validated.theme;
    if (validated.primaryColor !== undefined) updateData.primary_color = validated.primaryColor;
    if (validated.backgroundStyle !== undefined) updateData.background_style = validated.backgroundStyle;
    if (validated.logoUrl !== undefined) updateData.logo_url = validated.logoUrl;
    if (validated.qualificationFormId !== undefined) updateData.qualification_form_id = validated.qualificationFormId;

    // Verify ownership of qualificationFormId if provided
    if (validated.qualificationFormId) {
      const { data: qf } = await applyScope(
        supabase
          .from('qualification_forms')
          .select('id')
          .eq('id', validated.qualificationFormId),
        scope
      ).single();

      if (!qf) {
        return ApiErrors.notFound('Qualification form');
      }
    }

    // Check for slug collision if updating slug
    if (validated.slug) {
      const { data: existing } = await applyScope(
        supabase
          .from('funnel_pages')
          .select('id')
          .eq('slug', validated.slug)
          .neq('id', id),
        scope
      ).single();

      if (existing) {
        return ApiErrors.conflict('A funnel with this slug already exists');
      }
    }

    const { data, error } = await applyScope(
      supabase
        .from('funnel_pages')
        .update(updateData)
        .eq('id', id),
      scope
    ).select().single();

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

    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    // First verify ownership
    const { data: funnel, error: findError } = await applyScope(
      supabase
        .from('funnel_pages')
        .select('id')
        .eq('id', id),
      scope
    ).single();

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
    const { error } = await applyScope(
      supabase
        .from('funnel_pages')
        .delete()
        .eq('id', id),
      scope
    );

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
