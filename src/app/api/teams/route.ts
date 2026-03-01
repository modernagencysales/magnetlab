import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as teamsService from '@/server/services/teams.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await teamsService.listTeams(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('teams-list', error);
    return ApiErrors.internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    let body: { name?: string; description?: string; industry?: string; target_audience?: string; shared_goal?: string };
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON');
    }

    const name = body.name?.trim();
    if (!name) return ApiErrors.validationError('Team name is required');

    const result = await teamsService.createTeam(
      session.user.id,
      {
        name,
        description: body.description,
        industry: body.industry,
        target_audience: body.target_audience,
        shared_goal: body.shared_goal,
      },
      session.user.email ?? null,
      session.user.name ?? null,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logApiError('teams-create', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    let body: { team_id?: string; name?: string; description?: string; industry?: string; target_audience?: string; shared_goal?: string };
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON');
    }

    if (!body.team_id) return ApiErrors.validationError('team_id is required');

    const result = await teamsService.updateTeam(session.user.id, body.team_id, {
      name: body.name,
      description: body.description,
      industry: body.industry,
      target_audience: body.target_audience,
      shared_goal: body.shared_goal,
    });

    if (result.error === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    logApiError('teams-update', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError();
  }
}
