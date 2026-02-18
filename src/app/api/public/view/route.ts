// API Route: Track page views (public, no auth required)
// POST /api/public/view

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { createHash } from 'crypto';
import { logApiError } from '@/lib/api/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { funnelPageId, pageType } = body;

    if (!funnelPageId) {
      return NextResponse.json({ error: 'Missing funnelPageId' }, { status: 400 });
    }

    // Get IP and User Agent for visitor hash
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create a hash for unique visitor identification (privacy-preserving)
    const visitorHash = createHash('sha256')
      .update(`${ip}-${userAgent}`)
      .digest('hex')
      .substring(0, 32);

    const supabase = createSupabaseAdminClient();

    // Insert view (will be ignored if duplicate due to unique constraint)
    const { error } = await supabase
      .from('page_views')
      .upsert(
        {
          funnel_page_id: funnelPageId,
          visitor_hash: visitorHash,
          view_date: new Date().toISOString().split('T')[0],
          page_type: pageType || 'optin',
        },
        {
          onConflict: 'funnel_page_id,visitor_hash,view_date,page_type',
          ignoreDuplicates: true,
        }
      );

    if (error) {
      // Ignore duplicate key errors
      if (error.code !== '23505') {
        logApiError('public/view', error, { funnelPageId });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('public/view', error);
    return NextResponse.json({ error: 'Failed to track view', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
