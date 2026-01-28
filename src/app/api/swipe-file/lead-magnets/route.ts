// Swipe File Lead Magnets API
// GET /api/swipe-file/lead-magnets - List approved lead magnets with filters

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);

    // Filters
    const niche = searchParams.get('niche');
    const format = searchParams.get('format');
    const featured = searchParams.get('featured') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('swipe_file_lead_magnets')
      .select('*', { count: 'exact' })
      .in('status', ['approved', 'featured'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (niche) {
      query = query.eq('niche', niche);
    }

    if (format) {
      query = query.eq('format', format);
    }

    if (featured) {
      query = query.eq('status', 'featured');
    }

    const { data, error, count } = await query;

    if (error) {
      logApiError('swipe-file/lead-magnets', error);
      return ApiErrors.databaseError('Failed to fetch lead magnets');
    }

    return NextResponse.json({
      leadMagnets: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logApiError('swipe-file/lead-magnets', error);
    return ApiErrors.internalError();
  }
}
