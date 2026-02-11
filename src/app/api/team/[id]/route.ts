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

  // Verify ownership
  const { data: member, error: fetchError } = await supabase
    .from('team_members')
    .select('id, owner_id')
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

  return NextResponse.json({ success: true });
}
