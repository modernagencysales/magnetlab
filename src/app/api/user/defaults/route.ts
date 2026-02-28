// API Route: User Page Defaults
// GET /api/user/defaults — get; PUT /api/user/defaults — update

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as userService from '@/server/services/user.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await userService.getDefaults(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('user/defaults/get', error);
    return ApiErrors.internalError('Failed to fetch defaults');
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { defaultVslUrl, defaultFunnelTemplate } = body;

    if (defaultVslUrl && typeof defaultVslUrl === 'string' && defaultVslUrl.trim()) {
      try {
        const url = new URL(defaultVslUrl);
        const validHosts = ['youtube.com', 'www.youtube.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com', 'loom.com', 'www.loom.com'];
        if (!validHosts.some((host) => url.hostname === host || url.hostname.endsWith('.' + host))) {
          return ApiErrors.validationError('Video URL must be from YouTube, Vimeo, or Loom');
        }
      } catch {
        return ApiErrors.validationError('Invalid video URL format');
      }
    }

    const validTemplateIds = ['minimal', 'social_proof', 'authority', 'full_suite'];
    if (defaultFunnelTemplate !== undefined && !validTemplateIds.includes(defaultFunnelTemplate)) {
      return ApiErrors.validationError('Invalid funnel template ID');
    }

    const result = await userService.updateDefaults(session.user.id, {
      defaultVslUrl,
      defaultFunnelTemplate,
    });
    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'VALIDATION' || err.message?.startsWith('VALIDATION:')) {
      return ApiErrors.validationError(err.message?.replace('VALIDATION: ', '') ?? 'Validation failed');
    }
    logApiError('user/defaults/update', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to update defaults');
  }
}
