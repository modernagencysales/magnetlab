import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as adminService from '@/server/services/admin.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { slug } = await params;
  const body = await request.json();
  const version_id = body.version_id;

  if (!version_id) {
    return NextResponse.json(
      { error: 'version_id is required' },
      { status: 400 },
    );
  }

  const result = await adminService.restorePrompt(
    slug,
    version_id,
    session.user.email || session.user.id,
  );
  if (!result) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }
  return NextResponse.json(result);
}
