/** Style Rules Admin API. List and create style rules. Super-admin only. */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as service from '@/server/services/style-rules.service';
import { StyleRuleCreateSchema } from '@/lib/validations/style-rules';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isSuperAdmin(session.user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') || undefined;
  const scope = searchParams.get('scope') || undefined;

  const rules = await service.listRules({ status, scope });
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isSuperAdmin(session.user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = StyleRuleCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rule = await service.createRule(parsed.data);
  return NextResponse.json({ rule }, { status: 201 });
}
