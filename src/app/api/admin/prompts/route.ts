import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as adminService from '@/server/services/admin.service';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await adminService.listPrompts();
  return NextResponse.json(data);
}
