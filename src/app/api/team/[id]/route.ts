import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

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

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', id);

  if (error) {
    logApiError('team-remove', error, { userId: session.user.id, memberId: id });
    return ApiErrors.databaseError();
  }

  // Also soft-delete matching V2 team_profiles row to keep systems in sync
  const { data: ownerTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', session.user.id)
    .single();

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
  }

  return NextResponse.json({ success: true });
}
