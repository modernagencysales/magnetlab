// API Route: Custom Domain Management (funnel pages)
// GET, POST, DELETE /api/settings/custom-domain

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as settingsService from '@/server/services/settings.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await settingsService.listCustomDomains(session.user.id);
    if (!result.success) return ApiErrors.databaseError('Failed to fetch custom domains');
    return NextResponse.json({ domains: result.domains });
  } catch (error) {
    logApiError('custom-domain/list', error);
    return ApiErrors.internalError('Failed to fetch custom domains');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { funnelPageId, domain } = body;
    if (!funnelPageId || !isValidUUID(funnelPageId)) return ApiErrors.validationError('Valid funnelPageId is required');
    if (!domain || typeof domain !== 'string') return ApiErrors.validationError('domain is required');

    const cleanDomain = settingsService.cleanDomain(domain);
    if (!settingsService.isValidDomain(cleanDomain)) {
      return ApiErrors.validationError(
        'Invalid domain format. Use a domain like "mysite.com" or "leads.mysite.com" without http://'
      );
    }

    const result = await settingsService.setCustomDomain(session.user.id, funnelPageId, cleanDomain);
    if (!result.success) {
      if (result.error === 'forbidden') {
        return NextResponse.json({ error: result.message, upgrade: '/settings#billing' }, { status: 403 });
      }
      if (result.error === 'not_found') return ApiErrors.notFound('Funnel page');
      if (result.error === 'conflict') return ApiErrors.conflict(result.message ?? 'Domain in use');
      return ApiErrors.databaseError(result.message ?? 'Failed to set custom domain');
    }
    return NextResponse.json({
      domain: result.domain,
      funnelPageId: result.funnelPageId,
      dnsInstructions: result.dnsInstructions,
    });
  } catch (error) {
    logApiError('custom-domain/set', error);
    return ApiErrors.internalError('Failed to set custom domain');
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { funnelPageId } = body;
    if (!funnelPageId || !isValidUUID(funnelPageId)) return ApiErrors.validationError('Valid funnelPageId is required');

    const result = await settingsService.removeCustomDomain(session.user.id, funnelPageId);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Funnel page');
      return ApiErrors.databaseError(result.message ?? 'Failed to remove custom domain');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('custom-domain/remove', error);
    return ApiErrors.internalError('Failed to remove custom domain');
  }
}
