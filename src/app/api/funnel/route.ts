import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, isValidUUID } from '@/lib/api/errors';
import * as funnelsService from '@/server/services/funnels.service';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { searchParams } = new URL(request.url);
    const leadMagnetId = searchParams.get('leadMagnetId') ?? undefined;
    const libraryId = searchParams.get('libraryId') ?? undefined;
    const externalResourceId = searchParams.get('externalResourceId') ?? undefined;

<<<<<<< HEAD
    if (!leadMagnetId && !libraryId && !externalResourceId) {
=======
    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();
    let query = applyScope(
      supabase.from('funnel_pages').select('id, lead_magnet_id, user_id, slug, target_type, library_id, external_resource_id, optin_headline, optin_subline, optin_button_text, optin_social_proof, thankyou_headline, thankyou_subline, vsl_url, calendly_url, qualification_pass_message, qualification_fail_message, theme, primary_color, background_style, logo_url, qualification_form_id, is_published, published_at, created_at, updated_at, redirect_trigger, redirect_url, redirect_fail_url, homepage_url, homepage_label, send_resource_email, thankyou_layout'),
      scope
    );

    // Determine which target type to query (team-aware ownership checks)
    if (leadMagnetId) {
      if (!isValidUUID(leadMagnetId)) {
        return ApiErrors.validationError('Invalid leadMagnetId');
      }
      // Verify ownership (team-scoped)
      let lmQuery = supabase
        .from('lead_magnets')
        .select('id')
        .eq('id', leadMagnetId);
      lmQuery = applyScope(lmQuery, scope);
      const { data: lm } = await lmQuery.single();
      if (!lm) return ApiErrors.notFound('Lead magnet');
      query = query.eq('lead_magnet_id', leadMagnetId);
    } else if (libraryId) {
      if (!isValidUUID(libraryId)) {
        return ApiErrors.validationError('Invalid libraryId');
      }
      // Verify ownership (team-scoped)
      let libQuery = supabase
        .from('libraries')
        .select('id')
        .eq('id', libraryId);
      libQuery = applyScope(libQuery, scope);
      const { data: lib } = await libQuery.single();
      if (!lib) return ApiErrors.notFound('Library');
      query = query.eq('library_id', libraryId);
    } else if (externalResourceId) {
      if (!isValidUUID(externalResourceId)) {
        return ApiErrors.validationError('Invalid externalResourceId');
      }
      // Verify ownership (team-scoped)
      let erQuery = supabase
        .from('external_resources')
        .select('id')
        .eq('id', externalResourceId);
      erQuery = applyScope(erQuery, scope);
      const { data: er } = await erQuery.single();
      if (!er) return ApiErrors.notFound('External resource');
      query = query.eq('external_resource_id', externalResourceId);
    } else {
>>>>>>> cd46c59795c3148789086a657c2176e3dd0f8a47
      return ApiErrors.validationError('One of leadMagnetId, libraryId, or externalResourceId is required');
    }
    if (leadMagnetId && !isValidUUID(leadMagnetId)) return ApiErrors.validationError('Invalid leadMagnetId');
    if (libraryId && !isValidUUID(libraryId)) return ApiErrors.validationError('Invalid libraryId');
    if (externalResourceId && !isValidUUID(externalResourceId)) return ApiErrors.validationError('Invalid externalResourceId');

    const scope = await getDataScope(session.user.id);
    const funnel = await funnelsService.getFunnelByTarget(scope, { leadMagnetId, libraryId, externalResourceId });
    return NextResponse.json({ funnel });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const body = await request.json();
<<<<<<< HEAD
    const funnel = await funnelsService.createFunnel(scope, body);
    return NextResponse.json({ funnel }, { status: 201 });
=======
    const { leadMagnetId, libraryId, externalResourceId, targetType, slug, qualificationFormId, ...funnelData } = body;

    if (!slug) {
      return ApiErrors.validationError('slug is required');
    }

    // Determine target type (default to lead_magnet for backwards compatibility)
    const resolvedTargetType: FunnelTargetType = targetType || (leadMagnetId ? 'lead_magnet' : libraryId ? 'library' : 'external_resource');

    // Validate target type and required IDs
    if (resolvedTargetType === 'lead_magnet' && !leadMagnetId) {
      return ApiErrors.validationError('leadMagnetId is required for lead_magnet target type');
    }
    if (resolvedTargetType === 'library' && !libraryId) {
      return ApiErrors.validationError('libraryId is required for library target type');
    }
    if (resolvedTargetType === 'external_resource' && !externalResourceId) {
      return ApiErrors.validationError('externalResourceId is required for external_resource target type');
    }

    const supabase = createSupabaseAdminClient();
    let targetTitle = 'Funnel';

    // Verify target ownership (team-aware) and get title
    if (resolvedTargetType === 'lead_magnet') {
      if (!isValidUUID(leadMagnetId)) {
        return ApiErrors.validationError('Invalid leadMagnetId');
      }
      let lmQuery = supabase
        .from('lead_magnets')
        .select('id, title')
        .eq('id', leadMagnetId);
      lmQuery = applyScope(lmQuery, scope);
      const { data: lm, error: lmError } = await lmQuery.single();
      if (lmError || !lm) return ApiErrors.notFound('Lead magnet');
      targetTitle = lm.title;

      // Check for existing funnel
      const { data: existing } = await supabase
        .from('funnel_pages')
        .select('id')
        .eq('lead_magnet_id', leadMagnetId)
        .single();
      if (existing) return ApiErrors.conflict('Funnel page already exists for this lead magnet');
    } else if (resolvedTargetType === 'library') {
      if (!isValidUUID(libraryId)) {
        return ApiErrors.validationError('Invalid libraryId');
      }
      let libQuery = supabase
        .from('libraries')
        .select('id, name')
        .eq('id', libraryId);
      libQuery = applyScope(libQuery, scope);
      const { data: lib, error: libError } = await libQuery.single();
      if (libError || !lib) return ApiErrors.notFound('Library');
      targetTitle = lib.name;

      // Check for existing funnel
      const { data: existing } = await supabase
        .from('funnel_pages')
        .select('id')
        .eq('library_id', libraryId)
        .single();
      if (existing) return ApiErrors.conflict('Funnel page already exists for this library');
    } else if (resolvedTargetType === 'external_resource') {
      if (!isValidUUID(externalResourceId)) {
        return ApiErrors.validationError('Invalid externalResourceId');
      }
      let erQuery = supabase
        .from('external_resources')
        .select('id, title')
        .eq('id', externalResourceId);
      erQuery = applyScope(erQuery, scope);
      const { data: er, error: erError } = await erQuery.single();
      if (erError || !er) return ApiErrors.notFound('External resource');
      targetTitle = er.title;

      // Check for existing funnel
      const { data: existing } = await supabase
        .from('funnel_pages')
        .select('id')
        .eq('external_resource_id', externalResourceId)
        .single();
      if (existing) return ApiErrors.conflict('Funnel page already exists for this external resource');
    }

    // Fetch user theme defaults
    const { data: profile } = await supabase
      .from('users')
      .select('default_theme, default_primary_color, default_background_style, default_logo_url, default_vsl_url, default_funnel_template')
      .eq('id', session.user.id)
      .single();

    // Fetch brand kit defaults for this scope
    let brandKitQuery = supabase
      .from('brand_kits')
      .select('logos, default_testimonial, default_steps, default_theme, default_primary_color, default_background_style, logo_url, font_family, font_url');
    brandKitQuery = applyScope(brandKitQuery, scope);
    const { data: brandKit } = await brandKitQuery.single();

    // In team mode, use the team owner's user_id for public URL routing
    const funnelUserId = scope.type === 'team' && scope.ownerId ? scope.ownerId : session.user.id;

    // Check for slug collision with a single query
    let finalSlug = slug;
    const { data: existingSlugs } = await supabase
      .from('funnel_pages')
      .select('slug')
      .eq('user_id', funnelUserId)
      .or(`slug.eq.${slug},slug.like.${slug}-%`);

    if (existingSlugs && existingSlugs.length > 0) {
      const slugSet = new Set(existingSlugs.map((r: { slug: string }) => r.slug));
      if (slugSet.has(slug)) {
        // Find next available suffix
        let suffix = 1;
        while (suffix <= 100 && slugSet.has(`${slug}-${suffix}`)) {
          suffix++;
        }
        if (suffix > 100) {
          return ApiErrors.conflict('Unable to generate unique slug');
        }
        finalSlug = `${slug}-${suffix}`;
      }
    }

    // Create funnel page
    const funnelInsertData: Record<string, unknown> = {
      user_id: funnelUserId,
      team_id: scope.teamId || null,
      slug: finalSlug,
      target_type: resolvedTargetType,
      lead_magnet_id: resolvedTargetType === 'lead_magnet' ? leadMagnetId : null,
      library_id: resolvedTargetType === 'library' ? libraryId : null,
      external_resource_id: resolvedTargetType === 'external_resource' ? externalResourceId : null,
      optin_headline: funnelData.optinHeadline || targetTitle,
      optin_subline: funnelData.optinSubline || null,
      optin_button_text: funnelData.optinButtonText || 'Get Free Access',
      optin_social_proof: funnelData.optinSocialProof || null,
      thankyou_headline: funnelData.thankyouHeadline || 'Thanks! Check your email.',
      thankyou_subline: funnelData.thankyouSubline || null,
      vsl_url: funnelData.vslUrl || profile?.default_vsl_url || null,
      calendly_url: funnelData.calendlyUrl || null,
      qualification_pass_message: funnelData.qualificationPassMessage || 'Great! Book a call below.',
      qualification_fail_message: funnelData.qualificationFailMessage || 'Thanks for your interest!',
      theme: funnelData.theme || brandKit?.default_theme || profile?.default_theme || 'dark',
      primary_color: funnelData.primaryColor || brandKit?.default_primary_color || profile?.default_primary_color || '#8b5cf6',
      background_style: funnelData.backgroundStyle || brandKit?.default_background_style || profile?.default_background_style || 'solid',
      logo_url: normalizeImageUrl(funnelData.logoUrl || brandKit?.logo_url || profile?.default_logo_url || '') || null,
      font_family: brandKit?.font_family || null,
      font_url: brandKit?.font_url || null,
      qualification_form_id: qualificationFormId || null,
      send_resource_email: true,
      thankyou_layout: funnelData.thankyouLayout || 'survey_first',
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
      logApiError('funnel/create', error, { userId: session.user.id, leadMagnetId });
      return ApiErrors.databaseError('Failed to create funnel page');
    }

    // Auto-populate sections from user's default template
    const templateId = profile?.default_funnel_template || DEFAULT_TEMPLATE_ID;
    const template = getTemplate(templateId);

    if (template.sections.length > 0 && data) {
      const sectionRows = template.sections.map(s => {
        let config = { ...s.config };

        // Merge brand kit content into matching sections
        if (brandKit) {
          if (s.sectionType === 'logo_bar' && brandKit.logos?.length > 0) {
            config = { ...config, logos: brandKit.logos };
          }
          if (s.sectionType === 'testimonial' && brandKit.default_testimonial?.quote) {
            config = { ...config, ...brandKit.default_testimonial };
          }
          if (s.sectionType === 'steps' && brandKit.default_steps?.steps?.length > 0) {
            config = { ...config, ...brandKit.default_steps };
          }
        }

        return {
          funnel_page_id: data.id,
          section_type: s.sectionType,
          page_location: s.pageLocation,
          sort_order: s.sortOrder,
          is_visible: true,
          config,
        };
      });

      const { error: sectionsError } = await supabase
        .from('funnel_page_sections')
        .insert(sectionRows);

      if (sectionsError) {
        logApiError('funnel/create/template-sections', sectionsError, {
          userId: session.user.id,
          funnelId: data.id,
          templateId,
        });
      }
    }

    return NextResponse.json(
      { funnel: funnelPageFromRow(data as FunnelPageRow) },
      { status: 201 }
    );
>>>>>>> cd46c59795c3148789086a657c2176e3dd0f8a47
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
