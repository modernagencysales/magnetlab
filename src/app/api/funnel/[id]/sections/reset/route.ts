import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, isValidUUID } from '@/lib/api/errors';
import * as funnelsService from '@/server/services/funnels.service';
import type { PageLocation } from '@/lib/types/funnel';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid funnel page ID');

    const body = await request.json();
    const { pageLocation } = body;

    const validLocations: PageLocation[] = ['optin', 'thankyou', 'content'];
    if (!validLocations.includes(pageLocation)) return ApiErrors.validationError('Invalid pageLocation');

    const scope = await getDataScope(session.user.id);
    const sections = await funnelsService.resetSections(scope, id, pageLocation);
    return NextResponse.json({ sections });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
