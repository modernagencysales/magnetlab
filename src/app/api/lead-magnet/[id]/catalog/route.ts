import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, isValidUUID } from '@/lib/api/errors';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid lead magnet ID');

    let body: { pain_point?: string; target_audience?: string; short_description?: string };
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON');
    }

    await leadMagnetsService.updateCatalogFields(session.user.id, id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
