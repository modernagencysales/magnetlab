import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api/errors';
import { getDataScope } from '@/lib/utils/team-context';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const scope = await getDataScope(session.user.id);
    const result = await leadMagnetsService.importLeadMagnet(scope, session.user.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
