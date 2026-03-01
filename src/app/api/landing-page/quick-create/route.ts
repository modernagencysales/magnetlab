// API Route: Quick-create landing page
// POST /api/landing-page/quick-create — stub lead magnet + AI opt-in copy + funnel page

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getPostHogServerClient } from '@/lib/posthog';
import * as landingPageService from '@/server/services/landing-page.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { title, description } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return ApiErrors.validationError('Title is required');
    }

    const result = await landingPageService.quickCreate(
      session.user.id,
      title.trim(),
      typeof description === 'string' ? description : undefined
    );

    try {
      getPostHogServerClient()?.capture({
        distinctId: session.user.id,
        event: 'landing_page_quick_created',
        properties: { lead_magnet_id: result.leadMagnetId, title: title.trim() },
      });
    } catch {
      // ignore
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logApiError('landing-page/quick-create', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to create landing page');
  }
}
