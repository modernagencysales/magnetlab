// API Route: Track page views (public, no auth required)
// POST /api/public/view

import { NextResponse } from 'next/server';
import { logApiError } from '@/lib/api/errors';
import * as publicService from '@/server/services/public.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { funnelPageId, pageType } = body;

    if (!funnelPageId) {
      return NextResponse.json({ error: 'Missing funnelPageId' }, { status: 400 });
    }

    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await publicService.trackView(funnelPageId, pageType, ip, userAgent);
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('public/view', error);
    return NextResponse.json({ error: 'Failed to track view', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
