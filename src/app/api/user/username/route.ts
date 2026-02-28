// API Route: Update User Username
// PUT /api/user/username — update; GET /api/user/username — get

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as userService from '@/server/services/user.service';

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return ApiErrors.validationError('Username is required');
    }
    if (!userService.validateUsernameFormat(username)) {
      return ApiErrors.validationError(
        'Username must be 3-30 characters, lowercase letters, numbers, hyphens, and underscores only'
      );
    }

    const result = await userService.setUsername(session.user.id, username);
    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'USERNAME_TAKEN') {
      return ApiErrors.validationError('Username is already taken');
    }
    if (err.message?.includes('check_username_not_reserved')) {
      return ApiErrors.validationError('This username is reserved and cannot be used');
    }
    if (err.message?.includes('check_username_format')) {
      return ApiErrors.validationError('Invalid username format');
    }
    logApiError('user/username/update', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError('Failed to update username');
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await userService.getUsername(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('user/username/get', error);
    return ApiErrors.internalError('Failed to fetch username');
  }
}
