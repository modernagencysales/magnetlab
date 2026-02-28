import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as teamService from '@/server/services/team.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const enriched = await teamService.listMembers(session.user.id);
    return NextResponse.json(enriched);
  } catch (error) {
    logApiError('team-list', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    let body: { email?: string };
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON');
    }

    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ApiErrors.validationError('Valid email is required');
    }
    if (email === session.user.email?.toLowerCase()) {
      return ApiErrors.validationError('You cannot invite yourself');
    }

    const result = await teamService.inviteMember(
      session.user.id,
      email,
      session.user.name || session.user.email || 'Someone',
    );

    if ('error' in result) {
      if (result.error === 'FORBIDDEN') {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      if (result.error === 'CONFLICT') return ApiErrors.conflict('This email has already been invited');
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logApiError('team-invite', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError();
  }
}
