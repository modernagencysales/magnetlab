// Resend Settings API
// PUT /api/integrations/resend/settings - Update Resend sender settings

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

// PUT - Update Resend sender settings (fromEmail, fromName)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { fromEmail, fromName } = body;

    const supabase = createSupabaseAdminClient();

    // Get existing integration
    const { data: existing, error: fetchError } = await supabase
      .from('user_integrations')
      .select('id, metadata')
      .eq('user_id', session.user.id)
      .eq('service', 'resend')
      .single();

    if (fetchError || !existing) {
      return ApiErrors.notFound('Resend integration');
    }

    // Update metadata with new settings
    const updatedMetadata = {
      ...(existing.metadata as Record<string, unknown> || {}),
      fromEmail: fromEmail || null,
      fromName: fromName || null,
    };

    const { error: updateError } = await supabase
      .from('user_integrations')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) {
      logApiError('integrations/resend/settings', updateError, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to update settings');
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    logApiError('integrations/resend/settings', error);
    return ApiErrors.internalError('Failed to update settings');
  }
}
