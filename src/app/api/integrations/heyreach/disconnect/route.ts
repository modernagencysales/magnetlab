// HeyReach Disconnect API
// POST /api/integrations/heyreach/disconnect
// Deletes integration and deactivates all funnel-level HeyReach integrations

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

    // Delete the integration credentials
    await deleteUserIntegration(session.user.id, 'heyreach');

    // Deactivate all funnel-level HeyReach integrations
    const supabase = createSupabaseAdminClient();
    await supabase
      .from('funnel_integrations')
      .update({ is_active: false })
      .eq('user_id', session.user.id)
      .eq('provider', 'heyreach');

    return NextResponse.json({
      success: true,
      message: 'Disconnected successfully',
    });
  } catch (error) {
    logApiError('heyreach/disconnect', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to disconnect HeyReach'
    );
  }
}
