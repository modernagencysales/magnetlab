// API Route: Leads Management
// GET /api/leads - List leads with pagination and filtering

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// Pagination limits to prevent memory exhaustion
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

interface LeadWithFunnel {
  id: string;
  email: string;
  name: string | null;
  is_qualified: boolean | null;
  qualification_answers: Record<string, string> | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  funnel_pages: {
    slug: string;
    optin_headline: string;
    lead_magnets: {
      title: string;
    } | null;
  };
}

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
    const search = searchParams.get('search');

    // Validate and clamp pagination parameters
    const rawLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT));
    const rawOffset = parseInt(searchParams.get('offset') || '0');

    if (isNaN(rawLimit) || isNaN(rawOffset)) {
      return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 });
    }

    const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
    const offset = Math.max(0, rawOffset);

    const supabase = createSupabaseAdminClient();

    // Build query with funnel info
    let query = supabase
      .from('funnel_leads')
      .select(`
        id,
        email,
        name,
        is_qualified,
        qualification_answers,
        utm_source,
        utm_medium,
        utm_campaign,
        created_at,
        funnel_pages!inner (
          slug,
          optin_headline,
          lead_magnets (
            title
          )
        )
      `, { count: 'exact' })
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

    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('List leads error:', error);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    // Transform to include funnel info
    const leads = (data as unknown as LeadWithFunnel[]).map((lead) => ({
      id: lead.id,
      email: lead.email,
      name: lead.name,
      isQualified: lead.is_qualified,
      qualificationAnswers: lead.qualification_answers,
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium,
      utmCampaign: lead.utm_campaign,
      createdAt: lead.created_at,
      funnelSlug: lead.funnel_pages?.slug || null,
      funnelHeadline: lead.funnel_pages?.optin_headline || null,
      leadMagnetTitle: lead.funnel_pages?.lead_magnets?.title || null,
    }));

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
