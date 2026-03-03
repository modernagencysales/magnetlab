import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    await deleteUserIntegration(session.user.id, 'kajabi');

    const supabase = createSupabaseAdminClient();
    await supabase
      .from('funnel_integrations')
      .update({ is_active: false })
      .eq('user_id', session.user.id)
      .eq('provider', 'kajabi');

    return NextResponse.json({
      message: 'Disconnected successfully',
    });
  } catch (error) {
    logApiError('kajabi/disconnect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to disconnect Kajabi'
    );
  }
}
