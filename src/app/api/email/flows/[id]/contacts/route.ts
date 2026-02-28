// API Route: Email Flow Contacts
// GET — List contacts in a flow (paginated, joined with subscriber data)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as emailService from '@/server/services/email.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id: flowId } = await params;
    if (!isValidUUID(flowId)) return ApiErrors.validationError('Invalid flow ID');

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const result = await emailService.listFlowContacts(scope.teamId, flowId, page, limit);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Flow');
      return ApiErrors.databaseError('Failed to list flow contacts');
    }
    return NextResponse.json({
      contacts: result.contacts,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    logApiError('email/flows/contacts/list', error);
    return ApiErrors.internalError('Failed to list flow contacts');
  }
}
