// API Route: Webhook Configurations
// GET, POST /api/webhooks

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as webhooksService from '@/server/services/webhooks.service';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await webhooksService.list(session.user.id, limit, offset);
    if (!result.success) return ApiErrors.databaseError('Failed to fetch webhooks');
    return NextResponse.json({ webhooks: result.webhooks });
  } catch (error) {
    logApiError('webhooks/list', error);
    return ApiErrors.internalError('Failed to fetch webhooks');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { name, url } = body;
    if (!name || !url) return ApiErrors.validationError('name and url are required');
    try {
      new URL(url);
    } catch {
      return ApiErrors.validationError('Invalid URL format');
    }
    if (!url.startsWith('https://')) return ApiErrors.validationError('Webhook URL must use HTTPS');

    const result = await webhooksService.create(session.user.id, name, url);
    if (!result.success) return ApiErrors.databaseError('Failed to create webhook');
    return NextResponse.json({ webhook: result.webhook }, { status: 201 });
  } catch (error) {
    logApiError('webhooks/create', error);
    return ApiErrors.internalError('Failed to create webhook');
  }
}
