// API Route: Email Flow Steps
// POST /api/email/flows/[id]/steps — Add a step to a flow

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { createStepSchema } from '@/lib/types/email-system';

const STEP_COLUMNS =
  'id, flow_id, step_number, subject, body, delay_days, created_at, updated_at';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST — Add a step to an email flow
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: flowId } = await params;
    if (!isValidUUID(flowId)) {
      return ApiErrors.validationError('Invalid flow ID');
    }

    const body = await request.json();
    const parsed = createStepSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid step data',
        parsed.error.issues
      );
    }

    const { step_number, subject, body: stepBody, delay_days } = parsed.data;

    const supabase = createSupabaseAdminClient();
    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    // Verify flow belongs to user's team and is draft or paused
    const { data: flow, error: flowError } = await supabase
      .from('email_flows')
      .select('id, status')
      .eq('id', flowId)
      .eq('team_id', scope.teamId)
      .single();

    if (flowError || !flow) {
      return ApiErrors.notFound('Flow');
    }

    if (flow.status !== 'draft' && flow.status !== 'paused') {
      return ApiErrors.validationError('Steps can only be added to draft or paused flows');
    }

    // Insert the step
    const { data: step, error: insertError } = await supabase
      .from('email_flow_steps')
      .insert({
        flow_id: flowId,
        step_number,
        subject,
        body: stepBody,
        delay_days,
      })
      .select(STEP_COLUMNS)
      .single();

    if (insertError) {
      logApiError('email/flows/steps/create', insertError, { flowId });
      return ApiErrors.databaseError('Failed to create step');
    }

    return NextResponse.json({ step }, { status: 201 });
  } catch (error) {
    logApiError('email/flows/steps/create', error);
    return ApiErrors.internalError('Failed to create step');
  }
}
