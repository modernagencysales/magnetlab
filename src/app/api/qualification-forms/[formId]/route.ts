import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as qualificationFormsService from '@/server/services/qualification-forms.service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ formId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { formId } = await params;
    const result = await qualificationFormsService.getForm(session.user.id, formId);
    if (!result) return ApiErrors.notFound('Qualification form');
    return NextResponse.json(result);
  } catch (error) {
    logApiError('qualification-forms/get', error);
    return ApiErrors.internalError('Failed to get form');
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ formId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { formId } = await params;
    const body = await request.json();
    const updates: { name?: string } = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return ApiErrors.validationError('name must be a non-empty string');
      }
      updates.name = body.name.trim();
    }
    if (Object.keys(updates).length === 0) {
      return ApiErrors.validationError('No valid fields to update');
    }

    const result = await qualificationFormsService.updateForm(session.user.id, formId, updates);
    if (!result) return ApiErrors.notFound('Qualification form');
    return NextResponse.json(result);
  } catch (error) {
    logApiError('qualification-forms/update', error);
    return ApiErrors.internalError('Failed to update form');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ formId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { formId } = await params;
    const deleted = await qualificationFormsService.deleteForm(session.user.id, formId);
    if (!deleted) return ApiErrors.notFound('Qualification form');
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('qualification-forms/delete', error);
    return ApiErrors.internalError('Failed to delete form');
  }
}
