// API Route: Email Flows
// GET — List flows for team (with step counts)
// POST — Create a new email flow

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { createFlowSchema } from '@/lib/types/email-system';

const FLOW_COLUMNS =
  'id, team_id, user_id, name, description, trigger_type, trigger_lead_magnet_id, status, created_at, updated_at';

// GET — List flows for the team, ordered by created_at desc, with step counts
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();
    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;

    // Fetch flows
    const { data: flows, error: flowsError } = await supabase
      .from('email_flows')
      .select(FLOW_COLUMNS)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (flowsError) {
      logApiError('email/flows/list', flowsError, { teamId });
      return ApiErrors.databaseError('Failed to list flows');
    }

    if (!flows || flows.length === 0) {
      return NextResponse.json({ flows: [] });
    }

    // Fetch step counts per flow
    const flowIds = flows.map((f: { id: string }) => f.id);
    const { data: stepCounts, error: stepCountError } = await supabase
      .from('email_flow_steps')
      .select('flow_id')
      .in('flow_id', flowIds);

    if (stepCountError) {
      logApiError('email/flows/step-counts', stepCountError, { teamId });
      // Non-fatal: return flows without step counts
      const flowsWithCounts = flows.map((f: Record<string, unknown>) => ({
        ...f,
        step_count: 0,
      }));
      return NextResponse.json({ flows: flowsWithCounts });
    }

    // Count steps per flow
    const countMap = new Map<string, number>();
    if (stepCounts) {
      for (const row of stepCounts) {
        const fid = row.flow_id as string;
        countMap.set(fid, (countMap.get(fid) || 0) + 1);
      }
    }

    const flowsWithCounts = flows.map((f: Record<string, unknown>) => ({
      ...f,
      step_count: countMap.get(f.id as string) || 0,
    }));

    return NextResponse.json({ flows: flowsWithCounts });
  } catch (error) {
    logApiError('email/flows/list', error);
    return ApiErrors.internalError('Failed to list flows');
  }
}

// POST — Create a new email flow
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const parsed = createFlowSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid flow data',
        parsed.error.issues
      );
    }

    const { name, description, trigger_type, trigger_lead_magnet_id } = parsed.data;

    const supabase = createSupabaseAdminClient();
    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;

    // If trigger_type is lead_magnet, validate trigger_lead_magnet_id
    if (trigger_type === 'lead_magnet') {
      if (!trigger_lead_magnet_id) {
        return ApiErrors.validationError(
          'trigger_lead_magnet_id is required when trigger_type is lead_magnet'
        );
      }

      // Verify the lead magnet belongs to this user
      const { data: leadMagnet, error: lmError } = await supabase
        .from('lead_magnets')
        .select('id')
        .eq('id', trigger_lead_magnet_id)
        .eq('user_id', session.user.id)
        .single();

      if (lmError || !leadMagnet) {
        return ApiErrors.validationError('Lead magnet not found or does not belong to you');
      }
    }

    const { data: flow, error } = await supabase
      .from('email_flows')
      .insert({
        team_id: teamId,
        user_id: session.user.id,
        name,
        description: description || null,
        trigger_type,
        trigger_lead_magnet_id: trigger_type === 'lead_magnet' ? trigger_lead_magnet_id : null,
        status: 'draft',
      })
      .select(FLOW_COLUMNS)
      .single();

    if (error) {
      logApiError('email/flows/create', error, { teamId });
      return ApiErrors.databaseError('Failed to create flow');
    }

    return NextResponse.json({ flow }, { status: 201 });
  } catch (error) {
    logApiError('email/flows/create', error);
    return ApiErrors.internalError('Failed to create flow');
  }
}
