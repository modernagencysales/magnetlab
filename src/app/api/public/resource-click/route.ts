// API Route: Track External Resource Clicks
// POST /api/public/resource-click

import { NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/api/errors';
import * as publicService from '@/server/services/public.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { resourceId, funnelPageId } = body;

    if (!resourceId || !isValidUUID(resourceId)) {
      return NextResponse.json({ error: 'Invalid resourceId' }, { status: 400 });
    }

    const funnelPageIdValid =
      funnelPageId && isValidUUID(funnelPageId) ? funnelPageId : null;

    await publicService.trackResourceClick(resourceId, funnelPageIdValid);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: true });
  }
}
