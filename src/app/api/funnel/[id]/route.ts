// API Route: Funnel Page CRUD
// GET, PUT, DELETE /api/funnel/[id]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { funnelPageFromRow, type FunnelPageRow } from '@/lib/types/funnel';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { validateBody, updateFunnelSchema } from '@/lib/validations/api';
import { checkTeamRole } from '@/lib/auth/rbac';
import { normalizeImageUrl } from '@/lib/utils/normalize-image-url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Verify the current user can access a funnel page.
 * Checks ownership directly, or team membership via the linked lead magnet.
 */
async function verifyFunnelAccess(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  funnelUserId: string,
  leadMagnetId: string | null,
  currentUserId: string,
): Promise<boolean> {
  if (funnelUserId === currentUserId) return true;
  if (!leadMagnetId) return false;

  const { data: lm } = await supabase
    .from('lead_magnets')
    .select('user_id, team_id')
    .eq('id', leadMagnetId)
    .single();

  if (!lm) return false;
  if (lm.user_id === currentUserId) return true;
  if (lm.team_id) {
    const role = await checkTeamRole(currentUserId, lm.team_id);
    if (role) return true;
  }
  return false;
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
      .select('id, lead_magnet_id, user_id, slug, target_type, library_id, external_resource_id, optin_headline, optin_subline, optin_button_text, optin_social_proof, thankyou_headline, thankyou_subline, vsl_url, calendly_url, qualification_pass_message, qualification_fail_message, theme, primary_color, background_style, logo_url, qualification_form_id, is_published, published_at, created_at, updated_at, redirect_trigger, redirect_url, redirect_fail_url, homepage_url, homepage_label, send_resource_email, thankyou_layout')
      .eq('id', id)
      .single();

    if (error || !data) {
      return ApiErrors.notFound('Funnel page');
    }

    const hasAccess = await verifyFunnelAccess(supabase, data.user_id, data.lead_magnet_id, session.user.id);
    if (!hasAccess) {
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
    const supabase = createSupabaseAdminClient();

    // Verify access: fetch funnel by ID, then check ownership/team membership
    const { data: existingFunnel } = await supabase
      .from('funnel_pages')
      .select('id, user_id, lead_magnet_id')
      .eq('id', id)
      .single();

    if (!existingFunnel) {
      return ApiErrors.notFound('Funnel page');
    }

    const hasAccess = await verifyFunnelAccess(supabase, existingFunnel.user_id, existingFunnel.lead_magnet_id, session.user.id);
    if (!hasAccess) {
      return ApiErrors.notFound('Funnel page');
    }

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
    if (validated.logoUrl !== undefined) updateData.logo_url = validated.logoUrl ? normalizeImageUrl(validated.logoUrl) : validated.logoUrl;
    if (validated.qualificationFormId !== undefined) updateData.qualification_form_id = validated.qualificationFormId;
    if (validated.redirectTrigger !== undefined) updateData.redirect_trigger = validated.redirectTrigger;
    if (validated.redirectUrl !== undefined) updateData.redirect_url = validated.redirectUrl;
    if (validated.redirectFailUrl !== undefined) updateData.redirect_fail_url = validated.redirectFailUrl;
    if (validated.homepageUrl !== undefined) updateData.homepage_url = validated.homepageUrl;
    if (validated.homepageLabel !== undefined) updateData.homepage_label = validated.homepageLabel;
    if (validated.sendResourceEmail !== undefined) updateData.send_resource_email = validated.sendResourceEmail;
    if (validated.thankyouLayout !== undefined) updateData.thankyou_layout = validated.thankyouLayout;

    // Verify ownership of qualificationFormId if provided
    if (validated.qualificationFormId) {
      const { data: qf } = await supabase
        .from('qualification_forms')
        .select('id')
        .eq('id', validated.qualificationFormId)
        .single();

      if (!qf) {
        return ApiErrors.notFound('Qualification form');
      }
    }

    // Check for slug collision if updating slug
    if (validated.slug) {
      const { data: existing } = await supabase
        .from('funnel_pages')
        .select('id')
        .eq('slug', validated.slug)
        .eq('user_id', existingFunnel.user_id)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return ApiErrors.conflict('A funnel with this slug already exists');
      }
    }

    const { data, error } = await supabase
      .from('funnel_pages')
      .update(updateData)
      .eq('id', id)
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

    // Verify access: fetch funnel by ID, then check ownership/team membership
    const { data: funnel, error: findError } = await supabase
      .from('funnel_pages')
      .select('id, user_id, lead_magnet_id')
      .eq('id', id)
      .single();

    if (findError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    const hasAccess = await verifyFunnelAccess(supabase, funnel.user_id, funnel.lead_magnet_id, session.user.id);
    if (!hasAccess) {
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
      .eq('id', id);

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
