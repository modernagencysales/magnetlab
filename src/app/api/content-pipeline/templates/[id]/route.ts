import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpTemplatesService from '@/server/services/cp-templates.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const { id } = await params;
    const result = await cpTemplatesService.getById(scope, id);
    if (!result.success) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json({ template: result.template });
  } catch (error) {
    logApiError('cp/templates', error);
    return ApiErrors.internalError('Failed to fetch template');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const { id } = await params;
    const body = await request.json();
    const result = await cpTemplatesService.update(scope, id, body);
    if (!result.success) {
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'No valid fields to update');
      return ApiErrors.databaseError('Failed to update template');
    }
    return NextResponse.json({ template: result.template });
  } catch (error) {
    logApiError('cp/templates', error);
    return ApiErrors.internalError('Failed to update template');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const { id } = await params;
    const result = await cpTemplatesService.deleteTemplate(scope, id);
    if (!result.success) return ApiErrors.databaseError('Failed to delete template');
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('cp/templates', error);
    return ApiErrors.internalError('Failed to delete template');
  }
}
