import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpTemplatesService from '@/server/services/cp-templates.service';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await cpTemplatesService.seed(session.user.id);
    if (!result.success) return ApiErrors.databaseError('Failed to seed templates');
    return NextResponse.json({ message: result.message, seeded: result.seeded }, { status: 201 });
  } catch (error) {
    logApiError('cp/templates', error);
    return ApiErrors.internalError('Failed to seed templates');
  }
}
