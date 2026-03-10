/**
 * POST /api/funnel/[id]/apply-restyle
 * Apply a reviewed restyle plan to a funnel page.
 * Body: { plan: RestylePlan }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScopeForResource } from '@/lib/utils/team-context';
import { ApiErrors, isValidUUID } from '@/lib/api/errors';
import * as restyleService from '@/server/services/restyle.service';
import { getFunnelTeamId } from '@/server/repositories/funnels.repo';
import { restylePlanSchema, validateBody } from '@/lib/validations/api';
import type { RestylePlan } from '@/lib/types/funnel';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid funnel page ID');

    const body = await request.json();
    if (!body.plan) return ApiErrors.validationError('plan is required');

    const validation = validateBody(body.plan, restylePlanSchema);
    if (!validation.success) {
      return ApiErrors.validationError(validation.error);
    }

    const teamId = await getFunnelTeamId(id);
    const scope = await getScopeForResource(session.user.id, teamId);
    const result = await restyleService.applyRestylePlan(scope, id, {
      plan: validation.data as RestylePlan,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = restyleService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
