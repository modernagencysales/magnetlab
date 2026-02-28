import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api/errors';
import type { PostWriterInput } from '@/lib/types/lead-magnet';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { leadMagnetId, ...rest } = body;
    const input = rest as PostWriterInput;

    const result = await leadMagnetsService.startWritePost(session.user.id, input, leadMagnetId);
    return NextResponse.json(result);
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
