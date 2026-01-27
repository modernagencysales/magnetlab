// API Route: Export Leads as CSV
// GET /api/leads/export?funnelId=xxx

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// Maximum leads to export at once to prevent memory issues
const MAX_EXPORT_LIMIT = 10000;

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

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('funnel_leads')
      .select(`
        email,
        name,
        is_qualified,
        qualification_answers,
        utm_source,
        utm_medium,
        utm_campaign,
        created_at,
        funnel_pages!inner(slug),
        lead_magnets!inner(title)
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_EXPORT_LIMIT);

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

    const { data, error } = await query;

    if (error) {
      console.error('Export leads error:', error);
      return NextResponse.json({ error: 'Failed to export leads' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No leads to export' }, { status: 404 });
    }

    // Build CSV
    const headers = [
      'email',
      'name',
      'qualified',
      'lead_magnet',
      'funnel_slug',
      'answers',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'created_at',
    ];

    const rows = data.map((lead) => {
      // Supabase joins with !inner return single objects, but TypeScript sees them as arrays
      const leadMagnet = lead.lead_magnets as unknown as { title: string } | null;
      const funnelPage = lead.funnel_pages as unknown as { slug: string } | null;

      return [
        escapeCSV(lead.email),
        escapeCSV(lead.name || ''),
        lead.is_qualified === null ? '' : lead.is_qualified ? 'yes' : 'no',
        escapeCSV(leadMagnet?.title || ''),
        escapeCSV(funnelPage?.slug || ''),
        escapeCSV(lead.qualification_answers ? JSON.stringify(lead.qualification_answers) : ''),
        escapeCSV(lead.utm_source || ''),
        escapeCSV(lead.utm_medium || ''),
        escapeCSV(lead.utm_campaign || ''),
        lead.created_at,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `leads-export-${date}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export leads error:', error);
    return NextResponse.json({ error: 'Failed to export leads' }, { status: 500 });
  }
}

function escapeCSV(value: string): string {
  if (!value) return '';
  // Escape quotes by doubling them
  const escaped = value.replace(/"/g, '""');
  // Wrap in quotes if contains comma, newline, or quote
  if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
    return `"${escaped}"`;
  }
  return escaped;
}
