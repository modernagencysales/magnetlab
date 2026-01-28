// Resend Settings API
// PUT /api/integrations/resend/settings - Update Resend sender settings

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// PUT - Update Resend sender settings (fromEmail, fromName)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json(
        { error: 'Resend integration not found' },
        { status: 404 }
      );
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
      console.error('Error updating Resend settings:', updateError);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Error in Resend settings PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
