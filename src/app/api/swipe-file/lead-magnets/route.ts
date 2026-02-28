import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as swipeFileService from '@/server/services/swipe-file.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche') ?? undefined;
    const format = searchParams.get('format') ?? undefined;
    const featured = searchParams.get('featured') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await swipeFileService.listLeadMagnets({
      niche,
      format,
      featured,
      limit,
      offset,
    });
    return NextResponse.json(result);
  } catch (error) {
    logApiError('swipe-file/lead-magnets', error);
    return ApiErrors.internalError();
  }
}
