// API Route: Email Flow Contacts
// GET /api/email/flows/[id]/contacts — List contacts in a flow (paginated, joined with subscriber data)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET — List contacts in a flow with subscriber details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: flowId } = await params;
    if (!isValidUUID(flowId)) {
      return ApiErrors.validationError('Invalid flow ID');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    // Verify flow belongs to team
    const { data: flow, error: flowError } = await supabase
      .from('email_flows')
      .select('id')
      .eq('id', flowId)
      .eq('team_id', scope.teamId)
      .single();

    if (flowError || !flow) {
      return ApiErrors.notFound('Flow');
    }

    // Pagination
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Fetch contacts with subscriber join
    const [contactsResult, countResult] = await Promise.all([
      supabase
        .from('email_flow_contacts')
        .select(
          'id, flow_id, subscriber_id, current_step, status, entered_at, last_sent_at, email_subscribers!inner(email, first_name, last_name)'
        )
        .eq('flow_id', flowId)
        .order('entered_at', { ascending: false })
        .range(from, to),
      supabase
        .from('email_flow_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('flow_id', flowId),
    ]);

    if (contactsResult.error) {
      logApiError('email/flows/contacts/list', contactsResult.error, { flowId });
      return ApiErrors.databaseError('Failed to list flow contacts');
    }

    if (countResult.error) {
      logApiError('email/flows/contacts/count', countResult.error, { flowId });
      return ApiErrors.databaseError('Failed to count flow contacts');
    }

    // Flatten the subscriber join data for cleaner response
    const contacts = (contactsResult.data || []).map((c: Record<string, unknown>) => {
      const subscriber = c.email_subscribers as {
        email: string;
        first_name: string | null;
        last_name: string | null;
      } | null;

      return {
        id: c.id,
        flow_id: c.flow_id,
        subscriber_id: c.subscriber_id,
        current_step: c.current_step,
        status: c.status,
        entered_at: c.entered_at,
        last_sent_at: c.last_sent_at,
        email: subscriber?.email || null,
        first_name: subscriber?.first_name || null,
        last_name: subscriber?.last_name || null,
      };
    });

    return NextResponse.json({
      contacts,
      total: countResult.count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    logApiError('email/flows/contacts/list', error);
    return ApiErrors.internalError('Failed to list flow contacts');
  }
}
