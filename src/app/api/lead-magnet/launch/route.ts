/**
 * POST /api/lead-magnet/launch
 * Compound action: create lead magnet + funnel + publish. All-or-nothing.
 * Never contains business logic — delegates entirely to the service layer.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api/errors';
import { getDataScope } from '@/lib/utils/team-context';
import * as launchService from '@/server/services/launch-lead-magnet.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const body = await request.json();
    const result = await launchService.launchLeadMagnet(scope, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const status = launchService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const extras: Record<string, unknown> = {};
    if (error && typeof error === 'object') {
      if ('details' in error) extras.details = (error as { details: unknown }).details;
      if ('missing_fields' in error)
        extras.missing_fields = (error as { missing_fields: unknown }).missing_fields;
      if ('archetype_schema_hint' in error)
        extras.archetype_schema_hint = (
          error as { archetype_schema_hint: unknown }
        ).archetype_schema_hint;
    }
    return NextResponse.json({ error: message, ...extras }, { status });
  }
}
