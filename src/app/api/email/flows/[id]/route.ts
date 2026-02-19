// API Route: Single Email Flow
// GET /api/email/flows/[id] — Get flow with steps
// PUT /api/email/flows/[id] — Update flow
// DELETE /api/email/flows/[id] — Delete flow (draft or paused only)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { updateFlowSchema } from '@/lib/types/email-system';

const FLOW_COLUMNS =
  'id, team_id, user_id, name, description, trigger_type, trigger_lead_magnet_id, status, created_at, updated_at';

const STEP_COLUMNS =
  'id, flow_id, step_number, subject, body, delay_days, created_at, updated_at';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET — Get flow with all steps ordered by step_number
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid flow ID');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    // Fetch flow with team ownership check
    const { data: flow, error: flowError } = await supabase
      .from('email_flows')
      .select(FLOW_COLUMNS)
      .eq('id', id)
      .eq('team_id', scope.teamId)
      .single();

    if (flowError || !flow) {
      return ApiErrors.notFound('Flow');
    }

    // Fetch all steps for this flow, ordered by step_number
    const { data: steps, error: stepsError } = await supabase
      .from('email_flow_steps')
      .select(STEP_COLUMNS)
      .eq('flow_id', id)
      .order('step_number', { ascending: true });

    if (stepsError) {
      logApiError('email/flows/get-steps', stepsError, { flowId: id });
      return ApiErrors.databaseError('Failed to fetch flow steps');
    }

    return NextResponse.json({
      flow: {
        ...flow,
        steps: steps || [],
      },
    });
  } catch (error) {
    logApiError('email/flows/get', error);
    return ApiErrors.internalError('Failed to fetch flow');
  }
}

// PUT — Update flow fields
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid flow ID');
    }

    const body = await request.json();
    const parsed = updateFlowSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid flow data',
        parsed.error.issues
      );
    }

    const updates = parsed.data;

    if (Object.keys(updates).length === 0) {
      return ApiErrors.validationError('No fields to update');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    // Fetch existing flow with team ownership check
    const { data: existingFlow, error: fetchError } = await supabase
      .from('email_flows')
      .select('id, status, trigger_type')
      .eq('id', id)
      .eq('team_id', scope.teamId)
      .single();

    if (fetchError || !existingFlow) {
      return ApiErrors.notFound('Flow');
    }

    // If setting status to active, validate flow has at least 1 step
    if (updates.status === 'active') {
      const { count, error: countError } = await supabase
        .from('email_flow_steps')
        .select('id', { count: 'exact', head: true })
        .eq('flow_id', id);

      if (countError) {
        logApiError('email/flows/update/step-count', countError, { flowId: id });
        return ApiErrors.databaseError('Failed to verify flow steps');
      }

      if (!count || count === 0) {
        return ApiErrors.validationError('Flow must have at least 1 step before activating');
      }
    }

    // If changing trigger_type to lead_magnet, validate trigger_lead_magnet_id
    const effectiveTriggerType = updates.trigger_type || existingFlow.trigger_type;
    if (effectiveTriggerType === 'lead_magnet') {
      const effectiveLeadMagnetId =
        updates.trigger_lead_magnet_id !== undefined
          ? updates.trigger_lead_magnet_id
          : undefined; // only check if explicitly being set

      // If trigger_type is being changed to lead_magnet, require trigger_lead_magnet_id
      if (updates.trigger_type === 'lead_magnet' && !updates.trigger_lead_magnet_id) {
        return ApiErrors.validationError(
          'trigger_lead_magnet_id is required when trigger_type is lead_magnet'
        );
      }

      // If trigger_lead_magnet_id is being set, verify ownership
      if (effectiveLeadMagnetId) {
        const { data: leadMagnet, error: lmError } = await supabase
          .from('lead_magnets')
          .select('id')
          .eq('id', effectiveLeadMagnetId)
          .eq('user_id', session.user.id)
          .single();

        if (lmError || !leadMagnet) {
          return ApiErrors.validationError('Lead magnet not found or does not belong to you');
        }
      }
    }

    // Build the update data
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.trigger_type !== undefined) updateData.trigger_type = updates.trigger_type;
    if (updates.trigger_lead_magnet_id !== undefined) {
      updateData.trigger_lead_magnet_id = updates.trigger_lead_magnet_id;
    }

    const { data: flow, error: updateError } = await supabase
      .from('email_flows')
      .update(updateData)
      .eq('id', id)
      .select(FLOW_COLUMNS)
      .single();

    if (updateError) {
      logApiError('email/flows/update', updateError, { flowId: id });
      return ApiErrors.databaseError('Failed to update flow');
    }

    return NextResponse.json({ flow });
  } catch (error) {
    logApiError('email/flows/update', error);
    return ApiErrors.internalError('Failed to update flow');
  }
}

// DELETE — Delete flow (only draft or paused)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid flow ID');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    // Fetch flow with team ownership check
    const { data: flow, error: fetchError } = await supabase
      .from('email_flows')
      .select('id, status')
      .eq('id', id)
      .eq('team_id', scope.teamId)
      .single();

    if (fetchError || !flow) {
      return ApiErrors.notFound('Flow');
    }

    if (flow.status !== 'draft' && flow.status !== 'paused') {
      return ApiErrors.validationError('Only draft or paused flows can be deleted');
    }

    // Delete the flow (FK cascades will handle steps and contacts)
    const { error: deleteError } = await supabase
      .from('email_flows')
      .delete()
      .eq('id', id);

    if (deleteError) {
      logApiError('email/flows/delete', deleteError, { flowId: id });
      return ApiErrors.databaseError('Failed to delete flow');
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logApiError('email/flows/delete', error);
    return ApiErrors.internalError('Failed to delete flow');
  }
}
