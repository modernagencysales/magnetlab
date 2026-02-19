// API Route: Broadcast Preview Count
// GET — Live recipient count preview for a broadcast's audience filter

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET — Preview recipient count for the broadcast's audience filter
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;

    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid broadcast ID format');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;

    // Fetch the broadcast to get its audience filter
    const { data: broadcast, error: findError } = await supabase
      .from('email_broadcasts')
      .select('id, audience_filter')
      .eq('id', id)
      .eq('team_id', teamId)
      .maybeSingle();

    if (findError) {
      logApiError('email/broadcasts/preview-count/find', findError, { id, teamId });
      return ApiErrors.databaseError('Failed to look up broadcast');
    }

    if (!broadcast) {
      return ApiErrors.notFound('Broadcast');
    }

    // Get filtered count and total active count in parallel
    const [filteredResult, totalResult] = await Promise.all([
      supabase.rpc('get_filtered_subscriber_count', {
        p_team_id: teamId,
        p_filter: broadcast.audience_filter || {},
      }),
      supabase.rpc('get_filtered_subscriber_count', {
        p_team_id: teamId,
        p_filter: {},
      }),
    ]);

    if (filteredResult.error) {
      logApiError('email/broadcasts/preview-count/filtered', filteredResult.error, { id, teamId });
      return ApiErrors.databaseError('Failed to count filtered subscribers');
    }

    if (totalResult.error) {
      logApiError('email/broadcasts/preview-count/total', totalResult.error, { id, teamId });
      return ApiErrors.databaseError('Failed to count total subscribers');
    }

    return NextResponse.json({
      count: filteredResult.data ?? 0,
      total: totalResult.data ?? 0,
    });
  } catch (error) {
    logApiError('email/broadcasts/preview-count', error);
    return ApiErrors.internalError('Failed to get preview count');
  }
}
