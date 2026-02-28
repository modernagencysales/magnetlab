import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as swipeFileService from '@/server/services/swipe-file.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();

    if (body.type === 'post') {
      if (!body.content) return ApiErrors.validationError('Content is required');
      const result = await swipeFileService.submitPost(session.user.id, body);
      return NextResponse.json(result);
    }

    if (body.type === 'lead_magnet') {
      if (!body.title) return ApiErrors.validationError('Title is required');
      const result = await swipeFileService.submitLeadMagnet(session.user.id, body);
      return NextResponse.json(result);
    }

    return ApiErrors.validationError('Invalid submission type');
  } catch (error) {
    logApiError('swipe-file/submit', error);
    return ApiErrors.internalError();
  }
}
