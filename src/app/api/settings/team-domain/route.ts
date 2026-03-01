// API Route: Team Domain Management
// GET, POST, DELETE /api/settings/team-domain

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as settingsService from '@/server/services/settings.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await settingsService.getTeamDomain(session.user.id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Team');
      if (result.error === 'database') return ApiErrors.databaseError(result.message ?? 'Failed to fetch domain');
      return ApiErrors.internalError(result.message ?? 'Failed to fetch team domain');
    }
    return NextResponse.json({ domain: result.domain });
  } catch (error) {
    logApiError('team-domain/get', error);
    return ApiErrors.internalError('Failed to fetch team domain');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { domain } = body;
    if (!domain || typeof domain !== 'string') return ApiErrors.validationError('domain is required');

    const cleanDomain = settingsService.cleanDomain(domain);
    if (!settingsService.isValidDomain(cleanDomain)) {
      return ApiErrors.validationError(
        'Invalid domain format. Use a domain like "mysite.com" or "leads.mysite.com" without http://'
      );
    }

    const result = await settingsService.setTeamDomain(session.user.id, cleanDomain);
    if (!result.success) {
      if (result.error === 'forbidden') {
        return NextResponse.json({ error: result.message, upgrade: '/settings#billing' }, { status: 403 });
      }
      if (result.error === 'not_found') return ApiErrors.notFound('Team');
      if (result.error === 'conflict') return ApiErrors.conflict(result.message ?? 'Domain in use');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Invalid domain');
      return ApiErrors.databaseError(result.message ?? 'Failed to save domain');
    }
    return NextResponse.json({ domain: result.domain, dnsInstructions: result.dnsInstructions });
  } catch (error) {
    logApiError('team-domain/post', error);
    return ApiErrors.internalError('Failed to set team domain');
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await settingsService.deleteTeamDomain(session.user.id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound(result.message === 'Domain not found' ? 'Domain' : 'Team');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Failed to remove');
      return ApiErrors.databaseError(result.message ?? 'Failed to remove domain');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('team-domain/delete', error);
    return ApiErrors.internalError('Failed to remove team domain');
  }
}
