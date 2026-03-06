import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpTemplatesService from '@/server/services/cp-templates.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = request.nextUrl.searchParams.get('scope') as 'global' | 'mine' | null;
    const result = await cpTemplatesService.list(session.user.id, scope);
    if (!result.success) return ApiErrors.databaseError('Failed to fetch templates');
    return NextResponse.json({ templates: result.templates });
  } catch (error) {
    logApiError('cp/templates', error);
    return ApiErrors.internalError('Failed to fetch templates');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { name, category, description, structure, example_posts, use_cases, tags } = body;
    if (!name || !structure) return ApiErrors.validationError('name and structure are required');

    const result = await cpTemplatesService.create(session.user.id, {
      name,
      category,
      description,
      structure,
      example_posts,
      use_cases,
      tags,
    });
    if (!result.success) return ApiErrors.databaseError('Failed to create template');
    return NextResponse.json({ template: result.template }, { status: 201 });
  } catch (error) {
    logApiError('cp/templates', error);
    return ApiErrors.internalError('Failed to create template');
  }
}
