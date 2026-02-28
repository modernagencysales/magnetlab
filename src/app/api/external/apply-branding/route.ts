// API Route: External Apply Branding
// POST /api/external/apply-branding
//
// Applies brand kit styling to a funnel page and its sections.
// Uses provided brandKit or fetches from DB (team-level first, then user-level).

import { NextResponse } from 'next/server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { authenticateExternalRequest } from '@/lib/api/external-auth';
import { applyBranding } from '@/server/services/external.service';
import type { BrandKit } from '@/lib/api/resolve-brand-kit';

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

    const result = await applyBranding({
      userId,
      funnelPageId,
      brandKit: providedBrandKit && typeof providedBrandKit === 'object' ? providedBrandKit : undefined,
    });

    if (!result.success) {
      if (result.error === 'user_not_found') return ApiErrors.notFound('User');
      if (result.error === 'funnel_not_found') return ApiErrors.notFound('Funnel page');
      return ApiErrors.databaseError('Failed to update funnel page branding');
    }

    if ('message' in result) {
      return NextResponse.json({ success: true, applied: result.applied, message: result.message });
    }
    return NextResponse.json({ success: true, applied: result.applied });
  } catch (error) {
    logApiError('external/apply-branding', error);
    return ApiErrors.internalError('An unexpected error occurred while applying branding');
  }
}
