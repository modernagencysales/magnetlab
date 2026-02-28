// API Route: Email Flow Steps
// POST — Add a step to a flow

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { createStepSchema } from '@/lib/types/email-system';
import * as emailService from '@/server/services/email.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id: flowId } = await params;
    if (!isValidUUID(flowId)) return ApiErrors.validationError('Invalid flow ID');

    const body = await request.json();
    const parsed = createStepSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid step data',
        parsed.error.issues
      );
    }

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.addFlowStep(scope.teamId, flowId, {
      step_number: parsed.data.step_number,
      subject: parsed.data.subject,
      body: parsed.data.body,
      delay_days: parsed.data.delay_days,
    });
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Flow');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Validation failed');
      return ApiErrors.databaseError('Failed to create step');
    }
    return NextResponse.json({ step: result.step }, { status: 201 });
  } catch (error) {
    logApiError('email/flows/steps/create', error);
    return ApiErrors.internalError('Failed to create step');
  }
}
