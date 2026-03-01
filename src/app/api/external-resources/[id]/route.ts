import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as externalResourcesService from '@/server/services/external-resources.service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid resource ID');

    const result = await externalResourcesService.getById(session.user.id, id);
    if (!result) return ApiErrors.notFound('External resource');
    return NextResponse.json(result);
  } catch (error) {
    logApiError('external-resources/get', error);
    return ApiErrors.internalError('Failed to fetch external resource');
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid resource ID');

    const body = await request.json();
    const { title, url, icon } = body;
    const updates: { title?: string; url?: string; icon?: string } = {};
    if (title !== undefined) updates.title = title;
    if (icon !== undefined) updates.icon = icon;
    if (url !== undefined) {
      try {
        new URL(url);
        updates.url = url;
      } catch {
        return ApiErrors.validationError('url must be a valid URL');
      }
    }
    if (Object.keys(updates).length === 0) return ApiErrors.validationError('No fields to update');

    const result = await externalResourcesService.updateById(session.user.id, id, updates);
    if (!result) return ApiErrors.notFound('External resource');
    return NextResponse.json(result);
  } catch (error) {
    logApiError('external-resources/update', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to update external resource');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid resource ID');

    const deleted = await externalResourcesService.deleteById(session.user.id, id);
    if (!deleted) return ApiErrors.notFound('External resource');
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('external-resources/delete', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to delete external resource');
  }
}
