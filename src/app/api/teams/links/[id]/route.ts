/**
 * DELETE /api/teams/links/[id] — remove an agency-to-client team link
 * Either the agency team owner or the client team owner may sever the link.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as teamsService from '@/server/services/teams.service';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id: linkId } = await params;
    if (!linkId) return ApiErrors.validationError('Link ID is required');

    const result = await teamsService.deleteTeamLink(session.user.id, linkId);
    return NextResponse.json(result);
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 403) {
      return ApiErrors.forbidden((error as Error).message);
    }
    if (statusCode === 404) {
      return ApiErrors.notFound((error as Error).message);
    }
    logApiError('team-links-delete', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError();
  }
}
