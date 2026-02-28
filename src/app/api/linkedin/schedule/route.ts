// API Route: Schedule LinkedIn Post
// POST /api/linkedin/schedule

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as linkedinService from '@/server/services/linkedin.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { leadMagnetId, content, scheduledTime } = body as {
      leadMagnetId: string;
      content: string;
      scheduledTime: string;
    };

    if (!leadMagnetId || !content || !scheduledTime) {
      return ApiErrors.validationError('leadMagnetId, content, and scheduledTime are required');
    }

    const result = await linkedinService.schedulePost(session.user.id, {
      leadMagnetId,
      content,
      scheduledTime,
    });

    if (!result.success) {
      if (result.error === 'forbidden') return ApiErrors.forbidden(result.message ?? 'Scheduling requires an Unlimited subscription');
      return ApiErrors.internalError(result.message ?? 'Failed to create scheduled post');
    }

    return NextResponse.json({
      success: true,
      postId: result.postId,
      scheduledTime: result.scheduledTime,
      scheduled_via: result.scheduled_via,
    });
  } catch (error) {
    logApiError('linkedin/schedule', error);
    return ApiErrors.internalError('Failed to schedule post');
  }
}
