import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as signalsService from '@/server/services/signals.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const result = await signalsService.updateKeyword(session.user.id, id, { is_active: body.is_active });

    if (!result.success) {
      if (result.error === 'not_found') {
        return NextResponse.json({ error: 'Keyword monitor not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ keyword: result.keyword });
  } catch (error) {
    logError('api/signals/keywords/[id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    const result = await signalsService.deleteKeyword(session.user.id, id);

    if (!result.success) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('api/signals/keywords/[id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
