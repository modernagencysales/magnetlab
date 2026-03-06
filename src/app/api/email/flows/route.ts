// API Route: Email Flows
// GET — List flows for team (with step counts)
// POST — Create a new email flow

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { createFlowSchema } from '@/lib/types/email-system';
import * as emailService from '@/server/services/email.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.listFlows(scope.teamId);
    if (!result.success) return ApiErrors.databaseError('Failed to list flows');
    return NextResponse.json({ flows: result.flows });
  } catch (error) {
    logApiError('email/flows/list', error);
    return ApiErrors.internalError('Failed to list flows');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const parsed = createFlowSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid flow data',
        parsed.error.issues
      );
    }

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    if (parsed.data.trigger_type === 'lead_magnet' && !parsed.data.trigger_lead_magnet_id) {
      return ApiErrors.validationError(
        'trigger_lead_magnet_id is required when trigger_type is lead_magnet'
      );
    }

    const result = await emailService.createFlow(scope.teamId, session.user.id, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      trigger_type: parsed.data.trigger_type,
      trigger_lead_magnet_id: parsed.data.trigger_lead_magnet_id ?? null,
    });
    if (!result.success) {
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Validation failed');
      return ApiErrors.databaseError('Failed to create flow');
    }
    return NextResponse.json({ flow: result.flow }, { status: 201 });
  } catch (error) {
    logApiError('email/flows/create', error);
    return ApiErrors.internalError('Failed to create flow');
  }
}
