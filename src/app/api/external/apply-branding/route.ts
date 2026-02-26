// API Route: External Apply Branding
// POST /api/external/apply-branding
//
// Applies brand kit styling to a funnel page and its sections.
// Uses provided brandKit or fetches from DB (team-level first, then user-level).

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { authenticateExternalRequest } from '@/lib/api/external-auth';
import { resolveBrandKit, type BrandKit } from '@/lib/api/resolve-brand-kit';

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: Request) {
  try {
    // Step 1: Authenticate
    if (!authenticateExternalRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    // Step 2: Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON in request body');
    }

    const { userId, funnelPageId, brandKit: providedBrandKit } = body as {
      userId?: string;
      funnelPageId?: string;
      brandKit?: BrandKit;
    };

    if (!userId || typeof userId !== 'string') {
      return ApiErrors.validationError('userId is required');
    }
    if (!funnelPageId || typeof funnelPageId !== 'string') {
      return ApiErrors.validationError('funnelPageId is required');
    }

    const supabase = createSupabaseAdminClient();

    // Step 3: Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return ApiErrors.notFound('User');
    }

    // Step 4: Verify funnel page exists and belongs to user
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id, user_id')
      .eq('id', funnelPageId)
      .eq('user_id', userId)
      .single();

    if (funnelError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    // Step 5: Resolve brand kit
    let brandKit: BrandKit | null = null;

    if (providedBrandKit && typeof providedBrandKit === 'object') {
      brandKit = providedBrandKit as BrandKit;
    } else {
      brandKit = await resolveBrandKit(supabase, userId);
    }

    if (!brandKit) {
      return NextResponse.json({
        success: true,
        applied: [],
        message: 'No brand kit found; nothing to apply',
      });
    }

    // Step 6: Apply branding to funnel_pages row
    const appliedFields: string[] = [];
    const funnelUpdate: Record<string, unknown> = {};

    if (brandKit.default_theme) {
      funnelUpdate.theme = brandKit.default_theme;
      appliedFields.push('theme');
    }
    if (brandKit.default_primary_color) {
      funnelUpdate.primary_color = brandKit.default_primary_color;
      appliedFields.push('primary_color');
    }
    if (brandKit.default_background_style) {
      funnelUpdate.background_style = brandKit.default_background_style;
      appliedFields.push('background_style');
    }
    if (brandKit.logo_url) {
      funnelUpdate.logo_url = brandKit.logo_url;
      appliedFields.push('logo_url');
    }
    if (brandKit.font_family) {
      funnelUpdate.font_family = brandKit.font_family;
      appliedFields.push('font_family');
    }
    if (brandKit.font_url) {
      funnelUpdate.font_url = brandKit.font_url;
      appliedFields.push('font_url');
    }

    if (Object.keys(funnelUpdate).length > 0) {
      const { error: updateError } = await supabase
        .from('funnel_pages')
        .update(funnelUpdate)
        .eq('id', funnelPageId);

      if (updateError) {
        logApiError('external/apply-branding/update-funnel', updateError, { funnelPageId });
        return ApiErrors.databaseError('Failed to update funnel page branding');
      }
    }

    // Step 7: Update sections with brand kit content
    // Fetch all sections for this funnel
    const { data: sections } = await supabase
      .from('funnel_page_sections')
      .select('id, section_type, config')
      .eq('funnel_page_id', funnelPageId);

    if (sections && sections.length > 0) {
      for (const section of sections) {
        let config = (section.config || {}) as Record<string, unknown>;
        let updated = false;

        if (section.section_type === 'logo_bar' && brandKit.logos && brandKit.logos.length > 0) {
          config = { ...config, logos: brandKit.logos };
          updated = true;
          if (!appliedFields.includes('logos')) appliedFields.push('logos');
        }

        if (section.section_type === 'testimonial' && brandKit.default_testimonial?.quote) {
          config = { ...config, ...brandKit.default_testimonial };
          updated = true;
          if (!appliedFields.includes('default_testimonial')) appliedFields.push('default_testimonial');
        }

        if (section.section_type === 'steps' && brandKit.default_steps?.steps?.length) {
          config = { ...config, ...brandKit.default_steps };
          updated = true;
          if (!appliedFields.includes('default_steps')) appliedFields.push('default_steps');
        }

        if (updated) {
          const { error: sectionError } = await supabase
            .from('funnel_page_sections')
            .update({ config })
            .eq('id', section.id);

          if (sectionError) {
            logApiError('external/apply-branding/update-section', sectionError, {
              sectionId: section.id,
              sectionType: section.section_type,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      applied: appliedFields,
    });
  } catch (error) {
    logApiError('external/apply-branding', error);
    return ApiErrors.internalError('An unexpected error occurred while applying branding');
  }
}
