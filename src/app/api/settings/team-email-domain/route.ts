// API Route: Team Email Domain Management
// GET, POST, DELETE /api/settings/team-email-domain

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as settingsService from '@/server/services/settings.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await settingsService.getTeamEmailDomain(session.user.id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Team');
      if (result.error === 'database') return ApiErrors.databaseError(result.message ?? 'Failed to fetch email domain');
      return ApiErrors.internalError(result.message ?? 'Failed to fetch team email domain');
    }
    return NextResponse.json({ emailDomain: result.emailDomain });
  } catch (error) {
    logApiError('team-email-domain/get', error);
    return ApiErrors.internalError('Failed to fetch team email domain');
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
        'Invalid domain format. Use a domain like "mysite.com" or "mail.mysite.com" without http://'
      );
    }

    const result = await settingsService.setTeamEmailDomain(session.user.id, cleanDomain);
    if (!result.success) {
      if (result.error === 'forbidden') {
        return NextResponse.json({ error: result.message, upgrade: '/settings#billing' }, { status: 403 });
      }
      if (result.error === 'not_found') return ApiErrors.notFound('Team');
      if (result.error === 'conflict') return ApiErrors.conflict(result.message ?? 'Email domain in use');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Invalid domain');
      return ApiErrors.databaseError(result.message ?? 'Failed to save email domain');
    }
    return NextResponse.json({ emailDomain: result.emailDomain, dnsRecords: result.dnsRecords });
  } catch (error) {
    logApiError('team-email-domain/post', error);
    return ApiErrors.internalError('Failed to set team email domain');
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await settingsService.deleteTeamEmailDomain(session.user.id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound(result.message === 'Email domain not found' ? 'Email domain' : 'Team');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Failed to remove');
      return ApiErrors.databaseError(result.message ?? 'Failed to remove email domain');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('team-email-domain/delete', error);
    return ApiErrors.internalError('Failed to remove team email domain');
  }
}
