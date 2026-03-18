/**
 * GET  /api/teams/links — list team links for the user's owned team
 * POST /api/teams/links — create an agency-to-client team link
 */

import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as teamsService from '@/server/services/teams.service';

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const CreateTeamLinkSchema = z.object({
  agency_team_id: z.string().uuid('agency_team_id must be a valid UUID'),
  client_team_id: z.string().uuid('client_team_id must be a valid UUID'),
});

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await teamsService.listTeamLinks(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('team-links-list', error);
    return ApiErrors.internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON');
    }

    const parsed = CreateTeamLinkSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.errors[0]?.message ?? 'Invalid request body',
        parsed.error.flatten().fieldErrors
      );
    }

    const result = await teamsService.createTeamLink(
      session.user.id,
      parsed.data.agency_team_id,
      parsed.data.client_team_id
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 403) {
      return ApiErrors.forbidden((error as Error).message);
    }
    if (statusCode === 404) {
      return ApiErrors.notFound((error as Error).message);
    }
    if (statusCode === 400) {
      return ApiErrors.validationError((error as Error).message);
    }
    logApiError('team-links-create', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError();
  }
}
