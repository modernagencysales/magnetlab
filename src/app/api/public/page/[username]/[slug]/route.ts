// API Route: Public Page Data
// GET /api/public/page/[username]/[slug]

import { NextResponse } from 'next/server';
import { logApiError } from '@/lib/api/errors';
import * as publicService from '@/server/services/public.service';

interface RouteParams {
  params: Promise<{ username: string; slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { username, slug } = await params;
    const { data, error } = await publicService.getPublicPageData(username, slug);

    if (error || !data) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    logApiError('public/page', error);
    return NextResponse.json({ error: 'Failed to fetch page', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
