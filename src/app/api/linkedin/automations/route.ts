// API Route: LinkedIn Automations CRUD
// GET /api/linkedin/automations — List user's automations
// POST /api/linkedin/automations — Create a new automation

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as linkedinService from '@/server/services/linkedin.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const result = await linkedinService.listAutomations(session.user.id);
    if (!result.success) {
      return ApiErrors.databaseError('Failed to fetch automations');
    }

    return NextResponse.json({ automations: result.automations });
  } catch (error) {
    logApiError('linkedin/automations/list', error);
    return ApiErrors.internalError('Failed to fetch automations');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();

    const result = await linkedinService.createAutomation(session.user.id, body);
    if (!result.success) {
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Name is required');
      return ApiErrors.databaseError('Failed to create automation');
    }

    return NextResponse.json({ automation: result.automation }, { status: 201 });
  } catch (error) {
    logApiError('linkedin/automations/create', error);
    return ApiErrors.internalError('Failed to create automation');
  }
}
