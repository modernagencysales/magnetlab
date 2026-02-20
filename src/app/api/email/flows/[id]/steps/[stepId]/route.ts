// API Route: Single Email Flow Step
// PUT /api/email/flows/[id]/steps/[stepId] — Update a step
// DELETE /api/email/flows/[id]/steps/[stepId] — Remove a step (renumbers remaining)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { updateStepSchema } from '@/lib/types/email-system';

const STEP_COLUMNS =
  'id, flow_id, step_number, subject, body, delay_days, created_at, updated_at';

interface RouteParams {
  params: Promise<{ id: string; stepId: string }>;
}

// PUT — Update a step
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: flowId, stepId } = await params;
    if (!isValidUUID(flowId) || !isValidUUID(stepId)) {
      return ApiErrors.validationError('Invalid ID format');
    }

    const body = await request.json();
    const parsed = updateStepSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid step data',
        parsed.error.issues
      );
    }

    const updates = parsed.data;

    if (Object.keys(updates).length === 0) {
      return ApiErrors.validationError('No fields to update');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    // Verify flow belongs to team and is draft or paused
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
      return ApiErrors.validationError('Steps can only be updated in draft or paused flows');
    }

    // Verify step exists and belongs to this flow
    const { data: existingStep, error: stepFetchError } = await supabase
      .from('email_flow_steps')
      .select('id')
      .eq('id', stepId)
      .eq('flow_id', flowId)
      .single();

    if (stepFetchError || !existingStep) {
      return ApiErrors.notFound('Step');
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (updates.subject !== undefined) updateData.subject = updates.subject;
    if (updates.body !== undefined) updateData.body = updates.body;
    if (updates.delay_days !== undefined) updateData.delay_days = updates.delay_days;
    if (updates.step_number !== undefined) updateData.step_number = updates.step_number;

    const { data: step, error: updateError } = await supabase
      .from('email_flow_steps')
      .update(updateData)
      .eq('id', stepId)
      .select(STEP_COLUMNS)
      .single();

    if (updateError) {
      logApiError('email/flows/steps/update', updateError, { flowId, stepId });
      return ApiErrors.databaseError('Failed to update step');
    }

    return NextResponse.json({ step });
  } catch (error) {
    logApiError('email/flows/steps/update', error);
    return ApiErrors.internalError('Failed to update step');
  }
}

// DELETE — Remove a step and renumber remaining steps
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: flowId, stepId } = await params;
    if (!isValidUUID(flowId) || !isValidUUID(stepId)) {
      return ApiErrors.validationError('Invalid ID format');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    // Verify flow belongs to team and is draft or paused
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
      return ApiErrors.validationError('Steps can only be removed from draft or paused flows');
    }

    // Fetch the step to get its step_number before deleting
    const { data: stepToDelete, error: stepFetchError } = await supabase
      .from('email_flow_steps')
      .select('id, step_number')
      .eq('id', stepId)
      .eq('flow_id', flowId)
      .single();

    if (stepFetchError || !stepToDelete) {
      return ApiErrors.notFound('Step');
    }

    const deletedStepNumber = stepToDelete.step_number;

    // Delete the step
    const { error: deleteError } = await supabase
      .from('email_flow_steps')
      .delete()
      .eq('id', stepId);

    if (deleteError) {
      logApiError('email/flows/steps/delete', deleteError, { flowId, stepId });
      return ApiErrors.databaseError('Failed to delete step');
    }

    // Renumber remaining steps to close the gap
    // Fetch all steps with step_number > deleted step_number
    const { data: remainingSteps, error: fetchRemainingError } = await supabase
      .from('email_flow_steps')
      .select('id, step_number')
      .eq('flow_id', flowId)
      .gt('step_number', deletedStepNumber)
      .order('step_number', { ascending: true });

    if (fetchRemainingError) {
      logApiError('email/flows/steps/renumber', fetchRemainingError, { flowId });
      // Non-fatal — step was deleted, renumbering failed but state is recoverable
    } else if (remainingSteps && remainingSteps.length > 0) {
      // Decrement each step_number by 1
      for (const step of remainingSteps) {
        await supabase
          .from('email_flow_steps')
          .update({ step_number: step.step_number - 1 })
          .eq('id', step.id);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logApiError('email/flows/steps/delete', error);
    return ApiErrors.internalError('Failed to delete step');
  }
}
