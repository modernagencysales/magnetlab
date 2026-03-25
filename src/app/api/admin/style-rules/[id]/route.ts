/** Style Rules Admin API. Update rule status or text. Super-admin only. */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as service from '@/server/services/style-rules.service';
import { StyleRulePatchSchema } from '@/lib/validations/style-rules';
import { logError } from '@/lib/utils/logger';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isSuperAdmin(session.user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const parsed = StyleRulePatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const updated = await service.updateRule(id, parsed.data, session.user.id);
    return NextResponse.json({ rule: updated });
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode || 500;
    logError('admin/style-rules', err, { ruleId: id });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: statusCode }
    );
  }
}
