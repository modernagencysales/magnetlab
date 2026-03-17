import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScopeForResource } from '@/lib/utils/team-context';
import { ApiErrors, isValidUUID } from '@/lib/api/errors';
import * as funnelsService from '@/server/services/funnels.service';
import { getFunnelTeamId } from '@/server/repositories/funnels.repo';

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
    const { publish } = body;
    if (typeof publish !== 'boolean') return ApiErrors.validationError('publish must be a boolean');

    const teamId = await getFunnelTeamId(id);
    const scope = await getScopeForResource(session.user.id, teamId);
    const result = await funnelsService.publishFunnel(scope, id, publish);
    return NextResponse.json(result);
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    // Include enriched fields if present (publish content validation errors)
    const enriched = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
    const body: Record<string, unknown> = { error: message };
    if (enriched.missing_fields !== undefined) body.missing_fields = enriched.missing_fields;
    if (enriched.suggested_tool !== undefined) body.suggested_tool = enriched.suggested_tool;
    if (enriched.archetype_schema_hint !== undefined)
      body.archetype_schema_hint = enriched.archetype_schema_hint;
    return NextResponse.json(body, { status });
  }
}
