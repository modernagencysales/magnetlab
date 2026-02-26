// API Route: External Thank-You Page Setup
// POST /api/external/setup-thankyou
//
// Sets up thank-you page sections for a funnel page:
// bridge, steps, booking CTA (optional), testimonial (optional), logo bar (optional).
// Also enables resource email delivery and applies branding if available.

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

    const { userId, funnelPageId, bookingUrl, resourceTitle } = body as {
      userId?: string;
      funnelPageId?: string;
      bookingUrl?: string;
      resourceTitle?: string;
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

    // Step 5: Fetch brand kit for optional sections
    let brandKit: BrandKit | null = null;
    try {
      brandKit = await resolveBrandKit(supabase, userId);
    } catch (err) {
      logApiError('external/setup-thankyou/brand-kit', err, { userId });
    }

    // Step 6: Delete existing thankyou sections (clean slate)
    const { error: deleteError } = await supabase
      .from('funnel_page_sections')
      .delete()
      .eq('funnel_page_id', funnelPageId)
      .eq('page_location', 'thankyou');

    if (deleteError) {
      logApiError('external/setup-thankyou/delete-sections', deleteError, { funnelPageId });
      return ApiErrors.databaseError('Failed to clear existing thank-you sections');
    }

    // Step 7: Build thank-you sections
    const sections: Array<{
      funnel_page_id: string;
      section_type: string;
      page_location: string;
      sort_order: number;
      is_visible: boolean;
      config: Record<string, unknown>;
    }> = [];

    let sortOrder = 0;

    // Section 0: Bridge
    sections.push({
      funnel_page_id: funnelPageId,
      section_type: 'section_bridge',
      page_location: 'thankyou',
      sort_order: sortOrder++,
      is_visible: true,
      config: {
        text: "You're in! Here's what happens next",
        variant: 'accent',
      },
    });

    // Section 1: Steps
    const steps: Array<{ title: string; description: string }> = [];
    const resolvedTitle = resourceTitle || 'your resource';

    steps.push({
      title: 'Download Your Resource',
      description: `Check your email for ${resolvedTitle}. It should arrive within a few minutes.`,
    });

    steps.push({
      title: 'Take the Quick Quiz',
      description: 'Answer a few short questions so we can personalize your experience.',
    });

    if (bookingUrl) {
      steps.push({
        title: 'Book a Call',
        description: 'Schedule a quick chat to discuss how we can help you get results faster.',
      });
    }

    sections.push({
      funnel_page_id: funnelPageId,
      section_type: 'steps',
      page_location: 'thankyou',
      sort_order: sortOrder++,
      is_visible: true,
      config: {
        heading: 'What Happens Next',
        steps,
      },
    });

    // Section 2: Booking CTA (only if bookingUrl provided)
    const hasBookingCta = !!bookingUrl;
    if (hasBookingCta) {
      sections.push({
        funnel_page_id: funnelPageId,
        section_type: 'marketing_block',
        page_location: 'thankyou',
        sort_order: sortOrder++,
        is_visible: true,
        config: {
          blockType: 'cta',
          title: 'Ready to Take the Next Step?',
          content: 'Book a quick call and let us show you how to get results faster.',
          ctaText: 'Book Your Call',
          ctaUrl: bookingUrl,
        },
      });
    }

    // Section 3: Testimonial (only if brand kit has one)
    const hasTestimonial = !!(brandKit?.default_testimonial?.quote);
    if (hasTestimonial) {
      sections.push({
        funnel_page_id: funnelPageId,
        section_type: 'testimonial',
        page_location: 'thankyou',
        sort_order: sortOrder++,
        is_visible: true,
        config: {
          quote: brandKit!.default_testimonial!.quote,
          author: brandKit!.default_testimonial!.author || undefined,
          role: brandKit!.default_testimonial!.role || undefined,
        },
      });
    }

    // Section 4: Logo bar (only if brand kit has logos)
    const hasLogoBar = !!(brandKit?.logos && brandKit.logos.length > 0);
    if (hasLogoBar) {
      sections.push({
        funnel_page_id: funnelPageId,
        section_type: 'logo_bar',
        page_location: 'thankyou',
        sort_order: sortOrder++,
        is_visible: true,
        config: {
          logos: brandKit!.logos,
        },
      });
    }

    // Step 8: Insert sections
    if (sections.length > 0) {
      const { error: insertError } = await supabase
        .from('funnel_page_sections')
        .insert(sections);

      if (insertError) {
        logApiError('external/setup-thankyou/insert-sections', insertError, { funnelPageId });
        return ApiErrors.databaseError('Failed to create thank-you sections');
      }
    }

    // Step 9: Ensure send_resource_email = true + optionally apply branding
    const funnelUpdate: Record<string, unknown> = {
      send_resource_email: true,
    };

    if (brandKit) {
      if (brandKit.default_theme) funnelUpdate.theme = brandKit.default_theme;
      if (brandKit.default_primary_color) funnelUpdate.primary_color = brandKit.default_primary_color;
      if (brandKit.default_background_style) funnelUpdate.background_style = brandKit.default_background_style;
      if (brandKit.logo_url) funnelUpdate.logo_url = brandKit.logo_url;
      if (brandKit.font_family) funnelUpdate.font_family = brandKit.font_family;
      if (brandKit.font_url) funnelUpdate.font_url = brandKit.font_url;
    }

    const { error: funnelUpdateError } = await supabase
      .from('funnel_pages')
      .update(funnelUpdate)
      .eq('id', funnelPageId);

    if (funnelUpdateError) {
      logApiError('external/setup-thankyou/update-funnel', funnelUpdateError, { funnelPageId });
      // Non-fatal — sections were already created
    }

    return NextResponse.json({
      success: true,
      sectionsCreated: sections.length,
      hasBookingCta,
      hasTestimonial,
      hasLogoBar,
    });
  } catch (error) {
    logApiError('external/setup-thankyou', error);
    return ApiErrors.internalError('An unexpected error occurred during thank-you page setup');
  }
}
