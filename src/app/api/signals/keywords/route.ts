import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as signalsService from '@/server/services/signals.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await signalsService.listKeywords(session.user.id);
    if (!result.success) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ keywords: result.keywords });
  } catch (error) {
    logError('api/signals/keywords', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const keyword = (body.keyword as string)?.trim();

    const result = await signalsService.createKeyword(session.user.id, keyword ?? '');

    if (!result.success) {
      if (result.error === 'validation') {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      if (result.error === 'limit') {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      if (result.error === 'conflict') {
        return NextResponse.json({ error: result.message }, { status: 409 });
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ keyword: result.keyword }, { status: 201 });
  } catch (error) {
    logError('api/signals/keywords', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
