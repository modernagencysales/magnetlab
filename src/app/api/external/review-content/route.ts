// API Route: External Content Review
// POST /api/external/review-content
//
// Reviews all draft pipeline posts for a user/team profile using AI.
// Deletes posts marked as 'delete', updates others with review_data.

import { NextResponse } from 'next/server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { authenticateExternalRequest } from '@/lib/api/external-auth';
import { reviewContent } from '@/server/services/external.service';

export async function POST(request: Request) {
  try {
    if (!authenticateExternalRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON in request body');
    }

    const { userId, teamProfileId, voiceProfile: rawVoiceProfile, icpSummary } = body as {
      userId?: string;
      teamProfileId?: string;
      voiceProfile?: string | Record<string, unknown>;
      icpSummary?: string;
    };

    if (!userId || typeof userId !== 'string') {
      return ApiErrors.validationError('userId is required');
    }

    const result = await reviewContent({
      userId,
      teamProfileId: teamProfileId ?? null,
      voiceProfile: rawVoiceProfile,
      icpSummary,
    });

    if (!result.success) {
      if (result.error === 'user_not_found') return ApiErrors.notFound('User');
      return ApiErrors.databaseError('Failed to review content');
    }

    return NextResponse.json({
      success: true,
      reviewed: result.reviewed,
      summary: result.summary,
      deletedPostIds: result.deletedPostIds,
    });
  } catch (error) {
    logApiError('external/review-content', error);
    return ApiErrors.internalError('An unexpected error occurred during content review');
  }
}
