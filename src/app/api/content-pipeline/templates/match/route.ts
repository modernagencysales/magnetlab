import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpTemplatesService from '@/server/services/cp-templates.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { topic, text, count = 5, minSimilarity = 0.3 } = body;
    const topicText = topic || text;
    if (!topicText) return ApiErrors.validationError('topic is required');

    const result = await cpTemplatesService.match(
      session.user.id,
      topicText,
      count,
      minSimilarity
    );
    if (!result.success) return ApiErrors.databaseError('Failed to match templates');
    return NextResponse.json({ matches: result.matches });
  } catch (error) {
    logApiError('cp/templates', error);
    return ApiErrors.internalError('Failed to match templates');
  }
}
