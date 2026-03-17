/**
 * Data Sharing Toggle Route
 * PATCH: toggle plays_data_sharing on the user's own record.
 * No super admin required — users toggle their own setting.
 * Delegates to cs-plays service. Never contains business logic.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import * as playsService from '@/server/services/cs-plays.service';
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

    const result = await playsService.updateDataSharing(session.user.id, parsed.data.enabled);
    return NextResponse.json({ plays_data_sharing: result });
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/data-sharing.PATCH', err);
    return NextResponse.json({ error: 'Failed to update data sharing preference' }, { status });
  }
}
