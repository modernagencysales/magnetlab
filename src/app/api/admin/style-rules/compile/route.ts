/** Manual trigger to recompile approved global rules. Super-admin only. */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as service from '@/server/services/style-rules.service';
import { logError } from '@/lib/utils/logger';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isSuperAdmin(session.user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await service.compileGlobalRules(session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    logError('admin/style-rules/compile', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Compile failed' },
      { status: 500 }
    );
  }
}
