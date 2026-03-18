import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpTemplatesService from '@/server/services/cp-templates.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const body = await request.json();
    const { topic, text, count = 5, minSimilarity = 0.3 } = body;
    const topicText = topic || text;
    if (!topicText) return ApiErrors.validationError('topic is required');

    // match service requires teamId — use scope.teamId or fall back to userId
    const teamId = scope.teamId ?? scope.userId;
    const result = await cpTemplatesService.match(
      teamId,
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
