import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      logApiError('keys/revoke', error, { userId: session.user.id, keyId: id });
      return ApiErrors.databaseError('Failed to revoke API key');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('keys/revoke', error);
    return ApiErrors.internalError();
  }
}
