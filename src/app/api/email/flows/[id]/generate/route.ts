// API Route: AI-Generate Email Steps for a Flow
// POST — Generate email steps using Claude AI

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
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

    let stepCount = 5;
    try {
      const body = await request.json();
      if (body?.stepCount && typeof body.stepCount === 'number' && body.stepCount >= 1 && body.stepCount <= 10) {
        stepCount = body.stepCount;
      }
    } catch {
      // Empty body is fine, use defaults
    }

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.generateFlowSteps(scope.teamId, flowId, session.user.id, stepCount);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Flow');
      return ApiErrors.databaseError('Failed to generate flow steps');
    }
    return NextResponse.json({
      steps: result.steps,
      generated: result.generated,
      stepCount: result.stepCount,
    });
  } catch (error) {
    logApiError('email/flows/generate', error);
    return ApiErrors.internalError('Failed to generate flow steps');
  }
}
