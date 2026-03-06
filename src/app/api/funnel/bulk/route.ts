import { NextResponse } from 'next/server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { resolveUserId } from '@/lib/auth/api-key';
import { validateBody, bulkCreatePagesSchema } from '@/lib/validations/api';
import * as funnelsService from '@/server/services/funnels.service';

export async function POST(request: Request) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) return ApiErrors.unauthorized();

    const body = await request.json();
    const validation = validateBody(body, bulkCreatePagesSchema);
    if (!validation.success) {
      return ApiErrors.validationError(validation.error, validation.details);
    }

    const result = await funnelsService.bulkCreateFunnels(userId, validation.data.pages);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('funnel/bulk', error);
    return NextResponse.json({ error: 'Bulk creation failed' }, { status: 500 });
  }
}
