/**
 * GET /api/leads/[id]
 * Returns full detail for a single funnel lead.
 * Scoped by auth — returns 404 (not 403) when lead belongs to another user.
 * Never imports from React or cookie layers.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { getDataScope } from '@/lib/utils/team-context';
import * as leadsService from '@/server/services/leads.service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid lead ID');

    const scope = await getDataScope(session.user.id);
    const lead = await leadsService.getLeadById(scope, id);

    if (!lead) return ApiErrors.notFound('Lead');

    return NextResponse.json(lead);
  } catch (error) {
    logApiError('leads/get-by-id', error);
    return ApiErrors.internalError('Failed to fetch lead');
  }
}
