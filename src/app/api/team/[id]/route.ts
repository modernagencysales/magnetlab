import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { checkTeamRole, hasMinimumRole } from '@/lib/auth/rbac';
import { logTeamActivity } from '@/lib/utils/activity-log';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

// GET /api/team/[id] — fetch a specific team by ID (requires membership)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const { id } = await params;
  if (!isValidUUID(id)) {
    return ApiErrors.validationError('Invalid team ID');
  }

  const role = await checkTeamRole(session.user.id, id);
  if (!role) return ApiErrors.forbidden();

  const supabase = createSupabaseAdminClient();
  const { data: team, error } = await supabase
    .from('teams')
    .select('id, owner_id, name, description, industry, target_audience, shared_goal, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !team) return ApiErrors.notFound('Team');

  return NextResponse.json({ team });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const { id } = await params;
  if (!isValidUUID(id)) {
    return ApiErrors.validationError('Invalid member ID');
  }

  const supabase = createSupabaseAdminClient();

  // Verify ownership (fetch email for V2 sync)
  const { data: member, error: fetchError } = await supabase
    .from('team_members')
    .select('id, owner_id, email, member_id')
    .eq('id', id)
    .single();

  if (fetchError || !member) {
    return ApiErrors.notFound('Team member');
  }

  if (member.owner_id !== session.user.id) {
    return ApiErrors.forbidden();
  }

  // RBAC: Look up the V2 team and verify owner role
  const { data: ownerTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', session.user.id)
    .single();

  if (ownerTeam) {
    const role = await checkTeamRole(session.user.id, ownerTeam.id);
    if (!hasMinimumRole(role, 'owner')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', id);

  if (error) {
    logApiError('team-remove', error, { userId: session.user.id, memberId: id });
    return ApiErrors.databaseError();
  }

  // Also soft-delete matching V2 team_profiles row to keep systems in sync
  if (ownerTeam) {
    // Match by user_id if available, otherwise by email
    if (member.member_id) {
      await supabase
        .from('team_profiles')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('team_id', ownerTeam.id)
        .eq('user_id', member.member_id)
        .neq('role', 'owner');
    } else if (member.email) {
      await supabase
        .from('team_profiles')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('team_id', ownerTeam.id)
        .eq('email', member.email)
        .neq('role', 'owner');
    }

    // Log activity
    logTeamActivity({
      teamId: ownerTeam.id,
      userId: session.user.id,
      action: 'member.removed',
      targetType: 'member',
      targetId: member.member_id || member.email,
      details: { email: member.email },
    });
  }

  return NextResponse.json({ success: true });
}
