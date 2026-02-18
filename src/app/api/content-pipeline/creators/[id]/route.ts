import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

import { logError } from '@/lib/utils/logger';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    // Only the user who added the creator can delete it
    const { data: existing, error: lookupError } = await supabase
      .from('cp_tracked_creators')
      .select('id, added_by_user_id')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    if (existing.added_by_user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden: you can only delete creators you added' }, { status: 403 });
    }

    const { error } = await supabase
      .from('cp_tracked_creators')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('cp/creators', error, { step: 'creator_delete_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
