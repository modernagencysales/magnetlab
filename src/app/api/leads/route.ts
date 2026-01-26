// API Route: Leads Management
// GET /api/leads - List leads with pagination and filtering

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { funnelLeadFromRow, type FunnelLeadRow } from '@/lib/types/funnel';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const funnelId = searchParams.get('funnelId');
    const leadMagnetId = searchParams.get('leadMagnetId');
    const qualified = searchParams.get('qualified');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('funnel_leads')
      .select('*', { count: 'exact' })
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (funnelId) {
      query = query.eq('funnel_page_id', funnelId);
    }

    if (leadMagnetId) {
      query = query.eq('lead_magnet_id', leadMagnetId);
    }

    if (qualified === 'true') {
      query = query.eq('is_qualified', true);
    } else if (qualified === 'false') {
      query = query.eq('is_qualified', false);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('List leads error:', error);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    const leads = (data as FunnelLeadRow[]).map(funnelLeadFromRow);

    return NextResponse.json({
      leads,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('List leads error:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}
