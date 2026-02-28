// API Route: External Lead Magnet Stats
// GET /api/external/lead-magnets/[id]/stats
//
// Returns funnel performance data for a lead magnet.
// Authenticated with Bearer token (EXTERNAL_API_KEY).

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { leadMagnetStats } from '@/server/services/external.service';

function authenticateRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;
  if (!expectedKey) {
    logApiError('external/lead-magnets/stats/auth', new Error('EXTERNAL_API_KEY env var is not set'));
    return false;
  }
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!authenticateRequest(request)) return ApiErrors.unauthorized('Invalid or missing API key');

    const { id: leadMagnetId } = await params;
    if (!leadMagnetId) return ApiErrors.validationError('Lead magnet ID is required');

    const result = await leadMagnetStats(leadMagnetId);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Lead magnet');
      return ApiErrors.internalError('Failed to fetch stats');
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    logApiError('external/lead-magnets/stats', error);
    return ApiErrors.internalError('An unexpected error occurred while fetching stats');
  }
}
