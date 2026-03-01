import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as keysService from '@/server/services/keys.service';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const result = await keysService.revokeKey(session.user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('keys/revoke', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to revoke API key');
  }
}
