// API Route: Individual LinkedIn Automation
// GET /api/linkedin/automations/[id] — Get automation with recent events
// PATCH /api/linkedin/automations/[id] — Update automation fields
// DELETE /api/linkedin/automations/[id] — Delete automation

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as linkedinService from '@/server/services/linkedin.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid automation ID');
    }

    const result = await linkedinService.getAutomation(session.user.id, id);
    if (!result.success) {
      return ApiErrors.notFound('Automation');
    }

    return NextResponse.json({ automation: result.automation, events: result.events });
  } catch (error) {
    logApiError('linkedin/automations/get', error);
    return ApiErrors.internalError('Failed to fetch automation');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid automation ID');
    }

    const body = await request.json();
    const result = await linkedinService.updateAutomation(session.user.id, id, body);
    if (!result.success) {
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Validation failed');
      return ApiErrors.notFound('Automation');
    }

    return NextResponse.json({ automation: result.automation });
  } catch (error) {
    logApiError('linkedin/automations/update', error);
    return ApiErrors.internalError('Failed to update automation');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid automation ID');
    }

    const result = await linkedinService.deleteAutomation(session.user.id, id);
    if (!result.success) {
      return ApiErrors.databaseError('Failed to delete automation');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('linkedin/automations/delete', error);
    return ApiErrors.internalError('Failed to delete automation');
  }
}
