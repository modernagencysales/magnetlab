import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { checkTeamRole, hasMinimumRole } from '@/lib/auth/rbac';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

// GET /api/team/[id]/activity — fetch paginated activity log for a team
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const { id: teamId } = await params;
  if (!isValidUUID(teamId)) {
    return ApiErrors.validationError('Invalid team ID');
  }

  // Require team membership
  const role = await checkTeamRole(session.user.id, teamId);
  if (!hasMinimumRole(role, 'member')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Parse pagination params
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  const supabase = createSupabaseAdminClient();

  // Fetch total count
  const { count, error: countError } = await supabase
    .from('team_activity_log')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);

  if (countError) {
    logApiError('activity-log-count', countError, { teamId });
    return ApiErrors.databaseError();
  }

  // Fetch activities
  const { data: activities, error } = await supabase
    .from('team_activity_log')
    .select('id, user_id, action, target_type, target_id, details, created_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logApiError('activity-log-list', error, { teamId });
    return ApiErrors.databaseError();
  }

  const formatted = (activities || []).map((a) => ({
    id: a.id,
    userId: a.user_id,
    action: a.action,
    targetType: a.target_type,
    targetId: a.target_id,
    details: a.details,
    createdAt: a.created_at,
  }));

  return NextResponse.json({
    activities: formatted,
    total: count || 0,
  });
}
