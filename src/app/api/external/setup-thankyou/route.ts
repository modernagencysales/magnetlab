// API Route: External Thank-You Page Setup
// POST /api/external/setup-thankyou
//
// Sets up thank-you page sections for a funnel page:
// bridge, steps, booking CTA (optional), testimonial (optional), logo bar (optional).
// Also enables resource email delivery and applies branding if available.

import { NextResponse } from 'next/server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { authenticateExternalRequest } from '@/lib/api/external-auth';
import { setupThankyou } from '@/server/services/external.service';

export async function POST(request: Request) {
  try {
    if (!authenticateExternalRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

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

    const result = await setupThankyou({
      userId,
      funnelPageId,
      bookingUrl,
      resourceTitle,
    });

    if (!result.success) {
      if (result.error === 'user_not_found') return ApiErrors.notFound('User');
      if (result.error === 'funnel_not_found') return ApiErrors.notFound('Funnel page');
      return ApiErrors.databaseError('Failed to set up thank-you sections');
    }

    return NextResponse.json({
      success: true,
      sectionsCreated: result.sectionsCreated,
      hasBookingCta: result.hasBookingCta,
      hasTestimonial: result.hasTestimonial,
      hasLogoBar: result.hasLogoBar,
    });
  } catch (error) {
    logApiError('external/setup-thankyou', error);
    return ApiErrors.internalError('An unexpected error occurred during thank-you page setup');
  }
}
