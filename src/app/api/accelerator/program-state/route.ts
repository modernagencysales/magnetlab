/** GET /api/accelerator/program-state — returns the current user's program enrollment and module progress.
 *  Auth-gated. Never imports client-side utilities or browser APIs. */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getProgramState } from '@/lib/services/accelerator-program';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const programState = await getProgramState(session.user.id);
    return NextResponse.json({ programState });
  } catch (error) {
    logApiError('accelerator/program-state', error);
    return ApiErrors.internalError('Failed to fetch program state');
  }
}
