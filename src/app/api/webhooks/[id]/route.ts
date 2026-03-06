// API Route: Single Webhook Configuration
// PUT, DELETE, POST (test) /api/webhooks/[id]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as webhooksService from '@/server/services/webhooks.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const body = await request.json();
    const updateData: { name?: string; url?: string; isActive?: boolean } = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.url !== undefined) {
      try {
        new URL(body.url);
      } catch {
        return ApiErrors.validationError('Invalid URL format');
      }
      if (!body.url.startsWith('https://')) return ApiErrors.validationError('Webhook URL must use HTTPS');
      updateData.url = body.url;
    }
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const result = await webhooksService.update(session.user.id, id, updateData);
    if (!result.success) {
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'No valid fields to update');
      if (result.error === 'not_found') return ApiErrors.notFound('Webhook');
      return ApiErrors.databaseError('Failed to update webhook');
    }
    return NextResponse.json({ webhook: result.webhook });
  } catch (error) {
    logApiError('webhooks/update', error);
    return ApiErrors.internalError('Failed to update webhook');
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const result = await webhooksService.deleteWebhook(session.user.id, id);
    if (!result.success) return ApiErrors.databaseError('Failed to delete webhook');
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('webhooks/delete', error);
    return ApiErrors.internalError('Failed to delete webhook');
  }
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const result = await webhooksService.testWebhook(session.user.id, id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Webhook');
      if (result.error === 'delivery') {
        return NextResponse.json({
          success: false,
          status: result.status,
          message: result.message,
        });
      }
      return ApiErrors.internalError(result.message ?? 'Failed to test webhook');
    }
    return NextResponse.json({
      success: true,
      status: result.status,
      message: result.message,
    });
  } catch (error) {
    logApiError('webhooks/test', error);
    return ApiErrors.internalError('Failed to test webhook');
  }
}
