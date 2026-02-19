import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

const MAX_COMPETITORS = 10;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('cp_monitored_competitors')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get engagement counts per competitor
    const competitors = await Promise.all(
      (data || []).map(async (comp) => {
        const { count } = await supabase
          .from('cp_post_engagements')
          .select('id', { count: 'exact', head: true })
          .eq('competitor_id', comp.id);
        return { ...comp, total_engagers: count || 0 };
      })
    );

    return NextResponse.json({ competitors });
  } catch (error) {
    logError('api/competitors', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { linkedinProfileUrl, heyreachCampaignId } = body as {
      linkedinProfileUrl: string;
      heyreachCampaignId?: string;
    };

    if (!linkedinProfileUrl?.trim()) {
      return NextResponse.json({ error: 'LinkedIn profile URL is required' }, { status: 400 });
    }

    // Normalize URL
    let normalizedUrl = linkedinProfileUrl.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://www.linkedin.com/in/${normalizedUrl}`;
    }
    // Strip query params and trailing slash
    normalizedUrl = normalizedUrl.split('?')[0].replace(/\/$/, '');

    const supabase = createSupabaseAdminClient();

    // Check limit
    const { count } = await supabase
      .from('cp_monitored_competitors')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    if ((count || 0) >= MAX_COMPETITORS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_COMPETITORS} competitors allowed` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('cp_monitored_competitors')
      .insert({
        user_id: session.user.id,
        linkedin_profile_url: normalizedUrl,
        heyreach_campaign_id: heyreachCampaignId || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Competitor already added' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ competitor: data }, { status: 201 });
  } catch (error) {
    logError('api/competitors', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
