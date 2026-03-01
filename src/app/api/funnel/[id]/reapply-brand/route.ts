import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as funnelsService from '@/server/services/funnels.service';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: funnelPageId } = await params;
    const result = await funnelsService.reapplyBrandKit(session.user.id, funnelPageId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
