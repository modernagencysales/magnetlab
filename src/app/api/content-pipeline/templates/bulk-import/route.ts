import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpTemplatesService from '@/server/services/cp-templates.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const body = await request.json();
    const { templates } = body;
    if (!Array.isArray(templates) || templates.length === 0) return ApiErrors.validationError('templates array is required');

    for (let i = 0; i < templates.length; i++) {
      if (!templates[i].name || !templates[i].structure) {
        return ApiErrors.validationError(`Template at index ${i} missing name or structure`);
      }
    }

    const result = await cpTemplatesService.bulkImport(scope, templates);
    if (!result.success) {
      if (result.error === 'validation') return NextResponse.json({ error: result.message }, { status: 400 });
      return ApiErrors.databaseError('Failed to import templates');
    }
    return NextResponse.json({ imported: result.imported, templates: result.templates }, { status: 201 });
  } catch (error) {
    logApiError('cp/templates', error);
    return ApiErrors.internalError('Failed to import templates');
  }
}
