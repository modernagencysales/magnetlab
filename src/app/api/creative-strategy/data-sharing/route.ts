/**
 * Data Sharing Toggle Route
 * PATCH: toggle plays_data_sharing on the user's own record.
 * No super admin required — users toggle their own setting.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

const dataSharingSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = dataSharingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const { enabled } = parsed.data;

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from('users')
      .update({ plays_data_sharing: enabled })
      .eq('id', session.user.id);
    if (error) throw error;

    return NextResponse.json({ plays_data_sharing: enabled });
  } catch (error) {
    logError('creative-strategy/data-sharing', error, { step: 'toggle' });
    return NextResponse.json(
      { error: 'Failed to update data sharing preference' },
      { status: 500 }
    );
  }
}
